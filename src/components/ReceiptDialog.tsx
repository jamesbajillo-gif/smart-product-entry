import { useEffect, useRef } from "react";
import { OrderItem } from "@/types/product";
import { X, CheckCircle, Banknote, Smartphone, AlertCircle } from "lucide-react";
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
  const subtotal = items.reduce((sum, item) => {
    const productTotal = item.product.price * item.quantity;
    const servicesTotal = (item.selectedServices || []).reduce(
      (serviceSum, service) => serviceSum + service.price * item.quantity,
      0
    );
    return sum + productTotal + servicesTotal;
  }, 0);
  const total = subtotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const now = new Date();

  const handleSubmit = () => {
    toast({
      title: "Sale Complete",
      description: `Total: ₱${total.toFixed(2)} • ${itemCount} item${itemCount > 1 ? 's' : ''}`,
    });
    onClose();
  };

  // Enter key to submit (unless Cancel button is focused)
  const cancelRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#808080]">
      <div className="window-border bg-[#c0c0c0] p-4 w-full h-full max-w-xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Receipt</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="bg-card border border-border p-4 font-mono text-base flex-1 overflow-y-auto">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">Sari-Sari Store</h1>
            <p className="text-base">{now.toLocaleDateString("en-PH")} {now.toLocaleTimeString("en-PH")}</p>
          </div>
          <div className="border-t border-border my-3" />

          <div className="space-y-2">
            {items.map((item) => {
              const servicesTotal = (item.selectedServices || []).reduce(
                (sum, service) => sum + service.price * item.quantity,
                0
              );
              const itemTotal = item.product.price * item.quantity + servicesTotal;
              return (
                <div key={item.product.id} className="flex justify-between text-base py-1">
                  <span>{item.product.name}{item.quantity > 1 && ` ×${item.quantity}`}</span>
                  <span className="font-mono font-semibold">₱{itemTotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t-2 border-border my-4" />

          <div className="flex justify-between text-xl font-bold mb-3">
            <span>Total:</span>
            <span className="font-mono">₱{total.toFixed(2)}</span>
          </div>

          {paymentDetails.isUnpaid && (
            <div className="bg-warning/20 border-2 border-warning/50 p-3 rounded-lg mt-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                <span className="font-bold text-warning">UNPAID TRANSACTION</span>
              </div>
              {paymentDetails.unpaidNotes && (
                <div className="text-sm text-foreground">
                  <span className="font-semibold">Notes:</span> {paymentDetails.unpaidNotes}
                </div>
              )}
            </div>
          )}

          {paymentDetails.method === "cash" && (
            <div className="text-base mt-3 space-y-2">
              <div className="flex justify-between">
                <span>Tendered:</span>
                <span className="font-mono font-semibold">₱{(paymentDetails.amountTendered ?? total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span className="font-mono font-bold text-xl">₱{(paymentDetails.change ?? 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 border-t border-border pt-4">
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
