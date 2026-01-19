'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaPlus, FaFilter, FaTimes, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetCases } from '@/app/(app)/cases/actions';
import { 
  STATUS_LABELS_V2, 
  STATUS_COLORS_V2, 
  STATUS_ICONS_V2,
  SECTION_LABELS,
  type CaseStatusSimplified,
  type CaseSection,
} from '@/lib/ticketing/types';
import { formatTicketDisplay } from '@/lib/ticketing/ticket-generator';
import { calculateSLADaysRemaining, getSLABadgeColor, getSLALabel } from '@/lib/ticketing/sla-calculator';

interface CaseBoardProps {
  userRole: 'master' | 'broker';
  userBrokerId?: string;
}

interface Case {
  id: string;
  ticket_ref: string | null;
  client_name: string | null;
  policy_number: string | null;
  status_v2: CaseStatusSimplified;
  section: CaseSection;
  broker_id: string | null;
  admin_id: string | null;
  sla_date: string | null;
  sla_paused: boolean;
  sla_accumulated_pause_days: number;
  ramo_code: string | null;
  aseguradora_code: string | null;
  tramite_code: string | null;
  created_at: string;
  updated_at: string;
  brokers?: {
    name: string | null;
  };
  insurers?: {
    name: string;
  };
}

export default function CasesBoardV2({ userRole, userBrokerId }: CaseBoardProps) {
  const [activeSection, setActiveSection] = useState<CaseSection>('RAMOS_GENERALES');
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<CaseStatusSimplified | 'ALL'>('ALL');

  const loadCases = useCallback(async () => {
    setLoading(true);
    
    const result = await actionGetCases({
      section: activeSection,
    });

    if (result.ok) {
      setCases(result.data as Case[]);
    } else {
      toast.error(result.error || 'Error al cargar casos');
    }
    
    setLoading(false);
  }, [activeSection]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Filtrar casos
  const filteredCases = cases.filter(c => {
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        c.ticket_ref?.includes(search) ||
        c.client_name?.toLowerCase().includes(search) ||
        c.policy_number?.toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
    }

    // Filtro por estado
    if (filterStatus !== 'ALL' && c.status_v2 !== filterStatus) {
      return false;
    }

    return true;
  });

  // Agrupar por tipo de trámite
  const groupedByTramite = filteredCases.reduce((groups, c) => {
    const key = c.tramite_code || 'SIN_TRAMITE';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(c);
    return groups;
  }, {} as Record<string, Case[]>);

  // Ordenar casos dentro de cada grupo: SLA próximo arriba
  Object.keys(groupedByTramite).forEach(key => {
    const group = groupedByTramite[key];
    if (group) {
      group.sort((a, b) => {
        const slaA = calculateSLADaysRemaining(a.sla_date, a.sla_accumulated_pause_days || 0, a.sla_paused);
        const slaB = calculateSLADaysRemaining(b.sla_date, b.sla_accumulated_pause_days || 0, b.sla_paused);
        
        // Casos sin SLA al final
        if (slaA === null && slaB === null) return 0;
        if (slaA === null) return 1;
        if (slaB === null) return -1;
        
        return slaA - slaB;
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-6 border-l-4 border-[#010139] shadow-md">
        <h1 className="text-2xl font-bold text-[#010139] mb-2">
          📋 Pendientes / Casos
        </h1>
        <p className="text-gray-600">
          Sistema de tickets con código posicional de 12 dígitos
        </p>
      </div>

      {/* Sections Tabs */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {(['VIDA_ASSA', 'RAMOS_GENERALES', 'OTROS_PERSONAS'] as CaseSection[]).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit ${
                activeSection === section
                  ? 'bg-[#010139] text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {SECTION_LABELS[section]}
            </button>
          ))}
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
                placeholder="Buscar por ticket, cliente o póliza..."
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

          {/* Status Filter */}
          <div className="sm:w-64">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as CaseStatusSimplified | 'ALL')}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="ALL">Todos los estados</option>
              <option value="NUEVO">🆕 Nuevo</option>
              <option value="EN_PROCESO">⚙️ En proceso</option>
              <option value="PENDIENTE_CLIENTE">👤 Pendiente cliente</option>
              <option value="PENDIENTE_BROKER">🤝 Pendiente broker</option>
              <option value="ENVIADO">📤 Enviado</option>
              <option value="APLAZADO">⏸️ Aplazado</option>
            </select>
          </div>

          {/* New Case Button */}
          {userRole === 'master' && (
            <button
              onClick={() => toast.info('Abrir modal de nuevo caso')}
              className="bg-[#8AAA19] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6d8814] transition-colors flex items-center gap-2 shadow-md whitespace-nowrap"
            >
              <FaPlus className="text-white" /> Nuevo Caso
            </button>
          )}
        </div>
      </div>

      {/* Cases Board */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando casos...</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-gray-500 text-lg">No hay casos en esta sección</p>
          <p className="text-gray-400 text-sm mt-2">Los casos aparecerán aquí cuando se creen</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByTramite).map(([tramiteCode, casesInGroup]) => (
            <TramiteGroup
              key={tramiteCode}
              tramiteCode={tramiteCode}
              cases={casesInGroup}
              onReload={loadCases}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// TRAMITE GROUP
// =====================================================

function TramiteGroup({
  tramiteCode,
  cases,
  onReload,
}: {
  tramiteCode: string;
  cases: Case[];
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Nombre del trámite (TODO: obtener de catálogo)
  const getTramiteName = (code: string) => {
    const names: Record<string, string> = {
      '1': 'Emisión',
      '2': 'Renovación',
      '3': 'Siniestro',
      '4': 'Endoso',
      '5': 'Cobro',
      '6': 'Cotización',
      '7': 'Cancelación',
      '8': 'Rehabilitación',
      '9': 'Cambio de Corredor',
      'SIN_TRAMITE': 'Sin clasificar',
    };
    return names[code] || `Trámite ${code}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex items-center justify-between hover:from-gray-100 hover:to-gray-50 transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div className="text-left">
            <h3 className="font-bold text-[#010139] text-lg">
              {getTramiteName(tramiteCode)}
            </h3>
            <p className="text-sm text-gray-600">
              {cases.length} {cases.length === 1 ? 'caso' : 'casos'}
            </p>
          </div>
        </div>
        <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Cases List */}
      {expanded && (
        <div className="divide-y divide-gray-200">
          {cases.map((c) => (
            <CaseCard key={c.id} case={c} onReload={onReload} />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// CASE CARD
// =====================================================

function CaseCard({ case: c, onReload }: { case: Case; onReload: () => void }) {
  const slaDays = calculateSLADaysRemaining(
    c.sla_date,
    c.sla_accumulated_pause_days || 0,
    c.sla_paused
  );

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex items-start gap-4">
        {/* Ticket Number */}
        <div className="flex-shrink-0">
          {c.ticket_ref ? (
            <div className="bg-[#010139] text-white px-3 py-2 rounded-lg">
              <p className="text-xs font-bold opacity-75">TICKET</p>
              <p className="font-mono font-bold text-sm">
                {formatTicketDisplay(c.ticket_ref)}
              </p>
            </div>
          ) : (
            <div className="bg-gray-200 text-gray-500 px-3 py-2 rounded-lg">
              <p className="text-xs font-bold">SIN TICKET</p>
              <p className="text-xs">Por clasificar</p>
            </div>
          )}
        </div>

        {/* Case Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-[#010139] truncate">
                {c.client_name || 'Cliente sin nombre'}
              </h4>
              {c.policy_number && (
                <p className="text-sm text-gray-600 truncate">
                  Póliza: {c.policy_number}
                </p>
              )}
              {c.brokers?.name && (
                <p className="text-xs text-gray-500 mt-1">
                  Broker: {c.brokers.name}
                </p>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS_V2[c.status_v2]}`}>
                {STATUS_ICONS_V2[c.status_v2]} {STATUS_LABELS_V2[c.status_v2]}
              </span>
            </div>
          </div>

          {/* SLA Badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${getSLABadgeColor(slaDays)}`}>
              <FaClock className="text-xs" />
              {getSLALabel(slaDays, c.sla_paused)}
            </span>

            {c.insurers?.name && (
              <span className="text-xs text-gray-500">
                {c.insurers.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions (TODO) */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.info('Ver detalles del caso');
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
        >
          Ver detalles →
        </button>
      </div>
    </div>
  );
}
