// ============================================================================
// types/domain.ts — Core Domain Models & Interface Contracts
// ============================================================================

export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLOSED';
export type ModifierAction = 'NO' | 'EXTRA' | 'OPTION' | 'SUBSTITUTE';
export type ModifierActionType = ModifierAction;
export type BillStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'SPLIT';

// ----------------------------------------------------------------------------
// RELATIONAL ENTITY MODELS
// ----------------------------------------------------------------------------

export interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: TableStatus;
  created_at: string;
  updated_at: string;
}

export interface TableSummary extends RestaurantTable {
  active_orders?: string[];
  active_orders_count?: number;
  total_unpaid_amount?: number;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Modifier {
  id: string;
  modifier_group_id?: string;
  name: string;
  price_delta: number;
  action_type: ModifierAction;
  is_available?: boolean;
  display_order?: number;
  created_at?: string;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  modifiers: Modifier[];
  created_at?: string;
}

export interface Product {
  id: string;
  category_id?: string;
  category?: string;
  name: string;
  description?: string;
  base_price: number;
  image_url?: string;
  is_available: boolean;
  modifier_groups: ModifierGroup[];
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithProducts extends Category {
  products: Product[];
}

export interface OrderItemModifierDetail {
  modifier_id: string;
  name: string;
  price_delta: number;
  action_type: ModifierAction;
}

export interface OrderItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status?: OrderStatus;
  modifiers: OrderItemModifierDetail[];
}

export interface OrderSummary {
  id: string;
  table_id: string;
  table_number?: number;
  idempotency_key: string;
  order_number: number;
  status: OrderStatus;
  total_amount: number;
  items: OrderItemDetail[];
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// REQUEST & RESPONSE DTOs
// ----------------------------------------------------------------------------

export interface OrderItemModifierInput {
  modifier_id: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  modifiers?: (OrderItemModifierInput | string)[];
  modifier_ids?: string[];
}

export interface CreateOrderRequest {
  table_id: string;
  idempotency_key: string; // UUID v4
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

export interface Bill {
  id: string;
  table_id: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  orders_count: number;
  orders?: OrderSummary[];
  status: BillStatus;
  payment_method?: PaymentMethod | null;
  paid_at?: string | null;
  created_at?: string;
}
