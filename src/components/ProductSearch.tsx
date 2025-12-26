import { useState, useEffect, useRef, useCallback } from "react";
import { Product } from "@/types/product";
import { Search, Plus, DollarSign } from "lucide-react";

interface ProductSearchProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductSelect: (product: Product) => void;
  onAddNewProduct: (name: string) => void;
}

export function ProductSearch({
  products,
  searchQuery,
  onSearchChange,
  onProductSelect,
  onAddNewProduct,
}: ProductSearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showAddNew = searchQuery.length > 0 && filteredProducts.length === 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only capture if not already focused on input
      if (document.activeElement !== inputRef.current) {
        // Alphanumeric keys trigger search
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = showAddNew ? 0 : filteredProducts.length - 1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (showAddNew) {
            onAddNewProduct(searchQuery);
          } else if (filteredProducts[selectedIndex]) {
            onProductSelect(filteredProducts[selectedIndex]);
          }
          break;
        case "Escape":
          onSearchChange("");
          break;
      }
    },
    [filteredProducts, selectedIndex, showAddNew, searchQuery, onProductSelect, onAddNewProduct, onSearchChange]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

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
          className="mt-4 max-h-[400px] overflow-auto space-y-1 animate-slide-up"
        >
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              onClick={() => onProductSelect(product)}
              className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                index === selectedIndex
                  ? "bg-primary/20 border border-primary/50"
                  : "bg-secondary/50 hover:bg-secondary border border-transparent"
              }`}
            >
              <span className="font-medium text-foreground">{product.name}</span>
              <div className="flex items-center gap-2 text-primary font-mono font-semibold">
                <DollarSign className="w-4 h-4" />
                {product.price.toFixed(2)}
              </div>
            </button>
          ))}

          {showAddNew && (
            <button
              onClick={() => onAddNewProduct(searchQuery)}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all text-primary"
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
