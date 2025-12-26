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
  image_url?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface StockAdjustment {
  id?: number;
  product_id: string;
  adjustment_type: 'add' | 'remove' | 'set' | 'sale';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  created_at?: string;
}
