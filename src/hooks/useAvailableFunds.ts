import { useState, useEffect, useMemo } from "react";
import { salesApi, expensesApi, SaleRecord, ExpenseRecord } from "@/services/mysqlApi";
import { useGCashFunds } from "./useGCashFunds";
import { useStoreFunds } from "./useStoreFunds";
import { startOfDay, endOfDay } from "date-fns";

export type PaymentSource = "cash" | "store_funds" | "gcash" | "current_sales";

export interface AvailableFunds {
  cash: number; // Accumulated sales (excluding today)
  storeFunds: number;
  gcash: number;
  currentSales: number; // Today's sales
}

const formatMySQLDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export function useAvailableFunds() {
  const { funds: gcashFunds } = useGCashFunds();
  const { funds: storeFunds } = useStoreFunds();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load sales and expenses
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load all sales
        const salesResult = await salesApi.getAll({ limit: 10000 });
        if (salesResult.success && salesResult.data) {
          setSales(salesResult.data);
        }

        // Load all expenses
        const expensesResult = await expensesApi.getAll({ limit: 10000 });
        if (expensesResult.success && expensesResult.data) {
          setExpenses(expensesResult.data);
        }
      } catch (error) {
        console.error("Error loading funds data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate available funds
  const availableFunds = useMemo<AvailableFunds>(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const todayStartStr = formatMySQLDate(todayStart);
    const todayEndStr = formatMySQLDate(todayEnd);

    // Separate today's sales from accumulated sales
    const todaySales = sales.filter((sale) => {
      if (!sale.created_at) return false;
      const saleDate = new Date(sale.created_at);
      return saleDate >= todayStart && saleDate <= todayEnd;
    });

    const accumulatedSales = sales.filter((sale) => {
      if (!sale.created_at) return false;
      const saleDate = new Date(sale.created_at);
      return saleDate < todayStart;
    });

    // Calculate total sales (cash payments only, excluding GCash transactions)
    const calculateCashSales = (salesList: SaleRecord[]) => {
      return salesList.reduce((total, sale) => {
        // Skip GCash transactions (they don't contribute to cash)
        try {
          const items = JSON.parse(sale.items);
          const isGCashTransaction = items.some((item: any) => 
            item.name === "GCASH-IN" || item.name === "GCASH-OUT"
          );
          if (isGCashTransaction) return total;
        } catch {
          // If parsing fails, include it
        }

        // Only count cash payments
        if (sale.payment_method === "cash") {
          return total + Number(sale.total || 0);
        }
        return total;
      }, 0);
    };

    // Calculate total expenses (excluding today)
    const accumulatedExpenses = expenses
      .filter((exp) => {
        if (!exp.created_at) return false;
        const expDate = new Date(exp.created_at);
        return expDate < todayStart;
      })
      .reduce((total, exp) => total + Number(exp.total_cost || 0), 0);

    // Calculate today's expenses
    const todayExpenses = expenses
      .filter((exp) => {
        if (!exp.created_at) return false;
        const expDate = new Date(exp.created_at);
        return expDate >= todayStart && expDate <= todayEnd;
      })
      .reduce((total, exp) => total + Number(exp.total_cost || 0), 0);

    // Cash = Accumulated sales (excluding today) - Accumulated expenses
    const cash = Math.max(0, calculateCashSales(accumulatedSales) - accumulatedExpenses);

    // Current Sales = Today's sales (cash payments only) - Today's expenses
    const currentSales = Math.max(0, calculateCashSales(todaySales) - todayExpenses);

    return {
      cash,
      storeFunds,
      gcash: gcashFunds,
      currentSales,
    };
  }, [sales, expenses, storeFunds, gcashFunds]);

  return {
    availableFunds,
    isLoading,
    refresh: async () => {
      // Reload data
      const salesResult = await salesApi.getAll({ limit: 10000 });
      if (salesResult.success && salesResult.data) {
        setSales(salesResult.data);
      }
      const expensesResult = await expensesApi.getAll({ limit: 10000 });
      if (expensesResult.success && expensesResult.data) {
        setExpenses(expensesResult.data);
      }
    },
  };
}

