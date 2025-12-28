import { useState, useEffect, useCallback } from "react";
import { useSessionStorage } from "./useSessionStorage";

const GCASH_FUNDS_KEY = "gcash-funds";
const GCASH_HISTORY_KEY = "gcash-history";

export interface GCashFundTransaction {
  id: string;
  type: "add" | "gcash-in" | "gcash-out";
  amount: number;
  balance: number;
  timestamp: number;
  notes?: string;
  gcashNumber?: string;
}

export function useGCashFunds() {
  const [funds, setFunds] = useSessionStorage<number>(GCASH_FUNDS_KEY, 0);
  const [history, setHistory] = useSessionStorage<GCashFundTransaction[]>(GCASH_HISTORY_KEY, []);

  // Add funds to GCASH wallet
  const addFunds = useCallback((amount: number, notes?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    const newBalance = funds + amount;
    const transaction: GCashFundTransaction = {
      id: `add-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "add",
      amount,
      balance: newBalance,
      timestamp: Date.now(),
      notes,
    };
    
    setFunds(newBalance);
    setHistory((prev) => [transaction, ...prev].slice(0, 100)); // Keep last 100 transactions
    
    return { success: true, balance: newBalance };
  }, [funds, setFunds, setHistory]);

  // Process GCASH-IN: Customer pays cash, we send GCash credit (deducts from GCASH-FUNDS)
  // Allow negative balances - transaction will proceed even if insufficient funds
  const processGCashIn = useCallback((amount: number, gcashNumber?: string, notes?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    // Allow negative balance - no check for insufficient funds
    const newBalance = funds - amount;
    const transaction: GCashFundTransaction = {
      id: `gcash-in-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "gcash-in",
      amount,
      balance: newBalance,
      timestamp: Date.now(),
      notes,
      gcashNumber,
    };
    
    setFunds(newBalance);
    setHistory((prev) => [transaction, ...prev].slice(0, 100));
    
    return { success: true, balance: newBalance };
  }, [funds, setFunds, setHistory]);

  // Process GCASH-OUT: We give customer cash, customer sends GCash credit (adds to GCASH-FUNDS)
  const processGCashOut = useCallback((amount: number, notes?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    const newBalance = funds + amount;
    const transaction: GCashFundTransaction = {
      id: `gcash-out-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "gcash-out",
      amount,
      balance: newBalance,
      timestamp: Date.now(),
      notes,
    };
    
    setFunds(newBalance);
    setHistory((prev) => [transaction, ...prev].slice(0, 100));
    
    return { success: true, balance: newBalance };
  }, [funds, setFunds, setHistory]);

  return {
    funds,
    history,
    setFunds,
    setHistory,
    addFunds,
    processGCashIn,
    processGCashOut,
  };
}

