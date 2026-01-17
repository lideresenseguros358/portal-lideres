'use client';

/**
 * Lista de Transferencias Incluidas de Otros Cortes
 * Muestra transferencias que fueron incluidas desde otros cortes bancarios
 */

import { useState } from 'react';
import { FaSync, FaInfoCircle, FaTrash } from 'react-icons/fa';
import { actionRevertTransferInclusion } from '@/app/(app)/commissions/banco-actions';
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCutoffPeriod = (cutoff: { start_date: string; end_date: string }) => {
    return `${formatDate(cutoff.start_date)} - ${formatDate(cutoff.end_date)}`;
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

      {/* Transfers Grid */}
      <div className="p-3 sm:p-4 space-y-3">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-all hover:shadow-md">
            {/* Card Header - Monto y Acciones */}
            <div className="bg-gradient-to-r from-purple-50 to-white px-4 py-3 border-b border-purple-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl sm:text-2xl font-bold text-purple-900">
                  ${transfer.amount.toFixed(2)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(transfer.status)}
                  {getTypeBadge(transfer.transfer_type)}
                </div>
              </div>
              <button
                onClick={() => handleRevert(transfer.id)}
                disabled={reverting[transfer.id]}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold whitespace-nowrap"
                title="Revertir inclusión"
              >
                <FaTrash className="text-white" />
                <span className="hidden sm:inline">{reverting[transfer.id] ? 'Revirtiendo...' : 'Revertir'}</span>
              </button>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              {/* Corte Original - MUY DESTACADO */}
              {transfer.original_cutoff && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-900 font-bold text-xs uppercase tracking-wide">
                      📅 Corte Original
                    </span>
                  </div>
                  <p className="text-amber-800 font-bold text-base">
                    {formatCutoffPeriod(transfer.original_cutoff)}
                  </p>
                </div>
              )}

              {/* Información Principal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-0.5">Referencia</p>
                  <p className="text-gray-900 font-medium">{transfer.reference_number}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-0.5">Fecha</p>
                  <p className="text-gray-900 font-medium">{formatDate(transfer.date)}</p>
                </div>
              </div>

              {transfer.insurer_assigned && (
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                  <p className="text-xs text-blue-700 font-semibold mb-0.5">Aseguradora</p>
                  <p className="text-blue-900 font-bold">{transfer.insurer_assigned.name}</p>
                </div>
              )}

              {/* Descripción */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 font-semibold mb-1">Descripción</p>
                <p className="text-sm text-gray-800">{transfer.description_raw}</p>
              </div>

              {/* Notas Internas */}
              {transfer.notes_internal && (
                <div className="bg-yellow-50 rounded-lg p-2 border-l-4 border-yellow-400">
                  <p className="text-xs text-yellow-900 italic">{transfer.notes_internal}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
