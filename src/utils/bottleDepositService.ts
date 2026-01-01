/**
 * Bottle Deposit Service Utility
 * Provides a reusable Bottle Deposit service/product that can be:
 * 1. Added as a service to products (especially beverages)
 * 2. Manually added to cart as a standalone item
 */

import { Product, ProductService } from "@/types/product";

// Default bottle deposit price (can be configured)
const DEFAULT_BOTTLE_DEPOSIT_PRICE = 10.00;

/**
 * Get the Bottle Deposit service
 * This can be attached to products or used standalone
 */
export function getBottleDepositService(price: number = DEFAULT_BOTTLE_DEPOSIT_PRICE): ProductService {
  return {
    id: 'bottle-deposit-service',
    name: 'Bottle Deposit',
    price: price,
  };
}

/**
 * Get the Bottle Deposit as a standalone product
 * This can be manually added to cart
 */
export function getBottleDepositProduct(price: number = DEFAULT_BOTTLE_DEPOSIT_PRICE): Product {
  return {
    id: 'bottle-deposit-product',
    name: 'Bottle Deposit',
    price: price,
    category: 'Other',
    skip_stock_tracking: true, // Bottle deposits don't need stock tracking
  };
}

/**
 * Check if a product is a Bottle Deposit product
 */
export function isBottleDepositProduct(product: Product): boolean {
  return product.id === 'bottle-deposit-product' || 
         product.name.toLowerCase().trim() === 'bottle deposit';
}

/**
 * Check if a service is a Bottle Deposit service
 */
export function isBottleDepositService(service: ProductService): boolean {
  return service.id === 'bottle-deposit-service' || 
         service.name.toLowerCase().trim() === 'bottle deposit';
}

