export const PRODUCT_CATEGORIES = [
  "Beverages",
  "Snacks",
  "Meals",
  "Desserts",
  "Groceries",
  "Household",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: ProductCategory;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}
