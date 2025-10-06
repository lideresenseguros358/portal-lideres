'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaCheckCircle, FaExclamationTriangle, FaFileDownload, FaEdit, FaTrash } from 'react-icons/fa';
import { actionGetPendingPaymentsNew, actionMarkPaymentsAsPaidNew, actionDeletePendingPayment } from '@/app/(app)/checks/actions';
import { toast } from 'sonner';

interface PendingPaymentsTabProps {
  onOpenWizard: () => void;
  onPaymentPaid?: () => void;
}

export default function PendingPaymentsTab({ onOpenWizard, onPaymentPaid }: PendingPaymentsTabProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const loadPayments = async () => {
    setLoading(true);
    try {
      const result = await actionGetPendingPaymentsNew({ status: 'pending' });
      if (result.ok) {
        setPayments(result.data || []);
      } else {
        toast.error('Error al cargar pagos');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const toggleSelect = (id: string) => {
    const payment = payments.find((p) => p.id === id);
    if (payment) {
      const state = getPaymentState(payment);
      if (state.blocked) {
        toast.error('Este pago está bloqueado hasta conciliar la referencia bancaria.');
        return;
      }
    }

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const selectable = payments.filter((p) => !getPaymentState(p).blocked).map((p) => p.id);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }

    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    const invalidPayments = selectedPayments.filter((p) => {
      const state = getPaymentState(p);
      return state.blocked;
    });

    if (invalidPayments.length > 0) {
      toast.error('Algunos pagos están bloqueados', {
        description: 'Verifica las referencias o reprograma el pago antes de continuar.'
      });
      return;
    }

    if (!confirm(`¿Marcar ${selectedIds.size} pago(s) como pagado(s)?`)) return;

    setLoading(true);
    try {
      const result = await actionMarkPaymentsAsPaidNew(Array.from(selectedIds));
      
      if (result.ok) {
        toast.success(result.message);
        setSelectedIds(new Set());
        await loadPayments();
        // Notificar al padre para refrescar historial de banco
        if (onPaymentPaid) {
          onPaymentPaid();
        }
      } else {
        toast.error('Error al marcar pagos', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }

    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    
    // Crear HTML para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Permite ventanas emergentes para descargar el PDF');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pagos Pendientes - ${new Date().toLocaleDateString('es-PA')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #010139;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #010139;
            margin: 0;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #010139;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 12px;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
            font-size: 11px;
          }
          tr:nth-child(even) {
            background: #f9f9f9;
          }
          .amount {
            font-weight: bold;
            color: #8AAA19;
            text-align: right;
          }
          .total {
            margin-top: 20px;
            text-align: right;
            font-size: 14px;
          }
          .total strong {
            color: #010139;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #999;
            font-size: 10px;
          }
          @media print {
            body { margin: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAGOS PENDIENTES</h1>
          <p>Portal Líderes en Seguros</p>
          <p>Fecha: ${new Date().toLocaleDateString('es-PA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Póliza</th>
              <th>Aseguradora</th>
              <th>Propósito</th>
              <th>Referencias</th>
              <th style="text-align: right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${selectedPayments.map(payment => `
              <tr>
                <td>${payment.client_name}</td>
                <td>${payment.policy_number || '—'}</td>
                <td>${payment.insurer_name || '—'}</td>
                <td>${payment.purpose}</td>
                <td>
                  ${payment.payment_references?.map((ref: any) => 
                    ref.reference_number
                  ).join(', ') || '—'}
                </td>
                <td class="amount">$${parseFloat(payment.amount_to_pay).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          <strong>TOTAL: $${selectedPayments.reduce((sum, p) => 
            sum + parseFloat(p.amount_to_pay), 0
          ).toFixed(2)}</strong>
        </div>

        <div class="footer">
          <p>Generado el ${new Date().toLocaleString('es-PA')}</p>
          <p>Portal Líderes en Seguros - Gestión de Pagos</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    toast.success('Documento preparado para imprimir/guardar como PDF');
  };

  const handleEdit = (paymentId: string) => {
    toast.info('Edición de pago pendiente en desarrollo');
    // TODO: Abrir modal con formulario prellenado
  };

  const handleDelete = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (!confirm(`¿Eliminar el pago pendiente de "${payment.client_name}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await actionDeletePendingPayment(paymentId);
      
      if (result.ok) {
        toast.success(result.message);
        await loadPayments();
      } else {
        toast.error('Error al eliminar pago', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error al eliminar pago', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Pagos Pendientes</h2>
          <p className="text-gray-600">Gestión de pagos por procesar</p>
        </div>

        <button
          onClick={onOpenWizard}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium"
        >
          <FaPlus />
          Nuevo Pago
        </button>
      </div>

      {/* Resumen */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-amber-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Pagos Pendientes</h3>
            <p className="text-3xl font-bold text-[#010139]">{payments.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#8AAA19]">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total a Pagar</h3>
            <p className="text-3xl font-bold text-[#8AAA19] font-mono">
              ${payments.reduce((sum, p) => sum + Number(p.amount_to_pay || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total Recibido</h3>
            <p className="text-3xl font-bold text-blue-600 font-mono">
              ${payments.reduce((sum, p) => sum + Number(p.total_received || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#010139]">
              Listado de Pagos ({payments.length})
            </h3>
            <p className="text-sm text-gray-600">
              Los pagos procesados se ven en el historial del banco
            </p>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
              >
                <FaFileDownload />
                Descargar PDF ({selectedIds.size})
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
              >
                <FaCheckCircle />
                Marcar como Pagados ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid de Pagos */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="font-medium">Cargando pagos...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="mb-4">
            <FaCheckCircle className="w-16 h-16 mx-auto text-gray-300" />
          </div>
          <p className="text-lg font-semibold mb-2">No hay pagos pendientes</p>
          <p className="text-sm mb-4">Todos los pagos han sido procesados</p>
          <button
            onClick={onOpenWizard}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium"
          >
            <FaPlus />
            Crear Nuevo Pago
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.length > 0 && (
            <div className="flex items-center gap-2 px-4">
              <input
                type="checkbox"
                checked={selectedIds.size === payments.length && payments.length > 0}
                onChange={selectAll}
                className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
              />
              <span className="text-sm font-medium text-gray-700">Seleccionar todos</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {payments.map((payment) => {
            const paymentState = getPaymentState(payment);
            return (
              <div
                key={payment.id}
                className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all ${
                  selectedIds.has(payment.id)
                    ? 'border-[#8AAA19] shadow-xl'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                {/* Header con checkbox y acciones */}
                <div className="flex items-start gap-4 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(payment.id)}
                    onChange={() => toggleSelect(payment.id)}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-[#010139]">{payment.client_name}</h3>
                        {payment.policy_number && (
                          <p className="text-sm text-gray-600">Póliza: {payment.policy_number}</p>
                        )}
                        {payment.insurer_name && (
                          <p className="text-sm text-gray-600">{payment.insurer_name}</p>
                        )}
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#8AAA19]">
                            ${parseFloat(payment.amount_to_pay).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">A pagar</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(payment.id);
                            }}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar pago"
                          >
                            <FaEdit size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(payment.id);
                            }}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar pago"
                          >
                            <FaTrash size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Referencias */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">Referencias:</h4>
                  {payment.payment_references?.map((ref: any) => {
                    const refClass = ref.exists_in_bank
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200';

                    return (
                      <div
                        key={ref.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${refClass}`}
                      >
                        <div className="flex items-center gap-2">
                          {ref.exists_in_bank ? (
                            <FaCheckCircle className="text-green-600" />
                          ) : (
                            <FaExclamationTriangle className="text-red-600" />
                          )}
                          <span className="text-sm font-mono font-semibold">{ref.reference_number}</span>
                        </div>
                        <span className="text-sm font-semibold">
                          ${Number(ref.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <StatusBadge payment={payment} />
                    {payment.metadata?.advance_id && (
                      <span className="ml-2 px-2 py-0.5 bg-[#8AAA19]/10 text-[#8AAA19] border border-[#8AAA19]/40 rounded-full text-xs font-semibold">
                        Adelanto externo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(payment.created_at).toLocaleDateString('es-PA')}
                  </div>
                </div>

                {/* Total recibido */}
                {payment.total_received > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total recibido:</span>
                      <span className="font-semibold">${parseFloat(payment.total_received).toFixed(2)}</span>
                    </div>
                    {payment.total_received > payment.amount_to_pay && (
                      <div className="flex justify-between text-sm text-amber-600 mt-1">
                        <span>Remanente:</span>
                        <span className="font-semibold">
                          ${(parseFloat(payment.total_received) - parseFloat(payment.amount_to_pay)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ payment }: { payment: any }) {
  const state = getPaymentState(payment);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${state.badgeClass}`}>
      {state.label}
    </span>
  );
}

function getPaymentState(payment: any) {
  const now = new Date();
  const created = new Date(payment.created_at);
  const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const total = Number(payment.amount_to_pay ?? payment.amount ?? 0);
  const applied = Number(payment.total_received ?? 0);
  const remaining = Math.max(total - applied, 0);

  const hasErrors = payment.payment_references?.some((ref: any) => !ref.exists_in_bank);
  if (hasErrors || !payment.can_be_paid) {
    return {
      key: 'blocked',
      label: 'Referencia no conciliada',
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
      blocked: true,
    } as const;
  }

  if (payment.defer_until && new Date(payment.defer_until) > now) {
    return {
      key: 'deferred',
      label: 'Aplazado',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      blocked: true,
    } as const;
  }

  if (remaining <= 0) {
    return {
      key: 'conciled',
      label: 'Conciliado',
      badgeClass: 'bg-green-100 text-green-800 border-green-300',
      blocked: false,
    } as const;
  }

  if (daysDiff > 30) {
    return {
      key: 'overdue',
      label: 'Vencido (+30d)',
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
      blocked: true,
    } as const;
  }

  if (daysDiff > 15) {
    return {
      key: 'aged',
      label: 'Sin clasificar 15-30d',
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blocked: false,
    } as const;
  }

  return {
    key: 'pending',
    label: 'Pendiente por conciliar',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
    blocked: false,
  } as const;
}
