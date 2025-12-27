import { useState, useMemo } from "react";
import { X, ArrowUp, ArrowDown, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreFundTransaction } from "@/services/mysqlApi";

interface StoreFundsHistoryDialogProps {
  balance: number;
  transactions: StoreFundTransaction[];
  onClose: () => void;
}

export function StoreFundsHistoryDialog({ balance, transactions, onClose }: StoreFundsHistoryDialogProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (t.transaction_type === "add" || t.transaction_type === "income") {
          acc.totalAdded += t.amount;
        } else {
          acc.totalWithdrawn += t.amount;
        }
        return acc;
      },
      { totalAdded: 0, totalWithdrawn: 0 }
    );
  }, [transactions]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "add":
      case "income":
        return <ArrowUp className="w-4 h-4 text-success" />;
      case "withdraw":
      case "expense":
        return <ArrowDown className="w-4 h-4 text-destructive" />;
      default:
        return <Wallet className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "add":
      case "income":
        return "text-success";
      case "withdraw":
      case "expense":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-4xl mx-4 animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Store Funds History</h2>
              <p className="text-sm text-muted-foreground">Transaction history and balance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-primary font-mono">
              ₱{balance.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-success/10 rounded-lg border border-success/20">
            <p className="text-xs text-muted-foreground mb-1">Total Added</p>
            <p className="text-xl font-bold text-success font-mono">
              ₱{totals.totalAdded.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">Total Withdrawn</p>
            <p className="text-xl font-bold text-destructive font-mono">
              ₱{totals.totalWithdrawn.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-4 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground capitalize">
                          {transaction.transaction_type.replace("-", " ")}
                        </span>
                        {transaction.category && (
                          <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                            {transaction.category}
                          </span>
                        )}
                      </div>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground mb-1">{transaction.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold font-mono ${getTransactionColor(transaction.transaction_type)}`}>
                      {transaction.transaction_type === "add" || transaction.transaction_type === "income" ? "+" : "-"}
                      ₱{transaction.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: ₱{transaction.balance_after.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6 pt-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

