import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Product, PRODUCT_CATEGORIES } from "@/types/product";
import { Search, Plus, Tag, AlertTriangle, Package } from "lucide-react";
import { useGCashFunds } from "@/hooks/useGCashFunds";

interface ProductSearchProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductSelect: (product: Product) => void;
  onAddNewProduct: (name: string) => void;
  onCheckout: () => void;
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

export function ProductSearch({
  products,
  searchQuery,
  onSearchChange,
  onProductSelect,
  onAddNewProduct,
  onCheckout,
}: ProductSearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { funds: gcashFunds } = useGCashFunds();

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];
    
    // Filter products that match the search query
    return products.filter((product) =>
      product.name.toLowerCase().includes(query)
    );
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

    // Sort categories according to PRODUCT_CATEGORIES order
    const sortedGroups: { category: string; products: Product[] }[] = [];
    PRODUCT_CATEGORIES.forEach((cat) => {
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

    return sortedGroups;
  }, [filteredProducts]);

  // Flatten for keyboard navigation - includes base products and variations
  const flatProducts = useMemo(() => {
    const flat: Product[] = [];
    groupedProducts.forEach(({ products: categoryProducts }) => {
      categoryProducts.forEach((product) => {
        const variations = product.variations || [];
        // Add base product
        flat.push(product);
        // Add variations
        variations.forEach(v => {
          flat.push({
            ...product,
            id: `${product.id}-${v.id || v.name}`,
            name: product.name, // Keep base product name
            price: v.price,
            stock_quantity: v.stock_quantity,
          });
        });
      });
    });
    return flat;
  }, [groupedProducts]);

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
          if (!searchQuery) {
            onCheckout();
          } else if (showAddNew && selectedIndex === flatProducts.length) {
            onAddNewProduct(searchQuery);
          } else if (flatProducts[selectedIndex]) {
            onProductSelect(flatProducts[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onSearchChange("");
          break;
      }
    },
    [flatProducts, selectedIndex, showAddNew, searchQuery, onProductSelect, onAddNewProduct, onSearchChange, onCheckout]
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
    <div className="glass-panel rounded-lg p-6 glow-primary">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing to search products..."
          className="w-full pl-12 pr-4 py-4 bg-input rounded-lg text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {searchQuery && (
        <div
          ref={listRef}
          className="mt-4 max-h-[400px] overflow-auto space-y-4 animate-slide-up"
        >
          {groupedProducts.map(({ category, products: categoryProducts }) => (
            <div key={category}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag className="w-3 h-3" />
                {category}
              </div>
              <div className="space-y-1">
                {categoryProducts.flatMap((product) => {
                  const variations = product.variations || [];
                  
                  // Create array with base product and all variations
                  const itemsToShow = [
                    { product, isVariation: false, variation: null },
                    ...variations.map(v => {
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
                      
                      return {
                        product: { 
                          ...product, 
                          id: `${product.id}-${v.id || v.name}`,
                          name: displayName,
                          price: v.price, 
                          stock_quantity: v.stock_quantity,
                          // Use base product's image_url for variations (variations don't have their own thumbnails)
                          image_url: product.image_url
                        }, 
                        isVariation: true, 
                        variation: v 
                      };
                    })
                  ];
                  
                  return itemsToShow.map((item, itemIdx) => {
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
                        className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                          isSelected
                            ? "bg-primary/20 border border-primary/50 ring-2 ring-primary/30"
                            : "bg-secondary/50 hover:bg-secondary border border-transparent"
                        } ${itemStockStatus === 'out' ? 'opacity-60' : ''} ${item.isVariation ? 'ml-4 border-l-2 border-primary/30' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* For variations, use base product's image_url; for base product, use its own image_url */}
                          {(() => {
                            const imageUrl = item.isVariation 
                              ? product.image_url  // Variations use base product's thumbnail
                              : itemProduct.image_url; // Base product uses its own thumbnail
                            return imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={itemProduct.name}
                                className="w-10 h-10 object-cover rounded-lg"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                            );
                          })()}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{itemProduct.name}</span>
                              {item.isVariation && (
                                <span className="text-xs text-muted-foreground/70 px-1.5 py-0.5 bg-info/20 text-info rounded">
                                  Variation
                                </span>
                              )}
                            </div>
                            {/* Stock indicator - only show for products that track stock */}
                            {!itemProduct.skip_stock_tracking && (
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
                          // Check if this is GCash product
                          const isGcash = itemProduct.name.toUpperCase() === "GCASH" || itemProduct.name.toUpperCase() === "GCASH SERVICE";
                          
                          if (isGcash) {
                            return (
                              <div className="text-right">
                                <span className="text-info font-mono font-semibold block">
                                  Funds: ₱{gcashFunds.toFixed(2)}
                                </span>
                              </div>
                            );
                          }
                          
                          return (
                            <span className="text-primary font-mono font-semibold">
                              ₱{itemProduct.price.toFixed(2)}
                            </span>
                          );
                        })()}
                      </button>
                    );
                  });
                })}
              </div>
            </div>
          ))}

          {showAddNew && (
            <button
              data-index={flatProducts.length}
              onClick={() => onAddNewProduct(searchQuery)}
              className={`w-full flex items-center justify-center gap-3 p-4 rounded-lg transition-all ${
                selectedIndex === flatProducts.length
                  ? "bg-primary/20 border border-primary/50 ring-2 ring-primary/30 text-primary"
                  : "bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary"
              }`}
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add "{searchQuery}" as new product</span>
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