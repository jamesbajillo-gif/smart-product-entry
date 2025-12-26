import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { productsApi, stockApi } from "@/services/mysqlApi";
import { Product, PRODUCT_CATEGORIES, ProductCategory } from "@/types/product";
import { Button } from "@/components/ui/button";
import { StockAdjustmentDialog } from "@/components/StockAdjustmentDialog";
import { StockHistoryDialog } from "@/components/StockHistoryDialog";
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
  Image,
  AlertTriangle,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "All">("All");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState<ProductCategory>("Other");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editStockQuantity, setEditStockQuantity] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<ProductCategory>("Other");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newStockQuantity, setNewStockQuantity] = useState("0");
  const [newLowStockThreshold, setNewLowStockThreshold] = useState("5");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<ProductCategory>("Beverages");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);
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
          image_url: p.image_url || undefined,
          stock_quantity: p.stock_quantity ?? 0,
          low_stock_threshold: p.low_stock_threshold ?? 5,
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const lowStockCount = useMemo(() => {
    return products.filter(p => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5)).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      const matchesLowStock = !showLowStockOnly || (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5);
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchQuery, categoryFilter, showLowStockOnly]);

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
      image_url: newImageUrl.trim() || undefined,
      stock_quantity: parseInt(newStockQuantity) || 0,
      low_stock_threshold: parseInt(newLowStockThreshold) || 5,
    });

    if (result.success) {
      toast({ title: "Success", description: "Product added successfully" });
      setNewName("");
      setNewPrice("");
      setNewCategory("Other");
      setNewImageUrl("");
      setNewStockQuantity("0");
      setNewLowStockThreshold("5");
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
    setEditImageUrl(product.image_url || "");
    setEditStockQuantity((product.stock_quantity ?? 0).toString());
    setEditLowStockThreshold((product.low_stock_threshold ?? 5).toString());
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editPrice) return;

    const result = await productsApi.update(editingId, {
      name: editName.trim(),
      price: parseFloat(editPrice),
      category: editCategory,
      image_url: editImageUrl.trim() || undefined,
      stock_quantity: parseInt(editStockQuantity) || 0,
      low_stock_threshold: parseInt(editLowStockThreshold) || 5,
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
    setEditImageUrl("");
    setEditStockQuantity("");
    setEditLowStockThreshold("");
  };

  // Quick stock adjustment (+1 or -1)
  const handleQuickStockAdjust = async (product: Product, delta: number) => {
    const currentStock = product.stock_quantity ?? 0;
    const newStock = Math.max(0, currentStock + delta);
    
    const result = await stockApi.adjustStock(
      product.id,
      delta > 0 ? 'add' : 'remove',
      Math.abs(delta),
      currentStock,
      'Quick adjustment'
    );

    if (result.success) {
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === product.id ? { ...p, stock_quantity: newStock } : p
      ));
    } else {
      toast({ title: "Error", description: "Failed to adjust stock" });
    }
  };

  // Full stock adjustment from dialog
  const handleStockAdjustConfirm = async (
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string
  ) => {
    if (!stockAdjustProduct) return;

    const currentStock = stockAdjustProduct.stock_quantity ?? 0;
    const result = await stockApi.adjustStock(
      stockAdjustProduct.id,
      type,
      quantity,
      currentStock,
      reason
    );

    if (result.success) {
      toast({ title: "Success", description: "Stock adjusted successfully" });
      loadProducts();
    } else {
      toast({ title: "Error", description: "Failed to adjust stock" });
    }
    setStockAdjustProduct(null);
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

  const getStockColor = (product: Product) => {
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    if (stock === 0) return "text-destructive";
    if (stock <= threshold) return "text-warning";
    return "text-success";
  };

  const getStockBg = (product: Product) => {
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    if (stock === 0) return "bg-destructive/10";
    if (stock <= threshold) return "bg-warning/10";
    return "bg-success/10";
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-6xl mx-auto">
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
            {lowStockCount > 0 && (
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  showLowStockOnly
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {lowStockCount} Low Stock
              </button>
            )}
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
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Product name"
                className="px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
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
              <div className="relative">
                <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Image URL (optional)"
                  className="w-full pl-10 pr-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Stock</label>
                  <input
                    type="number"
                    value={newStockQuantity}
                    onChange={(e) => setNewStockQuantity(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Low Alert</label>
                  <input
                    type="number"
                    value={newLowStockThreshold}
                    onChange={(e) => setNewLowStockThreshold(e.target.value)}
                    placeholder="5"
                    min="0"
                    className="w-full px-4 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <Button onClick={handleAdd} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {newImageUrl && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Preview:</span>
                <img
                  src={newImageUrl}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-border"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
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
              {searchQuery || categoryFilter !== "All" || showLowStockOnly
                ? "No products found"
                : "No products in database"}
            </p>
            {!searchQuery && categoryFilter === "All" && !showLowStockOnly && (
              <Button variant="outline" className="mt-4" onClick={() => setShowAddForm(true)}>
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
                <div className="overflow-x-auto">
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
                        <th className="w-16 p-4 text-left text-sm font-medium text-muted-foreground">
                          Image
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
                        <th className="text-center p-4 text-sm font-medium text-muted-foreground">
                          Stock
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
                          <td className="w-16 p-4">
                            {editingId === product.id ? (
                              <input
                                type="url"
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                placeholder="Image URL"
                                className="w-full px-2 py-1 bg-input rounded text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            ) : product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-lg border border-border"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            {!product.image_url && editingId !== product.id && (
                              <div className="w-12 h-12 bg-secondary/30 rounded-lg flex items-center justify-center">
                                <Image className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                            )}
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
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              {editingId === product.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={editStockQuantity}
                                    onChange={(e) => setEditStockQuantity(e.target.value)}
                                    min="0"
                                    className="w-16 px-2 py-1 bg-input rounded text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Stock"
                                  />
                                  <input
                                    type="number"
                                    value={editLowStockThreshold}
                                    onChange={(e) => setEditLowStockThreshold(e.target.value)}
                                    min="0"
                                    className="w-16 px-2 py-1 bg-input rounded text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="Alert"
                                    title="Low stock threshold"
                                  />
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleQuickStockAdjust(product, -1)}
                                    className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                                    disabled={(product.stock_quantity ?? 0) === 0}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setStockAdjustProduct(product)}
                                    className={`px-3 py-1 rounded-lg font-mono font-semibold ${getStockBg(product)} ${getStockColor(product)}`}
                                    title={`Threshold: ${product.low_stock_threshold ?? 5}`}
                                  >
                                    {product.stock_quantity ?? 0}
                                  </button>
                                  <button
                                    onClick={() => handleQuickStockAdjust(product, 1)}
                                    className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setStockHistoryProduct(product)}
                                    className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors ml-1"
                                    title="View history"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
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

      {/* Stock Adjustment Dialog */}
      {stockAdjustProduct && (
        <StockAdjustmentDialog
          product={stockAdjustProduct}
          onConfirm={handleStockAdjustConfirm}
          onCancel={() => setStockAdjustProduct(null)}
        />
      )}

      {/* Stock History Dialog */}
      {stockHistoryProduct && (
        <StockHistoryDialog
          product={stockHistoryProduct}
          onClose={() => setStockHistoryProduct(null)}
        />
      )}
    </div>
  );
}
