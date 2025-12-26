import { useState, useEffect, useMemo } from "react";
import { Product } from "@/types/product";
import { expensesApi, ExpenseRecord, salesApi, SaleRecord } from "@/services/mysqlApi";
import { useGCashFunds, GCashFundTransaction } from "@/hooks/useGCashFunds";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X, History, RefreshCw, Truck, FileText, Receipt, Banknote, Smartphone, ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";
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
  
  // Check if this is GCASH product
  const isGcash = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
  const [activeTab, setActiveTab] = useState(isGcash ? "transactions" : "expense");
  
  const { funds: gcashFunds, history: gcashHistory } = useGCashFunds();

  useEffect(() => {
    // Skip loading expenses for GCASH (it uses fund history instead)
    if (isGcash) {
      setIsLoadingExpenses(false);
      return;
    }
    
    const loadExpenses = async () => {
      setIsLoadingExpenses(true);
      const result = await expensesApi.getByProduct(product.id);
      if (result.success && result.data) {
        setExpenses(result.data);
      }
      setIsLoadingExpenses(false);
    };
    loadExpenses();
  }, [product.id, isGcash]);

  useEffect(() => {
    const loadSales = async () => {
      setIsLoadingSales(true);
      const result = await salesApi.getAll({ limit: 500 });
      if (result.success && result.data) {
        // Filter sales that include this product
        // For GCASH, filter for GCASH-IN and GCASH-OUT transactions
        const productSales = result.data.filter((sale) => {
          try {
            const items: ParsedSaleItem[] = JSON.parse(sale.items);
            if (isGcash) {
              // For GCASH, look for GCASH-IN or GCASH-OUT in item names
              return items.some((item) => 
                item.name === "GCASH-IN" || 
                item.name === "GCASH-OUT" ||
                item.productId === product.id
              );
            }
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
  }, [product.id, isGcash]);

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
      <div className="glass-panel rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col animate-scale-in">
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
          {isGcash ? (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="sale">Sale</TabsTrigger>
            </TabsList>
          )}

          {/* GCASH Transactions Tab */}
          {isGcash && (
            <TabsContent value="transactions" className="flex-1 flex flex-col min-h-0 mt-0">
              {/* Current Balance */}
              <div className="p-3 bg-primary/10 rounded-lg mb-4 border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current GCASH Balance</span>
                  <span className="text-xl font-bold text-primary font-mono">
                    ₱{gcashFunds.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Transaction History */}
              <div className="flex-1 overflow-y-auto">
                {gcashHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No transaction history yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gcashHistory.map((transaction) => {
                      const getTransactionIcon = () => {
                        switch (transaction.type) {
                          case "add":
                            return <Plus className="w-4 h-4 text-primary" />;
                          case "gcash-in":
                            return <ArrowDownCircle className="w-4 h-4 text-success" />;
                          case "gcash-out":
                            return <ArrowUpCircle className="w-4 h-4 text-info" />;
                          default:
                            return <Receipt className="w-4 h-4 text-primary" />;
                        }
                      };

                      const getTransactionLabel = () => {
                        switch (transaction.type) {
                          case "add":
                            return "Funds Added";
                          case "gcash-in":
                            return "GCASH-IN";
                          case "gcash-out":
                            return "GCASH-OUT";
                          default:
                            return "Transaction";
                        }
                      };

                      const getTransactionColor = () => {
                        switch (transaction.type) {
                          case "add":
                            return "bg-primary/20";
                          case "gcash-in":
                            return "bg-success/20";
                          case "gcash-out":
                            return "bg-info/20";
                          default:
                            return "bg-secondary/20";
                        }
                      };

                      const getAmountColor = () => {
                        switch (transaction.type) {
                          case "add":
                          case "gcash-out":
                            return "text-success";
                          case "gcash-in":
                            return "text-destructive";
                          default:
                            return "text-primary";
                        }
                      };

                      const getAmountPrefix = () => {
                        switch (transaction.type) {
                          case "add":
                          case "gcash-out":
                            return "+";
                          case "gcash-in":
                            return "-";
                          default:
                            return "";
                        }
                      };

                      return (
                        <div
                          key={transaction.id}
                          className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg"
                        >
                          <div className={`p-2 ${getTransactionColor()} rounded-lg mt-0.5`}>
                            {getTransactionIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-foreground">
                                {getTransactionLabel()}
                              </span>
                              <span className={`text-lg font-bold font-mono ${getAmountColor()}`}>
                                {getAmountPrefix()}₱{transaction.amount.toFixed(2)}
                              </span>
                            </div>
                            
                            {/* GCash Number (for GCASH-IN) */}
                            {transaction.gcashNumber && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Smartphone className="w-3 h-3" />
                                <span>{transaction.gcashNumber}</span>
                              </div>
                            )}
                            
                            {/* Notes */}
                            {transaction.notes && (
                              <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                                <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                                <p className="italic">{transaction.notes}</p>
                              </div>
                            )}
                            
                            {/* Balance after transaction */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>Balance after:</span>
                              <span className="font-mono font-medium text-foreground">
                                ₱{transaction.balance.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(transaction.timestamp), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* Expense Tab (for non-GCASH products) */}
          {!isGcash && (
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
          )}

          {/* Sale Tab (for GCASH, shows GCASH-IN/OUT sales) */}
          {isGcash && (
            <TabsContent value="sales" className="flex-1 flex flex-col min-h-0 mt-0">
              {/* Summary Stats */}
              {productSales.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Transactions</p>
                    <p className="text-lg font-bold text-foreground">
                      {productSales.length}
                    </p>
                  </div>
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">GCASH-IN</p>
                    <p className="text-lg font-bold text-success">
                      {productSales.filter(s => {
                        const items = parseItems(s.items);
                        return items.some(item => item.name === "GCASH-IN");
                      }).length}
                    </p>
                  </div>
                  <div className="p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">GCASH-OUT</p>
                    <p className="text-lg font-bold text-info">
                      {productSales.filter(s => {
                        const items = parseItems(s.items);
                        return items.some(item => item.name === "GCASH-OUT");
                      }).length}
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
                      const items = parseItems(sale.items);
                      const gcashInItem = items.find(item => item.name === "GCASH-IN");
                      const gcashOutItem = items.find(item => item.name === "GCASH-OUT");
                      const serviceChargeItem = items.find(item => item.name === "Service Charge");
                      const transactionItem = gcashInItem || gcashOutItem;
                      
                      if (!transactionItem) return null;
                      
                      const isGCashIn = !!gcashInItem;
                      const totalAmount = transactionItem.price + (serviceChargeItem?.price || 0);
                      
                      return (
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
                              <span className="capitalize">{sale.payment_method}</span>
                              {sale.itemCount > 1 && (
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
          )}

          {/* Sale Tab (for non-GCASH products) */}
          {!isGcash && (
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
          )}
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

