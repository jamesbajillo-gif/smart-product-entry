import { useState, useCallback } from "react";
import { Product, OrderItem } from "@/types/product";
import { initialProducts } from "@/data/products";
import { OrderSidebar } from "@/components/OrderSidebar";
import { ProductSearch } from "@/components/ProductSearch";
import { QuantityDialog } from "@/components/QuantityDialog";
import { AddProductDialog } from "@/components/AddProductDialog";
import { PaymentDialog, PaymentMethod } from "@/components/PaymentDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { useToast } from "@/hooks/use-toast";
import { Terminal } from "lucide-react";

const Index = () => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<PaymentMethod | null>(null);
  const { toast } = useToast();

  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSearchQuery("");
  }, []);

  const handleAddNewProduct = useCallback((name: string) => {
    setNewProductName(name);
    setSearchQuery("");
  }, []);

  const handleQuantityConfirm = useCallback(
    (quantity: number) => {
      if (!selectedProduct) return;

      setOrderItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.product.id === selectedProduct.id
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          return updated;
        }

        return [...prev, { product: selectedProduct, quantity }];
      });

      toast({
        title: "Added to order",
        description: `${quantity}× ${selectedProduct.name} (₱${(selectedProduct.price * quantity).toFixed(2)})`,
      });

      setSelectedProduct(null);
    },
    [selectedProduct, toast]
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

  const handlePaymentConfirm = useCallback((method: PaymentMethod) => {
    setShowPayment(false);
    setReceiptItems([...orderItems]);
    setReceiptPaymentMethod(method);
    setOrderItems([]);
  }, [orderItems]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setReceiptItems(null);
    setReceiptPaymentMethod(null);
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
      {receiptItems && receiptPaymentMethod && (
        <ReceiptDialog
          items={receiptItems}
          paymentMethod={receiptPaymentMethod}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  );
};

export default Index;
