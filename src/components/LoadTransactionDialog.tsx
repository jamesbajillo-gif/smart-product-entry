import { useState, useRef, useEffect } from "react";
import { X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateLoadTransactionFee } from "@/utils/loadService";

export interface LoadTransactionDetails {
  loadAmount: number;
  transactionFee: number;
  gcashFee: number;
  totalDeduction: number; // Amount deducted from GCash Credits (load amount + GCash fee)
  totalCustomerPays: number; // Total customer pays in cash (load amount + transaction fee)
  mobileNumber?: string;
  notes?: string;
}

interface LoadTransactionDialogProps {
  currentCreditsBalance: number;
  onConfirm: (details: LoadTransactionDetails) => void;
  onCancel: () => void;
}

export function LoadTransactionDialog({ currentCreditsBalance, onConfirm, onCancel }: LoadTransactionDialogProps) {
  const [loadAmount, setLoadAmount] = useState("");
  const [gcashFee, setGcashFee] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [notes, setNotes] = useState("");
  const loadAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => loadAmountRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (/^[0-9.]$/.test(e.key) && !isInputFocused) {
        if (document.activeElement !== loadAmountRef.current) {
          loadAmountRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const numericLoadAmount = parseFloat(loadAmount) || 0;
  const transactionFee = numericLoadAmount > 0 ? calculateLoadTransactionFee(numericLoadAmount) : 0;
  const numericGcashFee = parseFloat(gcashFee) || 0;
  // Transaction fee is paid by customer in cash, not deducted from credits
  // Load amount + GCash fee are deducted from GCash Credits
  const totalDeductionFromCredits = numericLoadAmount + numericGcashFee;
  // Total customer pays = load amount + GCash fee + transaction fee (all in cash)
  const totalCustomerPays = numericLoadAmount + numericGcashFee + transactionFee;
  const isValid = numericLoadAmount > 0;
  
  const newBalanceAfterTransaction = currentCreditsBalance - totalDeductionFromCredits;
  const willBeNegative = newBalanceAfterTransaction < 0;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm({
        loadAmount: numericLoadAmount,
        transactionFee: transactionFee,
        gcashFee: numericGcashFee,
        totalDeduction: totalDeductionFromCredits, // Only load amount + GCash fee
        totalCustomerPays: totalCustomerPays, // Load amount + transaction fee (cash)
        mobileNumber: mobileNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="window-border bg-card p-4 w-full h-full max-w-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6" />
            <h2 className="text-xl font-bold">Load Transaction</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Load Amount</label>
          <Input
            ref={loadAmountRef}
            type="number"
            step="0.01"
            min="0"
            value={loadAmount}
            onChange={(e) => setLoadAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter load amount"
            className="w-full text-lg"
          />
        </div>

        {numericLoadAmount > 0 && (
          <div className="mb-4 p-4 bg-muted border border-border text-base space-y-2">
            <div className="flex justify-between">
              <span>Load Amount:</span>
              <span className="font-mono">₱{numericLoadAmount.toFixed(2)}</span>
            </div>
            {transactionFee > 0 && (
              <div className="flex justify-between">
                <span>Transaction Fee (Cash):</span>
                <span className="font-mono text-warning">₱{transactionFee.toFixed(2)}</span>
              </div>
            )}
            {numericGcashFee > 0 && (
              <div className="flex justify-between">
                <span>GCash Fee (Cash):</span>
                <span className="font-mono text-warning">₱{numericGcashFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-border mt-2 pt-2">
              <span>Total Customer Pays (Cash):</span>
              <span className="font-mono text-warning">₱{totalCustomerPays.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-border mt-2 pt-2">
              <span>Deduction from GCash Credits:</span>
              <span className="font-mono text-primary">₱{totalDeductionFromCredits.toFixed(2)}</span>
            </div>
            {willBeNegative && (
              <div className="text-sm text-destructive mt-2">
                ⚠️ GCash Credits will be negative: ₱{newBalanceAfterTransaction.toFixed(2)}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">GCash Fee (Manual)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={gcashFee}
            onChange={(e) => setGcashFee(e.target.value)}
            placeholder="Enter GCash fee (optional)"
            className="w-full text-lg"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Additional fee paid by customer in cash (optional)
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Mobile Number</label>
          <Input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="Enter mobile number"
            className="w-full text-lg"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Notes</label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Transaction notes (optional)"
            className="w-full text-lg"
          />
        </div>

        <div className="mb-4 p-4 bg-secondary border border-border">
          <div className="text-sm text-muted-foreground mb-1">Current GCash Credits:</div>
          <div className={`text-lg font-bold font-mono ${currentCreditsBalance < 0 ? 'text-destructive' : 'text-primary'}`}>
            ₱{currentCreditsBalance.toFixed(2)}
          </div>
        </div>

        <div className="flex gap-3 mt-auto">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isValid}
          >
            Process Load
          </Button>
        </div>
      </div>
    </div>
  );
}

