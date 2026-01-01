# GCash Transaction Flow Review

## Overview
This document reviews the complete GCash transaction flow for both GCash-In and GCash-Out operations, including service charge calculations, balance updates, and payment recording.

---

## 1. GCASH-IN Transaction Flow

### Purpose
Customer pays cash, we send GCash credits to their wallet.

### Service Charge Calculation
- ₱10-99: ₱5
- ₱100-500: ₱10
- ₱501-1000: ₱15
- Over ₱1000: ₱0 (no service charge)

### Transaction Flow

#### Scenario A: Toggle OFF (Default) - Service Charge Paid in Cash
**Example: Amount = ₱200, Service Charge = ₱10**

1. **Dialog Calculation** (`GCashTransactionDialog.tsx`):
   - `amount`: ₱200
   - `serviceCharge`: ₱10
   - `totalAmount`: ₱210 (amount + serviceCharge)
   - `deductServiceFeeFromGCash`: false

2. **Transaction Processing** (`Index.tsx` → `handleGcashTransaction`):
   - Calls `processGCashIn(200, 10, gcashNumber, notes)`
   - **Balance Updates** (`useGCashFunds.ts` → `processGCashIn`):
     - **GCash Credits**: `credits - 200` (deducted - we send GCash to customer)
     - **GCash Cash**: `cash + 200 + 10` (added - customer pays cash + service charge)
   - **Result**:
     - Credits: -₱200
     - Cash: +₱210

3. **Payment Recording**:
   - Payment method: `cash`
   - Amount tendered: ₱210
   - Items recorded:
     - GCASH-IN: ₱200
     - Service Charge: ₱10

**✅ Status: CORRECT** - Customer pays ₱210 cash, receives ₱200 GCash, service charge is revenue.

---

#### Scenario B: Toggle ON - Service Charge Deducted from GCash
**Example: Amount = ₱200, Service Charge = ₱10**

1. **Dialog Calculation** (`GCashTransactionDialog.tsx`):
   - `amount`: ₱200
   - `serviceCharge`: ₱10
   - `totalAmount`: ₱200 (amount only)
   - `deductServiceFeeFromGCash`: true

2. **Transaction Processing** (`Index.tsx` → `handleGcashTransaction`):
   - **First Call**: `processGCashIn(200, 0, gcashNumber, notes)`
     - **Balance Updates**:
       - **GCash Credits**: `credits - 200` (deducted - we send GCash to customer)
       - **GCash Cash**: `cash + 200` (added - customer pays cash only)
   - **Second Call** (Adjustment): `processGCashIn(10, 0, undefined, "Service fee deduction from credits")`
     - **Balance Updates**:
       - **GCash Credits**: `credits - 10` (deducted - service charge from credits)
       - **GCash Cash**: `cash + 10` (added - but then corrected back)
     - **Correction**: Cash balance is adjusted back: `cashBalance - 10`
   - **Final Result**:
     - Credits: -₱210 (₱200 + ₱10 service charge)
     - Cash: +₱200 (customer pays only amount)

3. **Payment Recording**:
   - Payment method: `cash`
   - Amount tendered: ₱200
   - Items recorded:
     - GCASH-IN: ₱200
     - Service Charge: ₱10

**⚠️ ISSUE FOUND**: The adjustment logic is complex and uses a workaround. The second `processGCashIn` call adds to cash, then manually corrects it back. This is inefficient and error-prone.

**Recommendation**: Create a dedicated function to deduct from credits only, or modify `processGCashIn` to accept a flag for service charge handling.

---

## 2. GCASH-OUT Transaction Flow

### Purpose
Customer sends GCash credits, we give cash.

### Transaction Flow

#### Scenario A: Toggle OFF (Default) - Service Charge Paid Separately in Cash
**Example: Amount = ₱200, Service Charge = ₱10**

1. **Dialog Calculation** (`GCashTransactionDialog.tsx`):
   - `amount`: ₱200
   - `serviceCharge`: ₱10
   - `totalAmount`: ₱200 (amount only - customer sends GCash)
   - `deductServiceFeeFromGCash`: false

2. **Transaction Processing** (`Index.tsx` → `handleGcashTransaction`):
   - Calls `processGCashOut(200, 10, notes)`
   - **Balance Updates** (`useGCashFunds.ts` → `processGCashOut`):
     - **GCash Credits**: `credits + 200` (added - customer sends GCash)
     - **GCash Cash**: `cash - 200 + 10` (deducted amount, added service charge as revenue)
   - **Result**:
     - Credits: +₱200
     - Cash: -₱190 (₱200 given to customer, ₱10 service charge received)

3. **Payment Recording**:
   - Payment method: `gcash`
   - Amount tendered: ₱200
   - Items recorded:
     - GCASH-OUT: ₱200
     - Service Charge: ₱10

**⚠️ ISSUE FOUND**: Payment mismatch
- Items total: ₱210 (₱200 + ₱10)
- Payment via GCash: ₱200 only
- Service charge (₱10) is paid separately in cash but not reflected in payment method
- This creates an accounting inconsistency where the payment method doesn't match the total items

**Recommendation**: Consider recording service charge separately or adjusting payment method logic.

---

