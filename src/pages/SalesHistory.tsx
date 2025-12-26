import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { salesApi, SaleRecord } from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Receipt, 
  Banknote, 
  Smartphone, 
  Calendar, 
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface ParsedSaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

type DateFilter = "today" | "week" | "month" | "all";

const ITEMS_PER_PAGE = 15;

// Format date to MySQL compatible format
const formatMySQLDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export default function SalesHistory() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const loadSales = async () => {
    setIsLoading(true);
    const dateRange = getDateRange(dateFilter);
    
    const result = await salesApi.getAll({
      limit: 500, // Fetch more for client-side filtering
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    });
    
    if (result.success && result.data) {
      setSales(result.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadSales();
    setCurrentPage(1); // Reset to first page when date filter changes
  }, [dateFilter]);

  const parseItems = (itemsJson: string): ParsedSaleItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter sales by product search (client-side since items is JSON)
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    
    const query = searchQuery.toLowerCase();
    return sales.filter((sale) => {
      const items = parseItems(sale.items);
      return items.some((item) => item.name.toLowerCase().includes(query));
    });
  }, [sales, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Summary stats (based on filtered data)
  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const cashSales = filteredSales.filter((s) => s.payment_method === "cash");
  const gcashSales = filteredSales.filter((s) => s.payment_method === "gcash");

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Sales History</h1>
                <p className="text-sm text-muted-foreground">View past transactions</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-2"
              onClick={loadSales}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Date Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {dateFilterOptions.map((option) => (
              <Button
                key={option.value}
                variant={dateFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(option.value)}
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                {option.label}
              </Button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-xl md:text-2xl font-bold font-mono text-primary">₱{totalSales.toFixed(2)}</p>
            </div>
            <div className="glass-panel rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{filteredSales.length}</p>
            </div>
            <div className="glass-panel rounded-lg p-4 flex items-center gap-3">
              <Banknote className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Cash</p>
                <p className="text-lg md:text-xl font-bold text-foreground">{cashSales.length}</p>
              </div>
            </div>
            <div className="glass-panel rounded-lg p-4 flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">GCash</p>
                <p className="text-lg md:text-xl font-bold text-foreground">{gcashSales.length}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex gap-6">
          {/* Sales List */}
          <div className="flex-1">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading sales...</p>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 glass-panel rounded-lg">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No sales found for "${searchQuery}"` 
                    : dateFilter !== "all" 
                      ? `No sales for ${dateFilterOptions.find(o => o.value === dateFilter)?.label.toLowerCase()}`
                      : "No sales recorded yet"
                  }
                </p>
                {(searchQuery || dateFilter !== "all") && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setDateFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
                {!searchQuery && dateFilter === "all" && (
                  <Link to="/">
                    <Button variant="outline" className="mt-4">
                      Go to POS
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginatedSales.map((sale) => {
                    const items = parseItems(sale.items);
                    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

                    return (
                      <button
                        key={sale.id}
                        onClick={() => setSelectedSale(sale)}
                        className={`w-full text-left p-4 rounded-lg transition-all ${
                          selectedSale?.id === sale.id
                            ? "bg-primary/10 border border-primary/30"
                            : "glass-panel hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {sale.payment_method === "cash" ? (
                              <Banknote className="w-4 h-4 text-success" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-info" />
                            )}
                            <div>
                              <p className="font-medium text-foreground">
                                {itemCount} item{itemCount !== 1 ? "s" : ""}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(sale.created_at)}
                              </p>
                            </div>
                          </div>
                          <p className="font-mono font-bold text-primary">
                            ₱{Number(sale.total).toFixed(2)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-4">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sale Detail */}
          {selectedSale && (
            <div className="w-80 glass-panel rounded-lg p-4 h-fit sticky top-6 hidden md:block">
              <h3 className="font-semibold text-foreground mb-4">Transaction Details</h3>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-foreground">{formatDate(selectedSale.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-foreground capitalize flex items-center gap-1">
                    {selectedSale.payment_method === "cash" ? (
                      <Banknote className="w-3 h-3 text-success" />
                    ) : (
                      <Smartphone className="w-3 h-3 text-info" />
                    )}
                    {selectedSale.payment_method}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Items</p>
                <div className="space-y-2">
                  {parseItems(selectedSale.items).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {item.name} <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                      <span className="font-mono text-foreground">
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="font-mono text-primary">
                    ₱{Number(selectedSale.total).toFixed(2)}
                  </span>
                </div>
                {selectedSale.payment_method === "cash" && selectedSale.amount_tendered && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tendered</span>
                      <span className="font-mono text-foreground">
                        ₱{Number(selectedSale.amount_tendered).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Change</span>
                      <span className="font-mono text-success">
                        ₱{Number(selectedSale.change_amount).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
