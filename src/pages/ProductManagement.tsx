import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { stockApi, RestockInfo } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { Product, PRODUCT_CATEGORIES, ProductCategory } from "@/types/product";
import { Button } from "@/components/ui/button";
import { StockAdjustmentDialog, RestockData } from "@/components/StockAdjustmentDialog";
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
  Image,
  AlertTriangle,
  History,
  Wifi,
  WifiOff,
  Database,
  Truck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initialProducts } from "@/data/products";

export default function ProductManagement() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    isOnline,
    isLoading,
  } = useMySQLSync();

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
  const [isSeeding, setIsSeeding] = useState(false);
  const { toast } = useToast();

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

  // Seed initial products to database
  const seedInitialProducts = async () => {
    setIsSeeding(true);
    let successCount = 0;

    for (const product of initialProducts) {
      const result = await addProduct({
        name: product.name,
        price: product.price,
        category: product.category || "Other",
        stock_quantity: 50,
        low_stock_threshold: 5,
      });
      if (result.success) successCount++;
    }

    toast({
      title: "Products Seeded",
      description: `Added ${successCount} products to database`,
    });
    setIsSeeding(false);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) {
      toast({ title: "Error", description: "Please fill in all fields" });
      return;
    }

    // Build product data - only include stock fields if user provided them
    const productData: {
      name: string;
      price: number;
      category: ProductCategory;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
    } = {
      name: newName.trim(),
      price: parseFloat(newPrice),
      category: newCategory,
      image_url: newImageUrl.trim() || undefined,
    };
    
    // Only add stock fields if user explicitly entered values
    if (newStockQuantity.trim() !== "" && newStockQuantity !== "0") {
      productData.stock_quantity = parseInt(newStockQuantity);
      productData.low_stock_threshold = parseInt(newLowStockThreshold) || 5;
    }
    
    const result = await addProduct(productData);

    if (result.success) {
      toast({ title: "Success", description: "Product added successfully" });
      setNewName("");
      setNewPrice("");
      setNewCategory("Other");
      setNewImageUrl("");
      setNewStockQuantity("0");
      setNewLowStockThreshold("5");
      setShowAddForm(false);
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

    const result = await updateProduct(editingId, {
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
    } else {
      toast({ title: "Error", description: result.error || "Failed to update product" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const result = await deleteProduct(id);

    if (result.success) {
      toast({ title: "Success", description: "Product deleted successfully" });
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

  // Restock from dialog
  const handleRestockConfirm = async (
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    restockData?: RestockData
  ) => {
    if (!stockAdjustProduct) return;

    const currentStock = stockAdjustProduct.stock_quantity ?? 0;
    
    // Build restock info for API
    const restockInfo: RestockInfo | undefined = restockData ? {
      supplier: restockData.supplier,
      unitCost: restockData.unitCost,
      notes: restockData.notes,
    } : undefined;

    const result = await stockApi.adjustStock(
      stockAdjustProduct.id,
      type,
      quantity,
      currentStock,
      reason,
      restockInfo
    );

    if (result.success) {
      const newStock = currentStock + quantity;
      await updateProduct(stockAdjustProduct.id, { stock_quantity: newStock });
      
      const costInfo = restockData?.unitCost 
        ? ` (₱${(quantity * restockData.unitCost).toFixed(2)} total)`
        : '';
      
      toast({ 
        title: "Stock Updated", 
        description: `Added ${quantity} units to ${stockAdjustProduct.name}${costInfo}` 
      });
    } else {
      toast({ title: "Error", description: "Failed to update stock" });
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
      const result = await updateProduct(id, { category: bulkCategory });
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
  };

  const handleRefresh = async () => {
    await refreshProducts();
    toast({ title: "Refreshed", description: "Products reloaded from database" });
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

  // Check if we should show seed option (database empty but have initial products)
  const showSeedOption = products.length === 0 && !isLoading && isOnline;

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
                  {products.length} products • {isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
              isOnline ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Synced' : 'Offline'}
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
                onClick={handleRefresh}
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

        {/* Empty State - Seed Products Option */}
        {showSeedOption && (
          <div className="glass-panel rounded-lg p-8 text-center animate-fade-in">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Products in Database</h3>
            <p className="text-muted-foreground mb-6">
              Would you like to seed the database with {initialProducts.length} initial products?
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={seedInitialProducts}
                disabled={isSeeding}
                className="gap-2"
              >
                {isSeeding ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                Seed {initialProducts.length} Products
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Manually
              </Button>
            </div>
          </div>
        )}

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
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        )}

        {/* Product List */}
        {!isLoading && !showSeedOption && (
          <div className="space-y-6">
            {groupedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No products found</p>
              </div>
            ) : (
              groupedProducts.map(({ category, products: categoryProducts }) => (
                <div key={category} className="glass-panel rounded-lg overflow-hidden">
                  <div className="bg-secondary/50 px-4 py-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">{category}</span>
                      <span className="text-sm text-muted-foreground">
                        ({categoryProducts.length})
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground border-b border-border/30">
                          <th className="p-3 w-10">
                            <button
                              onClick={toggleSelectAll}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isAllSelected ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : isSomeSelected ? (
                                <CheckSquare className="w-4 h-4 opacity-50" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="p-3">Product</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Stock</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryProducts.map((product) => (
                          <tr
                            key={product.id}
                            className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${
                              selectedIds.has(product.id) ? "bg-primary/10" : ""
                            }`}
                          >
                            <td className="p-3">
                              <button
                                onClick={() => toggleSelect(product.id)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {selectedIds.has(product.id) ? (
                                  <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="px-2 py-1 bg-input rounded text-foreground text-sm w-full"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <select
                                      value={editCategory}
                                      onChange={(e) =>
                                        setEditCategory(e.target.value as ProductCategory)
                                      }
                                      className="px-2 py-1 bg-input rounded text-foreground text-sm"
                                    >
                                      {PRODUCT_CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="url"
                                      value={editImageUrl}
                                      onChange={(e) => setEditImageUrl(e.target.value)}
                                      placeholder="Image URL"
                                      className="px-2 py-1 bg-input rounded text-foreground text-sm flex-1"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt={product.name}
                                      className="w-10 h-10 object-cover rounded-lg"
                                      onError={(e) =>
                                        (e.currentTarget.style.display = "none")
                                      }
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                                      <Package className="w-5 h-5 text-muted-foreground/50" />
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground">
                                    {product.name}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  step="0.01"
                                  className="px-2 py-1 bg-input rounded text-foreground text-sm w-24"
                                />
                              ) : (
                                <span className="text-primary font-mono">
                                  ₱{product.price.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {editingId === product.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={editStockQuantity}
                                    onChange={(e) => setEditStockQuantity(e.target.value)}
                                    className="px-2 py-1 bg-input rounded text-foreground text-sm w-16"
                                    placeholder="Stock"
                                  />
                                  <input
                                    type="number"
                                    value={editLowStockThreshold}
                                    onChange={(e) => setEditLowStockThreshold(e.target.value)}
                                    className="px-2 py-1 bg-input rounded text-foreground text-sm w-16"
                                    placeholder="Alert"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium min-w-[60px] text-center ${getStockBg(product)} ${getStockColor(product)}`}>
                                    {product.stock_quantity ?? 0}
                                  </span>
                                  <button
                                    onClick={() => setStockAdjustProduct(product)}
                                    disabled={!isOnline}
                                    className="p-1.5 rounded bg-success/20 hover:bg-success/30 text-success disabled:opacity-50 transition-colors"
                                    title="Restock"
                                  >
                                    <Truck className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setStockHistoryProduct(product)}
                                    className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                    title="View history"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-1 justify-end">
                                {editingId === product.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleSaveEdit}
                                      className="h-8 w-8 text-success"
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 text-muted-foreground"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(product)}
                                      className="h-8 w-8"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(product.id, product.name)}
                                      className="h-8 w-8 text-destructive"
                                      disabled={!isOnline}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-lg px-4 py-3 flex items-center gap-4 shadow-lg animate-fade-in z-50">
            <span className="text-sm text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Change to:</span>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as ProductCategory)}
                className="px-2 py-1 bg-input rounded text-foreground text-sm"
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
                disabled={isBulkUpdating || !isOnline}
                className="gap-1"
              >
                {isBulkUpdating ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Tag className="w-3 h-3" />
                )}
                Apply
              </Button>
            </div>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Stock Adjustment Dialog */}
      {stockAdjustProduct && (
        <StockAdjustmentDialog
          product={stockAdjustProduct}
          onCancel={() => setStockAdjustProduct(null)}
          onConfirm={handleRestockConfirm}
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