/**
 * Load Service Utility
 * Provides a reusable Load service/product for mobile load transactions
 */

import { Product } from "@/types/product";

/**
 * Get the Load as a standalone product
 * This can be manually added to cart or selected from search
 */
export function getLoadProduct(): Product {
  return {
    id: 'load-product',
    name: 'Load',
    price: 0, // Price is set dynamically based on load amount
    category: 'Service',
    skip_stock_tracking: true, // Load doesn't need stock tracking
  };
}

/**
 * Check if a product is a Load product
 */
export function isLoadProduct(product: Product): boolean {
  return product.id === 'load-product' || 
         product.name.toLowerCase().trim() === 'load';
}

/**
 * Calculate load transaction fee
 * - 5 if load amount is 100 and below
 * - 10 if load amount is 101 and above
 */
export function calculateLoadTransactionFee(loadAmount: number): number {
  if (loadAmount <= 100) {
    return 5;
  }
  return 10;
}

