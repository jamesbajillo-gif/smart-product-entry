export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}
