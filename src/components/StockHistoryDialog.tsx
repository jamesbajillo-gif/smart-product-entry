import { useState, useEffect } from "react";
import { Product, StockAdjustment } from "@/types/product";
import { stockApi } from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
import { X, History, Plus, Minus, Package, ShoppingCart, RefreshCw, Truck } from "lucide-react";
import { format } from "date-fns";

interface StockHistoryDialogProps {
  product: Product;
  onClose: () => void;
}

export function StockHistoryDialog({ product, onClose }: StockHistoryDialogProps) {
  const [history, setHistory] = useState<StockAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      const result = await stockApi.getHistory(product.id);
      if (result.success && result.data) {
        setHistory(result.data);
      }
      setIsLoading(false);
    };
    loadHistory();
  }, [product.id]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'add':
        return <Plus className="w-4 h-4 text-success" />;
      case 'remove':
        return <Minus className="w-4 h-4 text-destructive" />;
      case 'sale':
        return <ShoppingCart className="w-4 h-4 text-warning" />;
      default:
        return <Package className="w-4 h-4 text-primary" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'add': return 'Stock Added';
      case 'remove': return 'Stock Removed';
      case 'set': return 'Stock Set';
      case 'sale': return 'Sale';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-2 sm:p-4">
      <div className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-4xl max-h-[95vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Stock History</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Current Stock */}
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg mb-4">
          <span className="text-muted-foreground">Current Stock</span>
          <span className={`text-xl font-bold ${
            (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 5)
              ? 'text-destructive'
              : 'text-success'
          }`}>
            {product.stock_quantity ?? 0}
          </span>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No stock history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg"
                >
                  <div className="p-2 bg-secondary/50 rounded-lg mt-0.5">
                    {getTypeIcon(adjustment.adjustment_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {getTypeLabel(adjustment.adjustment_type)}
                      </span>
                      <span className={`text-sm font-mono ${
                        adjustment.quantity_change > 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        {adjustment.quantity_change > 0 ? '+' : ''}{adjustment.quantity_change}
                      </span>
                    </div>
                    
                    {/* Supplier info */}
                    {adjustment.supplier && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Truck className="w-3 h-3" />
                        <span>{adjustment.supplier}</span>
                      </div>
                    )}
                    
                    {/* Cost info */}
                    {adjustment.unit_cost && (
                      <div className="text-sm text-muted-foreground">
                        ₱{Number(adjustment.unit_cost).toFixed(2)}/unit
                        {adjustment.total_cost && (
                          <span className="ml-2 text-primary font-medium">
                            (₱{Number(adjustment.total_cost).toFixed(2)} total)
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {adjustment.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {adjustment.notes}
                      </p>
                    )}
                    
                    {/* Reason (fallback) */}
                    {adjustment.reason && !adjustment.supplier && (
                      <p className="text-sm text-muted-foreground truncate">
                        {adjustment.reason}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {adjustment.previous_quantity} → {adjustment.new_quantity}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {adjustment.created_at && format(new Date(adjustment.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
