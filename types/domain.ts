// ============================================================================
// types/domain.ts — Fast-Casual Kiosk & KDS Domain Models
// ============================================================================

export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  category_id: string;
  category?: string;
  name: string;
  description?: string;
  base_price: number;
  image_url?: string;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithProducts extends Category {
  products: Product[];
}

export interface OrderItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status?: OrderStatus;
}

export interface OrderSummary {
  id: string;
  order_number: number; // Sequential ticket number (e.g. 101)
  idempotency_key: string;
  customer_name?: string | null;
  status: OrderStatus;
  total_amount: number;
  items: OrderItemDetail[];
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// REQUEST & RESPONSE DTOs
// ----------------------------------------------------------------------------

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateOrderRequest {
  idempotency_key: string; // UUID v4
  customer_name?: string;
  items: OrderItemInput[];
}

export interface CreateOrderResponse {
  success: boolean;
  order?: OrderSummary;
  replayed?: boolean;
  error?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}
