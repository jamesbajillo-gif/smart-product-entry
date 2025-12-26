import { useState, useRef, useEffect } from "react";
import { X, Banknote, Smartphone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PaymentMethod = "cash" | "gcash";

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered?: number;
  change?: number;
}

interface PaymentDialogProps {
  total: number;
  onConfirm: (details: PaymentDetails) => void;
  onCancel: () => void;
}

export function PaymentDialog({ total, onConfirm, onCancel }: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const numericAmount = parseFloat(amountTendered) || 0;
  const change = numericAmount - total;
  const isValidAmount = numericAmount >= total;

  useEffect(() => {
    if (selectedMethod === "cash") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selectedMethod]);

  const handleCashConfirm = () => {
    if (isValidAmount) {
      onConfirm({
        method: "cash",
        amountTendered: numericAmount,
        change: change,
      });
    }
  };

  const handleGcashConfirm = () => {
    onConfirm({ method: "gcash" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValidAmount) {
      handleCashConfirm();
    } else if (e.key === "Escape") {
      if (selectedMethod) {
        setSelectedMethod(null);
        setAmountTendered("");
      } else {
        onCancel();
      }
    }
  };

  // Quick amount buttons
  const quickAmounts = [20, 50, 100, 200, 500, 1000].filter((amt) => amt >= total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          {selectedMethod === "cash" ? (
            <button
              onClick={() => {
                setSelectedMethod(null);
                setAmountTendered("");
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold text-foreground">Cash Payment</span>
            </button>
          ) : (
            <h2 className="text-xl font-semibold text-foreground">Select Payment</h2>
          )}
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-secondary/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold font-mono text-primary mt-1">
            ₱{total.toFixed(2)}
          </p>
        </div>

        {!selectedMethod ? (
          <>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg hover:border-primary hover:bg-primary/5"
                onClick={() => setSelectedMethod("cash")}
              >
                <div className="p-2 bg-success/20 rounded-lg">
                  <Banknote className="w-6 h-6 text-success" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">Cash</p>
                  <p className="text-sm text-muted-foreground">Pay with cash</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-16 justify-start gap-4 text-lg hover:border-primary hover:bg-primary/5"
                onClick={handleGcashConfirm}
              >
                <div className="p-2 bg-info/20 rounded-lg">
                  <Smartphone className="w-6 h-6 text-info" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground">GCash</p>
                  <p className="text-sm text-muted-foreground">Pay via GCash</p>
                </div>
              </Button>
            </div>

            <Button variant="ghost" className="w-full mt-4" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Amount Tendered
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-lg">
                  ₱
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  min={total}
                  step="0.01"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full pl-10 pr-4 py-4 bg-input rounded-lg text-2xl font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAmountTendered(amt.toString())}
                    className="font-mono"
                  >
                    ₱{amt}
                  </Button>
                ))}
              </div>
            )}

            <div
              className={`p-4 rounded-lg border ${
                isValidAmount
                  ? "bg-success/10 border-success/30"
                  : "bg-destructive/10 border-destructive/30"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Change</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    isValidAmount ? "text-success" : "text-destructive"
                  }`}
                >
                  {isValidAmount ? `₱${change.toFixed(2)}` : "Insufficient"}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedMethod(null);
                  setAmountTendered("");
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!isValidAmount}
                onClick={handleCashConfirm}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
