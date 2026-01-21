'use client';

/**
 * Lista de Transferencias Incluidas de Otros Cortes
 * Muestra transferencias que fueron incluidas desde otros cortes bancarios
 */

import { useState } from 'react';
import { FaSync, FaInfoCircle, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { formatDateLocal } from '@/lib/banco/dateHelpers';
import { actionRevertTransferInclusion, actionMarkTransfersAsPaid } from '@/app/(app)/commissions/banco-actions';
import { toast } from 'sonner';

interface IncludedTransfer {
  id: string;
  reference_number: string;
  date: string;
  amount: number;
  description_raw: string;
  status: string | null;
  transfer_type: string | null;
  notes_internal: string | null;
  insurer_assigned: { id: string; name: string } | null;
  original_cutoff: { id: string; start_date: string; end_date: string } | null;
  created_at: string;
  updated_at: string | null;
}

interface IncludedTransfersListProps {
  transfers: IncludedTransfer[];
  onRefresh: () => void;
}

export default function IncludedTransfersList({ transfers, onRefresh }: IncludedTransfersListProps) {
  const [reverting, setReverting] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  const handleRevert = async (transferId: string) => {
    if (!confirm('¿Está seguro de que desea revertir la inclusión de esta transferencia?\n\nLa transferencia volverá a estado PENDIENTE y se eliminará de este corte.')) {
      return;
    }

    setReverting({ ...reverting, [transferId]: true });

    try {
      const result = await actionRevertTransferInclusion(transferId);
      
      if (result.ok) {
        toast.success('Inclusión revertida exitosamente');
        onRefresh();
      } else {
        toast.error('Error al revertir inclusión', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setReverting({ ...reverting, [transferId]: false });
    }
  };

  const handleMarkAsPaid = async (transferId: string) => {
    if (!confirm('¿Está seguro de que desea marcar esta transferencia como PAGADA?\n\nEsto actualizará el estado en el corte original.')) {
      return;
    }

    setMarking({ ...marking, [transferId]: true });

    try {
      const today = new Date().toISOString().split('T')[0] as string;
      const result = await actionMarkTransfersAsPaid([transferId], today, 'Marcado desde transferencias incluidas');
      
      if (result.ok) {
        toast.success('Transferencia marcada como PAGADA exitosamente');
        onRefresh();
      } else {
        toast.error('Error al marcar como pagada', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setMarking({ ...marking, [transferId]: false });
    }
  };

  const formatCutoffPeriod = (cutoff: { start_date: string; end_date: string }) => {
    return `${formatDateLocal(cutoff.start_date)} - ${formatDateLocal(cutoff.end_date)}`;
  };

  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'PENDIENTE': { label: '⏳ PENDIENTE', color: 'bg-yellow-100 text-yellow-800' },
      'REPORTADO': { label: '📋 REPORTADO', color: 'bg-blue-100 text-blue-800' },
      'PAGADO': { label: '✅ PAGADO', color: 'bg-green-100 text-green-800' },
    };

    const statusInfo = status ? statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' } : { label: 'SIN STATUS', color: 'bg-gray-100 text-gray-600' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getTypeBadge = (type: string | null) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      'REPORTE': { label: 'REPORTE', color: 'bg-purple-100 text-purple-800' },
      'BONO': { label: 'BONO', color: 'bg-indigo-100 text-indigo-800' },
      'PENDIENTE': { label: 'PENDIENTE', color: 'bg-orange-100 text-orange-800' },
      'OTRO': { label: 'OTRO', color: 'bg-gray-100 text-gray-800' },
    };

    const typeInfo = type ? typeMap[type] || { label: type, color: 'bg-gray-100 text-gray-800' } : { label: 'SIN TIPO', color: 'bg-gray-100 text-gray-600' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
        {typeInfo.label}
      </span>
    );
  };

  if (transfers.length === 0) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <FaInfoCircle className="mx-auto text-5xl text-purple-300 mb-3" />
        <p className="text-gray-600 font-semibold text-base">No hay transferencias incluidas</p>
        <p className="text-gray-500 text-sm mt-1">Las transferencias que incluyas aparecerán aquí</p>
      </div>
    );
  }

  const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      {/* Header con stats */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-t-xl px-4 sm:px-6 py-4 border-b-2 border-purple-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-purple-700 font-semibold mb-1">
              {transfers.length} transferencia{transfers.length !== 1 ? 's' : ''} incluida{transfers.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-purple-600">
              Importadas desde otros períodos bancarios
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border-2 border-purple-300">
            <p className="text-xs text-purple-700 font-semibold uppercase">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-900">${totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Vista Desktop - Tabla */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-purple-50 border-b-2 border-purple-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Monto</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900 hidden lg:table-cell">Ref</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Aseguradora</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Descripción</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900 hidden lg:table-cell">Corte Original</th>
              <th className="px-3 py-2 text-center text-xs font-bold text-purple-900">Acción</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-purple-100 hover:bg-purple-50">
                <td className="px-3 py-2 font-mono font-bold text-purple-900">${transfer.amount.toFixed(2)}</td>
                <td className="px-3 py-2">{getStatusBadge(transfer.status)}</td>
                <td className="px-3 py-2 text-gray-700 text-xs">{formatDateLocal(transfer.date)}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 hidden lg:table-cell">{transfer.reference_number}</td>
                <td className="px-3 py-2 text-sm font-semibold text-blue-900">
                  {transfer.insurer_assigned?.name || '-'}
                </td>
                <td className="px-3 py-2 text-sm text-gray-800 max-w-xs truncate" title={transfer.description_raw}>
                  {transfer.description_raw?.substring(0, 60) || 'Sin descripción'}
                </td>
                <td className="px-3 py-2 text-xs hidden lg:table-cell">
                  {transfer.original_cutoff && (
                    <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-semibold">
                      {formatCutoffPeriod(transfer.original_cutoff)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {transfer.status !== 'PAGADO' ? (
                      <>
                        <button
                          onClick={() => handleMarkAsPaid(transfer.id)}
                          disabled={marking[transfer.id]}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                          title="Confirmar Pagado"
                        >
                          <FaCheckCircle className="text-white text-xs" />
                          <span className="hidden lg:inline">{marking[transfer.id] ? 'Marcando...' : 'Pagado'}</span>
                        </button>
                        <button
                          onClick={() => handleRevert(transfer.id)}
                          disabled={reverting[transfer.id]}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                          title="Revertir inclusión"
                        >
                          <FaTrash className="text-white text-xs" />
                          <span className="hidden lg:inline">{reverting[transfer.id] ? 'Revirtiendo...' : 'Revertir'}</span>
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-500 rounded text-xs font-semibold" title="Transferencia pagada - Sin acciones disponibles">
                        🔒 Bloqueado
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista Mobile - Cards */}
      <div className="md:hidden space-y-3 p-3">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 shadow-sm">
            {/* Header con monto y estado */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <p className="text-lg font-bold text-purple-900 font-mono mb-1">
                  ${transfer.amount.toFixed(2)}
                </p>
                {getStatusBadge(transfer.status)}
              </div>
              {transfer.original_cutoff && (
                <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded text-xs font-semibold ml-2">
                  📅 {formatCutoffPeriod(transfer.original_cutoff)}
                </span>
              )}
            </div>

            {/* Aseguradora */}
            <div className="mb-2">
              <p className="text-xs text-purple-700 font-semibold mb-0.5">Aseguradora</p>
              <p className="text-sm font-bold text-blue-900">
                {transfer.insurer_assigned?.name || '-'}
              </p>
            </div>

            {/* Descripción */}
            <div className="mb-2">
              <p className="text-xs text-gray-700 leading-tight">
                {transfer.description_raw?.substring(0, 80) || 'Sin descripción'}
                {transfer.description_raw && transfer.description_raw.length > 80 && '...'}
              </p>
            </div>

            {/* Fecha y Ref */}
            <div className="flex items-center gap-3 mb-3 text-xs text-gray-600">
              <span>📅 {formatDateLocal(transfer.date)}</span>
              <span className="font-mono">#{transfer.reference_number}</span>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              {transfer.status !== 'PAGADO' ? (
                <>
                  <button
                    onClick={() => handleMarkAsPaid(transfer.id)}
                    disabled={marking[transfer.id]}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    <FaCheckCircle className="text-white" />
                    {marking[transfer.id] ? 'Marcando...' : 'Marcar Pagado'}
                  </button>
                  <button
                    onClick={() => handleRevert(transfer.id)}
                    disabled={reverting[transfer.id]}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    <FaTrash className="text-white" />
                    {reverting[transfer.id] ? 'Revirtiendo...' : 'Revertir'}
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs font-semibold">
                  🔒 Transferencia Bloqueada (PAGADA)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
