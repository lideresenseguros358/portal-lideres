'use client';

import { useState } from 'react';
import { FaSync, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';

interface FEDPASyncButtonProps {
  variant?: 'full' | 'single';
  policyId?: string;
  onSyncComplete?: () => void;
}

export default function FEDPASyncButton({ 
  variant = 'full', 
  policyId,
  onSyncComplete 
}: FEDPASyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading(
      variant === 'full' 
        ? 'Sincronizando con FEDPA...' 
        : 'Consultando FEDPA...'
    );

    try {
      const response = await fetch('/api/fedpa/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyId ? { policyId } : {}),
      });

      const result = await response.json();

      if (result.success) {
        setSyncResult(result);
        
        if (variant === 'full') {
          setShowModal(true);
          toast.success(
            `Sincronización completada: ${result.stats.policiesUpdated} pólizas y ${result.stats.clientsUpdated} clientes actualizados`,
            { id: toastId }
          );
        } else {
          toast.success(result.message || 'Datos actualizados desde FEDPA', { id: toastId });
        }

        onSyncComplete?.();
      } else {
        toast.error(result.error || 'Error en la sincronización', { id: toastId });
      }
    } catch (error) {
      console.error('[FEDPA Sync] Error:', error);
      toast.error('Error al sincronizar con FEDPA', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`flex items-center gap-2 ${
          variant === 'full'
            ? 'px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold'
            : 'p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={variant === 'full' ? 'Sincronizar todas las pólizas con FEDPA' : 'Actualizar desde FEDPA'}
      >
        <FaSync className={syncing ? 'animate-spin' : ''} size={variant === 'full' ? 16 : 14} />
        {variant === 'full' && <span>Sincronizar con FEDPA</span>}
      </button>

      {/* Modal de resultados */}
      {showModal && syncResult && variant === 'full' && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaSync size={20} className="text-white" />
                <div>
                  <h3 className="text-lg font-bold text-white">Resultado de Sincronización FEDPA</h3>
                  <p className="text-xs text-white/80">Datos enriquecidos desde FEDPA</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all text-white"
              >
                ×
              </button>
            </div>

            {/* Stats */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Procesadas</p>
                  <p className="text-2xl font-bold text-blue-900">{syncResult.stats.policiesProcessed}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-green-600 font-semibold mb-1">Pólizas Actualizadas</p>
                  <p className="text-2xl font-bold text-green-900">{syncResult.stats.policiesUpdated}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-xs text-purple-600 font-semibold mb-1">Clientes Actualizados</p>
                  <p className="text-2xl font-bold text-purple-900">{syncResult.stats.clientsUpdated}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-xs text-red-600 font-semibold mb-1">Errores</p>
                  <p className="text-2xl font-bold text-red-900">{syncResult.stats.errors}</p>
                </div>
              </div>

              {/* Detalles */}
              {syncResult.details && syncResult.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Detalles por Póliza:</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {syncResult.details.map((detail: any, index: number) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                          detail.status === 'updated'
                            ? 'bg-green-50 border border-green-200'
                            : detail.status === 'not_found'
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {detail.status === 'updated' && (
                            <FaCheckCircle className="text-green-600" size={16} />
                          )}
                          {detail.status === 'not_found' && (
                            <FaExclamationTriangle className="text-yellow-600" size={16} />
                          )}
                          {detail.status === 'error' && (
                            <FaExclamationTriangle className="text-red-600" size={16} />
                          )}
                          <span className="font-mono font-semibold">{detail.policy_number}</span>
                        </div>
                        <span className="text-xs text-gray-600">{detail.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón cerrar */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
