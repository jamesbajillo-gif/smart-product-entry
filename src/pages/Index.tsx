import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Product, OrderItem, ProductCategory } from "@/types/product";
import { OrderSidebar } from "@/components/OrderSidebar";
import { ProductSearch } from "@/components/ProductSearch";
import { AddProductDialog } from "@/components/AddProductDialog";
import { PaymentDialog, PaymentDetails } from "@/components/PaymentDialog";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { GCashTransactionDialog, GCashTransactionDetails } from "@/components/GCashTransactionDialog";
import { AddGCashFundsDialog } from "@/components/AddGCashFundsDialog";
import { GCashTransactionsDialog } from "@/components/GCashTransactionsDialog";
import { BottleDepositRefundDialog } from "@/components/BottleDepositRefundDialog";
import { StoreFundsDialog } from "@/components/StoreFundsDialog";
import { StoreFundsHistoryDialog } from "@/components/StoreFundsHistoryDialog";
import { CandiesPromoDialog } from "@/components/CandiesPromoDialog";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { salesApi, SaleRecord } from "@/services/mysqlApi";
import { Terminal, Wifi, WifiOff, Receipt, Package, CloudOff, RefreshCw, ShoppingCart, Menu, TrendingUp, Smartphone, BarChart3, CircleDot, Wallet } from "lucide-react";

