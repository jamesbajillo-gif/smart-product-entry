import { OrderItem } from "@/types/product";
import { Trash2, ShoppingCart, Plus, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderSidebarProps {
  items: OrderItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearOrder: () => void;
  onCheckout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderSidebar({ 
  items, 
  onRemoveItem, 
  onUpdateQuantity, 
  onClearOrder,
  onCheckout,
  isOpen,
  onClose,
}: OrderSidebarProps) {
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
        fixed top-0 right-0 h-full w-full max-w-sm glass-panel flex flex-col z-50
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:static lg:translate-x-0 lg:w-80 lg:rounded-lg lg:h-full
      `}>
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
            items.map((item) => (
              <div
                key={item.product.id}
                className="group p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-foreground truncate flex-1 text-sm sm:text-base">
                    {item.product.name}
                  </p>
                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/20 text-destructive transition-all"
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
                    ₱{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with total and actions */}
        <div className="p-4 border-t border-border space-y-4 bg-background/50">
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
      </aside>
    </>
  );
}