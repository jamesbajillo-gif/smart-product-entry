import { useState } from "react";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Package, Truck } from "lucide-react";

export interface RestockData {
  quantity: number;
  supplier: string;
  unitCost: number;
  notes: string;
}

interface StockAdjustmentDialogProps {
  product: Product;
  onConfirm: (type: 'add' | 'remove' | 'set', quantity: number, reason: string, restockData?: RestockData) => void;
  onCancel: () => void;
}

export function StockAdjustmentDialog({
  product,
  onConfirm,
  onCancel,
}: StockAdjustmentDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [supplier, setSupplier] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");

  const currentStock = product.stock_quantity ?? 0;
  const newStock = currentStock + quantity;
  const totalCost = unitCost ? quantity * parseFloat(unitCost) : 0;

  const handleSubmit = () => {
    if (quantity <= 0) return;
    
    const restockData: RestockData = {
      quantity,
      supplier: supplier.trim(),
      unitCost: parseFloat(unitCost) || 0,
      notes: notes.trim(),
    };
    
    const reason = supplier 
      ? `Restock from ${supplier}${unitCost ? ` @ ₱${parseFloat(unitCost).toFixed(2)}/unit` : ''}`
      : 'Restock';
    
    onConfirm('add', quantity, reason, restockData);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/20 rounded-lg">
              <Truck className="w-5 h-5 text-success" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Restock Product</h2>
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
            <span className={`text-xl font-bold ${
              currentStock <= (product.low_stock_threshold ?? 5)
                ? 'text-destructive'
                : 'text-foreground'
            }`}>{currentStock}</span>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Quantity to Add
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>

          {/* Supplier Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Supplier
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="e.g., ABC Distributors, Local Market..."
              className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Unit Cost Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Unit Cost (Purchase Price)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, batch number, expiry date..."
              className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Summary */}
          <div className="space-y-2 p-3 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New Stock</span>
              <span className="text-xl font-bold text-success">{newStock}</span>
            </div>
            {totalCost > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium text-foreground">₱{totalCost.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-success hover:bg-success/90" 
              onClick={handleSubmit}
              disabled={quantity <= 0}
            >
              <Package className="w-4 h-4 mr-2" />
              Restock
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}