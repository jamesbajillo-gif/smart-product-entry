const CUSTOM_CATEGORIES_KEY = "pos-custom-categories";

// Get all categories (default + custom)
export function getAllCategories(): string[] {
  const defaultCategories = [
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
  
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const customCategories = stored ? JSON.parse(stored) : [];
    
    // Combine and remove duplicates
    const allCategories = [...defaultCategories, ...customCategories];
    return Array.from(new Set(allCategories)).sort();
  } catch {
    return defaultCategories;
  }
}

// Add a new custom category
export function addCustomCategory(category: string): void {
  if (!category || !category.trim()) return;
  
  const trimmedCategory = category.trim();
  const defaultCategories = [
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

// Get only custom categories
export function getCustomCategories(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

