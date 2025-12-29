import { useState, useRef, useEffect, useMemo } from "react";
import { X, Banknote, Smartphone, Check, Delete, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderItem } from "@/types/product";

export type PaymentMethod = "cash" | "gcash";

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered?: number;
  change?: number;
}

interface PaymentDialogProps {
  subtotal: number;
  total: number;
  onConfirm: (details: PaymentDetails) => void;
  onCancel: () => void;
}

export function PaymentDialog({ subtotal, total, onConfirm, onCancel }: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const numericAmount = amountTendered ? parseFloat(amountTendered) || 0 : total;
  const change = numericAmount - total;
  const isValidCashAmount = numericAmount >= total;

  useEffect(() => {
    if (selectedMethod === "cash") {
      setShowNumpad(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [selectedMethod]);

  // Reset amount tendered when payment method changes
  useEffect(() => {
    if (selectedMethod === "cash") {
      setAmountTendered("");
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
      onConfirm({ 
        method: "gcash",
      });
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
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Navigate payment method with arrow keys
      if (e.key === "ArrowLeft" && selectedMethod === "gcash") {
        setSelectedMethod("cash");
      } else if (e.key === "ArrowRight" && selectedMethod === "cash") {
        setSelectedMethod("gcash");
      }
    }
  };


  const canConfirm = selectedMethod === "gcash" || isValidCashAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl w-full max-w-xl animate-scale-in flex flex-col max-h-[95vh] h-auto" onKeyDown={handleKeyDown}>
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground">Payment</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* Total Amount */}
        <div className="space-y-3">
          {/* Subtotal */}
          <div className="p-3 bg-secondary/50 rounded-lg">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-base font-semibold font-mono text-foreground">
                ₱{subtotal.toFixed(2)}
              </p>
            </div>
            
            {/* Total */}
            <div className="mt-2 pt-2 border-t-2 border-primary/30">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-foreground">Total</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  ₱{total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

          {/* Payment Method Selection */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Payment Method
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMethod("cash")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    if (e.key === "ArrowRight") setSelectedMethod("gcash");
                  }
                }}
                className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 text-sm ${
                  selectedMethod === "cash"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50 text-muted-foreground"
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
                {selectedMethod === "cash" && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </button>
              <button
                onClick={() => setSelectedMethod("gcash")}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    if (e.key === "ArrowLeft") setSelectedMethod("cash");
                  }
                }}
                className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 text-sm ${
                  selectedMethod === "gcash"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/50 hover:bg-secondary/50 text-muted-foreground"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>GCash</span>
                {selectedMethod === "gcash" && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Cash Payment Details */}
          {selectedMethod === "cash" && (
            <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Amount Tendered
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-base">
                  ₱
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  min={total}
                  step="0.01"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidCashAmount) {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  placeholder={total.toFixed(2)}
                  className="w-full pl-8 pr-10 py-2.5 bg-input rounded-lg text-lg font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNumpad(!showNumpad)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                    showNumpad ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Numpad for touch devices - hidden by default */}
            {showNumpad && (
              <div className="grid grid-cols-4 gap-1.5">
                {["1", "2", "3", "del", "4", "5", "6", "C", "7", "8", "9", ".", "0", "00"].map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={key === "C" ? "destructive" : "secondary"}
                    className={`h-10 text-base font-mono ${key === "0" ? "col-span-2" : ""}`}
                    onClick={() => {
                      if (key === "del") {
                        setAmountTendered((prev) => prev.slice(0, -1));
                      } else if (key === "C") {
                        setAmountTendered("");
                      } else if (key === "." && amountTendered.includes(".")) {
                        return;
                      } else if (key === "00") {
                        setAmountTendered((prev) => prev + "00");
                      } else {
                        setAmountTendered((prev) => prev + key);
                      }
                    }}
                  >
                    {key === "del" ? <Delete className="w-4 h-4" /> : key}
                  </Button>
                ))}
              </div>
            )}

            <div
              className={`p-3 rounded-lg border ${
                isValidCashAmount
                  ? "bg-success/10 border-success/30"
                  : "bg-destructive/10 border-destructive/30"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Change</span>
                <span
                  className={`text-lg font-bold font-mono ${
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
            <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
              <p className="text-xs text-muted-foreground text-center">
                Customer will pay <span className="font-semibold text-foreground">₱{total.toFixed(2)}</span> via GCash
              </p>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 flex-shrink-0 border-t border-border/50">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              size="sm"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}