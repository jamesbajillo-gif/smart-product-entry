import { useState, useEffect, useMemo } from "react";
import { Product, ProductVariation } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Package, Truck, Box, Layers, Wallet, Banknote, Smartphone, Receipt, Plus } from "lucide-react";
import { PaymentSource } from "@/hooks/useAvailableFunds";
import { expensesApi } from "@/services/mysqlApi";

export interface RestockData {
  quantity: number;
  supplier: string;
  unitCost: number;
  notes: string;
  packagingType?: string;
  packagingCount?: number;
  packagePrice?: number;
  bottleDeposit?: number;
  paymentSource?: PaymentSource;
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
  availableFunds?: { cash: number; storeFunds: number; gcash: number; currentSales: number };
  onConfirm: (variationId: string | null, type: 'add' | 'remove' | 'set', quantity: number, reason: string, restockData?: RestockData) => void;
  onCancel: () => void;
}

export function StockAdjustmentDialog({
  product,
  availableFunds,
  onConfirm,
  onCancel,
}: StockAdjustmentDialogProps) {
  // Check if product is "Ice Tube" (case-insensitive) - skip variation selection
  const isIceTube = product.name.toLowerCase().trim() === 'ice tube';
  
  // Check if product is "Redhorse Mucho" (case-insensitive) - force case packaging with 6 pieces
  const isRedhorseMucho = product.name.toLowerCase().trim() === 'redhorse mucho';
  
  // Parse variations
  const variations: ProductVariation[] = useMemo(() => {
    if (!product.variations) return [];
    if (Array.isArray(product.variations)) {
      return product.variations.filter((v): v is ProductVariation => 
        v !== null && typeof v === 'object' && 'id' in v && typeof v.id === 'string' && typeof v.price === 'number'
      );
    }
    if (typeof product.variations === 'string') {
      const variationsStr: string = product.variations;
      if (variationsStr.trim() === '' || variationsStr === 'null' || variationsStr === 'undefined') {
        return [];
      }
      try {
        const parsed = JSON.parse(variationsStr);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is ProductVariation => 
            v !== null && typeof v === 'object' && 'id' in v && typeof v.id === 'string' && typeof v.price === 'number'
          );
        }
      } catch {
        return [];
      }
    }
    return [];
  }, [product.variations]);

  // Selected variation (null = base product)
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  
  // Get the selected variation or base product for stock display
  const selectedProduct = useMemo(() => {
    if (selectedVariationId) {
      const variation = variations.find(v => v.id === selectedVariationId);
      if (variation) {
        return {
          ...product,
          price: variation.price,
          stock_quantity: variation.stock_quantity ?? 0,
        };
      }
    }
    return product;
  }, [selectedVariationId, variations, product]);

  // Check if product is in Cigarettes category (case-insensitive)
  const isCigarettes = product.category?.toLowerCase().trim() === 'cigarettes';
  
  // Check if product is in Beverages category (case-insensitive)
  const isBeverages = product.category?.toLowerCase().trim() === 'beverages';
  
  // For cigarettes, force bulk mode with pack type and 20 units per pack
  // For Redhorse Mucho, force bulk mode with case type and 6 units per case
  // For beverages, default to bulk mode with case type, but allow switching to pieces
  const [mode, setMode] = useState<RestockMode>((isCigarettes || isRedhorseMucho || isBeverages) ? 'bulk' : 'pieces');
  const [packagingType, setPackagingType] = useState<PackagingType>(
    isCigarettes ? 'pack' : (isRedhorseMucho ? 'case' : (isBeverages ? 'case' : 'case'))
  );
  const [packageCount, setPackageCount] = useState(1);
  
  // Get remembered pieces per case for beverages from localStorage
  const getRememberedPiecesPerCase = (): number => {
    if (isBeverages) {
      const key = `beverages_pieces_per_case_${product.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return 12; // Default for beverages
  };
  
  const [unitsPerPackage, setUnitsPerPackage] = useState(
    isCigarettes ? 20 : (isRedhorseMucho ? 6 : (isBeverages ? getRememberedPiecesPerCase() : 12))
  );
  
  // Save pieces per case to localStorage when changed for beverages
  useEffect(() => {
    if (isBeverages && unitsPerPackage > 0) {
      const key = `beverages_pieces_per_case_${product.id}`;
      localStorage.setItem(key, unitsPerPackage.toString());
    }
  }, [isBeverages, unitsPerPackage, product.id]);
  
  // Get remembered bottle deposit for beverages from localStorage
  const getRememberedBottleDeposit = (): number => {
    if (isBeverages) {
      const key = `beverages_bottle_deposit_${product.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }
    return 10; // Default bottle deposit for beverages
  };
  
  // Get remembered bottle deposit enabled state for beverages from localStorage
  const getRememberedBottleDepositEnabled = (): boolean => {
    if (isBeverages) {
      const key = `beverages_bottle_deposit_enabled_${product.id}`;
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return true; // Default: enabled for beverages
  };
  
  const [bottleDeposit, setBottleDeposit] = useState(
    isBeverages ? getRememberedBottleDeposit() : 0
  );
  
  const [bottleDepositEnabled, setBottleDepositEnabled] = useState(
    isBeverages ? getRememberedBottleDepositEnabled() : false
  );

  // Payment source selection
  const [paymentSource, setPaymentSource] = useState<PaymentSource>("cash");
  
  // Save bottle deposit to localStorage when changed for beverages
  useEffect(() => {
    if (isBeverages && bottleDeposit >= 0) {
      const key = `beverages_bottle_deposit_${product.id}`;
      localStorage.setItem(key, bottleDeposit.toString());
    }
  }, [isBeverages, bottleDeposit, product.id]);
  
  // Save bottle deposit enabled state to localStorage when changed for beverages
  useEffect(() => {
    if (isBeverages) {
      const key = `beverages_bottle_deposit_enabled_${product.id}`;
      localStorage.setItem(key, bottleDepositEnabled.toString());
    }
  }, [isBeverages, bottleDepositEnabled, product.id]);
  
  const [packagePrice, setPackagePrice] = useState("");
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [piecePrice, setPiecePrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  
  // Load suppliers when dialog opens
  useEffect(() => {
    const loadSuppliers = async () => {
      setIsLoadingSuppliers(true);
      try {
        const result = await expensesApi.getSuppliers();
        if (result.success && result.data) {
          setSuppliers(result.data);
        }
      } catch (error) {
        console.error("Error loading suppliers:", error);
      } finally {
        setIsLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, []);
  
  // Force cigarettes to use bulk mode with pack and 20 units
  // Force Redhorse Mucho to use bulk mode with case and 6 units
  // Beverages default to bulk mode with case, but can be changed
  useEffect(() => {
    if (isCigarettes) {
      setMode('bulk');
      setPackagingType('pack');
      setUnitsPerPackage(20);
    } else if (isRedhorseMucho) {
      setMode('bulk');
      setPackagingType('case');
      setUnitsPerPackage(6);
    } else if (isBeverages) {
      // Beverages default to bulk mode with case, but user can switch to pieces
      if (mode === 'bulk') {
        setPackagingType('case');
        // Don't override if already set from remembered value
        // The initial state already uses getRememberedPiecesPerCase()
      }
    }
  }, [isCigarettes, isRedhorseMucho, isBeverages, mode]);

  // Calculate totals based on mode
  const quantity = mode === 'bulk' 
    ? packageCount * unitsPerPackage 
    : piecesQuantity;
  
  const unitCost = mode === 'bulk' && packagePrice
    ? parseFloat(packagePrice) / unitsPerPackage
    : parseFloat(piecePrice) || 0;
  
  const baseCost = mode === 'bulk' && packagePrice
    ? packageCount * parseFloat(packagePrice)
    : piecesQuantity * (parseFloat(piecePrice) || 0);
  
  // Add bottle deposit for beverages (per case in bulk mode, per piece in pieces mode)
  // Only if bottle deposit is enabled
  const bottleDepositTotal = isBeverages && bottleDepositEnabled && bottleDeposit > 0
    ? (mode === 'bulk' 
        ? packageCount * bottleDeposit 
        : piecesQuantity * bottleDeposit)
    : 0;
  
  const totalCost = baseCost + bottleDepositTotal;

  const currentStock = selectedProduct.stock_quantity ?? 0;
  const newStock = currentStock + quantity;

  const handleSubmit = () => {
    if (quantity <= 0) return;
    
    const packagingNote = mode === 'bulk'
      ? `${packageCount} ${packagingType}(s) × ${unitsPerPackage} = ${quantity} pcs`
      : '';
    
    const bottleDepositNote = isBeverages && bottleDepositEnabled && bottleDeposit > 0
      ? `Bottle Deposit: ₱${bottleDepositTotal.toFixed(2)} (${mode === 'bulk' ? `${packageCount} case(s) × ₱${bottleDeposit.toFixed(2)}` : `${piecesQuantity} piece(s) × ₱${bottleDeposit.toFixed(2)}`})`
      : '';
    
    const restockData: RestockData = {
      quantity,
      supplier: supplier.trim(),
      unitCost,
      notes: [notes.trim(), packagingNote, bottleDepositNote].filter(Boolean).join(' | '),
      packagingType: mode === 'bulk' ? packagingType : undefined,
      packagingCount: mode === 'bulk' ? packageCount : undefined,
      packagePrice: mode === 'bulk' ? parseFloat(packagePrice) || 0 : undefined,
      bottleDeposit: isBeverages ? bottleDeposit : undefined,
      paymentSource,
    };
    
    const selectedSupplier = showNewSupplier ? newSupplier.trim() : supplier;
    const reason = selectedSupplier 
      ? `Restock from ${selectedSupplier}${mode === 'bulk' ? ` (${packageCount} ${packagingType}s)` : ''}`
      : `Restock${mode === 'bulk' ? ` (${packageCount} ${packagingType}s)` : ''}`;
    
    // Update restockData with selected supplier
    restockData.supplier = selectedSupplier;
    
    onConfirm(selectedVariationId, 'add', quantity, reason, restockData);
  };

  const getPackagingLabel = () => {
    const option = PACKAGING_OPTIONS.find(o => o.value === packagingType);
    return option?.label || 'Package';
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel p-4 sm:p-6 w-full h-full max-w-2xl animate-scale-in max-h-screen overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/20">
              <Truck className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">Restock Product</h2>
              {/* Variation selection dropdown - only show if not Ice Tube and has variations */}
              {!isIceTube && variations.length > 0 ? (
                <select
                  value={selectedVariationId === null ? "base" : (selectedVariationId || "")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedVariationId(value === "base" ? null : value);
                  }}
                  className="mt-1 w-full px-3 py-1.5 text-sm bg-input text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="base">
                    {product.name}
                  </option>
                  {variations.map((variation) => {
                    const variationName = typeof variation.name === 'string' ? variation.name : '';
                    const isAutoGenerated = variationName && 
                      variationName.includes(' - ₱') && 
                      /₱\d+\.\d{2}$/.test(variationName);
                    const finalDisplayName = variationName && !isAutoGenerated
                      ? `${product.name} - ${variationName.trim()}`
                      : product.name;
                    
                    return (
                      <option key={variation.id} value={variation.id}>
                        {finalDisplayName}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">{product.name}</p>
              )}
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
            {selectedProduct.skip_stock_tracking ? (
              <span className="text-xl font-bold text-success">∞ Always Available</span>
            ) : (
              <span className={`text-xl font-bold ${
                currentStock <= (selectedProduct.low_stock_threshold ?? 5)
                  ? 'text-destructive'
                  : 'text-foreground'
              }`}>{currentStock}</span>
            )}
          </div>

          {/* Mode Toggle: Pieces vs Bulk/Case */}
          {!isCigarettes && !isRedhorseMucho && (
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
                {isBeverages ? 'Case' : 'Bulk'}
              </button>
            </div>
          )}

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
              {/* Packaging Type Selection - Hidden for cigarettes, Redhorse Mucho, and beverages (beverages only use case) */}
              {!isCigarettes && !isRedhorseMucho && !isBeverages && (
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
              )}

              {/* Number of Packages */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Number of {isBeverages ? 'Cases' : `${getPackagingLabel()}s`}
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

              {/* Units per Package - Hidden for cigarettes and Redhorse Mucho, shown for beverages and others */}
              {!isCigarettes && !isRedhorseMucho && (
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">
                    Pieces per {isBeverages ? 'Case' : getPackagingLabel()}
                  </label>
                  <input
                    type="number"
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full px-4 py-2 bg-input rounded-lg text-foreground text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {isBeverages && (
                    <p className="text-xs text-muted-foreground mt-1">
                      This value will be remembered for this product
                    </p>
                  )}
                </div>
              )}

              {/* Package Price */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Price per {isCigarettes ? 'Pack' : (isRedhorseMucho || isBeverages ? 'Case' : getPackagingLabel())}
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

              {/* Bottle Deposit - Only for beverages */}
              {isBeverages && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="bottle-deposit-enabled"
                      checked={bottleDepositEnabled}
                      onChange={(e) => setBottleDepositEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
                    />
                    <label htmlFor="bottle-deposit-enabled" className="text-sm font-medium text-foreground cursor-pointer">
                      Include Bottle Deposit
                    </label>
                  </div>
                  
                  {bottleDepositEnabled && (
                    <>
                      <label className="text-sm text-muted-foreground block mb-2">
                        Bottle Deposit per {mode === 'bulk' ? 'Case' : 'Piece'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                        <input
                          type="number"
                          value={bottleDeposit}
                          onChange={(e) => setBottleDeposit(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="10.00"
                          step="0.01"
                          min="0"
                          className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Default: ₱10.00 • This value will be remembered for this product
                      </p>
                      {bottleDepositTotal > 0 && (
                        <p className="text-xs text-info font-medium mt-1">
                          Total Bottle Deposit: ₱{bottleDepositTotal.toFixed(2)} ({mode === 'bulk' ? `${packageCount} case(s)` : `${piecesQuantity} piece(s)`})
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

            </>
          )}

          {/* Supplier Selection */}
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              Supplier
            </label>
            {showNewSupplier ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="Enter new supplier name"
                  className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewSupplier(false);
                    setNewSupplier("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  disabled={isLoadingSuppliers}
                  className="flex-1 px-4 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewSupplier(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>
            )}
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

          {/* Summary - Only show Total Cost if entered */}
          {totalCost > 0 && (
            <div className="space-y-2 p-3 bg-success/10 rounded-lg border border-success/20">
              {mode === 'bulk' && packagePrice && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {packageCount} {getPackagingLabel()}(s) @ ₱{parseFloat(packagePrice).toFixed(2)}
                  </span>
                </div>
              )}
              {isBeverages && bottleDepositEnabled && bottleDepositTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Bottle Deposit: {mode === 'bulk' ? `${packageCount} case(s)` : `${piecesQuantity} piece(s)`} × ₱{bottleDeposit.toFixed(2)}
                  </span>
                  <span className="text-info font-medium">₱{bottleDepositTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-bold text-foreground">₱{totalCost.toFixed(2)}</span>
              </div>
            </div>
          )}

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