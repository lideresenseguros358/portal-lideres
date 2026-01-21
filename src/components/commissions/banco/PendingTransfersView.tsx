'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCheckCircle, FaChevronDown, FaChevronUp, FaPlusCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetPendingTransfersAllCutoffs, actionGetPendingGroupsAll } from '@/app/(app)/commissions/banco-actions';
import IncludeTransferModal from './IncludeTransferModal';

interface PendingTransfersViewProps {
  excludeCutoffId?: string;
  currentCutoffId?: string;
  currentCutoffEndDate?: string; // Fecha de fin del corte actual para filtrar
  onTransferIncluded?: () => void;
}

export default function PendingTransfersView({ excludeCutoffId, currentCutoffId, currentCutoffEndDate, onTransferIncluded }: PendingTransfersViewProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [showIncludeModal, setShowIncludeModal] = useState(false);
  const [expanded, setExpanded] = useState(true);

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
      console.log('[PENDIENTES] Total transferencias PENDIENTES:', transfersResult.data?.length);
      console.log('[PENDIENTES] Excluyendo corte:', excludeCutoffId);
      
      // Filtrar transferencias que NO fueron incluidas en otros cortes
      // Y que NO pertenecen al corte actual que se está visualizando
      const notIncluded = (transfersResult.data || []).filter((t: any) => {
        // Una transferencia está incluida si tiene el marcador en notes_internal
        const isIncluded = t.notes_internal?.includes('Incluida en corte:') || false;
        const isNotCurrentCutoff = !excludeCutoffId || t.cutoff_id !== excludeCutoffId;
        const shouldShow = !isIncluded && isNotCurrentCutoff;
        
        if (!shouldShow && t.cutoff_id === excludeCutoffId) {
          console.log('[PENDIENTES] Excluyendo (mismo corte):', t.reference_number, t.cutoff_id);
        }
        if (!shouldShow && isIncluded) {
          console.log('[PENDIENTES] Excluyendo (ya incluida):', t.reference_number);
        }
        
        return shouldShow;
      });
      
      console.log('[PENDIENTES] Transferencias filtradas para mostrar:', notIncluded.length);
      setTransfers(notIncluded);
    }
    
    if (groupsResult.ok) {
      // Filtrar grupos de sistema (como "Transferencias de otras quincenas")
      const filteredGroups = (groupsResult.data || []).filter((g: any) => {
        const name = (g.name || '').toLowerCase();
        return !name.includes('otras quincenas') && 
               !name.includes('otros cortes') && 
               !name.includes('transferencias de otras') &&
               !name.includes('pagados en otras');
      });
      setGroups(filteredGroups);
    }
    
    // Calcular total DESPUÉS de tener los datos (solo con no incluidas y excluyendo corte actual)
    const transfersForTotal = transfersResult.ok 
      ? (transfersResult.data || []).filter((t: any) => {
          const isIncluded = t.notes_internal?.includes('Incluida en corte:') || false;
          const isNotCurrentCutoff = !excludeCutoffId || t.cutoff_id !== excludeCutoffId;
          return !isIncluded && isNotCurrentCutoff;
        })
      : [];
    const total = transfersForTotal.reduce((sum: number, t: any) => sum + (t.amount || 0), 0) + 
                  (groupsResult.data || []).reduce((sum: number, g: any) => sum + (g.total_amount || 0), 0);
    setTotalPending(total);
    setIsInitialLoad(false);
    
    setLoading(false);
  };

  // No renderizar nada si no hay contenido (badge 0)
  if (!loading && transfers.length === 0 && groups.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg border-2 border-orange-200 overflow-hidden">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-orange-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FaClock className="text-orange-600 text-xl sm:text-2xl" />
            <div className="text-left">
              <h3 className="text-base sm:text-lg font-bold text-[#010139]">Pendientes de Otros Cortes</h3>
              <p className="text-xs sm:text-sm text-gray-600">Transferencias sin clasificar de períodos anteriores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
              {transfers.length + groups.length}
            </span>
            {expanded ? (
              <FaChevronUp className="text-gray-500 text-lg" />
            ) : (
              <FaChevronDown className="text-gray-500 text-lg" />
            )}
          </div>
        </button>
        {expanded && (
        <div className="border-t-2 border-orange-100">
          <div className="p-3 sm:p-4">
            {/* Header con stats */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-amber-700 font-semibold mb-1">
                    Transferencias disponibles para incluir
                  </p>
                  <p className="text-xs text-amber-600">
                    De otros períodos bancarios
                  </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border-2 border-amber-300">
                  <p className="text-xs text-amber-700 font-semibold uppercase">Total Disponible</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-900">
                    {isInitialLoad ? 'Cargando...' : `$${totalPending.toFixed(2)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-2"></div>
                  <p className="text-amber-700 font-medium">Cargando transferencias...</p>
                </div>
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
                          
                          {/* Vista Desktop: Tabla */}
                          <div className="hidden sm:block">
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
                                      {(() => {
                                        const isSameCutoff = t.cutoff_id === currentCutoffId;
                                        const isDisabled = !currentCutoffId || isSameCutoff;
                                        const tooltipText = !currentCutoffId 
                                          ? 'Selecciona un corte bancario primero'
                                          : isSameCutoff
                                          ? 'Esta transferencia ya pertenece al corte actual'
                                          : 'Incluir en quincena actual';
                                        
                                        return (
                                          <button
                                            onClick={() => {
                                              if (!currentCutoffId) {
                                                toast.error('Selecciona un corte bancario primero');
                                                return;
                                              }
                                              if (isSameCutoff) {
                                                toast.error('Esta transferencia ya pertenece al corte actual');
                                                return;
                                              }
                                              setSelectedTransfer(t);
                                              setShowIncludeModal(true);
                                            }}
                                            disabled={isDisabled}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-semibold rounded-lg hover:from-[#010139] hover:to-[#020270] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={tooltipText}
                                          >
                                            <FaPlusCircle size={12} className="text-white" />
                                            Incluir
                                          </button>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Vista Mobile: Cards */}
                          <div className="sm:hidden space-y-2">
                            {cutoffTransfers.map((t: any) => {
                              const isSameCutoff = t.cutoff_id === currentCutoffId;
                              const isDisabled = !currentCutoffId || isSameCutoff;
                              
                              return (
                                <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-amber-900 mb-1">
                                        {t.description_raw?.substring(0, 40) || 'Sin descripción'}
                                        {t.description_raw && t.description_raw.length > 40 && '...'}
                                      </p>
                                      {t.insurers?.name && (
                                        <p className="text-xs text-gray-600">🏢 {t.insurers.name}</p>
                                      )}
                                    </div>
                                    <span className="text-lg font-bold text-amber-900 font-mono ml-2">
                                      ${t.amount.toFixed(2)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-600">
                                        📅 {new Date(t.date).toLocaleDateString('es-PA')}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                        {t.transfer_type || 'PENDIENTE'}
                                      </span>
                                    </div>
                                    
                                    <button
                                      onClick={() => {
                                        if (!currentCutoffId) {
                                          toast.error('Selecciona un corte bancario primero');
                                          return;
                                        }
                                        if (isSameCutoff) {
                                          toast.error('Esta transferencia ya pertenece al corte actual');
                                          return;
                                        }
                                        setSelectedTransfer(t);
                                        setShowIncludeModal(true);
                                      }}
                                      disabled={isDisabled}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-semibold rounded-lg hover:from-[#010139] hover:to-[#020270] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <FaPlusCircle size={10} />
                                      Incluir
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
                  
                  {/* Vista Desktop: Tabla */}
                  <div className="hidden sm:block bg-white rounded-lg border border-amber-200 overflow-hidden">
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

                  {/* Vista Mobile: Cards */}
                  <div className="sm:hidden space-y-2">
                    {groups.map((g: any) => (
                      <div key={g.id} className="bg-white border border-amber-200 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{g.name}</p>
                          </div>
                          <span className="text-lg font-bold text-amber-900 font-mono ml-2">
                            ${(g.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        <div>
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Sin datos */}
            {transfers.length === 0 && groups.length === 0 && (
              <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <FaCheckCircle className="mx-auto text-5xl text-green-500 mb-3" />
                <p className="font-semibold text-gray-700 mb-1">✅ No hay transferencias pendientes</p>
                <p className="text-sm text-gray-500">Todas las transferencias han sido vinculadas</p>
              </div>
                )}
              </>
              )}
            </div>
          </div>
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
            onTransferIncluded?.(); // Refrescar página principal
          }}
        />
      )}
    </>
  );
}
