import { useState, useEffect, useRef } from "react";
import { X, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllCategories, getAllCategoriesAsync } from "@/utils/categories";
import { categoriesApi } from "@/services/mysqlApi";

interface AddProductDialogProps {
  productName: string;
  onConfirm: (name: string, price: number | undefined, category?: string, stockQuantity?: number) => void;
  onCancel: () => void;
}

export function AddProductDialog({ productName, onConfirm, onCancel }: AddProductDialogProps) {
  const [name, setName] = useState(productName);
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [allCategories, setAllCategories] = useState<string[]>(getAllCategories());
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load categories from database on mount
  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getAllCategoriesAsync();
      setAllCategories(categories);
      // Set default category if available
      if (categories.length > 0 && !categories.includes(category)) {
        setCategory(categories[0] || "Other");
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    setName(productName);
    setPrice("");
    setStockQuantity("");
    // Set category to first available or "Other"
    if (allCategories.length > 0) {
      setCategory(allCategories[0]);
    } else {
      setCategory("Other");
    }
    setShowNewCategory(false);
    setNewCategory("");
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [productName, allCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = price.trim() ? parseFloat(price) : undefined;
    const numericStock = stockQuantity ? parseInt(stockQuantity) : 0;
    const finalCategory = showNewCategory && newCategory.trim() ? newCategory.trim() : category;
    
    if (name.trim()) {
      onConfirm(name.trim(), numericPrice, finalCategory, numericStock);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle escape on the container level
    if (e.key === "Escape" && e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div
        className="glass-panel rounded-xl p-4 sm:p-6 w-full max-w-xl max-h-[95vh] overflow-y-auto animate-scale-in flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <Package className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">New Product</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Product Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Category
            </label>
            {showNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter new category"
                  className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCategory.trim()) {
                      const newCat = newCategory.trim();
                      // Create category in database
                      categoriesApi.create({
                        name: newCat,
                        parent_id: null,
                        is_parent: false,
                        display_order: 999,
                      }).then(async () => {
                        const updatedCategories = await getAllCategoriesAsync();
                        setAllCategories(updatedCategories);
                        setCategory(newCat);
                        setShowNewCategory(false);
                        setNewCategory("");
                      }).catch((error) => {
                        console.error("Error creating category:", error);
                        // Still update UI even if API call fails
                        setCategory(newCat);
                        setShowNewCategory(false);
                        setNewCategory("");
                      });
                    } else if (e.key === "Escape") {
                      setShowNewCategory(false);
                      setNewCategory("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (newCategory.trim()) {
                      const newCat = newCategory.trim();
                      // Create category in database
                      categoriesApi.create({
                        name: newCat,
                        parent_id: null,
                        is_parent: false,
                        display_order: 999,
                      }).then(async () => {
                        const updatedCategories = await getAllCategoriesAsync();
                        setAllCategories(updatedCategories);
                        setCategory(newCat);
                        setShowNewCategory(false);
                        setNewCategory("");
                      }).catch((error) => {
                        console.error("Error creating category:", error);
                        // Still update UI even if API call fails
                        setCategory(newCat);
                        setShowNewCategory(false);
                        setNewCategory("");
                      });
                    }
                  }}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategory("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCategory(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                SRP (Selling Price) <span className="text-xs text-muted-foreground/70">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                  ₱
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      onCancel();
                    }
                  }}
                  className="w-full pl-7 pr-3 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.00 (optional)"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Initial Stock
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onCancel();
                  }
                }}
                className="w-full px-3 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 glow-primary"
              disabled={!name.trim()}
            >
              Add Product
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}