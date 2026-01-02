import { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Smartphone, Zap, ChevronDown, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
import { salesApi, SaleRecord } from "@/services/mysqlApi";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { getProductDisplayName } from "@/utils/productDisplay";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TransactionTypeHistoryDialogProps {
  onClose: () => void;
}

type TransactionFilterType = "sales" | "gcash" | "load";

export function TransactionTypeHistoryDialog({ onClose }: TransactionTypeHistoryDialogProps) {
  const [filterType, setFilterType] = useState<TransactionFilterType>("sales");
  const [isLoading, setIsLoading] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);

  const { credits: gcashCredits, cash: gcashCash, history: gcashHistory, refresh } = useGCashFunds();
  const { products } = useMySQLSync();

  useEffect(() => {
    loadTransactions();
  }, [filterType]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      if (filterType === "sales") {
        // Load sales transactions
        const result = await salesApi.getAll({ limit: 1000 });
        if (result.success && result.data) {
          // Sort by date, newest first
          const sortedSales = [...result.data].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // Most recent first
          });
          setSales(sortedSales);
        }
      } else {
        // Load GCash transactions
        await refresh();
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter transactions based on selected type
  const filteredTransactions = useMemo(() => {
    if (filterType === "sales") {
      // Return sales as array for consistent rendering
      return sales.map((sale, index) => ({
        id: `sale-${sale.id || index}`,
        type: "sale" as const,
        sale: sale,
        timestamp: sale.created_at ? new Date(sale.created_at).getTime() : Date.now(),
      }));
    }
    
    if (!gcashHistory) return [];

    if (filterType === "load") {
      // Load transactions are identified by notes containing "Load:"
      return gcashHistory.filter((tx) => 
        tx.notes?.toLowerCase().includes("load:") || 
        tx.notes?.toLowerCase().startsWith("load")
      );
    } else {
      // GCash transactions (gcash-in, gcash-out, add credits/cash) - exclude Load
      return gcashHistory.filter((tx) => 
        !tx.notes?.toLowerCase().includes("load:") && 
        !tx.notes?.toLowerCase().startsWith("load")
      );
    }
  }, [gcashHistory, filterType, sales]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const txDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (txDate.getTime() === today.getTime()) {
      return format(date, "HH:mm");
    }
    return format(date, "MMM dd, HH:mm");
  };

  const getTransactionLabel = (tx: GCashFundTransaction | any) => {
    if (filterType === "sales" && tx.type === "sale") {
      // For sales, show total amount
      return `Sale #${tx.sale.id || 'N/A'}`;
    }
    
    const isLoad = tx.notes?.toLowerCase().includes("load:") || tx.notes?.toLowerCase().startsWith("load");
    if (isLoad) return "LOAD";
    
    switch (tx.type) {
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
        return tx.type;
    }
  };

  const getTransactionColor = (tx: GCashFundTransaction | any) => {
    if (filterType === "sales" && tx.type === "sale") {
      return "text-success";
    }
    
    const isLoad = tx.notes?.toLowerCase().includes("load:") || tx.notes?.toLowerCase().startsWith("load");
    if (isLoad) return "text-info";
    
    switch (tx.type) {
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

  const getTransactionIcon = (tx: GCashFundTransaction | any) => {
    if (filterType === "sales" && tx.type === "sale") {
      return <ShoppingCart className="w-4 h-4 text-success" />;
    }
    
    const isLoad = tx.notes?.toLowerCase().includes("load:") || tx.notes?.toLowerCase().startsWith("load");
    if (isLoad) return <Zap className="w-4 h-4 text-info" />;
    return <Smartphone className="w-4 h-4 text-primary" />;
  };

  // Format sale items for display - returns summary and full list
  const formatSaleItems = (sale: SaleRecord): { summary: string; itemCount: number; items: string[] } => {
    try {
      const items: any[] = JSON.parse(sale.items || '[]');
      const itemNames: string[] = [];
      let totalQty = 0;
      
      items.forEach((item: any) => {
        const itemName = item.name || '';
        // Skip special transaction items
        if (itemName === 'GCASH-IN' || itemName === 'GCASH-OUT' || itemName === 'Service Charge') {
          return;
        }
        
        if (itemName) {
          const displayName = getProductDisplayName(
            item.productId || '',
            itemName,
            products
          );
          const qty = item.quantity || 1;
          totalQty += qty;
          itemNames.push(`${displayName}${qty > 1 ? ` (x${qty})` : ''}`);
        }
      });
      
      const itemCount = itemNames.length;
      const summary = itemCount > 0 
        ? `${itemCount} item${itemCount > 1 ? 's' : ''} • ${totalQty} unit${totalQty > 1 ? 's' : ''}`
        : 'No items';
      
      return { summary, itemCount, items: itemNames };
    } catch (error) {
      return { summary: 'Error parsing items', itemCount: 0, items: [] };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 border-2 border-primary/20">
            {filterType === "sales" ? (
              <ShoppingCart className="w-5 h-5 text-success" />
            ) : filterType === "load" ? (
              <Zap className="w-5 h-5 text-info" />
            ) : (
              <Smartphone className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Transaction History</h2>
            <p className="text-sm text-muted-foreground">
              {filteredTransactions.length} {filterType === "sales" ? "Sales" : filterType === "load" ? "Load" : "GCash"} transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Dropdown Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {filterType === "sales" ? (
                  <>
                    <ShoppingCart className="w-4 h-4 text-success" />
                    Sales
                  </>
                ) : filterType === "gcash" ? (
                  <>
                    <Smartphone className="w-4 h-4 text-primary" />
                    GCash Transactions
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-info" />
                    Load Transactions
                  </>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-2 border-border z-[60]">
              <DropdownMenuItem 
                onClick={() => setFilterType("sales")}
                className="gap-2 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4 text-success" />
                Sales
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setFilterType("gcash")}
                className="gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-primary" />
                GCash Transactions
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setFilterType("load")}
                className="gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-info" />
                Load Transactions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={loadTransactions}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Balance Summary - Only for GCash */}
      {filterType === "gcash" && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 border-b border-border">
          <div className="bg-card border-2 border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">GCash Credits</div>
            <div className={`text-xl font-bold font-mono ${gcashCredits < 0 ? "text-destructive" : "text-primary"}`}>
              ₱{gcashCredits.toFixed(2)}
            </div>
          </div>
          <div className="bg-card border-2 border-border p-3">
            <div className="text-xs text-muted-foreground mb-1">GCash Cash</div>
            <div className="text-xl font-bold font-mono text-warning">
              ₱{gcashCash.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
            <p>Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {filterType === "sales" ? (
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            ) : filterType === "load" ? (
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            ) : (
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            )}
            <p className="text-lg">No {filterType === "sales" ? "Sales" : filterType === "load" ? "Load" : "GCash"} transactions found</p>
            <p className="text-sm mt-1">Transactions will appear here as they occur</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            // Handle sales differently
            if (filterType === "sales" && tx.type === "sale") {
              const sale = tx.sale as SaleRecord;
              const itemsInfo = formatSaleItems(sale);
              const isUnpaid = sale.is_unpaid === 1;
              
              return (
                <div
                  key={tx.id}
                  className={`bg-card border-2 ${isUnpaid ? 'border-destructive/30' : 'border-border'} p-4 hover:border-primary/30 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 rounded ${isUnpaid ? 'bg-destructive/10' : 'bg-success/10'}`}>
                        <ShoppingCart className={`w-4 h-4 ${isUnpaid ? 'text-destructive' : 'text-success'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${isUnpaid ? 'text-destructive' : 'text-success'}`}>
                            Sale #{sale.id || 'N/A'}
                          </span>
                          {isUnpaid && (
                            <span className="px-1.5 py-0.5 text-xs font-semibold bg-destructive/20 text-destructive rounded border border-destructive/30">
                              UNPAID
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {formatDate(tx.timestamp)}
                          {sale.operator_name && ` • ${sale.operator_name}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {itemsInfo.summary}
                          {itemsInfo.itemCount > 0 && itemsInfo.itemCount <= 3 && (
                            <span className="ml-2 text-xs">• {itemsInfo.items.join(', ')}</span>
                          )}
                        </div>
                        {sale.unpaid_notes && (
                          <div className="mt-1.5 text-xs text-destructive italic">
                            Note: {sale.unpaid_notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xl font-bold font-mono ${isUnpaid ? 'text-destructive' : 'text-success'}`}>
                        ₱{Number(sale.total).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {sale.payment_method || 'Cash'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Handle GCash/Load transactions (existing code)
            const gcashTx = tx as GCashFundTransaction;
            const isLoad = gcashTx.notes?.toLowerCase().includes("load:") || gcashTx.notes?.toLowerCase().startsWith("load");
            const txColor = getTransactionColor(gcashTx);
            const txLabel = getTransactionLabel(gcashTx);
            
            return (
              <div
                key={gcashTx.id}
                className="bg-card border-2 border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded ${isLoad ? 'bg-info/10' : txColor === 'text-success' ? 'bg-success/10' : txColor === 'text-primary' ? 'bg-primary/10' : 'bg-warning/10'}`}>
                      {getTransactionIcon(gcashTx)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold ${txColor}`}>
                          {txLabel}
                        </span>
                        {gcashTx.serviceCharge > 0 && (
                          <span className="px-1.5 py-0.5 text-xs font-semibold bg-success/20 text-success rounded border border-success/30">
                            +₱{gcashTx.serviceCharge.toFixed(2)} fee
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1.5">
                        {formatDate(gcashTx.timestamp)}
                      </div>
                      {gcashTx.notes && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {gcashTx.notes}
                        </div>
                      )}
                      {gcashTx.gcashNumber && (
                        <div className="text-xs text-muted-foreground mt-1">
                          📱 {gcashTx.gcashNumber}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xl font-bold font-mono ${txColor}`}>
                      ₱{gcashTx.amount.toFixed(2)}
                    </div>
                    {/* Show balance only if it's relevant - simplified */}
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div>Credits: ₱{gcashTx.creditsBalance.toFixed(2)}</div>
                      <div>Cash: ₱{gcashTx.cashBalance.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard Hint */}
      <div className="p-3 border-t border-border bg-card text-center text-sm text-muted-foreground">
        Press <kbd className="px-2 py-1 bg-secondary text-xs font-mono mx-1">Tab</kbd> to close
      </div>
    </div>
  );
}
