'use client';

import { useState } from 'react';
import { FaEdit, FaCheckCircle, FaClock, FaCircle, FaLock, FaSave, FaTimes, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { actionUpdateBankTransfer } from '@/app/(app)/commissions/banco-actions';
import type { BankTransferStatus, TransferType } from '@/app/(app)/commissions/banco-actions';
import { toast } from 'sonner';

interface TransfersTableProps {
  transfers: any[];
  loading: boolean;
  insurers: { id: string; name: string }[];
  onRefresh: () => void;
}

export default function TransfersTable({ transfers, loading, insurers, onRefresh }: TransfersTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const getStatusBadge = (status: BankTransferStatus) => {
    const badges = {
      SIN_CLASIFICAR: { label: 'Sin clasificar', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: FaCircle },
      PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: FaClock },
      OK_CONCILIADO: { label: 'OK Conciliado', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: FaCheckCircle },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800 border-green-300', icon: FaLock },
    };
    const badge = badges[status] || badges.SIN_CLASIFICAR;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border-2 ${badge.color}`}>
        <Icon size={10} />
        {badge.label}
      </span>
    );
  };

  const getTypeBadge = (type: TransferType) => {
    const badges = {
      REPORTE: { label: 'Reporte', color: 'bg-blue-500 text-white' },
      BONO: { label: 'Bono', color: 'bg-purple-500 text-white' },
      OTRO: { label: 'Otro', color: 'bg-gray-500 text-white' },
      PENDIENTE: { label: 'Pendiente', color: 'bg-orange-500 text-white' },
    };
    const badge = badges[type] || badges.PENDIENTE;
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const handleEdit = (transfer: any) => {
    if (transfer.status === 'PAGADO') {
      toast.error('No se puede editar una transferencia PAGADA');
      return;
    }
    setEditingId(transfer.id);
    setEditData({
      insurerAssignedId: transfer.insurer_assigned_id || '',
      transferType: transfer.transfer_type || 'PENDIENTE',
      notesInternal: transfer.notes_internal || '',
    });
  };

  const handleSave = async (transferId: string) => {
    const result = await actionUpdateBankTransfer(transferId, editData);
    if (result.ok) {
      toast.success('Transferencia actualizada');
      setEditingId(null);
      onRefresh();
    } else {
      toast.error('Error al actualizar', { description: result.error });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
        <div className="p-12 text-center text-gray-500">
          <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
          Cargando transferencias...
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg mb-2">No hay transferencias en este corte</p>
          <p className="text-sm">Selecciona otro corte o importa uno nuevo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
      {/* Resumen Desktop */}
      <div className="hidden sm:flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-100">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-[#010139]">
            Transferencias Bancarias
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {transfers.length} transferencia{transfers.length !== 1 ? 's' : ''} encontrada{transfers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs sm:text-sm text-gray-600">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-[#8AAA19] font-mono">
            ${transfers.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Vista Desktop - Tabla */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fecha</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Referencia</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Descripción</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Aseguradora</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Monto</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Estado</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b hover:bg-gray-50 transition-colors">
                {editingId === transfer.id ? (
                  <>
                    {/* Modo edición */}
                    <td className="px-3 py-3 text-xs text-gray-700">{new Date(transfer.date).toLocaleDateString('es-PA')}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-700">{transfer.reference_number}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-gray-800 mb-1">{transfer.description_raw.substring(0, 50)}...</div>
                      <input
                        type="text"
                        placeholder="Notas internas..."
                        value={editData.notesInternal}
                        onChange={(e) => setEditData({ ...editData, notesInternal: e.target.value })}
                        className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg text-xs focus:border-[#8AAA19] focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={editData.insurerAssignedId}
                        onChange={(e) => setEditData({ ...editData, insurerAssignedId: e.target.value })}
                        className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg text-xs focus:border-[#8AAA19] focus:outline-none"
                      >
                        <option value="">Sin asignar</option>
                        {insurers.map(ins => (
                          <option key={ins.id} value={ins.id}>{ins.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={editData.transferType}
                        onChange={(e) => setEditData({ ...editData, transferType: e.target.value })}
                        className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg text-xs focus:border-[#8AAA19] focus:outline-none"
                      >
                        <option value="REPORTE">Reporte</option>
                        <option value="BONO">Bono</option>
                        <option value="OTRO">Otro</option>
                        <option value="PENDIENTE">Pendiente</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-[#8AAA19] font-mono text-sm">
                      ${transfer.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">{getStatusBadge(transfer.status)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleSave(transfer.id)}
                          className="p-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition"
                          title="Guardar"
                        >
                          <FaSave size={14} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                          title="Cancelar"
                        >
                          <FaTimes size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    {/* Modo vista */}
                    <td className="px-3 py-3 text-xs text-gray-700">{new Date(transfer.date).toLocaleDateString('es-PA')}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-700">{transfer.reference_number}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-gray-800">{transfer.description_raw.substring(0, 60)}{transfer.description_raw.length > 60 && '...'}</div>
                      {transfer.notes_internal && (
                        <div className="text-[11px] text-gray-500 mt-1">📝 {transfer.notes_internal}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      {transfer.insurers?.name || <span className="text-gray-400 italic">Sin asignar</span>}
                    </td>
                    <td className="px-3 py-3">{getTypeBadge(transfer.transfer_type)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#8AAA19] font-mono text-sm">
                      ${transfer.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">{getStatusBadge(transfer.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleEdit(transfer)}
                        disabled={transfer.status === 'PAGADO'}
                        className="p-2 text-[#010139] hover:bg-blue-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title={transfer.status === 'PAGADO' ? 'No se puede editar (PAGADO)' : 'Editar transferencia'}
                      >
                        <FaEdit size={16} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista Mobile/Tablet - Cards */}
      <div className="lg:hidden divide-y divide-gray-200">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(transfer.status)}
                  {getTypeBadge(transfer.transfer_type)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(transfer.date).toLocaleDateString('es-PA')} • Ref: {transfer.reference_number}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#8AAA19] font-mono">
                  ${transfer.amount.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-800 font-medium mb-2">
              {transfer.description_raw}
            </div>

            {transfer.notes_internal && (
              <div className="text-xs text-gray-500 mb-2">
                📝 {transfer.notes_internal}
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <div className="text-gray-600">
                {transfer.insurers?.name || <span className="italic">Sin asiguradora</span>}
              </div>
              <button
                onClick={() => handleEdit(transfer)}
                disabled={transfer.status === 'PAGADO'}
                className="px-3 py-1.5 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium"
              >
                {transfer.status === 'PAGADO' ? '🔒 Bloqueado' : 'Editar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen Footer */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{transfers.length}</span> transferencia{transfers.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Total:</span>
            <span className="text-lg sm:text-xl font-bold text-[#8AAA19] font-mono">
              ${transfers.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
