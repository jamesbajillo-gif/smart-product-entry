import { useState, useRef, useEffect } from "react";
import { X, ArrowDownCircle, ArrowUpCircle, Smartphone, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GCashTransactionType = "gcash-in" | "gcash-out";

export interface GCashTransactionDetails {
  type: GCashTransactionType;
  amount: number;
  serviceCharge: number;
  totalAmount: number;
  gcashNumber?: string; // For GCASH-IN: customer's GCash number
  notes?: string;
}

interface GCashTransactionDialogProps {
  currentBalance: number;
  onConfirm: (details: GCashTransactionDetails) => void;
  onCancel: () => void;
}

export function GCashTransactionDialog({ currentBalance, onConfirm, onCancel }: GCashTransactionDialogProps) {
  const [transactionType, setTransactionType] = useState<GCashTransactionType>("gcash-in");
  const [amount, setAmount] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [notes, setNotes] = useState("");
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
  
  // Calculate service charge based on amount
  const calculateServiceCharge = (amt: number): number => {
    if (amt >= 10 && amt <= 99) return 5;
    if (amt >= 100 && amt <= 500) return 10;
    if (amt >= 501 && amt <= 1000) return 15;
    return 0; // No service charge for amounts outside these ranges
  };
  
  const serviceCharge = numericAmount > 0 ? calculateServiceCharge(numericAmount) : 0;
  const totalAmount = numericAmount + serviceCharge;
  const isValid = numericAmount > 0;
  const hasSufficientFunds = transactionType === "gcash-out" || currentBalance >= numericAmount;
  const isValidTransaction = isValid && hasSufficientFunds;

  const handleConfirm = () => {
    if (isValidTransaction) {
      onConfirm({
        type: transactionType,
        amount: numericAmount,
        serviceCharge: serviceCharge,
        totalAmount: totalAmount,
        gcashNumber: gcashNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValidTransaction) {
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="glass-panel rounded-xl p-6 max-w-md w-full animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">GCash Transaction</h2>
              <p className="text-sm text-muted-foreground">Balance: ₱{currentBalance.toFixed(2)}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Transaction Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-3">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTransactionType("gcash-in")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 relative ${
                transactionType === "gcash-in"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "gcash-in" ? "bg-success/20" : "bg-secondary"}`}>
                <ArrowDownCircle className={`w-6 h-6 ${transactionType === "gcash-in" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold text-sm ${transactionType === "gcash-in" ? "text-foreground" : "text-muted-foreground"}`}>
                GCASH-IN
              </span>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Customer pays cash<br />We send GCash
              </p>
            </button>

            <button
              onClick={() => setTransactionType("gcash-out")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 relative ${
                transactionType === "gcash-out"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "gcash-out" ? "bg-info/20" : "bg-secondary"}`}>
                <ArrowUpCircle className={`w-6 h-6 ${transactionType === "gcash-out" ? "text-info" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold text-sm ${transactionType === "gcash-out" ? "text-foreground" : "text-muted-foreground"}`}>
                GCASH-OUT
              </span>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Customer sends GCash<br />We give cash
              </p>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Amount (₱)
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
              className={`pl-8 pr-3 py-3 text-lg font-mono ${!hasSufficientFunds && numericAmount > 0 ? 'border-destructive' : ''}`}
            />
          </div>
          {transactionType === "gcash-in" && numericAmount > 0 && !hasSufficientFunds && (
            <p className="text-xs text-destructive mt-1">
              Insufficient funds. Current balance: ₱{currentBalance.toFixed(2)}
            </p>
          )}
          {transactionType === "gcash-in" && numericAmount > 0 && hasSufficientFunds && (
            <p className="text-xs text-muted-foreground mt-1">
              New balance after transaction: ₱{(currentBalance - numericAmount).toFixed(2)}
            </p>
          )}
          {transactionType === "gcash-out" && numericAmount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              New balance after transaction: ₱{(currentBalance + numericAmount).toFixed(2)}
            </p>
          )}
        </div>

        {/* Service Charge Display */}
        {numericAmount > 0 && serviceCharge > 0 && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Transaction Amount:</span>
              <span className="text-sm font-mono text-foreground">₱{numericAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Service Charge:</span>
              <span className="text-sm font-mono text-primary">₱{serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-sm font-medium text-foreground">Total to Pay:</span>
              <span className="text-lg font-bold font-mono text-primary">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* GCash Number (for GCASH-IN) */}
        {transactionType === "gcash-in" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              GCash Number (Optional)
            </label>
            <Input
              type="tel"
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
              className="py-3"
            />
          </div>
        )}

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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1 glow-primary"
            onClick={handleConfirm}
            disabled={!isValidTransaction}
          >
            {transactionType === "gcash-in" ? "Process GCASH-IN" : "Process GCASH-OUT"}
          </Button>
        </div>
      </div>
    </div>
  );
}

