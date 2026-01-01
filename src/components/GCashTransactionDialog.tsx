import { useState, useRef, useEffect } from "react";
import { X, ArrowDownCircle, ArrowUpCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export type GCashTransactionType = "gcash-in" | "gcash-out";

export interface GCashTransactionDetails {
  type: GCashTransactionType;
  amount: number;
  serviceCharge: number;
  totalAmount: number;
  deductServiceFeeFromGCash: boolean;
  gcashNumber?: string;
  notes?: string;
}

interface GCashTransactionDialogProps {
  currentBalance: number;
  onConfirm: (details: GCashTransactionDetails) => void;
  onCancel: () => void;
  initialTransactionType?: GCashTransactionType;
}

export function GCashTransactionDialog({ currentBalance, onConfirm, onCancel, initialTransactionType }: GCashTransactionDialogProps) {
  const [transactionType, setTransactionType] = useState<GCashTransactionType>(initialTransactionType || "gcash-in");
  const [amount, setAmount] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [deductServiceFeeFromGCash, setDeductServiceFeeFromGCash] = useState(false);
  const [overrideServiceCharge, setOverrideServiceCharge] = useState(false);
  const [overrideServiceChargeAmount, setOverrideServiceChargeAmount] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  // Update transaction type when initialTransactionType prop changes
  useEffect(() => {
    if (initialTransactionType) {
      setTransactionType(initialTransactionType);
    }
  }, [initialTransactionType]);

  useEffect(() => {
    requestAnimationFrame(() => amountRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (/^[0-9.]$/.test(e.key) && !isInputFocused) {
        if (document.activeElement !== amountRef.current) {
          amountRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const numericAmount = parseFloat(amount) || 0;
  
  const calculateServiceCharge = (amt: number): number => {
    if (amt >= 10 && amt <= 99) return 5;
    if (amt >= 100 && amt <= 500) return 10;
    if (amt >= 501 && amt <= 1000) return 15;
    return 0;
  };
  
  const calculatedServiceCharge = numericAmount > 0 ? calculateServiceCharge(numericAmount) : 0;
  const overrideServiceChargeNumeric = overrideServiceChargeAmount.trim() !== "" 
    ? (isNaN(parseFloat(overrideServiceChargeAmount)) ? null : parseFloat(overrideServiceChargeAmount))
    : null;
  const serviceCharge = overrideServiceCharge && overrideServiceChargeNumeric !== null
    ? overrideServiceChargeNumeric
    : calculatedServiceCharge;
  const totalAmount = transactionType === "gcash-out" 
    ? (deductServiceFeeFromGCash ? numericAmount + serviceCharge : numericAmount)
    : (deductServiceFeeFromGCash ? numericAmount : numericAmount + serviceCharge);
  const isValid = numericAmount > 0;
  const isValidTransaction = isValid;
  
  let newBalanceAfterTransaction: number;
  if (transactionType === "gcash-in") {
    // GCash-In: Deduct amount sent to customer, and service charge if toggle is ON
    newBalanceAfterTransaction = currentBalance - numericAmount - (deductServiceFeeFromGCash ? serviceCharge : 0);
  } else {
    // GCash-Out: Add amount received from customer, deduct service charge if toggle is ON
    if (deductServiceFeeFromGCash) {
      newBalanceAfterTransaction = currentBalance + numericAmount - serviceCharge;
    } else {
      newBalanceAfterTransaction = currentBalance + numericAmount;
    }
  }
  const willBeNegative = newBalanceAfterTransaction < 0;

  const handleConfirm = () => {
    if (isValidTransaction) {
      onConfirm({
        type: transactionType,
        amount: numericAmount,
        serviceCharge: serviceCharge,
        totalAmount: totalAmount,
        deductServiceFeeFromGCash: deductServiceFeeFromGCash,
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="window-border bg-card p-4 w-full h-full max-w-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">GCash Transaction</h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setTransactionType("gcash-in")}
            className={`p-4 border border-border flex items-center gap-3 min-h-[64px] ${transactionType === "gcash-in" ? "bg-warning/20 border-warning/50" : "bg-secondary"}`}
          >
            <ArrowDownCircle className="w-8 h-8" />
            <span className="text-lg font-semibold">GCASH-IN</span>
          </button>
          <button
            onClick={() => setTransactionType("gcash-out")}
            className={`p-4 border border-border flex items-center gap-3 min-h-[64px] ${transactionType === "gcash-out" ? "bg-warning/20 border-warning/50" : "bg-secondary"}`}
          >
            <ArrowUpCircle className="w-8 h-8" />
            <span className="text-lg font-semibold">GCASH-OUT</span>
          </button>
        </div>

        <div className="mb-4">
          <Input
            ref={amountRef}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Amount"
            className="w-full text-lg"
          />
        </div>

        {numericAmount > 0 && (
          <div className="mb-4 p-4 bg-muted border border-border text-base">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-mono">₱{numericAmount.toFixed(2)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between">
                <span>Fee:</span>
                <span className="font-mono">₱{serviceCharge.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-border mt-0.5 pt-0.5">
              <span>Total:</span>
              <span className="font-mono">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {numericAmount > 0 && transactionType === "gcash-out" && (
          <div className="mb-4 p-4 bg-muted border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                id="override-service-charge"
                checked={overrideServiceCharge}
                onCheckedChange={(checked) => {
                  setOverrideServiceCharge(checked === true);
                  if (!checked) setOverrideServiceChargeAmount("");
                }}
              />
              <label htmlFor="override-service-charge" className="text-base cursor-pointer">Override Fee</label>
            </div>
            {overrideServiceCharge && (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={overrideServiceChargeAmount}
                onChange={(e) => setOverrideServiceChargeAmount(e.target.value)}
                placeholder={calculatedServiceCharge.toFixed(2)}
                className="text-lg"
              />
            )}
          </div>
        )}

        {numericAmount > 0 && serviceCharge > 0 && (
          <div className="mb-4 p-4 bg-warning/10 border border-warning/30">
            <div className="flex items-center gap-3">
              <Checkbox
                id="deduct-service-fee"
                checked={deductServiceFeeFromGCash}
                onCheckedChange={(checked) => setDeductServiceFeeFromGCash(checked === true)}
              />
              <label htmlFor="deduct-service-fee" className="text-base cursor-pointer">Deduct from GCash</label>
            </div>
          </div>
        )}

        {transactionType === "gcash-in" && (
          <div className="mb-4">
            <Input
              type="tel"
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
              placeholder="GCash Number"
              className="w-full text-lg"
            />
          </div>
        )}

        <div className="mb-4">
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="w-full text-lg"
          />
        </div>

        <div className="flex gap-3 mt-auto">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
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
