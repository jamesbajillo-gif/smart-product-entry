import { useState, useEffect } from "react";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Package, Truck, Box, Layers } from "lucide-react";

export interface RestockData {
  quantity: number;
  supplier: string;
  unitCost: number;
  notes: string;
  packagingType?: string;
  packagingCount?: number;
  packagePrice?: number;
}

type PackagingType = 'case' | 'pack' | 'box';
type RestockMode = 'pieces' | 'bulk';

const PACKAGING_OPTIONS: { value: PackagingType; label: string }[] = [
  { value: 'case', label: 'Case' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
];

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
  const [mode, setMode] = useState<RestockMode>('pieces');
  const [packagingType, setPackagingType] = useState<PackagingType>('case');
  const [packageCount, setPackageCount] = useState(1);
  const [unitsPerPackage, setUnitsPerPackage] = useState(12);
  const [packagePrice, setPackagePrice] = useState("");
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [piecePrice, setPiecePrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  // Calculate totals based on mode
  const quantity = mode === 'bulk' 
    ? packageCount * unitsPerPackage 
    : piecesQuantity;
  
  const unitCost = mode === 'bulk' && packagePrice
    ? parseFloat(packagePrice) / unitsPerPackage
    : parseFloat(piecePrice) || 0;
  
  const totalCost = mode === 'bulk' && packagePrice
    ? packageCount * parseFloat(packagePrice)
    : piecesQuantity * (parseFloat(piecePrice) || 0);

  const currentStock = product.stock_quantity ?? 0;
  const newStock = currentStock + quantity;

  const handleSubmit = () => {
    if (quantity <= 0) return;
    
    const packagingNote = mode === 'bulk'
      ? `${packageCount} ${packagingType}(s) × ${unitsPerPackage} = ${quantity} pcs`
      : '';
    
    const restockData: RestockData = {
      quantity,
      supplier: supplier.trim(),
      unitCost,
      notes: [notes.trim(), packagingNote].filter(Boolean).join(' | '),
      packagingType: mode === 'bulk' ? packagingType : undefined,
      packagingCount: mode === 'bulk' ? packageCount : undefined,
      packagePrice: mode === 'bulk' ? parseFloat(packagePrice) || 0 : undefined,
    };
    
    const reason = supplier 
      ? `Restock from ${supplier}${mode === 'bulk' ? ` (${packageCount} ${packagingType}s)` : ''}`
      : `Restock${mode === 'bulk' ? ` (${packageCount} ${packagingType}s)` : ''}`;
    
    onConfirm('add', quantity, reason, restockData);
  };

  const getPackagingLabel = () => {
    const option = PACKAGING_OPTIONS.find(o => o.value === packagingType);
    return option?.label || 'Package';
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
            {product.skip_stock_tracking ? (
              <span className="text-xl font-bold text-success">∞ Always Available</span>
            ) : (
              <span className={`text-xl font-bold ${
                currentStock <= (product.low_stock_threshold ?? 5)
                  ? 'text-destructive'
                  : 'text-foreground'
              }`}>{currentStock}</span>
            )}
          </div>

          {/* Mode Toggle: Pieces vs Bulk */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('pieces')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                mode === 'pieces'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Package className="w-4 h-4" />
              Pieces
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg font-medium transition-colors ${
                mode === 'bulk'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Layers className="w-4 h-4" />
              Bulk
            </button>
          </div>

          {/* PIECES MODE */}
          {mode === 'pieces' && (
            <>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Quantity (pieces)
                </label>
                <input
                  type="number"
                  value={piecesQuantity}
                  onChange={(e) => setPiecesQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Price per piece
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                  <input
                    type="number"
                    value={piecePrice}
                    onChange={(e) => setPiecePrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </>
          )}

          {/* BULK MODE */}
          {mode === 'bulk' && (
            <>
              {/* Packaging Type Selection */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Packaging Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PACKAGING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPackagingType(option.value)}
                      className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                        packagingType === option.value
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Packages */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Number of {getPackagingLabel()}s
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPackageCount(Math.max(1, packageCount - 1))}
                    className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 text-lg font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={packageCount}
                    onChange={(e) => setPackageCount(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={() => setPackageCount(packageCount + 1)}
                    className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Units per Package */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Pieces per {getPackagingLabel()}
                </label>
                <input
                  type="number"
                  value={unitsPerPackage}
                  onChange={(e) => setUnitsPerPackage(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full px-4 py-2 bg-input rounded-lg text-foreground text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Package Price */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Price per {getPackagingLabel()}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                  <input
                    type="number"
                    value={packagePrice}
                    onChange={(e) => setPackagePrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {packagePrice && parseFloat(packagePrice) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    = ₱{(parseFloat(packagePrice) / unitsPerPackage).toFixed(2)} per piece
                  </p>
                )}
              </div>

              {/* Auto-calculated Total */}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Pieces</span>
                  <span className="text-lg font-bold text-primary">
                    {packageCount} × {unitsPerPackage} = {quantity} pcs
                  </span>
                </div>
              </div>
            </>
          )}

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
              <span className="text-lg font-bold text-success">+{quantity} pieces</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New Stock</span>
              <span className="text-xl font-bold text-success">{newStock}</span>
            </div>
            {totalCost > 0 && (
              <>
                <div className="border-t border-success/20 pt-2 mt-2">
                  {mode === 'bulk' && packagePrice && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {packageCount} {getPackagingLabel()}(s) @ ₱{parseFloat(packagePrice).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="font-bold text-foreground">₱{totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </>
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