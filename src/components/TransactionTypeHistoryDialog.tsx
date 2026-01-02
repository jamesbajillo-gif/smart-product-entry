import { useState, useEffect, useMemo } from "react";
import { X, RefreshCw, Smartphone, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
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

type TransactionFilterType = "gcash" | "load";

export function TransactionTypeHistoryDialog({ onClose }: TransactionTypeHistoryDialogProps) {
  const [filterType, setFilterType] = useState<TransactionFilterType>("gcash");
  const [isLoading, setIsLoading] = useState(false);

  const { credits: gcashCredits, cash: gcashCash, history: gcashHistory, refresh } = useGCashFunds();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      await refresh();
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter transactions based on selected type
  const filteredTransactions = useMemo(() => {
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
  }, [gcashHistory, filterType]);

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

  const getTransactionLabel = (tx: GCashFundTransaction) => {
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

  const getTransactionColor = (tx: GCashFundTransaction) => {
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

  const getTransactionIcon = (tx: GCashFundTransaction) => {
    const isLoad = tx.notes?.toLowerCase().includes("load:") || tx.notes?.toLowerCase().startsWith("load");
    if (isLoad) return <Zap className="w-4 h-4 text-info" />;
    return <Smartphone className="w-4 h-4 text-primary" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 border-2 border-primary/20">
            {filterType === "load" ? (
              <Zap className="w-5 h-5 text-info" />
            ) : (
              <Smartphone className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Transaction History</h2>
            <p className="text-sm text-muted-foreground">
              {filteredTransactions.length} {filterType === "load" ? "Load" : "GCash"} transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Dropdown Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {filterType === "gcash" ? (
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
            {filterType === "load" ? (
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            ) : (
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            )}
            <p className="text-lg">No {filterType === "load" ? "Load" : "GCash"} transactions found</p>
            <p className="text-sm mt-1">Transactions will appear here as they occur</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-card border-2 border-border p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getTransactionIcon(tx)}
                  <div>
                    <div className={`font-semibold ${getTransactionColor(tx)}`}>
                      {getTransactionLabel(tx)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(tx.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-foreground">
                    ₱{tx.amount.toFixed(2)}
                  </div>
                  {tx.serviceCharge && tx.serviceCharge > 0 && (
                    <div className="text-xs text-success">
                      +₱{tx.serviceCharge.toFixed(2)} fee
                    </div>
                  )}
                </div>
              </div>
              {tx.notes && (
                <div className="mt-2 text-sm text-muted-foreground border-t border-border pt-2">
                  {tx.notes}
                </div>
              )}
              {tx.gcashNumber && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Number: {tx.gcashNumber}
                </div>
              )}
              {/* Balance after transaction */}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>Credits: ₱{tx.creditsBalance.toFixed(2)}</span>
                <span>Cash: ₱{tx.cashBalance.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Keyboard Hint */}
      <div className="p-3 border-t border-border bg-card text-center text-sm text-muted-foreground">
        Press <kbd className="px-2 py-1 bg-secondary text-xs font-mono mx-1">Tab</kbd> to close
      </div>
    </div>
  );
}
