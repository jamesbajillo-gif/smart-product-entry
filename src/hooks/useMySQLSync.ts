import { useState, useEffect, useCallback, useRef } from "react";
import { Product, OrderItem } from "@/types/product";
import { PaymentDetails } from "@/components/PaymentDialog";
import {
  productsApi,
  salesApi,
  quantityHistoryApi,
  stockApi,
  checkApiConnection,
  SaleRecord,
} from "@/services/mysqlApi";
import { initialProducts } from "@/data/products";
import { toast } from "@/hooks/use-toast";

type QuantityHistory = Record<string, number[]>;

interface PendingSale {
  id: string;
  data: Omit<SaleRecord, "id" | "created_at"> & { created_at: string };
  quantityUpdates: { productId: string; quantities: number[] }[];
  createdAt: number;
}

interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

const PENDING_SALES_KEY = "pos-pending-sales";

// Load pending sales from localStorage
const loadPendingSales = (): PendingSale[] => {
  try {
    const stored = localStorage.getItem(PENDING_SALES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save pending sales to localStorage
const savePendingSales = (sales: PendingSale[]) => {
  localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(sales));
};

export function useMySQLSync() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [quantityHistory, setQuantityHistory] = useState<QuantityHistory>({});
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>(loadPendingSales);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync pending sales to server
  const syncPendingSales = useCallback(async (showToast = false): Promise<SyncResult> => {
    const pending = loadPendingSales();
    if (pending.length === 0 || isSyncing) {
      return { synced: 0, failed: 0, remaining: pending.length };
    }

    const connected = await checkApiConnection();
    if (!connected) {
      return { synced: 0, failed: 0, remaining: pending.length };
    }

    setIsSyncing(true);
    const successfulIds: string[] = [];
    let failedCount = 0;

    for (const sale of pending) {
      try {
        // Upload sale
        const result = await salesApi.create(sale.data);
        if (result.success) {
          // Upload quantity history updates
          for (const update of sale.quantityUpdates) {
            await quantityHistoryApi.upsert(update.productId, update.quantities);
          }
          successfulIds.push(sale.id);
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error("Failed to sync sale:", error);
        failedCount++;
      }
    }

    // Remove successfully synced sales
    const remaining = pending.filter((s) => !successfulIds.includes(s.id));
    if (successfulIds.length > 0) {
      savePendingSales(remaining);
      setPendingSales(remaining);
      console.log(`Synced ${successfulIds.length} pending sale(s)`);

      // Show toast notification
      toast({
        title: "Sales Synced",
        description: `${successfulIds.length} sale${successfulIds.length > 1 ? "s" : ""} uploaded successfully${remaining.length > 0 ? `. ${remaining.length} pending.` : ""}`,
      });
    }

    setIsSyncing(false);
    return { synced: successfulIds.length, failed: failedCount, remaining: remaining.length };
  }, [isSyncing]);

  // Check API connection and load initial data
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const connected = await checkApiConnection();
      setIsOnline(connected);

      if (connected) {
        // Try to sync pending sales first
        await syncPendingSales();

        // Load products from DB
        const productsResult = await productsApi.getAll();
        if (productsResult.success && productsResult.data && productsResult.data.length > 0) {
          setProducts(
            productsResult.data.map((p) => ({
              id: String(p.id),
              name: p.name,
              price: Number(p.price),
              category: p.category as Product["category"],
              image_url: p.image_url || undefined,
              stock_quantity: p.stock_quantity ?? 0,
              low_stock_threshold: p.low_stock_threshold ?? 5,
            }))
          );
        }

        // Load quantity history from DB
        const historyResult = await quantityHistoryApi.getAll();
        if (historyResult.success && historyResult.data) {
          const history: QuantityHistory = {};
          historyResult.data.forEach((record) => {
            try {
              history[record.product_id] = JSON.parse(record.quantities);
            } catch {
              history[record.product_id] = [];
            }
          });
          setQuantityHistory(history);
        }
      } else {
        // Fallback to session storage
        const storedProducts = sessionStorage.getItem("pos-products");
        if (storedProducts) {
          setProducts(JSON.parse(storedProducts));
        }
        const storedHistory = sessionStorage.getItem("pos-qty-history");
        if (storedHistory) {
          setQuantityHistory(JSON.parse(storedHistory));
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  // Periodic connection check and sync (every 30 seconds)
  useEffect(() => {
    const checkAndSync = async () => {
      const connected = await checkApiConnection();
      const wasOffline = !isOnline;
      setIsOnline(connected);

      if (connected && wasOffline) {
        console.log("Connection restored, syncing pending sales...");
        await syncPendingSales();
      } else if (connected && pendingSales.length > 0) {
        await syncPendingSales();
      }
    };

    syncIntervalRef.current = setInterval(checkAndSync, 30000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, pendingSales.length, syncPendingSales]);

  // Save to session storage as fallback
  useEffect(() => {
    if (!isLoading) {
      sessionStorage.setItem("pos-products", JSON.stringify(products));
      sessionStorage.setItem("pos-qty-history", JSON.stringify(quantityHistory));
    }
  }, [products, quantityHistory, isLoading]);

  // Add product
  const addProduct = useCallback(
    async (product: Omit<Product, "id">) => {
      if (isOnline) {
        const result = await productsApi.create({
          name: product.name,
          price: product.price,
          category: product.category,
          image_url: product.image_url,
          stock_quantity: product.stock_quantity ?? 0,
          low_stock_threshold: product.low_stock_threshold ?? 5,
        });
        if (result.success && result.id) {
          const newProduct = { ...product, id: String(result.id) };
          setProducts((prev) => [...prev, newProduct]);
          return { success: true, product: newProduct };
        }
        return { success: false, error: result.error };
      }
      // Fallback to local
      const newProduct = { ...product, id: Date.now().toString() };
      setProducts((prev) => [...prev, newProduct]);
      return { success: true, product: newProduct };
    },
    [isOnline]
  );

  // Update product
  const updateProduct = useCallback(
    async (id: string, data: Partial<Product>) => {
      if (isOnline) {
        const result = await productsApi.update(id, data);
        if (result.success) {
          setProducts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...data } : p))
          );
          return { success: true };
        }
        return { success: false, error: result.error };
      }
      // Local-only update when offline
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      return { success: true };
    },
    [isOnline]
  );

  // Delete product
  const deleteProduct = useCallback(
    async (id: string) => {
      if (isOnline) {
        const result = await productsApi.delete(id);
        if (result.success) {
          setProducts((prev) => prev.filter((p) => p.id !== id));
          return { success: true };
        }
        return { success: false, error: result.error };
      }
      return { success: false, error: "Cannot delete while offline" };
    },
    [isOnline]
  );

  // Refresh products from database
  const refreshProducts = useCallback(async () => {
    const connected = await checkApiConnection();
    setIsOnline(connected);

    if (connected) {
      const productsResult = await productsApi.getAll();
      if (productsResult.success && productsResult.data) {
        const dbProducts = productsResult.data.map((p) => ({
          id: String(p.id),
          name: p.name,
          price: Number(p.price),
          category: p.category as Product["category"],
          image_url: p.image_url || undefined,
          stock_quantity: p.stock_quantity ?? 0,
          low_stock_threshold: p.low_stock_threshold ?? 5,
        }));
        setProducts(dbProducts);
        return { success: true, count: dbProducts.length };
      }
    }
    return { success: false, count: products.length };
  }, [products.length]);

  // Record sale
  const recordSale = useCallback(
    async (orderItems: OrderItem[], paymentDetails: PaymentDetails) => {
      const total = orderItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      const saleData = {
        items: JSON.stringify(
          orderItems.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
          }))
        ),
        total,
        payment_method: paymentDetails.method,
        amount_tendered: paymentDetails.amountTendered,
        change_amount: paymentDetails.change,
        created_at: new Date().toISOString(),
      };

      // Update quantity history locally
      const newHistory = { ...quantityHistory };
      const quantityUpdates: { productId: string; quantities: number[] }[] = [];

      for (const item of orderItems) {
        const existing = newHistory[item.product.id] || [];
        newHistory[item.product.id] = [...existing, item.quantity].slice(-10);
        quantityUpdates.push({
          productId: item.product.id,
          quantities: newHistory[item.product.id],
        });
      }
      setQuantityHistory(newHistory);

      if (isOnline) {
        try {
          const result = await salesApi.create(saleData);
          if (result.success) {
            // Update quantity history in DB
            for (const update of quantityUpdates) {
              await quantityHistoryApi.upsert(update.productId, update.quantities);
            }
            
            // Auto-deduct stock for each product sold
            for (const item of orderItems) {
              const product = products.find(p => p.id === item.product.id);
              if (product && product.stock_quantity !== undefined) {
                await stockApi.recordSale(item.product.id, item.quantity, product.stock_quantity);
              }
            }
            
            // Update local product stock
            setProducts(prev => prev.map(p => {
              const soldItem = orderItems.find(item => item.product.id === p.id);
              if (soldItem && p.stock_quantity !== undefined) {
                return { ...p, stock_quantity: Math.max(0, p.stock_quantity - soldItem.quantity) };
              }
              return p;
            }));
            
            return;
          }
        } catch (error) {
          console.error("Failed to record sale online:", error);
        }
      }

      // Store in pending queue for later sync
      const pendingSale: PendingSale = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: saleData,
        quantityUpdates,
        createdAt: Date.now(),
      };

      const updatedPending = [...pendingSales, pendingSale];
      savePendingSales(updatedPending);
      setPendingSales(updatedPending);
      console.log("Sale queued for sync:", pendingSale.id);
    },
    [isOnline, quantityHistory, pendingSales]
  );

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (pendingSales.length === 0) return false;
    await syncPendingSales();
    return true;
  }, [pendingSales.length, syncPendingSales]);

  // Check if product should show qty dialog
  const shouldShowQtyDialog = useCallback(
    (productId: string): boolean => {
      const history = quantityHistory[productId] || [];
      const multiQtySales = history.filter((qty) => qty > 1).length;
      return multiQtySales >= 2;
    },
    [quantityHistory]
  );

  return {
    products,
    setProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    refreshProducts,
    recordSale,
    shouldShowQtyDialog,
    isOnline,
    isLoading,
    pendingSalesCount: pendingSales.length,
    isSyncing,
    triggerSync,
  };
}
