import { useState, useEffect, useRef } from "react";
import { X, Package, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";

interface AddProductVariationDialogProps {
  product: Product;
  onConfirm: (price: number, variationName: string, stockQuantity?: number) => void;
  onCancel: () => void;
}

export function AddProductVariationDialog({ 
  product, 
  onConfirm, 
  onCancel 
}: AddProductVariationDialogProps) {
  const [price, setPrice] = useState("");
  const [variationName, setVariationName] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrice("");
    setVariationName("");
    setStockQuantity("");
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    const numericStock = stockQuantity ? parseInt(stockQuantity) : 0;
    const name = variationName.trim() || `${product.name} - ₱${numericPrice.toFixed(2)}`;
    if (numericPrice > 0) {
      onConfirm(numericPrice, name, numericStock);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Parse variations if it's a string
  const parseVariations = (): any[] => {
    if (!product.variations) return [];
    if (Array.isArray(product.variations)) return product.variations;
    if (typeof product.variations === 'string') {
      try {
        return JSON.parse(product.variations);
      } catch {
        return [];
      }
    }
    return [];
  };

  const existingVariations = parseVariations();
  // Filter out invalid variations and get valid prices
  const validVariations = existingVariations.filter((v: any) => v && typeof v.price === 'number' && v.price > 0);
  const existingPrices = [
    ...(product.price > 0 ? [product.price] : []),
    ...validVariations.map((v: any) => v.price)
  ].sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div
        className="glass-panel rounded-xl p-6 w-[95vw] max-w-xl mx-4 animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Add Price Variation</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Show existing variations */}
        {(existingVariations.length > 0 || product.price > 0) && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Existing Price Variations:</p>
            <div className="flex flex-wrap gap-2">
              {product.price > 0 && (
                <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-mono">
                  Base: ₱{product.price.toFixed(2)}
                </span>
              )}
              {existingVariations
                .filter((v) => v && typeof v.price === 'number' && v.price > 0)
                .map((v, idx) => (
                  <span
                    key={v.id || idx}
                    className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-mono"
                  >
                    {v.name ? `${v.name}: ` : ''}₱{v.price.toFixed(2)}
                  </span>
                ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Variation Name (Optional)
            </label>
            <input
              type="text"
              value={variationName}
              onChange={(e) => setVariationName(e.target.value)}
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={`e.g., ${product.name} - Small, ${product.name} - Large`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to auto-generate: "{product.name} - ₱X.XX"
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              New Price (₱)
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
            {(() => {
              const numericPrice = parseFloat(price) || 0;
              const priceExists = numericPrice > 0 && (
                existingPrices.includes(numericPrice) || 
                validVariations.some((v: any) => v.price === numericPrice)
              );
              
              if (priceExists) {
                const nameProvided = variationName.trim().length > 0;
                const finalName = nameProvided 
                  ? variationName.trim() 
                  : `${product.name} - ₱${numericPrice.toFixed(2)}`;
                
                // Check if a variation with same name and price already exists
                const duplicateExists = validVariations.some((v: any) => 
                  v.price === numericPrice && v.name === finalName
                );
                
                if (duplicateExists) {
                  return (
                    <p className="text-xs text-destructive mt-1">
                      A variation with this name and price already exists
                    </p>
                  );
                } else if (!nameProvided) {
                  return (
                    <p className="text-xs text-warning mt-1">
                      This price already exists. Please provide a unique variation name.
                    </p>
                  );
                }
              }
              return null;
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Initial Stock (Optional)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCancel();
                }
              }}
              className="w-full px-3 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
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
                
                // Check if price exists
                const priceExists = existingPrices.includes(numericPrice) || 
                  validVariations.some((v: any) => v.price === numericPrice);
                
                if (priceExists) {
                  // If price exists, require a unique name
                  const nameProvided = variationName.trim().length > 0;
                  if (!nameProvided) return true; // Block if no name provided
                  
                  // Check if variation with same name and price exists
                  const finalName = variationName.trim();
                  const duplicateExists = validVariations.some((v: any) => 
                    v.price === numericPrice && v.name === finalName
                  );
                  
                  return duplicateExists; // Block if duplicate name+price exists
                }
                
                return false; // Allow if price doesn't exist
              })()}
            >
              Add Variation
            </Button>
          </div>
          
          {variationName.trim() && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Product will be created as:</p>
              <p className="text-sm font-medium text-foreground">{variationName.trim()}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

