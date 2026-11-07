// ============================================================================
// types/events.ts — Realtime Event discriminated unions for SSE and EventHub
// ============================================================================

import { OrderStatus, TableStatus, OrderSummary } from './domain';

export type RealtimeEvent =
  | {
      type: 'ORDER_CREATED';
      payload: {
        order: OrderSummary;
      };
    }
  | {
      type: 'ORDER_STATUS_CHANGED';
      payload: {
        order_id: string;
        table_id: string;
        old_status: OrderStatus;
        new_status: OrderStatus;
        updated_at?: string;
      };
    }
  | {
      type: 'TABLE_STATUS_CHANGED';
      payload: {
        table_id: string;
        status: TableStatus;
      };
    }
  | {
      type: 'PAYMENT_COMPLETED';
      payload: {
        table_id: string;
        bill_id: string;
        amount: number;
      };
    };
