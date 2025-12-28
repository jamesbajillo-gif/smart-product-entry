import { useState, useRef, useEffect } from "react";
import { X, Plus, Minus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface StoreFundsDialogProps {
  currentBalance: number;
  onConfirm: (type: "add" | "withdraw", amount: number, notes?: string, category?: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function StoreFundsDialog({ currentBalance, availableFunds, onConfirm, onCancel }: StoreFundsDialogProps) {
  const [transactionType, setTransactionType] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [paymentSource, setPaymentSource] = useState<PaymentSource>("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => amountInputRef.current?.focus());
  }, []);

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0 && (transactionType === "add" || numericAmount <= currentBalance);

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsProcessing(true);
    try {
      const result = await onConfirm(transactionType, numericAmount, notes.trim() || undefined, category.trim() || undefined);
      
      if (result.success) {
        toast({
          title: transactionType === "add" ? "Funds added" : "Funds withdrawn",
          description: `₱${numericAmount.toFixed(2)} ${transactionType === "add" ? "added to" : "withdrawn from"} store funds`,
        });
        onCancel();
      } else {
        toast({
          title: "Transaction failed",
          description: result.error || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing store funds transaction:", error);
      toast({
        title: "Error",
        description: "Failed to process transaction",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid && !isProcessing) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-xl mx-4 animate-scale-in" onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Store Funds</h2>
              <p className="text-sm text-muted-foreground">Current Balance: ₱{currentBalance.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Transaction Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTransactionType("add")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                transactionType === "add"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "add" ? "bg-success/20" : "bg-secondary"}`}>
                <Plus className={`w-6 h-6 ${transactionType === "add" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold ${transactionType === "add" ? "text-foreground" : "text-muted-foreground"}`}>
                Add Funds
              </span>
            </button>

            <button
              onClick={() => setTransactionType("withdraw")}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                transactionType === "withdraw"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-secondary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${transactionType === "withdraw" ? "bg-destructive/20" : "bg-secondary"}`}>
                <Minus className={`w-6 h-6 ${transactionType === "withdraw" ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <span className={`font-semibold ${transactionType === "withdraw" ? "text-foreground" : "text-muted-foreground"}`}>
                Withdraw
              </span>
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-lg">
              ₱
            </span>
            <Input
              ref={amountInputRef}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="pl-10 pr-4 py-3 text-lg font-mono"
            />
          </div>
          {transactionType === "withdraw" && numericAmount > currentBalance && (
            <p className="text-sm text-destructive mt-1">Insufficient funds</p>
          )}
        </div>

        {/* Category (Optional) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Category (Optional)
          </label>
          <Input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Cash Deposit, Bank Withdrawal, Petty Cash..."
            className="py-2"
          />
        </div>

        {/* Notes (Optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Notes (Optional)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            className="py-2"
          />
        </div>

        {/* Summary */}
        {numericAmount > 0 && (
          <div className="mb-6 p-4 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="text-sm font-mono text-foreground">₱{currentBalance.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {transactionType === "add" ? "Adding" : "Withdrawing"}
              </span>
              <span className={`text-sm font-mono ${transactionType === "add" ? "text-success" : "text-destructive"}`}>
                {transactionType === "add" ? "+" : "-"}₱{numericAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-sm font-medium text-foreground">New Balance</span>
              <span className="text-lg font-bold font-mono text-primary">
                ₱{(transactionType === "add" ? currentBalance + numericAmount : currentBalance - numericAmount).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid || isProcessing}
          >
            {isProcessing ? "Processing..." : transactionType === "add" ? "Add Funds" : "Withdraw"}
          </Button>
        </div>
      </div>
    </div>
  );
}

