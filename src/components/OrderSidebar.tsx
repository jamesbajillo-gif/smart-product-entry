import { useState, useEffect } from "react";
import { OrderItem } from "@/types/product";
import { Trash2, ShoppingCart, Plus, Minus, X, Info, Receipt, CheckCircle, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentDetails } from "./PaymentDialog";

interface OrderSidebarProps {
  items: OrderItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearOrder: () => void;
  onCheckout: () => void;
  isOpen: boolean;
  onClose: () => void;
  showReceipt?: boolean;
  receiptItems?: OrderItem[] | null;
  receiptPayment?: PaymentDetails | null;
  onCloseReceipt?: () => void;
}

export function OrderSidebar({ 
  items, 
  onRemoveItem, 
  onUpdateQuantity, 
  onClearOrder,
  onCheckout,
  isOpen,
  onClose,
  showReceipt = false,
  receiptItems = null,
  receiptPayment = null,
  onCloseReceipt,
}: OrderSidebarProps) {
  const [showServicesDialog, setShowServicesDialog] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Trigger flip animation when showReceipt changes
  useEffect(() => {
    if (showReceipt) {
      // Small delay to ensure smooth transition
      setTimeout(() => setIsFlipped(true), 50);
    } else {
      setIsFlipped(false);
    }
  }, [showReceipt]);
  
  // Calculate receipt totals
  const receiptSubtotal = receiptItems?.reduce((sum, item) => {
    const productTotal = item.product.price * item.quantity;
    const servicesTotal = (item.selectedServices || []).reduce(
      (serviceSum, service) => serviceSum + service.price * item.quantity,
      0
    );
    return sum + productTotal + servicesTotal;
  }, 0) || 0;
  
  const receiptBottleDeposit = receiptPayment?.bottleDeposit || 0;
  const receiptTotal = receiptSubtotal + receiptBottleDeposit;
  const receiptItemCount = receiptItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const now = new Date();
  
  const total = items.reduce((sum, item) => {
    const productTotal = item.product.price * item.quantity;
    const servicesTotal = (item.selectedServices || []).reduce(
      (serviceSum, service) => serviceSum + service.price * item.quantity,
      0
    );
    return sum + productTotal + servicesTotal;
  }, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate total services fees
  const totalServicesFee = items.reduce((sum, item) => {
    return sum + (item.selectedServices || []).reduce(
      (serviceSum, service) => serviceSum + service.price * item.quantity,
      0
    );
  }, 0);
  
  // Get all services with details
  const servicesBreakdown = items.flatMap((item) => {
    if (!item.selectedServices || item.selectedServices.length === 0) return [];
    return item.selectedServices.map((service) => ({
      productName: item.product.name,
      serviceName: service.name,
      servicePrice: service.price,
      quantity: item.quantity,
      total: service.price * item.quantity,
    }));
  });

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 h-full w-full max-w-sm glass-panel z-50
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:static lg:translate-x-0 lg:w-80 lg:rounded-lg lg:h-full
        perspective-1000
      `}>
        {/* Flip Container */}
        <div className={`
          relative w-full h-full preserve-3d transition-transform duration-500 ease-in-out
          ${isFlipped ? 'rotate-y-180' : ''}
        `} style={{ transformStyle: 'preserve-3d' }}>
          {/* Cart Side (Front) */}
          <div className={`
            absolute inset-0 w-full h-full backface-hidden flex flex-col
            ${isFlipped ? 'hidden' : 'block'}
          `} style={{ backfaceVisibility: 'hidden' }}>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="relative p-2 bg-primary/20 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 flex items-center justify-center px-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                      {itemCount}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground">Current Order</h2>
                  <p className="text-sm text-muted-foreground">{itemCount} items</p>
                </div>
                {/* Close button - mobile only */}
                <button 
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No items yet</p>
                  <p className="text-sm mt-1">Start typing to add products</p>
                </div>
              ) : (
                items.map((item, index) => {
                  const servicesTotal = (item.selectedServices || []).reduce(
                    (sum, service) => sum + service.price * item.quantity,
                    0
                  );
                  const itemTotal = item.product.price * item.quantity + servicesTotal;
                  
                  return (
                    <div
                      key={`${item.product.id}-${index}-${(item.selectedServices || []).map(s => s.id).join(',')}`}
                      className="group p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm sm:text-base">
                            {item.product.name}
                          </p>
                          {item.selectedServices && item.selectedServices.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.selectedServices.map((service) => (
                                <span
                                  key={service.id}
                                  className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded"
                                >
                                  {service.name} (+₱{service.price.toFixed(2)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onRemoveItem(item.product.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/20 text-destructive transition-all ml-2 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="p-2 rounded-md bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center font-mono text-lg font-bold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="p-2 rounded-md bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="font-mono font-semibold text-primary text-lg">
                          ₱{itemTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with total and actions */}
            <div className="p-4 border-t border-border space-y-4 bg-background/50">
              {totalServicesFee > 0 && (
                <button
                  onClick={() => setShowServicesDialog(true)}
                  className="w-full text-xs text-primary hover:text-primary/80 hover:underline transition-colors flex items-center justify-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  <span>Services/Fees: ₱{totalServicesFee.toFixed(2)}</span>
                </button>
              )}
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-muted-foreground">Total</span>
                <span className="text-3xl font-bold font-mono text-primary">
                  ₱{total.toFixed(2)}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClearOrder}
                  disabled={items.length === 0}
                >
                  Clear
                </Button>
                <Button 
                  className="flex-1 glow-primary text-lg py-6"
                  onClick={onCheckout}
                  disabled={items.length === 0}
                >
                  Checkout
                </Button>
              </div>
            </div>
          </div>
          
          {/* Receipt Side (Back) */}
          {showReceipt && receiptItems && receiptPayment && (
            <div className={`
              absolute inset-0 w-full h-full backface-hidden flex flex-col
              ${isFlipped ? 'block' : 'hidden'}
            `} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              {/* Receipt Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="relative p-2 bg-success/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-foreground">Receipt</h2>
                    <p className="text-sm text-muted-foreground">Transaction Complete</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (onCloseReceipt) onCloseReceipt();
                    }}
                    className="p-2 rounded-lg hover:bg-secondary lg:hidden"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Receipt Content */}
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm">
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
                    {receiptItems.map((item) => {
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

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-foreground">
                      <span>Subtotal</span>
                      <span>₱{receiptSubtotal.toFixed(2)}</span>
                    </div>
                    {receiptBottleDeposit > 0 && (
                      <div className="flex justify-between text-foreground">
                        <span>Bottle Deposit</span>
                        <span>₱{receiptBottleDeposit.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="divider border-t border-dashed border-border my-2" />
                    <div className="flex justify-between text-lg font-bold text-primary">
                      <span>Total</span>
                      <span>₱{receiptTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="divider border-t border-dashed border-border my-3" />

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {receiptPayment.paymentMethod === 'cash' ? (
                        <Banknote className="w-4 h-4" />
                      ) : (
                        <Smartphone className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {receiptPayment.paymentMethod === 'cash' ? 'Cash' : 'GCash'}
                      </span>
                    </div>
                    {receiptPayment.amountPaid && (
                      <div className="flex justify-between text-foreground">
                        <span>Amount Paid</span>
                        <span>₱{receiptPayment.amountPaid.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptPayment.change && receiptPayment.change > 0 && (
                      <div className="flex justify-between text-foreground">
                        <span>Change</span>
                        <span>₱{receiptPayment.change.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="footer text-center mt-4 text-muted-foreground text-xs">
                    <p>Thank you for your purchase!</p>
                    <p>Please come again</p>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="p-4 border-t border-border bg-background/50">
                <Button 
                  className="w-full"
                  onClick={() => {
                    if (onCloseReceipt) onCloseReceipt();
                  }}
                >
                  Close
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Press ESC to return to cart
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Services Breakdown Dialog */}
      <Dialog open={showServicesDialog} onOpenChange={setShowServicesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Services & Fees Breakdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {servicesBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No services or fees applied
              </p>
            ) : (
              <>
                {servicesBreakdown.map((service, index) => (
                  <div
                    key={index}
                    className="p-3 bg-secondary/30 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {service.productName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Qty: {service.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {service.serviceName}
                      </span>
                      <span className="text-sm font-mono text-primary">
                        ₱{service.servicePrice.toFixed(2)} × {service.quantity} = ₱{service.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      Total Services/Fees
                    </span>
                    <span className="text-lg font-mono font-bold text-primary">
                      ₱{totalServicesFee.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}