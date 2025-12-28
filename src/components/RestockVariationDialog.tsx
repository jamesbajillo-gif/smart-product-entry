import { useState, useEffect, useMemo } from "react";
import { Product, ProductVariation } from "@/types/product";
import { Button } from "@/components/ui/button";
import { X, Package, Truck, Box, Layers } from "lucide-react";
import { StockAdjustmentDialog, RestockData } from "./StockAdjustmentDialog";

export interface RestockVariationDialogProps {
  product: Product;
  onConfirm: (variationId: string | null, type: 'add' | 'remove' | 'set', quantity: number, reason: string, restockData?: RestockData) => void;
  onCancel: () => void;
}

export function RestockVariationDialog({
  product,
  onConfirm,
  onCancel,
}: RestockVariationDialogProps) {
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  // Always start with variation selection dialog (except Ice Tube which will auto-trigger)
  const [showStockDialog, setShowStockDialog] = useState(false);
  
  // Log initial render
  useEffect(() => {
    console.log('RestockVariationDialog initial render:', {
      productName: product.name,
      productCategory: product.category,
      hasVariations: !!product.variations,
      showStockDialogInitial: false
    });
  }, []);

  // Parse variations - use useMemo to ensure it's computed correctly
  const variations: ProductVariation[] = useMemo(() => {
    console.log('RestockVariationDialog: Parsing variations for', product.name, {
      hasVariations: !!product.variations,
      variationsType: typeof product.variations,
      variationsValue: product.variations,
      productKeys: Object.keys(product)
    });
    
    // Check if variations property exists
    if (product.variations === undefined || product.variations === null) {
      console.log('RestockVariationDialog: No variations property found (undefined/null)');
      return [];
    }
    
    // If it's already an array, return it
    if (Array.isArray(product.variations)) {
      console.log('RestockVariationDialog: Variations is already an array', product.variations.length);
      // Validate array structure
      const validVariations = product.variations.filter(v => 
        v && typeof v === 'object' && v.id && typeof v.price === 'number'
      );
      if (validVariations.length !== product.variations.length) {
        console.warn('RestockVariationDialog: Some variations are invalid', {
          total: product.variations.length,
          valid: validVariations.length
        });
      }
      return validVariations;
    }
    
    // If it's a string, try to parse it
    if (typeof product.variations === 'string') {
      const variationsStr = product.variations as string;
      // Check if it's an empty string
      if (variationsStr.trim() === '' || variationsStr === 'null' || variationsStr === 'undefined') {
        console.log('RestockVariationDialog: Variations string is empty or null');
        return [];
      }
      
      try {
        const parsed = JSON.parse(variationsStr);
        console.log('RestockVariationDialog: Parsed from string', parsed);
        if (Array.isArray(parsed)) {
          // Validate array structure
          const validVariations = parsed.filter((v: unknown) => 
            v && typeof v === 'object' && (v as ProductVariation).id && typeof (v as ProductVariation).price === 'number'
          );
          return validVariations;
        }
        console.warn('RestockVariationDialog: Parsed value is not an array', parsed);
        return [];
      } catch (e) {
        console.error('RestockVariationDialog: Failed to parse JSON', e, 'String was:', variationsStr.substring(0, 100));
        return [];
      }
    }
    
    console.warn('RestockVariationDialog: Unexpected variations type', typeof product.variations, product.variations);
    return [];
  }, [product.variations, product.name]);
  
  console.log('RestockVariationDialog: Final variations', {
    productName: product.name,
    variationsCount: variations.length,
    variations
  });

  // Check if product is "Ice Tube" (case-insensitive)
  const isIceTube = product.name.toLowerCase().trim() === 'ice tube';

  // For Ice Tube, skip variation selection and go directly to stock dialog
  // IMPORTANT: Only set showStockDialog to true for Ice Tube, never for other products
  useEffect(() => {
    console.log('RestockVariationDialog useEffect - isIceTube check:', {
      isIceTube,
      productName: product.name,
      currentShowStockDialog: showStockDialog
    });
    
    if (isIceTube) {
      console.log('Ice Tube detected, auto-proceeding to stock dialog');
      setSelectedVariation(null);
      setShowStockDialog(true);
    } else {
      // CRITICAL: Always ensure showStockDialog is false for non-Ice Tube products
      // This prevents auto-showing the stock dialog
      if (showStockDialog) {
        console.warn('showStockDialog was unexpectedly true for non-Ice Tube product, resetting');
      }
      setShowStockDialog(false);
    }
  }, [isIceTube, product.name]);

  // Show variation dropdown if not Ice Tube (even if no variations, show base product option)
  const shouldShowVariationSelection = !isIceTube;
  
  // Debug: Log variations
  useEffect(() => {
    console.log('RestockVariationDialog rendered:', {
      productName: product.name,
      isIceTube,
      variationsCount: variations.length,
      variations,
      shouldShowVariationSelection,
      productVariations: product.variations
    });
  }, [product.name, isIceTube, variations.length, shouldShowVariationSelection]);

  const handleVariationSelect = (variationId: string | null) => {
    setSelectedVariation(variationId);
    setShowStockDialog(true);
  };

  const handleStockConfirm = (
    _variationId: string | null,
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    restockData?: RestockData
  ) => {
    onConfirm(selectedVariation, type, quantity, reason, restockData);
  };

  // Create a product object for the selected variation or base product
  const getProductForStockDialog = (): Product => {
    if (selectedVariation) {
      const variation = variations.find(v => v.id === selectedVariation);
      if (variation) {
        return {
          ...product,
          id: `${product.id}-${variation.id}`,
          name: variation.name && variation.name.trim() 
            ? `${product.name} - ${variation.name.trim()}`
            : product.name,
          price: variation.price,
          stock_quantity: variation.stock_quantity ?? 0,
          category: product.category, // Preserve category for cigarettes check
        };
      }
    }
    return product;
  };

  // Debug: Log when dialog state changes
  useEffect(() => {
    console.log('RestockVariationDialog state:', {
      showStockDialog,
      selectedVariation,
      shouldShowVariationSelection,
      isIceTube,
      variationsCount: variations.length
    });
  }, [showStockDialog, selectedVariation, shouldShowVariationSelection, isIceTube, variations.length]);

  // Only show stock dialog if explicitly triggered:
  // 1. Ice Tube (auto-triggered via useEffect), OR  
  // 2. User clicked "Continue to Restock" button (which calls handleVariationSelect)
  // For non-Ice Tube products, selectedVariation will be null (base) or a variation ID after user clicks Continue
  // If showStockDialog is true but it's not Ice Tube and selectedVariation is still undefined, reset it
  if (showStockDialog) {
    if (!isIceTube && selectedVariation === undefined) {
      // This shouldn't happen - showStockDialog is true but no selection was made
      console.error('ERROR: showStockDialog is true but selectedVariation is undefined for non-Ice Tube product. Resetting.');
      setShowStockDialog(false);
      // Fall through to render variation dialog below
    } else {
      // Valid case: either Ice Tube OR user made a selection
      console.log('Showing StockAdjustmentDialog - triggered by:', isIceTube ? 'Ice Tube auto-trigger' : 'user clicked Continue');
      return (
        <StockAdjustmentDialog
          product={getProductForStockDialog()}
          onConfirm={handleStockConfirm}
          onCancel={() => {
            console.log('StockAdjustmentDialog cancelled, going back to variation selection');
            setShowStockDialog(false);
            if (!isIceTube) {
              setSelectedVariation(null);
            }
          }}
        />
      );
    }
  }

  console.log('Rendering RestockVariationDialog with dropdown');
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-2xl mx-4 animate-scale-in">
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
          {/* Debug Info - Remove this in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="p-2 bg-secondary/30 rounded text-xs font-mono">
              <p><strong>Debug Info:</strong></p>
              <p>Product: {product.name}</p>
              <p>Has variations prop: {product.variations ? 'Yes' : 'No'}</p>
              <p>Variations type: {typeof product.variations}</p>
              <p>Variations count: {variations.length}</p>
              <p>Is Ice Tube: {isIceTube ? 'Yes' : 'No'}</p>
              <p>Should show selection: {shouldShowVariationSelection ? 'Yes' : 'No'}</p>
              {product.variations && (
                <p>Raw variations: {JSON.stringify(product.variations).substring(0, 100)}...</p>
              )}
            </div>
          )}
          
          <div>
            <label className="text-sm text-muted-foreground block mb-2">
              {shouldShowVariationSelection 
                ? (variations.length > 0 ? "Select Variation to Restock" : "Select Product to Restock")
                : "Restock Product"}
            </label>
            
            {shouldShowVariationSelection ? (
              <>
                <select
                  value={selectedVariation === null ? "base" : (selectedVariation || "")}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log('Dropdown changed:', value);
                    if (value === "base") {
                      setSelectedVariation(null);
                    } else if (value) {
                      setSelectedVariation(value);
                    }
                  }}
                  className="w-full px-4 py-3 bg-input rounded-lg text-foreground border-2 border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                >
                  <option value="base">
                    {product.name} (Base) - ₱{product.price.toFixed(2)} • Stock: {product.stock_quantity ?? 0}
                  </option>
                  {variations.length > 0 ? (
                    variations.map((variation) => {
                      const displayName = variation.name && variation.name.trim()
                        ? `${product.name} - ${variation.name.trim()}`
                        : product.name;
                      const isAutoGenerated = variation.name && 
                        variation.name.includes(' - ₱') && 
                        /₱\d+\.\d{2}$/.test(variation.name);
                      const finalDisplayName = variation.name && !isAutoGenerated
                        ? `${product.name} - ${variation.name.trim()}`
                        : product.name;
                      
                      return (
                        <option key={variation.id} value={variation.id}>
                          {finalDisplayName} - ₱{variation.price.toFixed(2)} • Stock: {variation.stock_quantity ?? 0}
                        </option>
                      );
                    })
                  ) : (
                    <option disabled value="">No variations available (only base product)</option>
                  )}
                </select>
                <Button
                  onClick={() => {
                    console.log('Continue button clicked, selectedVariation:', selectedVariation);
                    handleVariationSelect(selectedVariation);
                  }}
                  className="w-full mt-3 bg-primary hover:bg-primary/90"
                >
                  Continue to Restock
                </Button>
              </>
            ) : (
              <>
                <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Base Product • Stock: {product.stock_quantity ?? 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">₱{product.price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleVariationSelect(null)}
                  className="w-full mt-3 bg-primary hover:bg-primary/90"
                >
                  Continue to Restock
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

