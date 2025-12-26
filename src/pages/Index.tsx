import { useState, useCallback } from "react";
import { Product, OrderItem } from "@/types/product";
import { initialProducts } from "@/data/products";
import { OrderSidebar } from "@/components/OrderSidebar";
import { ProductSearch } from "@/components/ProductSearch";
import { QuantityDialog } from "@/components/QuantityDialog";
import { AddProductDialog } from "@/components/AddProductDialog";
import { PaymentDialog, PaymentDetails } from "@/components/PaymentDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useToast } from "@/hooks/use-toast";
import { Terminal } from "lucide-react";

// Track quantity history per product: productId -> array of quantities sold
type QuantityHistory = Record<string, number[]>;

const Index = () => {
  const [products, setProducts] = useSessionStorage<Product[]>("pos-products", initialProducts);
  const [orderItems, setOrderItems] = useSessionStorage<OrderItem[]>("pos-order", []);
  const [quantityHistory, setQuantityHistory] = useSessionStorage<QuantityHistory>("pos-qty-history", {});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentDetails | null>(null);
  const { toast } = useToast();

  // Check if product should show qty dialog based on history
  const shouldShowQtyDialog = useCallback((productId: string): boolean => {
    const history = quantityHistory[productId] || [];
    // Show qty dialog if product has been sold 2+ times with qty > 1
    const multiQtySales = history.filter((qty) => qty > 1).length;
    return multiQtySales >= 2;
  }, [quantityHistory]);

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
    if (shouldShowQtyDialog(product.id)) {
      // Show qty dialog for products frequently sold with qty > 1
      setSelectedProduct(product);
    } else {
      // Add directly with qty 1
      addToCart(product, 1);
    }
    setSearchQuery("");
  }, [shouldShowQtyDialog, addToCart]);

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
    (name: string, price: number) => {
      const newProduct: Product = {
        id: Date.now().toString(),
        name,
        price,
      };

      setProducts((prev) => [...prev, newProduct]);
      setNewProductName(null);
      setSelectedProduct(newProduct);

      toast({
        title: "Product added",
        description: `${name} - ₱${price.toFixed(2)}`,
      });
    },
    [toast]
  );

  const handleRemoveItem = useCallback((productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

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
  }, []);

  const handleClearOrder = useCallback(() => {
    setOrderItems([]);
    toast({
      title: "Order cleared",
      description: "All items have been removed",
    });
  }, [toast]);

  const handleCheckout = useCallback(() => {
    if (orderItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items before checkout",
      });
      return;
    }
    setShowPayment(true);
  }, [orderItems, toast]);

  const handlePaymentConfirm = useCallback((details: PaymentDetails) => {
    // Record quantity history for smart qty dialog
    orderItems.forEach((item) => {
      setQuantityHistory((prev) => ({
        ...prev,
        [item.product.id]: [...(prev[item.product.id] || []), item.quantity].slice(-10), // Keep last 10
      }));
    });

    setShowPayment(false);
    setReceiptItems([...orderItems]);
    setReceiptPayment(details);
    setOrderItems([]);
  }, [orderItems, setQuantityHistory, setOrderItems]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setReceiptItems(null);
    setReceiptPayment(null);
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-3rem)] flex gap-6">
        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/20 rounded-lg glow-primary">
                <Terminal className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">QuickPOS</h1>
            </div>
            <p className="text-muted-foreground">
              Fast product search with auto-complete
            </p>
          </header>

          {/* Search Area */}
          <div className="flex-1 flex items-start justify-center pt-12">
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

          {/* Keyboard Hint */}
          <footer className="mt-auto pt-4 text-center text-sm text-muted-foreground">
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
