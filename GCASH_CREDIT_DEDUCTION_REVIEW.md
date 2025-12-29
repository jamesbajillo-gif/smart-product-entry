# GCash Credit Deduction Logic Review

## User Requirement

**Scenario:**
- Amount to be sent: ₱100
- Customer gets: ₱90 cash (OR)
- GCash credits should receive: ₱100
- Transaction is considered: ₱100

## Current Logic Analysis

### Current GCASH-IN Flow (useGCashFunds.ts)

```typescript
processGCashIn(amount: 100, serviceCharge: 10)
```

**Current Behavior:**
- Customer pays cash: ₱110 (amount + serviceCharge)
- Customer receives GCash: ₱100
- GCash Credits deducted: ₱100
- GCash Cash added: ₱110

**Issue:** Customer pays ₱110 but only receives ₱100 in GCash credits.

## Expected Behavior

Based on user requirement, there are two possible interpretations:

### Option 1: Customer pays amount, receives amount (service charge separate)
- Amount to send: ₱100
- Customer pays cash: ₱100
- Customer receives GCash: ₱100
- Service charge: ₱10 (separate, added to cash or deducted from credits)
- GCash Credits deducted: ₱100
- GCash Cash added: ₱100 (or ₱110 if service charge is cash)

### Option 2: Customer pays amount + service charge, receives amount - service charge
- Amount to send: ₱100
- Customer pays cash: ₱100
- Customer receives GCash: ₱90 (amount - service charge)
- Service charge: ₱10 (deducted from amount sent)
- GCash Credits deducted: ₱90
- GCash Cash added: ₱100

## Recommended Fix

Based on the user's description "the amount that will be sent is 100, the customer gets 90 cash, or gcash credits should received 100, transaction is considered 100", I believe:

**Correct Logic:**
- Transaction amount: ₱100 (what we send to customer's GCash)
- Customer pays cash: ₱100
- Customer receives GCash: ₱100
- Service charge: ₱10 (separate revenue, added to cash)
- GCash Credits deducted: ₱100 (the amount sent)
- GCash Cash added: ₱110 (₱100 from customer + ₱10 service charge)

This means:
- The `amount` parameter should be what the customer receives in GCash
- The customer pays `amount` in cash
- Service charge is additional revenue (added to cash)
- GCash Credits are deducted by `amount` (what we send)