#### Scenario B: Toggle ON - Service Charge Deducted from GCash
**Example: Amount = ₱200, Service Charge = ₱10**

1. **Dialog Calculation** (`GCashTransactionDialog.tsx`):
   - `amount`: ₱200
   - `serviceCharge`: ₱10
   - `totalAmount`: ₱210 (amount + serviceCharge - customer sends GCash)
   - `deductServiceFeeFromGCash`: true

2. **Transaction Processing** (`Index.tsx` → `handleGcashTransaction`):
   - **First Call**: `processGCashOut(200, 10, notes)`
     - **Balance Updates**:
       - **GCash Credits**: `credits + 200` (added - customer sends GCash)
       - **GCash Cash**: `cash - 200 + 10` (deducted amount, added service charge)
   - **Second Call** (Adjustment): `processGCashIn(10, 0, undefined, "Service fee deduction from credits")`
     - **Balance Updates**:
       - **GCash Credits**: `credits - 10` (deducted - service charge from credits)
       - **GCash Cash**: `cash + 10` (added - but then corrected back)
     - **Correction**: Cash balance is adjusted back: `cashBalance - 10`
   - **Final Result**:
     - Credits: +₱190 (₱200 received, ₱10 deducted)
     - Cash: -₱200 (we give cash to customer)

3. **Payment Recording**:
   - Payment method: `gcash`
   - Amount tendered: ₱210
   - Items recorded:
     - GCASH-OUT: ₱200
     - Service Charge: ₱10

**⚠️ ISSUE FOUND**: Same complex adjustment logic as GCash-In with toggle ON. The workaround is inefficient.

**Recommendation**: Same as GCash-In - create a dedicated function or modify the processing logic.

---

## 3. Issues Identified

### Issue 1: Complex Adjustment Logic for Service Charge Deduction
**Location**: `Index.tsx` → `handleGcashTransaction` (lines 1217-1243, 1283-1294)

**Problem**: When service charge is deducted from GCash credits, the code uses a workaround:
1. Calls `processGCashIn(serviceCharge, 0, ...)` which adds to cash
2. Manually corrects the cash balance back

**Impact**: 
- Error-prone
- Hard to maintain
- Unclear logic flow

**Recommendation**: 
- Create a dedicated function `deductFromCredits(amount, notes)` in `useGCashFunds.ts`
- Or modify `processGCashIn` to accept a flag like `serviceChargeFromCredits: boolean`

### Issue 2: Payment Method Mismatch for GCash-Out (Toggle OFF)
**Location**: `Index.tsx` → `handleGcashTransaction` (lines 1338-1342)

**Problem**: 
- Items total: ₱210 (₱200 + ₱10 service charge)
- Payment method: `gcash`, amount: ₱200
- Service charge (₱10) is paid separately in cash but not reflected in payment method

**Impact**: Accounting inconsistency

**Recommendation**: 
- Document this behavior clearly
- Or adjust payment recording to reflect the actual payment split

### Issue 3: Balance Preview Calculation
**Location**: `GCashTransactionDialog.tsx` (lines 84-93)

**Problem**: The balance preview calculation for GCash-Out with toggle ON is incorrect:
```typescript
if (deductServiceFeeFromGCash) {
  newBalanceAfterTransaction = currentBalance + numericAmount + serviceCharge - serviceCharge;
}
```
This simplifies to `currentBalance + numericAmount`, which doesn't account for the service charge deduction.

**Impact**: User sees incorrect balance preview

**Recommendation**: Fix the calculation to show: `currentBalance + numericAmount - serviceCharge`

---

## 4. Recommendations

### High Priority
1. **Refactor Service Charge Deduction Logic**
   - Create `deductFromCredits(amount, notes)` function
   - Remove workaround logic in `handleGcashTransaction`

2. **Fix Balance Preview Calculation**
   - Correct the GCash-Out toggle ON calculation in `GCashTransactionDialog.tsx`

### Medium Priority
3. **Document Payment Method Behavior**
   - Clearly document that GCash-Out with toggle OFF has a payment split
   - Or adjust payment recording to use a mixed payment method

4. **Simplify Transaction Processing**
   - Consider consolidating the service charge handling logic
   - Make the flow more straightforward and easier to understand

---

## 5. Testing Scenarios

### GCash-In Tests
- [ ] Toggle OFF: Verify customer pays amount + service charge, receives amount in GCash
- [ ] Toggle ON: Verify customer pays amount only, service charge deducted from credits
- [ ] Verify balance updates correctly in both scenarios
- [ ] Verify payment recording matches transaction

### GCash-Out Tests
- [ ] Toggle OFF: Verify customer sends amount via GCash, pays service charge in cash
- [ ] Toggle ON: Verify customer sends amount + service charge via GCash
- [ ] Verify balance updates correctly in both scenarios
- [ ] Verify payment recording matches transaction
- [ ] Verify cash given to customer is correct amount

---

## Summary

The GCash transaction flow is functional but has some complexity issues:

1. **GCash-In**: Works correctly but uses a workaround for service charge deduction
2. **GCash-Out**: Works correctly but has a payment method mismatch when toggle is OFF
3. **Balance Preview**: Incorrect calculation for GCash-Out with toggle ON

All issues are non-critical but should be addressed for better maintainability and accuracy.

