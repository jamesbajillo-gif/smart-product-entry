import { useMemo } from "react";
import { SaleRecord } from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
import { X, ArrowDownCircle, ArrowUpCircle, Smartphone, Banknote, FileText, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface GCashTransactionsDialogProps {
  sales: SaleRecord[];
  onClose: () => void;
}

interface ParsedSaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function GCashTransactionsDialog({ sales, onClose }: GCashTransactionsDialogProps) {
  const parseItems = (itemsJson: string): ParsedSaleItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  // Filter and process GCash transactions
  const gcashTransactions = useMemo(() => {
    const transactions: Array<{
      sale: SaleRecord;
      transactionItem: ParsedSaleItem;
      serviceChargeItem?: ParsedSaleItem;
      totalAmount: number;
      isGCashIn: boolean;
    }> = [];

    sales.forEach((sale) => {
      const items = parseItems(sale.items);
      const gcashInItem = items.find(item => item.name === "GCASH-IN");
      const gcashOutItem = items.find(item => item.name === "GCASH-OUT");
      const serviceChargeItem = items.find(item => item.name === "Service Charge");

      if (gcashInItem) {
        const transactionAmount = gcashInItem.price * gcashInItem.quantity;
        const serviceChargeAmount = serviceChargeItem ? serviceChargeItem.price * serviceChargeItem.quantity : 0;
        transactions.push({
          sale,
          transactionItem: gcashInItem,
          serviceChargeItem,
          totalAmount: transactionAmount + serviceChargeAmount,
          isGCashIn: true,
        });
      } else if (gcashOutItem) {
        const transactionAmount = gcashOutItem.price * gcashOutItem.quantity;
        const serviceChargeAmount = serviceChargeItem ? serviceChargeItem.price * serviceChargeItem.quantity : 0;
        transactions.push({
          sale,
          transactionItem: gcashOutItem,
          serviceChargeItem,
          totalAmount: transactionAmount + serviceChargeAmount,
          isGCashIn: false,
        });
      }
    });

    // Sort by date (newest first)
    return transactions.sort((a, b) => {
      const dateA = a.sale.created_at ? new Date(a.sale.created_at).getTime() : 0;
      const dateB = b.sale.created_at ? new Date(b.sale.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [sales]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalGCashIn = 0;
    let totalGCashOut = 0;
    let totalServiceFees = 0;
    let totalGCashMoney = 0;

    gcashTransactions.forEach(({ transactionItem, serviceChargeItem, isGCashIn }) => {
      const transactionAmount = transactionItem.price * transactionItem.quantity;
      const serviceChargeAmount = serviceChargeItem ? serviceChargeItem.price * serviceChargeItem.quantity : 0;

      if (isGCashIn) {
        totalGCashIn += transactionAmount + serviceChargeAmount;
        totalServiceFees += serviceChargeAmount;
        totalGCashMoney += transactionAmount + serviceChargeAmount;
      } else {
        totalGCashOut += transactionAmount;
        totalServiceFees += serviceChargeAmount;
        totalGCashMoney -= (transactionAmount - serviceChargeAmount);
      }
    });

    return { totalGCashIn, totalGCashOut, totalServiceFees, totalGCashMoney };
  }, [gcashTransactions]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-5xl mx-4 max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">GCash Transactions</h2>
              <p className="text-sm text-muted-foreground">All GCASH-IN and GCASH-OUT transactions</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">GCASH-IN</p>
            <p className="text-lg font-bold text-success font-mono">
              ₱{totals.totalGCashIn.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">GCASH-OUT</p>
            <p className="text-lg font-bold text-info font-mono">
              ₱{totals.totalGCashOut.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Service Fees</p>
            <p className="text-lg font-bold text-primary font-mono">
              ₱{totals.totalServiceFees.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-muted-foreground">GCASH-MONEY</p>
            <p className="text-lg font-bold text-primary font-mono">
              ₱{totals.totalGCashMoney.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto">
          {gcashTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No GCash transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {gcashTransactions.map(({ sale, transactionItem, serviceChargeItem, totalAmount, isGCashIn }) => (
                <div
                  key={sale.id}
                  className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg"
                >
                  <div className={`p-2 rounded-lg mt-0.5 ${isGCashIn ? 'bg-success/20' : 'bg-info/20'}`}>
                    {isGCashIn ? (
                      <ArrowDownCircle className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-info" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">
                        {transactionItem.name}
                      </span>
                      <span className="text-lg font-bold font-mono text-primary">
                        ₱{transactionItem.price.toFixed(2)}
                      </span>
                    </div>
                    
                    {serviceChargeItem && (
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Service Charge:</span>
                        <span className="font-mono text-muted-foreground">
                          ₱{serviceChargeItem.price.toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total Paid:</span>
                      <span className="font-bold font-mono text-primary">
                        ₱{totalAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      {sale.payment_method === "cash" ? (
                        <Banknote className="w-3 h-3" />
                      ) : (
                        <Smartphone className="w-3 h-3" />
                      )}
                      <span className="capitalize">{sale.payment_method}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {sale.created_at && format(new Date(sale.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

