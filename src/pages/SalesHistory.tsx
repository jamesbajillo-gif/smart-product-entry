import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { salesApi, SaleRecord, expensesApi, ExpenseRecord } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { getProductDisplayName } from "@/utils/productDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditSaleDialog } from "@/components/EditSaleDialog";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
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
  ChevronRight,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Pencil
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
  const { canDelete } = useUserPermissions();
  const { products } = useMySQLSync();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"sales" | "gcash" | "expenses">("sales");
  const { toast } = useToast();
  
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

  const loadExpenses = async () => {
    setIsLoadingExpenses(true);
    const result = await expensesApi.getAll(500);
    
    if (result.success && result.data) {
      // Filter by date range if needed
      const dateRange = getDateRange(dateFilter);
      let filteredExpenses = result.data;
      
      if (dateRange.from && dateRange.to) {
        filteredExpenses = result.data.filter((expense) => {
          if (!expense.created_at) return false;
          try {
            const expenseDate = new Date(expense.created_at);
            const fromDate = new Date(dateRange.from!);
            const toDate = new Date(dateRange.to!);
            // Ensure dates are valid before comparison
            if (isNaN(expenseDate.getTime()) || isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
              return false;
            }
            return expenseDate >= fromDate && expenseDate <= toDate;
          } catch {
            return false;
          }
        });
      }
      
      setExpenses(filteredExpenses);
    }
    setIsLoadingExpenses(false);
  };

  useEffect(() => {
    loadSales();
    setCurrentPage(1); // Reset to first page when date filter changes
  }, [dateFilter]);

  useEffect(() => {
    if (activeTab === "expenses") {
      loadExpenses();
    }
  }, [activeTab, dateFilter]);

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

  // Filter GCash transactions (sales with GCASH-IN or GCASH-OUT)
  const gcashTransactions = useMemo(() => {
    return sales.filter((sale) => {
      const items = parseItems(sale.items);
      return items.some((item) => 
        item.name === "GCASH-IN" || item.name === "GCASH-OUT"
      );
    });
  }, [sales]);

  // Filter GCash transactions by search
  const filteredGcashTransactions = useMemo(() => {
    if (!searchQuery.trim()) return gcashTransactions;
    
    const query = searchQuery.toLowerCase();
    return gcashTransactions.filter((sale) => {
      const items = parseItems(sale.items);
      return items.some((item) => 
        (item.name === "GCASH-IN" || item.name === "GCASH-OUT") &&
        (item.name.toLowerCase().includes(query) || 
         sale.payment_method?.toLowerCase().includes(query))
      );
    });
  }, [gcashTransactions, searchQuery]);

  // Filter expenses by search
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    
    const query = searchQuery.toLowerCase();
    return expenses.filter((expense) => 
      expense.product_name?.toLowerCase().includes(query) ||
      expense.category?.toLowerCase().includes(query) ||
      expense.supplier?.toLowerCase().includes(query) ||
      expense.notes?.toLowerCase().includes(query)
    );
  }, [expenses, searchQuery]);

  // Pagination for Sales
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  // Pagination for GCash
  const gcashTotalPages = Math.ceil(filteredGcashTransactions.length / ITEMS_PER_PAGE);
  const paginatedGcashTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGcashTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGcashTransactions, currentPage]);

  // Pagination for Expenses
  const expensesTotalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Summary stats (based on filtered data)
  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const cashSales = filteredSales.filter((s) => s.payment_method === "cash");
  const gcashSales = filteredSales.filter((s) => s.payment_method === "gcash");

  // GCash transactions summary
  const gcashTotal = filteredGcashTransactions.reduce((sum, sale) => {
    const items = parseItems(sale.items);
    const gcashInItem = items.find(item => item.name === "GCASH-IN");
    const gcashOutItem = items.find(item => item.name === "GCASH-OUT");
    const serviceChargeItem = items.find(item => item.name === "Service Charge");
    const transactionItem = gcashInItem || gcashOutItem;
    
    if (transactionItem) {
      return sum + (transactionItem.price * transactionItem.quantity) + (serviceChargeItem ? serviceChargeItem.price * serviceChargeItem.quantity : 0);
    }
    return sum;
  }, 0);

  // Expenses summary
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.total_cost || 0), 0);

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  // Handle checkbox selection
  const toggleSelection = (saleId: number | undefined) => {
    if (!saleId) return;
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSales.filter(s => s.id).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSales.filter(s => s.id).map(s => s.id!)));
    }
  };

  // Handle individual delete
  const handleDeleteClick = (e: React.MouseEvent, sale: SaleRecord) => {
    e.stopPropagation();
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete?.id) return;
    
    // Check permissions
    if (!canDelete) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to delete recorded sales.",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
      return;
    }
    
    setIsDeleting(true);
    const result = await salesApi.delete(saleToDelete.id);
    
    if (result.success) {
      toast({
        title: "Sale deleted",
        description: "The sale has been successfully deleted.",
      });
      setSales((prev) => prev.filter((s) => s.id !== saleToDelete.id));
      if (selectedSale?.id === saleToDelete.id) {
        setSelectedSale(null);
      }
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(saleToDelete.id!);
        return newSet;
      });
    } else {
      toast({
        title: "Delete failed",
        description: result.error || "Failed to delete the sale.",
        variant: "destructive",
      });
    }
    
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setSaleToDelete(null);
  };

  // Handle bulk delete
  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    
    // Check permissions
    if (!canDelete) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to delete recorded sales.",
        variant: "destructive",
      });
      setBulkDeleteDialogOpen(false);
      return;
    }
    
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    const result = await salesApi.deleteMany(ids);
    
    if (result.success) {
      toast({
        title: "Sales deleted",
        description: `Successfully deleted ${result.successCount} sale(s).`,
      });
      setSales((prev) => prev.filter((s) => !s.id || !selectedIds.has(s.id)));
      if (selectedSale && selectedIds.has(selectedSale.id!)) {
        setSelectedSale(null);
      }
      setSelectedIds(new Set());
    } else {
      toast({
        title: "Delete failed",
        description: result.message || "Failed to delete some sales.",
        variant: "destructive",
      });
      // Remove successfully deleted items
      if (result.successCount && result.successCount > 0) {
        setSales((prev) => prev.filter((s) => !s.id || !selectedIds.has(s.id)));
        setSelectedIds(new Set());
      }
    }
    
    setIsDeleting(false);
    setBulkDeleteDialogOpen(false);
  };

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
            {activeTab === "sales" && (
              <>
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
              </>
            )}
            {activeTab === "gcash" && (
              <>
                <div className="glass-panel rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-xl md:text-2xl font-bold font-mono text-primary">₱{gcashTotal.toFixed(2)}</p>
                </div>
                <div className="glass-panel rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{filteredGcashTransactions.length}</p>
                </div>
              </>
            )}
            {activeTab === "expenses" && (
              <>
                <div className="glass-panel rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-xl md:text-2xl font-bold font-mono text-destructive">₱{totalExpenses.toFixed(2)}</p>
                </div>
                <div className="glass-panel rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Records</p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">{filteredExpenses.length}</p>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value as "sales" | "gcash" | "expenses");
          setCurrentPage(1);
        }} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sales" className="gap-2">
              <Receipt className="w-4 h-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="gcash" className="gap-2">
              <Smartphone className="w-4 h-4" />
              GCash
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Expenses
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="mt-6">
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
                {/* Select All and Bulk Actions Bar */}
                <div className="mb-4 p-3 glass-panel rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                      disabled={paginatedSales.filter(s => s.id).length === 0}
                      className="gap-2"
                    >
                      {selectedIds.size === paginatedSales.filter(s => s.id).length && paginatedSales.filter(s => s.id).length > 0
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                    {selectedIds.size > 0 && (
                      <span className="text-sm text-foreground">
                        {selectedIds.size} sale{selectedIds.size !== 1 ? "s" : ""} selected
                      </span>
                    )}
                  </div>
                  {selectedIds.size > 0 && canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDeleteClick}
                      disabled={isDeleting}
                      className="gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {paginatedSales.map((sale) => {
                    const items = parseItems(sale.items);
                    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
                    const isSelected = sale.id ? selectedIds.has(sale.id) : false;

                    return (
                      <div
                        key={sale.id}
                        className={`w-full p-4 rounded-lg transition-all ${
                          selectedSale?.id === sale.id
                            ? "bg-primary/10 border border-primary/30"
                            : "glass-panel hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(sale.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="flex-1 text-left"
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
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSale(sale);
                                setEditingSale(sale);
                              }}
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              title="Edit sale"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteClick(e, sale)}
                                disabled={isDeleting}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
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
                  {parseItems(selectedSale.items).map((item, idx) => {
                    const displayName = getProductDisplayName(item.productId, item.name, products);
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-foreground">
                          {displayName} <span className="text-muted-foreground">×{item.quantity}</span>
                        </span>
                        <span className="font-mono text-foreground">
                          ₱{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
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

              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setEditingSale(selectedSale)}
                >
                  <Pencil className="w-4 h-4" />
                  Edit Sale
                </Button>
              </div>
            </div>
          )}
        </div>
          </TabsContent>

          {/* GCash Transactions Tab */}
          <TabsContent value="gcash" className="mt-6">
            <div className="flex gap-6">
              <div className="flex-1">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading GCash transactions...</p>
                  </div>
                ) : filteredGcashTransactions.length === 0 ? (
                  <div className="text-center py-12 glass-panel rounded-lg">
                    <Smartphone className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? `No GCash transactions found for "${searchQuery}"` 
                        : dateFilter !== "all" 
                          ? `No GCash transactions for ${dateFilterOptions.find(o => o.value === dateFilter)?.label.toLowerCase()}`
                          : "No GCash transactions recorded yet"
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedGcashTransactions.map((sale) => {
                        const items = parseItems(sale.items);
                        const gcashInItem = items.find(item => item.name === "GCASH-IN");
                        const gcashOutItem = items.find(item => item.name === "GCASH-OUT");
                        const serviceChargeItem = items.find(item => item.name === "Service Charge");
                        const transactionItem = gcashInItem || gcashOutItem;
                        const isGCashIn = !!gcashInItem;
                        
                        if (!transactionItem) return null;

                        const transactionAmount = transactionItem.price * transactionItem.quantity;
                        const serviceChargeAmount = serviceChargeItem ? serviceChargeItem.price * serviceChargeItem.quantity : 0;
                        const totalAmount = transactionAmount + serviceChargeAmount;

                        return (
                          <div
                            key={sale.id}
                            className={`w-full p-4 rounded-lg transition-all ${
                              selectedSale?.id === sale.id
                                ? "bg-primary/10 border border-primary/30"
                                : "glass-panel hover:bg-secondary/50"
                            }`}
                          >
                            <button
                              onClick={() => setSelectedSale(sale)}
                              className="w-full text-left"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${isGCashIn ? 'bg-success/20' : 'bg-info/20'}`}>
                                    {isGCashIn ? (
                                      <ArrowDownCircle className="w-4 h-4 text-success" />
                                    ) : (
                                      <ArrowUpCircle className="w-4 h-4 text-info" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {isGCashIn ? "GCASH-IN" : "GCASH-OUT"}
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(sale.created_at)}
                                    </p>
                                    {serviceChargeAmount > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Service Fee: ₱{serviceChargeAmount.toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <p className="font-mono font-bold text-primary">
                                  ₱{totalAmount.toFixed(2)}
                                </p>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {gcashTotalPages > 1 && (
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
                          Page {currentPage} of {gcashTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(gcashTotalPages, p + 1))}
                          disabled={currentPage === gcashTotalPages}
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
                        <Smartphone className="w-3 h-3 text-info" />
                        {selectedSale.payment_method}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Items</p>
                    <div className="space-y-2">
                      {parseItems(selectedSale.items).map((item, idx) => {
                        const displayName = getProductDisplayName(item.productId, item.name, products);
                        return (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-foreground">
                              {displayName} <span className="text-muted-foreground">×{item.quantity}</span>
                            </span>
                            <span className="font-mono text-foreground">
                              ₱{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="font-mono text-primary">
                        ₱{Number(selectedSale.total).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setEditingSale(selectedSale)}
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Sale
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="mt-6">
            <div className="flex gap-6">
              <div className="flex-1">
                {isLoadingExpenses ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading expenses...</p>
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 glass-panel rounded-lg">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">
                      {searchQuery 
                        ? `No expenses found for "${searchQuery}"` 
                        : dateFilter !== "all" 
                          ? `No expenses for ${dateFilterOptions.find(o => o.value === dateFilter)?.label.toLowerCase()}`
                          : "No expenses recorded yet"
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {paginatedExpenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="w-full p-4 rounded-lg glass-panel hover:bg-secondary/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-destructive/20 rounded-lg">
                                <DollarSign className="w-4 h-4 text-destructive" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {expense.product_name || "Expense"}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(expense.created_at)}
                                </p>
                                {expense.category && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Category: {expense.category}
                                  </p>
                                )}
                                {expense.supplier && (
                                  <p className="text-xs text-muted-foreground">
                                    Supplier: {expense.supplier}
                                  </p>
                                )}
                                {expense.quantity && expense.unit_cost && (
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {expense.quantity} × ₱{Number(expense.unit_cost).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="font-mono font-bold text-destructive">
                              ₱{Number(expense.total_cost || 0).toFixed(2)}
                            </p>
                          </div>
                          {expense.notes && (
                            <p className="text-xs text-muted-foreground mt-2 ml-11 italic">
                              {expense.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {expensesTotalPages > 1 && (
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
                          Page {currentPage} of {expensesTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(expensesTotalPages, p + 1))}
                          disabled={currentPage === expensesTotalPages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale? This action cannot be undone.
              {saleToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p>Total: ₱{Number(saleToDelete.total).toFixed(2)}</p>
                  <p className="text-muted-foreground">
                    {formatDate(saleToDelete.created_at)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Sales</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} sale{selectedIds.size !== 1 ? "s" : ""}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : `Delete ${selectedIds.size} Sale${selectedIds.size !== 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Sale Dialog */}
      {editingSale && (
        <EditSaleDialog
          sale={editingSale}
          products={products}
          onConfirm={() => {
            setEditingSale(null);
            loadSales();
            if (selectedSale?.id === editingSale.id) {
              // Refresh selected sale
              salesApi.getById(editingSale.id!).then((result) => {
                if (result.success && result.data && result.data.length > 0) {
                  setSelectedSale(result.data[0]);
                }
              });
            }
          }}
          onCancel={() => setEditingSale(null)}
        />
      )}
    </div>
  );
}
