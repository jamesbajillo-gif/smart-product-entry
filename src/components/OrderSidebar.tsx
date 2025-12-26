import { OrderItem } from "@/types/product";
import { Trash2, ShoppingCart, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderSidebarProps {
  items: OrderItem[];
  onRemoveItem: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearOrder: () => void;
}

export function OrderSidebar({ items, onRemoveItem, onUpdateQuantity, onClearOrder }: OrderSidebarProps) {
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="w-80 glass-panel rounded-lg flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Current Order</h2>
            <p className="text-sm text-muted-foreground">{itemCount} items</p>
          </div>
        </div>
      </div>

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
              className="group p-3 bg-secondary/50 rounded-lg hover:bg-secondary hover:shadow-sm transition-all duration-200 animate-fade-in"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground truncate flex-1">{item.product.name}</p>
                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    className="p-1 rounded-md bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm text-foreground">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    className="p-1 rounded-md bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-mono font-semibold text-primary">
                  ₱{(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-muted-foreground">Total</span>
          <span className="text-2xl font-bold font-mono text-primary glow-success">
            ₱{total.toFixed(2)}
          </span>
        </div>
        
        {items.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClearOrder}
            >
              Clear
            </Button>
            <Button className="flex-1 glow-primary">
              Checkout
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
