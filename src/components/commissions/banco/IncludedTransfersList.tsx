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

      {/* Transfers Table - Compacto */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-purple-50 border-b-2 border-purple-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Monto</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Ref</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Aseguradora</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Descripción</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-purple-900">Corte Original</th>
              <th className="px-3 py-2 text-center text-xs font-bold text-purple-900">Acción</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-purple-100 hover:bg-purple-50">
                <td className="px-3 py-2 font-mono font-bold text-purple-900">${transfer.amount.toFixed(2)}</td>
                <td className="px-3 py-2">{getStatusBadge(transfer.status)}</td>
                <td className="px-3 py-2 text-gray-700 text-xs">{formatDate(transfer.date)}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{transfer.reference_number}</td>
                <td className="px-3 py-2 text-sm font-semibold text-blue-900">
                  {transfer.insurer_assigned?.name || '-'}
                </td>
                <td className="px-3 py-2 text-sm text-gray-800 max-w-xs truncate" title={transfer.description_raw}>
                  {transfer.description_raw?.substring(0, 60) || 'Sin descripción'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {transfer.original_cutoff && (
                    <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded font-semibold">
                      {formatCutoffPeriod(transfer.original_cutoff)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleRevert(transfer.id)}
                    disabled={reverting[transfer.id]}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                    title="Revertir inclusión"
                  >
                    <FaTrash className="text-white text-xs" />
                    <span className="hidden lg:inline">{reverting[transfer.id] ? 'Revirtiendo...' : 'Revertir'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
