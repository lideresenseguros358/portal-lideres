'use client';

import { useState, useEffect } from 'react';
import { FaTrashAlt, FaSync, FaCheckCircle, FaExclamationTriangle, FaClock } from 'react-icons/fa';

interface CleanupStats {
  total: number;
  operaciones: {
    cases: number;
    renewals: number;
    petitions: number;
    urgencies: number;
    emailThreads: number;
  };
  admCot: {
    conversations: number;
    quotes: number;
    expedientes: number;
    payments: number;
  };
}

interface CleanupResult {
  success: boolean;
  message: string;
  deleted?: {
    operaciones: Record<string, number>;
    admCot: Record<string, number>;
  };
  errors?: string[];
}

export default function CleanupPage() {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);

  // Fetch statistics
  useEffect(() => {
    fetchStats();
    const lastRun = localStorage.getItem('lastCleanup');
    if (lastRun) setLastCleanup(new Date(lastRun).toLocaleString('es-PA'));
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cleanup', { method: 'GET' });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('⚠️ ¿Está seguro de que desea eliminar TODOS los datos de los módulos Operaciones y ADM COT? Esta acción no se puede deshacer.\n\n📌 Los módulos de Chat y Trámites NO serán afectados.')) {
      return;
    }

    setCleaning(true);
    try {
      const response = await fetch('/api/admin/cleanup', { method: 'POST' });
      const data: CleanupResult = await response.json();
      setResult(data);
      if (data.success) {
        localStorage.setItem('lastCleanup', new Date().toISOString());
        setLastCleanup(new Date().toLocaleString('es-PA'));
        setTimeout(fetchStats, 1000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error ejecutando limpieza',
        errors: [String(error)],
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#010139] mb-2">🧹 Limpieza: Operaciones & ADM COT</h1>
        <p className="text-gray-600">Elimina TODA la data de prueba de los módulos Operaciones y ADM COT. Los módulos de Chat y Trámites quedan intactos.</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4">
        <p className="text-sm font-semibold text-red-900">⚠️ ATENCIÓN</p>
        <p className="text-xs text-red-800 mt-1">Esta acción eliminará <strong>TODOS</strong> los registros de ambos módulos. Esta acción es irreversible.</p>
      </div>

      {/* Last Cleanup */}
      {lastCleanup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <FaClock className="text-blue-600 text-lg" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Última limpieza</p>
            <p className="text-xs text-blue-700">{lastCleanup}</p>
          </div>
        </div>
      )}

      {/* Statistics */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin mr-2"><FaSync /></div>
          <p className="text-gray-600">Cargando estadísticas...</p>
        </div>
      ) : stats ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-bold text-[#010139]">Datos a Eliminar</h2>
            <p className="text-xs text-gray-500 mt-1">Total: <strong className="text-red-600">{stats.total}</strong> registros</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Operaciones */}
            <div>
              <h3 className="text-sm font-bold text-[#010139] mb-3">📋 Módulo: Operaciones</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(stats.operaciones).map(([key, count]) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg border bg-red-50 border-red-200 text-red-700"
                  >
                    <p className="text-xs font-semibold mb-1 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ADM COT */}
            <div>
              <h3 className="text-sm font-bold text-[#010139] mb-3">💬 Módulo: ADM COT</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats.admCot).map(([key, count]) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-700"
                  >
                    <p className="text-xs font-semibold mb-1 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={fetchStats}
          disabled={loading || cleaning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <FaSync className={cleaning ? 'animate-spin' : ''} />
          Actualizar
        </button>

        <button
          onClick={handleCleanup}
          disabled={cleaning || (stats?.total ?? 0) === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <FaTrashAlt />
          {cleaning ? 'Limpiando...' : 'Eliminar Todo'}
        </button>
      </div>

      {/* Result Message */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <FaCheckCircle className="text-green-600 text-lg mt-1 flex-shrink-0" />
            ) : (
              <FaExclamationTriangle className="text-red-600 text-lg mt-1 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-bold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                {result.message}
              </p>

              {result.deleted && (
                <div className="mt-3 space-y-2 text-xs">
                  {Object.entries(result.deleted).map(([module, counts]: [string, any]) => (
                    <div key={module} className="space-y-1">
                      <p className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                        {module === 'operaciones' ? '📋 Operaciones' : '💬 ADM COT'}:
                      </p>
                      {Object.entries(counts).map(([key, count]: [string, any]) => (
                        count > 0 && (
                          <p key={key} className={result.success ? 'text-green-700' : 'text-red-700'}>
                            • {key}: <strong>{count}</strong> eliminado(s)
                          </p>
                        )
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="font-semibold text-red-900">Errores:</p>
                  {result.errors.map((error, idx) => (
                    <p key={idx} className="text-red-700 text-xs">
                      • {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">ℹ️ Alcance de la limpieza:</p>
        <ul className="list-disc list-inside space-y-1 text-xs mb-3">
          <li><strong>Operaciones:</strong> Todos los casos, renovaciones, peticiones, urgencias y emails</li>
          <li><strong>ADM COT:</strong> Todas las conversaciones, cotizaciones, expedientes y pagos</li>
        </ul>
        <p className="font-semibold mb-2 text-blue-900 border-t border-blue-200 pt-3">✅ Módulos que quedan intactos:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>Chat:</strong> Todos los threads y mensajes de WhatsApp</li>
          <li><strong>Trámites:</strong> Todos los casos de la página de trámites</li>
        </ul>
      </div>
    </div>
  );
}
