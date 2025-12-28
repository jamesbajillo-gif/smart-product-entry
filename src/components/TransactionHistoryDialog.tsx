import { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Receipt, FileText, Truck, Wallet, Smartphone, Filter, Calendar, TrendingUp, TrendingDown, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { salesApi, SaleRecord, expensesApi, ExpenseRecord, stockApi, StockAdjustmentRecord, storeFundsApi, StoreFundTransaction, productsApi } from "@/services/mysqlApi";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TransactionHistoryDialogProps {
  onClose: () => void;
}

type TransactionType = 'sale' | 'expense' | 'restock' | 'store_funds' | 'gcash';

interface UnifiedTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description: string;
  paymentMethod?: string;
  category?: string;
  details?: any;
}

export function TransactionHistoryDialog({ onClose }: TransactionHistoryDialogProps) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [storeFundsTransactions, setStoreFundsTransactions] = useState<StoreFundTransaction[]>([]);
  const [gcashTransactions, setGcashTransactions] = useState<GCashFundTransaction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TransactionType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<UnifiedTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { history: gcashHistory } = useGCashFunds();
  const { refresh: refreshStoreFunds } = useStoreFunds();
  const { toast } = useToast();

  useEffect(() => {
    loadAllTransactions();
  }, []);

  useEffect(() => {
    setGcashTransactions(gcashHistory || []);
  }, [gcashHistory]);

  const loadAllTransactions = async () => {
    setIsLoading(true);
    try {
      // Load all transaction types in parallel
      const [salesResult, expensesResult, stockResult, storeFundsResult] = await Promise.all([
        salesApi.getAll({ limit: 500 }),
        expensesApi.getAll(500),
        stockApi.getAllHistory(500),
        storeFundsApi.getHistory(500),
      ]);

      if (salesResult.success && salesResult.data) {
        setSales(salesResult.data);
      }
      if (expensesResult.success && expensesResult.data) {
        setExpenses(expensesResult.data);
      }
      if (stockResult.success && stockResult.data) {
        // Filter only restocking transactions (those with unit_cost)
        const restocks = stockResult.data.filter(adj => adj.unit_cost && adj.unit_cost > 0);
        setStockAdjustments(restocks);
      }
      if (storeFundsResult.success && storeFundsResult.data) {
        setStoreFundsTransactions(storeFundsResult.data);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert all transactions to unified format
  const unifiedTransactions = useMemo(() => {
    const transactions: UnifiedTransaction[] = [];

    // Sales
    sales.forEach((sale) => {
      try {
        const items = JSON.parse(sale.items || '[]');
        const itemNames = items.map((item: any) => `${item.name} (x${item.quantity})`).join(', ');
        transactions.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          amount: Number(sale.total),
          date: sale.created_at ? new Date(sale.created_at) : new Date(),
          description: itemNames || 'Sale',
          paymentMethod: sale.payment_method,
          details: sale,
        });
      } catch (e) {
        transactions.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          amount: Number(sale.total),
          date: sale.created_at ? new Date(sale.created_at) : new Date(),
          description: 'Sale',
          paymentMethod: sale.payment_method,
          details: sale,
        });
      }
    });

    // Expenses
    expenses.forEach((expense) => {
      const description = expense.product_name 
        ? `${expense.product_name}${expense.quantity > 1 ? ` (${expense.quantity} units)` : ''}`
        : 'Expense';
      transactions.push({
        id: `expense-${expense.id}`,
        type: 'expense',
        amount: -Number(expense.total_cost), // Negative for expenses
        date: expense.created_at ? new Date(expense.created_at) : new Date(),
        description: description,
        category: expense.category,
        details: expense,
      });
    });

    // Stock Adjustments (Restocking)
    stockAdjustments.forEach((adj) => {
      if (adj.unit_cost && adj.total_cost) {
        transactions.push({
          id: `restock-${adj.id}`,
          type: 'restock',
          amount: -Number(adj.total_cost), // Negative for expenses
          date: adj.created_at ? new Date(adj.created_at) : new Date(),
          description: `Restock: ${adj.reason || 'Stock adjustment'}`,
          category: adj.supplier || 'Restock',
          details: adj,
        });
      }
    });

    // Store Funds
    storeFundsTransactions.forEach((tx) => {
      const isExpense = tx.transaction_type === 'withdraw' || tx.transaction_type === 'expense';
      transactions.push({
        id: `store-funds-${tx.id}`,
        type: 'store_funds',
        amount: isExpense ? -Number(tx.amount) : Number(tx.amount),
        date: tx.created_at ? new Date(tx.created_at) : new Date(),
        description: tx.notes || `${tx.transaction_type} - Store Funds`,
        category: tx.category || tx.transaction_type,
        details: tx,
      });
    });

    // GCash Transactions
    gcashTransactions.forEach((tx) => {
      let description = '';
      let amount = 0;
      
      if (tx.type === 'add') {
        description = 'GCash: Add Funds';
        amount = Number(tx.amount);
      } else if (tx.type === 'gcash-in') {
        description = 'GCash: Cash-In Transaction';
        amount = Number(tx.amount); // Customer pays cash, we send GCash
      } else if (tx.type === 'gcash-out') {
        description = 'GCash: Cash-Out Transaction';
        amount = -Number(tx.amount); // Customer sends GCash, we give cash
      }

      if (tx.notes) {
        description += ` - ${tx.notes}`;
      }

      transactions.push({
        id: tx.id,
        type: 'gcash',
        amount,
        date: new Date(tx.timestamp),
        description,
        details: tx,
      });
    });

    // Sort by date (newest first)
    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sales, expenses, stockAdjustments, storeFundsTransactions, gcashTransactions]);

  // Filter by date
  const filteredTransactions = useMemo(() => {
    let filtered = unifiedTransactions;

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(tx => tx.date >= startDate);
    }

    // Apply type filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(tx => tx.type === activeTab);
    }

    return filtered;
  }, [unifiedTransactions, activeTab, dateFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = filteredTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const net = income - expenses;

    return { income, expenses, net };
  }, [filteredTransactions]);

  const formatDate = (date: Date) => {
    return format(date, 'MMM dd, yyyy HH:mm');
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'sale':
        return <Receipt className="w-4 h-4" />;
      case 'expense':
        return <FileText className="w-4 h-4" />;
      case 'restock':
        return <Truck className="w-4 h-4" />;
      case 'store_funds':
        return <Wallet className="w-4 h-4" />;
      case 'gcash':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: TransactionType) => {
    switch (type) {
      case 'sale':
        return 'text-success';
      case 'expense':
      case 'restock':
        return 'text-destructive';
      case 'store_funds':
        return 'text-primary';
      case 'gcash':
        return 'text-info';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-[98vw] mx-4 max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Transaction History</h2>
              <p className="text-sm text-muted-foreground">All financial transactions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllTransactions}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-panel rounded-lg p-4 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm text-muted-foreground">Total Income</span>
            </div>
            <p className="text-2xl font-bold text-success">₱{totals.income.toFixed(2)}</p>
          </div>
          <div className="glass-panel rounded-lg p-4 border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold text-destructive">₱{totals.expenses.toFixed(2)}</p>
          </div>
          <div className={`glass-panel rounded-lg p-4 border ${totals.net >= 0 ? 'border-success/20' : 'border-destructive/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Receipt className={`w-4 h-4 ${totals.net >= 0 ? 'text-success' : 'text-destructive'}`} />
              <span className="text-sm text-muted-foreground">Net Amount</span>
            </div>
            <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-success' : 'text-destructive'}`}>
              ₱{totals.net.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 bg-input rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sale">Sales</TabsTrigger>
            <TabsTrigger value="expense">Expenses</TabsTrigger>
            <TabsTrigger value="restock">Restocking</TabsTrigger>
            <TabsTrigger value="store_funds">Store Funds</TabsTrigger>
            <TabsTrigger value="gcash">GCash</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="glass-panel rounded-lg p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${getTransactionColor(tx.type)}/20`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{tx.description}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                            {tx.category && (
                              <span className="text-xs px-2 py-0.5 bg-secondary rounded text-muted-foreground">
                                {tx.category}
                              </span>
                            )}
                            {tx.paymentMethod && (
                              <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                                {tx.paymentMethod}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${tx.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {tx.amount >= 0 ? '+' : ''}₱{Math.abs(tx.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

