import { useState, useRef, useEffect } from "react";
import { X, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddGCashFundsDialogProps {
  currentCreditsBalance: number;
  currentCashBalance: number;
  onConfirm: (amount: number, fundType: "credits" | "cash", notes?: string) => void;
  onCancel: () => void;
}

export function AddGCashFundsDialog({ currentCreditsBalance, currentCashBalance, onConfirm, onCancel }: AddGCashFundsDialogProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [fundType, setFundType] = useState<"credits" | "cash">("credits");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => amountRef.current?.focus());
  }, []);

  // Auto-focus amount input when typing numbers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) {
        if (document.activeElement !== amountRef.current) {
          amountRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(numericAmount, fundType, notes.trim() || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Add Funds to GCash</h2>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Credits: ₱{currentCreditsBalance.toFixed(2)}</p>
                <p>Cash: ₱{currentCashBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Fund Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Add to
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFundType("credits")}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                fundType === "credits"
                  ? "bg-primary/20 border-primary text-primary font-medium"
                  : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <div className="text-sm font-medium">GCash Credits</div>
              <div className="text-xs text-muted-foreground mt-0.5">Wallet balance</div>
            </button>
            <button
              onClick={() => setFundType("cash")}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${
                fundType === "cash"
                  ? "bg-warning/20 border-warning text-warning font-medium"
                  : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <div className="text-sm font-medium">GCash Cash</div>
              <div className="text-xs text-muted-foreground mt-0.5">Transaction cash</div>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Amount to Add (₱)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
              ₱
            </span>
            <Input
              ref={amountRef}
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
              className="pl-8 pr-3 py-3 text-lg font-mono"
            />
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Quick Amounts
          </label>
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className="px-3 py-2 bg-secondary/50 hover:bg-secondary rounded-lg text-sm font-medium text-foreground transition-colors"
              >
                ₱{amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Notes (Optional)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes..."
            className="py-3"
          />
        </div>

        {/* New Balance Preview */}
        {isValid && (
          <div className="mb-6 space-y-2">
            <div className={`p-3 rounded-lg border ${
              fundType === "credits" 
                ? "bg-primary/10 border-primary/20" 
                : "bg-warning/10 border-warning/20"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  New {fundType === "credits" ? "Credits" : "Cash"} Balance:
                </span>
                <span className={`text-lg font-bold font-mono ${
                  fundType === "credits" ? "text-primary" : "text-warning"
                }`}>
                  ₱{(
                    fundType === "credits" 
                      ? currentCreditsBalance + numericAmount 
                      : currentCashBalance + numericAmount
                  ).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="p-2 bg-secondary/30 rounded text-xs text-muted-foreground">
              {fundType === "credits" 
                ? "Credits: ₱" + (currentCreditsBalance + numericAmount).toFixed(2) + " | Cash: ₱" + currentCashBalance.toFixed(2)
                : "Credits: ₱" + currentCreditsBalance.toFixed(2) + " | Cash: ₱" + (currentCashBalance + numericAmount).toFixed(2)
              }
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 glow-primary"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            Add Funds
          </Button>
        </div>
      </div>
    </div>
  );
}

