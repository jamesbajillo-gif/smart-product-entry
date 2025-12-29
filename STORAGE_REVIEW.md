# Storage Review: MySQL API vs Session-Based Storage

## Summary

The application uses a **hybrid storage approach** with both live MySQL API storage and session-based storage. However, there are **critical issues** where important data is only stored in sessionStorage and will be lost when the browser session ends.

---

## ✅ Live MySQL API Storage (Persistent)

The following data is stored in MySQL database via API and persists across sessions:

### 1. **Products**
- **Storage**: MySQL `products` table
- **Sync**: Real-time when online, cached in sessionStorage as fallback
- **Location**: `src/hooks/useMySQLSync.ts`
- **Status**: ✅ Persistent

### 2. **Sales Transactions**
- **Storage**: MySQL `sales` table
- **Sync**: 
  - **Online**: Saved directly to MySQL
  - **Offline**: Queued in `localStorage` (`pos-pending-sales`) and synced when connection restored
- **Location**: `src/hooks/useMySQLSync.ts` → `recordSale()`
- **Status**: ✅ Persistent (with offline queue)

### 3. **Stock Adjustments**
- **Storage**: MySQL `stock_adjustments` table
- **Sync**: Real-time when online
- **Location**: `src/services/mysqlApi.ts` → `stockApi`
- **Status**: ✅ Persistent

### 4. **Quantity History**
- **Storage**: MySQL `quantity_history` table
- **Sync**: Real-time when online, cached in sessionStorage as fallback
- **Location**: `src/hooks/useMySQLSync.ts`
- **Status**: ✅ Persistent

### 5. **Store Funds**
- **Storage**: MySQL `store_funds` table
- **Sync**: Real-time when online, loaded from database on mount
- **Location**: `src/hooks/useStoreFunds.ts`
- **Status**: ✅ Persistent

### 6. **Expenses**
- **Storage**: MySQL `expenses` table
- **Sync**: Real-time when online
- **Location**: `src/services/mysqlApi.ts` → `expensesApi`
- **Status**: ✅ Persistent

### 7. **Categories**
- **Storage**: MySQL `categories` table
- **Sync**: Real-time when online
- **Location**: `src/services/mysqlApi.ts` → `categoriesApi`
- **Status**: ✅ Persistent

### 8. **Fees**
- **Storage**: MySQL `fees` table
- **Sync**: Real-time when online
- **Location**: `src/services/mysqlApi.ts` → `feesApi`
- **Status**: ✅ Persistent

### 9. **Transaction Logs**
- **Storage**: MySQL `transaction_log` table
- **Sync**: Real-time when online
- **Location**: `src/services/mysqlApi.ts` → `logTransaction()`
- **Status**: ✅ Persistent

---

## ⚠️ Session-Based Storage (Temporary - Data Loss Risk)

The following data is stored **only in sessionStorage** and will be **lost when the browser session ends**:

### 1. **GCash Funds** ❌ CRITICAL ISSUE
- **Storage**: `sessionStorage` only
  - `gcash-credits` - GCash wallet balance
  - `gcash-cash` - Actual cash from GCash transactions
  - `gcash-history` - Transaction history
- **Location**: `src/hooks/useGCashFunds.ts`
- **Issue**: ⚠️ **Data is lost when browser closes**
- **Impact**: All GCash funds, transactions, and history are lost on session end
- **Recommendation**: Should be stored in MySQL `gcash_funds` table

### 2. **Cart/Order Items**
- **Storage**: `sessionStorage` (`pos-order`)
- **Location**: `src/pages/Index.tsx` → `useSessionStorage("pos-order", [])`
- **Status**: ✅ Acceptable (temporary cart data)

### 3. **Products Cache (Fallback)**
- **Storage**: `sessionStorage` (`pos-products`)
- **Location**: `src/hooks/useMySQLSync.ts`
- **Status**: ✅ Acceptable (fallback cache only)

### 4. **Quantity History Cache (Fallback)**
- **Storage**: `sessionStorage` (`pos-qty-history`)
- **Location**: `src/hooks/useMySQLSync.ts`
- **Status**: ✅ Acceptable (fallback cache only)

---

## 📦 LocalStorage (Persistent, Browser-based)

### 1. **Pending Sales Queue**
- **Storage**: `localStorage` (`pos-pending-sales`)
- **Purpose**: Queue sales when offline, sync to MySQL when online
- **Location**: `src/hooks/useMySQLSync.ts`
- **Status**: ✅ Acceptable (temporary queue, synced to MySQL)

### 2. **User Preferences**
- **Storage**: `localStorage`
  - Bottle deposit amounts per product
  - Pieces per case settings
  - API URL override
