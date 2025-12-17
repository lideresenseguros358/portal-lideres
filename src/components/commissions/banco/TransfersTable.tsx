'use client';

import { useState } from 'react';
import { FaEdit, FaCheckCircle, FaClock, FaCircle, FaLock } from 'react-icons/fa';
import { Card } from '@/components/ui/card';
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
      <Card className="bg-white shadow-lg border-2 border-gray-200 p-8 text-center">
        <p className="text-gray-600">Cargando transferencias...</p>
      </Card>
    );
  }

  if (transfers.length === 0) {
    return (
      <Card className="bg-white shadow-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-600">No se encontraron transferencias</p>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-lg border-2 border-gray-200">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-bold text-lg text-[#010139]">
          Transferencias Bancarias ({transfers.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Aseguradora</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b hover:bg-gray-50">
                {editingId === transfer.id ? (
                  <>
                    {/* Modo edición */}
                    <td className="px-4 py-3 text-xs">{new Date(transfer.date).toLocaleDateString('es-PA')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{transfer.reference_number}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{transfer.description_raw}</div>
                      <input
                        type="text"
                        placeholder="Notas internas..."
                        value={editData.notesInternal}
                        onChange={(e) => setEditData({ ...editData, notesInternal: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border rounded text-xs"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editData.insurerAssignedId}
                        onChange={(e) => setEditData({ ...editData, insurerAssignedId: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-xs"
                      >
                        <option value="">Sin asignar</option>
                        {insurers.map(ins => (
                          <option key={ins.id} value={ins.id}>{ins.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editData.transferType}
                        onChange={(e) => setEditData({ ...editData, transferType: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-xs"
                      >
                        <option value="REPORTE">Reporte</option>
                        <option value="BONO">Bono</option>
                        <option value="OTRO">Otro</option>
                        <option value="PENDIENTE">Pendiente</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#8AAA19]">
                      ${transfer.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(transfer.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleSave(transfer.id)}
                          className="px-3 py-1 bg-[#8AAA19] text-white rounded hover:bg-[#010139] transition text-xs"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    {/* Modo vista */}
                    <td className="px-4 py-3 text-xs">{new Date(transfer.date).toLocaleDateString('es-PA')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{transfer.reference_number}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{transfer.description_raw}</div>
                      {transfer.notes_internal && (
                        <div className="text-[11px] text-gray-500 mt-1">📝 {transfer.notes_internal}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {transfer.insurers?.name || <span className="text-gray-400">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(transfer.transfer_type)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#8AAA19]">
                      ${transfer.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(transfer.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(transfer)}
                        disabled={transfer.status === 'PAGADO'}
                        className="p-2 text-[#010139] hover:bg-gray-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={transfer.status === 'PAGADO' ? 'No se puede editar (PAGADO)' : 'Editar'}
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

      {/* Resumen */}
      <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Total transferencias: <strong>{transfers.length}</strong>
        </div>
        <div className="text-sm font-bold text-[#8AAA19]">
          Total: ${transfers.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
        </div>
      </div>
    </Card>
  );
}
