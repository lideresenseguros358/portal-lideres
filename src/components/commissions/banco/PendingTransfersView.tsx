'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCheckCircle, FaChevronDown, FaChevronRight, FaPlusCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetPendingTransfersAllCutoffs, actionGetPendingGroupsAll } from '@/app/(app)/commissions/banco-actions';
import IncludeTransferModal from './IncludeTransferModal';

interface PendingTransfersViewProps {
  excludeCutoffId?: string;
  currentCutoffId?: string;
}

export default function PendingTransfersView({ excludeCutoffId, currentCutoffId }: PendingTransfersViewProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [showIncludeModal, setShowIncludeModal] = useState(false);

  useEffect(() => {
    loadPending();
  }, [excludeCutoffId]);

  const loadPending = async () => {
    setLoading(true);
    
    const [transfersResult, groupsResult] = await Promise.all([
      actionGetPendingTransfersAllCutoffs(),
      actionGetPendingGroupsAll(excludeCutoffId)
    ]);
    
    if (transfersResult.ok) {
      setTransfers(transfersResult.data || []);
    }
    
    if (groupsResult.ok) {
      setGroups(groupsResult.data || []);
    }
    
    // Calcular total DESPUÉS de tener los datos
    const total = (transfersResult.data || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0) + 
                  (groupsResult.data || []).reduce((sum: number, g: any) => sum + (g.total_amount || 0), 0);
    setTotalPending(total);
    setIsInitialLoad(false);
    
    setLoading(false);
  };

  return (
    <>
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-3 sm:p-4 mb-6">
      {/* Header siempre visible */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <div className="flex items-center gap-3 flex-1">
          <FaClock className="text-amber-600 flex-shrink-0" size={20} />
          <div className="min-w-0">
            <h3 className="font-bold text-amber-900 text-base sm:text-lg">Transferencias Pendientes</h3>
            <p className="text-xs sm:text-sm text-amber-700">
              Disponibles para vincular en Nueva Quincena
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
          <div className="text-left sm:text-right">
            <p className="text-xs text-amber-700 uppercase font-semibold">Total Disponible</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-900">
              {isInitialLoad ? 'Cargando...' : `$${totalPending.toFixed(2)}`}
            </p>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-amber-100 rounded-lg transition flex-shrink-0"
          >
            {expanded ? <FaChevronDown className="text-amber-700" /> : <FaChevronRight className="text-amber-700" />}
          </button>
        </div>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <p className="text-center text-amber-700 py-4">Cargando...</p>
          ) : (
            <>
              {/* Transferencias individuales AGRUPADAS POR CORTE */}
              {transfers.length > 0 && (() => {
                // Agrupar transferencias por corte
                const transfersByCutoff = new Map<string, any[]>();
                
                transfers.forEach((t: any) => {
                  const cutoffKey = t.cutoff_id || 'sin-corte';
                  if (!transfersByCutoff.has(cutoffKey)) {
                    transfersByCutoff.set(cutoffKey, []);
                  }
                  transfersByCutoff.get(cutoffKey)!.push(t);
                });

                return (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                      💵 Transferencias Pendientes ({transfers.length})
                    </h4>
                    {Array.from(transfersByCutoff.entries()).map(([cutoffKey, cutoffTransfers]) => {
                      const firstTransfer = cutoffTransfers[0];
                      const cutoffInfo = firstTransfer.bank_cutoffs
                        ? `Corte ${new Date(firstTransfer.bank_cutoffs.start_date).toLocaleDateString('es-PA')} - ${new Date(firstTransfer.bank_cutoffs.end_date).toLocaleDateString('es-PA')}`
                        : 'Sin corte asignado';
                      const cutoffTotal = cutoffTransfers.reduce((sum, t) => sum + t.amount, 0);

                      return (
                        <div key={cutoffKey} className="bg-white rounded-lg border-2 border-amber-200 overflow-hidden">
                          {/* Header del corte */}
                          <div className="bg-gradient-to-r from-amber-100 to-amber-50 px-4 py-3 border-b-2 border-amber-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-amber-900">📅 {cutoffInfo}</p>
                                <p className="text-xs text-amber-700">{cutoffTransfers.length} transferencia(s)</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-amber-700 uppercase font-semibold">Total Corte</p>
                                <p className="text-lg font-bold text-amber-900 font-mono">${cutoffTotal.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Tabla de transferencias del corte */}
                          <table className="w-full text-sm">
                            <thead className="bg-amber-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Fecha</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Descripción</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Tipo</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-amber-900 uppercase">Monto</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-amber-900 uppercase">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cutoffTransfers.map((t: any) => (
                                <tr key={t.id} className="border-t border-amber-100 hover:bg-amber-50">
                                  <td className="px-3 py-2 text-gray-700 text-xs">
                                    {new Date(t.date).toLocaleDateString('es-PA')}
                                  </td>
                                  <td className="px-3 py-2 text-gray-900 font-medium text-sm">
                                    {t.description_raw?.substring(0, 50) || 'Sin descripción'}
                                    {t.insurers?.name && (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        🏢 {t.insurers.name}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                      {t.transfer_type || 'PENDIENTE'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-amber-900">
                                    ${t.amount.toFixed(2)}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      onClick={() => {
                                        if (!currentCutoffId) {
                                          toast.error('Selecciona un corte bancario primero');
                                          return;
                                        }
                                        setSelectedTransfer(t);
                                        setShowIncludeModal(true);
                                      }}
                                      disabled={!currentCutoffId}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-semibold rounded-lg hover:from-[#010139] hover:to-[#020270] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={!currentCutoffId ? 'Selecciona un corte bancario primero' : 'Incluir en quincena actual'}
                                    >
                                      <FaPlusCircle size={12} className="text-white" />
                                      Incluir
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Grupos */}
              {groups.length > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    📦 Grupos de Transferencias ({groups.length})
                  </h4>
                  <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Nombre</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-amber-900 uppercase">Estado</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-amber-900 uppercase">Monto Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g: any) => (
                          <tr key={g.id} className="border-t border-amber-100 hover:bg-amber-50">
                            <td className="px-3 py-2 text-gray-900 font-medium">
                              {g.name}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {g.status === 'EN_PROCESO' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  <FaClock size={10} />
                                  EN PROCESO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                  <FaCheckCircle size={10} />
                                  OK
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-900">
                              ${(g.total_amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sin datos */}
              {transfers.length === 0 && groups.length === 0 && !loading && (
                <div className="text-center py-6 text-amber-700">
                  <p className="font-semibold mb-1">✅ No hay transferencias pendientes</p>
                  <p className="text-sm">Todas las transferencias han sido vinculadas y pagadas</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>

      {/* Modal de Incluir Transferencia */}
      {showIncludeModal && selectedTransfer && currentCutoffId && (
        <IncludeTransferModal
          transfer={selectedTransfer}
          currentCutoffId={currentCutoffId}
          onClose={() => {
            setShowIncludeModal(false);
            setSelectedTransfer(null);
          }}
          onSuccess={() => {
            setShowIncludeModal(false);
            setSelectedTransfer(null);
            loadPending(); // Recargar lista
          }}
        />
      )}
    </>
  );
}
