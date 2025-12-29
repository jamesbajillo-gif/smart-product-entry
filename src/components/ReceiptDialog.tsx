import { useEffect, useRef } from "react";
import { OrderItem } from "@/types/product";
import { X, CheckCircle, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PaymentDetails } from "./PaymentDialog";
import { calculateFeeAmount, getProductsForFee } from "@/utils/fees";

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
  const bottleDeposit = paymentDetails.bottleDeposit || 0;
  const fees = paymentDetails.totalFees || 0;
  const total = subtotal + bottleDeposit + fees;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col">
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
            {items.map((item) => {
              const servicesTotal = (item.selectedServices || []).reduce(
                (sum, service) => sum + service.price * item.quantity,
                0
              );
              const itemTotal = item.product.price * item.quantity + servicesTotal;
              return (
                <div key={item.product.id} className="item flex justify-between text-foreground">
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.product.name}</div>
                    {item.selectedServices && item.selectedServices.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.selectedServices.map(s => s.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="w-10 text-center text-muted-foreground">×{item.quantity}</span>
                  <span className="w-20 text-right">
                    ₱{itemTotal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="divider border-t border-dashed border-border my-3" />

          <div className="flex justify-between text-muted-foreground text-xs mb-1">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>

          <div className="flex justify-between text-muted-foreground text-xs mb-1">
            <span>Subtotal</span>
            <span>₱{subtotal.toFixed(2)}</span>
          </div>

          {paymentDetails.fees && paymentDetails.fees.length > 0 && paymentDetails.enabledFeeIds && (
            <>
              {paymentDetails.fees
                .filter(fee => fee.id && paymentDetails.enabledFeeIds?.includes(fee.id))
                .map((fee) => {
                  // Calculate fee amount for receipt display
                  const matchingItems = getProductsForFee(fee, items);
                  const matchingItemsCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
                  const feeAmount = calculateFeeAmount(fee, subtotal, matchingItemsCount);
                  return (
                    <div key={fee.id} className="flex justify-between text-muted-foreground text-xs mb-1">
                      <span>{fee.name}</span>
                      <span>₱{feeAmount.toFixed(2)}</span>
                    </div>
                  );
                })}
              {fees > 0 && (
                <div className="flex justify-between text-foreground text-xs font-medium mb-1">
                  <span>Total Fees</span>
                  <span>₱{fees.toFixed(2)}</span>
                </div>
              )}
            </>
          )}

          {bottleDeposit > 0 && (
            <>
              <div className="flex justify-between text-info text-xs mb-1">
                <span>Bottle Deposit</span>
                <span>₱{bottleDeposit.toFixed(2)}</span>
              </div>
              {paymentDetails.bottleDepositBreakdown && paymentDetails.bottleDepositBreakdown.length > 0 && (
                <div className="ml-4 space-y-0.5 mb-1">
                  {paymentDetails.bottleDepositBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.productName} × {item.quantity} @ ₱{item.deposit.toFixed(2)}</span>
                      <span>₱{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="divider border-t border-dashed border-border my-2" />

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
            {paymentDetails.method === "cash" && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tendered</span>
                  <span className="text-foreground">₱{(paymentDetails.amountTendered ?? total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change</span>
                  <span className="text-success font-semibold">₱{(paymentDetails.change ?? 0).toFixed(2)}</span>
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
