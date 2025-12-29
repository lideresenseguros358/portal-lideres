'use client';

/**
 * Módulo Banco - Conciliación bancaria para comisiones
 * Solo accesible para rol MASTER
 * Diseño inspirado en módulo de Cheques para uniformidad
 */

import { useState, useEffect } from 'react';
import { FaFileImport, FaInfoCircle } from 'react-icons/fa';
import { actionGetBankCutoffs, actionGetBankTransfers, actionGetLastCutoff, actionGetBankGroupsByCutoff } from '@/app/(app)/commissions/banco-actions';
import ImportBankCutoffModal from './ImportBankCutoffModal';
import TransfersTable from './TransfersTable';
import GroupsTable from './GroupsTable';
import PendingTransfersView from './PendingTransfersView';
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
  const [selectedCutoff, setSelectedCutoff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [lastCutoffInfo, setLastCutoffInfo] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
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

  // Cargar transferencias y grupos cuando cambia el corte o filtros
  useEffect(() => {
    if (selectedCutoff) {
      loadTransfers();
      loadGroups();
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
    if (!selectedCutoff) return;
    
    setLoadingGroups(true);
    const result = await actionGetBankGroupsByCutoff(selectedCutoff);
    
    if (result.ok) {
      setGroups(result.data || []);
    } else {
      toast.error('Error al cargar grupos');
    }
    setLoadingGroups(false);
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
  };

  const selectedCutoffData = cutoffs.find(c => c.id === selectedCutoff);

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">🏦 Banco</h1>
          <p className="text-gray-600 text-base sm:text-lg">Conciliación bancaria de transferencias recibidas</p>
        </div>
        {/* Tab Navigation eliminado - solo vista de Transfers */}

        {/* Content */}
        <div>
            {/* Instructivo */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <FaInfoCircle className="text-blue-600 mt-1 flex-shrink-0" size={18} />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">💡 ¿Cómo funciona?</p>
                  <ul className="space-y-1 text-blue-800">
                    <li>• <strong>Importa</strong> el extracto bancario (Excel o CSV)</li>
                    <li>• <strong>Clasifica</strong> las transferencias por aseguradora y tipo</li>
                    <li>• <strong>Crea grupos</strong> para vincular con reportes de comisiones</li>
                    <li>• Al cerrar quincena, los grupos se marcan como PAGADO automáticamente</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Botón Importar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">Transferencias Bancarias</h2>
                <p className="text-sm sm:text-base text-gray-600">Clasificación y conciliación de pagos recibidos</p>
              </div>
              
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium text-sm sm:text-base"
              >
                <FaFileImport />
                Importar Corte
              </button>
            </div>

            {/* Info del último corte */}
            {lastCutoffInfo && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <p className="font-semibold text-blue-900 mb-2">📌 Último corte procesado</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700">Hasta el:</span>{' '}
                    <strong className="text-blue-900">{new Date(lastCutoffInfo.endDate).toLocaleDateString('es-PA')}</strong>
                  </div>
                  <div>
                    <span className="text-blue-700">Próximo sugerido:</span>{' '}
                    <strong className="text-blue-900">
                      {new Date(lastCutoffInfo.suggestedStart).toLocaleDateString('es-PA')} - {new Date(lastCutoffInfo.suggestedEnd).toLocaleDateString('es-PA')}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Vista de Transferencias Pendientes - SIEMPRE VISIBLE */}
            <PendingTransfersView 
              excludeCutoffId={selectedCutoff || undefined}
              currentCutoffId={selectedCutoff || undefined}
            />

            {/* Selector de Corte + Filtros */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Corte Bancario</label>
                  <select
                    value={selectedCutoff || ''}
                    onChange={(e) => setSelectedCutoff(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
                  >
                    <option value="">-- Selecciona --</option>
                    {cutoffs.map(cutoff => (
                      <option key={cutoff.id} value={cutoff.id}>
                        {new Date(cutoff.start_date).toLocaleDateString('es-PA')} - {new Date(cutoff.end_date).toLocaleDateString('es-PA')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
                  >
                    <option value="all">TODOS</option>
                    <option value="SIN_CLASIFICAR">SIN CLASIFICAR</option>
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="PAGADO">PAGADO</option>
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Aseguradora</label>
                  <select
                    value={filters.insurerId}
                    onChange={(e) => setFilters(prev => ({ ...prev, insurerId: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
                  >
                    <option value="">Todas</option>
                    {insurers.map(ins => (
                      <option key={ins.id} value={ins.id}>{ins.name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Buscar</label>
                  <input
                    type="text"
                    placeholder="Referencia o descripción..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>

            {/* Grupos de Transferencias */}
            <GroupsTable
              groups={groups}
              loading={loadingGroups}
              onGroupDeleted={() => setRefreshKey(prev => prev + 1)}
            />

            {/* Tabla de Transferencias */}
            <TransfersTable
              transfers={transfers}
              loading={loading}
              insurers={insurers}
              onRefresh={() => setRefreshKey(prev => prev + 1)}
            />
        </div>

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
