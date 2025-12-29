import { useState, useEffect, useRef } from "react";
import { X, Tag, Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVariation, ProductSupplier } from "@/types/product";
import { expensesApi } from "@/services/mysqlApi";

interface EditVariationDialogProps {
  productName: string;
  variation: ProductVariation;
  allVariations?: ProductVariation[]; // All variations for duplicate name checking
  onConfirm: (variationId: string, newPrice: number, newName?: string, suppliers?: ProductSupplier[]) => void;
  onCancel: () => void;
}

export function EditVariationDialog({ 
  productName,
  variation, 
  allVariations = [],
  onConfirm, 
  onCancel 
}: EditVariationDialogProps) {
  const [price, setPrice] = useState(variation.price.toString());
  const [variationName, setVariationName] = useState(variation.name || "");
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>(variation.suppliers || []);
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);
  
  // Check for duplicate variation names with same price (excluding current variation)
  const hasDuplicateNameAndPrice = (name: string, price: number): boolean => {
    if (!name.trim()) return false; // Empty names are allowed (will auto-generate)
    const trimmedName = name.trim();
    const numericPrice = parseFloat(price.toString()) || 0;
    if (numericPrice <= 0) return false;
    
    return allVariations.some((v) => {
      if (v.id === variation.id) return false; // Exclude current variation
      const vName = v.name ? v.name.trim() : '';
      const vPrice = typeof v.price === 'number' ? v.price : 0;
      // Check if same name (case-insensitive) AND same price (with floating point tolerance)
      return vName.toLowerCase() === trimmedName.toLowerCase() && 
             Math.abs(vPrice - numericPrice) < 0.01;
    });
  };

  // Load available suppliers from database
  useEffect(() => {
    const loadSuppliers = async () => {
      setIsLoadingSuppliers(true);
      try {
        const result = await expensesApi.getSuppliers();
        if (result.success && result.data) {
          setAvailableSuppliers(result.data);
        }
      } catch (error) {
        console.error("Error loading suppliers:", error);
      } finally {
        setIsLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, []);

  useEffect(() => {
    setPrice(variation.price.toString());
    setVariationName(variation.name || "");
    setSuppliers(variation.suppliers || []);
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [variation]);

  const handleAddSupplier = () => {
    setSuppliers([
      ...suppliers,
      {
        id: `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: "",
        price_per_piece: undefined,
        price_per_pack: undefined,
      },
    ]);
  };

  const handleRemoveSupplier = (supplierId: string) => {
    setSuppliers(suppliers.filter((s) => s.id !== supplierId));
  };

  const handleSupplierChange = (supplierId: string, field: keyof ProductSupplier, value: string | number | undefined) => {
    setSuppliers(
      suppliers.map((s) =>
        s.id === supplierId
          ? {
              ...s,
              [field]: value === "" ? undefined : value,
            }
          : s
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    if (numericPrice > 0) {
      // Check for duplicate name with same price
      const trimmedName = variationName.trim();
      const finalName = trimmedName || `${productName} - ₱${numericPrice.toFixed(2)}`;
      if (hasDuplicateNameAndPrice(finalName, numericPrice)) {
        return; // Don't submit if duplicate name+price exists
      }
      
      // Filter out suppliers with no name
      const validSuppliers = suppliers.filter((s) => s.name.trim() !== "");
      onConfirm(
        variation.id, 
        numericPrice, 
        trimmedName || undefined,
        validSuppliers.length > 0 ? validSuppliers : undefined
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div
        className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Edit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Edit Variation</h2>
              <p className="text-sm text-muted-foreground">{productName}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Variation Name (Optional)
            </label>
            <input
              type="text"
              value={variationName}
              onChange={(e) => setVariationName(e.target.value)}
              className={`w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                (() => {
                  const numericPrice = parseFloat(price) || 0;
                  const finalName = variationName.trim() || `${productName} - ₱${numericPrice.toFixed(2)}`;
                  return hasDuplicateNameAndPrice(finalName, numericPrice);
                })() ? 'border border-destructive/50' : ''
              }`}
              placeholder={`e.g., ${productName} - Small, ${productName} - Large`}
            />
            {(() => {
              const numericPrice = parseFloat(price) || 0;
              const finalName = variationName.trim() || `${productName} - ₱${numericPrice.toFixed(2)}`;
              const isDuplicate = hasDuplicateNameAndPrice(finalName, numericPrice);
              
              if (isDuplicate) {
                return (
                  <p className="text-xs text-destructive mt-1">
                    A variation with this name and price already exists. Use a different name or price.
                  </p>
                );
              }
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate: "{productName} - ₱X.XX"
                </p>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Price (₱)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                ₱
              </span>
              <input
                ref={priceInputRef}
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onCancel();
                  }
                }}
                className="w-full pl-7 pr-3 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.00"
              />
            </div>
            <div className="mt-2 p-2 bg-secondary/30 rounded text-xs text-muted-foreground">
              <p>Current: ₱{variation.price.toFixed(2)}</p>
              {variation.name && <p>Name: {variation.name}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-muted-foreground">
                Suppliers (Optional)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSupplier}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Supplier
              </Button>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No suppliers added. Click "Add Supplier" to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="p-3 bg-secondary/30 rounded-lg border border-border/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 flex gap-2">
                        {supplier.name && !availableSuppliers.includes(supplier.name) ? (
                          <input
                            type="text"
                            value={supplier.name}
                            onChange={(e) =>
                              handleSupplierChange(supplier.id, "name", e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-input rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Enter supplier name..."
                          />
                        ) : (
                          <select
                            value={supplier.name || ""}
                            onChange={(e) =>
                              handleSupplierChange(supplier.id, "name", e.target.value || undefined)
                            }
                            className="flex-1 px-3 py-2 bg-input rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            disabled={isLoadingSuppliers}
                          >
                            <option value="">Select supplier...</option>
                            {availableSuppliers.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSupplier(supplier.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Price per Piece (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                            ₱
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={supplier.price_per_piece || ""}
                            onChange={(e) =>
                              handleSupplierChange(
                                supplier.id,
                                "price_per_piece",
                                e.target.value ? parseFloat(e.target.value) : undefined
                              )
                            }
                            className="w-full pl-6 pr-2 py-1.5 bg-input rounded text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Price per Pack (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                            ₱
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={supplier.price_per_pack || ""}
                            onChange={(e) =>
                              handleSupplierChange(
                                supplier.id,
                                "price_per_pack",
                                e.target.value ? parseFloat(e.target.value) : undefined
                              )
                            }
                            className="w-full pl-6 pr-2 py-1.5 bg-input rounded text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 glow-primary"
              disabled={(() => {
                const numericPrice = parseFloat(price) || 0;
                if (!price || numericPrice <= 0) return true;
                const finalName = variationName.trim() || `${productName} - ₱${numericPrice.toFixed(2)}`;
                return hasDuplicateNameAndPrice(finalName, numericPrice);
              })()}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

