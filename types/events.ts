// ============================================================================
// types/events.ts — Realtime Event Discriminated Unions for KDS & Kiosk
// ============================================================================

import { OrderStatus, OrderSummary } from './domain';

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
        order_number?: number;
        old_status: OrderStatus;
        new_status: OrderStatus;
        updated_at?: string;
      };
    };
