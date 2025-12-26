import { useState, useEffect, useCallback } from "react";
import { Product, OrderItem } from "@/types/product";
import { PaymentDetails } from "@/components/PaymentDialog";
import {
  productsApi,
  salesApi,
  quantityHistoryApi,
  checkApiConnection,
} from "@/services/mysqlApi";
import { initialProducts } from "@/data/products";

type QuantityHistory = Record<string, number[]>;

export function useMySQLSync() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [quantityHistory, setQuantityHistory] = useState<QuantityHistory>({});
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check API connection and load initial data
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const connected = await checkApiConnection();
      setIsOnline(connected);

      if (connected) {
        // Load products from DB
        const productsResult = await productsApi.getAll();
        if (productsResult.success && productsResult.data && productsResult.data.length > 0) {
          setProducts(
            productsResult.data.map((p) => ({
              id: String(p.id),
              name: p.name,
              price: Number(p.price),
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
        const result = await productsApi.create(product);
        if (result.success && result.id) {
          const newProduct = { ...product, id: String(result.id) };
          setProducts((prev) => [...prev, newProduct]);
          return newProduct;
        }
      }
      // Fallback to local
      const newProduct = { ...product, id: Date.now().toString() };
      setProducts((prev) => [...prev, newProduct]);
      return newProduct;
    },
    [isOnline]
  );

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
      };

      if (isOnline) {
        await salesApi.create(saleData);
      }

      // Update quantity history
      const newHistory = { ...quantityHistory };
      for (const item of orderItems) {
        const existing = newHistory[item.product.id] || [];
        newHistory[item.product.id] = [...existing, item.quantity].slice(-10);

        if (isOnline) {
          await quantityHistoryApi.upsert(
            item.product.id,
            newHistory[item.product.id]
          );
        }
      }
      setQuantityHistory(newHistory);
    },
    [isOnline, quantityHistory]
  );

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
    recordSale,
    shouldShowQtyDialog,
    isOnline,
    isLoading,
  };
}
