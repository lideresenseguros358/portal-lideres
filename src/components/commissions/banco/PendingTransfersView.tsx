'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaCheckCircle, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { actionGetPendingTransfersAllCutoffs, actionGetPendingGroupsAll } from '@/app/(app)/commissions/banco-actions';

interface PendingTransfersViewProps {
  excludeCutoffId?: string;
}

export default function PendingTransfersView({ excludeCutoffId }: PendingTransfersViewProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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
    
    setLoading(false);
  };

  const totalPending = transfers.reduce((sum, t) => sum + (t.amount || 0), 0) + 
                       groups.reduce((sum, g) => sum + (g.total_amount || 0), 0);

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 mb-6">
      {/* Header siempre visible */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <FaClock className="text-amber-600" size={24} />
          <div>
            <h3 className="font-bold text-amber-900 text-lg">Transferencias Pendientes</h3>
            <p className="text-sm text-amber-700">
              Disponibles para vincular en Nueva Quincena
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-amber-700 uppercase font-semibold">Total Disponible</p>
            <p className="text-2xl font-bold text-amber-900">
              ${totalPending.toFixed(2)}
            </p>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-amber-100 rounded-lg transition"
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
              {/* Transferencias individuales */}
              {transfers.length > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    💵 Transferencias Individuales ({transfers.length})
                  </h4>
                  <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Fecha</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Descripción</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-amber-900 uppercase">Corte Origen</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-amber-900 uppercase">Estado</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-amber-900 uppercase">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((t: any) => {
                          const cutoffInfo = t.bank_cutoffs 
                            ? `${new Date(t.bank_cutoffs.start_date).toLocaleDateString('es-PA')} - ${new Date(t.bank_cutoffs.end_date).toLocaleDateString('es-PA')}`
                            : 'Sin corte';
                          
                          return (
                            <tr key={t.id} className="border-t border-amber-100 hover:bg-amber-50">
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(t.date).toLocaleDateString('es-PA')}
                              </td>
                              <td className="px-3 py-2 text-gray-900 font-medium">
                                {t.description_raw?.substring(0, 40) || 'Sin descripción'}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">
                                {cutoffInfo}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {t.status === 'PENDIENTE' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                    <FaClock size={10} />
                                    PENDIENTE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                    <FaCheckCircle size={10} />
                                    OK
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-900">
                                ${t.amount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
  );
}
