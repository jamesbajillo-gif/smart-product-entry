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
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";
import { SalesLogDialog } from "@/components/SalesLogDialog";
import { CandiesPromoDialog } from "@/components/CandiesPromoDialog";
import { ServiceSelectionDialog } from "@/components/ServiceSelectionDialog";
import { ProductService } from "@/types/product";
import { useGCashFunds } from "@/hooks/useGCashFunds";
import { useStoreFunds } from "@/hooks/useStoreFunds";
import { useMySQLSync } from "@/hooks/useMySQLSync";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { salesApi, SaleRecord, FeeRecord, checkApiConnection } from "@/services/mysqlApi";
import { getApplicableFees, calculateFeeAmount, getProductsForFee, calculateTotalFees } from "@/utils/fees";
import { Terminal, Receipt, Package, CloudOff, RefreshCw, ShoppingCart, Menu, TrendingUp, Smartphone, BarChart3, CircleDot, Wallet, Settings, Plus, Calendar } from "lucide-react";

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
    refreshProducts,
  } = useMySQLSync();

  const [orderItems, setOrderItems] = useSessionStorage<OrderItem[]>("pos-order", []);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchUpdateRef = useRef<number>(0);
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Initialize with Philippine time
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  });
  const [showPayment, setShowPayment] = useState(false);
  const [receiptItems, setReceiptItems] = useState<OrderItem[] | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentDetails | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showReceiptInCart, setShowReceiptInCart] = useState(false);
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<Array<{ product: Product; quantity: number; timestamp: number }>>([]);
  
  // Store recent transactions to prevent duplicates
  const recentTransactionsRef = useRef<Array<{ fingerprint: string; timestamp: number }>>([]);
  const [showGcashDialog, setShowGcashDialog] = useState(false);
  const [showAddFundsDialog, setShowAddFundsDialog] = useState(false);
  const [showGCashTransactionsDialog, setShowGCashTransactionsDialog] = useState(false);
  const [showBottleDepositRefundDialog, setShowBottleDepositRefundDialog] = useState(false);
  const [showStoreFundsDialog, setShowStoreFundsDialog] = useState(false);
  const [showStoreFundsHistoryDialog, setShowStoreFundsHistoryDialog] = useState(false);
  const [showTransactionHistoryDialog, setShowTransactionHistoryDialog] = useState(false);
  const [showSalesLogDialog, setShowSalesLogDialog] = useState(false);
  const [showCandiesPromoDialog, setShowCandiesPromoDialog] = useState(false);
  const [candiesPromoProduct, setCandiesPromoProduct] = useState<Product | null>(null);
  const [gcashProduct, setGcashProduct] = useState<Product | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [serviceProduct, setServiceProduct] = useState<Product | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const { toast } = useToast();
  // GCash Funds: Credits (wallet balance) and Cash (actual cash from transactions)
  const { credits: gcashCredits, cash: gcashCash, funds: gcashFunds, history: gcashHistory, addFunds, processGCashIn, processGCashOut } = useGCashFunds();
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

  // Calculate subtotal (product prices + services only)
  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const productTotal = item.product.price * item.quantity;
      const servicesTotal = (item.selectedServices || []).reduce(
        (serviceSum, service) => serviceSum + service.price * item.quantity,
        0
      );
      return sum + productTotal + servicesTotal;
    }, 0);
  }, [orderItems]);

  // Calculate applicable fees
  const [applicableFees, setApplicableFees] = useState<FeeRecord[]>([]);
  const [totalFees, setTotalFees] = useState(0);

  useEffect(() => {
    if (orderItems.length > 0) {
      getApplicableFees(orderItems).then((fees) => {
        setApplicableFees(fees);
        let feesTotal = 0;
        fees.forEach(fee => {
          // Get matching items for this fee
          const matchingItems = getProductsForFee(fee, orderItems);
          const matchingItemsCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
          feesTotal += calculateFeeAmount(fee, subtotal, matchingItemsCount);
        });
        setTotalFees(feesTotal);
      });
    } else {
      setApplicableFees([]);
      setTotalFees(0);
    }
  }, [orderItems, subtotal]);

  // Calculate total (subtotal + fees + bottle deposit)
  const totalWithBottleDeposit = subtotal + totalFees + calculateBottleDeposit.total;
  
  // Calculate today's total completed sales
  const todayTotalSales = useMemo(() => {
    if (!sales || sales.length === 0) return 0;
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Filter sales for today and calculate total
    const todaySales = sales.filter(sale => {
      if (!sale.created_at) return false;
      const saleDate = new Date(sale.created_at);
      return saleDate >= todayStart && saleDate <= todayEnd;
    });
    
    // Sum all today's sales totals
    return todaySales.reduce((total, sale) => {
      return total + Number(sale.total || 0);
    }, 0);
  }, [sales]);

  // Load sales data for most sold products
  const loadSales = useCallback(async () => {
    // Always try to load, check connection first if needed
    const connected = isOnline || await checkApiConnection();
    if (!connected) {
      setIsLoadingSales(false);
      return;
    }
    setIsLoadingSales(true);
    try {
      const result = await salesApi.getAll({ limit: 500 });
      if (result.success && result.data) {
        setSales(result.data);
      }
    } catch (error) {
      console.error("Error loading sales:", error);
    } finally {
      setIsLoadingSales(false);
    }
  }, [isOnline]);

  // Load sales on mount and when online status changes
  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Also load sales when connection is established
  useEffect(() => {
    if (isOnline) {
      loadSales();
    }
  }, [isOnline, loadSales]);

  // Refresh sales when sync completes (for offline sales that were synced)
  useEffect(() => {
    if (isOnline && !isSyncing && pendingSalesCount === 0) {
      // Small delay to ensure sync is fully complete
      const timeout = setTimeout(() => {
        loadSales();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, isSyncing, pendingSalesCount, loadSales]);

  // Trigger updates when search is used (debounced)
  const triggerDataUpdate = useCallback(async () => {
    if (!isOnline) return;
    
    // Prevent too frequent updates (max once per 2 seconds)
    const now = Date.now();
    if (now - lastSearchUpdateRef.current < 2000) {
      return;
    }
    lastSearchUpdateRef.current = now;
    
    // Refresh all data for status bars:
    // - Products (for stock updates)
    // - Sales (for today's total, recent sold items)
    // - Store funds (for store funds status indicator)
    try {
      await Promise.all([
        refreshProducts(),
        loadSales(),
        refreshStoreFunds(),
      ]);
    } catch (error) {
      console.error("Error updating data on search:", error);
    }
  }, [isOnline, refreshProducts, loadSales, refreshStoreFunds]);

  // Debounced search trigger - update data when user searches
  useEffect(() => {
    // Clear existing timeout
    if (searchUpdateTimeoutRef.current) {
      clearTimeout(searchUpdateTimeoutRef.current);
    }
    
    // Only trigger if search query has meaningful content (at least 2 characters)
    if (searchQuery.trim().length >= 2) {
      // Wait 1 second after user stops typing before triggering update
      searchUpdateTimeoutRef.current = setTimeout(() => {
        triggerDataUpdate();
      }, 1000);
    }
    
    return () => {
      if (searchUpdateTimeoutRef.current) {
        clearTimeout(searchUpdateTimeoutRef.current);
      }
    };
  }, [searchQuery, triggerDataUpdate]);

  // Update date/time every minute (Philippine time)
  useEffect(() => {
    const updateDate = () => {
      // Get current time in Philippine timezone (Asia/Manila, UTC+8)
      const now = new Date();
      setCurrentDate(now);
    };
    
    // Update immediately
    updateDate();
    
    // Update every minute
    const interval = setInterval(updateDate, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Format date for display (Philippine time)
  const formattedDate = useMemo(() => {
    return currentDate.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [currentDate]);

  const formattedTime = useMemo(() => {
    return currentDate.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [currentDate]);

  // Parse sale items
  const parseSaleItems = (itemsJson: string) => {
    try {
      return JSON.parse(itemsJson) as Array<{ productId: string; name: string; quantity: number; price: number; selectedServices?: Array<{ id: string; name: string; price: number }> }>;
    } catch {
      return [];
    }
  };

  // Helper to get full product name with variation
  const getProductDisplayName = useCallback((item: { productId: string; name: string; price: number }) => {
    // Check if productId contains variation ID (format: "baseId-variationId")
    if (item.productId.includes('-')) {
      const [baseProductId, variationId] = item.productId.split('-', 2);
      const baseProduct = products.find(p => p.id === baseProductId);
      
      if (baseProduct) {
        // Try to find the variation
        const variations = baseProduct.variations || [];
        let variation: any = null;
        
        // Parse variations if string
        let parsedVariations: any[] = [];
        if (Array.isArray(variations)) {
          parsedVariations = variations;
        } else if (typeof variations === 'string') {
          try {
            parsedVariations = JSON.parse(variations);
          } catch {
            parsedVariations = [];
          }
        }
        
        // Find variation by ID or name
        variation = parsedVariations.find((v: any) => 
          v && (v.id === variationId || v.name === variationId || `${baseProductId}-${v.id}` === item.productId || `${baseProductId}-${v.name}` === item.productId)
        );
        
        if (variation && variation.name) {
          const variationName = variation.name.trim();
          // Check if variation name is auto-generated (contains price pattern)
          const isAutoGenerated = variationName.includes(' - ₱') && /₱\d+\.\d{2}$/.test(variationName);
          
          if (!isAutoGenerated && variationName) {
            // Return "Product Name - Variation Name"
            return `${baseProduct.name} - ${variationName}`;
          }
        }
        
        // If variation found but no name or auto-generated, check if stored name already includes variation
        if (item.name && item.name.includes(' - ') && !item.name.match(/₱\d+\.\d{2}$/)) {
          return item.name;
        }
      }
    }
    
    // Return stored name as-is (might already include variation)
    return item.name;
  }, [products]);

  // Get 10 most recent sold items for status bar
  const recentSoldItems = useMemo(() => {
    const items: Array<{ name: string; price: number; quantity: number; total: number }> = [];
    
    // Get the 10 most recent sales
    const recentSales = sales.slice(0, 10);
    
    recentSales.forEach((sale) => {
      try {
        const parsedItems = parseSaleItems(sale.items || '[]');
        parsedItems.forEach((item) => {
          // Calculate item total (product price + services)
          const productTotal = (item.price || 0) * (item.quantity || 0);
          const servicesTotal = (item.selectedServices || []).reduce(
            (sum: number, service: any) => sum + (service.price || 0) * (item.quantity || 0),
            0
          );
          const itemTotal = productTotal + servicesTotal;
          
          // Skip special transaction items
          const itemName = item.name || '';
          if (itemName === 'GCASH-IN' || itemName === 'GCASH-OUT' || itemName === 'Service Charge') {
            return;
          }
          
          if (itemTotal > 0 && item.quantity > 0) {
            // Get full display name with variation
            const displayName = getProductDisplayName(item);
            
            items.push({
              name: displayName,
              price: item.price || 0,
              quantity: item.quantity || 0,
              total: itemTotal,
            });
          }
        });
      } catch (error) {
        console.error("Error parsing sale items:", error);
      }
    });
    
    // Return only the first 10 items
    return items.slice(0, 10);
  }, [sales, getProductDisplayName]);

  // Get 10 most recent GCash transactions for status bar (from GCash funds history)
  const recentGCashTransactions = useMemo(() => {
    return gcashHistory
      .filter(tx => tx.type === "gcash-in" || tx.type === "gcash-out")
      .slice(0, 10)
      .map(tx => ({
        type: tx.type === "gcash-in" ? 'GCASH-IN' : 'GCASH-OUT' as 'GCASH-IN' | 'GCASH-OUT',
        amount: tx.amount,
        serviceCharge: tx.serviceCharge,
        total: tx.amount + (tx.serviceCharge || 0),
      }));
  }, [gcashHistory]);

  // Calculate GCASH-MONEY: Net cash produced by GCash services
  // Formula: (GCASH-IN amounts) + (Service fees from IN) + (Service fees from OUT) - (GCASH-OUT amounts)
  // This represents the actual cash generated from GCash transactions
  // Now calculated from GCash funds history instead of sales table
  const gcashMoney = useMemo(() => {
    let calculatedTotal = 0;
    let gcashInCount = 0;
    let gcashOutCount = 0;
    let gcashInWithServiceCharge = 0;
    let gcashOutWithServiceCharge = 0;
    let totalCashIns = 0;
    let totalCashOuts = 0;
    let totalFees = 0;
    
    // Calculate from GCash funds history instead of sales
    gcashHistory.forEach((transaction) => {
      if (transaction.type === "gcash-in") {
        gcashInCount++;
        const transactionAmount = transaction.amount;
        const serviceChargeAmount = transaction.serviceCharge || 0;
        
        // GCASH-IN: Add transaction amount + service charge (both are cash received)
        if (serviceChargeAmount > 0) {
          gcashInWithServiceCharge++;
          totalFees += serviceChargeAmount;
        }
        totalCashIns += transactionAmount + serviceChargeAmount;
        
        // Add transaction amount + service charge to total
        calculatedTotal += transactionAmount + serviceChargeAmount;
      } else if (transaction.type === "gcash-out") {
        gcashOutCount++;
        const transactionAmount = transaction.amount;
        const serviceChargeAmount = transaction.serviceCharge || 0;
        
        // GCASH-OUT: Add service fee (if exists), but deduct transaction amount (cash given out)
        if (serviceChargeAmount > 0) {
          gcashOutWithServiceCharge++;
          totalFees += serviceChargeAmount;
          // Add service fee (revenue)
          calculatedTotal += serviceChargeAmount;
        }
        totalCashOuts += transactionAmount;
        
        // Deduct transaction amount (cash given to customer)
        calculatedTotal -= transactionAmount;
      }
    });
    
    // Debug logging (remove in production if needed)
    if (gcashInCount > 0 || gcashOutCount > 0) {
      console.log("GCASH-MONEY Calculation:", {
        total: calculatedTotal,
        formula: `(GCASH-IN: ₱${totalCashIns.toFixed(2)} + Service Fees: ₱${totalFees.toFixed(2)}) - GCASH-OUT: ₱${totalCashOuts.toFixed(2)} = ₱${calculatedTotal.toFixed(2)}`,
        gcashInCount,
        gcashOutCount,
        gcashInWithServiceCharge,
        gcashOutWithServiceCharge,
        totalCashIns,
        totalCashOuts,
        totalFees,
      });
    }
    
    return calculatedTotal;
  }, [gcashHistory]);

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
  const addToCart = useCallback((product: Product, quantity: number, customPrice?: number, selectedServices?: ProductService[]) => {
    // Restore cart view if receipt is showing
    if (showReceiptInCart) {
      setShowReceiptInCart(false);
      setReceiptItems(null);
      setReceiptPayment(null);
    }
    
    setOrderItems((prev) => {
      // Create product with custom price if provided (for candies-promo)
      const productToAdd = customPrice !== undefined 
        ? { ...product, price: customPrice }
        : product;

      // Check if item with same product ID and services exists
      const existingIndex = prev.findIndex((item) => {
        if (item.product.id !== productToAdd.id) return false;
        // Compare services - if both have no services or same services, it's a match
        const itemServices = item.selectedServices || [];
        const newServices = selectedServices || [];
        if (itemServices.length !== newServices.length) return false;
        if (itemServices.length === 0 && newServices.length === 0) return true;
        // Check if services match (same IDs)
        const itemServiceIds = itemServices.map(s => s.id).sort().join(',');
        const newServiceIds = newServices.map(s => s.id).sort().join(',');
        return itemServiceIds === newServiceIds;
      });

      if (existingIndex >= 0) {
        const updated = [...prev];
        // If price changed, create new entry instead of merging
        if (customPrice !== undefined && updated[existingIndex].product.price !== customPrice) {
          // Track the last added product
          lastModifiedProductIdRef.current = productToAdd.id;
          // Add to recently added items for status bar
          setRecentlyAddedItems((prevItems) => [
            ...prevItems,
            { product: productToAdd, quantity, timestamp: Date.now() }
          ]);
          return [...prev, { product: productToAdd, quantity, selectedServices }];
        }
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        // Track the last modified product
        lastModifiedProductIdRef.current = productToAdd.id;
        // Add to recently added items for status bar
        setRecentlyAddedItems((prevItems) => [
          ...prevItems,
          { product: productToAdd, quantity, timestamp: Date.now() }
        ]);
        return updated;
      }

      // Track the last added product
      lastModifiedProductIdRef.current = productToAdd.id;
      // Add to recently added items for status bar
      setRecentlyAddedItems((prevItems) => [
        ...prevItems,
        { product: productToAdd, quantity, timestamp: Date.now() }
      ]);
      return [...prev, { product: productToAdd, quantity, selectedServices }];
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

    // Check if product has services
    const hasServices = product.services && product.services.length > 0;
    if (hasServices) {
      setServiceProduct(product);
      setShowServiceDialog(true);
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
    
    // Stock warnings removed - products can be added regardless of stock
    
    // Add directly to cart with quantity 1 (skip quantity dialog)
    addToCart(product, 1);
    // Clear search query but don't focus search input - allow arrow keys to work on cart
    setSearchQuery("");
    // Blur search input if it's focused
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    // Focus cart sidebar when item is added (so Enter works immediately for checkout)
    requestAnimationFrame(() => {
      const cartSidebar = document.querySelector('aside[tabIndex="-1"]') as HTMLElement;
      if (cartSidebar) {
        cartSidebar.focus();
      }
    });
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
        // Focus cart sidebar when item is added
        requestAnimationFrame(() => {
          const cartSidebar = document.querySelector('aside[tabIndex="-1"]') as HTMLElement;
          if (cartSidebar) {
            cartSidebar.focus();
          }
        });
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
  
  const handleToggleFees = useCallback((productId: string, enabled: boolean) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, feesEnabled: enabled } : item
      )
    );
  }, [setOrderItems]);
  
  const handleUpdateTotal = useCallback((productId: string, customTotal: number | undefined) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, customTotal } : item
      )
    );
  }, [setOrderItems]);

  const handleClearOrder = useCallback(() => {
    setOrderItems([]);
    setRecentlyAddedItems([]); // Clear status bar when order is cleared
    lastModifiedProductIdRef.current = null; // Clear last modified product
    toast({
      title: "Order cleared",
      description: "All items have been removed",
    });
  }, [setOrderItems, toast]);

  // Clear recently added items when cart opens
  useEffect(() => {
    if (cartOpen) {
      setRecentlyAddedItems([]);
    }
  }, [cartOpen]);

  // Auto-remove old items from status bar (after 5 seconds)
  useEffect(() => {
    if (recentlyAddedItems.length === 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentlyAddedItems((prev) => 
        prev.filter((item) => now - item.timestamp < 5000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [recentlyAddedItems.length]);

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

  // Global keyboard shortcuts handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if any dialog/modal is open
      if (document.querySelector('.fixed.inset-0.z-50')) {
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement;
      const searchInput = document.querySelector('input[type="text"][placeholder*="search"]') as HTMLInputElement;
      const isSearchFocused = searchInput && document.activeElement === searchInput;

      // ENTER KEY: Checkout when cart has items
      // ProductSearch handles Enter for product selection, but if nothing is selected
      // or search is empty, we handle checkout here
      if (e.key === 'Enter' && orderItems.length > 0) {
        // If search is focused with content, let ProductSearch handle it first
        if (isSearchFocused && searchQuery.trim()) {
          // ProductSearch will handle selection, but if no product is selected,
          // the event will bubble up and we can handle checkout
          return;
        }
        
        // Checkout if search is empty or not focused
        if (!isSearchFocused || !searchQuery.trim()) {
          e.preventDefault();
          handleCheckout();
          return;
        }
      }

      // ESCAPE KEY: Close cart or clear search
      if (e.key === 'Escape' && cartOpen && !showReceiptInCart) {
        if (isSearchFocused) {
          return; // Let ProductSearch handle it (clears search)
        }
        e.preventDefault();
        setCartOpen(false);
        setShowReceiptInCart(false);
        setReceiptItems(null);
        setReceiptPayment(null);
        return;
      }

      // ARROW KEYS: Adjust quantity when not in search
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && cartOpen && !showReceiptInCart) {
        if (isSearchFocused) {
          return; // Let ProductSearch handle it (navigates results)
        }
        
        const lastProductId = lastModifiedProductIdRef.current;
        if (lastProductId) {
          const lastItem = orderItems.find(item => item.product.id === lastProductId);
          if (lastItem) {
            e.preventDefault();
            const newQuantity = e.key === 'ArrowUp' 
              ? lastItem.quantity + 1 
              : Math.max(1, lastItem.quantity - 1);
            handleUpdateQuantity(lastProductId, newQuantity);
          }
        }
        return;
      }

      // ALPHANUMERIC KEYS: Focus search input
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && 
          !isInputFocused && !(activeEl instanceof HTMLButtonElement)) {
        if (searchInput) {
          searchInput.focus();
          // Don't prevent default - let the letter be typed
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cartOpen, showReceiptInCart, orderItems, searchQuery, handleCheckout, handleUpdateQuantity]);

  // Generate transaction fingerprint (hash of items + total)
  const generateTransactionFingerprint = useCallback((items: OrderItem[], total: number): string => {
    // Sort items by product ID for consistent hashing
    const sortedItems = [...items].sort((a, b) => a.product.id.localeCompare(b.product.id));
    
    // Create a string representation of the transaction
    const itemsString = sortedItems.map(item => {
      const servicesString = item.selectedServices 
        ? item.selectedServices.sort((a, b) => a.id.localeCompare(b.id)).map(s => `${s.id}:${s.price}`).join(',')
        : '';
      return `${item.product.id}:${item.quantity}:${item.product.price}${servicesString ? `:${servicesString}` : ''}`;
    }).join('|');
    
    // Include total amount (rounded to 2 decimals for comparison)
    const totalString = total.toFixed(2);
    
    // Simple hash function (not cryptographically secure, but sufficient for duplicate detection)
    const combined = `${itemsString}|${totalString}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }, []);

  // Check for duplicate transaction within 5 seconds
  const isDuplicateTransaction = useCallback((fingerprint: string): boolean => {
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    
    // Clean up old transactions (older than 5 seconds)
    recentTransactionsRef.current = recentTransactionsRef.current.filter(
      tx => tx.timestamp > fiveSecondsAgo
    );
    
    // Check if this fingerprint exists in recent transactions
    return recentTransactionsRef.current.some(tx => tx.fingerprint === fingerprint);
  }, []);

  // Add transaction to recent transactions
  const recordRecentTransaction = useCallback((fingerprint: string) => {
    recentTransactionsRef.current.push({
      fingerprint,
      timestamp: Date.now(),
    });
  }, []);

  const handlePaymentConfirm = useCallback(async (details: PaymentDetails) => {
    // Store items and payment details before clearing
    const itemsToReceipt = [...orderItems];
    const paymentToReceipt = details;
    
    // Calculate total amount (subtotal + fees + bottle deposit)
    // Use customTotal if set, otherwise use product price
    const subtotal = itemsToReceipt.reduce((sum, item) => {
      const itemPrice = item.customTotal !== undefined 
        ? item.customTotal 
        : item.product.price * item.quantity;
      const servicesTotal = (item.selectedServices || []).reduce(
        (serviceSum, service) => serviceSum + service.price * item.quantity,
        0
      );
      return sum + itemPrice + servicesTotal;
    }, 0);
    
    const fees = paymentToReceipt.totalFees || 0;
    const bottleDeposit = paymentToReceipt.bottleDeposit || 0;
    const total = subtotal + fees + bottleDeposit;
    
    // Generate transaction fingerprint
    const fingerprint = generateTransactionFingerprint(itemsToReceipt, total);
    
    // Check for duplicate transaction
    if (isDuplicateTransaction(fingerprint)) {
      toast({
        title: "Duplicate Transaction Prevented",
        description: "The same transaction was attempted within 5 seconds. Please wait before trying again.",
        variant: "destructive",
      });
      // Don't close payment dialog, allow user to review
      return;
    }
    
    // Record this transaction
    recordRecentTransaction(fingerprint);
    
    // Close payment dialog immediately for better UX
    setShowPayment(false);
    
    // Set receipt data first (before showing receipt)
    setReceiptItems(itemsToReceipt);
    setReceiptPayment(paymentToReceipt);
    
    // Clear cart items and status bar
    setOrderItems([]);
    setRecentlyAddedItems([]);
    
    // Open cart first, then show receipt (ensures smooth flip animation)
    setCartOpen(true);
    
    // Use requestAnimationFrame to ensure DOM is ready before flipping
    requestAnimationFrame(() => {
    setShowReceiptInCart(true);
    });
    
    // Record sale to database in the background (non-blocking)
    recordSale(itemsToReceipt, paymentToReceipt)
      .then(() => {
        // Trigger comprehensive update after transaction completion
        // Refresh all status bar data:
        // - Products (for stock updates)
        // - Sales (for today's total, recent sold items)
        // - Store funds (for store funds status indicator)
        Promise.all([
          refreshProducts(),
          loadSales(),
          refreshStoreFunds(),
        ]).catch((error) => {
          console.error("Error refreshing data after sale:", error);
        });
      })
      .catch((error) => {
        console.error("Failed to record sale:", error);
        toast({
          title: "Sale Recorded Locally",
          description: "Sale will be synced when connection is restored",
          variant: "default",
        });
        // Still try to refresh data in case it was recorded locally
        Promise.all([
          refreshProducts(),
          loadSales(),
          refreshStoreFunds(),
        ]).catch((err) => {
          console.error("Error refreshing data:", err);
        });
      });
  }, [orderItems, recordSale, setOrderItems, toast, generateTransactionFingerprint, isDuplicateTransaction, recordRecentTransaction, loadSales]);

  const handlePaymentCancel = useCallback(() => {
    setShowPayment(false);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setReceiptItems(null);
    setReceiptPayment(null);
    setShowReceiptInCart(false);
    setCartOpen(false); // Close cart to complete transaction
  }, []);

  const handleGcashTransaction = useCallback(async (details: GCashTransactionDetails) => {
    if (!gcashProduct) return;
    
    // Process the GCash fund transaction
    let fundResult;
    const serviceCharge = details.serviceCharge || 0;
    
    if (details.type === "gcash-in") {
      // GCASH-IN: Customer pays cash, we send GCash credit
      // - Amount: GCash credits customer receives (transaction value)
      // - Customer pays cash: amount (the transaction value)
      // - Service charge: separate revenue (added to cash, not part of what customer pays)
      // - Adds to GCash Cash: customer pays cash (amount) + service charge (revenue)
      // - Deducts from GCash Credits: we send GCash to customer (amount)
      // - If deductServiceFeeFromGCash: service charge also deducted from credits
      // Allow negative balances - transaction will proceed even if insufficient funds
      fundResult = processGCashIn(details.amount, serviceCharge, details.gcashNumber, details.notes);
      if (!fundResult.success) {
        toast({
          title: "Transaction Failed",
          description: fundResult.error || "Failed to process transaction",
          variant: "destructive",
        });
        return;
      }
      
      // If service fee should be deducted from GCash Credits (toggle ON), deduct it
      if (details.deductServiceFeeFromGCash && serviceCharge > 0) {
        // Deduct service charge from GCash Credits (but it's already added to Cash as revenue)
        // This is a separate adjustment to credits balance
        const adjustmentResult = await processGCashIn(serviceCharge, 0, undefined, "Service fee deduction from credits");
        if (adjustmentResult.success && 'creditsBalance' in adjustmentResult) {
          fundResult = { 
            ...adjustmentResult, 
            creditsBalance: adjustmentResult.creditsBalance,
            cashBalance: fundResult.cashBalance // Keep the cash balance from the original transaction
          };
        }
      }
      
      // Show warning if credits balance goes negative
      if (fundResult.creditsBalance && fundResult.creditsBalance < 0) {
        toast({
          title: "Transaction Processed",
          description: `GCash Credits is now negative: ₱${fundResult.creditsBalance.toFixed(2)}`,
          variant: "default",
        });
      }
    } else {
      // GCASH-OUT: We give customer cash, customer sends GCash credit
      // - Adds to GCash Credits: customer sends GCash to us (amount only, regardless of toggle)
      // - Deducts from GCash Cash: we give cash to customer (amount only)
      // - Service charge is always added to Cash (revenue)
      // Note: The toggle for deductServiceFeeFromGCash doesn't affect the cash/credits split
      //       It only affects whether service charge is deducted from credits balance
      fundResult = await processGCashOut(details.amount, serviceCharge, details.notes);
      if (!fundResult.success) {
        toast({
          title: "Transaction Failed",
          description: fundResult.error || "Failed to process transaction",
          variant: "destructive",
        });
        return;
      }
      
      // If service fee should be deducted from GCash Credits (toggle ON), deduct it
      if (details.deductServiceFeeFromGCash && serviceCharge > 0) {
        // Deduct service charge from GCash Credits (but it's already added to Cash as revenue)
        // This is a separate adjustment to credits balance
        const adjustmentResult = await processGCashIn(serviceCharge, 0, undefined, "Service fee deduction from credits");
        if (adjustmentResult.success && 'creditsBalance' in adjustmentResult) {
          fundResult = { 
            ...adjustmentResult, 
            creditsBalance: adjustmentResult.creditsBalance,
            cashBalance: fundResult.cashBalance // Keep the cash balance from the original transaction
          };
        }
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
    // For GCASH-OUT with toggle OFF: Service charge is paid separately in cash, but still recorded as an item
    // For GCASH-OUT with toggle ON: Service charge is included in GCash payment but deducted from balance
    // For GCASH-IN: Service charge is included in cash payment (or deducted from GCash if toggle ON)
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
    
    // Note: When toggle is OFF for GCASH-OUT, there's a payment mismatch:
    // - Items total: amount + serviceCharge
    // - Payment via GCash: amount only
    // - Service charge: paid separately in cash (not reflected in payment method)
    // This is acceptable as the service charge is still recorded as revenue
    
    // Determine payment method based on transaction type
    // For GCASH-OUT with toggle OFF: Customer sends amount via GCash, service fee paid separately in cash
    // For GCASH-OUT with toggle ON: Customer sends amount + service fee via GCash
    // For GCASH-IN: Customer pays cash (amount = transaction value, service charge is separate revenue)
    const paymentDetails: PaymentDetails = {
      method: details.type === "gcash-in" ? "cash" : "gcash",
      amountTendered: details.type === "gcash-in" ? details.amount : details.totalAmount, // GCASH-IN: customer pays amount (transaction value), service charge is separate revenue
      change: 0,
    };
    
    // Note: GCash transactions are NOT recorded as sales
    // They are tracked separately in the gcash_funds table via processGCashIn/processGCashOut
    // This prevents GCash conversions from being counted as sales revenue
    
    // Trigger comprehensive update after GCash transaction
    // Refresh all status bar data:
    // - Products (for any stock changes)
    // - Sales (for totals and recent items)
    // - Store funds (for store funds status indicator)
    // Note: GCash funds are in sessionStorage and update automatically
    await Promise.all([
      refreshProducts(),
      loadSales(),
      refreshStoreFunds(),
    ]).catch((error) => {
      console.error("Error refreshing data after GCash transaction:", error);
    });
    
    setShowGcashDialog(false);
    setGcashProduct(null);
    setSearchQuery("");
    
    const serviceChargeText = details.serviceCharge > 0 ? ` (Service: ₱${details.serviceCharge.toFixed(2)})` : "";
    toast({
      title: "GCash Transaction Recorded",
      description: `${transactionName}: ₱${details.amount.toFixed(2)}${serviceChargeText} | Total: ₱${details.totalAmount.toFixed(2)} | Credits: ₱${fundResult.creditsBalance.toFixed(2)} | Cash: ₱${fundResult.cashBalance.toFixed(2)}`,
    });
  }, [gcashProduct, processGCashIn, processGCashOut, toast, loadSales]);

  const handleAddFunds = useCallback(async (amount: number, fundType: "credits" | "cash", notes?: string) => {
    const result = await addFunds(amount, fundType, notes);
    if (result.success) {
      setShowAddFundsDialog(false);
      toast({
        title: "Funds Added",
        description: `₱${amount.toFixed(2)} added to GCash ${fundType === "credits" ? "Credits" : "Cash"} | New Credits: ₱${result.creditsBalance.toFixed(2)} | Cash: ₱${result.cashBalance.toFixed(2)}`,
      });
    }
  }, [addFunds, toast]);

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
    <div className="min-h-screen bg-background">
      {/* Sticky Status Bar Header - Fixed at top, doesn't affect layout */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 h-10">
        <div className="flex items-center justify-between gap-2 px-4 h-full text-sm">
          {/* Left: Status Indicators */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Date Display - Philippine Time with Online/Offline Indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded shrink-0 border ${
              isOnline 
                ? 'bg-success/20 border-success/30' 
                : 'bg-destructive/20 border-destructive/30'
            }`}>
              <Calendar className={`w-3 h-3 ${isOnline ? 'text-success' : 'text-destructive'}`} />
              <span className={`text-xs font-medium hidden sm:inline ${
                isOnline ? 'text-success' : 'text-destructive'
              }`}>
                {formattedDate}
              </span>
              <span className={`text-xs font-mono ${
                isOnline ? 'text-success' : 'text-destructive'
              }`}>
                {formattedTime}
              </span>
            </div>
            
            {/* Today's Total Sales */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              <Receipt className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Today:</span>
              <span className="text-sm font-bold font-mono text-primary">
                ₱{todayTotalSales.toFixed(2)}
              </span>
            </div>
            
            {/* GCash Funds - Permanently Displayed */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded shrink-0 bg-primary/10 border border-primary/20">
              <Smartphone className="w-3 h-3 text-primary" />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowAddFundsDialog(true)}
                  className={`text-xs font-mono font-semibold hover:opacity-80 transition-opacity ${gcashCredits < 0 ? 'text-destructive' : 'text-primary'}`}
                  title="Click to add GCash Credits"
                >
                  C: ₱{gcashCredits.toFixed(0)}
                </button>
                <span className="text-xs text-muted-foreground">/</span>
                <button
                  onClick={() => setShowGCashTransactionsDialog(true)}
                  className="text-xs font-mono font-semibold text-warning hover:opacity-80 transition-opacity"
                  title="Click to view GCash transactions"
                >
                  $: ₱{gcashCash.toFixed(0)}
                </button>
              </div>
            </div>
            
            {/* Pending Sales Count */}
            {pendingSalesCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-warning/20 text-warning shrink-0">
                <CloudOff className="w-3 h-3" />
                <span className="text-xs">{pendingSalesCount} pending</span>
              </div>
            )}
            
            {/* Syncing Indicator */}
            {isSyncing && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="text-xs hidden sm:inline">Syncing...</span>
              </div>
            )}
          </div>
          
          {/* Center: Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 absolute left-1/2 -translate-x-1/2">
            {/* GCASH-MONEY */}
            {gcashMoney > 0 && (
              <button
                onClick={() => setShowGCashTransactionsDialog(true)}
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-info/20 text-info border border-info/30 hover:bg-info/30 transition-colors"
                title={`GCASH-MONEY: ₱${gcashMoney.toFixed(2)}`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            )}
            
            {/* Bottle Deposit */}
            {totalUnrefundedBottleDeposits > 0 && (
              <button
                onClick={() => setShowBottleDepositRefundDialog(true)}
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-colors"
                title={`Bottle Deposit: ₱${totalUnrefundedBottleDeposits.toFixed(2)}`}
              >
                <CircleDot className="w-3.5 h-3.5" />
              </button>
            )}
            
            {/* Store Funds */}
            <button
              onClick={() => setShowStoreFundsHistoryDialog(true)}
              className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors"
              title={`Store Funds: ₱${storeFunds.toFixed(2)}`}
            >
              <Wallet className="w-3.5 h-3.5" />
            </button>
            
            {/* Pending sync */}
            {pendingSalesCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-colors relative ${
                  isSyncing 
                    ? 'bg-muted text-muted-foreground' 
                    : 'bg-warning/20 text-warning hover:bg-warning/30'
                }`}
                title={`${pendingSalesCount} pending sale(s) - Click to sync`}
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5" />
                )}
                {pendingSalesCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 bg-warning text-warning-foreground text-[9px] font-bold rounded-full">
                    {pendingSalesCount}
                  </span>
                )}
              </button>
            )}
            
            {/* Navigation buttons */}
            <Link to="/products" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="w-7 h-7" title="Products">
                <Package className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link to="/sales" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="w-7 h-7" title="Sales">
                <Receipt className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-7 h-7 hidden sm:flex"
              onClick={() => setShowSalesLogDialog(true)}
              title="View sales transaction log"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
            <Link to="/analytics" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="w-7 h-7" title="Analytics">
                <BarChart3 className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link to="/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon" className="w-7 h-7" title="Settings">
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </Link>
            
            {/* Cart button - mobile only */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-1.5 bg-primary/20 rounded-lg lg:hidden shrink-0"
            >
              <ShoppingCart className="w-4 h-4 text-primary" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center px-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Add top padding to account for fixed status bar, bottom padding for status bars */}
      <div className={`pt-[2.5rem] ${(recentSoldItems.length > 0 || recentGCashTransactions.length > 0) ? (recentSoldItems.length > 0 && recentGCashTransactions.length > 0 ? 'pb-[3rem]' : 'pb-[1.5rem]') : ''} p-3 sm:p-4 lg:p-6`}>
        <div className={`w-full mx-auto flex gap-4 lg:gap-6 ${
          (recentSoldItems.length > 0 || recentGCashTransactions.length > 0)
            ? (recentSoldItems.length > 0 && recentGCashTransactions.length > 0 
                ? 'h-[calc(100vh-2.5rem-3rem)]' 
                : 'h-[calc(100vh-2.5rem-1.5rem)]')
            : 'h-[calc(100vh-2.5rem-1.5rem)] sm:h-[calc(100vh-2.5rem-2rem)] lg:h-[calc(100vh-2.5rem-3rem)]'
        }`}>
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Status Bar - Show recently added items when cart is not visible */}
          {!cartOpen && recentlyAddedItems.length > 0 && (
            <div className="mb-4 px-4">
              <div className="glass-panel rounded-lg p-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {recentlyAddedItems.map((item, index) => (
                    <div
                      key={`${item.product.id}-${item.timestamp}-${index}`}
                      className="flex items-center gap-1.5 shrink-0 bg-primary/10 px-2 py-1 rounded-md text-sm"
                    >
                      <span className="font-medium text-foreground whitespace-nowrap">
                        {item.product.name}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground bg-primary/20 px-1.5 py-0.5 rounded font-mono">
                          x{item.quantity}
                        </span>
                      )}
                      {index < recentlyAddedItems.length - 1 && (
                        <span className="text-muted-foreground mx-1">•</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search Area */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-8 lg:pt-12">
            <div className="w-full max-w-2xl mb-6">
              <ProductSearch
                products={products}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onProductSelect={handleProductSelect}
                onAddNewProduct={handleAddNewProduct}
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
                            <div className="text-xs font-mono font-semibold space-y-0.5">
                              <div className={`${gcashCredits < 0 ? 'text-destructive' : 'text-primary'}`}>
                                Credits: ₱{gcashCredits.toFixed(2)}
                                {gcashCredits < 0 && <span className="ml-1">(Neg)</span>}
                              </div>
                              <div className="text-warning">
                                Cash: ₱{gcashCash.toFixed(2)}
                              </div>
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
          onToggleFees={handleToggleFees}
          onUpdateTotal={handleUpdateTotal}
          onClearOrder={handleClearOrder}
          onCheckout={handleCheckout}
          isOpen={cartOpen}
          onClose={() => {
            setCartOpen(false);
            setShowReceiptInCart(false);
            setReceiptItems(null);
            setReceiptPayment(null);
          }}
          showReceipt={showReceiptInCart}
          receiptItems={receiptItems}
          receiptPayment={receiptPayment}
          onCloseReceipt={() => {
            setShowReceiptInCart(false);
            setReceiptItems(null);
            setReceiptPayment(null);
            setCartOpen(false); // Close cart to complete transaction
          }}
        />
        </div>
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
          fees={applicableFees}
          totalFees={totalFees}
          orderItems={orderItems}
          bottleDeposit={calculateBottleDeposit.total}
          bottleDepositBreakdown={calculateBottleDeposit.breakdown}
          total={totalWithBottleDeposit}
          onConfirm={handlePaymentConfirm}
          onCancel={handlePaymentCancel}
        />
      )}

      {/* Receipt Dialog - Only show if not showing in cart */}
      {receiptItems && receiptPayment && !showReceiptInCart && (
        <ReceiptDialog
          items={receiptItems}
          paymentDetails={receiptPayment}
          onClose={handleCloseReceipt}
        />
      )}

      {/* GCash Transaction Dialog */}
      {showGcashDialog && gcashProduct && (
        <GCashTransactionDialog
          currentBalance={gcashCredits}
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
          currentCreditsBalance={gcashCredits}
          currentCashBalance={gcashCash}
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

      {/* Transaction History Dialog */}
      {showSalesLogDialog && (
        <SalesLogDialog
          onClose={() => setShowSalesLogDialog(false)}
        />
      )}

      {showTransactionHistoryDialog && (
        <TransactionHistoryDialog
          onClose={() => setShowTransactionHistoryDialog(false)}
        />
      )}

      {/* Service Selection Dialog */}
      {showServiceDialog && serviceProduct && (
        <ServiceSelectionDialog
          product={serviceProduct}
          onConfirm={(selectedServices) => {
            addToCart(serviceProduct, 1, undefined, selectedServices);
            setShowServiceDialog(false);
            setServiceProduct(null);
            setSearchQuery("");
            if (searchInputRef.current) {
              searchInputRef.current.blur();
            }
            // Focus cart sidebar when item is added
            requestAnimationFrame(() => {
              const cartSidebar = document.querySelector('aside[tabIndex="-1"]') as HTMLElement;
              if (cartSidebar) {
                cartSidebar.focus();
              }
            });
          }}
          onCancel={() => {
            setShowServiceDialog(false);
            setServiceProduct(null);
          }}
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
            // Focus cart sidebar when item is added
            requestAnimationFrame(() => {
              const cartSidebar = document.querySelector('aside[tabIndex="-1"]') as HTMLElement;
              if (cartSidebar) {
                cartSidebar.focus();
              }
            });
          }}
          onCancel={() => {
            setShowCandiesPromoDialog(false);
            setCandiesPromoProduct(null);
          }}
        />
      )}

      {/* Bottom Status Bars - Two Row Stacking */}
      {/* GCash Transactions Status Bar - Top Row */}
      {recentGCashTransactions.length > 0 && (
        <div className={`fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-sm px-4 py-0 flex items-center leading-none ${recentSoldItems.length > 0 ? 'border-t border-border/50' : 'bottom-0 border-t border-border/50'}`} style={recentSoldItems.length > 0 ? { bottom: '1.5rem' } : { bottom: 0 }}>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full">
            <span className="text-xs text-info font-medium shrink-0 leading-none">GCash:</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {recentGCashTransactions.map((tx, index) => (
                <span key={index} className="text-xs text-muted-foreground whitespace-nowrap leading-none">
                  {tx.type === 'GCASH-IN' ? 'IN' : 'OUT'} ₱{tx.amount.toFixed(0)}
                  {tx.serviceCharge && ` +SC ₱${tx.serviceCharge.toFixed(0)}`} = ₱{tx.total.toFixed(0)}
                  {index < recentGCashTransactions.length - 1 && <span className="mx-1">,</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Recent Sold Items Status Bar - Bottom Row */}
      {recentSoldItems.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm px-4 py-0 flex items-center leading-none ${recentGCashTransactions.length > 0 ? '' : 'border-t border-border/50'}`}>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full">
            <span className="text-xs text-muted-foreground font-medium shrink-0 leading-none">Recent:</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {recentSoldItems.map((item, index) => (
                <span key={index} className="text-xs text-muted-foreground whitespace-nowrap leading-none">
                  {item.name} {item.price.toFixed(0)} x{item.quantity} = {item.total.toFixed(0)}
                  {index < recentSoldItems.length - 1 && <span className="mx-1">,</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;