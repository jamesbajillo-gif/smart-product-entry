import { feesApi, FeeRecord } from "@/services/mysqlApi";
import { OrderItem } from "@/types/product";

// Cache for fees
let feesCache: { data: FeeRecord[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all active fees from the database
 */
export async function getAllActiveFees(): Promise<FeeRecord[]> {
  try {
    // Check cache first
    if (feesCache && Date.now() - feesCache.timestamp < CACHE_DURATION) {
      return feesCache.data.filter(fee => Boolean(fee.is_active));
    }

    const result = await feesApi.getAll();
    if (result.success && result.data) {
      const activeFees = result.data.filter(fee => Boolean(fee.is_active));
      feesCache = {
        data: result.data,
        timestamp: Date.now(),
      };
      return activeFees;
    }
  } catch (error) {
    console.error("Error fetching fees:", error);
  }
  
  return [];
}

/**
 * Check if a fee applies to a product category
 */
function feeAppliesToCategory(fee: FeeRecord, category: string | undefined): boolean {
  // If categories is null, fee applies to all categories
  if (fee.categories === null || fee.categories === undefined) {
    return true;
  }
  
  // If categories is an array, check if the product category is in the list
  if (Array.isArray(fee.categories)) {
    return fee.categories.includes(category || '');
  }
  
  return false;
}

/**
 * Get applicable fees for cart items
 * Returns fees that match the categories of products in the cart
 */
export async function getApplicableFees(cartItems: OrderItem[]): Promise<FeeRecord[]> {
  const allFees = await getAllActiveFees();
  const applicableFees: FeeRecord[] = [];
  
  // Get unique categories from cart items
  const cartCategories = new Set<string>();
  cartItems.forEach(item => {
    const category = item.product.category || '';
    if (category) {
      cartCategories.add(category);
    }
  });
  
  // Check each fee to see if it applies to any cart category
  allFees.forEach(fee => {
    // If fee applies to all categories, include it
    if (fee.categories === null || fee.categories === undefined) {
      applicableFees.push(fee);
      return;
    }
    
    // If fee has specific categories, check if any cart category matches
    if (Array.isArray(fee.categories)) {
      const hasMatchingCategory = Array.from(cartCategories).some(category =>
        fee.categories!.includes(category)
      );
      if (hasMatchingCategory) {
        applicableFees.push(fee);
      }
    }
  });
  
  return applicableFees;
}

/**
 * Get products that match a fee's categories
 */
export function getProductsForFee(fee: FeeRecord, cartItems: OrderItem[]): OrderItem[] {
  // If fee applies to all categories, return all items
  if (fee.categories === null || fee.categories === undefined) {
    return cartItems;
  }
  
  // If fee has specific categories, return items that match
  if (Array.isArray(fee.categories)) {
    return cartItems.filter(item => {
      const category = item.product.category || '';
      return fee.categories!.includes(category);
    });
  }
  
  return [];
}

/**
 * Calculate fee amount (handles both fixed and percentage)
 * For per_item fees, this calculates the base fee amount per item
 * For per_transaction fees, this calculates the total fee for the transaction
 */
export function calculateFeeAmount(fee: FeeRecord, subtotal: number, matchingItemsCount: number = 1): number {
  const calculationType = fee.calculation_type || 'per_transaction';
  const baseAmount = Boolean(fee.is_percentage)
    ? (subtotal * Number(fee.amount || 0)) / 100  // Percentage fee
    : Number(fee.amount || 0);  // Fixed amount fee

  if (calculationType === 'per_item') {
    // Per item: multiply by number of matching items
    return baseAmount * matchingItemsCount;
  } else {
    // Per transaction: apply once regardless of items
    return baseAmount;
  }
}

/**
 * Calculate total fees for cart items
 */
export async function calculateTotalFees(cartItems: OrderItem[]): Promise<number> {
  const applicableFees = await getApplicableFees(cartItems);
  
  // Calculate subtotal
  const subtotal = cartItems.reduce((sum, item) => {
    const productTotal = item.product.price * item.quantity;
    const servicesTotal = (item.selectedServices || []).reduce(
      (serviceSum, service) => serviceSum + service.price * item.quantity,
      0
    );
    return sum + productTotal + servicesTotal;
  }, 0);
  
  // Calculate total fees
  let totalFees = 0;
  applicableFees.forEach(fee => {
    totalFees += calculateFeeAmount(fee, subtotal);
  });
  
  return totalFees;
}

/**
 * Clear fees cache (call this when fees are updated)
 */
export function clearFeesCache(): void {
  feesCache = null;
}

