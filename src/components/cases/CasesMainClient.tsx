'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaPlus, FaDownload, FaEnvelope, FaFilter, FaList, FaThLarge } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetCases } from '@/app/(app)/cases/actions';
import { actionGetCaseStats } from '@/app/(app)/cases/actions-details';
import CasesList from '@/components/cases/CasesList';
import SearchModal from '@/components/cases/SearchModal';
import { CASE_SECTION_LABELS } from '@/lib/constants/cases';

type UserProfile = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email: string;
  role: string | null;
  avatar_url?: string | null;
  broker_id?: string | null;
  created_at?: string;
  demo_enabled?: boolean;
  must_change_password?: boolean | null;
};

type Broker = {
  id: string;
  name: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

type Insurer = {
  id: string;
  name: string;
  active: boolean | null;
  created_at?: string | null;
  invert_negatives: boolean | null;
  use_multi_commission_columns: boolean | null;
};

interface CasesMainClientProps {
  userProfile: UserProfile;
  brokers: Broker[];
  insurers: Insurer[];
}

export default function CasesMainClient({ userProfile, brokers, insurers }: CasesMainClientProps) {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('RAMOS_GENERALES');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [kanbanEnabled, setKanbanEnabled] = useState(false);
  const [filters, setFilters] = useState<{
    status?: string;
    broker_id?: string;
    insurer_id?: string;
    search?: string;
  }>({});

  const loadCases = useCallback(async () => {
    setLoading(true);
    const result = await actionGetCases({
      section: activeTab,
      ...filters,
    });

    if (result.ok) {
      setCases(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [activeTab, filters]);

  const loadStats = useCallback(async () => {
    const result = await actionGetCaseStats();
    if (result.ok) {
      setStats(result.data);
    }
  }, []);

  useEffect(() => {
    loadCases();
    loadStats();
  }, [loadCases, loadStats]);

  useEffect(() => {
    // Cargar configuración de Kanban desde localStorage
    try {
      const savedConfig = localStorage.getItem('cases_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setKanbanEnabled(config.kanban_enabled || false);
      }
    } catch (error) {
      console.error('Error loading kanban config:', error);
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedCases([]);
  };

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
    setShowSearch(false);
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCases.length === cases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(cases.map(c => c.id));
    }
  };

  const handleExportPDF = () => {
    if (selectedCases.length === 0) {
      toast.warning('Selecciona al menos un caso');
      return;
    }
    // TODO: Implement PDF export
    toast.info('Exportando PDF...');
  };

  const handleSendEmail = () => {
    if (selectedCases.length === 0) {
      toast.warning('Selecciona al menos un caso');
      return;
    }
    // TODO: Implement email send
    toast.info('Enviando correo...');
  };

  const tabs = [
    { key: 'RAMOS_GENERALES', label: 'Ramos Generales', badge: stats?.by_section?.RAMOS_GENERALES || 0 },
    { key: 'VIDA_ASSA', label: 'Vida ASSA', badge: stats?.by_section?.VIDA_ASSA || 0, priority: userProfile.role === 'broker' },
    { key: 'OTROS_PERSONAS', label: 'Otros Personas', badge: stats?.by_section?.OTROS_PERSONAS || 0 },
  ];

  if (userProfile.role === 'master') {
    tabs.push({ key: 'SIN_CLASIFICAR', label: 'Sin clasificar', badge: stats?.by_section?.SIN_CLASIFICAR || 0, priority: false });
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] flex items-center gap-3">
              Pendientes (Trámites)
              {stats?.sin_ver > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 border-2 border-red-300 rounded-full text-sm font-semibold">
                  {stats.sin_ver} nuevos
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1">
              {stats?.total || 0} casos activos
              {stats?.sla_vencido > 0 && (
                <span className="ml-2 text-red-600 font-semibold">
                  • {stats.sla_vencido} vencidos
                </span>
              )}
              {stats?.sla_por_vencer > 0 && (
                <span className="ml-2 text-orange-600 font-semibold">
                  • {stats.sla_por_vencer} por vencer
                </span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Lista/Kanban */}
            {kanbanEnabled && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white shadow text-[#010139] font-semibold' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="Vista Lista"
                >
                  <FaList />
                  <span className="hidden sm:inline">Lista</span>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all ${
                    viewMode === 'kanban' 
                      ? 'bg-white shadow text-[#010139] font-semibold' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="Vista Kanban"
                >
                  <FaThLarge />
                  <span className="hidden sm:inline">Kanban</span>
                </button>
              </div>
            )}
            
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all flex items-center gap-2"
            >
              <FaSearch />
              <span className="hidden sm:inline">Buscar</span>
            </button>

            {userProfile.role === 'master' && (
              <button
                onClick={() => window.location.href = '/cases/new'}
                className="px-4 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <FaPlus />
                <span className="hidden sm:inline">Nuevo</span>
              </button>
            )}

            {selectedCases.length > 0 && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all flex items-center gap-2"
                >
                  <FaDownload />
                  <span className="hidden sm:inline">PDF ({selectedCases.length})</span>
                </button>

                <button
                  onClick={handleSendEmail}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2"
                >
                  <FaEnvelope />
                  <span className="hidden sm:inline">Enviar ({selectedCases.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 bg-gray-50 rounded-xl p-3 sm:p-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`
                  px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit
                  ${activeTab === tab.key 
                    ? 'bg-[#010139] text-white shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                  }
                  ${tab.priority ? 'ring-2 ring-[#8AAA19] ring-offset-2' : ''}
                `}
              >
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                    ${activeTab === tab.key ? 'bg-[#8AAA19] text-white' : 'bg-gray-300 text-gray-700'}
                  `}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filters (Mobile Dropdown, Desktop Inline) */}
        {userProfile.role === 'master' && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE_REVISION">Pendiente revisión</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="FALTA_DOC">Falta documentación</option>
              <option value="APLAZADO">Aplazado</option>
              <option value="EMITIDO">Emitido</option>
              <option value="CERRADO">Cerrado</option>
            </select>

            <select
              value={filters.broker_id || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, broker_id: e.target.value || undefined }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Todos los brokers</option>
              {brokers.map(broker => {
                const brokerName = broker.name || broker.profiles?.full_name || broker.profiles?.email || 'Sin nombre';
                return (
                  <option key={broker.id} value={broker.id}>
                    {brokerName}
                  </option>
                );
              })}
            </select>

            <select
              value={filters.insurer_id || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, insurer_id: e.target.value || undefined }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Todas las aseguradoras</option>
              {insurers.map(insurer => (
                <option key={insurer.id} value={insurer.id}>
                  {insurer.name}
                </option>
              ))}
            </select>

            {Object.keys(filters).length > 0 && (
              <button
                onClick={() => setFilters({})}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cases List or Kanban */}
      {viewMode === 'list' ? (
        <CasesList
          cases={cases}
          loading={loading}
          selectedCases={selectedCases}
          onSelectCase={handleSelectCase}
          onSelectAll={handleSelectAll}
          onRefresh={loadCases}
          userRole={userProfile.role || 'broker'}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-12 text-center">
          <FaThLarge className="mx-auto text-6xl text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">Vista Kanban</h3>
          <p className="text-gray-500 mb-4">Funcionalidad en desarrollo</p>
          <p className="text-sm text-gray-400">Los casos se organizarán en columnas por estado</p>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onSearch={handleSearch}
          insurers={insurers}
        />
      )}
    </>
  );
}
