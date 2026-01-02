import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Product } from "@/types/product";
import { Search, Plus, Tag, AlertTriangle, Package, Layers, Smartphone } from "lucide-react";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { getAllCategories, getAllCategoriesAsync } from "@/utils/categories";
import { parseVariations } from "@/utils/variationParser";

interface ProductSearchProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductSelect: (product: Product) => void;
  onAddNewProduct: (name: string) => void;
  onAddVariation?: (product: Product) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  gcashEnabled?: boolean;
  showStockStatus?: boolean;
}

const getStockStatus = (product: Product) => {
  // Skip stock tracking products are always "ok"
  if (product.skip_stock_tracking) return 'ok';
  const stock = product.stock_quantity ?? 0;
  const threshold = product.low_stock_threshold ?? 5;
  if (stock === 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'ok';
};

function ProductSearchComponent({
  products,
  searchQuery,
  onSearchChange,
  onProductSelect,
  onAddNewProduct,
  onAddVariation,
  searchInputRef,
  gcashEnabled = false,
  showStockStatus = true,
}: ProductSearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(getAllCategories());
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || internalInputRef;
  const listRef = useRef<HTMLDivElement>(null);
  const { funds: gcashFunds } = useGCashFunds();

  // Load categories from database on mount
  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getAllCategoriesAsync();
      setCategoryOrder(categories);
    };
    loadCategories();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query || query.length < 2) return []; // Early return for empty or single character queries
    
    // Filter products that match the search query
    // Exclude parent products that have no price, BUT keep products that have variations with prices
    return products.filter((product) => {
      // Fast path: check product name first (most common case)
      const productNameLower = product.name.toLowerCase();
      const productNameMatches = productNameLower.includes(query);
      
      // If product has price and name matches, include immediately
      if (productNameMatches && product.price != null && product.price > 0) {
        return true;
      }
      
      // Parse variations using cached parser
      const variations = parseVariations(product);
      
      // Check if any variation name matches
      const variationNameMatches = variations.some((v) => {
        return v?.name?.toLowerCase().includes(query);
      });
      
      // Match if either product name or variation name matches
      const matchesQuery = productNameMatches || variationNameMatches;
      if (!matchesQuery) return false;
      
      // If product has a price, include it
      if (product.price != null && product.price > 0) {
        return true;
      }
      
      // If product has no price, check if it has variations with prices
      const hasVariationsWithPrices = variations.some((v) => v && v.price != null && v.price > 0);
      
      // Include product if it has variations with prices OR if product name matches (to allow adding variations)
      // This allows parent products without prices to show up for variation management
      return hasVariationsWithPrices || productNameMatches;
    });
  }, [products, searchQuery]);

  // Group products by category, and within category, group by name to show price variations
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    
    filteredProducts.forEach((product) => {
      const category = product.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });

    // Sort categories according to database category order
    const sortedGroups: { category: string; products: Product[] }[] = [];
    
    // First, add categories in the order they appear in categoryOrder
    categoryOrder.forEach((cat) => {
      if (groups[cat]) {
        // Sort products by name, then by price (to group same names together)
        const sorted = groups[cat].sort((a, b) => {
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) return nameCompare;
          return a.price - b.price; // Same name: sort by price
        });
        sortedGroups.push({ category: cat, products: sorted });
      }
    });
    
    // Then, add any remaining categories that aren't in the order list (alphabetically)
    Object.keys(groups).forEach((cat) => {
      if (!categoryOrder.includes(cat)) {
        const sorted = groups[cat].sort((a, b) => {
          const nameCompare = a.name.localeCompare(b.name);
          if (nameCompare !== 0) return nameCompare;
          return a.price - b.price;
        });
        sortedGroups.push({ category: cat, products: sorted });
      }
    });

    return sortedGroups;
  }, [filteredProducts, categoryOrder]);

  // Flatten for keyboard navigation - includes base products and variations
  const flatProducts = useMemo(() => {
    const flat: Product[] = [];
    
    groupedProducts.forEach(({ products: categoryProducts }) => {
      categoryProducts.forEach((product) => {
        const parentHasPrice = product.price != null && product.price > 0;
        
        // Check if this is a GCash product and add hardcoded variations if GCash is enabled
        const isGcashProduct = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
        
        // Use optimized variation parser
        let allVariations = parseVariations(product);
        
        if (isGcashProduct && gcashEnabled) {
          // Add hardcoded GCash-In and GCash-Out variations
          const gcashInVariation = {
            id: 'gcash-in-hardcoded',
            name: 'GCash-In',
            price: 0, // Price will be set when transaction is created
            stock_quantity: 0,
          };
          const gcashOutVariation = {
            id: 'gcash-out-hardcoded',
            name: 'GCash-Out',
            price: 0, // Price will be set when transaction is created
            stock_quantity: 0,
          };
          
          allVariations = [gcashInVariation, gcashOutVariation, ...allVariations];
        }
        
        // Add base product only if it has a price
        if (parentHasPrice) {
          flat.push(product);
        }
        
        // Add variations (including hardcoded GCash variations with price 0)
        allVariations.forEach(v => {
          if (v && (v.price != null && v.price > 0) || (isGcashProduct && gcashEnabled && (v.id === 'gcash-in-hardcoded' || v.id === 'gcash-out-hardcoded'))) {
            flat.push({
              ...product,
              id: `${product.id}-${v.id || v.name}`,
              name: product.name, // Keep base product name
              price: v.price || 0,
              stock_quantity: v.stock_quantity,
            });
          }
        });
      });
    });
    return flat;
  }, [groupedProducts, gcashEnabled]);

  const showAddNew = searchQuery.length > 0 && filteredProducts.length === 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  // Global keyboard listener - only when no dialogs are open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if already focused on this input
      if (document.activeElement === inputRef.current) return;
      
      // Skip if focused on any input, textarea, select, or button
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl instanceof HTMLSelectElement ||
          activeEl instanceof HTMLButtonElement) {
        return;
      }
      
      // Skip if any dialog/modal is open (check for z-50 overlay)
      if (document.querySelector('.fixed.inset-0.z-50')) {
        return;
      }
      
      // Alphanumeric keys trigger search focus
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Calculate max index: include "Add New" option if shown
      const maxIndex = showAddNew ? flatProducts.length : Math.max(0, flatProducts.length - 1);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev + 1;
            return next > maxIndex ? 0 : next; // Wrap to top
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? maxIndex : next; // Wrap to bottom
          });
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation(); // Prevent event from bubbling to global handler
          
          // Priority 1: If "Add New" is selected, add new product
          if (showAddNew && selectedIndex === flatProducts.length) {
            onAddNewProduct(searchQuery);
            return;
          }
          
          // Priority 2: If a product is selected in search results, select it
          if (flatProducts[selectedIndex]) {
            onProductSelect(flatProducts[selectedIndex]);
            return;
          }
          
          // If no search results and no selection, do nothing
          // Let the global handler in Index.tsx handle checkout
          break;
        case "Escape":
          e.preventDefault();
          onSearchChange("");
          break;
      }
    },
    [flatProducts, selectedIndex, showAddNew, searchQuery, onProductSelect, onAddNewProduct, onSearchChange]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Get flat index for a product
  const getFlatIndex = (product: Product, isVariation = false, variationId?: string) => {
    if (isVariation && variationId) {
      return flatProducts.findIndex((p) => p.id === `${product.id}-${variationId}`);
    }
    return flatProducts.findIndex((p) => p.id === product.id);
  };

  return (
    <div className="window-border bg-card p-4 w-full h-full overflow-hidden">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing to search products..."
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-300 text-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 ease-out shadow-sm"
        />
      </div>

      {searchQuery && (
        <div
          ref={listRef}
          className="mt-4 overflow-y-auto overflow-x-hidden space-y-4 animate-slide-up"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          {groupedProducts.map(({ category, products: categoryProducts }) => (
            <div key={category}>
              <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-50 border-l-4 border-primary">
                <Tag className="w-4 h-4 text-primary" />
                {category}
              </div>
              <div className="space-y-1">
                {categoryProducts.map((product) => {
                  // Use optimized variation parser
                  let parsedVariations = parseVariations(product);
                  
                  // Check if this is a GCash product and add hardcoded variations if GCash is enabled
                  const isGcashProduct = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
                  if (isGcashProduct && gcashEnabled) {
                    // Add hardcoded GCash-In and GCash-Out variations
                    const gcashInVariation = {
                      id: 'gcash-in-hardcoded',
                      name: 'GCash-In',
                      price: 0, // Price will be set when transaction is created
                      stock_quantity: 0,
                    };
                    const gcashOutVariation = {
                      id: 'gcash-out-hardcoded',
                      name: 'GCash-Out',
                      price: 0, // Price will be set when transaction is created
                      stock_quantity: 0,
                    };
                    parsedVariations = [gcashInVariation, gcashOutVariation, ...parsedVariations];
                  }
                  
                  // Check if parent product has a price
                  const parentHasPrice = product.price != null && product.price > 0;
                  
                  // Check if product can have variations (has variations already or no price)
                  const canHaveVariations = parsedVariations.length > 0 || !parentHasPrice;
                  
                  // Create array with base product (only if it has a price) and all variations
                  const itemsToShow: Array<{ product: Product; isVariation: boolean; variation: any; isHardcodedGcash?: boolean }> = [
                    // Only include base product if it has a price
                    ...(parentHasPrice ? [{ product, isVariation: false, variation: null, isHardcodedGcash: false }] : []),
                    // Include all variations (including hardcoded GCash variations with price 0)
                    ...parsedVariations.filter(v => {
                      // For hardcoded GCash variations, always include them
                      if (isGcashProduct && gcashEnabled && (v.id === 'gcash-in-hardcoded' || v.id === 'gcash-out-hardcoded')) {
                        return true;
                      }
                      // For other variations, only include if they have a price > 0
                      return v && v.price != null && v.price > 0;
                    }).map(v => {
                      // Check if variation name is auto-generated (contains price pattern)
                      // Auto-generated format: "Product Name - ₱X.XX"
                      const variationName = v.name && v.name.trim() ? v.name.trim() : '';
                      const isAutoGenerated = variationName && 
                        variationName.includes(' - ₱') && 
                        /₱\d+\.\d{2}$/.test(variationName);
                      
                      // Display format: "Product - Variation Name" if user-provided name exists
                      // Otherwise just use product name (for auto-generated or no name)
                      const displayName = variationName && !isAutoGenerated
                        ? `${product.name} - ${variationName}`
                        : product.name;
                      
                      // Check if this is a hardcoded GCash variation
                      const isHardcodedGcash = v.id === 'gcash-in-hardcoded' || v.id === 'gcash-out-hardcoded';
                      
                      return {
                        product: { 
                          ...product, 
                          id: `${product.id}-${v.id || v.name}`,
                          name: displayName,
                          price: v.price || 0, // Allow price 0 for hardcoded GCash variations
                          stock_quantity: v.stock_quantity,
                          // Use variation's image_url if available, otherwise fallback to base product's image_url
                          image_url: v.image_url || product.image_url
                        }, 
                        isVariation: true, 
                        variation: v,
                        isHardcodedGcash // Flag to identify hardcoded GCash variations
                      };
                    })
                  ];
                  
                  return (
                    <div key={product.id} className="space-y-1">
                      {/* Show parent product name if it has no price (non-selectable, for variation management only) */}
                      {!parentHasPrice && (
                        <div className="w-full flex items-center justify-between p-4 bg-muted/30 border border-muted">
                          <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-10 h-10 object-cover shrink-0"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-secondary flex items-center justify-center shrink-0">
                                <Package className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="text-left flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="font-medium text-muted-foreground line-clamp-2 break-words overflow-hidden text-ellipsis">{product.name}</span>
                                <span className="text-xs text-muted-foreground/70 px-1.5 py-0.5 bg-muted/50 rounded shrink-0 mt-0.5">
                                  Parent
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">No price - Add variation to sell</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {itemsToShow.map((item, itemIdx) => {
                    const itemProduct = item.product;
                    const itemStockStatus = getStockStatus(itemProduct);
                    const itemStock = itemProduct.stock_quantity ?? 0;
                    // Find the index in flatProducts array
                    const itemIndex = flatProducts.findIndex(p => p.id === itemProduct.id);
                    const isSelected = itemIndex >= 0 && itemIndex === selectedIndex;
                    
                    return (
                      <button
                        key={itemProduct.id}
                        data-index={itemIndex}
                        onClick={() => onProductSelect(itemProduct)}
                        className={`w-full flex items-center justify-between p-4 transition-all duration-200 ease-out ${
                          isSelected
                            ? "shadow-lg scale-[1.02] overflow-visible z-10 border-2 border-transparent"
                            : "bg-white border-2 border-transparent hover:border-primary/30 hover:bg-primary/5 hover:shadow-md active:scale-[0.98] overflow-hidden"
                        } ${itemStockStatus === 'out' && showStockStatus ? 'opacity-60' : ''} ${item.isVariation ? 'ml-4 border-l-4 border-primary/50' : ''}`}
                        style={{
                          transform: isSelected ? 'scale(1.02) translateZ(0)' : 'scale(1) translateZ(0)',
                          willChange: 'transform',
                          backgroundColor: isSelected ? 'transparent' : undefined,
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                          {/* For variations, use variation's image_url if available, otherwise base product's image_url; for base product, use its own image_url */}
                          {(() => {
                            const imageUrl = item.isVariation 
                              ? (item.variation?.image_url || product.image_url)  // Variations use their own image if available, otherwise base product's thumbnail
                              : itemProduct.image_url; // Base product uses its own thumbnail
                            return (
                              <div className="relative shrink-0 flex items-center justify-center w-12 h-12">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={itemProduct.name}
                                    className="object-cover w-12 h-12 rounded-sm"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                ) : (
                                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center w-12 h-12 rounded-sm">
                                    <Package className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="text-left flex-1 min-w-0 overflow-visible">
                            <div className="flex items-start gap-2 min-w-0">
                              <span 
                                className={`font-semibold line-clamp-2 break-words overflow-visible text-ellipsis transition-all duration-300 ease-out ${
                                  isSelected 
                                    ? 'scale-[2] text-primary font-bold' 
                                    : 'scale-100 text-gray-800'
                                }`}
                                style={{
                                  transformOrigin: 'left center',
                                  willChange: 'transform',
                                  display: 'inline-block',
                                }}
                              >
                                {itemProduct.name}
                              </span>
                              {item.isVariation && (
                                <span className={`text-xs px-2 py-1 rounded-md shrink-0 mt-0.5 transition-all duration-200 ${
                                  isSelected 
                                    ? 'bg-primary-foreground/20 text-primary-foreground font-medium' 
                                    : 'bg-blue-100 text-blue-700 font-normal'
                                }`}>
                                  Variation
                                </span>
                              )}
                            </div>
                            {/* Stock indicator - only show for products that track stock and if stock status is enabled */}
                            {showStockStatus && !itemProduct.skip_stock_tracking && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {itemStockStatus === 'out' ? (
                                  <span className="text-xs text-destructive flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Out of stock
                                  </span>
                                ) : itemStockStatus === 'low' ? (
                                  <span className="text-xs text-warning flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Low stock ({itemStock})
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {itemStock} in stock
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {(() => {
                          // Check if this is GCash product or hardcoded GCash variation
                          const isGcash = itemProduct.name.toUpperCase() === "GCASH" || itemProduct.name.toUpperCase() === "GCASH SERVICE";
                          const isHardcodedGcashVariation = item.isHardcodedGcash || 
                            itemProduct.id.includes('gcash-in-hardcoded') || 
                            itemProduct.id.includes('gcash-out-hardcoded');
                          
                          if (isGcash && !isHardcodedGcashVariation) {
                            return (
                              <div className="text-right shrink-0 ml-2">
                                <span className={`font-mono font-bold block whitespace-nowrap transition-colors duration-200 ${
                                  isSelected ? 'text-primary-foreground text-base' : 'text-blue-600 text-sm'
                                }`}>
                                  Funds: ₱{gcashFunds.toFixed(2)}
                                </span>
                              </div>
                            );
                          }
                          
                          if (isHardcodedGcashVariation) {
                            return (
                              <div className="text-right shrink-0 ml-2">
                                <span className={`font-semibold block whitespace-nowrap transition-colors duration-200 ${
                                  isSelected ? 'text-primary-foreground text-base' : 'text-blue-600 text-sm'
                                }`}>
                                  Service
                                </span>
                              </div>
                            );
                          }
                          
                          return (
                            <span className={`font-mono font-bold shrink-0 ml-2 whitespace-nowrap transition-colors duration-200 ${
                              isSelected ? 'text-primary-foreground text-lg' : 'text-gray-800 text-base'
                            }`}>
                              ₱{itemProduct.price.toFixed(2)}
                            </span>
                          );
                        })()}
                      </button>
                      );
                    })}
                    
                    {/* Add Variation Button - Show for products that can have variations */}
                    {onAddVariation && canHaveVariations && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddVariation(product);
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition-all text-sm font-medium"
                      >
                        <Layers className="w-4 h-4 shrink-0" />
                        <span className="line-clamp-2 break-words overflow-hidden text-ellipsis">Add Variation to {product.name}</span>
                      </button>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {showAddNew && (
            <button
              data-index={flatProducts.length}
              onClick={() => onAddNewProduct(searchQuery)}
              className={`w-full flex items-center justify-center gap-3 p-4 transition-all ${
                selectedIndex === flatProducts.length
                  ? "bg-primary/20 border border-primary/50 ring-2 ring-primary/30 text-primary"
                  : "bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary"
              }`}
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span className="font-medium line-clamp-2 break-words overflow-hidden text-ellipsis">Add "{searchQuery}" as new product</span>
            </button>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="mt-6 text-center text-muted-foreground">
          <p className="text-lg">Start typing anywhere to search</p>
          <p className="text-sm mt-2">Use ↑↓ to navigate, Enter to select</p>
        </div>
      )}
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export const ProductSearch = React.memo(ProductSearchComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  // Only re-render if these props actually change
  return (
    prevProps.products === nextProps.products &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.gcashEnabled === nextProps.gcashEnabled &&
    prevProps.showStockStatus === nextProps.showStockStatus &&
    prevProps.onProductSelect === nextProps.onProductSelect &&
    prevProps.onSearchChange === nextProps.onSearchChange &&
    prevProps.onAddNewProduct === nextProps.onAddNewProduct &&
    prevProps.onAddVariation === nextProps.onAddVariation
  );
});