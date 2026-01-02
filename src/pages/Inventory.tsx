import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { stockApi, RestockInfo, productsApi, expensesApi } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { Product, ProductVariation } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StockAdjustmentDialog, RestockData } from "@/components/StockAdjustmentDialog";
import { StockHistoryDialog } from "@/components/StockHistoryDialog";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useAvailableFunds } from "@/hooks/useAvailableFunds";
import {
  ArrowLeft,
  Package,
  Search,
  Filter,
  AlertTriangle,
  History,
  Wifi,
  WifiOff,
  Truck,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Settings,
  Plus,
  Edit,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const {
    products,
    updateProduct,
    refreshProducts,
    isOnline,
    isLoading,
  } = useMySQLSync();
  const { funds: storeFunds } = useStoreFunds();
  const { availableFunds, refresh: refreshAvailableFunds } = useAvailableFunds();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  const [showUntrackedProducts, setShowUntrackedProducts] = useState(true);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Get all unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ["All", ...Array.from(cats).sort()];
  }, [products]);

  // Filter products based on search, category, and stock status
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Hide untracked products if toggle is off
      if (!showUntrackedProducts && product.skip_stock_tracking) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = product.name.toLowerCase().includes(query);
        const categoryMatch = product.category?.toLowerCase().includes(query);
        if (!nameMatch && !categoryMatch) return false;
      }

      // Category filter
      if (categoryFilter !== "All" && product.category !== categoryFilter) {
        return false;
      }

      // Stock status filters
      if (showLowStockOnly) {
        const stock = product.stock_quantity ?? 0;
        const threshold = product.low_stock_threshold ?? 5;
        if (stock > threshold || product.skip_stock_tracking) return false;
      }

      if (showOutOfStockOnly) {
        const stock = product.stock_quantity ?? 0;
        if (stock > 0 || product.skip_stock_tracking) return false;
      }

      return true;
    });
  }, [products, searchQuery, categoryFilter, showLowStockOnly, showOutOfStockOnly, showUntrackedProducts]);

  // Calculate inventory statistics
  const inventoryStats = useMemo(() => {
    const totalProducts = products.length;
    const trackedProducts = products.filter((p) => !p.skip_stock_tracking);
    const totalStock = trackedProducts.reduce((sum, p) => sum + (p.stock_quantity ?? 0), 0);
    const lowStockProducts = trackedProducts.filter((p) => {
      const stock = p.stock_quantity ?? 0;
      const threshold = p.low_stock_threshold ?? 5;
      return stock > 0 && stock <= threshold;
    });
    const outOfStockProducts = trackedProducts.filter((p) => (p.stock_quantity ?? 0) === 0);
    const totalValue = trackedProducts.reduce((sum, p) => {
      return sum + ((p.stock_quantity ?? 0) * p.price);
    }, 0);

    return {
      totalProducts,
      trackedProducts: trackedProducts.length,
      totalStock,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      totalValue,
    };
  }, [products]);

  // Handle stock adjustment
  const handleRestockConfirm = async (
    variationId: string | null,
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    restockData?: RestockData
  ) => {
    if (!stockAdjustProduct) return;

    try {
      const restockInfo: RestockInfo | undefined = restockData ? {
        supplier: restockData.supplier,
        unitCost: restockData.unitCost,
        notes: restockData.notes,
      } : undefined;

      if (variationId) {
        // Handle variation stock adjustment
        const variations = (() => {
          if (!stockAdjustProduct.variations) return [];
          if (Array.isArray(stockAdjustProduct.variations)) return stockAdjustProduct.variations;
          if (typeof stockAdjustProduct.variations === 'string') {
            try {
              return JSON.parse(stockAdjustProduct.variations);
            } catch {
              return [];
            }
          }
          return [];
        })();

        const variation = variations.find((v: any) => v.id === variationId);
        if (!variation) {
          toast({
            title: "Error",
            description: "Variation not found",
            variant: "destructive"
          });
          return;
        }

        const currentStock = variation.stock_quantity ?? 0;
        let newStock = currentStock;
        if (type === 'add') {
          newStock = currentStock + quantity;
        } else if (type === 'remove') {
          newStock = Math.max(0, currentStock - quantity);
        } else if (type === 'set') {
          newStock = quantity;
        }

        variation.stock_quantity = newStock;
        const variationsJson = JSON.stringify(variations);
        const updateResult = await productsApi.update(stockAdjustProduct.id, {
          variations: variationsJson,
        });

        if (updateResult.success) {
          // Create expense record for variation restocking if unit cost is provided
          if (type === 'add' && restockData?.unitCost && restockData.unitCost > 0) {
            const variationName = variation.name && typeof variation.name === 'string' 
              ? `${stockAdjustProduct.name} - ${variation.name.trim()}`
              : stockAdjustProduct.name;
            const totalCost = quantity * restockData.unitCost;
            
            await expensesApi.create({
              product_id: `${stockAdjustProduct.id}-${variation.id}`,
              product_name: variationName,
              quantity: quantity,
              unit_cost: restockData.unitCost,
              total_cost: totalCost,
              supplier: restockData.supplier || undefined,
              notes: restockData.notes || undefined,
              category: "restock",
              payment_source: restockData.paymentSource || "cash",
            });
          }
          
          const costInfo = restockData?.unitCost && type === 'add'
            ? ` (₱${(quantity * restockData.unitCost).toFixed(2)} total)`
            : '';
          
          toast({
            title: "Stock Updated",
            description: `Updated ${stockAdjustProduct.name} variation stock to ${newStock}${costInfo}`
          });
          await refreshProducts();
        } else {
          toast({
            title: "Error",
            description: "Failed to update stock",
            variant: "destructive"
          });
        }
      } else {
        // Handle base product stock adjustment
        const currentStock = stockAdjustProduct.stock_quantity ?? 0;
        const result = await stockApi.adjustStock(
          stockAdjustProduct.id,
          type,
          quantity,
          currentStock,
          reason,
          restockInfo
        );

        if (result.success) {
          let newStock = currentStock;
          if (type === 'add') {
            newStock = currentStock + quantity;
          } else if (type === 'remove') {
            newStock = Math.max(0, currentStock - quantity);
          } else if (type === 'set') {
            newStock = quantity;
          }

          await updateProduct(stockAdjustProduct.id, { stock_quantity: newStock });
          
          // Create expense record if unit cost is provided (tagged as "restock")
          // Only for 'add' type to track restocking expenses
          if (type === 'add' && restockData?.unitCost && restockData.unitCost > 0) {
            const totalCost = quantity * restockData.unitCost;
            await expensesApi.create({
              product_id: stockAdjustProduct.id,
              product_name: stockAdjustProduct.name,
              quantity: quantity,
              unit_cost: restockData.unitCost,
              total_cost: totalCost,
              supplier: restockData.supplier || undefined,
              notes: restockData.notes || undefined,
              category: "restock",
              payment_source: restockData.paymentSource || "cash",
            });
          }
          
          const costInfo = restockData?.unitCost && type === 'add'
            ? ` (₱${(quantity * restockData.unitCost).toFixed(2)} total)`
            : '';
          
          toast({
            title: "Stock Updated",
            description: `Updated ${stockAdjustProduct.name} stock to ${newStock}${costInfo}`
          });

          await refreshProducts();
          await refreshAvailableFunds();
        } else {
          toast({
            title: "Error",
            description: "Failed to update stock",
            variant: "destructive"
          });
        }
      }

      setStockAdjustProduct(null);
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast({
        title: "Error",
        description: "An error occurred while adjusting stock",
        variant: "destructive"
      });
    }
  };

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Select all filtered products
  const selectAll = () => {
    setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Get stock status for a product
  const getStockStatus = (product: Product) => {
    if (product.skip_stock_tracking) return { status: 'unlimited', label: 'Unlimited', color: 'text-muted-foreground' };
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    if (stock === 0) return { status: 'out', label: 'Out of Stock', color: 'text-destructive' };
    if (stock <= threshold) return { status: 'low', label: 'Low Stock', color: 'text-warning' };
    return { status: 'ok', label: 'In Stock', color: 'text-success' };
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="ghost" size="icon" title="Product Management">
                <Package className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
                <p className="text-sm text-muted-foreground">
                  {inventoryStats.trackedProducts} tracked products • {isOnline ? "Online" : "Offline"}
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
            {inventoryStats.lowStockCount > 0 && (
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLowStockOnly
                    ? 'bg-warning/20 text-warning border border-warning/50'
                    : 'bg-warning/10 text-warning hover:bg-warning/20'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {inventoryStats.lowStockCount} Low Stock
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProducts}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Inventory Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Stock</p>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{inventoryStats.totalStock.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">units across {inventoryStats.trackedProducts} products</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <TrendingDown className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold text-warning">{inventoryStats.lowStockCount}</p>
              <p className="text-xs text-muted-foreground mt-1">products need restocking</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-destructive">{inventoryStats.outOfStockCount}</p>
              <p className="text-xs text-muted-foreground mt-1">products unavailable</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <BarChart3 className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold text-success">₱{inventoryStats.totalValue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">total stock value</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <Button
                variant={showLowStockOnly ? "default" : "outline"}
                onClick={() => {
                  setShowLowStockOnly(!showLowStockOnly);
                  setShowOutOfStockOnly(false);
                }}
                className="gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Low Stock
              </Button>
              <Button
                variant={showOutOfStockOnly ? "default" : "outline"}
                onClick={() => {
                  setShowOutOfStockOnly(!showOutOfStockOnly);
                  setShowLowStockOnly(false);
                }}
                className="gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Out of Stock
              </Button>
              <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-lg">
                <Checkbox
                  id="show-untracked"
                  checked={showUntrackedProducts}
                  onCheckedChange={(checked) => setShowUntrackedProducts(checked === true)}
                />
                <label
                  htmlFor="show-untracked"
                  className="text-sm text-foreground cursor-pointer select-none"
                >
                  Show Untracked Products
                </label>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.size > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 mb-6 flex items-center justify-between">
              <p className="text-sm text-foreground">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement bulk restock
                    toast({
                      title: "Bulk Restock",
                      description: "Bulk restock feature coming soon"
                    });
                  }}
                >
                  Bulk Restock
                </Button>
              </div>
            </div>
          )}
        </header>

        {/* Products List */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              const hasVariations = product.variations && (
                Array.isArray(product.variations) ? product.variations.length > 0 :
                typeof product.variations === 'string' ? (product.variations as string).trim() !== '' && product.variations !== '[]' : false
              );

              return (
                <div
                  key={product.id}
                  className={`bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors ${
                    selectedProducts.has(product.id) ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded shrink-0"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-secondary rounded flex items-center justify-center shrink-0">
                          <Package className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                        {product.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                        )}
                        {hasVariations && (
                          <p className="text-xs text-info mt-0.5">Has variations</p>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-4 h-4 rounded border-border"
                    />
                  </div>

                  {/* Stock Information */}
                  {!product.skip_stock_tracking ? (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Stock</span>
                        <span className={`text-lg font-bold ${stockStatus.color}`}>
                          {product.stock_quantity ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Threshold</span>
                        <span className="text-xs text-muted-foreground">
                          {product.low_stock_threshold ?? 5}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className={`w-3 h-3 ${stockStatus.color}`} />
                        <span className={`text-xs ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <span className="text-xs text-muted-foreground">Stock tracking disabled</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setStockAdjustProduct(product)}
                    >
                      <Truck className="w-4 h-4" />
                      Restock
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setHistoryProduct(product)}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stock Adjustment Dialog */}
        {stockAdjustProduct && (
          <StockAdjustmentDialog
            product={stockAdjustProduct}
            availableFunds={availableFunds}
            onConfirm={handleRestockConfirm}
            onCancel={() => setStockAdjustProduct(null)}
          />
        )}

        {/* Stock History Dialog */}
        {historyProduct && (
          <StockHistoryDialog
            product={historyProduct}
            onClose={() => setHistoryProduct(null)}
          />
        )}
      </div>
    </div>
  );
}

