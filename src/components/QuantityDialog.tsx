import { useState, useEffect, useRef } from "react";
import { Product } from "@/types/product";
import { X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantityDialogProps {
  product: Product | null;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}

export function QuantityDialog({ product, onConfirm, onCancel }: QuantityDialogProps) {
  const [quantity, setQuantity] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setQuantity("1");
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [product]);

  if (!product) return null;

  const numericQuantity = parseInt(quantity) || 1;
  const total = product.price * numericQuantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(numericQuantity);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  const adjustQuantity = (delta: number) => {
    const newQty = Math.max(1, numericQuantity + delta);
    setQuantity(newQty.toString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div
        className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add to Order</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-secondary/50 rounded-lg">
          <p className="text-lg font-medium text-foreground">{product.name}</p>
          <p className="text-2xl font-bold font-mono text-primary mt-1">
            ${product.price.toFixed(2)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustQuantity(-1)}
                disabled={numericQuantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <input
                ref={inputRef}
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 text-center text-2xl font-mono font-bold py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustQuantity(1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/30">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-2xl font-bold font-mono text-primary">
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 glow-primary">
              Add to Order
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
