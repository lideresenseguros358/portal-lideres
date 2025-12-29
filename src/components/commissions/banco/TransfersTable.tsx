'use client';

import { useState } from 'react';
import { FaEdit, FaCheckCircle, FaClock, FaCircle, FaLock, FaSave, FaTimes, FaLayerGroup, FaTrash } from 'react-icons/fa';
import { actionUpdateBankTransfer, actionAddTransferToGroup, actionDeleteBankTransfer } from '@/app/(app)/commissions/banco-actions';
import type { BankTransferStatus, TransferType } from '@/app/(app)/commissions/banco-actions';
import CreateGroupModal from './CreateGroupModal';
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
  const [paymentDate, setPaymentDate] = useState<string>(''); // Para tipo OTRO
  const [selectedTransfers, setSelectedTransfers] = useState<Set<string>>(new Set());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [deletingTransfers, setDeletingTransfers] = useState<Set<string>>(new Set());

  const getStatusBadge = (status: BankTransferStatus) => {
    const badges = {
      SIN_CLASIFICAR: { label: 'Sin clasificar', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: FaCircle },
      PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: FaClock },
      REPORTADO: { label: 'Reportado', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: FaCheckCircle },
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
      status: transfer.status || 'PENDIENTE',
    });
    setPaymentDate(''); // Reset fecha al abrir edición
  };

  const handleSave = async (transferId: string) => {
    // Validación 1: Si tipo es OTRO, requiere nota interna
    if (editData.transferType === 'OTRO' && !editData.notesInternal?.trim()) {
      toast.error('El tipo OTRO requiere una nota interna obligatoria');
      return;
    }

    // Validación 2: Si tipo es OTRO y status es PAGADO, requiere fecha
    if (editData.transferType === 'OTRO' && editData.status === 'PAGADO' && !paymentDate?.trim()) {
      toast.error('Debes especificar la fecha de pago para transferencias tipo OTRO marcadas como PAGADO');
      return;
    }

    // Concatenar fecha a notas si tipo=OTRO y hay fecha
    let finalNotes = editData.notesInternal || '';
    if (editData.transferType === 'OTRO' && paymentDate?.trim()) {
      // Formatear fecha de YYYY-MM-DD a DD-MM-YY
      const dateParts = paymentDate.split('-');
      if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];
        const shortYear = year.slice(2); // Últimos 2 dígitos del año
        const formattedDate = `${day}-${month}-${shortYear}`;
        finalNotes = `${finalNotes} - ${formattedDate}`.trim();
      }
    }

    const result = await actionUpdateBankTransfer(transferId, {
      ...editData,
      notesInternal: finalNotes,
    });
    
    if (result.ok) {
      toast.success('Transferencia actualizada');
      setEditingId(null);
      setPaymentDate('');
      onRefresh();
    } else {
      toast.error('Error al actualizar', { description: result.error });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
    setPaymentDate('');
  };

  const handleSelectTransfer = (transferId: string) => {
    const newSelection = new Set(selectedTransfers);
    if (newSelection.has(transferId)) {
      newSelection.delete(transferId);
    } else {
      newSelection.add(transferId);
    }
    setSelectedTransfers(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedTransfers.size === transfers.length) {
      setSelectedTransfers(new Set());
    } else {
      setSelectedTransfers(new Set(transfers.map(t => t.id)));
    }
  };

  const handleOpenCreateGroupModal = () => {
    if (selectedTransfers.size === 0) {
      toast.error('Selecciona al menos una transferencia');
      return;
    }
    setShowCreateGroupModal(true);
  };

  const handleGroupCreated = async (groupId: string) => {
    setAddingToGroup(true);
    
    // Agregar todas las transferencias seleccionadas al grupo
    const transferIds = Array.from(selectedTransfers);
    let success = true;

    for (const transferId of transferIds) {
      const addResult = await actionAddTransferToGroup(groupId, transferId);
      if (!addResult.ok) {
        toast.error(`Error al agregar transfer ${transferId}`);
        success = false;
        break;
      }
    }

    setAddingToGroup(false);

    if (success) {
      toast.success(`Grupo creado con ${transferIds.length} transferencia(s)`);
      setShowCreateGroupModal(false);
      setSelectedTransfers(new Set());
      onRefresh();
    }
  };

  const handleDeleteSingle = async (transferId: string) => {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;

    if (transfer.status === 'PAGADO') {
      toast.error('No se puede eliminar', {
        description: 'Esta transferencia está vinculada a una quincena cerrada'
      });
      return;
    }

    if (!confirm(`¿Eliminar esta transferencia?\n\nReferencia: ${transfer.reference_number}\nMonto: $${transfer.amount.toFixed(2)}\n\nEsto eliminará la transferencia y todas sus anotaciones asociadas.`)) {
      return;
    }

    setDeletingTransfers(prev => new Set(prev).add(transferId));
    const result = await actionDeleteBankTransfer(transferId);
    setDeletingTransfers(prev => {
      const next = new Set(prev);
      next.delete(transferId);
      return next;
    });

    if (result.ok) {
      toast.success('Transferencia eliminada', { 
        description: 'Se eliminaron todas las anotaciones asociadas' 
      });
      onRefresh();
    } else {
      toast.error('Error al eliminar', { description: result.error });
    }
  };

  const handleDeleteSelectedTransfers = async () => {
    if (selectedTransfers.size === 0) {
      toast.error('Selecciona al menos una transferencia');
      return;
    }

    // Verificar si alguna está PAGADA
    const selectedArray = Array.from(selectedTransfers);
    const paidTransfers = transfers.filter(t => selectedArray.includes(t.id) && t.status === 'PAGADO');
    
    if (paidTransfers.length > 0) {
      toast.error('No se puede eliminar', {
        description: `${paidTransfers.length} transferencia(s) están vinculadas a quincenas cerradas`
      });
      return;
    }

    if (!confirm(`¿Eliminar ${selectedTransfers.size} transferencia(s) seleccionada(s)?\n\nEsto eliminará las transferencias y todas sus anotaciones asociadas.`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const transferId of selectedArray) {
      setDeletingTransfers(prev => new Set(prev).add(transferId));
      const result = await actionDeleteBankTransfer(transferId);
      setDeletingTransfers(prev => {
        const next = new Set(prev);
        next.delete(transferId);
        return next;
      });

      if (result.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setSelectedTransfers(new Set());

    if (errorCount === 0) {
      toast.success(`${successCount} transferencia(s) eliminada(s)`, { 
        description: 'Se eliminaron todas las anotaciones asociadas' 
      });
    } else {
      toast.warning(`${successCount} eliminada(s), ${errorCount} error(es)`, {
        description: 'Algunas transferencias no pudieron eliminarse'
      });
    }

    onRefresh();
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
    <>
    {/* Sticky Bar - Agrupar transferencias */}
    {selectedTransfers.size > 0 && (
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-2xl z-50 border-t-4 border-[#8AAA19]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Info */}
            <div className="flex items-center gap-3">
              <FaLayerGroup className="text-[#8AAA19]" size={24} />
              <div>
                <p className="font-semibold text-lg">
                  {selectedTransfers.size} transferencia(s) seleccionada(s)
                </p>
                <p className="text-xs text-gray-300">
                  Haz clic en "Crear Grupo" para configurar tipo y aseguradora
                </p>
              </div>
            </div>
            
            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTransfers(new Set())}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition font-medium text-sm shadow-sm"
              >
                <FaTimes size={14} />
                Cancelar
              </button>
              
              <button
                onClick={handleDeleteSelectedTransfers}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white border-2 border-red-600 rounded-lg hover:bg-red-700 hover:border-red-700 transition font-medium text-sm shadow-sm"
              >
                <FaTrash size={14} />
                Eliminar
              </button>
              
              <button
                onClick={handleOpenCreateGroupModal}
                className="flex items-center gap-2 px-6 py-2 bg-[#8AAA19] text-white border-2 border-[#8AAA19] rounded-lg hover:bg-[#010139] hover:border-[#010139] transition font-semibold text-sm shadow-sm"
              >
                <FaLayerGroup size={14} />
                Crear Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
      {/* Header con controles de selección */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTransfers.size === transfers.length && transfers.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-[#8AAA19] border-2 border-gray-300 rounded focus:ring-[#8AAA19]"
              />
              <span className="text-sm text-gray-600">
                {selectedTransfers.size > 0 ? `${selectedTransfers.size} seleccionada(s)` : 'Seleccionar todas'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs sm:text-sm text-gray-600">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-[#8AAA19] font-mono">
              ${transfers.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen Info */}
      <div className="hidden sm:flex items-center justify-between px-4 sm:px-6 py-2 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-700">
          💡 <strong>Tip:</strong> Selecciona varias transferencias para crear un grupo y vincularlo con reportes
        </p>
      </div>

      {/* Vista Desktop - Tabla */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase w-12">
                <input
                  type="checkbox"
                  checked={selectedTransfers.size === transfers.length && transfers.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-[#8AAA19] border-2 border-gray-300 rounded focus:ring-[#8AAA19]"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fecha</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Referencia</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Descripción</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Aseguradora</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Monto</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Estado</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b hover:bg-gray-50 transition-colors">
                {editingId === transfer.id ? (
                  <>
                    {/* Modo edición */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedTransfers.has(transfer.id)}
                        onChange={() => handleSelectTransfer(transfer.id)}
                        disabled
                        className="w-4 h-4 text-[#8AAA19] border-2 border-gray-300 rounded focus:ring-[#8AAA19] disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">{new Date(transfer.date).toLocaleDateString('es-PA')}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-700">{transfer.reference_number}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-gray-800 mb-1">{transfer.description_raw.substring(0, 50)}...</div>
                      <div className={editData.transferType === 'OTRO' ? 'grid grid-cols-2 gap-1' : ''}>
                        <input
                          type="text"
                          placeholder={editData.transferType === 'OTRO' ? 'Notas...' : 'Notas...'}
                          value={editData.notesInternal}
                          onChange={(e) => setEditData({ ...editData, notesInternal: e.target.value })}
                          className={`w-full px-2 py-1 border-2 rounded text-xs focus:outline-none ${
                            editData.transferType === 'OTRO' && !editData.notesInternal?.trim()
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-300 focus:border-[#8AAA19]'
                          }`}
                        />
                        {editData.transferType === 'OTRO' && (
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className={`w-full px-2 py-1 border-2 rounded text-xs focus:outline-none ${
                              editData.status === 'PAGADO' && !paymentDate?.trim()
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-gray-300 focus:border-[#8AAA19]'
                            }`}
                          />
                        )}
                      </div>
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
                    <td className="px-3 py-3">
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        disabled={editData.transferType !== 'OTRO'}
                        className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg text-xs focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="SIN_CLASIFICAR">Sin clasificar</option>
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="REPORTADO">Reportado</option>
                        <option value="PAGADO">Pagado</option>
                      </select>
                    </td>
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
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedTransfers.has(transfer.id)}
                        onChange={() => handleSelectTransfer(transfer.id)}
                        disabled={transfer.status === 'PAGADO'}
                        className="w-4 h-4 text-[#8AAA19] border-2 border-gray-300 rounded focus:ring-[#8AAA19] disabled:opacity-30 cursor-pointer"
                      />
                    </td>
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
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleEdit(transfer)}
                          disabled={transfer.status === 'PAGADO'}
                          className="p-2 text-[#010139] hover:bg-blue-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title={transfer.status === 'PAGADO' ? 'No se puede editar (PAGADO)' : 'Editar tipo/aseguradora'}
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(transfer.id)}
                          disabled={transfer.status === 'PAGADO' || deletingTransfers.has(transfer.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title={transfer.status === 'PAGADO' ? 'No se puede eliminar (PAGADO)' : 'Eliminar transferencia'}
                        >
                          {deletingTransfers.has(transfer.id) ? (
                            <div className="animate-spin w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full" />
                          ) : (
                            <FaTrash size={14} />
                          )}
                        </button>
                      </div>
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
            {editingId === transfer.id ? (
              /* Modo Edición Mobile */
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(transfer.status)}
                    <span className="text-xs text-gray-500">Ref: {transfer.reference_number}</span>
                  </div>
                  <div className="text-lg font-bold text-[#8AAA19] font-mono">
                    ${transfer.amount.toFixed(2)}
                  </div>
                </div>

                <div className="text-sm text-gray-800 font-medium mb-3">
                  {transfer.description_raw}
                </div>

                {/* Notas + Fecha lado a lado cuando tipo=OTRO */}
                <div className={editData.transferType === 'OTRO' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Notas {editData.transferType === 'OTRO' && <span className="text-red-600">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={editData.transferType === 'OTRO' ? 'Obligatorio...' : 'Notas...'}
                      value={editData.notesInternal}
                      onChange={(e) => setEditData({ ...editData, notesInternal: e.target.value })}
                      className={`w-full px-2 py-1.5 border-2 rounded text-xs focus:outline-none ${
                        editData.transferType === 'OTRO' && !editData.notesInternal?.trim() 
                          ? 'border-red-300 focus:border-red-500' 
                          : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}
                    />
                  </div>

                  {/* Input de Fecha - Solo visible cuando tipo=OTRO */}
                  {editData.transferType === 'OTRO' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Fecha {editData.status === 'PAGADO' && <span className="text-red-600">*</span>}
                      </label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className={`w-full px-2 py-1.5 border-2 rounded text-xs focus:outline-none ${
                          editData.status === 'PAGADO' && !paymentDate?.trim()
                            ? 'border-red-300 focus:border-red-500'
                            : 'border-gray-300 focus:border-[#8AAA19]'
                        }`}
                      />
                    </div>
                  )}
                </div>
                
                {/* Mensaje de ayuda */}
                {editData.transferType === 'OTRO' && editData.status === 'PAGADO' && (
                  <p className="text-xs text-red-600">⚠️ Fecha obligatoria para tipo OTRO marcado como PAGADO</p>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">Aseguradora</label>
                  <select
                    value={editData.insurerAssignedId}
                    onChange={(e) => setEditData({ ...editData, insurerAssignedId: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {insurers.map((ins) => (
                      <option key={ins.id} value={ins.id}>{ins.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">Tipo</label>
                  <select
                    value={editData.transferType}
                    onChange={(e) => setEditData({ ...editData, transferType: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none"
                  >
                    <option value="REPORTE">Reporte</option>
                    <option value="BONO">Bono</option>
                    <option value="OTRO">Otro</option>
                    <option value="PENDIENTE">Pendiente</option>
                  </select>
                </div>

                {/* Status - Solo editable si tipo es OTRO */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Status {editData.transferType !== 'OTRO' && <span className="text-xs text-gray-500">(automático)</span>}
                  </label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    disabled={editData.transferType !== 'OTRO'}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="SIN_CLASIFICAR">Sin clasificar</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="REPORTADO">Reportado</option>
                    <option value="PAGADO">Pagado</option>
                  </select>
                  {editData.transferType === 'REPORTE' && (
                    <p className="text-xs text-purple-600">✓ Se marcará como REPORTADO automáticamente</p>
                  )}
                  {editData.transferType === 'BONO' && (
                    <p className="text-xs text-purple-600">✓ Se marcará como REPORTADO automáticamente</p>
                  )}
                  {editData.transferType === 'OTRO' && !editData.notesInternal?.trim() && (
                    <p className="text-xs text-red-600">⚠️ Tipo OTRO requiere nota interna obligatoria</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleSave(transfer.id)}
                    className="flex-1 px-4 py-2.5 bg-[#8AAA19] text-white rounded-lg hover:bg-[#7a9916] transition font-medium text-sm"
                  >
                    <FaSave className="inline mr-2" />
                    Guardar
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium text-sm"
                  >
                    <FaTimes className="inline mr-2" />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* Vista Normal Mobile */
              <>
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

                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="text-gray-600 flex-1 min-w-0 truncate">
                    {transfer.insurers?.name || <span className="italic">Sin asiguradora</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedTransfers.has(transfer.id)}
                      onChange={() => handleSelectTransfer(transfer.id)}
                      disabled={transfer.status === 'PAGADO'}
                      className="w-4 h-4 text-[#8AAA19] border-2 border-gray-300 rounded focus:ring-[#8AAA19] disabled:opacity-30"
                    />
                    <button
                      onClick={() => handleEdit(transfer)}
                      disabled={transfer.status === 'PAGADO'}
                      className="px-3 py-1.5 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium"
                    >
                      {transfer.status === 'PAGADO' ? '🔒' : 'Editar'}
                    </button>
                  </div>
                </div>
              </>
            )}
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

    {/* Modal Crear Grupo */}
    {showCreateGroupModal && (
      <CreateGroupModal
        insurers={insurers}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={handleGroupCreated}
      />
    )}
    </>
  );
}
