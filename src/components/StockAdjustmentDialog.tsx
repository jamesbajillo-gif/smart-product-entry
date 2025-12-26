import { useState, useEffect, useMemo } from "react";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Package, Truck, Box, Cigarette } from "lucide-react";

export interface RestockData {
  quantity: number;
  supplier: string;
  unitCost: number;
  notes: string;
  packagingType?: string;
  packagingCount?: number;
}

interface PackagingConfig {
  type: string;
  label: string;
  unitsPerPackage: number;
  icon: React.ReactNode;
}

// Detect product packaging type based on name
const getPackagingConfig = (productName: string): PackagingConfig | null => {
  const name = productName.toLowerCase();
  
  // Zesto products - per box (typically 12 per box)
  if (name.includes('zesto')) {
    return {
      type: 'box',
      label: 'Box',
      unitsPerPackage: 12,
      icon: <Box className="w-4 h-4" />,
    };
  }
  
  // Coca Cola products - per case (varies by size)
  if (name.includes('coca cola') || name.includes('coke') || name.includes('coca-cola')) {
    // Larger sizes have fewer per case
    if (name.includes('1.5') || name.includes('1.5l') || name.includes('2l') || name.includes('1l')) {
      return {
        type: 'case',
        label: 'Case',
        unitsPerPackage: 6,
        icon: <Box className="w-4 h-4" />,
      };
    }
    if (name.includes('500ml') || name.includes('500')) {
      return {
        type: 'case',
        label: 'Case',
        unitsPerPackage: 12,
        icon: <Box className="w-4 h-4" />,
      };
    }
    // Default for cans or small bottles
    return {
      type: 'case',
      label: 'Case',
      unitsPerPackage: 24,
      icon: <Box className="w-4 h-4" />,
    };
  }
  
  // Other sodas/drinks - generic case
  if (name.includes('sprite') || name.includes('fanta') || name.includes('royal') || 
      name.includes('pepsi') || name.includes('mountain dew') || name.includes('mirinda')) {
    if (name.includes('1.5') || name.includes('1l') || name.includes('2l')) {
      return {
        type: 'case',
        label: 'Case',
        unitsPerPackage: 6,
        icon: <Box className="w-4 h-4" />,
      };
    }
    return {
      type: 'case',
      label: 'Case',
      unitsPerPackage: 24,
      icon: <Box className="w-4 h-4" />,
    };
  }
  
  // Cigarettes - per pack (20 sticks per pack, 10 packs per carton)
  if (name.includes('cigarette') || name.includes('marlboro') || name.includes('fortune') || 
      name.includes('philip morris') || name.includes('camel') || name.includes('winston') ||
      name.includes('hope') || name.includes('mighty')) {
    return {
      type: 'ream',
      label: 'Ream (10 packs)',
      unitsPerPackage: 10, // 10 packs per ream
      icon: <Cigarette className="w-4 h-4" />,
    };
  }
  
  return null;
};

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
  const packagingConfig = useMemo(() => getPackagingConfig(product.name), [product.name]);
  
  const [usePackaging, setUsePackaging] = useState(!!packagingConfig);
  const [packageCount, setPackageCount] = useState(1);
  const [manualQuantity, setManualQuantity] = useState(packagingConfig?.unitsPerPackage ?? 1);
  const [supplier, setSupplier] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-calculate quantity when package count changes
  useEffect(() => {
    if (usePackaging && packagingConfig) {
      setManualQuantity(packageCount * packagingConfig.unitsPerPackage);
    }
  }, [packageCount, usePackaging, packagingConfig]);

  const currentStock = product.stock_quantity ?? 0;
  const quantity = manualQuantity;
  const newStock = currentStock + quantity;
  const totalCost = unitCost ? quantity * parseFloat(unitCost) : 0;

  const handleSubmit = () => {
    if (quantity <= 0) return;
    
    const packagingNote = usePackaging && packagingConfig 
      ? `${packageCount} ${packagingConfig.label}(s) × ${packagingConfig.unitsPerPackage} = ${quantity} units`
      : '';
    
    const restockData: RestockData = {
      quantity,
      supplier: supplier.trim(),
      unitCost: parseFloat(unitCost) || 0,
      notes: [notes.trim(), packagingNote].filter(Boolean).join(' | '),
      packagingType: usePackaging ? packagingConfig?.type : undefined,
      packagingCount: usePackaging ? packageCount : undefined,
    };
    
    const reason = supplier 
      ? `Restock from ${supplier}${unitCost ? ` @ ₱${parseFloat(unitCost).toFixed(2)}/unit` : ''}`
      : 'Restock';
    
    onConfirm('add', quantity, reason, restockData);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in max-h-[90vh] overflow-y-auto">
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

          {/* Packaging Toggle (if applicable) */}
          {packagingConfig && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {packagingConfig.icon}
                  <span className="font-medium text-foreground">
                    Use {packagingConfig.label} Count
                  </span>
                </div>
                <button
                  onClick={() => setUsePackaging(!usePackaging)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    usePackaging ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    usePackaging ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              {usePackaging && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground block">
                    Number of {packagingConfig.label}s ({packagingConfig.unitsPerPackage} units each)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPackageCount(Math.max(1, packageCount - 1))}
                      className="p-2 bg-secondary rounded-lg hover:bg-secondary/80"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={packageCount}
                      onChange={(e) => setPackageCount(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => setPackageCount(packageCount + 1)}
                      className="p-2 bg-secondary rounded-lg hover:bg-secondary/80"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    = {packageCount * packagingConfig.unitsPerPackage} units total
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quantity Input (manual or override) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">
                {usePackaging && packagingConfig ? 'Total Quantity (override if needed)' : 'Quantity to Add'}
              </label>
              {usePackaging && packagingConfig && (
                <span className="text-xs text-muted-foreground">
                  Auto: {packageCount * packagingConfig.unitsPerPackage}
                </span>
              )}
            </div>
            <input
              type="number"
              value={manualQuantity}
              onChange={(e) => setManualQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              Unit Cost (Purchase Price per piece)
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
              <span className="text-muted-foreground">Adding</span>
              <span className="text-lg font-bold text-success">+{quantity} units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New Stock</span>
              <span className="text-xl font-bold text-success">{newStock}</span>
            </div>
            {totalCost > 0 && (
              <div className="flex items-center justify-between text-sm border-t border-success/20 pt-2 mt-2">
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
