/**
 * Utility to track image refresh indices for products and variations
 * Stores the current image index to use when refreshing thumbnails
 */

const STORAGE_KEY = 'product_image_refresh_indices';

interface RefreshIndices {
  [key: string]: number; // productId or productId-variationId -> current image index
}

/**
 * Get the current image index for a product or variation
 */
export function getImageIndex(productId: string, variationId?: string): number {
  const key = variationId ? `${productId}-${variationId}` : productId;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return 0;
  
  try {
    const indices: RefreshIndices = JSON.parse(stored);
    return indices[key] || 0;
  } catch {
    return 0;
  }
}

/**
 * Increment and save the image index for a product or variation
 */
export function incrementImageIndex(productId: string, variationId?: string): number {
  const key = variationId ? `${productId}-${variationId}` : productId;
  const stored = localStorage.getItem(STORAGE_KEY);
  let indices: RefreshIndices = {};
  
  if (stored) {
    try {
      indices = JSON.parse(stored);
    } catch {
      indices = {};
    }
  }
  
  const currentIndex = indices[key] || 0;
  const newIndex = (currentIndex + 1) % 10; // Cycle through 0-9 (10 images)
  indices[key] = newIndex;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(indices));
  return newIndex;
}

/**
 * Reset the image index for a product or variation
 */
export function resetImageIndex(productId: string, variationId?: string): void {
  const key = variationId ? `${productId}-${variationId}` : productId;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;
  
  try {
    const indices: RefreshIndices = JSON.parse(stored);
    delete indices[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(indices));
  } catch {
    // Ignore errors
  }
}