const Index = () => {
  const {
    products,
    addProduct,
    recordSale,
    isOnline,
    isLoading,
    pendingSalesCount,
    isSyncing,
    triggerSync,
  } = useMySQLSync();

  const [orderItems, setOrderItems] = useSessionStorage<OrderItem[]>("pos-order", []);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentDetails | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showGcashDialog, setShowGcashDialog] = useState(false);
  const [showAddFundsDialog, setShowAddFundsDialog] = useState(false);
  const [showGCashTransactionsDialog, setShowGCashTransactionsDialog] = useState(false);
  const [showBottleDepositRefundDialog, setShowBottleDepositRefundDialog] = useState(false);
  const [showStoreFundsDialog, setShowStoreFundsDialog] = useState(false);
  const [showStoreFundsHistoryDialog, setShowStoreFundsHistoryDialog] = useState(false);
  const [showCandiesPromoDialog, setShowCandiesPromoDialog] = useState(false);
  const [candiesPromoProduct, setCandiesPromoProduct] = useState<Product | null>(null);
  const [gcashProduct, setGcashProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const { toast } = useToast();
  const { funds: gcashFunds, addFunds, processGCashIn, processGCashOut } = useGCashFunds();
  const { funds: storeFunds, history: storeFundsHistory, addFunds: addStoreFunds, withdrawFunds: withdrawStoreFunds, refresh: refreshStoreFunds } = useStoreFunds();

  // Track the last modified product ID for keyboard shortcuts
  const lastModifiedProductIdRef = useRef<string | null>(null);

  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate bottle deposit for beverages
  const calculateBottleDeposit = useMemo(() => {
    let totalBottleDeposit = 0;
    const bottleDepositBreakdown: Array<{ productName: string; quantity: number; deposit: number; total: number }> = [];

    orderItems.forEach((item) => {
      const product = item.product;
      const isBeverages = product.category?.toLowerCase().trim() === 'beverages';
      
      if (isBeverages) {
        // Get remembered bottle deposit enabled state
        const enabledKey = `beverages_bottle_deposit_enabled_${product.id}`;
        const enabled = localStorage.getItem(enabledKey);
        const isEnabled = enabled === null ? true : enabled === 'true'; // Default to enabled
        
        if (isEnabled) {
          // Get remembered bottle deposit amount
          const depositKey = `beverages_bottle_deposit_${product.id}`;
          const saved = localStorage.getItem(depositKey);
          const depositAmount = saved ? parseFloat(saved) : 10; // Default ₱10
          
          if (!isNaN(depositAmount) && depositAmount > 0) {
            const depositTotal = depositAmount * item.quantity;
            totalBottleDeposit += depositTotal;
            bottleDepositBreakdown.push({
              productName: product.name,
              quantity: item.quantity,
              deposit: depositAmount,
              total: depositTotal,
            });
          }
        }
      }
    });

    return { total: totalBottleDeposit, breakdown: bottleDepositBreakdown };
  }, [orderItems]);

  // Calculate subtotal (product prices only)
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [orderItems]);

  // Calculate total (subtotal + bottle deposit)
  const totalWithBottleDeposit = subtotal + calculateBottleDeposit.total;

  // Load sales data for most sold products
  const loadSales = useCallback(async () => {
    if (!isOnline) return;
    setIsLoadingSales(true);
    const result = await salesApi.getAll({ limit: 500 });
    if (result.success && result.data) {
      setSales(result.data);
    }
    setIsLoadingSales(false);
  }, [isOnline]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Parse sale items
  const parseSaleItems = (itemsJson: string) => {
    try {
      return JSON.parse(itemsJson) as Array<{ productId: string; name: string; quantity: number; price: number }>;
    } catch {
      return [];
    }
  };

  // Calculate GCASH-CNV: Add service fees from GCASH-IN (paid in cash), deduct from GCASH-OUT (paid in GCash)
  const totalGCashServiceFees = useMemo(() => {
    let calculatedTotal = 0;
    let gcashInCount = 0;
    let gcashOutCount = 0;
    let gcashInWithServiceCharge = 0;
    let gcashOutWithServiceCharge = 0;
    
    const result = sales.reduce((total, sale) => {
      try {
        const items = parseSaleItems(sale.items);
        
        // Check if this sale has a GCASH-IN or GCASH-OUT transaction first
        const gcashInItem = items.find(item => item.name === "GCASH-IN");
        const gcashOutItem = items.find(item => item.name === "GCASH-OUT");
        
        // Only process if it's a GCASH transaction
        if (!gcashInItem && !gcashOutItem) return total;
        
        // Find the service charge item
        const serviceChargeItem = items.find(item => item.name === "Service Charge");
        
        if (gcashInItem) {
          gcashInCount++;
          // GCASH-IN: Customer pays cash for transaction amount + service charge (both are cash received)
          const transactionAmount = gcashInItem.price * gcashInItem.quantity;
          let amountToAdd = transactionAmount;
          
          if (serviceChargeItem) {
            gcashInWithServiceCharge++;
            const serviceChargeAmount = serviceChargeItem.price * serviceChargeItem.quantity;
            // Add both transaction amount and service charge (both paid in cash)
            amountToAdd += serviceChargeAmount;
          }
          
          return total + amountToAdd;
        }
        
        if (gcashOutItem) {
          gcashOutCount++;
          // GCASH-OUT: Customer sends GCash, we give cash (deduct transaction amount)
          const transactionAmount = gcashOutItem.price * gcashOutItem.quantity;
          let amountToDeduct = transactionAmount;
          
          if (serviceChargeItem) {
            gcashOutWithServiceCharge++;
            const serviceChargeAmount = serviceChargeItem.price * serviceChargeItem.quantity;
            // Add service charge (revenue/profit) but deduct transaction amount (cash given)
            amountToDeduct -= serviceChargeAmount; // Net: deduct (transaction - service charge)
          }
          
          return total - amountToDeduct;
        }
      } catch (error) {
        // Log error for debugging
        console.error("Error calculating GCASH-CNV:", error, sale);
      }
      return total;
    }, 0);
    
    // Debug logging (remove in production if needed)
    if (gcashInCount > 0 || gcashOutCount > 0) {
      console.log("GCASH-CNV Calculation:", {
        total: result,
        gcashInCount,
        gcashOutCount,
        gcashInWithServiceCharge,
        gcashOutWithServiceCharge,
      });
    }
    
    return result;
  }, [sales]);

  // Calculate total unrefunded bottle deposits
  const totalUnrefundedBottleDeposits = useMemo(() => {
    return sales.reduce((total, sale) => {
      // Skip if already refunded
      if (sale.bottle_deposit_refunded === 1) return total;
      
      try {
        const items = parseSaleItems(sale.items);
        
        // Sum up all bottle deposit totals from items
        const depositTotal = items.reduce((sum, item: any) => {
          // Check if item has bottleDepositTotal (from beverages)
          if (item.bottleDepositTotal && typeof item.bottleDepositTotal === 'number') {
            return sum + item.bottleDepositTotal;
          }
          return sum;
        }, 0);
        
        return total + depositTotal;
      } catch (error) {
        console.error("Error calculating unrefunded bottle deposits:", error, sale);
        return total;
      }
    }, 0);
  }, [sales]);

  // Ensure GCASH product exists
  useEffect(() => {
    const ensureGcashProduct = async () => {
      if (!isOnline || isLoading) return;
      
      const gcash = products.find(p => p.name.toUpperCase() === "GCASH" || p.name.toUpperCase() === "GCASH SERVICE");
      
      if (!gcash) {
        await addProduct({
          name: "GCASH",
          price: 0,
          category: "Other",
          skip_stock_tracking: true,
        });
      }
    };
    
    ensureGcashProduct();
  }, [isOnline, isLoading, products, addProduct]);

  // Calculate most sold products
  const mostSoldProducts = useMemo(() => {
    const productCounts: Record<string, { product: Product | null; count: number }> = {};
    
    // Initialize with GCASH (always first)
    const gcash = products.find(p => p.name.toUpperCase() === "GCASH" || p.name.toUpperCase() === "GCASH SERVICE");
    
    if (gcash) {
      productCounts[gcash.id] = { product: gcash, count: 999999 }; // High priority
    }

    // Count sales for each product
    sales.forEach((sale) => {
      const items = parseSaleItems(sale.items);
      items.forEach((item) => {
        if (!productCounts[item.productId]) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            productCounts[item.productId] = { product, count: 0 };
          }
        }
        if (productCounts[item.productId]) {
          productCounts[item.productId].count += item.quantity;
        }
      });
    });

    // Sort by count and return top products (excluding GCASH from count-based sorting)
    const sorted = Object.values(productCounts)
      .filter(item => item.product !== null)
      .sort((a, b) => {
        // GCASH always first
        const aIsGcash = a.product?.name.toUpperCase() === "GCASH" || a.product?.name.toUpperCase() === "GCASH SERVICE";
        const bIsGcash = b.product?.name.toUpperCase() === "GCASH" || b.product?.name.toUpperCase() === "GCASH SERVICE";
        if (aIsGcash) return -1;
        if (bIsGcash) return 1;
        return b.count - a.count;
      })
      .slice(0, 12) // Show top 12 products
      .map(item => item.product!)
      .filter(Boolean);

    return sorted;
  }, [sales, products]);

  // Add product to cart (with or without qty dialog)
  const addToCart = useCallback((product: Product, quantity: number, customPrice?: number) => {
    setOrderItems((prev) => {
      // Create product with custom price if provided (for candies-promo)
      const productToAdd = customPrice !== undefined 
        ? { ...product, price: customPrice }
        : product;

      const existingIndex = prev.findIndex((item) => item.product.id === productToAdd.id);

      if (existingIndex >= 0) {
        const updated = [...prev];
        // If price changed, create new entry instead of merging
        if (customPrice !== undefined && updated[existingIndex].product.price !== customPrice) {
          // Track the last added product
          lastModifiedProductIdRef.current = productToAdd.id;
          return [...prev, { product: productToAdd, quantity }];
        }
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        // Track the last modified product
        lastModifiedProductIdRef.current = productToAdd.id;
        return updated;
      }

      // Track the last added product
      lastModifiedProductIdRef.current = productToAdd.id;
      return [...prev, { product: productToAdd, quantity }];
    });
  }, [setOrderItems]);

  const handleProductSelect = useCallback((product: Product) => {
    // Check if it's GCASH product
    const isGcash = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
    
    if (isGcash) {
      setGcashProduct(product);
      setShowGcashDialog(true);
      setSearchQuery("");
      return;
    }
    
    // Check if it's candies-promo category
    const isCandiesPromo = product.category?.toLowerCase().trim() === "candies-promo";
    
    if (isCandiesPromo) {
      setCandiesPromoProduct(product);
      setShowCandiesPromoDialog(true);
      setSearchQuery("");
      return;
    }
    
    // Skip stock warnings for "always available" products
    if (!product.skip_stock_tracking) {
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
    }
    
    // Add directly to cart with quantity 1 (skip quantity dialog)
    addToCart(product, 1);
    // Clear search query but don't focus search input - allow arrow keys to work on cart
    setSearchQuery("");
    // Blur search input if it's focused
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, [addToCart, toast]);

  const handleAddNewProduct = useCallback((name: string) => {
    setNewProductName(name);
    setSearchQuery("");
  }, []);

  const handleNewProductConfirm = useCallback(
    async (name: string, price: number | undefined, category?: string, stockQuantity?: number) => {
      // Build product data - price defaults to 0 if not provided
      const productData: {
        name: string;
        price: number;
        category?: string;
        stock_quantity?: number;
        low_stock_threshold?: number;
      } = { 
        name, 
        price: price ?? 0, // Default to 0 if price is not provided
        category 
      };
      
      // Only add stock fields if user explicitly entered a value
      if (stockQuantity !== undefined && stockQuantity > 0) {
        productData.stock_quantity = stockQuantity;
        productData.low_stock_threshold = 5;
      }
      
      const result = await addProduct(productData as Omit<Product, "id">);
      setNewProductName(null);
      if (result.success && result.product) {
        // Add the newly created product directly to cart
        addToCart(result.product, 1);
        toast({
          title: "Product added",
          description: price !== undefined 
            ? `${name} - ₱${price.toFixed(2)}`
            : `${name} (price can be set later)`,
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
    // Store items and payment details before clearing
    const itemsToReceipt = [...orderItems];
    const paymentToReceipt = details;
    
    // Close payment dialog immediately for better UX
    setShowPayment(false);
    setReceiptItems(itemsToReceipt);
    setReceiptPayment(paymentToReceipt);
    setOrderItems([]);
    
    // Record sale to database in the background (non-blocking)
    recordSale(itemsToReceipt, paymentToReceipt).catch((error) => {
      console.error("Failed to record sale:", error);
      toast({
        title: "Sale Recorded Locally",
        description: "Sale will be synced when connection is restored",
        variant: "default",
      });
    });
  }, [orderItems, recordSale, setOrderItems, toast]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setReceiptItems(null);
    setReceiptPayment(null);
  }, []);

  const handleGcashTransaction = useCallback(async (details: GCashTransactionDetails) => {
    if (!gcashProduct) return;
    
    // Process the GCash fund transaction (use base amount, not including service charge)
    let fundResult;
    if (details.type === "gcash-in") {
      // GCASH-IN: Customer pays cash, we send GCash (deducts from our GCASH funds)
      // Note: Service charge is our profit, doesn't affect GCASH balance
      fundResult = processGCashIn(details.amount, details.gcashNumber, details.notes);
      if (!fundResult.success) {
        toast({
          title: "Transaction Failed",
          description: fundResult.error || "Insufficient GCASH funds",
          variant: "destructive",
        });
        return;
      }
    } else {
      // GCASH-OUT: Customer sends GCash, we give cash (adds to our GCASH funds)
      // Note: Service charge is our profit, doesn't affect GCASH balance
      fundResult = processGCashOut(details.amount, details.notes);
      if (!fundResult.success) {
        toast({
          title: "Transaction Failed",
          description: fundResult.error || "Failed to process transaction",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Create a product name with transaction type for the sale record
    const transactionName = details.type === "gcash-in" ? "GCASH-IN" : "GCASH-OUT";
    
    // Create order items: base transaction + service charge (if applicable)
    const items: OrderItem[] = [
      {
        product: {
          ...gcashProduct,
          name: transactionName,
          price: details.amount, // Base transaction amount
        },
        quantity: 1,
      },
    ];
    
    // Add service charge as a separate item if applicable
    if (details.serviceCharge > 0) {
      items.push({
        product: {
          ...gcashProduct,
          name: "Service Charge",
          price: details.serviceCharge,
        },
        quantity: 1,
      });
    }
    
    // Determine payment method based on transaction type
    // GCASH-IN: Customer pays cash (totalAmount includes service charge)
    // GCASH-OUT: Customer sends GCash (totalAmount includes service charge)
    const paymentDetails: PaymentDetails = {
      method: details.type === "gcash-in" ? "cash" : "gcash",
      amountTendered: details.totalAmount, // Customer pays the total (amount + service charge)
      change: 0,
    };
    
    // Record the sale immediately (GCash transactions are instant)
    await recordSale(items, paymentDetails);
    
    // Refresh sales data to update GCASH-CNV badge
    await loadSales();
    
    setShowGcashDialog(false);
    setGcashProduct(null);
    setSearchQuery("");
    
    const serviceChargeText = details.serviceCharge > 0 ? ` (Service: ₱${details.serviceCharge.toFixed(2)})` : "";
    toast({
      title: "GCash Transaction Recorded",
      description: `${transactionName}: ₱${details.amount.toFixed(2)}${serviceChargeText} | Total: ₱${details.totalAmount.toFixed(2)} | Balance: ₱${fundResult.balance.toFixed(2)}`,
    });
  }, [gcashProduct, recordSale, processGCashIn, processGCashOut, toast, loadSales]);

  const handleAddFunds = useCallback((amount: number, notes?: string) => {
    const result = addFunds(amount, notes);
    if (result.success) {
      setShowAddFundsDialog(false);
      toast({
        title: "Funds Added",
        description: `₱${amount.toFixed(2)} added to GCASH | New balance: ₱${result.balance.toFixed(2)}`,
      });
    }
  }, [addFunds, toast]);

  // Handle keyboard shortcuts for recently added item
  const handleRecentlyAddedItemAction = useCallback((action: 'delete' | 'increase' | 'decrease') => {
    if (orderItems.length === 0) return;
    
    // Find the last modified item, or use the last item in the array as fallback
    let targetItem: OrderItem | null = null;
    let targetIndex = -1;
    
    if (lastModifiedProductIdRef.current) {
      // Find the item with the last modified product ID
      targetIndex = orderItems.findIndex(
        (item) => item.product.id === lastModifiedProductIdRef.current
      );
      if (targetIndex >= 0) {
        targetItem = orderItems[targetIndex];
      }
    }
    
    // Fallback to last item if last modified item not found
    if (!targetItem && orderItems.length > 0) {
      targetIndex = orderItems.length - 1;
      targetItem = orderItems[targetIndex];
      // Update ref to track this item
      if (targetItem) {
        lastModifiedProductIdRef.current = targetItem.product.id;
      }
    }
    
    if (!targetItem) return;
    
    if (action === 'delete') {
      // Remove the item completely
      setOrderItems((prev) => prev.filter((_, index) => index !== targetIndex));
      lastModifiedProductIdRef.current = null;
    } else if (action === 'increase') {
      // Increase quantity by 1
      setOrderItems((prev) =>
        prev.map((item, index) =>
          index === targetIndex ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else if (action === 'decrease') {
      // Decrease quantity by 1, remove if reaches 0
      const newQuantity = targetItem.quantity - 1;
      if (newQuantity <= 0) {
        setOrderItems((prev) => prev.filter((_, index) => index !== targetIndex));
        lastModifiedProductIdRef.current = null;
      } else {
        setOrderItems((prev) =>
          prev.map((item, index) =>
            index === targetIndex ? { ...item, quantity: newQuantity } : item
          )
        );
      }
    }
  }, [orderItems, setOrderItems]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;
      const isButtonFocused = activeElement instanceof HTMLButtonElement ||
        activeElement?.getAttribute("role") === "button";
      
      // Arrow Up/Down should work directly on cart even when dialogs might be open
      // (except when input is focused or critical dialogs are open)
      const canHandleArrowKeys = !isInputFocused && 
        !showPayment && 
        !receiptItems &&
        !showGcashDialog &&
        !showAddFundsDialog;
      
      // Handle Arrow Up - increase quantity of recently added item (works directly on cart)
      if (e.key === "ArrowUp" && canHandleArrowKeys) {
        e.preventDefault();
        handleRecentlyAddedItemAction('increase');
        return;
      }
      
      // Handle Arrow Down - decrease quantity of recently added item (works directly on cart)
      if (e.key === "ArrowDown" && canHandleArrowKeys) {
        e.preventDefault();
        handleRecentlyAddedItemAction('decrease');
        return;
      }
      
      // Handle letter/number keys - focus search input and append character
      // Only if not already in an input and no critical dialogs are open
      if (!isInputFocused && 
          !isButtonFocused &&
          !showPayment && 
          !receiptItems && 
          !newProductName &&
          !showGcashDialog &&
          !showAddFundsDialog &&
          e.key.length === 1 && 
          /[a-zA-Z0-9]/.test(e.key) &&
          !e.ctrlKey && 
          !e.metaKey && 
          !e.altKey) {
        e.preventDefault();
        // Focus search input and append the typed character
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          setSearchQuery((prev) => prev + e.key);
        }
        return;
      }
      
      // Only handle other shortcuts if no input/button is focused and no dialogs are open
      const canHandleShortcuts = !isInputFocused && 
        !isButtonFocused &&
        !showPayment && 
        !receiptItems && 
        !newProductName &&
        !showGcashDialog &&
        !showAddFundsDialog;
      
      if (!canHandleShortcuts) {
        // Still handle Enter for checkout if button is focused, but NOT if search input is focused
        // Check if search input is focused to prevent triggering checkout when selecting products
        const isSearchInputFocused = searchInputRef.current === document.activeElement;
        if (e.key === "Enter" && 
            !isInputFocused && 
            !isSearchInputFocused &&
            !showPayment && 
            !receiptItems && 
            !newProductName) {
          e.preventDefault();
          handleCheckout();
        }
        return;
      }
      
      // Handle Backspace or Delete - remove recently added item
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleRecentlyAddedItemAction('delete');
        return;
      }
      
      // Handle Enter - trigger checkout (only if search input is not focused)
      // Check if search input is focused to prevent triggering checkout when selecting products
      const isSearchInputFocused = searchInputRef.current === document.activeElement;
      if (e.key === "Enter" && !isSearchInputFocused) {
        e.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showPayment, 
    receiptItems, 
    newProductName, 
    showGcashDialog, 
    showAddFundsDialog, 
    handleCheckout, 
    handleRecentlyAddedItemAction,
  ]);

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
              
              {/* GCASH Balance */}
              <button
                onClick={() => setShowAddFundsDialog(true)}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                title="Click to add funds"
              >
                <Smartphone className="w-3 h-3" />
                GCASH: ₱{gcashFunds.toFixed(2)}
              </button>
              
              {/* GCASH-CNV Badge (Total service fees from GCASH-IN and GCASH-OUT) */}
              {totalGCashServiceFees > 0 && (
                <button
                  onClick={() => setShowGCashTransactionsDialog(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-info/20 text-info border border-info/30 hover:bg-info/30 transition-colors cursor-pointer"
                  title="Click to view all GCash transactions"
                >
                  <TrendingUp className="w-3 h-3" />
                  GCASH-CNV: ₱{totalGCashServiceFees.toFixed(2)}
                </button>
              )}
              
              {/* Bottle Deposit Badge (Total unrefunded bottle deposits) */}
              {totalUnrefundedBottleDeposits > 0 && (
                <button
                  onClick={() => setShowBottleDepositRefundDialog(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors cursor-pointer"
                  title="Click to refund bottle deposits"
                >
                  <CircleDot className="w-3 h-3" />
                  Bottle Deposit: ₱{totalUnrefundedBottleDeposits.toFixed(2)}
                </button>
              )}
              
              {/* Store Funds Badge */}
              <button
                onClick={() => setShowStoreFundsHistoryDialog(true)}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors cursor-pointer"
                title="Click to view store funds"
              >
                <Wallet className="w-3 h-3" />
                Store Funds: ₱{storeFunds.toFixed(2)}
              </button>
              
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
                <Link to="/analytics" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden lg:inline">Analytics</span>
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
              <button
                onClick={() => setShowAddFundsDialog(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary"
              >
                <Smartphone className="w-3 h-3" />
                ₱{gcashFunds.toFixed(2)}
              </button>
              {totalGCashServiceFees > 0 && (
                <button
                  onClick={() => setShowGCashTransactionsDialog(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-info/20 text-info border border-info/30 hover:bg-info/30 transition-colors cursor-pointer"
                  title="Click to view all GCash transactions"
                >
                  <TrendingUp className="w-3 h-3" />
                  CNV: ₱{totalGCashServiceFees.toFixed(2)}
                </button>
              )}
              {totalUnrefundedBottleDeposits > 0 && (
                <button
                  onClick={() => setShowBottleDepositRefundDialog(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors cursor-pointer"
                  title="Click to refund bottle deposits"
                >
                  <CircleDot className="w-3 h-3" />
                  Deposit: ₱{totalUnrefundedBottleDeposits.toFixed(2)}
                </button>
              )}
              <button
                onClick={() => setShowStoreFundsDialog(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors cursor-pointer"
                title="Click to manage store funds"
              >
                <Wallet className="w-3 h-3" />
                Funds: ₱{storeFunds.toFixed(2)}
              </button>
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
              <Link to="/analytics">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Analytics
                </Button>
              </Link>
            </div>
            
            <p className="text-muted-foreground text-sm sm:text-base hidden sm:block">
              Fast product search with auto-complete
            </p>
          </header>

          {/* Search Area */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-8 lg:pt-12">
            <div className="w-full max-w-2xl mb-6">
              <ProductSearch
                products={products}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onProductSelect={handleProductSelect}
                onAddNewProduct={handleAddNewProduct}
                onCheckout={handleCheckout}
                searchInputRef={searchInputRef}
              />
            </div>

            {/* Most Sold Products */}
            {!searchQuery && mostSoldProducts.length > 0 && (
              <div className="w-full max-w-4xl">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">Most Sold Products</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 px-2">
                  {mostSoldProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="flex flex-col items-center p-2 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors group"
                    >
                      {/* Thumbnail */}
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full aspect-square object-cover rounded-lg mb-2 group-hover:opacity-80 transition-opacity"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full aspect-square bg-secondary rounded-lg mb-2 items-center justify-center ${product.image_url ? 'hidden' : 'flex'}`}
                      >
                        <Package className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                      
                      {/* Price below thumbnail - show funds for GCash */}
                      {(() => {
                        const isGcash = product.name.toUpperCase() === "GCASH" || product.name.toUpperCase() === "GCASH SERVICE";
                        if (isGcash) {
                          return (
                            <div className="text-xs font-mono text-info font-semibold">
                              Funds: ₱{gcashFunds.toFixed(2)}
                            </div>
                          );
                        }
                        return (
                          <div className="text-xs font-mono text-primary font-semibold">
                            ₱{product.price.toFixed(2)}
                          </div>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
          subtotal={subtotal}
          bottleDeposit={calculateBottleDeposit.total}
          bottleDepositBreakdown={calculateBottleDeposit.breakdown}
          total={totalWithBottleDeposit}
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

      {/* GCash Transaction Dialog */}
      {showGcashDialog && gcashProduct && (
        <GCashTransactionDialog
          currentBalance={gcashFunds}
          onConfirm={handleGcashTransaction}
          onCancel={() => {
            setShowGcashDialog(false);
            setGcashProduct(null);
          }}
        />
      )}

      {/* Add GCash Funds Dialog */}
      {showAddFundsDialog && (
        <AddGCashFundsDialog
          currentBalance={gcashFunds}
          onConfirm={handleAddFunds}
          onCancel={() => setShowAddFundsDialog(false)}
        />
      )}

      {/* GCash Transactions Dialog */}
      {showGCashTransactionsDialog && (
        <GCashTransactionsDialog
          sales={sales}
          onClose={() => setShowGCashTransactionsDialog(false)}
        />
      )}

      {/* Bottle Deposit Refund Dialog */}
      {showBottleDepositRefundDialog && (
        <BottleDepositRefundDialog
          sales={sales}
          onClose={() => setShowBottleDepositRefundDialog(false)}
          onRefunded={async () => {
            await loadSales();
            setShowBottleDepositRefundDialog(false);
          }}
        />
      )}

      {/* Store Funds Dialog */}
      {showStoreFundsDialog && (
        <StoreFundsDialog
          currentBalance={storeFunds}
          onConfirm={async (type, amount, notes, category) => {
            const result = type === "add" 
              ? await addStoreFunds(amount, notes, category)
              : await withdrawStoreFunds(amount, notes, category);
            
            if (result.success) {
              await refreshStoreFunds();
            }
            return result;
          }}
          onCancel={() => setShowStoreFundsDialog(false)}
        />
      )}

      {/* Store Funds History Dialog */}
      {showStoreFundsHistoryDialog && (
        <StoreFundsHistoryDialog
          balance={storeFunds}
          transactions={storeFundsHistory}
          onClose={() => setShowStoreFundsHistoryDialog(false)}
        />
      )}

      {/* Candies Promo Dialog */}
      {showCandiesPromoDialog && candiesPromoProduct && (
        <CandiesPromoDialog
          product={candiesPromoProduct}
          onConfirm={(quantity, price) => {
            // Calculate price per unit for the cart
            const pricePerUnit = price / quantity;
            addToCart(candiesPromoProduct, quantity, pricePerUnit);
            setShowCandiesPromoDialog(false);
            setCandiesPromoProduct(null);
            // Blur search input if it's focused
            if (searchInputRef.current) {
              searchInputRef.current.blur();
            }
          }}
          onCancel={() => {
            setShowCandiesPromoDialog(false);
            setCandiesPromoProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default Index;