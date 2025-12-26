import { useState, useEffect, useRef } from "react";
import { OrderItem } from "@/types/product";
import { X, CheckCircle, Banknote, Smartphone, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PaymentDetails } from "./PaymentDialog";

interface ReceiptDialogProps {
  items: OrderItem[];
  paymentDetails: PaymentDetails;
  onClose: () => void;
}

export function ReceiptDialog({ items, paymentDetails, onClose }: ReceiptDialogProps) {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const now = new Date();

  const handleSubmit = () => {
    setIsSubmitted(true);
    toast({
      title: "🎉 Sale Complete!",
      description: `Total sold: ₱${total.toFixed(2)} • ${itemCount} item${itemCount > 1 ? 's' : ''}`,
    });
    // Auto close after animation
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Enter key to submit (unless Cancel button is focused)
  const cancelRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitted) return;
      
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        // If Cancel button is focused, close instead of submit
        if (document.activeElement === cancelRef.current) {
          onClose();
        } else {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitted, onClose]);

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="glass-panel rounded-xl p-8 w-full max-w-sm mx-4 animate-scale-in text-center">
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center animate-[pulse_1s_ease-in-out_infinite]">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <PartyPopper className="absolute top-0 right-1/4 w-6 h-6 text-primary animate-fade-in" style={{ animationDelay: '0.2s' }} />
            <PartyPopper className="absolute top-0 left-1/4 w-6 h-6 text-primary animate-fade-in scale-x-[-1]" style={{ animationDelay: '0.3s' }} />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Order Complete!</h2>
          <p className="text-3xl font-bold text-success mb-2">₱{total.toFixed(2)}</p>
          <p className="text-muted-foreground text-sm">{itemCount} item{itemCount > 1 ? 's' : ''} sold</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Review Order</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div
          className="bg-card border border-border rounded-lg p-4 font-mono text-sm"
        >
          <div className="header text-center mb-4">
            <h1 className="text-lg font-bold text-foreground">Sari-Sari Store</h1>
            <p className="text-muted-foreground text-xs">
              {now.toLocaleDateString("en-PH", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {now.toLocaleTimeString("en-PH")}
            </p>
          </div>

          <div className="divider border-t border-dashed border-border my-3" />

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product.id} className="item flex justify-between text-foreground">
                <span className="flex-1 truncate">{item.product.name}</span>
                <span className="w-10 text-center text-muted-foreground">×{item.quantity}</span>
                <span className="w-20 text-right">
                  ₱{(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="divider border-t border-dashed border-border my-3" />

          <div className="flex justify-between text-muted-foreground text-xs mb-1">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>

          <div className="total flex justify-between text-lg font-bold text-foreground">
            <span>TOTAL</span>
            <span className="text-primary">₱{total.toFixed(2)}</span>
          </div>

          <div className="space-y-2 mt-3 py-2 px-3 bg-secondary/50 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              {paymentDetails.method === "cash" ? (
                <>
                  <Banknote className="w-4 h-4 text-success" />
                  <span className="text-sm text-foreground">Paid with Cash</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 text-info" />
                  <span className="text-sm text-foreground">Paid via GCash</span>
                </>
              )}
            </div>
            {paymentDetails.method === "cash" && paymentDetails.amountTendered && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tendered</span>
                  <span className="text-foreground">₱{paymentDetails.amountTendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change</span>
                  <span className="text-success font-semibold">₱{paymentDetails.change?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="footer text-center mt-4 text-muted-foreground text-xs">
            <p>Thank you for your purchase!</p>
            <p>Please come again</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <Button ref={cancelRef} variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
