'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaPlus, FaChevronDown, FaChevronRight, FaFileImport, FaBan, FaTag, FaLock, FaLockOpen, FaEllipsisV } from 'react-icons/fa';
import { actionGetBankTransfers, actionToggleBlockTransfer, actionCategorizeTransfer } from '@/app/(app)/checks/actions';
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
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [categorizingId, setCategorizingId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close action menu on outside click
  useEffect(() => {
    if (!actionMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenuId]);

  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
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
        setTransfers([...(result.data || [])]);
      } else {
        toast.error('Error al cargar historial');
      }
    } catch (error) {
      console.error('Error cargando transferencias:', error);
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar transfers por búsqueda y categoría
  const filteredTransfers = transfers.filter(transfer => {
    // Category filter
    if (filters.category !== 'all' && (transfer.category || 'uncategorized') !== filters.category) {
      return false;
    }
    // Search filter
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      transfer.reference_number?.toLowerCase().includes(searchLower) ||
      transfer.description?.toLowerCase().includes(searchLower) ||
      transfer.payment_details?.some((detail: any) => 
        detail.client_name?.toLowerCase().includes(searchLower) ||
        detail.policy_number?.toLowerCase().includes(searchLower) ||
        detail.insurer_name?.toLowerCase().includes(searchLower) ||
        detail.purpose?.toLowerCase().includes(searchLower)
      )
    );
  });

  const blockedCount = filteredTransfers.filter(t => t.is_blocked).length;

  const handleToggleBlock = async (transferId: string, currentlyBlocked: boolean) => {
    if (!currentlyBlocked) {
      const reason = prompt('Razón del bloqueo (opcional):');
      if (reason === null) {
        // User cancelled the prompt — abort
        setActionMenuId(null);
        return;
      }
      setBlockingId(transferId);
      try {
        const result = await actionToggleBlockTransfer(transferId, true, reason || undefined);
        if (result.ok) {
          toast.success(result.message);
          loadTransfers();
        } else {
          toast.error(result.error || 'Error al bloquear');
        }
      } catch {
        toast.error('Error inesperado');
      } finally {
        setBlockingId(null);
        setActionMenuId(null);
      }
    } else {
      setBlockingId(transferId);
      try {
        const result = await actionToggleBlockTransfer(transferId, false);
        if (result.ok) {
          toast.success(result.message);
          loadTransfers();
        } else {
          toast.error(result.error || 'Error al desbloquear');
        }
      } catch {
        toast.error('Error inesperado');
      } finally {
        setBlockingId(null);
        setActionMenuId(null);
      }
    }
  };

  const handleCategorize = async (transferId: string, category: string) => {
    setCategorizingId(transferId);
    try {
      const result = await actionCategorizeTransfer(transferId, category as any);
      if (result.ok) {
        toast.success(result.message);
        loadTransfers();
      } else {
        toast.error(result.error || 'Error al categorizar');
      }
    } catch {
      toast.error('Error inesperado');
    } finally {
      setCategorizingId(null);
      setActionMenuId(null);
    }
  };

  const getCategoryBadge = (category: string | null) => {
    const cats: Record<string, { label: string; color: string }> = {
      prima: { label: 'Prima', color: 'bg-blue-100 text-blue-800' },
      devolucion: { label: 'Devolución', color: 'bg-orange-100 text-orange-800' },
      comision: { label: 'Comisión', color: 'bg-purple-100 text-purple-800' },
      adelanto: { label: 'Adelanto', color: 'bg-cyan-100 text-cyan-800' },
      otro: { label: 'Otro', color: 'bg-gray-100 text-gray-800' },
      uncategorized: { label: 'Sin cat.', color: 'bg-gray-50 text-gray-500' },
    };
    const cat = cats[category || 'uncategorized'] ?? cats['uncategorized']!;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat!.color}`}>
        {cat!.label}
      </span>
    );
  };

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

  const getStatusBadge = (status: string, isBlocked?: boolean) => {
    if (isBlocked) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold border-2 bg-red-100 text-red-800 border-red-300 inline-flex items-center gap-1">
          <FaLock className="text-[10px]" /> Bloqueado
        </span>
      );
    }
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
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium text-sm sm:text-base"
        >
          <FaFileImport />
          Importar Historial
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Categoría</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            >
              <option value="all">TODAS</option>
              <option value="prima">PRIMA</option>
              <option value="devolucion">DEVOLUCIÓN</option>
              <option value="comision">COMISIÓN</option>
              <option value="adelanto">ADELANTO</option>
              <option value="otro">OTRO</option>
              <option value="uncategorized">SIN CATEGORÍA</option>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-red-500">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 uppercase mb-2">Total Usado</h3>
            <p className="text-xl sm:text-3xl font-bold text-red-600 font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.used_amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-[#8AAA19]">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 uppercase mb-2">Total Recibido</h3>
            <p className="text-xl sm:text-3xl font-bold text-[#8AAA19] font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-[#010139]">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 uppercase mb-2">Total Disponible</h3>
            <p className="text-xl sm:text-3xl font-bold text-[#010139] font-mono">
              ${filteredTransfers.reduce((sum, t) => sum + parseFloat(t.remaining_amount || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-amber-500">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-600 uppercase mb-2">Bloqueadas</h3>
            <p className="text-xl sm:text-3xl font-bold text-amber-600 font-mono">
              {blockedCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">{filteredTransfers.length} transferencias</p>
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
          <div className="hidden md:block">
            <table className="w-full table-fixed">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="w-[10%] px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fecha</th>
                  <th className="w-[14%] px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Referencia</th>
                  <th className="w-[26%] px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Descripción</th>
                  <th className="w-[11%] px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Monto</th>
                  <th className="w-[11%] px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Usado</th>
                  <th className="w-[11%] px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Disponible</th>
                  <th className="w-[8%] px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Cat.</th>
                  <th className="w-[10%] px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  <th className="w-[5%] px-2 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransfers.map((transfer: any) => {
                  const isExpanded = expandedRows.has(transfer.id);
                  const paymentDetails = Array.isArray(transfer.payment_details) ? transfer.payment_details : [];
                  const hasDetails = paymentDetails.length > 0;
                  
                  return (
                    <React.Fragment key={transfer.id}>
                      <tr 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => hasDetails && toggleRow(transfer.id)}
                      >
                        <td className="px-3 py-4 text-sm text-gray-900 truncate">
                          {new Date(transfer.date).toLocaleDateString('es-PA')}
                        </td>
                        <td className="px-3 py-4 overflow-hidden">
                          <span
                            className="text-sm font-mono font-semibold text-[#010139] block truncate cursor-default"
                            title={transfer.reference_number}
                          >
                            {transfer.reference_number}
                          </span>
                        </td>
                        <td className="px-3 py-4 overflow-hidden">
                          <span className="text-sm text-gray-600 block truncate" title={transfer.description || ''}>
                            {transfer.description}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">
                            ${parseFloat(transfer.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right whitespace-nowrap">
                          <span className="text-sm font-semibold text-red-600">
                            ${parseFloat(transfer.used_amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right whitespace-nowrap">
                          <span className="text-sm font-semibold text-[#8AAA19]">
                            ${parseFloat(transfer.remaining_amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center whitespace-nowrap">
                          {getCategoryBadge(transfer.category)}
                        </td>
                        <td className="px-3 py-4 text-center whitespace-nowrap">
                          {getStatusBadge(transfer.status, transfer.is_blocked)}
                        </td>
                        <td className="px-2 py-4 text-center relative">
                          <div className="flex items-center gap-1">
                            {hasDetails && (
                              isExpanded ? <FaChevronDown className="text-gray-400" /> : <FaChevronRight className="text-gray-400" />
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === transfer.id ? null : transfer.id); }}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Acciones"
                            >
                              <FaEllipsisV className="text-gray-400 text-xs" />
                            </button>
                          </div>
                          {actionMenuId === transfer.id && (
                            <div ref={actionMenuRef} className="absolute right-0 top-full z-50 w-48 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 text-left" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleBlock(transfer.id, !!transfer.is_blocked)}
                                disabled={blockingId === transfer.id}
                                className="w-full px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-left"
                              >
                                {transfer.is_blocked ? <FaLockOpen className="text-green-600" /> : <FaLock className="text-red-600" />}
                                {transfer.is_blocked ? 'Desbloquear' : 'Bloquear'}
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase">Categorizar</div>
                              {['prima', 'devolucion', 'comision', 'adelanto', 'otro', 'uncategorized'].map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => handleCategorize(transfer.id, cat)}
                                  disabled={categorizingId === transfer.id}
                                  className={`w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left ${
                                    (transfer.category || 'uncategorized') === cat ? 'font-bold text-[#010139]' : 'text-gray-700'
                                  }`}
                                >
                                  {getCategoryBadge(cat)}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                      
                      {/* Detalles expandidos */}
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-blue-50">
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
                                    {detail.notes && (
                                      <div className="text-xs text-gray-600 mt-1 italic">
                                        📝 {detail.notes}
                                      </div>
                                    )}
                                    {detail.devolucion_tipo === 'cliente' && (
                                      <div className="text-xs text-blue-600 mt-2 space-y-0.5">
                                        <div><strong>Banco:</strong> {detail.banco_nombre || '-'}</div>
                                        <div><strong>Tipo:</strong> {detail.tipo_cuenta || '-'}</div>
                                        <div><strong>Cuenta:</strong> {detail.cuenta_banco || '-'}</div>
                                      </div>
                                    )}
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
                    </React.Fragment>
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
                        <p
                          className="text-sm font-mono font-bold text-[#010139] mt-1 max-w-[180px] truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileTooltip(mobileTooltip === transfer.id ? null : transfer.id);
                          }}
                        >
                          {transfer.reference_number}
                        </p>
                        {mobileTooltip === transfer.id && (
                          <p className="text-xs font-mono text-gray-600 mt-1 break-all bg-gray-100 rounded px-2 py-1">
                            {transfer.reference_number}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(transfer.status)}
                    </div>
                    
                    {/* Descripción */}
                    {transfer.description && (
                      <p className="text-sm text-gray-600 line-clamp-2" title={transfer.description}>
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
                              {detail.notes && (
                                <p className="text-xs text-gray-600 mt-1 italic">
                                  📝 {detail.notes}
                                </p>
                              )}
                              {detail.devolucion_tipo === 'cliente' && (
                                <div className="text-xs text-blue-600 mt-2 space-y-0.5">
                                  <div><strong>Banco:</strong> {detail.banco_nombre || '-'}</div>
                                  <div><strong>Tipo:</strong> {detail.tipo_cuenta || '-'}</div>
                                  <div><strong>Cuenta:</strong> {detail.cuenta_banco || '-'}</div>
                                </div>
                              )}
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
