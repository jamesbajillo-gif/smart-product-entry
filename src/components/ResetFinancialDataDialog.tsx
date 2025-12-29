import { useState } from "react";
import { AlertTriangle, Trash2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/services/mysqlApi";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";

interface ResetFinancialDataDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ResetFinancialDataDialog({ open, onClose, onComplete }: ResetFinancialDataDialogProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { setCredits: setGcashCredits, setCash: setGcashCash, setHistory: setGcashHistory } = useGCashFunds();
  const { refresh: refreshStoreFunds } = useStoreFunds();

  const requiredText = "RESET ALL FINANCIAL DATA";

  const handleReset = async () => {
    if (confirmText !== requiredText) {
      return;
    }

    setIsResetting(true);
    try {
      // Get all records first, then delete them individually
      // (API doesn't support DELETE all with empty filters, so we need to get IDs first)

      // Delete all sales records
      const salesResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "sales",
        limit: 10000,
      });
      if (salesResult.success && salesResult.data) {
        for (const sale of salesResult.data) {
          await apiRequest("DELETE", { table: "sales", id: sale.id });
        }
      }

      // Delete all expenses
      const expensesResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "expenses",
        limit: 10000,
      });
      if (expensesResult.success && expensesResult.data) {
        for (const expense of expensesResult.data) {
          await apiRequest("DELETE", { table: "expenses", id: expense.id });
        }
      }

      // Delete all stock adjustments
      const stockResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "stock_adjustments",
        limit: 10000,
      });
      if (stockResult.success && stockResult.data) {
        for (const adjustment of stockResult.data) {
          await apiRequest("DELETE", { table: "stock_adjustments", id: adjustment.id });
        }
      }

      // Delete all store funds transactions
      const storeFundsResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "store_funds",
        limit: 10000,
      });
      if (storeFundsResult.success && storeFundsResult.data) {
        for (const tx of storeFundsResult.data) {
          await apiRequest("DELETE", { table: "store_funds", id: tx.id });
        }
      }

      // Delete all quantity history
      const qtyResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "quantity_history",
        limit: 10000,
      });
      if (qtyResult.success && qtyResult.data) {
        for (const qty of qtyResult.data) {
          await apiRequest("DELETE", { table: "quantity_history", id: qty.id });
        }
      }

      // Delete all GCash funds transactions
      const gcashResult = await apiRequest<Array<{ id: number }>>("GET", {
        table: "gcash_funds",
        limit: 10000,
      });
      if (gcashResult.success && gcashResult.data) {
        for (const tx of gcashResult.data) {
          await apiRequest("DELETE", { table: "gcash_funds", id: tx.id });
        }
      }
      
      // Reset GCash funds and history (local state)
      setGcashCredits(0);
      setGcashCash(0);
      setGcashHistory([]);

      // Reset Store Funds: All transactions are deleted above, now refresh to show 0 balance
      await refreshStoreFunds();

      // Reset stock quantities to 0 for all products
      // Get all products first
      const productsResult = await apiRequest<Array<{ id: string }>>("GET", {
        table: "products",
        limit: 10000,
      });

      if (productsResult.success && productsResult.data) {
        // Update each product to reset stock_quantity to 0
        for (const product of productsResult.data) {
          await apiRequest("PUT", {
            table: "products",
            id: product.id,
            data: {
              stock_quantity: 0,
            },
          });
        }
      }

      onComplete();
      onClose();
      setConfirmText("");
    } catch (error) {
      console.error("Error resetting financial data:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-destructive/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Reset All Financial Data</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="text-foreground font-medium">
              This will permanently delete ALL financial and transaction records:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>All sales records</li>
              <li>All expenses</li>
              <li>All stock adjustments</li>
              <li>All store funds transactions</li>
              <li>All GCash transaction history</li>
              <li>All quantity history</li>
              <li>Product stock quantities (reset to 0)</li>
              <li>GCash funds balance (reset to ₱0.00)</li>
              <li>Store funds balance (reset to ₱0.00)</li>
            </ul>
            <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm font-medium text-success mb-1">✓ Will be preserved:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground ml-2">
                <li>Product names</li>
                <li>Product prices</li>
                <li>Product variations</li>
                <li>Product categories</li>
                <li>Product images</li>
              </ul>
            </div>
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-2">
                This action cannot be undone!
              </p>
              <p className="text-xs text-muted-foreground">
                Type <strong className="text-foreground">{requiredText}</strong> to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={requiredText}
                className="w-full mt-2 px-3 py-2 bg-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50"
                disabled={isResetting}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={confirmText !== requiredText || isResetting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isResetting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Reset All Financial Data
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

