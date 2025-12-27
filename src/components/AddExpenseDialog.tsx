import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { X, Receipt, Plus, Loader2, Database, Wallet, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";
import { expensesApi } from "@/services/mysqlApi";
import { useToast } from "@/hooks/use-toast";
import { PaymentSource } from "@/hooks/useAvailableFunds";

interface AddExpenseDialogProps {
  product: Product;
  availableFunds?: { cash: number; storeFunds: number; gcash: number; currentSales: number };
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddExpenseDialog({ product, availableFunds, onClose, onSuccess }: AddExpenseDialogProps) {
  const isIceTube = product.name.toUpperCase().includes("ICE TUBE");
  const [quantity, setQuantity] = useState(isIceTube ? "1" : "1");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentSource, setPaymentSource] = useState<PaymentSource>("cash");
  const { addFunds: addStoreFunds, withdrawFunds: withdrawStoreFunds, refresh: refreshStoreFunds } = useStoreFunds();
  const quantityRef = useRef<HTMLInputElement>(null);
  const unitCostRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadSuppliers = async () => {
      setIsLoading(true);
      const result = await expensesApi.getSuppliers();
      if (result.success && result.data) {
        setSuppliers(result.data);
      }
      setIsLoading(false);
    };
    loadSuppliers();
    // For Ice Tube, focus on unit cost; otherwise focus on quantity
    if (isIceTube) {
      unitCostRef.current?.focus();
    } else {
      quantityRef.current?.focus();
    }
  }, [isIceTube]);

  const isTableMissingError = (error: string | undefined): boolean => {
    if (!error) return false;
    const lowerError = error.toLowerCase();
    return lowerError.includes("table") && 
           (lowerError.includes("doesn't exist") || 
            lowerError.includes("does not exist") ||
            lowerError.includes("not found"));
  };

  // For Ice Tube, quantity is always 1 (transactional count)
  const effectiveQuantity = isIceTube ? 1 : (parseFloat(quantity) || 0);
  const totalCost = effectiveQuantity * (parseFloat(unitCost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For Ice Tube, quantity is always 1 (transactional count)
    const finalQuantity = isIceTube ? 1 : parseInt(quantity) || 0;
    
    if (!unitCost) {
      toast({ title: "Error", description: "Please fill in unit cost", variant: "destructive" });
      return;
    }
    
    if (!isIceTube && !quantity) {
      toast({ title: "Error", description: "Please fill in quantity", variant: "destructive" });
      return;
    }

    const selectedSupplier = showNewSupplier ? newSupplier.trim() : supplier;
    const finalTotalCost = finalQuantity * parseFloat(unitCost);

    // Process payment source if Store Funds is selected
    if (paymentSource === "store_funds" && availableFunds) {
      // Deduct from store funds (as expense/withdrawal from invested capital)
      const withdrawResult = await withdrawStoreFunds(finalTotalCost, `Expense: ${product.name}`, "Expense");
      if (!withdrawResult.success) {
        toast({
          title: "Error",
          description: withdrawResult.error || "Failed to deduct funds from store",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      await refreshStoreFunds();
    }

    setIsSaving(true);
    const result = await expensesApi.create({
      product_id: product.id,
      product_name: product.name,
      quantity: finalQuantity,
      unit_cost: parseFloat(unitCost),
      total_cost: finalTotalCost,
      supplier: selectedSupplier || undefined,
      notes: notes.trim() || undefined,
    });

    if (result.success) {
      toast({ title: "Success", description: "Expense recorded successfully" });
      onSuccess?.();
      onClose();
    } else {
      const errorMsg = result.error || "Failed to record expense";
      if (isTableMissingError(errorMsg)) {
        toast({ 
          title: "Database Table Missing", 
          description: "The expenses table doesn't exist. Please create it in Database Setup.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      }
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-full max-w-md mx-4 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Add Expense</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* For Ice Tube: Show info message and hide quantity field */}
          {isIceTube && (
            <div className="p-3 bg-info/10 rounded-lg border border-info/30">
              <p className="text-sm text-info font-medium">
                Ice Tube expenses are recorded as transactions with count of 1
              </p>
            </div>
          )}
          
          {/* Quantity & Unit Cost */}
          <div className={`grid gap-4 ${isIceTube ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isIceTube && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Quantity
                </label>
                <input
                  ref={quantityRef}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="1"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Unit Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                  ₱
                </span>
                <input
                  ref={unitCostRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full pl-7 pr-3 py-3 bg-input rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Total Cost Display */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Total Cost</span>
              {isIceTube && (
                <span className="text-xs text-muted-foreground">(Quantity: 1 transaction)</span>
              )}
            </div>
            <span className="text-xl font-bold text-primary font-mono">
              ₱{totalCost.toFixed(2)}
            </span>
          </div>

          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Supplier (Optional)
            </label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading suppliers...
              </div>
            ) : showNewSupplier ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="Enter new supplier name"
                  className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewSupplier(false);
                    setNewSupplier("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="flex-1 px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewSupplier(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this expense..."
              rows={2}
              className="w-full px-4 py-3 bg-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Payment Source Selection */}
          {totalCost > 0 && availableFunds && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Payment Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource("cash")}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    paymentSource === "cash"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                >
                  <Banknote className={`w-4 h-4 ${paymentSource === "cash" ? "text-success" : "text-muted-foreground"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-medium ${paymentSource === "cash" ? "text-foreground" : "text-muted-foreground"}`}>
                      Cash
                    </p>
                    <p className="text-xs text-muted-foreground">₱{availableFunds.cash.toFixed(2)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource("store_funds")}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    paymentSource === "store_funds"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                >
                  <Wallet className={`w-4 h-4 ${paymentSource === "store_funds" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-medium ${paymentSource === "store_funds" ? "text-foreground" : "text-muted-foreground"}`}>
                      Store Funds
                    </p>
                    <p className="text-xs text-muted-foreground">₱{availableFunds.storeFunds.toFixed(2)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource("gcash")}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    paymentSource === "gcash"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                >
                  <Smartphone className={`w-4 h-4 ${paymentSource === "gcash" ? "text-info" : "text-muted-foreground"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-medium ${paymentSource === "gcash" ? "text-foreground" : "text-muted-foreground"}`}>
                      GCash
                    </p>
                    <p className="text-xs text-muted-foreground">₱{availableFunds.gcash.toFixed(2)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource("current_sales")}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    paymentSource === "current_sales"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/50"
                  }`}
                >
                  <Receipt className={`w-4 h-4 ${paymentSource === "current_sales" ? "text-warning" : "text-muted-foreground"}`} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-medium ${paymentSource === "current_sales" ? "text-foreground" : "text-muted-foreground"}`}>
                      Today Sales
                    </p>
                    <p className="text-xs text-muted-foreground">₱{availableFunds.currentSales.toFixed(2)}</p>
                  </div>
                </button>
              </div>
              {totalCost > (availableFunds[paymentSource === "cash" ? "cash" : paymentSource === "store_funds" ? "storeFunds" : paymentSource === "gcash" ? "gcash" : "currentSales"] || 0) && (
                <p className="text-xs text-destructive mt-2">Insufficient funds in selected source</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 glow-primary"
              disabled={isSaving || !unitCost || (!isIceTube && !quantity)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 mr-2" />
                  Add Expense
                </>
              )}
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-center text-muted-foreground pt-2 border-t border-border">
            <p>If you see a table error, go to</p>
            <Link to="/database" className="text-primary hover:underline inline-flex items-center gap-1">
              <Database className="w-3 h-3" />
              Database Setup
            </Link>
            <span> to create the expenses table</span>
          </div>
        </form>
      </div>
    </div>
  );
}
