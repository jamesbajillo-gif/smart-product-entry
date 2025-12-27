import { useState, useEffect, useMemo } from "react";
import { X, CheckCircle, Receipt, Banknote, Smartphone, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { salesApi, SaleRecord } from "@/services/mysqlApi";

interface BottleDepositRefundDialogProps {
  sales: SaleRecord[];
  onClose: () => void;
  onRefunded: () => void;
}

interface UnrefundedSale {
  sale: SaleRecord;
  bottleDeposit: number;
  items: Array<{ name: string; quantity: number; bottleDeposit?: number; bottleDepositTotal?: number }>;
}

export function BottleDepositRefundDialog({ sales, onClose, onRefunded }: BottleDepositRefundDialogProps) {
  const { toast } = useToast();
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse sale items
  const parseSaleItems = (itemsJson: string) => {
    try {
      return JSON.parse(itemsJson) as Array<{ name: string; quantity: number; bottleDeposit?: number; bottleDepositTotal?: number }>;
    } catch {
      return [];
    }
  };

  // Get all sales with unrefunded bottle deposits
  const unrefundedSales = useMemo<UnrefundedSale[]>(() => {
    return sales
      .filter((sale) => {
        // Skip if already refunded
        if (sale.bottle_deposit_refunded === 1) return false;
        
        try {
          const items = parseSaleItems(sale.items);
          // Check if any item has bottle deposit
          return items.some((item: any) => item.bottleDepositTotal && item.bottleDepositTotal > 0);
        } catch {
          return false;
        }
      })
      .map((sale) => {
        const items = parseSaleItems(sale.items);
        const bottleDeposit = items.reduce((sum, item: any) => {
          return sum + (item.bottleDepositTotal || 0);
        }, 0);
        
        return {
          sale,
          bottleDeposit,
          items: items.filter((item: any) => item.bottleDepositTotal && item.bottleDepositTotal > 0),
        };
      })
      .sort((a, b) => {
        // Sort by date, newest first
        const dateA = a.sale.created_at ? new Date(a.sale.created_at).getTime() : 0;
        const dateB = b.sale.created_at ? new Date(b.sale.created_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [sales]);

  const totalSelectedDeposit = useMemo(() => {
    return unrefundedSales
      .filter((us) => us.sale.id && selectedSaleIds.has(us.sale.id))
      .reduce((sum, us) => sum + us.bottleDeposit, 0);
  }, [unrefundedSales, selectedSaleIds]);

  const toggleSaleSelection = (saleId: number | undefined) => {
    if (!saleId) return;
    setSelectedSaleIds((prev) => {
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
    if (selectedSaleIds.size === unrefundedSales.filter(us => us.sale.id).length) {
      setSelectedSaleIds(new Set());
    } else {
      setSelectedSaleIds(new Set(unrefundedSales.filter(us => us.sale.id).map(us => us.sale.id!)));
    }
  };

  const handleRefund = async () => {
    if (selectedSaleIds.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one transaction to refund.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const results = await Promise.all(
        Array.from(selectedSaleIds).map((id) =>
          salesApi.updateRefundStatus(id, true)
        )
      );

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        toast({
          title: "Refund processed",
          description: `Successfully marked ${successCount} transaction(s) as refunded.`,
        });
        setSelectedSaleIds(new Set());
        onRefunded();
      } else {
        toast({
          title: "Partial success",
          description: `Processed ${successCount} transaction(s), ${failedCount} failed.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing refunds:", error);
      toast({
        title: "Error",
        description: "Failed to process refunds. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-4xl mx-4 animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/20 rounded-lg">
              <CircleDot className="w-5 h-5 text-info" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Bottle Deposit Refund</h2>
              <p className="text-sm text-muted-foreground">Select transactions to mark as refunded</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="mb-4 p-4 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Unrefunded</p>
              <p className="text-2xl font-bold text-info font-mono">
                ₱{unrefundedSales.reduce((sum, us) => sum + us.bottleDeposit, 0).toFixed(2)}
              </p>
            </div>
            {selectedSaleIds.size > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Selected</p>
                <p className="text-xl font-bold text-primary font-mono">
                  ₱{totalSelectedDeposit.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Select All */}
        {unrefundedSales.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="gap-2"
            >
              {selectedSaleIds.size === unrefundedSales.filter(us => us.sale.id).length
                ? "Deselect All"
                : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {unrefundedSales.length} transaction(s) with unrefunded deposits
            </span>
          </div>
        )}

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {unrefundedSales.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">All bottle deposits have been refunded</p>
            </div>
          ) : (
            unrefundedSales.map(({ sale, bottleDeposit, items }) => {
              const isSelected = sale.id ? selectedSaleIds.has(sale.id) : false;
              return (
                <div
                  key={sale.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary/30"
                      : "bg-secondary/30 border-border/50 hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSaleSelection(sale.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {sale.payment_method === "cash" ? (
                            <Banknote className="w-4 h-4 text-success" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-info" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {formatDate(sale.created_at)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-info font-mono">
                            ₱{bottleDeposit.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Bottle Deposit</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.name} × {item.quantity}</span>
                            <span className="font-mono">₱{(item.bottleDepositTotal || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleRefund}
            disabled={selectedSaleIds.size === 0 || isProcessing}
          >
            {isProcessing ? "Processing..." : `Mark ${selectedSaleIds.size} as Refunded`}
          </Button>
        </div>
      </div>
    </div>
  );
}

