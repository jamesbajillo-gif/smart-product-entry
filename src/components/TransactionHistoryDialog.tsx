import { useState, useEffect, useMemo } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    return format(date, 'MMM dd, yyyy HH:mm');
  };

  const formatLogLine = (tx: UnifiedTransaction, prevTx: UnifiedTransaction | null, nextTx: UnifiedTransaction | null) => {
    const dateStr = formatDate(tx.date);
    const amountStr = `${tx.amount >= 0 ? '+' : ''}₱${Math.abs(tx.amount).toFixed(2)}`;
    const typeStr = tx.type.toUpperCase().padEnd(12);
    
    // Check if this is part of a grouped sale
    const isGroupedSale = tx.saleId && tx.type === 'sale';
    const isFirstInGroup = tx.isFirstInGroup || (isGroupedSale && (!prevTx || prevTx.saleId !== tx.saleId));
    const isLastInGroup = tx.isLastInGroup || (isGroupedSale && (!nextTx || nextTx.saleId !== tx.saleId));
    
    // Check if previous transaction was from a different sale (need blank line before this transaction)
    const isNewTransaction = !prevTx || !prevTx.saleId || prevTx.saleId !== tx.saleId;
    
    let line = '';
    
    if (isFirstInGroup && isGroupedSale) {
      // First item in grouped sale - show with opening bracket
      line = `${dateStr} | ${typeStr} | [ ${tx.description.padEnd(35)} | ${amountStr}`;
    } else if (isLastInGroup && isGroupedSale && !isFirstInGroup) {
      // Last item in grouped sale - show with closing bracket
      line = `                | ${typeStr} |   ${tx.description.padEnd(35)} | ${amountStr} ]`;
    } else if (isGroupedSale && !isFirstInGroup && !isLastInGroup) {
      // Middle item in grouped sale - indented, no brackets
      line = `                | ${typeStr} |   ${tx.description.padEnd(35)} | ${amountStr}`;
    } else {
      // Regular transaction (not grouped or single item sale)
      line = `${dateStr} | ${typeStr} | ${tx.description.padEnd(40)} | ${amountStr}`;
    }
    
    // Add blank line before new transaction (different sale)
    return isNewTransaction && prevTx ? `\n${line}` : line;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-2 sm:p-4">
      <div className="bg-background border border-border rounded-lg p-4 sm:p-6 w-full max-w-[98vw] max-h-[95vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Transaction Logs</h2>
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

        {/* Plain Text Logs */}
        <div className="flex-1 overflow-y-auto bg-secondary/30 rounded p-4 font-mono text-sm">
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-muted-foreground">No transactions found</div>
          ) : (
            <pre className="whitespace-pre-wrap text-foreground">
              {recentTransactions.map((tx, index) => 
                formatLogLine(
                  tx, 
                  index > 0 ? recentTransactions[index - 1] : null,
                  index < recentTransactions.length - 1 ? recentTransactions[index + 1] : null
                )
              ).join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

