import { useState, useRef, useEffect } from "react";
import { X, ArrowDownCircle, ArrowUpCircle, Smartphone, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export type GCashTransactionType = "gcash-in" | "gcash-out";

export interface GCashTransactionDetails {
  type: GCashTransactionType;
  amount: number;
  serviceCharge: number;
  totalAmount: number;
  deductServiceFeeFromGCash: boolean; // New option to deduct service fee from GCash balance
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
  const [deductServiceFeeFromGCash, setDeductServiceFeeFromGCash] = useState(false);
  const [overrideServiceCharge, setOverrideServiceCharge] = useState(false);
  const [overrideServiceChargeAmount, setOverrideServiceChargeAmount] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => amountRef.current?.focus());
  }, []);

  // Auto-focus amount input when typing numbers (only if no input is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only auto-focus if no input field is currently focused
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
  
  // Calculate service charge based on amount
  const calculateServiceCharge = (amt: number): number => {
    if (amt >= 10 && amt <= 99) return 5;
    if (amt >= 100 && amt <= 500) return 10;
    if (amt >= 501 && amt <= 1000) return 15;
    return 0; // No service charge for amounts outside these ranges
  };
  
  const calculatedServiceCharge = numericAmount > 0 ? calculateServiceCharge(numericAmount) : 0;
  // Parse override amount - allow 0 as valid value
  const overrideServiceChargeNumeric = overrideServiceChargeAmount.trim() !== "" 
    ? (isNaN(parseFloat(overrideServiceChargeAmount)) ? null : parseFloat(overrideServiceChargeAmount))
    : null;
  // Use override if checkbox is checked and a valid numeric value is entered (including 0)
  const serviceCharge = overrideServiceCharge && overrideServiceChargeNumeric !== null
    ? overrideServiceChargeNumeric
    : calculatedServiceCharge;
  // Calculate total amount customer pays/sends
  // For GCASH-IN: 
  //   - Amount entered = GCash credits customer receives (transaction value)
  //   - If toggle OFF: Customer pays cash = amount + service charge
  //   - If toggle ON: Customer pays cash = amount only, service charge deducted from GCash credits
  // For GCASH-OUT: 
  //   - If toggle OFF: Customer sends GCash = amount only, service fee paid separately in cash
  //   - If toggle ON: Customer sends GCash = amount + service charge
  const totalAmount = transactionType === "gcash-out" 
    ? (deductServiceFeeFromGCash ? numericAmount + serviceCharge : numericAmount)  // GCASH-OUT: Depends on option
    : (deductServiceFeeFromGCash ? numericAmount : numericAmount + serviceCharge);  // GCASH-IN: Customer pays amount + service charge (unless deducted from GCash)
  const isValid = numericAmount > 0;
  // Allow transactions even with insufficient funds - will show negative balance
  const isValidTransaction = isValid;
  
  // Calculate new balance after transaction
  // If deductServiceFeeFromGCash is enabled, also deduct service charge from GCash balance
  let newBalanceAfterTransaction: number;
  if (transactionType === "gcash-in") {
    // GCASH-IN: Deduct amount from GCash balance
    // If deductServiceFeeFromGCash: also deduct service charge
    newBalanceAfterTransaction = currentBalance - numericAmount - (deductServiceFeeFromGCash ? serviceCharge : 0);
  } else {
    // GCASH-OUT: 
    // If deductServiceFeeFromGCash: Customer sends amount + serviceCharge, we receive it, then deduct serviceCharge
    // Otherwise: Customer sends only amount (serviceCharge paid in cash separately)
    if (deductServiceFeeFromGCash) {
      newBalanceAfterTransaction = currentBalance + numericAmount + serviceCharge - serviceCharge; // Net: +amount
    } else {
      newBalanceAfterTransaction = currentBalance + numericAmount; // Only amount received
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <Smartphone className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">GCash Transaction</h2>
              <p className={`text-sm font-mono ${currentBalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                GCASH-FUNDS: ₱{currentBalance.toFixed(2)}
                {currentBalance < 0 && <span className="ml-1 text-xs">(Negative)</span>}
              </p>
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
                  ? "border-warning bg-warning/10"
                  : "border-border hover:border-warning/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "gcash-in" ? "bg-success/20" : "bg-secondary"}`}>
                <ArrowDownCircle className={`w-6 h-6 ${transactionType === "gcash-in" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold text-sm ${transactionType === "gcash-in" ? "text-foreground" : "text-muted-foreground"}`}>
                GCASH-IN
              </span>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Customer pays cash<br />We send GCash credit
              </p>
            </button>

            <button
              onClick={() => setTransactionType("gcash-out")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 relative ${
                transactionType === "gcash-out"
                  ? "border-warning bg-warning/10"
                  : "border-border hover:border-warning/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "gcash-out" ? "bg-info/20" : "bg-secondary"}`}>
                <ArrowUpCircle className={`w-6 h-6 ${transactionType === "gcash-out" ? "text-info" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold text-sm ${transactionType === "gcash-out" ? "text-foreground" : "text-muted-foreground"}`}>
                GCASH-OUT
              </span>
              <p className="text-xs text-muted-foreground text-center mt-1">
                We give customer cash<br />Customer sends GCash credit<br />
                <span className="text-warning font-medium">Service fee applies</span>
              </p>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {transactionType === "gcash-in" 
              ? "Amount to Send (₱)" 
              : "Cash Amount to Give (₱)"}
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
          {transactionType === "gcash-out" && numericAmount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Customer will receive ₱{numericAmount.toFixed(2)} in cash
            </p>
          )}
          {numericAmount > 0 && (
            <p className={`text-xs mt-1 font-mono ${willBeNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
              GCash balance after: ₱{newBalanceAfterTransaction.toFixed(2)}
              {willBeNegative && <span className="ml-1">(Negative)</span>}
            </p>
          )}
        </div>

        {/* Service Charge Display */}
        {numericAmount > 0 && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg border border-border/50">
            {transactionType === "gcash-out" ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Cash to Give:</span>
                  <span className="text-sm font-mono text-foreground">₱{numericAmount.toFixed(2)}</span>
                </div>
                {serviceCharge > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Service Charge:</span>
                      <span className="text-sm font-mono text-warning">₱{serviceCharge.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-sm font-medium text-foreground">Total to Receive (GCash):</span>
                      <span className="text-lg font-bold font-mono text-warning">₱{totalAmount.toFixed(2)}</span>
                    </div>
                    {!deductServiceFeeFromGCash && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                        <span className="text-sm font-medium text-foreground">Service Fee (Cash):</span>
                        <span className="text-sm font-mono text-warning">₱{serviceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-border/30 bg-warning/5 rounded-lg p-2">
                      <p className="text-xs text-center text-muted-foreground mb-1">
                        <span className="font-semibold text-foreground">Transaction Summary:</span>
                      </p>
                      <p className="text-xs text-center text-foreground">
                        Customer sends <span className="font-bold text-warning">₱{totalAmount.toFixed(2)}</span> GCash
                      </p>
                      <p className="text-xs text-center text-foreground">
                        Receives <span className="font-bold text-success">₱{numericAmount.toFixed(2)}</span> cash
                      </p>
                      <p className="text-xs text-center text-warning font-medium mt-1">
                        Service fee: ₱{serviceCharge.toFixed(2)}
                      </p>
                      {deductServiceFeeFromGCash ? (
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Fee is <span className="font-semibold text-warning">deducted from sender</span> (from GCash balance)
                          <br />
                          <span className="text-xs">₱{totalAmount.toFixed(2)} received - ₱{serviceCharge.toFixed(2)} fee = ₱{numericAmount.toFixed(2)} net to GCash</span>
                        </p>
                      ) : (
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Fee is <span className="font-semibold text-success">paid separately in cash</span>
                          <br />
                          <span className="text-xs">Customer pays ₱{serviceCharge.toFixed(2)} cash for service fee</span>
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center">
                      No service charge for amounts outside ₱10-₱1,000 range
                    </p>
                    <p className="text-xs text-center text-foreground mt-2">
                      Customer sends <span className="font-bold text-warning">₱{numericAmount.toFixed(2)}</span> GCash
                      <br />
                      Receives <span className="font-bold text-success">₱{numericAmount.toFixed(2)}</span> cash
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Transaction Amount:</span>
                  <span className="text-sm font-mono text-foreground">₱{numericAmount.toFixed(2)}</span>
                </div>
                {serviceCharge > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Service Charge:</span>
                      <span className="text-sm font-mono text-warning">₱{serviceCharge.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-sm font-medium text-foreground">Total to Pay (Cash):</span>
                      <span className="text-lg font-bold font-mono text-warning">₱{totalAmount.toFixed(2)}</span>
                    </div>
                    {!deductServiceFeeFromGCash && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Breakdown:</span>
                        <span className="text-xs font-mono text-muted-foreground">₱{numericAmount.toFixed(2)} + ₱{serviceCharge.toFixed(2)} fee</span>
                      </div>
                    )}
                    {deductServiceFeeFromGCash && (
                      <>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">Service Charge (Deducted from GCash):</span>
                          <span className="text-xs font-mono text-warning">₱{serviceCharge.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Service fee will be deducted from GCash balance
                        </p>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Override Service Charge Option (GCASH-OUT only) */}
        {numericAmount > 0 && transactionType === "gcash-out" && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <Checkbox
                id="override-service-charge"
                checked={overrideServiceCharge}
                onCheckedChange={(checked) => {
                  setOverrideServiceCharge(checked === true);
                  if (!checked) {
                    setOverrideServiceChargeAmount("");
                  }
                }}
              />
              <label
                htmlFor="override-service-charge"
                className="text-sm font-medium text-foreground cursor-pointer flex-1"
              >
                Override service charge amount
              </label>
            </div>
            {overrideServiceCharge && (
              <div className="ml-7 mb-3">
                <label className="block text-xs text-muted-foreground mb-2">
                  Service Charge Amount (₱)
                </label>
                {/* Quick Select Buttons */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setOverrideServiceChargeAmount("5")}
                    className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
                      overrideServiceChargeAmount === "5"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary hover:bg-secondary/80 border-border"
                    }`}
                  >
                    ₱5
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideServiceChargeAmount("10")}
                    className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
                      overrideServiceChargeAmount === "10"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary hover:bg-secondary/80 border-border"
                    }`}
                  >
                    ₱10
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideServiceChargeAmount("15")}
                    className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
                      overrideServiceChargeAmount === "15"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary hover:bg-secondary/80 border-border"
                    }`}
                  >
                    ₱15
                  </button>
                </div>
                {/* Manual Input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                    ₱
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={overrideServiceChargeAmount}
                    onChange={(e) => setOverrideServiceChargeAmount(e.target.value)}
                    onKeyDown={(e) => {
                      // Stop propagation to prevent triggering main amount input focus
                      e.stopPropagation();
                    }}
                    placeholder={calculatedServiceCharge > 0 ? calculatedServiceCharge.toFixed(2) : "0.00"}
                    className="pl-8 pr-3 py-2 text-sm font-mono"
                  />
                </div>
                {calculatedServiceCharge > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated: ₱{calculatedServiceCharge.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deduct Service Fee from GCash Option */}
        {numericAmount > 0 && serviceCharge > 0 && transactionType === "gcash-out" && (
          <div className="mb-4 p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div className="flex items-center gap-3">
              <Checkbox
                id="deduct-service-fee"
                checked={deductServiceFeeFromGCash}
                onCheckedChange={(checked) => setDeductServiceFeeFromGCash(checked === true)}
              />
              <label
                htmlFor="deduct-service-fee"
                className="text-sm font-medium text-foreground cursor-pointer flex-1"
              >
                Deduct service fee from sender (GCash balance)
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-7">
              {deductServiceFeeFromGCash 
                ? `Customer sends ₱${(numericAmount + serviceCharge).toFixed(2)} GCash. Receives ₱${numericAmount.toFixed(2)} cash. Service fee (₱${serviceCharge.toFixed(2)}) is deducted from the amount sent, so it's deducted from our GCash balance.`
                : `Customer sends ₱${numericAmount.toFixed(2)} GCash. Receives ₱${numericAmount.toFixed(2)} cash. Service fee (₱${serviceCharge.toFixed(2)}) is paid separately in cash.`}
            </p>
          </div>
        )}
        {/* For GCASH-IN, show option if needed */}
        {numericAmount > 0 && serviceCharge > 0 && transactionType === "gcash-in" && (
          <div className="mb-4 p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div className="flex items-center gap-3">
              <Checkbox
                id="deduct-service-fee-in"
                checked={deductServiceFeeFromGCash}
                onCheckedChange={(checked) => setDeductServiceFeeFromGCash(checked === true)}
              />
              <label
                htmlFor="deduct-service-fee-in"
                className="text-sm font-medium text-foreground cursor-pointer flex-1"
              >
                Deduct service fee from GCash balance
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-7">
              {deductServiceFeeFromGCash 
                ? `Customer pays only ₱${numericAmount.toFixed(2)} cash. Service fee (₱${serviceCharge.toFixed(2)}) will be deducted from GCash balance.`
                : `Customer pays ₱${(numericAmount + serviceCharge).toFixed(2)} cash (₱${numericAmount.toFixed(2)} + ₱${serviceCharge.toFixed(2)} fee). Service fee is kept as profit.`}
            </p>
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

