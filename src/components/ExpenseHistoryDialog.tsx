import { useState, useEffect, useMemo } from "react";
import { Product } from "@/types/product";
import { expensesApi, ExpenseRecord, salesApi, SaleRecord } from "@/services/mysqlApi";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X, History, RefreshCw, Truck, FileText, Receipt, Banknote, Smartphone } from "lucide-react";
import { format } from "date-fns";

interface HistoryDialogProps {
  product: Product;
  onClose: () => void;
}

interface ParsedSaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function HistoryDialog({ product, onClose }: HistoryDialogProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [activeTab, setActiveTab] = useState("expense");

  useEffect(() => {
    const loadExpenses = async () => {
      setIsLoadingExpenses(true);
      const result = await expensesApi.getByProduct(product.id);
      if (result.success && result.data) {
        setExpenses(result.data);
      }
      setIsLoadingExpenses(false);
    };
    loadExpenses();
  }, [product.id]);

  useEffect(() => {
    const loadSales = async () => {
      setIsLoadingSales(true);
      const result = await salesApi.getAll({ limit: 500 });
      if (result.success && result.data) {
        // Filter sales that include this product
        const productSales = result.data.filter((sale) => {
          try {
            const items: ParsedSaleItem[] = JSON.parse(sale.items);
            return items.some((item) => item.productId === product.id);
          } catch {
            return false;
          }
        });
        setSales(productSales);
      }
      setIsLoadingSales(false);
    };
    loadSales();
  }, [product.id]);

  const parseItems = (itemsJson: string): ParsedSaleItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  // Get product-specific items from each sale
  const productSales = useMemo(() => {
    return sales.map((sale) => {
      const items = parseItems(sale.items);
      const productItem = items.find((item) => item.productId === product.id);
      return {
        ...sale,
        productItem,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      };
    });
  }, [sales, product.id]);

  // Calculate expense totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.total_cost), 0);
  const totalQuantity = expenses.reduce((sum, exp) => sum + Number(exp.quantity), 0);
  const averageUnitCost = totalQuantity > 0 ? totalExpenses / totalQuantity : 0;

  // Calculate sales totals
  const totalSalesRevenue = productSales.reduce((sum, sale) => {
    const item = sale.productItem;
    return sum + (item ? item.price * item.quantity : 0);
  }, 0);
  const totalSalesQuantity = productSales.reduce((sum, sale) => {
    const item = sale.productItem;
    return sum + (item ? item.quantity : 0);
  }, 0);
  const averageSalePrice = totalSalesQuantity > 0 ? totalSalesRevenue / totalSalesQuantity : 0;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="glass-panel rounded-xl p-6 w-[95vw] max-w-4xl mx-4 max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">History</h2>
              <p className="text-sm text-muted-foreground">{product.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="sale">Sale</TabsTrigger>
          </TabsList>

          {/* Expense Tab */}
          <TabsContent value="expense" className="flex-1 flex flex-col min-h-0 mt-0">
            {/* Summary Stats */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
                  <p className="text-lg font-bold text-primary font-mono">
                    ₱{totalExpenses.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Quantity</p>
                  <p className="text-lg font-bold text-foreground">
                    {totalQuantity}
                  </p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Avg Unit Cost</p>
                  <p className="text-lg font-bold text-foreground font-mono">
                    ₱{averageUnitCost.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Expenses List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingExpenses ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No expense history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg"
                    >
                      <div className="p-2 bg-primary/20 rounded-lg mt-0.5">
                        <Receipt className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {expense.quantity} unit{expense.quantity !== 1 ? "s" : ""}
                            </span>
                            <span className="text-sm text-muted-foreground">×</span>
                            <span className="text-sm font-mono text-foreground">
                              ₱{Number(expense.unit_cost).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-primary font-mono">
                            ₱{Number(expense.total_cost).toFixed(2)}
                          </span>
                        </div>
                        
                        {/* Supplier info */}
                        {expense.supplier && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Truck className="w-3 h-3" />
                            <span>{expense.supplier}</span>
                          </div>
                        )}
                        
                        {/* Notes */}
                        {expense.notes && (
                          <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                            <p className="italic">{expense.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {expense.created_at && format(new Date(expense.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Sale Tab */}
          <TabsContent value="sale" className="flex-1 flex flex-col min-h-0 mt-0">
            {/* Summary Stats */}
            {productSales.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-bold text-success font-mono">
                    ₱{totalSalesRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Sold</p>
                  <p className="text-lg font-bold text-foreground">
                    {totalSalesQuantity}
                  </p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Avg Sale Price</p>
                  <p className="text-lg font-bold text-foreground font-mono">
                    ₱{averageSalePrice.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Sales List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingSales ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : productSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No sales history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {productSales.map((sale) => {
                    const item = sale.productItem;
                    if (!item) return null;
                    
                    return (
                      <div
                        key={sale.id}
                        className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg"
                      >
                        <div className="p-2 bg-success/20 rounded-lg mt-0.5">
                          {sale.payment_method === "cash" ? (
                            <Banknote className="w-4 h-4 text-success" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-info" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {item.quantity} unit{item.quantity !== 1 ? "s" : ""}
                              </span>
                              <span className="text-sm text-muted-foreground">×</span>
                              <span className="text-sm font-mono text-foreground">
                                ₱{item.price.toFixed(2)}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-success font-mono">
                              ₱{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="capitalize">{sale.payment_method}</span>
                            {sale.itemCount > item.quantity && (
                              <span className="text-xs">
                                • {sale.itemCount} items in transaction
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {sale.created_at && format(new Date(sale.created_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

