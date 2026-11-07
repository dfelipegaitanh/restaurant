'use client';

// ============================================================================
// app/caja/BillModal.tsx — Table Order Aggregation, Financial Math & Payment
// ============================================================================

import React, { useEffect, useRef, useState, useId } from 'react';
import { TableSummary, Bill, PaymentMethod } from '@/types/domain';
import { formatCurrency, formatClockTime } from '@/lib/utils/formatters';

interface BillModalProps {
  table: TableSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  onTableClosed: () => void;
}

export default function BillModal({
  table,
  isOpen,
  onClose,
  onPaymentSuccess,
  onTableClosed,
}: BillModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [bill, setBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tenderedAmountStr, setTenderedAmountStr] = useState<string>('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [isProcessingClose, setIsProcessingClose] = useState(false);

  // Tip toggle state (bill API already computes tip by default)
  const [includeTip, setIncludeTip] = useState(true);

  // Fetch bill details when modal opens
  useEffect(() => {
    if (!table || !isOpen) return;

    async function fetchBill() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/tables/${table!.id}/bill`);
        const data = await res.json();
        if (data.success && data.bill) {
          setBill(data.bill);
          setTenderedAmountStr(String(data.bill.total));
        } else {
          setErrorMessage(data.error || 'No se pudo obtener la cuenta.');
        }
      } catch (err: any) {
        console.error('[BillModal] Error loading bill:', err);
        setErrorMessage('Error de red al consultar la cuenta de la mesa.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBill();
  }, [table, isOpen]);

  // Manage native <dialog> lifecycle (showModal / close)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Light-dismiss fallback: handles outside pointer down & up to close backdrop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const isOutside = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    let pressedOutside = false;

    const handlePointerDown = (e: MouseEvent) => {
      pressedOutside = isOutside(e);
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (pressedOutside && isOutside(e)) {
        onClose();
      }
      pressedOutside = false;
    };

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('mousedown', handlePointerDown);
    dialog.addEventListener('mouseup', handlePointerUp);
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('mousedown', handlePointerDown);
      dialog.removeEventListener('mouseup', handlePointerUp);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  if (!table) return null;

  // Financial calculations
  const subtotal = bill?.subtotal || 0;
  const tax = bill?.tax || Math.round(subtotal * 0.08); // 8% Impoconsumo
  const tip = includeTip ? bill?.tip || Math.round(subtotal * 0.1) : 0; // 10% voluntary tip
  const grandTotal = subtotal + tax + tip;

  const tenderedAmount = parseFloat(tenderedAmountStr) || 0;
  const changeDue = paymentMethod === 'CASH' ? Math.max(0, tenderedAmount - grandTotal) : 0;
  const isCashInsufficient = paymentMethod === 'CASH' && tenderedAmount < grandTotal;

  // Process Payment
  const handleProcessPayment = async () => {
    if (!table || isProcessingPay || isCashInsufficient) return;
    setIsProcessingPay(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/tables/${table.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          tendered_amount: paymentMethod === 'CASH' ? tenderedAmount : grandTotal,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBill(data.bill);
        onPaymentSuccess();
      } else {
        setErrorMessage(data.error || 'Error al registrar el pago.');
      }
    } catch (err: any) {
      console.error('[BillModal] Network error paying bill:', err);
      setErrorMessage('Error de conexión al procesar el pago.');
    } finally {
      setIsProcessingPay(false);
    }
  };

  // Close Table & Release
  const handleCloseTable = async () => {
    if (!table || isProcessingClose) return;
    setIsProcessingClose(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/tables/${table.id}/close`, {
        method: 'POST',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onTableClosed();
        onClose();
      } else {
        setErrorMessage(data.error || 'Error al liberar la mesa.');
      }
    } catch (err: any) {
      console.error('[BillModal] Network error closing table:', err);
      setErrorMessage('Error de conexión al liberar la mesa.');
    } finally {
      setIsProcessingClose(false);
    }
  };

  const isPaid = bill?.status === 'PAID';

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby={titleId}
      className="m-auto bg-[#121216] text-neutral-200 rounded-2xl p-0 max-w-xl w-full border border-white/[0.08] shadow-2xl overflow-hidden"
      style={{
        overscrollBehavior: 'contain',
      }}
    >
      <div className="flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="p-6 border-b border-white/[0.06] flex items-center justify-between bg-[#121216]/95 backdrop-blur sticky top-0 z-10">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Liquidación</span>
            <h2 id={titleId} className="text-xl font-serif font-normal text-white">
              Cuenta — Mesa {table.table_number}
            </h2>
            <p className="text-xs font-mono text-neutral-500">
              {bill ? `${bill.orders_count} comandas acumuladas` : 'Cargando...'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de cuenta"
            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            ✕
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-neutral-400">
              <span className="animate-spin text-3xl">⏳</span>
              <p className="text-sm font-semibold">Consolidando cuenta de la mesa...</p>
            </div>
          ) : !bill || bill.orders_count === 0 ? (
            <div className="py-12 text-center text-neutral-500 space-y-2">
              <span className="text-4xl">🍽️</span>
              <p className="font-bold text-neutral-300">Esta mesa no tiene comandas activas</p>
              <p className="text-xs text-neutral-500">
                Aún no se han enviado pedidos a cocina desde esta mesa.
              </p>
            </div>
          ) : (
            <>
              {/* Itemized Order Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Detalle de Comandas
                </h3>

                <div className="space-y-3">
                  {bill.orders?.map((order) => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 pb-1.5 border-b border-neutral-800/60">
                        <span>Comanda #{order.order_number}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">
                          {order.status}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {order.items.map((item, iIdx) => (
                          <div
                            key={iIdx}
                            className="flex justify-between items-start text-sm py-0.5"
                          >
                            <div>
                              <span className="font-bold text-neutral-200">
                                {item.quantity}x {item.product_name}
                              </span>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <p className="text-xs text-neutral-400">
                                  {item.modifiers
                                    .map(
                                      (m) =>
                                        `${m.name}${
                                          m.price_delta > 0
                                            ? ` (+${formatCurrency(m.price_delta)})`
                                            : ''
                                        }`
                                    )
                                    .join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="font-semibold text-amber-300 ml-4 whitespace-nowrap">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                <div className="flex justify-between text-sm text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm text-neutral-400">
                  <span>Impuesto al Consumo (8%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>

                <div className="flex justify-between items-center text-sm text-neutral-400 pt-1 border-t border-neutral-900">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeTip}
                      onChange={(e) => setIncludeTip(e.target.checked)}
                      disabled={isPaid}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                    <span>Propina Sugerida Voluntaria (10%)</span>
                  </label>
                  <span>{formatCurrency(tip)}</span>
                </div>

                <div className="flex justify-between items-baseline text-lg font-black text-white pt-2 border-t border-neutral-800">
                  <span>Gran Total</span>
                  <span className="text-amber-400 text-xl font-extrabold">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Status Banner if Already Paid */}
              {isPaid ? (
                <div className="p-4 bg-emerald-950/70 border border-emerald-700/80 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-extrabold text-sm">
                    <span>✓</span>
                    <span>Cuenta Pagada con Éxito</span>
                  </div>
                  <div className="text-xs text-neutral-300 space-y-0.5">
                    <p>
                      Método de pago: <strong className="text-white">{bill.payment_method}</strong>
                    </p>
                    {bill.paid_at && (
                      <p>
                        Fecha y hora: {formatClockTime(bill.paid_at)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Payment Selection Section */
                <div className="space-y-4 pt-1 border-t border-neutral-800">
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Método de Pago
                  </h3>

                  {/* Payment Method Pills */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'CASH', label: 'Efectivo', icon: '💵' },
                      { key: 'CREDIT_CARD', label: 'Tarjeta', icon: '💳' },
                      { key: 'TRANSFER', label: 'Transferencia', icon: '📱' },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPaymentMethod(m.key as PaymentMethod)}
                        className={`min-h-[48px] p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                          paymentMethod === m.key
                            ? 'border-amber-400 bg-amber-400/10 text-white shadow'
                            : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="text-lg">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Cash Change Due Calculator */}
                  {paymentMethod === 'CASH' && (
                    <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-300 block mb-1">
                          Monto Recibido del Cliente (COP):
                        </label>
                        <input
                          type="number"
                          value={tenderedAmountStr}
                          onChange={(e) => setTenderedAmountStr(e.target.value)}
                          min={grandTotal}
                          step={1000}
                          className="w-full min-h-[48px] bg-neutral-900 border border-neutral-700 rounded-xl px-4 text-white font-bold text-lg focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Quick Tendered Amount Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTenderedAmountStr(String(grandTotal))}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-300 hover:bg-neutral-700 font-semibold"
                        >
                          Exacto ({formatCurrency(grandTotal)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTenderedAmountStr('50000')}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-300 hover:bg-neutral-700 font-semibold"
                        >
                          $ 50.000
                        </button>
                        <button
                          type="button"
                          onClick={() => setTenderedAmountStr('100000')}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 text-xs text-neutral-300 hover:bg-neutral-700 font-semibold"
                        >
                          $ 100.000
                        </button>
                      </div>

                      {/* Change Due Display */}
                      <div className="flex justify-between items-baseline pt-2 border-t border-neutral-800/80">
                        <span className="text-xs font-semibold text-neutral-400">
                          Devuelta / Cambio al Cliente:
                        </span>
                        <span
                          className={`text-lg font-black ${
                            isCashInsufficient ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {isCashInsufficient
                            ? 'Monto insuficiente'
                            : formatCurrency(changeDue)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/70 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="p-5 border-t border-neutral-800 bg-neutral-900 sticky bottom-0 z-10 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition text-sm"
          >
            Cerrar
          </button>

          {isPaid ? (
            <button
              type="button"
              onClick={handleCloseTable}
              disabled={isProcessingClose}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-sm flex items-center gap-2 transition active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              {isProcessingClose ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  <span>Liberando Mesa...</span>
                </>
              ) : (
                <>
                  <span>✓ Cerrar Mesa y Liberar</span>
                </>
              )}
            </button>
          ) : (
            bill &&
            bill.orders_count > 0 && (
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={isProcessingPay || isCashInsufficient}
                className={`min-h-[48px] px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition active:scale-95 ${
                  isProcessingPay || isCashInsufficient
                    ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed opacity-60'
                    : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-lg shadow-amber-500/20'
                }`}
              >
                {isProcessingPay ? (
                  <>
                    <span className="animate-spin text-base">⏳</span>
                    <span>Procesando Pago...</span>
                  </>
                ) : (
                  <>
                    <span>💳 Registrar Cobro</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            )
          )}
        </footer>
      </div>
    </dialog>
  );
}
