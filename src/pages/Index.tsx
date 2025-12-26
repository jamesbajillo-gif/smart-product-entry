import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Product, OrderItem, ProductCategory } from "@/types/product";
import { OrderSidebar } from "@/components/OrderSidebar";
import { ProductSearch } from "@/components/ProductSearch";
import { QuantityDialog } from "@/components/QuantityDialog";
import { AddProductDialog } from "@/components/AddProductDialog";
import { PaymentDialog, PaymentDetails } from "@/components/PaymentDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Terminal, Wifi, WifiOff, Receipt, Package, CloudOff, RefreshCw, ShoppingCart, Menu } from "lucide-react";

const Index = () => {
  const {
    products,
    addProduct,
    recordSale,
    shouldShowQtyDialog,
    isOnline,
    isLoading,
    pendingSalesCount,
    isSyncing,
    triggerSync,
  } = useMySQLSync();

  const [orderItems, setOrderItems] = useSessionStorage<OrderItem[]>("pos-order", []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentDetails | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { toast } = useToast();

  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Add product to cart (with or without qty dialog)
  const addToCart = useCallback((product: Product, quantity: number) => {
    setOrderItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [...prev, { product, quantity }];
    });
  }, [setOrderItems]);

  const handleProductSelect = useCallback((product: Product) => {
    const stock = product.stock_quantity ?? 0;
    const threshold = product.low_stock_threshold ?? 5;
    
    // Warn if out of stock (but still allow adding)
    if (stock === 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently out of stock`,
        variant: "destructive",
      });
    } else if (stock <= threshold) {
      // Warn if low stock
      toast({
        title: "Low Stock Warning",
        description: `Only ${stock} ${product.name} left in stock`,
      });
    }
    
    if (shouldShowQtyDialog(product.id)) {
      setSelectedProduct(product);
    } else {
      addToCart(product, 1);
    }
    setSearchQuery("");
  }, [shouldShowQtyDialog, addToCart, toast]);

  const handleAddNewProduct = useCallback((name: string) => {
    setNewProductName(name);
    setSearchQuery("");
  }, []);

  const handleQuantityConfirm = useCallback(
    (quantity: number) => {
      if (!selectedProduct) return;
      addToCart(selectedProduct, quantity);
      setSelectedProduct(null);
    },
    [selectedProduct, addToCart]
  );

  const handleNewProductConfirm = useCallback(
    async (name: string, price: number, category?: ProductCategory, stockQuantity?: number) => {
      const result = await addProduct({ 
        name, 
        price, 
        category,
        stock_quantity: stockQuantity ?? 0,
        low_stock_threshold: 5,
      });
      setNewProductName(null);
      if (result.success && result.product) {
        setSelectedProduct(result.product);
        toast({
          title: "Product added",
          description: `${name} - ₱${price.toFixed(2)}`,
        });
      } else {
        toast({
          title: "Failed to add product",
          description: result.error || "Please try again",
          variant: "destructive",
        });
      }
    },
    [addProduct, toast]
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, [setOrderItems]);

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setOrderItems((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  }, [setOrderItems]);

  const handleClearOrder = useCallback(() => {
    setOrderItems([]);
    toast({
      title: "Order cleared",
      description: "All items have been removed",
    });
  }, [setOrderItems, toast]);

  const handleCheckout = useCallback(() => {
    if (orderItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items before checkout",
      });
      return;
    }
    setCartOpen(false);
    setShowPayment(true);
  }, [orderItems, toast]);

  const handlePaymentConfirm = useCallback(async (details: PaymentDetails) => {
    // Record sale to database
    await recordSale(orderItems, details);

    setShowPayment(false);
    setReceiptItems([...orderItems]);
    setReceiptPayment(details);
    setOrderItems([]);
  }, [orderItems, recordSale, setOrderItems]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setReceiptItems(null);
    setReceiptPayment(null);
  }, []);

  // Global Enter key to trigger checkout when nothing is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement instanceof HTMLButtonElement ||
          activeElement?.getAttribute("role") === "button";
        
        // Only trigger checkout if no input/button is focused and no dialogs are open
        if (!isInputFocused && !showPayment && !receiptItems && !selectedProduct && !newProductName) {
          e.preventDefault();
          handleCheckout();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPayment, receiptItems, selectedProduct, newProductName, handleCheckout]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)] flex gap-4 lg:gap-6">
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="p-2 bg-primary/20 rounded-lg glow-primary">
                <Terminal className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">QuickPOS</h1>
              
              {/* Connection status */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isOnline ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline'}
              </div>
              
              {/* Pending sync button */}
              {pendingSalesCount > 0 && (
                <button
                  onClick={triggerSync}
                  disabled={isSyncing}
                  className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                    isSyncing 
                      ? 'bg-muted text-muted-foreground' 
                      : 'bg-warning/20 text-warning hover:bg-warning/30'
                  }`}
                  title={`${pendingSalesCount} pending sale(s) - Click to sync`}
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <CloudOff className="w-3 h-3" />
                  )}
                  {pendingSalesCount}
                </button>
              )}
              
              <div className="ml-auto flex items-center gap-2">
                {/* Desktop nav buttons */}
                <Link to="/products" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Package className="w-4 h-4" />
                    <span className="hidden lg:inline">Products</span>
                  </Button>
                </Link>
                <Link to="/sales" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Receipt className="w-4 h-4" />
                    <span className="hidden lg:inline">Sales</span>
                  </Button>
                </Link>
                
                {/* Cart button - mobile only */}
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 sm:p-3 bg-primary/20 rounded-lg lg:hidden"
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center px-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full animate-scale-in">
                      {itemCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            {/* Mobile status bar */}
            <div className="flex items-center gap-2 sm:hidden mb-2">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </div>
              <Link to="/products">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  Products
                </Button>
              </Link>
              <Link to="/sales">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Receipt className="w-3 h-3 mr-1" />
                  Sales
                </Button>
              </Link>
            </div>
            
            <p className="text-muted-foreground text-sm sm:text-base hidden sm:block">
              Fast product search with auto-complete
            </p>
          </header>

          {/* Search Area */}
          <div className="flex-1 flex items-start justify-center pt-4 sm:pt-8 lg:pt-12">
            <div className="w-full max-w-2xl">
              <ProductSearch
                products={products}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onProductSelect={handleProductSelect}
                onAddNewProduct={handleAddNewProduct}
                onCheckout={handleCheckout}
              />
            </div>
          </div>

          {/* Keyboard Hint - desktop only */}
          <footer className="hidden lg:block mt-auto pt-4 text-center text-sm text-muted-foreground">
            <kbd className="px-2 py-1 bg-secondary rounded text-xs font-mono">ESC</kbd>
            {" "}to clear search
          </footer>
        </main>

        {/* Order Sidebar */}
        <OrderSidebar
          items={orderItems}
          onRemoveItem={handleRemoveItem}
          onUpdateQuantity={handleUpdateQuantity}
          onClearOrder={handleClearOrder}
          onCheckout={handleCheckout}
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
        />
      </div>

      {/* Quantity Dialog */}
      <QuantityDialog
        product={selectedProduct}
        onConfirm={handleQuantityConfirm}
        onCancel={() => setSelectedProduct(null)}
      />

      {/* Add Product Dialog */}
      {newProductName && (
        <AddProductDialog
          productName={newProductName}
          onConfirm={handleNewProductConfirm}
          onCancel={() => setNewProductName(null)}
        />
      )}

      {/* Payment Dialog */}
      {showPayment && (
        <PaymentDialog
          total={orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)}
          onConfirm={handlePaymentConfirm}
          onCancel={handlePaymentCancel}
        />
      )}

      {/* Receipt Dialog */}
      {receiptItems && receiptPayment && (
        <ReceiptDialog
          items={receiptItems}
          paymentDetails={receiptPayment}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  );
};

export default Index;