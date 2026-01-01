import { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, ShoppingCart, TrendingDown, TrendingUp, Package, Wallet, Smartphone, ArrowRight, Edit2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salesApi, SaleRecord, expensesApi, ExpenseRecord, stockApi, StockAdjustmentRecord, storeFundsApi, StoreFundTransaction, productsApi } from "@/services/mysqlApi";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useToast } from "@/hooks/use-toast";
import { EditSaleDialog } from "@/components/EditSaleDialog";
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
  operatorName?: string;
  details?: any;
  saleId?: string; // For grouping items from same sale
  isFirstInGroup?: boolean; // First item in a transaction group
  isLastInGroup?: boolean; // Last item in a transaction group
}

export function TransactionHistoryDialog({ onClose }: TransactionHistoryDialogProps) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [storeFundsTransactions, setStoreFundsTransactions] = useState<StoreFundTransaction[]>([]);
  const [gcashTransactions, setGcashTransactions] = useState<GCashFundTransaction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);

  const { history: gcashHistory } = useGCashFunds();
  const { refresh: refreshStoreFunds } = useStoreFunds();
  const { products } = useMySQLSync();
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
      // Load only recent transactions (limit to 50 for recent logs)
      const [salesResult, expensesResult, stockResult, storeFundsResult] = await Promise.all([
        salesApi.getAll({ limit: 50 }),
        expensesApi.getAll(50),
        stockApi.getAllHistory(50),
        storeFundsApi.getHistory(50),
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

    // Sales - break down into individual items, grouped by sale
    sales.forEach((sale) => {
      try {
        const items = JSON.parse(sale.items || '[]');
        const saleDate = sale.created_at ? new Date(sale.created_at) : new Date();
        const saleId = `sale-${sale.id}`;
        
        if (items.length > 0) {
          // Create individual transaction entries for each item in the sale
          items.forEach((item: any, index: number) => {
            const itemPrice = (item.price || 0) * (item.quantity || 0);
            // Add service charges if any
            const servicesTotal = (item.selectedServices || []).reduce(
              (sum: number, service: any) => sum + (service.price || 0) * (item.quantity || 0),
              0
            );
            const totalItemAmount = itemPrice + servicesTotal;
            
            transactions.push({
              id: `${saleId}-${index}`,
              type: 'sale',
              amount: totalItemAmount,
              date: saleDate,
              description: `${item.name || 'Item'} (x${item.quantity || 1})`,
              paymentMethod: sale.payment_method,
              operatorName: sale.operator_name,
              details: { ...sale, itemIndex: index },
              saleId: saleId,
              isFirstInGroup: index === 0,
              isLastInGroup: index === items.length - 1,
            });
          });
        } else {
          // Fallback if no items parsed
          transactions.push({
            id: saleId,
            type: 'sale',
            amount: Number(sale.total),
            date: saleDate,
            description: 'Sale',
            paymentMethod: sale.payment_method,
            operatorName: sale.operator_name,
            details: sale,
            saleId: saleId,
            isFirstInGroup: true,
            isLastInGroup: true,
          });
        }
      } catch (e) {
        const saleId = `sale-${sale.id}`;
        transactions.push({
          id: saleId,
          type: 'sale',
          amount: Number(sale.total),
          date: sale.created_at ? new Date(sale.created_at) : new Date(),
          description: 'Sale',
          paymentMethod: sale.payment_method,
          operatorName: sale.operator_name,
          details: sale,
          saleId: saleId,
          isFirstInGroup: true,
          isLastInGroup: true,
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
        operatorName: expense.operator_name,
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
          operatorName: adj.operator_name,
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
        operatorName: tx.operator_name,
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

  // Get only recent transactions (last 30) - group items from same sale together
  const recentTransactions = useMemo(() => {
    // Sort by date (newest first), then by saleId to keep grouped items together
    const sorted = unifiedTransactions.sort((a, b) => {
      // First sort by date
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      
      // If same date, group by saleId (items from same sale stay together)
      if (a.saleId && b.saleId) {
        return a.saleId.localeCompare(b.saleId);
      }
      if (a.saleId) return -1;
      if (b.saleId) return 1;
      
      // For non-sale transactions, keep original order
      return 0;
    });
    return sorted.slice(0, 30);
  }, [unifiedTransactions]);


  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const txDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (txDate.getTime() === today.getTime()) {
      return format(date, 'HH:mm');
    }
    return format(date, 'MMM dd, HH:mm');
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="w-4 h-4" />;
      case 'expense':
      case 'restock':
        return <TrendingDown className="w-4 h-4" />;
      case 'store_funds':
        return <Wallet className="w-4 h-4" />;
      case 'gcash':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: TransactionType, amount: number) => {
    if (amount >= 0) {
      return 'text-success';
    }
    return 'text-destructive';
  };

  const getTransactionTypeLabel = (type: TransactionType) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'expense':
        return 'Expense';
      case 'restock':
        return 'Restock';
      case 'store_funds':
        return 'Store Funds';
      case 'gcash':
        return 'GCash';
      default:
        return type;
    }
  };

  // Group transactions by sale for better display
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: UnifiedTransaction[] } = {};
    const ungrouped: UnifiedTransaction[] = [];

    recentTransactions.forEach((tx) => {
      if (tx.saleId && tx.type === 'sale') {
        if (!groups[tx.saleId]) {
          groups[tx.saleId] = [];
        }
        groups[tx.saleId].push(tx);
      } else {
        ungrouped.push(tx);
      }
    });

    return { groups, ungrouped };
  }, [recentTransactions]);

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 border-2 border-primary/20">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Transaction History</h2>
            <p className="text-sm text-muted-foreground">Recent {recentTransactions.length} transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllTransactions}
            disabled={isLoading}
            className="gap-2 metro-tile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors metro-tile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
            <p>Loading transactions...</p>
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No transactions found</p>
            <p className="text-sm mt-1">Transactions will appear here as they occur</p>
          </div>
        ) : (
          <>
            {/* Grouped Sales */}
            {Object.entries(groupedTransactions.groups).map(([saleId, items]) => {
                const firstItem = items[0];
                const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
                // Extract sale ID from saleId (format: "sale-{id}")
                const saleIdNumber = saleId.replace('sale-', '');
                const saleRecord = sales.find(s => String(s.id) === saleIdNumber);
                
                return (
                  <div key={saleId} className="bg-card border-2 border-border p-4 space-y-2 metro-tile">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-border">
                      <div className="flex items-center gap-3 flex-1">
                        {getTransactionIcon('sale')}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-foreground">
                              {formatDate(firstItem.date)}
                            </div>
                            {saleRecord?.is_unpaid && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning/20 text-warning text-xs font-semibold rounded border border-warning/50">
                                <AlertCircle className="w-3 h-3" />
                                UNPAID
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {firstItem.paymentMethod || 'Cash'} • {items.length} item{items.length > 1 ? 's' : ''}
                          </div>
                          {saleRecord?.is_unpaid && saleRecord.unpaid_notes && (
                            <div className="text-xs text-warning mt-1 italic">
                              {saleRecord.unpaid_notes}
                            </div>
                          )}
                        </div>
                        {saleRecord && (
                          <button
                            onClick={() => setEditingSale(saleRecord)}
                            className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors metro-tile"
                            title="Edit sale"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className={`text-xl font-bold font-mono ${getTransactionColor('sale', totalAmount)}`}>
                        ₱{Math.abs(totalAmount).toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1 pl-8">
                      {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-1">
                          <span className="text-foreground flex items-center gap-2">
                            {idx < items.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                            {item.description}
                          </span>
                          <span className={`font-mono font-semibold ${getTransactionColor('sale', item.amount)}`}>
                            ₱{Math.abs(item.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {firstItem.operatorName && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                        Operator: {firstItem.operatorName}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Ungrouped Transactions */}
              {groupedTransactions.ungrouped.map((tx) => {
                // Check if this is a sale transaction that can be edited
                const saleRecord = tx.type === 'sale' && tx.details?.id 
                  ? sales.find(s => String(s.id) === String(tx.details.id))
                  : null;
                
                return (
                  <div
                    key={tx.id}
                    className="bg-card border-2 border-border p-4 metro-tile"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-3 border-2 ${
                          tx.amount >= 0 
                            ? 'bg-success/10 border-success/30' 
                            : 'bg-destructive/10 border-destructive/30'
                        }`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-base text-foreground truncate">
                              {tx.description}
                            </span>
                            <span className="text-xs px-2 py-1 bg-secondary border border-border text-muted-foreground shrink-0">
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium">{formatDate(tx.date)}</span>
                            {tx.category && (
                              <>
                                <span>•</span>
                                <span>{tx.category}</span>
                              </>
                            )}
                            {tx.operatorName && (
                              <>
                                <span>•</span>
                                <span>{tx.operatorName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {saleRecord && (
                          <button
                            onClick={() => setEditingSale(saleRecord)}
                            className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors metro-tile"
                            title="Edit sale"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className={`text-xl font-bold font-mono shrink-0 ${getTransactionColor(tx.type, tx.amount)}`}>
                          {tx.amount >= 0 ? '+' : ''}₱{Math.abs(tx.amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>

      {/* Edit Sale Dialog */}
      {editingSale && (
        <EditSaleDialog
          sale={editingSale}
          products={products}
          onConfirm={() => {
            setEditingSale(null);
            loadAllTransactions();
            toast({
              title: "Sale Updated",
              description: "Transaction has been updated successfully",
            });
          }}
          onCancel={() => setEditingSale(null)}
        />
      )}
    </div>
  );
}

