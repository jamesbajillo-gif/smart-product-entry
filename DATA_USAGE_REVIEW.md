# Data Usage Review: MySQL API Compliance

## Executive Summary

This document reviews all data storage mechanisms in the application to ensure everything uses MySQL API for persistent data storage. The review identified **one critical issue** where GCash funds are stored only in sessionStorage and will be lost when the browser session ends.

---

## ✅ Data Using MySQL API (Correct)

### 1. **Products**
- **Storage**: MySQL `products` table
- **API**: `productsApi` in `src/services/mysqlApi.ts`
- **Hook**: `useMySQLSync` → `refreshProducts()`
- **Cache**: sessionStorage (`pos-products`) as fallback only
- **Status**: ✅ **Correct** - MySQL is source of truth

### 2. **Sales Transactions**
- **Storage**: MySQL `sales` table
- **API**: `salesApi` in `src/services/mysqlApi.ts`
- **Hook**: `useMySQLSync` → `recordSale()`
- **Offline Queue**: localStorage (`pos-pending-sales`) for offline sales, synced when online
- **Status**: ✅ **Correct** - MySQL is source of truth

### 3. **Stock Adjustments**
- **Storage**: MySQL `stock_adjustments` table
- **API**: `stockApi` in `src/services/mysqlApi.ts`
- **Status**: ✅ **Correct** - Direct MySQL storage

### 4. **Quantity History**
- **Storage**: MySQL `quantity_history` table
- **API**: `quantityHistoryApi` in `src/services/mysqlApi.ts`
- **Cache**: sessionStorage (`pos-qty-history`) as fallback only
- **Status**: ✅ **Correct** - MySQL is source of truth

### 5. **Store Funds**
- **Storage**: MySQL `store_funds` table
- **API**: `storeFundsApi` in `src/services/mysqlApi.ts`
- **Hook**: `useStoreFunds` → Loads from MySQL on mount, saves on every transaction
- **Status**: ✅ **Correct** - MySQL is source of truth

### 6. **Expenses**
- **Storage**: MySQL `expenses` table
- **API**: `expensesApi` in `src/services/mysqlApi.ts`
- **Status**: ✅ **Correct** - Direct MySQL storage

### 7. **Categories**
- **Storage**: MySQL `categories` table
- **API**: `categoriesApi` in `src/services/mysqlApi.ts`
- **Cache**: localStorage for performance (acceptable)
- **Status**: ✅ **Correct** - MySQL is source of truth

### 8. **Fees**
- **Storage**: MySQL `fees` table
- **API**: `feesApi` in `src/services/mysqlApi.ts`
- **Status**: ✅ **Correct** - Direct MySQL storage

### 9. **Transaction Logs**
- **Storage**: MySQL `transaction_log` table
- **API**: `logTransaction()` in `src/services/mysqlApi.ts`
- **Status**: ✅ **Correct** - Direct MySQL storage

---

## 🔴 Critical Issue: GCash Funds

### Problem
**GCash funds are stored ONLY in sessionStorage** and will be lost when:
- Browser is closed
- Browser tab is closed
- Session expires
- User clears browser data

### Current Implementation
```typescript
// src/hooks/useGCashFunds.ts
const [credits, setCredits] = useSessionStorage<number>(GCASH_CREDITS_KEY, 0);
const [cash, setCash] = useSessionStorage<number>(GCASH_CASH_KEY, 0);
const [history, setHistory] = useSessionStorage<GCashFundTransaction[]>(GCASH_HISTORY_KEY, []);
```

### Expected Behavior
- MySQL table `gcash_funds` exists (see `create_gcash_funds_table.sql`)
- Should load initial balance from MySQL on mount
- Should save every transaction to MySQL
- Should use sessionStorage only as cache/fallback
- Should implement offline queue similar to sales

### Impact
- ❌ Financial data loss on session end
- ❌ No audit trail
- ❌ Cannot track GCash transactions across sessions
- ❌ Cannot sync across multiple devices/browsers
- ❌ No backup/recovery capability

### Required Fix
1. Create `gcashFundsApi` in `src/services/mysqlApi.ts`
2. Update `useGCashFunds.ts` to use MySQL API
3. Implement offline queue for GCash transactions
4. Migrate existing sessionStorage data to MySQL

---

## ✅ Acceptable Uses of Local/Session Storage

### 1. **Cart/Order Items** (sessionStorage)
- **Storage**: `sessionStorage` (`pos-order`)
- **Reason**: Temporary cart data, cleared on checkout
- **Status**: ✅ **Acceptable** - Not persistent data

