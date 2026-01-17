'use client';

import { useState, useEffect } from 'react';
import { FaChevronDown, FaChevronRight, FaLayerGroup, FaCheckCircle, FaClock, FaLock, FaTrash, FaSave, FaEdit, FaUndo } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionDeleteBankGroup, actionUpdateGroupTransfers, actionRevertTransferInclusion } from '@/app/(app)/commissions/banco-actions';
import type { BankTransferStatus, TransferType } from '@/app/(app)/commissions/banco-actions';
import { supabaseClient } from '@/lib/supabase/client';

interface Insurer {
  id: string;
  name: string;
}

interface GroupsTableProps {
  groups: any[];
  loading: boolean;
  onGroupDeleted?: () => void;
}

export default function GroupsTable({ groups, loading, onGroupDeleted }: GroupsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deletingGroups, setDeletingGroups] = useState<Set<string>>(new Set());
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [editingGroups, setEditingGroups] = useState<Set<string>>(new Set());
  const [showEditMode, setShowEditMode] = useState<Set<string>>(new Set());
  const [groupEdits, setGroupEdits] = useState<Record<string, { insurerId?: string; transferType?: TransferType }>>({});
  const [revertingTransfers, setRevertingTransfers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadInsurers = async () => {
      const { data } = await supabaseClient()
        .from('insurers')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (data) setInsurers(data);
    };
    loadInsurers();
  }, []);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSaveGroupEdits = async (groupId: string, groupName: string) => {
    const edits = groupEdits[groupId];
    if (!edits || (!edits.insurerId && !edits.transferType)) {
      toast.error('No hay cambios para guardar');
      return;
    }

    setEditingGroups(prev => new Set(prev).add(groupId));
    const result = await actionUpdateGroupTransfers(groupId, {
      insurerAssignedId: edits.insurerId,
      transferType: edits.transferType,
    });
    setEditingGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });

    if (result.ok) {
      toast.success('Grupo actualizado', { description: `Todas las transferencias de "${groupName}" han sido actualizadas` });
      setGroupEdits(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      onGroupDeleted?.(); // Refresh data
    } else {
      toast.error('Error al actualizar', { description: result.error });
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string, status: string) => {
    if (status === 'PAGADO') {
      toast.error('No se puede eliminar', {
        description: 'Este grupo tiene transferencias pagadas vinculadas a una quincena cerrada'
      });
      return;
    }

    if (!confirm(`¿Eliminar el grupo "${groupName}"?\n\nEsto eliminará el grupo y liberará las transferencias asociadas.`)) {
      return;
    }

    setDeletingGroups(prev => new Set(prev).add(groupId));
    const result = await actionDeleteBankGroup(groupId);
    setDeletingGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });

    if (result.ok) {
      toast.success('Grupo eliminado', { description: 'Las transferencias han sido liberadas' });
      onGroupDeleted?.();
    } else {
      toast.error('Error al eliminar', { description: result.error });
    }
  };

  const handleRevertInclusion = async (transferId: string, transferRef: string) => {
    if (!confirm(`¿Revertir inclusión de la transferencia ${transferRef}?\n\nEsto restaurará su estado a PENDIENTE y eliminará las notas de inclusión.`)) {
      return;
    }

    setRevertingTransfers(prev => new Set(prev).add(transferId));
    const result = await actionRevertTransferInclusion(transferId);
    setRevertingTransfers(prev => {
      const next = new Set(prev);
      next.delete(transferId);
      return next;
    });

    if (result.ok) {
      toast.success('Inclusión revertida', { description: 'La transferencia volvió a su estado anterior' });
      onGroupDeleted?.(); // Refresh data
    } else {
      toast.error('Error al revertir', { description: result.error });
    }
  };

  const getStatusBadge = (status: BankTransferStatus | string) => {
    const badges = {
      SIN_CLASIFICAR: { label: 'Sin clasificar', color: 'bg-gray-100 text-gray-800', icon: FaClock },
      PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: FaClock },
      REPORTADO: { label: 'Reportado', color: 'bg-purple-100 text-purple-800', icon: FaCheckCircle },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: FaLock },
      EN_PROCESO: { label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800', icon: FaClock },
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDIENTE;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon size={10} />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <p className="text-center text-gray-500">Cargando grupos...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-6 sm:p-8 text-center">
        <FaLayerGroup className="mx-auto text-5xl text-gray-300 mb-3" />
        <p className="text-gray-600 font-semibold text-base">No hay grupos creados</p>
        <p className="text-gray-500 text-sm mt-1">Los grupos que crees aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id);
        // Las transferencias vienen en group.transfers (de actionGetBankGroups)
        const transfers = group.transfers?.map((gt: any) => gt.bank_transfers_comm) || [];
        const totalAmount = transfers.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

        return (
          <div key={group.id} className="bg-white rounded-lg border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-md overflow-hidden">
              {/* Header del grupo */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
                {/* Primera fila: Info y expansión */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-3 sm:gap-4 flex-1 text-left min-w-0"
                >
                  {/* Icono expandir */}
                  <div className="text-purple-600 flex-shrink-0">
                    {isExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                  </div>

                  {/* Info del grupo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <FaLayerGroup className="text-purple-500 flex-shrink-0" size={14} />
                      <span className="font-bold text-gray-900 text-sm sm:text-base truncate">{group.name}</span>
                      {getStatusBadge(group.status)}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {group.insurers?.name && (
                        <span className="mr-3 sm:mr-4">🏢 {group.insurers.name}</span>
                      )}
                      <span className="text-gray-500">{transfers.length} transfer.</span>
                    </div>
                  </div>
                </button>

                  {/* Monto y acciones */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
                      <p className="text-lg sm:text-xl font-bold text-purple-900">
                        ${totalAmount.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      {group.status !== 'PAGADO' && (
                        <button
                          onClick={() => {
                            const newShowEdit = new Set(showEditMode);
                            if (newShowEdit.has(group.id)) {
                              newShowEdit.delete(group.id);
                            } else {
                              newShowEdit.add(group.id);
                            }
                            setShowEditMode(newShowEdit);
                          }}
                          className="p-2 text-[#010139] hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                          title="Editar tipo/aseguradora"
                        >
                          <FaEdit size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name, group.status)}
                        disabled={deletingGroups.has(group.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                        title="Eliminar grupo"
                      >
                        <FaTrash size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: Edición en masa (solo si NO está PAGADO y en modo edición) */}
                {group.status !== 'PAGADO' && showEditMode.has(group.id) && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-900 mb-2">⚡ Edición en Masa - Aplicar a todas las transferencias:</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={groupEdits[group.id]?.transferType || ''}
                        onChange={(e) => setGroupEdits(prev => ({
                          ...prev,
                          [group.id]: { ...prev[group.id], transferType: (e.target.value as TransferType) || undefined }
                        }))}
                        className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                        disabled={editingGroups.has(group.id)}
                      >
                        <option value="">Cambiar tipo...</option>
                        <option value="REPORTE">Reporte</option>
                        <option value="BONO">Bono</option>
                        <option value="OTRO">Otro</option>
                        <option value="PENDIENTE">Pendiente</option>
                      </select>
                      <select
                        value={groupEdits[group.id]?.insurerId || ''}
                        onChange={(e) => setGroupEdits(prev => ({
                          ...prev,
                          [group.id]: { ...prev[group.id], insurerId: e.target.value || undefined }
                        }))}
                        className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                        disabled={editingGroups.has(group.id)}
                      >
                        <option value="">Asignar aseguradora...</option>
                        {insurers.map(ins => (
                          <option key={ins.id} value={ins.id}>{ins.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveGroupEdits(group.id, group.name)}
                        disabled={editingGroups.has(group.id) || (!groupEdits[group.id]?.insurerId && !groupEdits[group.id]?.transferType)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap"
                      >
                        <FaSave size={12} />
                        {editingGroups.has(group.id) ? 'Guardando...' : 'Aplicar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transferencias del grupo - expandible */}
              {isExpanded && (
                <div className="px-6 pb-4 bg-purple-50/30">
                  <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Referencia</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Descripción</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-purple-900 uppercase">Estado</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-purple-900 uppercase">Monto</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-purple-900 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((transfer: any) => {
                          const isIncludedFromOtherCutoff = group.name === 'Transferencias de otras quincenas';
                          
                          return (
                            <tr key={transfer.id} className="border-t border-purple-100 hover:bg-purple-50">
                              <td className="px-4 py-2 text-gray-700">
                                {new Date(transfer.date).toLocaleDateString('es-PA')}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600">
                                {transfer.reference_number}
                              </td>
                              <td className="px-4 py-2 text-gray-900">
                                {transfer.description_raw?.substring(0, 50) || 'Sin descripción'}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {getStatusBadge(transfer.status)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                                ${transfer.amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {isIncludedFromOtherCutoff && group.status !== 'PAGADO' && (
                                  <button
                                    onClick={() => handleRevertInclusion(transfer.id, transfer.reference_number)}
                                    disabled={revertingTransfers.has(transfer.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-300 rounded-lg transition disabled:opacity-50"
                                    title="Revertir inclusión"
                                  >
                                    <FaUndo size={10} />
                                    {revertingTransfers.has(transfer.id) ? 'Revertiendo...' : 'Revertir'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                        <tr>
                          <td colSpan={5} className="px-4 py-2 text-right font-semibold text-purple-900">
                            Total:
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-purple-900 text-lg">
                            ${totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
