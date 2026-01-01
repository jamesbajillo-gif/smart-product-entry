/**
 * Optimized variation parser with caching
 * Uses WeakMap for automatic garbage collection
 */

import { Product, ProductVariation } from "@/types/product";

// WeakMap allows automatic cleanup when products are garbage collected
const variationCache = new WeakMap<Product, ProductVariation[]>();

/**
 * Parse product variations with caching
 * @param product - Product to parse variations from
 * @returns Array of parsed variations
 */
export function parseVariations(product: Product): ProductVariation[] {
  // Check cache first
  if (variationCache.has(product)) {
    return variationCache.get(product)!;
  }

  const variations = product.variations || [];
  let parsed: ProductVariation[] = [];

  if (Array.isArray(variations)) {
    // Already an array, validate and use directly
    parsed = variations.filter(
      (v): v is ProductVariation =>
        v != null &&
        typeof v === 'object' &&
        typeof v.price === 'number'
    );
  } else if (typeof variations === 'string') {
    // Parse JSON string
    try {
      const parsedJson = JSON.parse(variations);
      if (Array.isArray(parsedJson)) {
        parsed = parsedJson.filter(
          (v): v is ProductVariation =>
            v != null &&
            typeof v === 'object' &&
            typeof v.price === 'number'
        );
      }
    } catch {
      // Invalid JSON, return empty array
      parsed = [];
    }
  }

  // Cache the result
  variationCache.set(product, parsed);
  return parsed;
}

/**
 * Clear variation cache (useful for testing or forced refresh)
 * Note: WeakMap doesn't support clearing, but individual entries
 * will be garbage collected when products are no longer referenced
 */
export function clearVariationCache() {
  // WeakMap doesn't support clear(), but we can document that
  // entries are automatically cleaned up by GC
  // This function exists for API consistency
}

