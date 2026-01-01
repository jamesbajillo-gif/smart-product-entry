import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { salesApi, SaleRecord, expensesApi, ExpenseRecord, productsApi, stockApi, RestockInfo } from "@/services/mysqlApi";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  TrendingUp, 
  Package, 
  DollarSign,
  RefreshCw,
  Calendar,
  BarChart3,
  Trophy,
  Wifi,
  WifiOff,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Truck
} from "lucide-react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { RestockVariationDialog } from "@/components/RestockVariationDialog";
import { RestockData } from "@/components/StockAdjustmentDialog";
import { toast } from "sonner";

interface ParsedSaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface ProductAnalytics {
  productId: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number; // percentage
  saleCount: number;
  lastSaleDate?: Date;
  salesVelocity: number; // units per day
  salesFrequency: number; // sales per day
}

interface RecommendedProduct {
  productId: string;
  name: string;
  currentStock: number;
  lowStockThreshold: number;
  salesVelocity: number;
  salesFrequency: number;
  totalQuantitySold: number;
  lastSaleDate?: Date;
  daysSinceLastSale: number;
  recommendedQuantity: number;
  urgency: 'critical' | 'high' | 'medium';
  priorityScore: number;
}

type DateFilter = "today" | "week" | "month" | "all";

// Format date to MySQL compatible format
const formatMySQLDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export default function SalesAnalytics() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);

  // Calculate date range based on filter
  const getDateRange = (filter: DateFilter): { from?: string; to?: string } => {
    const now = new Date();
    
    switch (filter) {
      case "today":
        return {
          from: formatMySQLDate(startOfDay(now)),
          to: formatMySQLDate(endOfDay(now)),
        };
      case "week":
        return {
          from: formatMySQLDate(startOfWeek(now, { weekStartsOn: 1 })),
          to: formatMySQLDate(endOfWeek(now, { weekStartsOn: 1 })),
        };
      case "month":
        return {
          from: formatMySQLDate(startOfMonth(now)),
          to: formatMySQLDate(endOfMonth(now)),
        };
      case "all":
      default:
        return {};
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    const dateRange = getDateRange(dateFilter);
    
    try {
      // Load sales
      const salesResult = await salesApi.getAll({
        limit: 1000,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      });

      if (salesResult.success && salesResult.data) {
        setSales(salesResult.data);
      }

      // Load expenses
      const expensesResult = await expensesApi.getAll(1000);
      if (expensesResult.success && expensesResult.data) {
        // Filter expenses by date if needed
        let filteredExpenses = expensesResult.data;
        if (dateRange.from && dateRange.to) {
          filteredExpenses = expensesResult.data.filter(expense => {
            if (!expense.created_at) return false;
            const expenseDate = new Date(expense.created_at);
            const fromDate = new Date(dateRange.from!);
            const toDate = new Date(dateRange.to!);
            return expenseDate >= fromDate && expenseDate <= toDate;
          });
        }
        setExpenses(filteredExpenses);
      }

      // Load products
      const productsResult = await productsApi.getAll();
      if (productsResult.success && productsResult.data) {
        const parsedProducts = productsResult.data.map((p: any) => {
          let variations;
          if (p.variations) {
            try {
              variations = typeof p.variations === 'string' 
                ? JSON.parse(p.variations) 
                : p.variations;
            } catch {
              variations = undefined;
            }
          }
          
          return {
            id: String(p.id),
            name: p.name,
            price: Number(p.price),
            category: p.category,
            image_url: p.image_url || undefined,
            stock_quantity: p.stock_quantity ?? 0,
            low_stock_threshold: p.low_stock_threshold ?? 5,
            skip_stock_tracking: Boolean(p.skip_stock_tracking),
            variations,
          } as Product;
        });
        setProducts(parsedProducts);
      }
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Parse sales items
  const parseSaleItems = (itemsJson: string): ParsedSaleItem[] => {
    try {
      const items = JSON.parse(itemsJson);
      if (!Array.isArray(items)) return [];
      
      return items.map((item: any) => ({
        productId: item.product?.id || item.productId || "",
        name: item.product?.name || item.name || "Unknown",
        price: item.product?.price || item.price || 0,
        quantity: item.quantity || 0,
      }));
    } catch {
      return [];
    }
  };

  // Calculate product analytics
  const productAnalytics = useMemo((): ProductAnalytics[] => {
    const analyticsMap = new Map<string, ProductAnalytics>();
    const now = new Date();
    const dateRange = getDateRange(dateFilter);
    
    // Calculate period for sales velocity
    let startDate: Date;
    let endDate: Date;
    
    if (dateRange.from && dateRange.to) {
      startDate = new Date(dateRange.from);
      endDate = new Date(dateRange.to);
    } else if (sales.length > 0) {
      // For "all time", use oldest and newest sale dates
      const saleDates = sales
        .map(s => s.created_at ? new Date(s.created_at) : null)
        .filter((d): d is Date => d !== null);
      if (saleDates.length > 0) {
        startDate = new Date(Math.min(...saleDates.map(d => d.getTime())));
        endDate = new Date(Math.max(...saleDates.map(d => d.getTime())));
      } else {
        startDate = now;
        endDate = now;
      }
    } else {
      startDate = now;
      endDate = now;
    }
    
    const daysInPeriod = Math.max(1, differenceInDays(endDate, startDate) + 1); // +1 to include both start and end days

    // Process sales
    sales.forEach((sale) => {
      const saleDate = sale.created_at ? new Date(sale.created_at) : now;
      const items = parseSaleItems(sale.items || "[]");
      
      // Check if this is a GCash transaction
      const isGCashTransaction = items.some(item => 
        item.name === "GCASH-IN" || item.name === "GCASH-OUT"
      );
      
      items.forEach((item) => {
        // For GCash transactions, skip GCASH-IN and GCASH-OUT items (they're conversions, not profit)
        // Only count "Service Charge" as revenue/profit
        if (isGCashTransaction && (item.name === "GCASH-IN" || item.name === "GCASH-OUT")) {
          return; // Skip conversion amounts - they're not profit
        }
        
        const key = item.productId || item.name;
        const existing = analyticsMap.get(key) || {
          productId: item.productId,
          name: item.name,
          totalQuantity: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          profit: 0,
          profitMargin: 0,
          saleCount: 0,
          lastSaleDate: saleDate,
          salesVelocity: 0,
          salesFrequency: 0,
        };

        // For Service Charge in GCash transactions, count as revenue
        // For regular products, count normally
        existing.totalQuantity += item.quantity;
        existing.totalRevenue += item.price * item.quantity;
        existing.saleCount += 1;
        // Track most recent sale date
        if (!existing.lastSaleDate || saleDate > existing.lastSaleDate) {
          existing.lastSaleDate = saleDate;
        }
        analyticsMap.set(key, existing);
      });
    });

    // Process expenses
    expenses.forEach((expense) => {
      const key = expense.product_id;
      const expenseCost = Number(expense.total_cost) || 0;
      
      // Skip expenses for GCash products - GCash expenses are fund additions, not costs
      // Service charges have no expenses (they're pure profit)
      const isGCashProduct = expense.product_name?.toUpperCase().includes("GCASH") || 
                             expense.product_name === "GCASH-IN" || 
                             expense.product_name === "GCASH-OUT" ||
                             expense.product_name === "Service Charge";
      if (isGCashProduct) {
        return; // Skip GCash-related expenses
      }
      
      const existing = analyticsMap.get(key);
      if (existing) {
        existing.totalExpenses += expenseCost;
      } else {
        // Expense for product with no sales
        analyticsMap.set(key, {
          productId: expense.product_id,
          name: expense.product_name,
          totalQuantity: 0,
          totalRevenue: 0,
          totalExpenses: expenseCost,
          profit: -expenseCost,
          profitMargin: 0,
          saleCount: 0,
          salesVelocity: 0,
          salesFrequency: 0,
        });
      }
    });

    // Calculate profit, profit margin, and sales metrics
    const analytics = Array.from(analyticsMap.values()).map((item) => {
      item.profit = item.totalRevenue - item.totalExpenses;
      item.profitMargin = item.totalRevenue > 0 
        ? (item.profit / item.totalRevenue) * 100 
        : 0;
      // Calculate sales velocity (units per day) and frequency (sales per day)
      item.salesVelocity = item.totalQuantity / daysInPeriod;
      item.salesFrequency = item.saleCount / daysInPeriod;
      return item;
    });

    return analytics;
  }, [sales, expenses, dateFilter]);

  // Most sold products (by quantity)
  const mostSoldProducts = useMemo(() => {
    return [...productAnalytics]
      .filter(p => p.totalQuantity > 0)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);
  }, [productAnalytics]);

  // Highest revenue products
  const highestRevenueProducts = useMemo(() => {
    return [...productAnalytics]
      .filter(p => p.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }, [productAnalytics]);

  // Highest profit products
  const highestProfitProducts = useMemo(() => {
    return [...productAnalytics]
      .filter(p => p.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [productAnalytics]);

  // Expense analytics - group expenses by product
  const expenseAnalytics = useMemo(() => {
    const expenseMap = new Map<string, {
      productId: string;
      productName: string;
      totalCost: number;
      totalQuantity: number;
      expenseCount: number;
      averageUnitCost: number;
      suppliers: Set<string>;
      lastExpenseDate?: Date;
    }>();

    expenses.forEach((expense) => {
      // Skip GCash expenses
      const isGCashProduct = expense.product_name?.toUpperCase().includes("GCASH") || 
                             expense.product_name === "GCASH-IN" || 
                             expense.product_name === "GCASH-OUT" ||
                             expense.product_name === "Service Charge";
      if (isGCashProduct) return;

      const key = expense.product_id;
      const expenseCost = Number(expense.total_cost) || 0;
      const expenseQuantity = Number(expense.quantity) || 0;
      const expenseDate = expense.created_at ? new Date(expense.created_at) : undefined;

      const existing = expenseMap.get(key) || {
        productId: expense.product_id,
        productName: expense.product_name,
        totalCost: 0,
        totalQuantity: 0,
        expenseCount: 0,
        averageUnitCost: 0,
        suppliers: new Set<string>(),
        lastExpenseDate: expenseDate,
      };

      existing.totalCost += expenseCost;
      existing.totalQuantity += expenseQuantity;
      existing.expenseCount += 1;
      if (expense.supplier) {
        existing.suppliers.add(expense.supplier);
      }
      if (expenseDate && (!existing.lastExpenseDate || expenseDate > existing.lastExpenseDate)) {
        existing.lastExpenseDate = expenseDate;
      }

      expenseMap.set(key, existing);
    });

    // Calculate average unit cost and convert to array
    return Array.from(expenseMap.values()).map(expense => ({
      ...expense,
      averageUnitCost: expense.totalQuantity > 0 ? expense.totalCost / expense.totalQuantity : 0,
      suppliers: Array.from(expense.suppliers),
    })).sort((a, b) => b.totalCost - a.totalCost);
  }, [expenses]);

  // Top expenses by cost
  const topExpenses = useMemo(() => {
    return expenseAnalytics.slice(0, 10);
  }, [expenseAnalytics]);

  // Recommended products to restock (fast-moving products that are low/out of stock)
  const recommendedProducts = useMemo((): RecommendedProduct[] => {
    const recommendations: RecommendedProduct[] = [];
    const now = new Date();

    // Get fast-moving products (high sales velocity/frequency)
    const fastMovingProducts = productAnalytics
      .filter(p => p.salesVelocity > 0 && p.saleCount >= 3) // At least 3 sales to be considered
      .sort((a, b) => {
        // Sort by sales velocity (primary) and frequency (secondary)
        const velocityDiff = b.salesVelocity - a.salesVelocity;
        if (Math.abs(velocityDiff) > 0.1) return velocityDiff;
        return b.salesFrequency - a.salesFrequency;
      })
      .slice(0, 50); // Top 50 fast-moving products

    // Match with current product stock levels
    fastMovingProducts.forEach((analytics) => {
      const product = products.find(p => 
        p.id === analytics.productId || 
        p.name === analytics.name
      );

      // Skip if product doesn't exist or has skip_stock_tracking
      if (!product || product.skip_stock_tracking) return;

      const currentStock = product.stock_quantity ?? 0;
      const lowStockThreshold = product.low_stock_threshold ?? 5;
      const daysSinceLastSale = analytics.lastSaleDate 
        ? differenceInDays(now, analytics.lastSaleDate)
        : 999;

      // Only recommend if stock is low or out
      if (currentStock <= lowStockThreshold) {
        // Calculate recommended quantity based on sales velocity
        // Recommend enough stock for 7-14 days based on velocity
        const daysToStock = 10; // Target 10 days of stock
        const recommendedQuantity = Math.ceil(analytics.salesVelocity * daysToStock);
        const minRecommended = Math.max(lowStockThreshold * 2, 10); // At least 2x threshold or 10 units
        const finalRecommended = Math.max(recommendedQuantity, minRecommended);

        // Determine urgency
        let urgency: 'critical' | 'high' | 'medium' = 'medium';
        if (currentStock === 0) {
          urgency = 'critical';
        } else if (currentStock <= lowStockThreshold / 2) {
          urgency = 'high';
        }

        // Calculate priority score (higher = more urgent)
        // Factors: stock level, sales velocity, days since last sale
        const stockUrgency = currentStock === 0 ? 100 : (lowStockThreshold - currentStock) / lowStockThreshold * 50;
        const velocityScore = Math.min(analytics.salesVelocity * 10, 30); // Cap at 30
        const recencyScore = daysSinceLastSale <= 3 ? 20 : Math.max(0, 20 - daysSinceLastSale);
        const priorityScore = stockUrgency + velocityScore + recencyScore;

        recommendations.push({
          productId: analytics.productId,
          name: analytics.name,
          currentStock,
          lowStockThreshold,
          salesVelocity: analytics.salesVelocity,
          salesFrequency: analytics.salesFrequency,
          totalQuantitySold: analytics.totalQuantity,
          lastSaleDate: analytics.lastSaleDate,
          daysSinceLastSale,
          recommendedQuantity: finalRecommended,
          urgency,
          priorityScore,
        });
      }
    });

    // Sort by priority score (highest first)
    return recommendations.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 15);
  }, [productAnalytics, products]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalRevenue = productAnalytics.reduce((sum, p) => sum + (Number(p.totalRevenue) || 0), 0);
    const totalExpenses = productAnalytics.reduce((sum, p) => sum + (Number(p.totalExpenses) || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const totalQuantity = productAnalytics.reduce((sum, p) => sum + (Number(p.totalQuantity) || 0), 0);
    const totalSales = sales.length;

    return {
      totalRevenue: Number(totalRevenue) || 0,
      totalExpenses: Number(totalExpenses) || 0,
      totalProfit: Number(totalProfit) || 0,
      totalQuantity: Number(totalQuantity) || 0,
      totalSales,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    };
  }, [productAnalytics, sales]);

  // Handle restock confirmation
  const handleRestockConfirm = async (
    variationId: string | null,
    type: 'add' | 'remove' | 'set',
    quantity: number,
    reason: string,
    restockData?: RestockData
  ) => {
    if (!restockProduct) return;

    try {
      // Build restock info for API
      const restockInfo: RestockInfo | undefined = restockData ? {
        supplier: restockData.supplier,
        unitCost: restockData.unitCost,
        notes: restockData.notes,
      } : undefined;

      if (variationId) {
        // Restock a specific variation
        const variations = (() => {
          if (!restockProduct.variations) return [];
          if (Array.isArray(restockProduct.variations)) return restockProduct.variations;
          if (typeof restockProduct.variations === 'string') {
            try {
              return JSON.parse(restockProduct.variations);
            } catch {
              return [];
            }
          }
          return [];
        })();

        const variation = variations.find((v: any) => v.id === variationId);
        if (!variation) {
          toast.error("Variation not found");
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

        // Update the variation's stock
        variation.stock_quantity = newStock;

        // Update the product with the modified variations
        const variationsJson = JSON.stringify(variations);
        const updateResult = await productsApi.update(restockProduct.id, {
          variations: variationsJson,
        });

        if (updateResult.success) {
          // Record stock adjustment
          await stockApi.adjustStock(
            restockProduct.id,
            type,
            quantity,
            currentStock,
            reason,
            restockInfo
          );

          // Create expense record for variation restocking if unit cost is provided
          if (type === 'add' && restockData?.unitCost && restockData.unitCost > 0) {
            const variationName = variation.name && typeof variation.name === 'string' 
              ? `${restockProduct.name} - ${variation.name.trim()}`
              : restockProduct.name;
            const totalCost = quantity * restockData.unitCost;
            
            await expensesApi.create({
              product_id: `${restockProduct.id}-${variation.id}`,
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

          toast.success(`Restocked ${restockProduct.name} variation: +${quantity} units${costInfo}`);
          // Reload products
          const productsResult = await productsApi.getAll();
          if (productsResult.success && productsResult.data) {
            const parsedProducts = productsResult.data.map((p: any) => {
              let variations;
              if (p.variations) {
                try {
                  variations = typeof p.variations === 'string' 
                    ? JSON.parse(p.variations) 
                    : p.variations;
                } catch {
                  variations = undefined;
                }
              }
              
              return {
                id: String(p.id),
                name: p.name,
                price: Number(p.price),
                category: p.category,
                image_url: p.image_url || undefined,
                stock_quantity: p.stock_quantity ?? 0,
                low_stock_threshold: p.low_stock_threshold ?? 5,
                skip_stock_tracking: Boolean(p.skip_stock_tracking),
                variations,
              } as Product;
            });
            setProducts(parsedProducts);
          }
        } else {
          toast.error("Failed to update variation stock");
        }
      } else {
        // Restock base product
        const currentStock = restockProduct.stock_quantity ?? 0;
        const result = await stockApi.adjustStock(
          restockProduct.id,
          type,
          quantity,
          currentStock,
          reason,
          restockInfo
        );

        if (result.success) {
          // Create expense record if unit cost is provided (tagged as "restock")
          if (type === 'add' && restockData?.unitCost && restockData.unitCost > 0) {
            const totalCost = quantity * restockData.unitCost;
            await expensesApi.create({
              product_id: restockProduct.id,
              product_name: restockProduct.name,
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

          toast.success(`Restocked ${restockProduct.name}: +${quantity} units${costInfo}`);
          // Reload products
          const productsResult = await productsApi.getAll();
          if (productsResult.success && productsResult.data) {
            const parsedProducts = productsResult.data.map((p: any) => {
              let variations;
              if (p.variations) {
                try {
                  variations = typeof p.variations === 'string' 
                    ? JSON.parse(p.variations) 
                    : p.variations;
                } catch {
                  variations = undefined;
                }
              }
              
              return {
                id: String(p.id),
                name: p.name,
                price: Number(p.price),
                category: p.category,
                image_url: p.image_url || undefined,
                stock_quantity: p.stock_quantity ?? 0,
                low_stock_threshold: p.low_stock_threshold ?? 5,
                skip_stock_tracking: Boolean(p.skip_stock_tracking),
                variations,
              } as Product;
            });
            setProducts(parsedProducts);
          }
        } else {
          toast.error("Failed to restock product");
        }
      }
    } catch (error) {
      console.error("Error restocking:", error);
      toast.error("An error occurred while restocking");
    } finally {
      setRestockProduct(null);
    }
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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Sales Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  Product performance insights
                </p>
              </div>
            </div>
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ml-auto ${
              isOnline ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          {/* Date Filter & Refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="px-3 py-2 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading || !isOnline}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ₱{summary.totalRevenue.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.totalSales} transactions
                </p>
              </div>

              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                  <TrendingUp className="w-5 h-5 text-warning" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ₱{summary.totalExpenses.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cost of goods
                </p>
              </div>

              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Profit</span>
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <p className={`text-2xl font-bold ${
                  summary.totalProfit >= 0 ? 'text-success' : 'text-destructive'
                }`}>
                  ₱{summary.totalProfit.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.profitMargin.toFixed(1)}% margin
                </p>
              </div>

              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Items Sold</span>
                  <Package className="w-5 h-5 text-info" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.totalQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total units
                </p>
              </div>
            </div>

            {/* Tabs for Sales and Expenses */}
            <Tabs defaultValue="sales" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="sales" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Sales Analytics
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2">
                  <Receipt className="w-4 h-4" />
                  Expenses
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="space-y-6">
                {/* Analytics Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Sold Products */}
              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Package className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Most Sold Products</h2>
                </div>
                {mostSoldProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales data available</p>
                ) : (
                  <div className="space-y-3">
                    {mostSoldProducts.map((product, index) => (
                      <div
                        key={product.productId || product.name}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-500/20 text-orange-500' :
                            'bg-primary/20 text-primary'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.saleCount} sale{product.saleCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {product.totalQuantity.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ₱{product.totalRevenue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Highest Revenue Products */}
              <div className="glass-panel rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-success" />
                  <h2 className="text-xl font-semibold text-foreground">Highest Revenue</h2>
                </div>
                {highestRevenueProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales data available</p>
                ) : (
                  <div className="space-y-3">
                    {highestRevenueProducts.map((product, index) => (
                      <div
                        key={product.productId || product.name}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-500/20 text-orange-500' :
                            'bg-success/20 text-success'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.totalQuantity.toLocaleString()} units
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-success">
                            ₱{product.totalRevenue.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.profitMargin.toFixed(1)}% margin
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Highest Profit Products */}
              <div className="glass-panel rounded-lg p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Highest Profit</h2>
                </div>
                {highestProfitProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No profit data available</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {highestProfitProducts.map((product, index) => (
                      <div
                        key={product.productId || product.name}
                        className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-500/20 text-orange-500' :
                            'bg-primary/20 text-primary'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                Revenue: ₱{product.totalRevenue.toFixed(2)}
                              </p>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground">
                                Cost: ₱{product.totalExpenses.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-success">
                            ₱{product.profit.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.profitMargin.toFixed(1)}% margin
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>

                {/* Recommended Products to Restock */}
                <div className="glass-panel rounded-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <ShoppingCart className="w-5 h-5 text-warning" />
                <h2 className="text-xl font-semibold text-foreground">Recommended to Restock</h2>
                <span className="text-sm text-muted-foreground">
                  (Fast-moving products that should always be in stock)
                </span>
              </div>
              {recommendedProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {dateFilter === "all" 
                      ? "No fast-moving products need restocking at the moment"
                      : "Try selecting 'All Time' to see recommendations based on historical data"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendedProducts.map((product, index) => (
                    <div
                      key={product.productId || product.name}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        product.urgency === 'critical' 
                          ? 'bg-destructive/10 border-destructive/30' 
                          : product.urgency === 'high'
                          ? 'bg-warning/10 border-warning/30'
                          : 'bg-secondary/30 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          product.urgency === 'critical' 
                            ? 'bg-destructive/20 text-destructive' 
                            : product.urgency === 'high'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-info/20 text-info'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">{product.name}</p>
                            {product.urgency === 'critical' && (
                              <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs font-medium rounded-full">
                                Out of Stock
                              </span>
                            )}
                            {product.urgency === 'high' && (
                              <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs font-medium rounded-full">
                                Low Stock
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Current: {product.currentStock} / Threshold: {product.lowStockThreshold}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {product.salesVelocity.toFixed(1)} units/day
                            </span>
                            {product.daysSinceLastSale < 999 && (
                              <span>
                                Last sale: {product.daysSinceLastSale} day{product.daysSinceLastSale !== 1 ? 's' : ''} ago
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className={`w-4 h-4 ${
                            product.urgency === 'critical' ? 'text-destructive' :
                            product.urgency === 'high' ? 'text-warning' :
                            'text-info'
                          }`} />
                          <p className="font-semibold text-foreground">
                            Restock: {product.recommendedQuantity}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {product.totalQuantitySold.toLocaleString()} sold total
                        </p>
                        <Button
                          onClick={() => {
                            // Try to find product by ID first, then by name
                            let productToRestock = products.find(p => 
                              String(p.id) === String(product.productId)
                            );
                            
                            // If not found by ID, try by name (exact match)
                            if (!productToRestock) {
                              productToRestock = products.find(p => 
                                p.name.toLowerCase().trim() === product.name.toLowerCase().trim()
                              );
                            }
                            
                            // If still not found, try partial name match
                            if (!productToRestock) {
                              productToRestock = products.find(p => 
                                p.name.toLowerCase().includes(product.name.toLowerCase()) ||
                                product.name.toLowerCase().includes(p.name.toLowerCase())
                              );
                            }
                            
                            console.log('Restock button clicked:', {
                              recommendedProduct: product,
                              foundProduct: productToRestock,
                              productId: product.productId,
                              productName: product.name,
                              allMarlboroProducts: products.filter(p => p.name.toLowerCase().includes('marlboro')).map(p => ({
                                id: p.id,
                                name: p.name,
                                hasVariations: !!p.variations,
                                variationsCount: Array.isArray(p.variations) ? p.variations.length : (typeof p.variations === 'string' ? 'string' : 'none')
                              }))
                            });
                            
                            if (productToRestock) {
                              console.log('Setting restock product:', {
                                id: productToRestock.id,
                                name: productToRestock.name,
                                variations: productToRestock.variations,
                                variationsType: typeof productToRestock.variations,
                                variationsIsArray: Array.isArray(productToRestock.variations)
                              });
                              setRestockProduct(productToRestock);
                            } else {
                              console.error('Product not found for restock:', {
                                productId: product.productId,
                                productName: product.name,
                                availableProducts: products.map(p => ({ id: p.id, name: p.name }))
                              });
                              toast.error(`Product "${product.name}" not found in product list`);
                            }
                          }}
                          disabled={!isOnline}
                          size="sm"
                          className="bg-success hover:bg-success/90"
                        >
                          <Truck className="w-4 h-4 mr-1" />
                          Restock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="space-y-6">
                {/* Expenses Panel */}
                <div className="glass-panel rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Receipt className="w-5 h-5 text-warning" />
                    <h2 className="text-xl font-semibold text-foreground">Expenses Breakdown</h2>
                    <span className="text-sm text-muted-foreground">
                      (Cost of goods by product)
                    </span>
                  </div>
                  {expenseAnalytics.length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No expenses recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Expense Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-secondary/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
                          <p className="text-xl font-bold text-foreground">
                            ₱{expenseAnalytics.reduce((sum, e) => sum + e.totalCost, 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total Quantity</p>
                          <p className="text-xl font-bold text-foreground">
                            {expenseAnalytics.reduce((sum, e) => sum + e.totalQuantity, 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Expense Records</p>
                          <p className="text-xl font-bold text-foreground">
                            {expenseAnalytics.reduce((sum, e) => sum + e.expenseCount, 0)}
                          </p>
                        </div>
                      </div>

                      {/* Top Expenses List */}
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Expenses by Cost</h3>
                        <div className="space-y-3">
                          {topExpenses.map((expense, index) => (
                            <div
                              key={expense.productId}
                              className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                  index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                  index === 2 ? 'bg-orange-500/20 text-orange-500' :
                                  'bg-warning/20 text-warning'
                                }`}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">{expense.productName}</p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span>
                                      {expense.totalQuantity.toLocaleString()} units
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Avg: ₱{expense.averageUnitCost.toFixed(2)}/unit
                                    </span>
                                    {expense.suppliers.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span>
                                          {expense.suppliers.length} supplier{expense.suppliers.length !== 1 ? 's' : ''}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-semibold text-warning">
                                  ₱{expense.totalCost.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {expense.expenseCount} record{expense.expenseCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Restock Dialog */}
      {restockProduct && (
        <RestockVariationDialog
          product={restockProduct}
          onConfirm={handleRestockConfirm}
          onCancel={() => setRestockProduct(null)}
        />
      )}
    </div>
  );
}

