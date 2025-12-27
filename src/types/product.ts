export const PRODUCT_CATEGORIES = [
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
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
  stock_quantity?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category?: ProductCategory | string; // Allow custom categories
  image_url?: string;
  stock_quantity?: number;
  low_stock_threshold?: number;
  skip_stock_tracking?: boolean;
  variations?: ProductVariation[]; // Price variations stored as JSON
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
  supplier?: string;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  created_at?: string;
}
