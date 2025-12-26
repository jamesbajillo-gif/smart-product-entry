import { useState, useEffect, useRef } from "react";
import { X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT_CATEGORIES, ProductCategory } from "@/types/product";

interface AddProductDialogProps {
  productName: string;
  onConfirm: (name: string, price: number, category?: ProductCategory) => void;
  onCancel: () => void;
}

export function AddProductDialog({ productName, onConfirm, onCancel }: AddProductDialogProps) {
  const [name, setName] = useState(productName);
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Other");
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(productName);
    setPrice("");
    setCategory("Other");
    setTimeout(() => priceInputRef.current?.focus(), 50);
  }, [productName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseFloat(price);
    if (name.trim() && numericPrice > 0) {
      onConfirm(name.trim(), numericPrice, category);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div
        className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <Package className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">New Product</h2>
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
              Product Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              SRP (Selling Price)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
                ₱
              </span>
              <input
                ref={priceInputRef}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={price}
                onChange={(e) => {
                  const val = e.target.value;
                  // Only allow numbers and one decimal point
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setPrice(val);
                  }
                }}
                className="w-full pl-8 pr-4 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.00"
              />
            </div>
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
              disabled={!name.trim() || !price || parseFloat(price) <= 0}
            >
              Add Product
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}