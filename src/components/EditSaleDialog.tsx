import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaleRecord, salesApi, stockApi, productsApi } from "@/services/mysqlApi";
import { Product } from "@/types/product";
import { useToast } from "@/hooks/use-toast";

interface ParsedSaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedServices?: Array<{ id: string; name: string; price: number }>;
  services?: Array<{ id: string; name: string; price: number }>;
  bottleDeposit?: number;
  bottleDepositTotal?: number;
}

interface EditSaleDialogProps {
  sale: SaleRecord;
  products: Product[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function EditSaleDialog({ sale, products, onConfirm, onCancel }: EditSaleDialogProps) {
  const [items, setItems] = useState<ParsedSaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Parse items from sale
    try {
      const parsed = JSON.parse(sale.items || '[]') as ParsedSaleItem[];
      // Normalize services field name
      const normalized = parsed.map(item => ({
        ...item,
        selectedServices: item.selectedServices || item.services || [],
      }));
      setItems(normalized);
    } catch (error) {
      console.error("Error parsing sale items:", error);
      setItems([]);
    }
  }, [sale]);

  const handleAddItem = () => {
    setItems([...items, {
      productId: '',
      name: '',
      price: 0,
      quantity: 1,
      selectedServices: [],
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ParsedSaleItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const updated = [...items];
      updated[index] = {
        ...updated[index],
        productId: product.id,
        name: product.name,
        price: product.price,
      };
      setItems(updated);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const productTotal = item.price * item.quantity;
      const servicesTotal = (item.selectedServices || []).reduce(
        (serviceSum, service) => serviceSum + service.price * item.quantity,
        0
      );
      const depositTotal = item.bottleDepositTotal || 0;
      return sum + productTotal + servicesTotal + depositTotal;
    }, 0);
  };

  const handleSave = async () => {
    // Validate items
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "At least one item is required",
        variant: "destructive",
      });
      return;
    }

    for (const item of items) {
      if (!item.productId || !item.name || item.price <= 0 || item.quantity <= 0) {
        toast({
          title: "Error",
          description: "All items must have a valid product, price, and quantity",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      // Get original sale items for stock adjustment
      const originalItems: ParsedSaleItem[] = JSON.parse(sale.items || '[]');
      
      // Calculate new total
      const newTotal = calculateTotal();
      
      // Prepare new items data (remove selectedServices, use services for compatibility)
      const newItemsData = items.map(item => {
        const itemData: any = {
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        };
        
        if (item.selectedServices && item.selectedServices.length > 0) {
          itemData.services = item.selectedServices;
          itemData.serviceFeeTotal = item.selectedServices.reduce(
            (sum, service) => sum + service.price * item.quantity,
            0
          );
        }
        
        if (item.bottleDeposit && item.bottleDepositTotal) {
          itemData.bottleDeposit = item.bottleDeposit;
          itemData.bottleDepositTotal = item.bottleDepositTotal;
        }
        
        return itemData;
      });

      // Update sale record
      const updateResult = await salesApi.update(sale.id!, {
        items: JSON.stringify(newItemsData),
        total: newTotal,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to update sale");
      }

      // Adjust stock for changed items
      // First, restore stock for original items (add back what was sold)
      for (const originalItem of originalItems) {
        const product = products.find(p => p.id === originalItem.productId);
        if (product && !product.skip_stock_tracking && product.stock_quantity !== undefined) {
          try {
            // Fetch current stock from API to ensure accuracy
            const productResult = await productsApi.getById(originalItem.productId);
            const currentStock = productResult.success && productResult.data && productResult.data.length > 0
              ? productResult.data[0].stock_quantity ?? 0
              : product.stock_quantity ?? 0;
            
            await stockApi.adjustStock(
              originalItem.productId,
              'add',
              originalItem.quantity,
              currentStock,
              `Sale correction: Restore stock from sale #${sale.id}`
            );
          } catch (error) {
            console.error(`Failed to restore stock for ${originalItem.productId}:`, error);
          }
        }
      }

      // Then, deduct stock for new items (subtract what's being sold now)
      for (const newItem of items) {
        const product = products.find(p => p.id === newItem.productId);
        if (product && !product.skip_stock_tracking && product.stock_quantity !== undefined) {
          try {
            // Fetch current stock from API to ensure accuracy
            const productResult = await productsApi.getById(newItem.productId);
            const currentStock = productResult.success && productResult.data && productResult.data.length > 0
              ? productResult.data[0].stock_quantity ?? 0
              : product.stock_quantity ?? 0;
            
            await stockApi.recordSale(newItem.productId, newItem.quantity, currentStock);
          } catch (error) {
            console.error(`Failed to update stock for ${newItem.productId}:`, error);
          }
        }
      }

      toast({
        title: "Sale Updated",
        description: `Sale #${sale.id} has been corrected successfully`,
      });

      onConfirm();
    } catch (error) {
      console.error("Error updating sale:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update sale",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-4xl animate-scale-in max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Edit Sale Record</h2>
            <p className="text-sm text-muted-foreground">Sale #{sale.id} - Correct items, quantities, and prices</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-6">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="glass-panel rounded-lg p-4 border border-border/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Product Selection */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Product</label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        className="w-full px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - ₱{product.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      {item.productId && (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          placeholder="Product name"
                          className="w-full mt-2 px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      )}
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Price (₱)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                        className="font-mono"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Item Total */}
                <div className="mt-2 text-sm text-muted-foreground">
                  Total: ₱{((item.price * item.quantity) + ((item.selectedServices || []).reduce((sum, s) => sum + s.price * item.quantity, 0))).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleAddItem}
            variant="outline"
            className="w-full mt-4 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        </div>

        {/* Total and Actions */}
        <div className="flex-shrink-0 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-foreground">Total:</span>
            <span className="text-2xl font-bold font-mono text-primary">₱{calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

