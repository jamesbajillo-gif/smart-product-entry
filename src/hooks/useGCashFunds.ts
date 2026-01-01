import { useState, useEffect, useCallback } from "react";
import { gcashFundsApi, GCashFundTransaction as GCashFundTransactionDB, checkApiConnection } from "@/services/mysqlApi";

// Local transaction interface (for backward compatibility)
export interface GCashFundTransaction {
  id: string;
  type: "add" | "gcash-in" | "gcash-out";
  amount: number;
  creditsBalance: number; // GCash Credits balance after transaction
  cashBalance: number; // GCash Cash balance after transaction
  timestamp: number;
  notes?: string;
  gcashNumber?: string;
  serviceCharge?: number; // Service charge amount (if applicable)
}

// Offline queue key
const PENDING_GCASH_TRANSACTIONS_KEY = "pos-pending-gcash-transactions";

// Load pending transactions from localStorage
const loadPendingTransactions = (): Array<{
  id: string;
  transactionType: "add-credits" | "add-cash" | "gcash-in" | "gcash-out";
  amount: number;
  creditsBalanceAfter: number;
  cashBalanceAfter: number;
  serviceCharge: number;
  notes?: string;
  gcashNumber?: string;
}> => {
  try {
    const stored = localStorage.getItem(PENDING_GCASH_TRANSACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save pending transactions to localStorage
const savePendingTransactions = (transactions: ReturnType<typeof loadPendingTransactions>) => {
  localStorage.setItem(PENDING_GCASH_TRANSACTIONS_KEY, JSON.stringify(transactions));
};

// Convert DB transaction to local format
const convertDBToLocal = (dbTx: GCashFundTransactionDB): GCashFundTransaction => {
  let type: "add" | "gcash-in" | "gcash-out";
  if (dbTx.transaction_type === "gcash-in") type = "gcash-in";
  else if (dbTx.transaction_type === "gcash-out") type = "gcash-out";
  else type = "add";

  return {
    id: dbTx.id?.toString() || `tx-${Date.now()}`,
    type,
    amount: Number(dbTx.amount),
    creditsBalance: Number(dbTx.credits_balance_after),
    cashBalance: Number(dbTx.cash_balance_after),
    timestamp: dbTx.created_at ? new Date(dbTx.created_at).getTime() : Date.now(),
    notes: dbTx.notes,
    gcashNumber: dbTx.gcash_number,
    serviceCharge: dbTx.service_charge ? Number(dbTx.service_charge) : undefined,
  };
};

export function useGCashFunds() {
  const [credits, setCredits] = useState<number>(0);
  const [cash, setCash] = useState<number>(0);
  const [history, setHistory] = useState<GCashFundTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  // Load initial balance and history from MySQL
  useEffect(() => {
    const loadFunds = async () => {
      try {
        setIsLoading(true);
        
        // Check connection
        const connected = await checkApiConnection();
        setIsOnline(connected);

        if (connected) {
          // Load balance from MySQL
          const balanceResult = await gcashFundsApi.getBalance();
          if (balanceResult.success) {
            setCredits(balanceResult.creditsBalance || 0);
            setCash(balanceResult.cashBalance || 0);
          }

          // Load history from MySQL
          const historyResult = await gcashFundsApi.getHistory(100);
          if (historyResult.success && historyResult.data) {
            const localHistory = historyResult.data.map(convertDBToLocal);
            setHistory(localHistory);
          }
        } else {
          // Offline: Try to load from sessionStorage as fallback
          const cachedCredits = sessionStorage.getItem("gcash-credits");
          const cachedCash = sessionStorage.getItem("gcash-cash");
          const cachedHistory = sessionStorage.getItem("gcash-history");
          
          if (cachedCredits) setCredits(parseFloat(cachedCredits) || 0);
          if (cachedCash) setCash(parseFloat(cachedCash) || 0);
          if (cachedHistory) {
            try {
              setHistory(JSON.parse(cachedHistory));
            } catch {
              setHistory([]);
            }
          }
        }

        // Migrate old sessionStorage data to MySQL (one-time migration)
        const oldCredits = sessionStorage.getItem("gcash-credits");
        const oldCash = sessionStorage.getItem("gcash-cash");
        const oldHistory = sessionStorage.getItem("gcash-history");
        
        if (connected && (oldCredits || oldCash || oldHistory)) {
          const oldCreditsValue = oldCredits ? parseFloat(oldCredits) : 0;
          const oldCashValue = oldCash ? parseFloat(oldCash) : 0;
          
          // Only migrate if there's actual data and MySQL is empty
          if ((oldCreditsValue > 0 || oldCashValue > 0) && credits === 0 && cash === 0) {
            try {
              // Migrate initial balance
              if (oldCreditsValue > 0) {
                await gcashFundsApi.addTransaction(
                  "add-credits",
                  oldCreditsValue,
                  oldCreditsValue,
                  oldCashValue,
                  0,
                  "Migrated from sessionStorage"
                );
              }
              if (oldCashValue > 0 && oldCreditsValue === 0) {
                await gcashFundsApi.addTransaction(
                  "add-cash",
                  oldCashValue,
                  0,
                  oldCashValue,
                  0,
                  "Migrated from sessionStorage"
                );
              }
              
              // Clear old sessionStorage
              sessionStorage.removeItem("gcash-credits");
              sessionStorage.removeItem("gcash-cash");
              sessionStorage.removeItem("gcash-history");
              
              // Reload balance
              const newBalance = await gcashFundsApi.getBalance();
              if (newBalance.success) {
                setCredits(newBalance.creditsBalance || 0);
                setCash(newBalance.cashBalance || 0);
              }
            } catch (error) {
              console.error("Error migrating GCash data:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error loading GCash funds:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFunds();
  }, []);

  // Sync pending transactions when online
  useEffect(() => {
    const syncPendingTransactions = async () => {
      if (!isOnline) return;
      
      const pending = loadPendingTransactions();
      if (pending.length === 0) return;

      const successfulIds: string[] = [];
      
      for (const tx of pending) {
        try {
          const result = await gcashFundsApi.addTransaction(
            tx.transactionType,
            tx.amount,
            tx.creditsBalanceAfter,
            tx.cashBalanceAfter,
            tx.serviceCharge,
            tx.notes,
            tx.gcashNumber
          );
          
          if (result.success) {
            successfulIds.push(tx.id);
          }
        } catch (error) {
          console.error("Error syncing pending GCash transaction:", error);
        }
      }

      // Remove successfully synced transactions
      if (successfulIds.length > 0) {
        const remaining = pending.filter((tx) => !successfulIds.includes(tx.id));
        savePendingTransactions(remaining);
        
        // Reload balance and history
        const balanceResult = await gcashFundsApi.getBalance();
        if (balanceResult.success) {
          setCredits(balanceResult.creditsBalance || 0);
          setCash(balanceResult.cashBalance || 0);
        }
        
        const historyResult = await gcashFundsApi.getHistory(100);
        if (historyResult.success && historyResult.data) {
          const localHistory = historyResult.data.map(convertDBToLocal);
          setHistory(localHistory);
        }
      }
    };

    if (isOnline) {
      syncPendingTransactions();
    }
  }, [isOnline]);

  // Save transaction to MySQL or queue if offline
  const saveTransaction = useCallback(async (
    transactionType: "add-credits" | "add-cash" | "gcash-in" | "gcash-out",
    amount: number,
    creditsBalanceAfter: number,
    cashBalanceAfter: number,
    serviceCharge: number = 0,
    notes?: string,
    gcashNumber?: string
  ) => {
    const connected = await checkApiConnection();
    setIsOnline(connected);

    if (connected) {
      // Save directly to MySQL
      const result = await gcashFundsApi.addTransaction(
        transactionType,
        amount,
        creditsBalanceAfter,
        cashBalanceAfter,
        serviceCharge,
        notes,
        gcashNumber
      );

      if (result.success && result.transaction) {
        // Update local state
        setCredits(creditsBalanceAfter);
        setCash(cashBalanceAfter);
        
        // Add to history
        const localTx = convertDBToLocal(result.transaction);
        setHistory((prev) => [localTx, ...prev].slice(0, 100));
        
        // Cache in sessionStorage for offline fallback
        sessionStorage.setItem("gcash-credits", creditsBalanceAfter.toString());
        sessionStorage.setItem("gcash-cash", cashBalanceAfter.toString());
        sessionStorage.setItem("gcash-history", JSON.stringify([localTx, ...history].slice(0, 100)));
        
        return { success: true, creditsBalance: creditsBalanceAfter, cashBalance: cashBalanceAfter };
      }
      
      return { success: false, error: result.error || "Failed to save transaction" };
    } else {
      // Offline: Queue transaction
      const pendingTx = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        transactionType,
        amount,
        creditsBalanceAfter,
        cashBalanceAfter,
        serviceCharge,
        notes,
        gcashNumber,
      };
      
      const pending = loadPendingTransactions();
      savePendingTransactions([...pending, pendingTx]);
      
      // Update local state optimistically
      setCredits(creditsBalanceAfter);
      setCash(cashBalanceAfter);
      
      // Create local transaction for history
      const localTx: GCashFundTransaction = {
        id: pendingTx.id,
        type: transactionType === "gcash-in" ? "gcash-in" : transactionType === "gcash-out" ? "gcash-out" : "add",
        amount,
        creditsBalance: creditsBalanceAfter,
        cashBalance: cashBalanceAfter,
        timestamp: Date.now(),
        notes,
        gcashNumber,
        serviceCharge: serviceCharge > 0 ? serviceCharge : undefined,
      };
      
      setHistory((prev) => [localTx, ...prev].slice(0, 100));
      
      // Cache in sessionStorage
      sessionStorage.setItem("gcash-credits", creditsBalanceAfter.toString());
      sessionStorage.setItem("gcash-cash", cashBalanceAfter.toString());
      sessionStorage.setItem("gcash-history", JSON.stringify([localTx, ...history].slice(0, 100)));
      
      return { success: true, creditsBalance: creditsBalanceAfter, cashBalance: cashBalanceAfter };
    }
  }, [history]);

  // Add funds to GCash Credits or Cash
  const addFunds = useCallback(async (amount: number, fundType: "credits" | "cash" = "credits", notes?: string) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    let newCreditsBalance = credits;
    let newCashBalance = cash;
    
    if (fundType === "credits") {
      newCreditsBalance = credits + amount;
    } else {
      newCashBalance = cash + amount;
    }
    
    return await saveTransaction(
      fundType === "credits" ? "add-credits" : "add-cash",
      amount,
      newCreditsBalance,
      newCashBalance,
      0,
      notes
    );
  }, [credits, cash, saveTransaction]);

  // Process GCASH-IN: Customer pays cash, we send GCash credit
  const processGCashIn = useCallback(async (
    amount: number, 
    serviceCharge: number = 0,
    gcashNumber?: string, 
    notes?: string
  ) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    // Add to Cash: customer pays cash (amount) + service charge (revenue)
    const newCashBalance = cash + amount + serviceCharge;
    // Deduct from Credits: we send GCash to customer (the amount they receive)
    const newCreditsBalance = credits - amount;
    
    return await saveTransaction(
      "gcash-in",
      amount,
      newCreditsBalance,
      newCashBalance,
      serviceCharge,
      notes,
      gcashNumber
    );
  }, [credits, cash, saveTransaction]);

  // Process GCASH-OUT: We give customer cash, customer sends GCash credit
  const processGCashOut = useCallback(async (
    amount: number, 
    serviceCharge: number = 0,
    notes?: string
  ) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    // Add to Credits: customer sends GCash to us
    const newCreditsBalance = credits + amount;
    // Deduct from Cash: we give cash to customer (amount only, service charge is separate revenue)
    const newCashBalance = cash - amount + serviceCharge; // Service charge is cash revenue
    
    return await saveTransaction(
      "gcash-out",
      amount,
      newCreditsBalance,
      newCashBalance,
      serviceCharge,
      notes
    );
  }, [credits, cash, saveTransaction]);

  // Deduct from GCash Credits only (for service charge deduction)
  const deductFromCredits = useCallback(async (
    amount: number,
    notes?: string
  ) => {
    if (amount <= 0) return { success: false, error: "Amount must be greater than 0" };
    
    // Deduct from Credits only, no change to Cash
    const newCreditsBalance = credits - amount;
    const newCashBalance = cash; // Cash balance unchanged
    
    return await saveTransaction(
      "add-credits", // Using add-credits type but with negative amount logic
      amount,
      newCreditsBalance,
      newCashBalance,
      0,
      notes
    );
  }, [credits, cash, saveTransaction]);

  // Process Load transaction: Deduct from credits, add to cash
  const processLoad = useCallback(async (
    loadAmount: number,
    gcashFee: number,
    transactionFee: number,
    totalCustomerPays: number,
    mobileNumber?: string,
    notes?: string
  ) => {
    if (loadAmount <= 0) return { success: false, error: "Load amount must be greater than 0" };
    
    // Deduct from Credits: load amount + GCash fee
    const creditsDeduction = loadAmount + gcashFee;
    const newCreditsBalance = credits - creditsDeduction;
    
    // Add to Cash: customer pays (load amount + GCash fee + transaction fee)
    const newCashBalance = cash + totalCustomerPays;
    
    // Combine notes
    const combinedNotes = `Load: ₱${loadAmount.toFixed(2)}${gcashFee > 0 ? ` + GCash Fee: ₱${gcashFee.toFixed(2)}` : ''} + Transaction Fee: ₱${transactionFee.toFixed(2)}${mobileNumber ? ` | Mobile: ${mobileNumber}` : ''}${notes ? ` | ${notes}` : ''}`;
    
    // Use add-cash type but record the full transaction details in notes
    // The amount recorded is the total customer payment (cash addition)
    // Credits deduction is reflected in the balance difference
    return await saveTransaction(
      "add-cash",
      totalCustomerPays,
      newCreditsBalance,
      newCashBalance,
      transactionFee, // Store transaction fee in service_charge field
      combinedNotes,
      mobileNumber
    );
  }, [credits, cash, saveTransaction]);

  // Refresh funds and history from MySQL
  const refresh = useCallback(async () => {
    try {
      const connected = await checkApiConnection();
      setIsOnline(connected);
      
      if (connected) {
        const balanceResult = await gcashFundsApi.getBalance();
        if (balanceResult.success) {
          setCredits(balanceResult.creditsBalance || 0);
          setCash(balanceResult.cashBalance || 0);
        }

        const historyResult = await gcashFundsApi.getHistory(100);
        if (historyResult.success && historyResult.data) {
          const localHistory = historyResult.data.map(convertDBToLocal);
          setHistory(localHistory);
        }
      }
    } catch (error) {
      console.error("Error refreshing GCash funds:", error);
    }
  }, []);

  return {
    credits, // GCash Credits (wallet balance)
    cash, // GCash Cash (actual cash from transactions)
    funds: credits, // Legacy support: return credits as "funds"
    history,
    isLoading,
    isOnline,
    setCredits: (value: number | ((prev: number) => number)) => {
      const newValue = typeof value === 'function' ? value(credits) : value;
      setCredits(newValue);
      sessionStorage.setItem("gcash-credits", newValue.toString());
    },
    setCash: (value: number | ((prev: number) => number)) => {
      const newValue = typeof value === 'function' ? value(cash) : value;
      setCash(newValue);
      sessionStorage.setItem("gcash-cash", newValue.toString());
    },
    setHistory: (value: GCashFundTransaction[] | ((prev: GCashFundTransaction[]) => GCashFundTransaction[])) => {
      const newValue = typeof value === 'function' ? value(history) : value;
      setHistory(newValue);
      sessionStorage.setItem("gcash-history", JSON.stringify(newValue));
    },
    addFunds,
    processGCashIn,
    processGCashOut,
    deductFromCredits,
    processLoad,
    refresh,
  };
}
