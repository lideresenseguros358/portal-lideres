'use client';

import { useState, useEffect } from 'react';
import { FaShieldAlt, FaSearch, FaFilter, FaDownload, FaTimes, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { actionGetSecurityLogs } from '@/app/(app)/cases/ticketing-actions';

interface SecurityLog {
  id: string;
  case_id: string;
  action_type: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

interface SecurityLogsViewerProps {
  caseId: string;
  caseName?: string;
}

export default function SecurityLogsViewer({ caseId, caseName }: SecurityLogsViewerProps) {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [caseId]);

  const loadLogs = async () => {
    setLoading(true);
    
    const result = await actionGetSecurityLogs(caseId);
    
    if (result.ok) {
      setLogs(result.data || []);
    } else {
      toast.error(result.error || 'Error al cargar logs');
    }
    
    setLoading(false);
  };

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        log.action_type.toLowerCase().includes(search) ||
        log.actor_email?.toLowerCase().includes(search) ||
        log.field_changed?.toLowerCase().includes(search) ||
        log.old_value?.toLowerCase().includes(search) ||
        log.new_value?.toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
    }

    // Filtro por tipo de acción
    if (filterAction !== 'ALL' && log.action_type !== filterAction) {
      return false;
    }

    return true;
  });

  // Tipos de acción únicos para el filtro
  const actionTypes = Array.from(new Set(logs.map(l => l.action_type)));

  const exportToCSV = () => {
    const headers = ['Fecha', 'Acción', 'Actor', 'Campo', 'Valor Anterior', 'Valor Nuevo', 'IP'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.action_type,
      log.actor_email || 'Sistema',
      log.field_changed || '-',
      log.old_value || '-',
      log.new_value || '-',
      log.ip_address || '-',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security_logs_${caseId}_${Date.now()}.csv`;
    a.click();
    
    toast.success('Logs exportados correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-white rounded-xl p-6 border-l-4 border-red-600 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <FaShieldAlt className="text-2xl text-red-600" />
          <h2 className="text-2xl font-bold text-[#010139]">
            🔒 Logs de Seguridad
          </h2>
        </div>
        <p className="text-gray-600">
          Registro inmutable de todas las acciones en este caso. Solo visible para Masters.
        </p>
        {caseName && (
          <p className="text-sm text-gray-500 mt-2">
            Caso: <span className="font-semibold">{caseName}</span>
          </p>
        )}
      </div>

      {/* Warning Card */}
      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-red-600 mt-1" />
          <div>
            <h3 className="font-bold text-red-900 mb-2">⚠️ Registro Inmutable</h3>
            <ul className="text-sm text-red-700 space-y-1 ml-4">
              <li>• Estos logs NO pueden ser editados ni eliminados</li>
              <li>• Cada acción en el caso queda registrada permanentemente</li>
              <li>• Solo los usuarios Master pueden ver estos logs</li>
              <li>• Los brokers solo ven el historial público del caso</li>
              <li>• Útil para auditorías y compliance</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en logs..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          {/* Action Filter */}
          <div className="sm:w-64">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="ALL">Todas las acciones</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <FaDownload className="text-white" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-sm text-gray-600">Total de eventos</p>
          <p className="text-2xl font-bold text-[#010139]">{logs.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-sm text-gray-600">Eventos filtrados</p>
          <p className="text-2xl font-bold text-blue-600">{filteredLogs.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-sm text-gray-600">Tipos de acción</p>
          <p className="text-2xl font-bold text-green-600">{actionTypes.length}</p>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <FaShieldAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No hay logs que mostrar
          </h3>
          <p className="text-gray-500">
            {searchTerm || filterAction !== 'ALL' 
              ? 'Intenta ajustar los filtros'
              : 'Los eventos aparecerán aquí cuando se registren'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Fecha/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Acción</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Campo</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Cambio</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {format(new Date(log.created_at), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(log.created_at), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {log.actor_email || 'Sistema'}
                      </div>
                      {log.actor_role && (
                        <div className="text-xs text-gray-500 capitalize">
                          {log.actor_role}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-700">
                        {log.field_changed || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.old_value || log.new_value ? (
                        <div className="text-sm space-y-1">
                          {log.old_value && (
                            <div className="text-red-600">
                              <span className="font-semibold">Antes:</span> {truncate(log.old_value, 30)}
                            </div>
                          )}
                          {log.new_value && (
                            <div className="text-green-600">
                              <span className="font-semibold">Después:</span> {truncate(log.new_value, 30)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                      >
                        Ver más →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

// =====================================================
// LOG DETAIL MODAL
// =====================================================

function LogDetailModal({ log, onClose }: { log: SecurityLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-8">
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Detalles del Log</h3>
              <p className="text-sm text-red-100 mt-1">
                {format(new Date(log.created_at), 'PPpp', { locale: es })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Acción</label>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${getActionColor(log.action_type)}`}>
              {log.action_type}
            </span>
          </div>

          {/* Actor Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email del Actor</label>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">
                {log.actor_email || 'Sistema automático'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Rol</label>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3 capitalize">
                {log.actor_role || '-'}
              </p>
            </div>
          </div>

          {/* Field Changed */}
          {log.field_changed && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Campo Modificado</label>
              <p className="text-sm font-mono text-gray-900 bg-gray-50 rounded-lg p-3">
                {log.field_changed}
              </p>
            </div>
          )}

          {/* Values */}
          {(log.old_value || log.new_value) && (
            <div className="grid grid-cols-2 gap-4">
              {log.old_value && (
                <div>
                  <label className="block text-sm font-bold text-red-700 mb-2">Valor Anterior</label>
                  <p className="text-sm text-gray-900 bg-red-50 rounded-lg p-3 border border-red-200 whitespace-pre-wrap">
                    {log.old_value}
                  </p>
                </div>
              )}
              {log.new_value && (
                <div>
                  <label className="block text-sm font-bold text-green-700 mb-2">Valor Nuevo</label>
                  <p className="text-sm text-gray-900 bg-green-50 rounded-lg p-3 border border-green-200 whitespace-pre-wrap">
                    {log.new_value}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Technical Details */}
          <div className="grid grid-cols-2 gap-4">
            {log.ip_address && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Dirección IP</label>
                <p className="text-sm font-mono text-gray-900 bg-gray-50 rounded-lg p-3">
                  {log.ip_address}
                </p>
              </div>
            )}
            {log.user_agent && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">User Agent</label>
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 truncate" title={log.user_agent}>
                  {log.user_agent}
                </p>
              </div>
            )}
          </div>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Metadata (JSON)</label>
              <pre className="text-xs text-gray-900 bg-gray-50 rounded-lg p-3 overflow-x-auto border border-gray-200">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Footer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <FaInfoCircle className="text-yellow-600 mt-0.5" />
            <p className="text-xs text-yellow-800">
              <strong>Registro inmutable:</strong> Este log no puede ser editado ni eliminado.
              Todos los cambios en el sistema quedan permanentemente registrados para auditoría.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getActionColor(actionType: string): string {
  const colors: Record<string, string> = {
    'CASE_CREATED': 'bg-blue-100 text-blue-800',
    'STATUS_CHANGED': 'bg-purple-100 text-purple-800',
    'TICKET_GENERATED': 'bg-green-100 text-green-800',
    'TICKET_CHANGED': 'bg-orange-100 text-orange-800',
    'BROKER_ASSIGNED': 'bg-indigo-100 text-indigo-800',
    'MASTER_ASSIGNED': 'bg-pink-100 text-pink-800',
  };
  
  return colors[actionType] || 'bg-gray-100 text-gray-800';
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
