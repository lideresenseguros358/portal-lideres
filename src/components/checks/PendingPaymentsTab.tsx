'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaCheckCircle, FaExclamationTriangle, FaFileDownload } from 'react-icons/fa';
import { actionGetPendingPaymentsNew, actionMarkPaymentsAsPaidNew } from '@/app/(app)/checks/actions';
import { toast } from 'sonner';

interface PendingPaymentsTabProps {
  onOpenWizard: () => void;
}

export default function PendingPaymentsTab({ onOpenWizard }: PendingPaymentsTabProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const loadPayments = async () => {
    setLoading(true);
    try {
      // Solo cargar pagos pendientes, los pagados se ven en historial banco
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
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payments.map(p => p.id)));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }

    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    const invalidPayments = selectedPayments.filter(p => !p.can_be_paid);

    if (invalidPayments.length > 0) {
      toast.error('Algunos pagos tienen referencias inválidas', {
        description: 'Actualiza el historial de banco primero'
      });
      return;
    }

    if (!confirm(`¿Marcar ${selectedIds.size} pago(s) como pagado(s)?`)) return;

    setLoading(true);
    try {
      console.log('Marcando pagos como pagados...');
      const result = await actionMarkPaymentsAsPaidNew(Array.from(selectedIds));
      console.log('Resultado:', result);
      
      if (result.ok) {
        toast.success(result.message + ' - Actualizando historial...');
        setSelectedIds(new Set());
        // Reload payments para ver la lista actualizada
        await loadPayments();
        // Nota: El historial de banco se actualiza automáticamente por el key en ChecksMainClient
      } else {
        toast.error('Error al marcar pagos', { description: result.error });
      }
    } catch (error: any) {
      console.error('Error en handleMarkAsPaid:', error);
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

    toast.info('Generación de PDF en desarrollo');
    // TODO: Implementar generación de PDF
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

      {/* Acciones */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#010139]">
              Pagos Pendientes ({payments.length})
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
          Cargando pagos...
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <p className="text-lg mb-2">No hay pagos pendientes</p>
          <p className="text-sm">Crea un nuevo pago para comenzar</p>
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
            {payments.map((payment) => (
              <div
                key={payment.id}
                className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all ${
                  selectedIds.has(payment.id)
                    ? 'border-[#8AAA19] shadow-xl'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                {/* Header con checkbox */}
                <div className="flex items-start gap-4 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(payment.id)}
                    onChange={() => toggleSelect(payment.id)}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-[#010139]">{payment.client_name}</h3>
                        {payment.policy_number && (
                          <p className="text-sm text-gray-600">Póliza: {payment.policy_number}</p>
                        )}
                        {payment.insurer_name && (
                          <p className="text-sm text-gray-600">{payment.insurer_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#8AAA19]">
                          ${parseFloat(payment.amount_to_pay).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">A pagar</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Referencias */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">Referencias:</h4>
                  {payment.payment_references?.map((ref: any) => (
                    <div
                      key={ref.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        ref.exists_in_bank ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {ref.exists_in_bank ? (
                          <FaCheckCircle className="text-green-600" />
                        ) : (
                          <FaExclamationTriangle className="text-red-600" />
                        )}
                        <span className="text-sm font-mono font-semibold">{ref.reference_number}</span>
                      </div>
                      <span className="text-sm font-semibold">${parseFloat(ref.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <div>
                    {payment.can_be_paid ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold border-2 border-green-300">
                        Listo para pagar
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold border-2 border-red-300">
                        Referencias inválidas
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
