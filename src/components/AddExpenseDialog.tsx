import { useState, useEffect, useRef } from "react";
import { X, Receipt, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";
import { expensesApi } from "@/services/mysqlApi";
import { useToast } from "@/hooks/use-toast";

interface AddExpenseDialogProps {
  product: Product;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddExpenseDialog({ product, onClose, onSuccess }: AddExpenseDialogProps) {
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const quantityRef = useRef<HTMLInputElement>(null);
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
    quantityRef.current?.focus();
  }, []);

  const totalCost = (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || !unitCost) {
      toast({ title: "Error", description: "Please fill in quantity and unit cost", variant: "destructive" });
      return;
    }

    const selectedSupplier = showNewSupplier ? newSupplier.trim() : supplier;

    setIsSaving(true);
    const result = await expensesApi.create({
      product_id: product.id,
      product_name: product.name,
      quantity: parseInt(quantity),
      unit_cost: parseFloat(unitCost),
      total_cost: totalCost,
      supplier: selectedSupplier || undefined,
      notes: notes.trim() || undefined,
    });

    if (result.success) {
      toast({ title: "Success", description: "Expense recorded successfully" });
      onSuccess?.();
      onClose();
    } else {
      toast({ title: "Error", description: result.error || "Failed to record expense", variant: "destructive" });
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
          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Unit Cost
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                  ₱
                </span>
                <input
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
            <span className="text-muted-foreground">Total Cost</span>
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
              disabled={isSaving || !quantity || !unitCost}
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
        </form>
      </div>
    </div>
  );
}
