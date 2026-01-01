import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Smartphone,
  Calendar,
  RefreshCw,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Zap,
  Filter,
  X
} from "lucide-react";
import { format } from "date-fns";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type DateFilter = "today" | "week" | "month" | "all";
type TransactionTypeFilter = "all" | "gcash-in" | "gcash-out" | "add-credits" | "add-cash" | "load";

const ITEMS_PER_PAGE = 20;

// Format date to MySQL compatible format
const formatMySQLDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export default function GCashTransactions() {
  const { credits, cash, history, refresh } = useGCashFunds();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      await refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load GCash transactions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate date range based on filter
  const getDateRange = (filter: DateFilter): { from?: Date; to?: Date } => {
    const now = new Date();
    
    switch (filter) {
      case "today":
        return {
          from: startOfDay(now),
          to: endOfDay(now),
        };
      case "week":
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "month":
        return {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
      case "all":
      default:
        return {};
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...(history || [])];

    // Date filter
    const dateRange = getDateRange(dateFilter);
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.timestamp);
        return txDate >= dateRange.from! && txDate <= dateRange.to!;
      });
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => {
        const isLoad = tx.notes?.toLowerCase().includes('load:') || tx.notes?.toLowerCase().startsWith('load');
        if (typeFilter === "load") {
          return isLoad;
        }
        if (typeFilter === "add-credits") {
          return (tx.type === "add" || tx.type === "add-credits") && !isLoad;
        }
        return tx.type === typeFilter && !isLoad;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) => {
        return (
          tx.notes?.toLowerCase().includes(query) ||
          tx.gcashNumber?.toLowerCase().includes(query) ||
          tx.type.toLowerCase().includes(query) ||
          tx.operatorName?.toLowerCase().includes(query)
        );
      });
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered;
  }, [history, dateFilter, typeFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      totalCreditsAdded: 0,
      totalCreditsDeducted: 0,
      totalCashAdded: 0,
      totalCashDeducted: 0,
      gcashInCount: 0,
      gcashOutCount: 0,
      gcashInAmount: 0,
      gcashOutAmount: 0,
    };

    filteredTransactions.forEach((tx) => {
      // Check if this is a load transaction (detected from notes)
      const isLoadTransaction = tx.notes?.toLowerCase().includes('load:') || tx.notes?.toLowerCase().startsWith('load');
      
      // Calculate previous balances based on transaction type
      let prevCredits = tx.creditsBalance;
      let prevCash = tx.cashBalance;
      
      if (isLoadTransaction && tx.type === "add-cash") {
        // Load transaction: deducts from credits, adds to cash
        // Parse load amount and GCash fee from notes or calculate from balances
        // For load: credits decrease, cash increases
        // We need to reverse calculate: if cash increased by tx.amount, credits decreased by (load + gcash fee)
        // Since we don't have exact breakdown, estimate from service charge (transaction fee)
        const loadAmount = tx.amount - (tx.serviceCharge || 0); // Approximate: total - transaction fee
        const gcashFee = 0; // We can't determine this from the transaction alone
        prevCredits = tx.creditsBalance + loadAmount; // Credits were deducted
        prevCash = tx.cashBalance - tx.amount; // Cash was added
      } else if (tx.type === "add" || tx.type === "add-credits") {
        prevCredits = tx.creditsBalance - tx.amount;
      } else if (tx.type === "gcash-in") {
        prevCredits = tx.creditsBalance + tx.amount;
      } else if (tx.type === "gcash-out") {
        prevCredits = tx.creditsBalance - tx.amount;
      }
      
      if (!isLoadTransaction) {
        if (tx.type === "add" || tx.type === "add-cash") {
          prevCash = tx.cashBalance - tx.amount;
        } else if (tx.type === "gcash-in") {
          prevCash = tx.cashBalance - tx.amount - (tx.serviceCharge || 0);
        } else if (tx.type === "gcash-out") {
          prevCash = tx.cashBalance + tx.amount - (tx.serviceCharge || 0);
        }
      }
      
      const creditsChange = tx.creditsBalance - prevCredits;
      const cashChange = tx.cashBalance - prevCash;

      if (creditsChange > 0) stats.totalCreditsAdded += creditsChange;
      if (creditsChange < 0) stats.totalCreditsDeducted += Math.abs(creditsChange);
      if (cashChange > 0) stats.totalCashAdded += cashChange;
      if (cashChange < 0) stats.totalCashDeducted += Math.abs(cashChange);

      if (tx.type === "gcash-in") {
        stats.gcashInCount++;
        stats.gcashInAmount += tx.amount;
      }
      if (tx.type === "gcash-out") {
        stats.gcashOutCount++;
        stats.gcashOutAmount += tx.amount;
      }
    });

    return stats;
  }, [filteredTransactions]);

  const getTransactionIcon = (type: string, notes?: string) => {
    const isLoad = notes?.toLowerCase().includes('load:') || notes?.toLowerCase().startsWith('load');
    if (isLoad) {
      return <Zap className="w-5 h-5 text-info" />;
    }
    switch (type) {
      case "gcash-in":
        return <ArrowDownCircle className="w-5 h-5 text-success" />;
      case "gcash-out":
        return <ArrowUpCircle className="w-5 h-5 text-info" />;
      case "add":
      case "add-credits":
        return <TrendingUp className="w-5 h-5 text-primary" />;
      case "add-cash":
        return <Wallet className="w-5 h-5 text-warning" />;
      default:
        return <Smartphone className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTransactionLabel = (type: string, notes?: string) => {
    const isLoad = notes?.toLowerCase().includes('load:') || notes?.toLowerCase().startsWith('load');
    if (isLoad) {
      return "LOAD";
    }
    switch (type) {
      case "gcash-in":
        return "GCASH-IN";
      case "gcash-out":
        return "GCASH-OUT";
      case "add":
      case "add-credits":
        return "Add Credits";
      case "add-cash":
        return "Add Cash";
      default:
        return type;
    }
  };

  const getTransactionColor = (type: string, notes?: string) => {
    const isLoad = notes?.toLowerCase().includes('load:') || notes?.toLowerCase().startsWith('load');
    if (isLoad) {
      return "text-info";
    }
    switch (type) {
      case "gcash-in":
        return "text-success";
      case "gcash-out":
        return "text-info";
      case "add":
      case "add-credits":
        return "text-primary";
      case "add-cash":
        return "text-warning";
      default:
        return "text-muted-foreground";
    }
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMM dd, yyyy HH:mm");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">GCash Transactions</h1>
                <p className="text-sm text-muted-foreground">Detailed transaction history and credit flows</p>
              </div>
            </div>
          </div>
          <Button onClick={loadTransactions} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">GCash Credits</span>
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <div className={`text-2xl font-bold font-mono ${credits < 0 ? 'text-destructive' : 'text-primary'}`}>
              ₱{credits.toFixed(2)}
              {credits < 0 && <span className="ml-2 text-sm">(Negative)</span>}
            </div>
          </div>
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">GCash Cash</span>
              <Wallet className="w-4 h-4 text-warning" />
            </div>
            <div className="text-2xl font-bold font-mono text-warning">
              ₱{cash.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Credits Added</div>
            <div className="text-lg font-bold font-mono text-primary">
              ₱{statistics.totalCreditsAdded.toFixed(2)}
            </div>
          </div>
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Credits Deducted</div>
            <div className="text-lg font-bold font-mono text-destructive">
              ₱{statistics.totalCreditsDeducted.toFixed(2)}
            </div>
          </div>
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Cash Added</div>
            <div className="text-lg font-bold font-mono text-warning">
              ₱{statistics.totalCashAdded.toFixed(2)}
            </div>
          </div>
          <div className="bg-card border-2 border-border p-4 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Cash Deducted</div>
            <div className="text-lg font-bold font-mono text-destructive">
              ₱{statistics.totalCashDeducted.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border-2 border-border p-4 rounded-lg mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as DateFilter);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-input border border-border rounded-lg text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as TransactionTypeFilter);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-input border border-border rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="gcash-in">GCASH-IN</option>
                <option value="gcash-out">GCASH-OUT</option>
                <option value="add-credits">Add Credits</option>
                <option value="add-cash">Add Cash</option>
                <option value="load">Load</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">
                {searchQuery || dateFilter !== "all" || typeFilter !== "all"
                  ? "No transactions found matching your filters"
                  : "No GCash transactions recorded yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {paginatedTransactions.map((tx) => {
                  // Calculate previous balances based on transaction type
                  let prevCredits = tx.creditsBalance;
                  let prevCash = tx.cashBalance;
                  
                  if (tx.type === "add" || tx.type === "add-credits") {
                    prevCredits = tx.creditsBalance - tx.amount;
                  } else if (tx.type === "gcash-in") {
                    prevCredits = tx.creditsBalance + tx.amount; // We deducted, so previous was higher
                  } else if (tx.type === "gcash-out") {
                    prevCredits = tx.creditsBalance - tx.amount; // We added, so previous was lower
                  }
                  
                  if (tx.type === "add" || tx.type === "add-cash") {
                    prevCash = tx.cashBalance - tx.amount;
                  } else if (tx.type === "gcash-in") {
                    prevCash = tx.cashBalance - tx.amount - (tx.serviceCharge || 0); // We added cash
                  } else if (tx.type === "gcash-out") {
                    prevCash = tx.cashBalance + tx.amount - (tx.serviceCharge || 0); // We deducted cash
                  }
                  
                  const creditsChange = tx.creditsBalance - prevCredits;
                  const cashChange = tx.cashBalance - prevCash;

                  return (
                    <div key={tx.id} className="p-4 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getTransactionColor(tx.type, tx.notes).replace('text-', 'bg-').replace('-', '/20')} border-2 ${getTransactionColor(tx.type, tx.notes).replace('text-', 'border-').replace('-', '/30')}`}>
                          {getTransactionIcon(tx.type, tx.notes)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${getTransactionColor(tx.type, tx.notes)}`}>
                                  {getTransactionLabel(tx.type, tx.notes)}
                                </span>
                                {tx.serviceCharge && tx.serviceCharge > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded border border-warning/30">
                                    Service: ₱{tx.serviceCharge.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDate(tx.timestamp)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold font-mono ${getTransactionColor(tx.type)}`}>
                                ₱{tx.amount.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Credit Flow */}
                          {creditsChange !== 0 && (
                            <div className="flex items-center gap-2 text-sm mb-1">
                              <span className="text-muted-foreground">Credits:</span>
                              <span className={`font-mono ${creditsChange > 0 ? 'text-primary' : 'text-destructive'}`}>
                                {creditsChange > 0 ? '+' : ''}₱{creditsChange.toFixed(2)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className={`font-mono font-semibold ${tx.creditsBalance < 0 ? 'text-destructive' : 'text-primary'}`}>
                                ₱{tx.creditsBalance.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* Cash Flow */}
                          {cashChange !== 0 && (
                            <div className="flex items-center gap-2 text-sm mb-1">
                              <span className="text-muted-foreground">Cash:</span>
                              <span className={`font-mono ${cashChange > 0 ? 'text-warning' : 'text-destructive'}`}>
                                {cashChange > 0 ? '+' : ''}₱{cashChange.toFixed(2)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono font-semibold text-warning">
                                ₱{tx.cashBalance.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* Additional Info */}
                          {(tx.notes || tx.gcashNumber) && (
                            <div className="text-xs text-muted-foreground mt-2 space-y-1">
                              {tx.gcashNumber && (
                                <div>GCash Number: {tx.gcashNumber}</div>
                              )}
                              {tx.notes && (
                                <div className="italic">{tx.notes}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