- **Status**: ✅ Acceptable (user preferences)

---

## 🔴 Critical Issues

### Issue #1: GCash Funds Not Persisted to MySQL

**Problem**: GCash funds (credits, cash, and history) are stored only in `sessionStorage` and are lost when:
- Browser is closed
- Browser tab is closed
- Session expires
- User clears browser data

**Current Implementation**:
```typescript
// src/hooks/useGCashFunds.ts
const [credits, setCredits] = useSessionStorage<number>(GCASH_CREDITS_KEY, 0);
const [cash, setCash] = useSessionStorage<number>(GCASH_CASH_KEY, 0);
const [history, setHistory] = useSessionStorage<GCashFundTransaction[]>(GCASH_HISTORY_KEY, []);
```

**Expected Behavior**: Should use MySQL `gcash_funds` table (which exists based on `create_gcash_funds_table.sql`)

**Impact**: 
- Financial data loss
- No audit trail
- Cannot track GCash transactions across sessions
- Cannot sync across multiple devices/browsers

**Recommendation**: 
1. Create `gcashFundsApi` in `src/services/mysqlApi.ts`
2. Update `useGCashFunds.ts` to:
   - Load initial balance from MySQL on mount
   - Save to MySQL on every transaction
   - Use sessionStorage only as cache/fallback
   - Implement offline queue similar to sales

---

## ✅ Correct Implementation Examples

### Sales (Correct Pattern)
```typescript
// Online: Save directly to MySQL
if (isOnline) {
  await salesApi.create(saleData);
}

// Offline: Queue in localStorage, sync later
const pendingSale = { id, data: saleData, ... };
savePendingSales([...pendingSales, pendingSale]);
```

### Store Funds (Correct Pattern)
```typescript
// Load from MySQL on mount
useEffect(() => {
  const loadFunds = async () => {
    const result = await storeFundsApi.getBalance();
    if (result.success) setFunds(result.balance);
  };
  loadFunds();
}, []);

// Save to MySQL on every transaction
const addFunds = async (amount: number) => {
  const result = await storeFundsApi.addFunds(amount);
  if (result.success) {
    setFunds(funds + amount);
  }
};
```

---

## 📊 Storage Summary Table

| Data Type | Storage | Persistence | Offline Support | Status |
|-----------|---------|-------------|-----------------|--------|
| Products | MySQL + sessionStorage cache | ✅ Persistent | ✅ Cached | ✅ Good |
| Sales | MySQL + localStorage queue | ✅ Persistent | ✅ Queued | ✅ Good |
| Stock Adjustments | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| Quantity History | MySQL + sessionStorage cache | ✅ Persistent | ✅ Cached | ✅ Good |
| Store Funds | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| Expenses | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| Categories | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| Fees | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| Transaction Logs | MySQL | ✅ Persistent | ❌ No | ⚠️ Online only |
| **GCash Funds** | **sessionStorage only** | **❌ Lost on close** | **❌ No** | **🔴 Critical** |
| GCash History | sessionStorage only | ❌ Lost on close | ❌ No | 🔴 Critical |
| Cart Items | sessionStorage | ❌ Temporary | ✅ Yes | ✅ Acceptable |

---

## 🔧 Recommended Fixes

### Priority 1: Fix GCash Funds Storage

1. **Create GCash Funds API**:
   ```typescript
   // src/services/mysqlApi.ts
   export const gcashFundsApi = {
     getBalance: async () => {
       // Get latest balance from gcash_funds table
     },
     addTransaction: async (transaction: GCashTransaction) => {
       // Insert into gcash_funds table
     },
     getHistory: async (limit: number = 100) => {
       // Get transaction history
     }
   };
   ```

2. **Update useGCashFunds Hook**:
   - Load initial balance from MySQL on mount
   - Save every transaction to MySQL
   - Use sessionStorage as cache/fallback
   - Implement offline queue similar to sales

3. **Migration**:
   - On first load, migrate existing sessionStorage GCash data to MySQL
   - Clear sessionStorage after migration

---

## 📝 Notes

- **SessionStorage**: Cleared when browser/tab closes
- **LocalStorage**: Persists until manually cleared
- **MySQL**: Permanent database storage
- **Offline Queue**: Sales use localStorage queue, GCash should too
- **Cache**: sessionStorage used for fast access, but MySQL is source of truth

---

## Conclusion

The application correctly uses MySQL API for most persistent data, but **GCash funds are a critical exception** that need immediate attention. All GCash financial data is currently lost when the browser session ends, which is unacceptable for a POS system.

