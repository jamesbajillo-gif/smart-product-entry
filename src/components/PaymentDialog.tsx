import { useState, useRef, useEffect } from "react";
import { X, Banknote, Smartphone, Check, Delete } from "lucide-react";
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
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const numericAmount = amountTendered ? parseFloat(amountTendered) || 0 : total;
  const change = numericAmount - total;
  const isValidCashAmount = numericAmount >= total;

  useEffect(() => {
    if (selectedMethod === "cash") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selectedMethod]);

  // Auto-focus input when typing numbers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedMethod === "cash" && /^[0-9.]$/.test(e.key)) {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMethod]);

  const handleConfirm = () => {
    if (selectedMethod === "gcash") {
      onConfirm({ method: "gcash" });
    } else if (isValidCashAmount) {
      onConfirm({
        method: "cash",
        amountTendered: numericAmount,
        change: change,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedMethod === "gcash" || isValidCashAmount) {
        handleConfirm();
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  // Quick amount buttons
  const quickAmounts = [20, 50, 100, 200, 500, 1000].filter((amt) => amt >= total);

  const canConfirm = selectedMethod === "gcash" || isValidCashAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Payment</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Amount */}
        <div className="mb-6 p-4 bg-secondary/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold font-mono text-primary mt-1">
            ₱{total.toFixed(2)}
          </p>
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMethod("cash")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                selectedMethod === "cash"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${selectedMethod === "cash" ? "bg-success/20" : "bg-secondary"}`}>
                <Banknote className={`w-6 h-6 ${selectedMethod === "cash" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold ${selectedMethod === "cash" ? "text-foreground" : "text-muted-foreground"}`}>
                Cash
              </span>
              {selectedMethod === "cash" && (
                <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
              )}
            </button>

            <button
              onClick={() => setSelectedMethod("gcash")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                selectedMethod === "gcash"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${selectedMethod === "gcash" ? "bg-info/20" : "bg-secondary"}`}>
                <Smartphone className={`w-6 h-6 ${selectedMethod === "gcash" ? "text-info" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold ${selectedMethod === "gcash" ? "text-foreground" : "text-muted-foreground"}`}>
                GCash
              </span>
            </button>
          </div>
        </div>

        {/* Cash Payment Details */}
        {selectedMethod === "cash" && (
          <div className="space-y-4 mb-6">
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

            {/* Numpad for touch devices */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  className="h-12 text-xl font-mono"
                  onClick={() => {
                    if (key === "del") {
                      setAmountTendered((prev) => prev.slice(0, -1));
                    } else if (key === "." && amountTendered.includes(".")) {
                      return;
                    } else {
                      setAmountTendered((prev) => prev + key);
                    }
                  }}
                >
                  {key === "del" ? <Delete className="w-5 h-5" /> : key}
                </Button>
              ))}
            </div>

            {/* Quick amount buttons */}
            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant="outline"
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
                isValidCashAmount
                  ? "bg-success/10 border-success/30"
                  : "bg-destructive/10 border-destructive/30"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Change</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    isValidCashAmount ? "text-success" : "text-destructive"
                  }`}
                >
                  {isValidCashAmount ? `₱${change.toFixed(2)}` : "Insufficient"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* GCash Info */}
        {selectedMethod === "gcash" && (
          <div className="mb-6 p-4 bg-info/10 border border-info/30 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Customer will pay <span className="font-semibold text-foreground">₱{total.toFixed(2)}</span> via GCash
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm Payment
          </Button>
        </div>
      </div>
    </div>
  );
}