import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "@/services/mysqlApi";
import { Product, PRODUCT_CATEGORIES, ProductCategory } from "@/types/product";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Package,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
  Tag,
  Filter,
  CheckSquare,
  Square,
  Minus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "All">("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState<ProductCategory>("Other");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<ProductCategory>("Other");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<ProductCategory>("Beverages");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { toast } = useToast();

  const loadProducts = async () => {
    setIsLoading(true);
    const result = await productsApi.getAll();
    if (result.success && result.data) {
      setProducts(
        result.data.map((p) => ({
          id: String(p.id),
          name: p.name,
          price: Number(p.price),
          category: (p.category as ProductCategory) || "Other",
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};

    filteredProducts.forEach((product) => {
      const category = product.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });

    const sortedGroups: { category: string; products: Product[] }[] = [];
    PRODUCT_CATEGORIES.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups.push({ category: cat, products: groups[cat] });
      }
    });

    return sortedGroups;
  }, [filteredProducts]);

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) {
      toast({ title: "Error", description: "Please fill in all fields" });
      return;
    }

    const result = await productsApi.create({
      name: newName.trim(),
      price: parseFloat(newPrice),
      category: newCategory,
    });

    if (result.success) {
      toast({ title: "Success", description: "Product added successfully" });
      setNewName("");
      setNewPrice("");
      setNewCategory("Other");
      setShowAddForm(false);
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to add product" });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    setEditCategory(product.category || "Other");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editPrice) return;

    const result = await productsApi.update(editingId, {
      name: editName.trim(),
      price: parseFloat(editPrice),
      category: editCategory,
    });

    if (result.success) {
      toast({ title: "Success", description: "Product updated successfully" });
      setEditingId(null);
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to update product" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const result = await productsApi.delete(id);

    if (result.success) {
      toast({ title: "Success", description: "Product deleted successfully" });
      loadProducts();
    } else {
      toast({ title: "Error", description: result.error || "Failed to delete product" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditCategory("Other");
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const result = await productsApi.update(id, { category: bulkCategory });
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setIsBulkUpdating(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Updated ${successCount} product${successCount > 1 ? "s" : ""} to "${bulkCategory}"`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `Updated ${successCount} products, ${failCount} failed`,
      });
    }

    setSelectedIds(new Set());
    loadProducts();
  };

  const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredProducts.length;

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Product Management</h1>
                <p className="text-sm text-muted-foreground">
                  {products.length} products in database
                </p>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={loadProducts}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | "All")}
                className="pl-10 pr-8 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Add Product Form */}
        {showAddForm && (
          <div className="glass-panel rounded-lg p-4 mb-6 animate-fade-in">
            <h3 className="font-semibold text-foreground mb-4">Add New Product</h3>
            <div className="flex gap-4 flex-wrap">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Product name"
                className="flex-1 min-w-[200px] px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ProductCategory)}
                className="px-4 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ₱
                </span>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button onClick={handleAdd} className="gap-2">
                <Save className="w-4 h-4" />
                Save
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-lg">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">
              {searchQuery || categoryFilter !== "All" ? "No products found" : "No products in database"}
            </p>
            {!searchQuery && categoryFilter === "All" && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddForm(true)}
              >
                Add First Product
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedProducts.map(({ category, products: categoryProducts }) => (
              <div key={category} className="glass-panel rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30 border-b border-border">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">{category}</span>
                  <span className="text-sm text-muted-foreground">({categoryProducts.length})</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-12 p-4">
                        <button
                          onClick={toggleSelectAll}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : isSomeSelected ? (
                            <Minus className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        ID
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Product Name
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Price
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryProducts.map((product) => (
                      <tr
                        key={product.id}
                        className={`border-b border-border/50 transition-colors ${
                          selectedIds.has(product.id)
                            ? "bg-primary/10"
                            : "hover:bg-secondary/30"
                        }`}
                      >
                        <td className="w-12 p-4">
                          <button
                            onClick={() => toggleSelect(product.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {selectedIds.has(product.id) ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground font-mono">
                          #{product.id}
                        </td>
                        <td className="p-4">
                          {editingId === product.id ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-1 bg-input rounded text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              autoFocus
                            />
                          ) : (
                            <span className="text-foreground font-medium">{product.name}</span>
                          )}
                        </td>
                        <td className="p-4">
                          {editingId === product.id ? (
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                              className="px-3 py-1 bg-input rounded text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {PRODUCT_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {product.category || "Other"}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {editingId === product.id ? (
                            <div className="relative inline-block w-28">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                ₱
                              </span>
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                step="0.01"
                                min="0"
                                className="w-full pl-7 pr-2 py-1 bg-input rounded text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>
                          ) : (
                            <span className="font-mono text-primary font-semibold">
                              ₱{product.price.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {editingId === product.id ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                                <Save className="w-3 h-3" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(product.id, product.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-xl p-4 shadow-lg border border-primary/30 animate-slide-up flex items-center gap-4">
          <div className="flex items-center gap-2 text-foreground">
            <CheckSquare className="w-5 h-5 text-primary" />
            <span className="font-medium">{selectedIds.size} selected</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value as ProductCategory)}
              className="px-3 py-1.5 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleBulkCategoryUpdate}
              disabled={isBulkUpdating}
              className="gap-2"
            >
              {isBulkUpdating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Apply
            </Button>
          </div>
          <div className="h-6 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="w-4 h-4" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}