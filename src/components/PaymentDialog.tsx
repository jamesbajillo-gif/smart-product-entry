import { X, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PaymentMethod = "cash" | "gcash";

interface PaymentDialogProps {
  total: number;
  onConfirm: (method: PaymentMethod) => void;
  onCancel: () => void;
}

export function PaymentDialog({ total, onConfirm, onCancel }: PaymentDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Select Payment</h2>
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

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-16 justify-start gap-4 text-lg hover:border-primary hover:bg-primary/5"
            onClick={() => onConfirm("cash")}
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
            onClick={() => onConfirm("gcash")}
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

        <Button
          variant="ghost"
          className="w-full mt-4"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
