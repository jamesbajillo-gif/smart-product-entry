import { useState, useRef, useEffect } from "react";
import { X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";

interface CandiesPromoDialogProps {
  product: Product;
  onConfirm: (quantity: number, price: number) => void;
  onCancel: () => void;
}

export function CandiesPromoDialog({ product, onConfirm, onCancel }: CandiesPromoDialogProps) {
  const [selectedOption, setSelectedOption] = useState<"bulk" | "individual">("bulk");
  const [quantity, setQuantity] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => dialogRef.current?.focus());
  }, []);

  const handleSubmit = () => {
    if (selectedOption === "bulk") {
      // 3 pieces for ₱5
      const totalQuantity = quantity * 3;
      const totalPrice = quantity * 5;
      onConfirm(totalQuantity, totalPrice);
    } else {
      // 1 piece for ₱2
      const totalPrice = quantity * 2;
      onConfirm(quantity, totalPrice);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const totalPrice = selectedOption === "bulk" 
    ? quantity * 5  // ₱5 per set of 3 pieces
    : quantity * 2; // ₱2 per piece

  const totalQuantity = selectedOption === "bulk"
    ? quantity * 3  // 3 pieces per set
    : quantity;    // 1 piece per unit

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div
        ref={dialogRef}
        className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <Package className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{product.name}</h2>
              <p className="text-sm text-muted-foreground">Candies Promo - Special Pricing</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Pricing Options */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-3">
              Select Pricing Option
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedOption("bulk")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedOption === "bulk"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
                }`}
              >
                <div className="text-center">
                  <p className={`text-lg font-bold ${selectedOption === "bulk" ? "text-primary" : "text-foreground"}`}>
                    3 pcs
                  </p>
                  <p className={`text-sm ${selectedOption === "bulk" ? "text-primary" : "text-muted-foreground"}`}>
                    ₱5.00
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Bulk Deal</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOption("individual")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedOption === "individual"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50"
                }`}
              >
                <div className="text-center">
                  <p className={`text-lg font-bold ${selectedOption === "individual" ? "text-primary" : "text-foreground"}`}>
                    1 pc
                  </p>
                  <p className={`text-sm ${selectedOption === "individual" ? "text-primary" : "text-muted-foreground"}`}>
                    ₱2.00
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Individual</p>
                </div>
              </button>
            </div>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              {selectedOption === "bulk" ? "Number of Sets (3 pcs each)" : "Quantity"}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 text-lg font-bold"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Quantity</span>
              <span className="text-lg font-bold text-foreground">{totalQuantity} {totalQuantity === 1 ? "piece" : "pieces"}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-primary/20">
              <span className="text-sm font-medium text-foreground">Total Price</span>
              <span className="text-2xl font-bold text-primary font-mono">₱{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit}>
              <Package className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

