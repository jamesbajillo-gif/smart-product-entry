import { useState } from "react";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus, Package } from "lucide-react";

interface StockAdjustmentDialogProps {
  product: Product;
  onConfirm: (type: 'add' | 'remove' | 'set', quantity: number, reason: string) => void;
  onCancel: () => void;
}

export function StockAdjustmentDialog({
  product,
  onConfirm,
  onCancel,
}: StockAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

  const currentStock = product.stock_quantity ?? 0;
  
  const getNewStock = () => {
    if (adjustmentType === 'add') return currentStock + quantity;
    if (adjustmentType === 'remove') return Math.max(0, currentStock - quantity);
    return quantity; // set
  };

  const handleSubmit = () => {
    if (quantity <= 0 && adjustmentType !== 'set') return;
    onConfirm(adjustmentType, quantity, reason);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Adjust Stock</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Current Stock Display */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <span className="text-muted-foreground">Current Stock</span>
            <span className="text-xl font-bold text-foreground">{currentStock}</span>
          </div>

          {/* Adjustment Type Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setAdjustmentType('add')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                adjustmentType === 'add'
                  ? 'bg-success/20 text-success border border-success/30'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add
            </button>
            <button
              onClick={() => setAdjustmentType('remove')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                adjustmentType === 'remove'
                  ? 'bg-destructive/20 text-destructive border border-destructive/30'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Minus className="w-4 h-4 inline mr-1" />
              Remove
            </button>
            <button
              onClick={() => setAdjustmentType('set')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                adjustmentType === 'set'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              Set
            </button>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              {adjustmentType === 'set' ? 'New Stock Level' : 'Quantity'}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Received shipment, Damaged goods..."
              className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* New Stock Preview */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <span className="text-muted-foreground">New Stock</span>
            <span className={`text-xl font-bold ${
              getNewStock() <= (product.low_stock_threshold ?? 5)
                ? 'text-destructive'
                : 'text-success'
            }`}>
              {getNewStock()}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSubmit}
              disabled={quantity <= 0 && adjustmentType !== 'set'}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