### 2. **User Authentication** (sessionStorage)
- **Storage**: `sessionStorage` (`auth-status`, `user-role`, `operator-name`)
- **Reason**: Session-based authentication
- **Status**: ✅ **Acceptable** - Session-specific data

### 3. **Pending Sales Queue** (localStorage)
- **Storage**: `localStorage` (`pos-pending-sales`)
- **Reason**: Offline queue, synced to MySQL when online
- **Status**: ✅ **Acceptable** - Temporary queue, synced to MySQL

### 4. **Product Cache** (sessionStorage)
- **Storage**: `sessionStorage` (`pos-products`, `pos-qty-history`)
- **Reason**: Performance cache, MySQL is source of truth
- **Status**: ✅ **Acceptable** - Cache only, not source of truth

### 5. **User Preferences** (localStorage)
- **Storage**: `localStorage` (bottle deposit amounts, pieces per case, API URL override)
- **Reason**: User-specific preferences
- **Status**: ✅ **Acceptable** - User preferences, not business data

### 6. **Categories Cache** (localStorage)
- **Storage**: `localStorage` (`categories-cache`)
- **Reason**: Performance cache, MySQL is source of truth
- **Status**: ✅ **Acceptable** - Cache only, not source of truth

---

## 📊 Data Storage Summary

| Data Type | Storage | MySQL API | Persistence | Offline Support | Status |
|-----------|---------|-----------|------------|-----------------|--------|
| Products | MySQL + sessionStorage cache | ✅ Yes | ✅ Persistent | ✅ Cached | ✅ Good |
| Sales | MySQL + localStorage queue | ✅ Yes | ✅ Persistent | ✅ Queued | ✅ Good |
| Stock Adjustments | MySQL | ✅ Yes | ✅ Persistent | ❌ No | ⚠️ Online only |
| Quantity History | MySQL + sessionStorage cache | ✅ Yes | ✅ Persistent | ✅ Cached | ✅ Good |
| Store Funds | MySQL | ✅ Yes | ✅ Persistent | ❌ No | ⚠️ Online only |
| Expenses | MySQL | ✅ Yes | ✅ Persistent | ❌ No | ⚠️ Online only |
| Categories | MySQL + localStorage cache | ✅ Yes | ✅ Persistent | ✅ Cached | ✅ Good |
| Fees | MySQL | ✅ Yes | ✅ Persistent | ❌ No | ⚠️ Online only |
| Transaction Logs | MySQL | ✅ Yes | ✅ Persistent | ❌ No | ⚠️ Online only |
| **GCash Funds** | **sessionStorage only** | **❌ No** | **❌ Lost on close** | **❌ No** | **🔴 Critical** |
| GCash History | sessionStorage only | ❌ No | ❌ Lost on close | ❌ No | 🔴 Critical |
| Cart Items | sessionStorage | N/A | ❌ Temporary | ✅ Yes | ✅ Acceptable |
| User Auth | sessionStorage | N/A | ❌ Session | ✅ Yes | ✅ Acceptable |
| Pending Sales | localStorage queue | ✅ Synced | ✅ Queued | ✅ Yes | ✅ Acceptable |

---

## 🔧 Required Actions

### Priority 1: Fix GCash Funds Storage (CRITICAL)

1. **Create GCash Funds API** (`src/services/mysqlApi.ts`):
   - `getBalance()` - Get latest credits and cash balance
   - `addTransaction()` - Insert transaction into `gcash_funds` table
   - `getHistory()` - Get transaction history

2. **Update useGCashFunds Hook** (`src/hooks/useGCashFunds.ts`):
   - Load initial balance from MySQL on mount
   - Save every transaction to MySQL
   - Use sessionStorage as cache/fallback only
   - Implement offline queue (localStorage) similar to sales
   - Migrate existing sessionStorage data to MySQL on first load

3. **Update REQUIRED_SCHEMA** (`src/services/mysqlApi.ts`):
   - Add `gcash_funds` table to schema validation

---

## ✅ Verification Checklist

After implementing fixes, verify:

- [ ] GCash funds load from MySQL on app start
- [ ] GCash transactions save to MySQL immediately
- [ ] GCash funds persist across browser sessions
- [ ] GCash history loads from MySQL
- [ ] Offline GCash transactions queue and sync when online
- [ ] Existing sessionStorage data migrates to MySQL
- [ ] All other data continues using MySQL API correctly

---

## Conclusion

**Overall Status**: ✅ **Mostly Compliant** (1 critical issue)

The application correctly uses MySQL API for **all persistent business data** except GCash funds. The GCash funds issue is **critical** and must be fixed immediately as it causes financial data loss.

**Recommendation**: Implement GCash Funds MySQL API integration as Priority 1.

