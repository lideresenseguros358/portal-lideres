'use client';

/**
 * BANCO Tab - Conciliación bancaria para comisiones
 * Solo accesible para rol MASTER
 */

import { useState, useEffect } from 'react';
import { FaFileImport, FaFilter, FaSearch, FaPlus, FaFolderOpen } from 'react-icons/fa';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { actionGetBankCutoffs, actionGetBankTransfers, actionGetLastCutoff } from '@/app/(app)/commissions/banco-actions';
import ImportBankCutoffModal from './ImportBankCutoffModal';
import TransfersTable from './TransfersTable';
import GroupsPanel from './GroupsPanel';
import { toast } from 'sonner';

interface BancoTabProps {
  role: string;
  insurers: { id: string; name: string }[];
}

export default function BancoTab({ role, insurers }: BancoTabProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [cutoffs, setCutoffs] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedCutoff, setSelectedCutoff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Cargar cortes
  useEffect(() => {
    loadCutoffs();
  }, [refreshKey]);

  // Cargar transferencias cuando cambia el corte o filtros
  useEffect(() => {
    if (selectedCutoff) {
      loadTransfers();
    }
  }, [selectedCutoff, filters, refreshKey]);

  const loadLastCutoff = async () => {
    const result = await actionGetLastCutoff();
    if (result.ok) {
      setLastCutoffInfo(result.data);
    }
  };

  const loadCutoffs = async () => {
    setLoading(true);
    const result = await actionGetBankCutoffs();
    if (result.ok) {
      setCutoffs(result.data || []);
      // Seleccionar el último corte por defecto
      if (result.data && result.data.length > 0 && !selectedCutoff) {
        setSelectedCutoff(result.data[0].id);
      }
    } else {
      toast.error('Error al cargar cortes');
    }
    setLoading(false);
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

  const handleImportSuccess = () => {
    setShowImportModal(false);
    setRefreshKey(prev => prev + 1);
    loadLastCutoff();
    toast.success('Corte bancario importado exitosamente');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const selectedCutoffData = cutoffs.find(c => c.id === selectedCutoff);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] flex items-center gap-3">
            🏦 BANCO
          </h2>
          <p className="text-gray-600 mt-1">
            Conciliación bancaria - Transferencias y grupos para comisiones
          </p>
          
          {/* Info del último corte */}
          {lastCutoffInfo && (
            <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-blue-900">📌 Último corte procesado:</p>
              <p className="text-blue-700">
                Hasta el <strong>{new Date(lastCutoffInfo.endDate).toLocaleDateString('es-PA')}</strong>
              </p>
              <p className="text-blue-600 mt-1">
                Rango sugerido para próximo corte: {' '}
                <strong>
                  {new Date(lastCutoffInfo.suggestedStart).toLocaleDateString('es-PA')} 
                  {' '} - {' '}
                  {new Date(lastCutoffInfo.suggestedEnd).toLocaleDateString('es-PA')}
                </strong>
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={() => setShowImportModal(true)}
          className="bg-[#8AAA19] hover:bg-[#010139] text-white"
        >
          <FaFileImport className="mr-2 text-white" />
          Importar Corte Bancario
        </Button>
      </div>

      {/* Selector de corte */}
      <Card className="bg-white shadow-lg border-2 border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <FaFolderOpen className="text-[#010139]" size={20} />
            <label className="font-semibold text-gray-700">Corte:</label>
          </div>
          
          <select
            value={selectedCutoff || ''}
            onChange={(e) => setSelectedCutoff(e.target.value)}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
          >
            <option value="">Seleccionar corte...</option>
            {cutoffs.map(cutoff => (
              <option key={cutoff.id} value={cutoff.id}>
                {new Date(cutoff.start_date).toLocaleDateString('es-PA')} - {new Date(cutoff.end_date).toLocaleDateString('es-PA')}
                {cutoff.notes && ` (${cutoff.notes})`}
              </option>
            ))}
          </select>

          {selectedCutoffData && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Creado:</span>{' '}
              {new Date(selectedCutoffData.created_at).toLocaleDateString('es-PA')}
            </div>
          )}
        </div>
      </Card>

      {/* Filtros */}
      <Card className="bg-white shadow-lg border-2 border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Estado */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaFilter className="inline mr-2" />
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
            >
              <option value="all">Todos</option>
              <option value="SIN_CLASIFICAR">Sin clasificar</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="OK_CONCILIADO">OK Conciliado</option>
              <option value="PAGADO">Pagado</option>
            </select>
          </div>

          {/* Aseguradora */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Aseguradora
            </label>
            <select
              value={filters.insurerId}
              onChange={(e) => setFilters(prev => ({ ...prev, insurerId: e.target.value }))}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
            >
              <option value="">Todas</option>
              {insurers.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
          </div>

          {/* Búsqueda */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaSearch className="inline mr-2" />
              Buscar
            </label>
            <input
              type="text"
              placeholder="Referencia, descripción..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
            />
          </div>
        </div>
      </Card>

      {/* Vista principal: Transferencias + Grupos */}
      {selectedCutoff ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transferencias (2/3) */}
          <div className="lg:col-span-2">
            <TransfersTable
              transfers={transfers}
              loading={loading}
              insurers={insurers}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Grupos (1/3) */}
          <div className="lg:col-span-1">
            <GroupsPanel
              insurers={insurers}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      ) : (
        <Card className="bg-white shadow-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FaFolderOpen className="text-gray-300 text-6xl mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Selecciona un corte bancario para ver las transferencias</p>
          <p className="text-gray-500 text-sm mt-2">o importa un nuevo corte desde el botón superior</p>
        </Card>
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <ImportBankCutoffModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
          lastCutoffInfo={lastCutoffInfo}
        />
      )}
    </div>
  );
}
