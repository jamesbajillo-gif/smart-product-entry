# Product Fees Logic Review

## Overview
This document reviews how product fees are displayed and whether they can be manually overridden or changed in the cart or payment dialog.

---

## 1. When Fees Are Displayed

### 1.1 In Cart (OrderSidebar)
**Location:** `src/components/OrderSidebar.tsx`

- **Display Location:** Cart summary section (lines 473-494)
- **What's Shown:**
  - Individual fee names with calculated amounts
  - Total fees amount
  - Only fees that apply to items in the cart (based on product categories)
- **Calculation:**
  - Fees are calculated based on:
    - Fee configuration (fixed amount or percentage)
    - Calculation type (per_item or per_transaction)
    - Only items with `feesEnabled !== false` are included
  - Code: Lines 219-232 in `OrderSidebar.tsx`

### 1.2 In Payment Dialog
**Location:** `src/components/PaymentDialog.tsx`

- **Display Location:** Fees section with toggleable checkboxes (lines 203-244)
- **What's Shown:**
  - Each applicable fee with a checkbox to enable/disable
  - Fee name and calculated amount
  - Total fees (sum of enabled fees only)
- **Calculation:**
  - Fees are recalculated based on enabled fee types
  - Code: Lines 65-77 in `PaymentDialog.tsx`

### 1.3 In Receipt
**Location:** `src/components/ReceiptDialog.tsx` and `OrderSidebar.tsx` (receipt view)

- **Display Location:** Receipt breakdown section
- **What's Shown:**
  - Individual fee names and amounts (only enabled fees)
  - Total fees
  - Based on `paymentDetails.enabledFeeIds` from the payment confirmation

---

## 2. Can Fees Be Manually Overridden or Changed?

### 2.1 In Cart (OrderSidebar)

#### ✅ Per-Item Fee Toggle
- **Location:** Next to each cart item (lines 380-391)
- **Functionality:**
  - Checkbox to enable/disable fees for individual items
  - Controlled by `feesEnabled` property on `OrderItem`
  - Default: `true` (fees enabled)
- **Implementation:**
  ```typescript
  // In OrderSidebar.tsx
  {itemHasFees && onToggleFees && (
    <Checkbox
      checked={feesEnabled}
      onCheckedChange={(checked) => {
        onToggleFees(item.product.id, checked === true);
      }}
    />
  )}
  ```
- **Handler:** `handleToggleFees` in `Index.tsx` (line 779)

#### ❌ Fee Amount Override
- **NOT POSSIBLE:** Fee amounts cannot be manually edited
- Fees are automatically calculated based on:
  - Fee configuration (`fee.amount`, `fee.is_percentage`)
  - Calculation type (`fee.calculation_type`)
  - Subtotal (for percentage fees)
  - Matching items count (for per_item fees)

### 2.2 In Payment Dialog

#### ✅ Per-Fee-Type Toggle
- **Location:** Fees section with checkboxes (lines 217-220)
- **Functionality:**
  - Each fee type can be enabled/disabled via checkbox
  - Controlled by `enabledFeeIds` state (Set of fee IDs)
  - Default: All fees enabled
- **Implementation:**
  ```typescript
  // In PaymentDialog.tsx
  const [enabledFeeIds, setEnabledFeeIds] = useState<Set<number>>(() => {
    const initialSet = new Set<number>();
    fees.forEach(fee => {
      if (fee.id) initialSet.add(fee.id);
    });
    return initialSet;
  });
  ```
- **Effect:** When a fee is disabled, it's excluded from the total calculation

#### ❌ Fee Amount Override
- **NOT POSSIBLE:** Fee amounts cannot be manually edited
- Fees are recalculated automatically when:
  - Fee toggles change
  - Order items change
  - Subtotal changes

---

## 3. Fee Calculation Logic

### 3.1 Fee Configuration
Fees are stored in the database (`fees` table) with:
- `amount`: Fixed amount or percentage value
- `is_percentage`: 0 = fixed, 1 = percentage
- `calculation_type`: `per_item` or `per_transaction`
- `categories`: JSON array of product categories (NULL = applies to all)

