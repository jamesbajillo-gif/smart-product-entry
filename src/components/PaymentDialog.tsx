import { useState, useRef, useEffect, useMemo } from "react";
import { X, Banknote, Smartphone, Check, Delete, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type PaymentMethod = "cash" | "gcash";

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered?: number;
  change?: number;
  bottleDeposit?: number;
  bottleDepositBreakdown?: Array<{ productName: string; quantity: number; deposit: number; total: number }>;
}

interface PaymentDialogProps {
  subtotal: number;
  bottleDeposit: number;
  bottleDepositBreakdown: Array<{ productName: string; quantity: number; deposit: number; total: number }>;
  total: number;
  onConfirm: (details: PaymentDetails) => void;
  onCancel: () => void;
}

export function PaymentDialog({ subtotal, bottleDeposit, bottleDepositBreakdown, total, onConfirm, onCancel }: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);
  const [includeBottleDeposit, setIncludeBottleDeposit] = useState(bottleDeposit > 0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate adjusted total based on bottle deposit checkbox
  const adjustedTotal = useMemo(() => {
    return includeBottleDeposit ? total : subtotal;
  }, [includeBottleDeposit, total, subtotal]);

  const numericAmount = amountTendered ? parseFloat(amountTendered) || 0 : adjustedTotal;
  const change = numericAmount - adjustedTotal;
  const isValidCashAmount = numericAmount >= adjustedTotal;

  useEffect(() => {
    if (selectedMethod === "cash") {
      setShowNumpad(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [selectedMethod]);

  // Reset amount tendered when bottle deposit is toggled
  useEffect(() => {
    if (selectedMethod === "cash") {
      setAmountTendered("");
    }
  }, [includeBottleDeposit, selectedMethod]);

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
        bottleDeposit: includeBottleDeposit && bottleDeposit > 0 ? bottleDeposit : undefined,
        bottleDepositBreakdown: includeBottleDeposit && bottleDeposit > 0 ? bottleDepositBreakdown : undefined,
      });
    } else if (isValidCashAmount) {
      onConfirm({
        method: "cash",
        amountTendered: numericAmount,
        change: change,
        bottleDeposit: includeBottleDeposit && bottleDeposit > 0 ? bottleDeposit : undefined,
        bottleDepositBreakdown: includeBottleDeposit && bottleDeposit > 0 ? bottleDepositBreakdown : undefined,
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
  const quickAmounts = [20, 50, 100, 200, 500, 1000].filter((amt) => amt >= adjustedTotal);

  const canConfirm = selectedMethod === "gcash" || isValidCashAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-xl mx-4 animate-scale-in" onKeyDown={handleKeyDown}>
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
        <div className="mb-6 space-y-3">
          {/* Subtotal */}
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-lg font-semibold font-mono text-foreground">
                ₱{subtotal.toFixed(2)}
              </p>
            </div>
            
            {/* Bottle Deposit Breakdown */}
            {bottleDeposit > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-bottle-deposit"
                      checked={includeBottleDeposit}
                      onCheckedChange={(checked) => setIncludeBottleDeposit(checked === true)}
                    />
                    <label
                      htmlFor="include-bottle-deposit"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Include Bottle Deposit
                    </label>
                  </div>
                  <p className={`text-lg font-semibold font-mono ${includeBottleDeposit ? 'text-info' : 'text-muted-foreground line-through'}`}>
                    ₱{bottleDeposit.toFixed(2)}
                  </p>
                </div>
                {includeBottleDeposit && bottleDepositBreakdown.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {bottleDepositBreakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{item.productName} × {item.quantity}</span>
                        <span className="font-mono">₱{item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Total */}
            <div className="mt-3 pt-3 border-t-2 border-primary/30">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-foreground">Total Amount</p>
                <p className="text-3xl font-bold font-mono text-primary">
                  ₱{adjustedTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
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
                  min={adjustedTotal}
                  step="0.01"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidCashAmount) {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  placeholder={adjustedTotal.toFixed(2)}
                  className="w-full pl-10 pr-12 py-4 bg-input rounded-lg text-2xl font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNumpad(!showNumpad)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                    showNumpad ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <Calculator className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Numpad for touch devices - hidden by default */}
            {showNumpad && (
              <div className="grid grid-cols-4 gap-2">
                {["1", "2", "3", "del", "4", "5", "6", "C", "7", "8", "9", ".", "0", "00"].map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={key === "C" ? "destructive" : "secondary"}
                    className={`h-12 text-xl font-mono ${key === "0" ? "col-span-2" : ""}`}
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
                    {key === "del" ? <Delete className="w-5 h-5" /> : key}
                  </Button>
                ))}
              </div>
            )}

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
              Customer will pay <span className="font-semibold text-foreground">₱{adjustedTotal.toFixed(2)}</span> via GCash
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