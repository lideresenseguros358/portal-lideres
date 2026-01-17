'use client';

/**
 * Módulo Banco - Conciliación bancaria para comisiones
 * Solo accesible para rol MASTER
 * Diseño inspirado en módulo de Cheques para uniformidad
 */

import { useState, useEffect } from 'react';
import { FaFileImport, FaInfoCircle, FaChevronDown, FaChevronUp, FaClock, FaSync, FaLayerGroup, FaList, FaCalendarAlt } from 'react-icons/fa';
import { actionGetBankCutoffs, actionGetBankTransfers, actionGetLastCutoff, actionGetBankGroupsByCutoff, actionGetIncludedTransfers, actionGetBankGroups } from '@/app/(app)/commissions/banco-actions';
import ImportBankCutoffModal from './ImportBankCutoffModal';
import TransfersTable from './TransfersTable';
import GroupsTable from './GroupsTable';
import PendingTransfersView from './PendingTransfersView';
import IncludedTransfersList from './IncludedTransfersList';
import { toast } from 'sonner';

interface BancoTabProps {
  role: string;
  insurers: { id: string; name: string }[];
}

export default function BancoTab({ role, insurers }: BancoTabProps) {
  // activeTab eliminado - solo transfers ahora
  const [showImportModal, setShowImportModal] = useState(false);
  const [cutoffs, setCutoffs] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [includedTransfers, setIncludedTransfers] = useState<any[]>([]);
  const [selectedCutoff, setSelectedCutoff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingIncluded, setLoadingIncluded] = useState(false);
  const [lastCutoffInfo, setLastCutoffInfo] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Estados para secciones colapsables
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    pending: false,
    transfers: true,
    included: false,
    groups: false
  });
  
  const [filters, setFilters] = useState({
    status: 'all',
    insurerId: '',
    search: '',
  });

  // Solo MASTER puede acceder
  if (role !== 'master') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Acceso denegado. Solo usuarios MASTER pueden acceder a BANCO.</p>
      </div>
    );
  }

  // Cargar último corte al montar
  useEffect(() => {
    loadLastCutoff();
  }, []);

  // Cargar cortes (solo al montar, no en cada refreshKey para evitar conflictos)
  useEffect(() => {
    loadCutoffs();
  }, []);

  // Cargar transferencias, grupos e incluidas cuando cambia el corte o filtros
  useEffect(() => {
    if (selectedCutoff) {
      loadTransfers();
      loadGroups();
      loadIncludedTransfers();
    }
  }, [selectedCutoff, filters, refreshKey]);

  const loadLastCutoff = async () => {
    const result = await actionGetLastCutoff();
    if (result.ok) {
      setLastCutoffInfo(result.data);
    }
  };

  const loadCutoffs = async (forceSelectLatest = false) => {
    setLoading(true);
    const result = await actionGetBankCutoffs();
    if (result.ok) {
      setCutoffs(result.data || []);
      // Seleccionar el último corte por defecto O si se fuerza (después de importar)
      if (result.data && result.data.length > 0) {
        if (!selectedCutoff || forceSelectLatest) {
          setSelectedCutoff(result.data[0].id);
        }
      }
    } else {
      toast.error('Error al cargar cortes');
    }
    setLoading(false);
  };

  const loadGroups = async () => {
    if (!selectedCutoff) {
      setGroups([]);
      return;
    }
    
    setLoadingGroups(true);
    // Cargar TODOS los grupos EN_PROCESO
    const result = await actionGetBankGroups({ status: 'EN_PROCESO' });
    
    if (result.ok) {
      const allGroups = result.data || [];
      
      // Filtrar para mostrar SOLO grupos que tengan transferencias del corte actual
      const groupsForCurrentCutoff = allGroups.filter((g: any) => {
        const name = (g.name || '').toLowerCase();
        
        // 1. Excluir grupos de sistema
        if (name.includes('otras quincenas') || 
            name.includes('otros cortes') ||
            name.includes('pagados en otras')) {
          return false;
        }
        
        // 2. Verificar que tenga transferencias del corte actual
        const transfers = g.transfers || [];
        const hasTransfersFromCutoff = transfers.some((t: any) => 
          t.bank_transfers_comm?.cutoff_id === selectedCutoff
        );
        
        return hasTransfersFromCutoff;
      });
      
      setGroups(groupsForCurrentCutoff);
    } else {
      toast.error('Error al cargar grupos');
    }
    setLoadingGroups(false);
  };

  const loadIncludedTransfers = async () => {
    if (!selectedCutoff) return;
    
    setLoadingIncluded(true);
    const result = await actionGetIncludedTransfers(selectedCutoff);
    
    if (result.ok) {
      setIncludedTransfers(result.data || []);
    } else {
      console.error('Error al cargar transferencias incluidas:', result.error);
      setIncludedTransfers([]);
    }
    setLoadingIncluded(false);
  };

  const loadTransfers = async () => {
    setLoading(true);
    const result = await actionGetBankTransfers({
      cutoffId: selectedCutoff || undefined,
      status: filters.status,
      insurerId: filters.insurerId || undefined,
      search: filters.search || undefined,
    });
    
    if (result.ok) {
      setTransfers(result.data || []);
    } else {
      toast.error('Error al cargar transferencias');
    }
    setLoading(false);
  };

  const handleImportSuccess = async () => {
    setShowImportModal(false);
    await loadLastCutoff();
    await loadCutoffs(true); // Forzar selección del nuevo corte
    setRefreshKey(prev => prev + 1); // Esto recargará las transferencias
    toast.success('Corte bancario importado exitosamente');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    loadCutoffs(); // Refrescar lista de cortes (elimina cortes vacíos)
    loadGroups(); // Refrescar grupos también
    loadIncludedTransfers(); // Refrescar transferencias incluidas
  };

  const selectedCutoffData = cutoffs.find(c => c.id === selectedCutoff);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {/* Header Mejorado */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">🏦 Banco</h1>
              <p className="text-sm sm:text-base text-gray-600">Conciliación bancaria de transferencias</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm"
              >
                <FaInfoCircle className="text-blue-600" />
                {showHelp ? 'Ocultar Ayuda' : 'Ver Ayuda'}
              </button>
              
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm"
              >
                <FaFileImport className="text-white" />
                Importar Extracto
              </button>
            </div>
          </div>

          {/* Ayuda Colapsable */}
          {showHelp && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4 animate-fadeIn">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <FaInfoCircle className="text-blue-600" />
                ¿Cómo funciona el módulo Banco?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <p><strong>Importa</strong> el extracto bancario (Excel o CSV)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <p><strong>Selecciona</strong> el corte bancario a trabajar</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <p><strong>Clasifica</strong> transferencias por aseguradora</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">4.</span>
                  <p><strong>Agrupa</strong> para vincular con reportes</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selector de Corte Principal - MUY DESTACADO */}
        <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-xl shadow-xl p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FaCalendarAlt className="text-white text-2xl" />
            <h2 className="text-lg sm:text-xl font-bold text-white">Seleccionar Corte Bancario</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm font-semibold mb-2">Período del Corte</label>
              <select
                value={selectedCutoff || ''}
                onChange={(e) => setSelectedCutoff(e.target.value)}
                className="w-full px-4 py-3 border-2 border-white/30 bg-white/95 rounded-lg focus:border-[#8AAA19] focus:outline-none focus:ring-2 focus:ring-[#8AAA19]/50 transition-all text-sm sm:text-base font-medium"
              >
                <option value="">-- Selecciona un corte --</option>
                {cutoffs.map(cutoff => (
                  <option key={cutoff.id} value={cutoff.id}>
                    {new Date(cutoff.start_date).toLocaleDateString('es-PA')} - {new Date(cutoff.end_date).toLocaleDateString('es-PA')}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedCutoffData && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <p className="text-white/80 text-xs font-semibold uppercase mb-2">Información del Corte</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/70 text-xs">Transferencias</p>
                    <p className="text-white font-bold text-lg">{transfers.length}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-xs">Grupos</p>
                    <p className="text-white font-bold text-lg">{groups.length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {lastCutoffInfo && !selectedCutoff && (
            <div className="mt-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-100 text-sm">
                <strong>💡 Sugerencia:</strong> El próximo corte sugerido es del{' '}
                <strong>{new Date(lastCutoffInfo.suggestedStart).toLocaleDateString('es-PA')}</strong> al{' '}
                <strong>{new Date(lastCutoffInfo.suggestedEnd).toLocaleDateString('es-PA')}</strong>
              </p>
            </div>
          )}
        </div>

        {!selectedCutoff ? (
          <div className="bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 p-8 sm:p-12 text-center">
            <FaCalendarAlt className="mx-auto text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">Selecciona un Corte Bancario</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Para comenzar, selecciona un corte bancario en el selector superior o importa un nuevo extracto.
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-colors font-semibold"
            >
              <FaFileImport className="text-white" />
              Importar Nuevo Extracto
            </button>
          </div>
        ) : (
          <>
            {/* Secciones Colapsables */}
            <div className="space-y-4">
              {/* Sección 1: Pendientes de Otros Cortes */}
              <div className="bg-white rounded-xl shadow-lg border-2 border-orange-200 overflow-hidden">
                <button
                  onClick={() => toggleSection('pending')}
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
                    {expandedSections.pending ? (
                      <FaChevronUp className="text-gray-500 text-lg" />
                    ) : (
                      <FaChevronDown className="text-gray-500 text-lg" />
                    )}
                  </div>
                </button>
                {expandedSections.pending && (
                  <div className="border-t-2 border-orange-100 animate-fadeIn">
                    <PendingTransfersView 
                      excludeCutoffId={selectedCutoff}
                      currentCutoffId={selectedCutoff}
                    />
                  </div>
                )}
              </div>

              {/* Sección 2: Transferencias del Corte */}
              <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden">
                <button
                  onClick={() => toggleSection('transfers')}
                  className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FaList className="text-blue-600 text-xl sm:text-2xl" />
                    <div className="text-left">
                      <h3 className="text-base sm:text-lg font-bold text-[#010139]">Transferencias del Corte Actual</h3>
                      <p className="text-xs sm:text-sm text-gray-600">Ver y clasificar todas las transferencias</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {transfers.length}
                    </span>
                    {expandedSections.transfers ? (
                      <FaChevronUp className="text-gray-500 text-lg" />
                    ) : (
                      <FaChevronDown className="text-gray-500 text-lg" />
                    )}
                  </div>
                </button>
                {expandedSections.transfers && (
                  <div className="border-t-2 border-blue-100 animate-fadeIn">
                    {/* Filtros dentro de la sección */}
                    <div className="bg-blue-50 p-4 border-b-2 border-blue-100">
                      <h4 className="text-sm font-bold text-blue-900 mb-3">Filtros de Búsqueda</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                          <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                          >
                            <option value="all">Todos</option>
                            <option value="SIN_CLASIFICAR">Sin Clasificar</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="PAGADO">Pagado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Aseguradora</label>
                          <select
                            value={filters.insurerId}
                            onChange={(e) => setFilters(prev => ({ ...prev, insurerId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                          >
                            <option value="">Todas</option>
                            {insurers.map(ins => (
                              <option key={ins.id} value={ins.id}>{ins.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Buscar</label>
                          <input
                            type="text"
                            placeholder="Referencia o descripción..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <TransfersTable
                      transfers={transfers}
                      loading={loading}
                      insurers={insurers}
                      onRefresh={() => setRefreshKey(prev => prev + 1)}
                    />
                  </div>
                )}
              </div>

              {/* Sección 3: Incluidas de Otros Cortes */}
              {includedTransfers.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('included')}
                    className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FaSync className="text-purple-600 text-xl sm:text-2xl" />
                      <div className="text-left">
                        <h3 className="text-base sm:text-lg font-bold text-[#010139]">Incluidas de Otros Cortes</h3>
                        <p className="text-xs sm:text-sm text-gray-600">Transferencias importadas de períodos anteriores</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {includedTransfers.length}
                      </span>
                      {expandedSections.included ? (
                        <FaChevronUp className="text-gray-500 text-lg" />
                      ) : (
                        <FaChevronDown className="text-gray-500 text-lg" />
                      )}
                    </div>
                  </button>
                  {expandedSections.included && (
                    <div className="border-t-2 border-purple-100 animate-fadeIn">
                      <IncludedTransfersList
                        transfers={includedTransfers}
                        onRefresh={handleRefresh}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Sección 4: Grupos Creados */}
              {groups.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border-2 border-green-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('groups')}
                    className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-green-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FaLayerGroup className="text-green-600 text-xl sm:text-2xl" />
                      <div className="text-left">
                        <h3 className="text-base sm:text-lg font-bold text-[#010139]">Grupos de Transferencias</h3>
                        <p className="text-xs sm:text-sm text-gray-600">Agrupaciones para reportes de comisiones</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {groups.length}
                      </span>
                      {expandedSections.groups ? (
                        <FaChevronUp className="text-gray-500 text-lg" />
                      ) : (
                        <FaChevronDown className="text-gray-500 text-lg" />
                      )}
                    </div>
                  </button>
                  {expandedSections.groups && (
                    <div className="border-t-2 border-green-100 animate-fadeIn">
                      <GroupsTable
                        groups={groups}
                        loading={loadingGroups}
                        onGroupDeleted={() => setRefreshKey(prev => prev + 1)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* CSS para animación */}
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>

        {/* Modal de Importación */}
        {showImportModal && (
          <ImportBankCutoffModal
            onClose={() => setShowImportModal(false)}
            onSuccess={handleImportSuccess}
            lastCutoffInfo={lastCutoffInfo}
          />
        )}
      </div>
    </div>
  );
}