### 3.2 Calculation Function
**Location:** `src/utils/fees.ts` (lines 118-131)

```typescript
export function calculateFeeAmount(
  fee: FeeRecord, 
  subtotal: number, 
  matchingItemsCount: number = 1
): number {
  const calculationType = fee.calculation_type || 'per_transaction';
  const baseAmount = Boolean(fee.is_percentage)
    ? (subtotal * Number(fee.amount || 0)) / 100  // Percentage
    : Number(fee.amount || 0);  // Fixed amount

  if (calculationType === 'per_item') {
    return baseAmount * matchingItemsCount;  // Multiply by item count
  } else {
    return baseAmount;  // Apply once per transaction
  }
}
```

### 3.3 Applicable Fees Detection
**Location:** `src/utils/fees.ts` (lines 58-91)

- Fees are matched to cart items based on product categories
- If a fee's `categories` is NULL, it applies to all products
- If a fee has specific categories, it only applies to products in those categories

---

## 4. Issues and Inconsistencies

### ⚠️ Issue 1: Payment Dialog Doesn't Respect Per-Item `feesEnabled`

**Problem:**
- In `PaymentDialog.tsx` (line 71), fee calculation uses:
  ```typescript
  const matchingItems = getProductsForFee(fee, orderItems);
  ```
- This does NOT filter by `feesEnabled` per item
- However, in `OrderSidebar.tsx` (line 481), it correctly filters:
  ```typescript
  const itemsWithFeesEnabled = items.filter(item => item.feesEnabled !== false);
  const matchingItems = getProductsForFee(fee, itemsWithFeesEnabled);
  ```

**Impact:**
- If a user disables fees for a specific item in the cart, the payment dialog will still calculate fees for that item
- This creates an inconsistency between cart display and payment dialog

**Recommendation:**
Update `PaymentDialog.tsx` to filter items by `feesEnabled`:
```typescript
// Line 71 in PaymentDialog.tsx should be:
const itemsWithFeesEnabled = orderItems.filter(item => item.feesEnabled !== false);
const matchingItems = getProductsForFee(fee, itemsWithFeesEnabled);
```

### ⚠️ Issue 2: Index.tsx Fee Calculation Doesn't Respect `feesEnabled`

**Problem:**
- In `Index.tsx` (lines 142-159), fee calculation doesn't filter by `feesEnabled`:
  ```typescript
  fees.forEach(fee => {
    const matchingItems = getProductsForFee(fee, orderItems);
    // Should filter by feesEnabled here
  });
  ```

**Impact:**
- The `totalFees` state in `Index.tsx` may not match what's shown in the cart
- However, this value is only passed to `PaymentDialog` as `totalFees` prop, which is not used (PaymentDialog recalculates)

**Recommendation:**
Either:
1. Fix the calculation in `Index.tsx` to respect `feesEnabled`
2. Or remove the `totalFees` prop from `PaymentDialog` since it's recalculated anyway

---

## 5. Summary

### What Can Be Changed:
1. ✅ **Per-item fee toggle** in cart (enable/disable fees for specific items)
2. ✅ **Per-fee-type toggle** in payment dialog (enable/disable specific fee types)

### What Cannot Be Changed:
1. ❌ **Fee amounts** - Automatically calculated based on fee configuration
2. ❌ **Fee calculation logic** - Fixed by fee configuration (per_item vs per_transaction, percentage vs fixed)

### Current Behavior:
- Fees are displayed in: Cart, Payment Dialog, Receipt
- Fees can be toggled on/off but amounts cannot be manually edited
- There's an inconsistency where per-item `feesEnabled` flags are not respected in the Payment Dialog

---

## 6. Recommendations

1. **Fix Payment Dialog:** Update fee calculation to respect per-item `feesEnabled` flags
2. **Fix Index.tsx:** Update fee calculation to respect per-item `feesEnabled` flags (or remove unused `totalFees` prop)
3. **Consider Adding:** Manual fee amount override feature if business requirements need it
4. **Documentation:** Add tooltips or help text explaining how fees are calculated

