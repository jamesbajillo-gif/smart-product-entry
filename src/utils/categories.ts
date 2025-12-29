import { categoriesApi, CategoryWithChildren } from "@/services/mysqlApi";

const CUSTOM_CATEGORIES_KEY = "pos-custom-categories";
const CATEGORIES_CACHE_KEY = "pos-categories-cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for categories to avoid repeated API calls
let categoriesCache: { data: string[]; timestamp: number } | null = null;

// Get all categories (from database, with localStorage fallback)
export async function getAllCategoriesAsync(): Promise<string[]> {
  try {
    const result = await categoriesApi.getFlatWithParents();
    if (result.success && result.data) {
      const categoryNames = result.data.map((cat) => cat.name);
      // Update cache
      categoriesCache = {
        data: categoryNames,
        timestamp: Date.now(),
      };
      localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(categoriesCache));
      return categoryNames.sort();
    }
  } catch (error) {
    console.error("Error fetching categories from database:", error);
  }
  
  // Fallback to cache or localStorage
  try {
    const cached = localStorage.getItem(CATEGORIES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.data || [];
      }
    }
  } catch {
    // Ignore cache errors
  }
  
  // Final fallback to default categories
  return getDefaultCategories();
}

// Get all categories (synchronous version - uses cache)
export function getAllCategories(): string[] {
  // Try cache first
  if (categoriesCache && Date.now() - categoriesCache.timestamp < CACHE_DURATION) {
    return categoriesCache.data;
  }
  
  // Try localStorage cache
  try {
    const cached = localStorage.getItem(CATEGORIES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION) {
        categoriesCache = parsed;
        return parsed.data || [];
      }
    }
  } catch {
    // Ignore cache errors
  }
  
  // Fallback to default categories
  return getDefaultCategories();
}

// Get default categories (fallback)
function getDefaultCategories(): string[] {
  return [
    "Beverages",
    "Snacks",
    "Meals",
    "Desserts",
    "Groceries",
    "Household",
    "Cigarettes",
    "candies-promo",
    "fruits",
    "toys",
    "Coffee",
    "Cup Noodle",
    "Other",
  ];
}

// Add a new custom category (legacy support - now handled by CategoryManagementDialog)
export function addCustomCategory(category: string): void {
  if (!category || !category.trim()) return;
  
  const trimmedCategory = category.trim();
  const defaultCategories = getDefaultCategories();
  
  // Don't add if it's already a default category
  if (defaultCategories.includes(trimmedCategory)) return;
  
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const customCategories: string[] = stored ? JSON.parse(stored) : [];
    
    // Don't add if it already exists
    if (!customCategories.includes(trimmedCategory)) {
      customCategories.push(trimmedCategory);
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
    }
  } catch (error) {
    console.error("Error adding custom category:", error);
  }
}

// Get only custom categories (legacy support)
export function getCustomCategories(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get hierarchical categories for display
export async function getHierarchicalCategories(): Promise<CategoryWithChildren[]> {
  try {
    const result = await categoriesApi.getHierarchical();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error("Error fetching hierarchical categories:", error);
  }
  return [];
}

// Get flat list of categories with parent info
export async function getFlatCategoriesWithParents(): Promise<CategoryWithChildren[]> {
  try {
    const result = await categoriesApi.getFlatWithParents();
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error("Error fetching flat categories:", error);
  }
  return [];
}

