import { useState, useMemo, useRef, useEffect } from "react";
import { X, Calendar, Plus, Minus, Trash2, ShoppingCart, Search, Package, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product, OrderItem } from "@/types/product";
import { salesApi } from "@/services/mysqlApi";
import { useToast } from "@/hooks/use-toast";
import { getProductDisplayName } from "@/utils/productDisplay";
import { parseVariations } from "@/utils/variationParser";
import { getCurrentOperator } from "@/utils/operator";

// List of operators (same as PasswordProtection)
const OPERATORS = [
  "mytch",
  "moi",
  "keysia",
  "shems",
  "sheena",
];

// Format date to MySQL compatible format (YYYY-MM-DD HH:MM:SS)
const formatMySQLDateTime = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

interface AddBackdatedSaleDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  products: Product[];
}

interface SaleItem {
  product: Product;
  quantity: number;
  price: number; // Can be overridden
}

export function AddBackdatedSaleDialog({
  open,
  onClose,
  onComplete,
  products,
}: AddBackdatedSaleDialogProps) {
  const { toast } = useToast();
  const [saleDate, setSaleDate] = useState<string>(() => {
    // Default to today
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [saleTime, setSaleTime] = useState<string>(() => {
    // Default to current time
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedOperator, setSelectedOperator] = useState<string>(() => getCurrentOperator());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter products for search - using same logic as ProductSearch
  const [productSearch, setProductSearch] = useState("");
  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query || query.length < 1) {
      // Show products with prices (or variations with prices) when no search
      return products.filter((p) => {
        if (p.price != null && p.price > 0) return true;
        const variations = parseVariations(p);
        return variations.some((v) => v && v.price != null && v.price > 0);
      }).slice(0, 20);
    }
    
    // Filter products that match the search query (same logic as ProductSearch)
    return products.filter((product) => {
      // Fast path: check product name first
      const productNameLower = product.name.toLowerCase();
      const productNameMatches = productNameLower.includes(query);
      
      // If product has price and name matches, include immediately
      if (productNameMatches && product.price != null && product.price > 0) {
        return true;
      }
      
      // Parse variations using cached parser
      const variations = parseVariations(product);
      
      // Check if any variation name matches
      const variationNameMatches = variations.some((v) => {
        return v?.name?.toLowerCase().includes(query);
      });
      
      // Match if either product name or variation name matches
      const matchesQuery = productNameMatches || variationNameMatches;
      if (!matchesQuery) return false;
      
      // If product has a price, include it
      if (product.price != null && product.price > 0) {
        return true;
      }
      
      // If product has no price, check if it has variations with prices
      const hasVariationsWithPrices = variations.some((v) => v && v.price != null && v.price > 0);
      
      // Include product if it has variations with prices
      return hasVariationsWithPrices;
    }).slice(0, 50); // Show more results for better search
  }, [products, productSearch]);
  
  // Flatten products to include variations as separate selectable items
  const flatSelectableProducts = useMemo(() => {
    const flat: Product[] = [];
    
    filteredProducts.forEach((product) => {
      const parentHasPrice = product.price != null && product.price > 0;
      const variations = parseVariations(product);
      
      // Add base product if it has a price
      if (parentHasPrice) {
        flat.push(product);
      }
      
      // Add variations with prices
      variations.forEach((v) => {
        if (v && v.price != null && v.price > 0) {
          flat.push({
            ...product,
            id: `${product.id}-${v.id || v.name}`,
            name: v.name && v.name.trim() && !v.name.includes(' - ₱') 
              ? `${product.name} - ${v.name.trim()}`
              : product.name,
            price: v.price,
            stock_quantity: v.stock_quantity,
            image_url: v.image_url || product.image_url,
          });
        }
      });
    });
    
    return flat;
  }, [filteredProducts]);

  const handleProductSelect = (product: Product) => {
    // Check if product already in items (match by exact ID for variations)
    const existingIndex = items.findIndex((item) => item.product.id === product.id);
    if (existingIndex >= 0) {
      // Increase quantity
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // Add new item - use the product as-is (could be base product or variation)
      setItems((prev) => [
        ...prev,
        {
          product,
          quantity: 1,
          price: product.price || 0,
        },
      ]);
    }

    // Clear search and reset selection
    setProductSearch("");
    setSelectedIndex(0);
    searchInputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const maxIndex = flatSelectableProducts.length - 1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
        break;
      case "Enter":
        e.preventDefault();
        if (flatSelectableProducts[selectedIndex]) {
          handleProductSelect(flatSelectableProducts[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setProductSearch("");
        setSelectedIndex(0);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [productSearch]);

  const handleUpdateQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const handleUpdatePrice = (index: number, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, price: Math.max(0, price) } : item
      )
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleSave = async () => {
    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to the sale",
        variant: "destructive",
      });
      return;
    }

    if (!saleDate) {
      toast({
        title: "Date Required",
        description: "Please select a sale date",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Combine date and time
      const [year, month, day] = saleDate.split("-");
      const [hours, minutes] = saleTime.split(":");
      const saleDateTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      );

      // Build items array
      const itemsData = items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      }));

      const total = calculateTotal();
      const tendered = parseFloat(amountTendered) || total;
      const change = Math.max(0, tendered - total);

      // Create sale record with custom date and selected operator
      const saleData = {
        items: JSON.stringify(itemsData),
        total,
        payment_method: paymentMethod,
        amount_tendered: tendered,
        change_amount: change,
        created_at: formatMySQLDateTime(saleDateTime),
        operator_name: selectedOperator, // Use selected operator for backdated sale
      };

      const result = await salesApi.create(saleData);

      if (result.success) {
        // Note: For backdated sales, we skip stock updates since the stock
        // was already adjusted when the sale actually occurred in the past.
        // We only record the sale transaction for accounting/reporting purposes.

        toast({
          title: "Sale Recorded",
          description: `Backdated sale recorded for ${saleDate} ${saleTime}. Stock was not updated.`,
        });

        // Reset form
        setItems([]);
        setSaleDate(() => {
          const today = new Date();
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        });
        setSaleTime(() => {
          const now = new Date();
          return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        });
        setPaymentMethod("cash");
        setAmountTendered("");
        setProductSearch("");
        setSelectedIndex(0);
        setSelectedOperator(getCurrentOperator()); // Reset to current operator

        onComplete();
        onClose();
      } else {
        throw new Error(result.error || "Failed to create sale");
      }
    } catch (error) {
      console.error("Error creating backdated sale:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record sale",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const total = calculateTotal();
  const tendered = parseFloat(amountTendered) || total;
  const change = Math.max(0, tendered - total);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Add Backdated Sale
          </DialogTitle>
          <DialogDescription>
            Record a sale that was missed or not recorded on time. Select a previous or custom date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date, Time, and Operator Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale-date">Sale Date</Label>
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]} // Can't select future dates
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-time">Sale Time</Label>
              <Input
                id="sale-time"
                type="time"
                value={saleTime}
                onChange={(e) => setSaleTime(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Select
                value={selectedOperator}
                onValueChange={setSelectedOperator}
                disabled={isSaving}
              >
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((operator) => (
                    <SelectItem key={operator} value={operator}>
                      {operator}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Add Product</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search products... (Use ↑↓ to navigate, Enter to add)"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
                disabled={isSaving}
              />
            </div>
            
            {/* Search Results */}
            {productSearch && flatSelectableProducts.length > 0 && (
              <div
                ref={listRef}
                className="border-2 border-border rounded-lg max-h-64 overflow-y-auto bg-card"
              >
                {flatSelectableProducts.map((product, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={product.id}
                      data-index={index}
                      onClick={() => handleProductSelect(product)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-secondary/50 border-l-4 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded shrink-0"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-secondary flex items-center justify-center rounded shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {getProductDisplayName(product.id, product.name, products)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product.category || "No category"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="font-mono font-semibold text-foreground">
                          ₱{product.price.toFixed(2)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {productSearch && flatSelectableProducts.length === 0 && (
              <div className="border-2 border-border rounded-lg p-4 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No products found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Sale Items</Label>
              <div className="border-2 border-border rounded-lg divide-y divide-border">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 flex items-center gap-3 hover:bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {getProductDisplayName(item.product.id, item.product.name, products)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.product.category || "No category"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUpdateQuantity(index, -1)}
                        disabled={isSaving}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-12 text-center font-mono text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUpdateQuantity(index, 1)}
                        disabled={isSaving}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price.toFixed(2)}
                        onChange={(e) => handleUpdatePrice(index, e.target.value)}
                        className="w-20 text-right font-mono text-sm"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="w-24 text-right font-mono font-semibold">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveItem(index)}
                      disabled={isSaving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount-tendered">Amount Tendered</Label>
                <Input
                  id="amount-tendered"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  placeholder={total.toFixed(2)}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-secondary/30 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">₱{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Tendered:</span>
                <span className="font-mono">₱{tendered.toFixed(2)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Change:</span>
                  <span className="font-mono text-success">₱{change.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>Total:</span>
                <span className="font-mono text-primary">₱{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={items.length === 0 || isSaving}
              className="gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {isSaving ? "Recording..." : "Record Sale"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

