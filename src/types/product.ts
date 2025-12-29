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
  "Coffee",
  "Cup Noodle",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductSupplier {
  id: string;
  name: string;
  price_per_piece?: number;
  price_per_pack?: number;
}

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
  stock_quantity?: number;
  suppliers?: ProductSupplier[];
}

export interface ProductService {
  id: string;
  name: string;
  price: number;
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
  suppliers?: ProductSupplier[];
  services?: ProductService[]; // Optional services/add-ons (e.g., "Hot Water" for cup noodles, "Timpla" for coffee)
}

export interface OrderItem {
  product: Product;
  quantity: number;
  selectedServices?: ProductService[]; // Services selected for this order item
  customTotal?: number; // Manual override for total price of this item
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
