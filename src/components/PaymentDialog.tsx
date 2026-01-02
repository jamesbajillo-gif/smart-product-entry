import { useState, useRef, useEffect, useMemo } from "react";
import { X, Banknote, Smartphone, Check, Delete, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { OrderItem } from "@/types/product";

export type PaymentMethod = "cash" | "gcash";

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered?: number;
  change?: number;
  isUnpaid?: boolean;
  unpaidNotes?: string;
  totalFees?: number;
  bottleDeposit?: number;
  bottleDepositBreakdown?: Array<{
    productName: string;
    deposit: number;
    total: number;
  }>;
}

interface PaymentDialogProps {
  subtotal: number;
  total: number;
  onConfirm: (details: PaymentDetails) => void;
  onCancel: () => void;
  gcashEnabled?: boolean;
}

export function PaymentDialog({ subtotal, total, onConfirm, onCancel, gcashEnabled = true }: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);
  const [isUnpaid, setIsUnpaid] = useState(false);
  const [unpaidNotes, setUnpaidNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const unpaidNotesRef = useRef<HTMLInputElement>(null);

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
    // Validate unpaid notes if marked as unpaid
    if (isUnpaid && !unpaidNotes.trim()) {
      unpaidNotesRef.current?.focus();
      return;
    }

    const details: PaymentDetails = {
      method: selectedMethod === "gcash" ? "gcash" : "cash",
      isUnpaid: isUnpaid || undefined,
      unpaidNotes: isUnpaid ? unpaidNotes.trim() : undefined,
    };

    if (selectedMethod === "gcash") {
      onConfirm(details);
    } else if (isValidCashAmount || isUnpaid) {
      // Allow unpaid transactions even if amount is insufficient
      if (!isUnpaid) {
        details.amountTendered = numericAmount;
        details.change = change;
      }
      onConfirm(details);
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
      // Navigate payment method with arrow keys (only if GCash is enabled)
      if (gcashEnabled) {
        if (e.key === "ArrowLeft" && selectedMethod === "gcash") {
          setSelectedMethod("cash");
        } else if (e.key === "ArrowRight" && selectedMethod === "cash") {
          setSelectedMethod("gcash");
        }
      }
    }
  };


  const canConfirm = selectedMethod === "gcash" || isValidCashAmount || isUnpaid;
  const isUnpaidValid = !isUnpaid || (isUnpaid && unpaidNotes.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#808080]">
      <div className="window-border bg-[#c0c0c0] w-full h-full max-w-xl flex flex-col overflow-y-auto" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between p-4 border-b border-black">
          <h2 className="text-xl font-bold">Payment</h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

        <div className="p-4 bg-muted border border-border">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold">Total:</span>
            <span className="text-2xl font-bold font-mono">₱{total.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <div className={`grid gap-3 ${gcashEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              onClick={() => setSelectedMethod("cash")}
              className={`p-4 border border-border flex items-center gap-3 text-lg min-h-[64px] ${selectedMethod === "cash" ? "bg-warning/20 border-warning/50" : "bg-secondary"}`}
            >
              <Banknote className="w-8 h-8" />
              <span className="font-semibold">Cash</span>
            </button>
            {gcashEnabled && (
              <button
                onClick={() => setSelectedMethod("gcash")}
                className={`p-4 border border-border flex items-center gap-3 text-lg min-h-[64px] ${selectedMethod === "gcash" ? "bg-warning/20 border-warning/50" : "bg-secondary"}`}
              >
                <Smartphone className="w-8 h-8" />
                <span className="font-semibold">GCash</span>
              </button>
            )}
          </div>
        </div>

        {selectedMethod === "cash" && (
          <div className="space-y-3">
            {!isUnpaid && (
              <>
                <Input
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
                  className="w-full text-xl"
                />
                <div className={`p-4 border border-border text-lg ${isValidCashAmount ? "bg-success/20 border-success/50" : "bg-destructive/20 border-destructive/50"}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Change:</span>
                    <span className="font-mono font-bold text-xl">{isValidCashAmount ? `₱${change.toFixed(2)}` : "Insufficient"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-4 bg-warning/10 border border-warning/30">
          <div className="flex items-center gap-3 mb-3">
            <Checkbox
              id="mark-unpaid"
              checked={isUnpaid}
              onCheckedChange={(checked) => {
                setIsUnpaid(checked === true);
                if (checked) {
                  setTimeout(() => unpaidNotesRef.current?.focus(), 100);
                } else {
                  setUnpaidNotes("");
                }
              }}
            />
            <label htmlFor="mark-unpaid" className="text-base font-semibold cursor-pointer">
              Mark as Unpaid
            </label>
          </div>
          {isUnpaid && (
            <div className="mt-3">
              <Input
                ref={unpaidNotesRef}
                type="text"
                value={unpaidNotes}
                onChange={(e) => setUnpaidNotes(e.target.value)}
                placeholder="Enter notes (required)"
                className="w-full text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isUnpaidValid && canConfirm) {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              {!isUnpaidValid && (
                <p className="text-sm text-destructive mt-1">Notes are required for unpaid transactions</p>
              )}
            </div>
          )}
        </div>
        </div>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!canConfirm || !isUnpaidValid}
              onClick={handleConfirm}
            >
              {isUnpaid ? "Confirm (Unpaid)" : "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}