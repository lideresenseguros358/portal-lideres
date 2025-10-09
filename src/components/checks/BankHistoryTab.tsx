'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaChevronDown, FaChevronRight, FaFileImport } from 'react-icons/fa';
import { actionGetBankTransfers } from '@/app/(app)/checks/actions';
import ImportBankHistoryModal from './ImportBankHistoryModal';
import { toast } from 'sonner';

interface BankHistoryTabProps {
  onImportSuccess?: () => void;
  refreshTrigger?: number;
}

export default function BankHistoryTab({ onImportSuccess, refreshTrigger }: BankHistoryTabProps) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
    search: ''
  });

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const result = await actionGetBankTransfers({
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      if (result.ok) {
        setTransfers(result.data || []);
      } else {
        toast.error('Error al cargar historial');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transfers por búsqueda
  const filteredTransfers = transfers.filter(transfer => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      transfer.reference_number?.toLowerCase().includes(searchLower) ||
      transfer.description?.toLowerCase().includes(searchLower) ||
      transfer.payment_details?.some((detail: any) => 
        detail.client_name?.toLowerCase().includes(searchLower)
      )
    );
  });

  useEffect(() => {
    loadTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, refreshTrigger]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      available: { label: 'Disponible', color: 'bg-green-100 text-green-800 border-green-300' },
      partial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      exhausted: { label: 'Agotado', color: 'bg-gray-100 text-gray-800 border-gray-300' }
    };
    const badge = badges[status as keyof typeof badges] || badges.available;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">Historial de Banco</h2>
          <p className="text-sm sm:text-base text-gray-600">Transferencias recibidas del Banco General</p>
        </div>
        
        <button
          onClick={() => setShowImportModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium text-sm sm:text-base"
        >
          <FaFileImport />
          Importar Historial
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Buscar</label>
            <input
              type="text"
              placeholder="Nombre o referencia..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            />
          </div>

          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            >
              <option value="all">TODOS</option>
              <option value="available">DISPONIBLE</option>
              <option value="partial">PARCIAL</option>
              <option value="exhausted">AGOTADO</option>
            </select>
          </div>
          
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Desde</label>
            <input
              type="date"
              style={{ WebkitAppearance: 'none' }}
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            />
          </div>
          
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Hasta</label>
            <input
              type="date"
              style={{ WebkitAppearance: 'none' }}
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      {/* Resumen */}
      {!loading && filteredTransfers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total Usado</h3>
            <p className="text-3xl font-bold text-red-600 font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.used_amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#8AAA19]">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total Recibido</h3>
            <p className="text-3xl font-bold text-[#8AAA19] font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#010139]">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total Disponible</h3>
            <p className="text-3xl font-bold text-[#010139] font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.remaining_amount || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Tabla de Transferencias */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
            Cargando historial...
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No hay transferencias registradas</p>
            <p className="text-sm">Importa el historial del banco para comenzar</p>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No se encontraron resultados</p>
            <p className="text-sm">Intenta con otro término de búsqueda</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Referencia</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Usado</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Disponible</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransfers.map((transfer: any) => {
                  const isExpanded = expandedRows.has(transfer.id);
                  const paymentDetails = Array.isArray(transfer.payment_details) ? transfer.payment_details : [];
                  const hasDetails = paymentDetails.length > 0;
                  
                  return (
                    <>
                      <tr 
                        key={transfer.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => hasDetails && toggleRow(transfer.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(transfer.date).toLocaleDateString('es-PA')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono font-semibold text-[#010139]">
                            {transfer.reference_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {transfer.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-bold text-gray-900">
                            ${parseFloat(transfer.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-red-600">
                            ${parseFloat(transfer.used_amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-[#8AAA19]">
                            ${parseFloat(transfer.remaining_amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {hasDetails && (
                            isExpanded ? <FaChevronDown className="text-gray-400" /> : <FaChevronRight className="text-gray-400" />
                          )}
                        </td>
                      </tr>
                      
                      {/* Detalles expandidos */}
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-blue-50">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-[#010139] mb-3">💳 Pagos Aplicados:</h4>
                              {paymentDetails.map((detail: any) => (
                                <div key={detail.id} className="bg-white rounded-lg p-3 border-l-4 border-[#8AAA19] flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium text-gray-900">{detail.client_name}</span>
                                      {detail.policy_number && (
                                        <span className="text-sm text-gray-600">Póliza: {detail.policy_number}</span>
                                      )}
                                      {detail.insurer_name && (
                                        <span className="text-sm text-gray-600">• {detail.insurer_name}</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {new Date(detail.paid_at).toLocaleString('es-PA')} • {detail.purpose}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-[#8AAA19]">
                                      ${parseFloat(detail.amount_used).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Vista móvil - Cards */}
        {!loading && filteredTransfers.length > 0 && (
          <div className="md:hidden divide-y divide-gray-200">
            {filteredTransfers.map((transfer) => {
              const isExpanded = expandedRows.has(transfer.id);
              const hasDetails = transfer.payment_details && transfer.payment_details.length > 0;
              
              return (
                <div key={transfer.id} className="p-4">
                  <div 
                    className="space-y-3"
                    onClick={() => hasDetails && toggleRow(transfer.id)}
                  >
                    {/* Header con fecha y referencia */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          {new Date(transfer.date).toLocaleDateString('es-PA')}
                        </p>
                        <p className="text-sm font-mono font-bold text-[#010139] mt-1">
                          {transfer.reference_number}
                        </p>
                      </div>
                      {getStatusBadge(transfer.status)}
                    </div>
                    
                    {/* Descripción */}
                    {transfer.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {transfer.description}
                      </p>
                    )}
                    
                    {/* Montos */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div>
                        <p className="text-xs text-gray-500">Monto</p>
                        <p className="text-sm font-bold text-gray-900">
                          ${parseFloat(transfer.amount).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Usado</p>
                        <p className="text-sm font-semibold text-red-600">
                          ${parseFloat(transfer.used_amount || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Disponible</p>
                        <p className="text-sm font-semibold text-[#8AAA19]">
                          ${parseFloat(transfer.remaining_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Indicador de expandible */}
                    {hasDetails && (
                      <div className="flex items-center justify-center pt-2">
                        {isExpanded ? (
                          <FaChevronDown className="text-gray-400 text-sm" />
                        ) : (
                          <FaChevronRight className="text-gray-400 text-sm" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Detalles expandidos */}
                  {isExpanded && hasDetails && (
                    <div className="mt-4 space-y-2 pt-4 border-t">
                      <h4 className="font-semibold text-sm text-[#010139] mb-3">💳 Pagos Aplicados:</h4>
                      {transfer.payment_details.map((detail: any) => (
                        <div key={detail.id} className="bg-blue-50 rounded-lg p-3 border-l-4 border-[#8AAA19]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">
                                {detail.client_name}
                              </p>
                              {detail.policy_number && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Póliza: {detail.policy_number}
                                </p>
                              )}
                              {detail.insurer_name && (
                                <p className="text-xs text-gray-600">
                                  {detail.insurer_name}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(detail.paid_at).toLocaleDateString('es-PA')} • {detail.purpose}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-bold text-sm text-[#8AAA19]">
                                ${parseFloat(detail.amount_used).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de importación */}
      {showImportModal && (
        <ImportBankHistoryModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadTransfers();
            setShowImportModal(false);
            if (onImportSuccess) {
              onImportSuccess();
            }
          }}
        />
      )}
    </div>
  );
}
