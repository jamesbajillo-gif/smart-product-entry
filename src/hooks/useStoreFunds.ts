import { useState, useEffect, useCallback } from "react";
import { storeFundsApi, StoreFundTransaction } from "@/services/mysqlApi";

export interface StoreFundTransactionLocal {
  id: string;
  type: "add" | "withdraw" | "expense" | "income";
  amount: number;
  balance: number;
  timestamp: number;
  notes?: string;
  category?: string;
}

export function useStoreFunds() {
  const [funds, setFunds] = useState<number>(0);
  const [history, setHistory] = useState<StoreFundTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial funds and history from database
  useEffect(() => {
    const loadFunds = async () => {
      try {
        setIsLoading(true);
        const result = await storeFundsApi.getBalance();
        if (result.success && result.balance !== undefined) {
          setFunds(result.balance);
        }

        const historyResult = await storeFundsApi.getHistory(50);
        if (historyResult.success && historyResult.data) {
          setHistory(historyResult.data);
        }
      } catch (error) {
        console.error("Error loading store funds:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFunds();
  }, []);

  // Add funds to store
  const addFunds = useCallback(async (amount: number, notes?: string, category?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    try {
      const result = await storeFundsApi.addFunds(amount, notes, category);
      if (result.success && result.transaction) {
        const newBalance = funds + amount;
        setFunds(newBalance);
        setHistory((prev) => [result.transaction!, ...prev].slice(0, 100));
        return { success: true, balance: newBalance };
      }
      return { success: false, error: result.error || "Failed to add funds" };
    } catch (error) {
      console.error("Error adding store funds:", error);
      return { success: false, error: "Failed to add funds" };
    }
  }, [funds]);

  // Withdraw funds from store
  const withdrawFunds = useCallback(async (amount: number, notes?: string, category?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    if (funds < amount) return { success: false, error: "Insufficient store funds" };
    
    try {
      const result = await storeFundsApi.withdrawFunds(amount, notes, category);
      if (result.success && result.transaction) {
        const newBalance = funds - amount;
        setFunds(newBalance);
        setHistory((prev) => [result.transaction!, ...prev].slice(0, 100));
        return { success: true, balance: newBalance };
      }
      return { success: false, error: result.error || "Failed to withdraw funds" };
    } catch (error) {
      console.error("Error withdrawing store funds:", error);
      return { success: false, error: "Failed to withdraw funds" };
    }
  }, [funds]);

  // Refresh funds and history
  const refresh = useCallback(async () => {
    try {
      const balanceResult = await storeFundsApi.getBalance();
      if (balanceResult.success && balanceResult.balance !== undefined) {
        setFunds(balanceResult.balance);
      }

      const historyResult = await storeFundsApi.getHistory(50);
      if (historyResult.success && historyResult.data) {
        setHistory(historyResult.data);
      }
    } catch (error) {
      console.error("Error refreshing store funds:", error);
    }
  }, []);

  return {
    funds,
    history,
    isLoading,
    addFunds,
    withdrawFunds,
    refresh,
  };
}

