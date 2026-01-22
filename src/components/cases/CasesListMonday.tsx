'use client';

import { useState, useMemo } from 'react';
import { FaChevronDown, FaChevronUp, FaClock, FaFolder, FaEnvelope, FaEdit, FaTicketAlt, FaExternalLinkAlt } from 'react-icons/fa';
import { getSLAColor, getSLALabel, STATUS_COLORS, CASE_STATUS_LABELS, MANAGEMENT_TYPES } from '@/lib/constants/cases';
import Link from 'next/link';
import EmailHistoryModal from './EmailHistoryModal';

interface CasesListMondayProps {
  cases: any[];
  loading: boolean;
  selectedCases: string[];
  onSelectCase: (id: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  userRole: string;
  onEdit?: (caseId: string) => void;
  onChangeStatus?: (caseId: string, newStatus: string) => void;
  onChangeSLA?: (caseId: string, newDate: string) => void;
}

export default function CasesListMonday({
  cases,
  loading,
  selectedCases,
  onSelectCase,
  onSelectAll,
  onRefresh,
  userRole,
  onEdit,
  onChangeStatus,
  onChangeSLA,
}: CasesListMondayProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [emailHistoryCaseId, setEmailHistoryCaseId] = useState<string | null>(null);

  // Agrupar casos por tipo de trámite
  const groupedCases = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    // Ordenar casos: por vencer primero, luego nuevos
    const sortedCases = [...cases].sort((a, b) => {
      // Primero por fecha SLA (casos por vencer arriba)
      if (a.sla_date && b.sla_date) {
        return new Date(a.sla_date).getTime() - new Date(b.sla_date).getTime();
      }
      if (a.sla_date && !b.sla_date) return -1;
      if (!a.sla_date && b.sla_date) return 1;
      
      // Luego por fecha de creación (más nuevos abajo)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    sortedCases.forEach(caseItem => {
      const managementType = caseItem.management_type || 'SIN_TIPO';
      if (!groups[managementType]) {
        groups[managementType] = [];
      }
      groups[managementType].push(caseItem);
    });

    return groups;
  }, [cases]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupKey)
        ? prev.filter(k => k !== groupKey)
        : [...prev, groupKey]
    );
  };

  const calculateSLADaysRemaining = (slaDate: string | null) => {
    if (!slaDate) return null;
    const today = new Date();
    const sla = new Date(slaDate);
    const diffTime = sla.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 mt-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-12 text-center mt-4">
        <div className="text-gray-400 text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold text-gray-600 mb-2">No hay casos</h3>
        <p className="text-gray-500">No se encontraron casos para esta sección.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Select All */}
      <div className="flex items-center gap-2 bg-white rounded-lg shadow p-3 border-2 border-gray-100">
        <input
          type="checkbox"
          checked={selectedCases.length === cases.length && cases.length > 0}
          onChange={onSelectAll}
          className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
        />
        <label className="text-sm font-semibold text-gray-700">
          Seleccionar todos ({cases.length})
        </label>
      </div>

      {/* Grupos por tipo de trámite */}
      {Object.entries(groupedCases).map(([managementType, groupCases]) => {
        const isExpanded = expandedGroups.includes(managementType);
        const managementLabel = MANAGEMENT_TYPES[managementType as keyof typeof MANAGEMENT_TYPES] || managementType;

        return (
          <div key={managementType} className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(managementType)}
              className="w-full px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all flex items-center justify-between border-b-2 border-gray-200"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <FaChevronUp className="text-[#010139]" /> : <FaChevronDown className="text-[#010139]" />}
                <h3 className="text-lg font-bold text-[#010139]">{managementLabel}</h3>
                <span className="px-3 py-1 bg-[#010139] text-white rounded-full text-sm font-semibold">
                  {groupCases.length}
                </span>
              </div>
            </button>

            {/* Group Content */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
                {groupCases.map((caseItem) => {
                  const isSelected = selectedCases.includes(caseItem.id);
                  const daysRemaining = calculateSLADaysRemaining(caseItem.sla_date);
                  const slaColor = getSLAColor(daysRemaining);
                  const slaLabel = getSLALabel(daysRemaining);

                  return (
                    <div
                      key={caseItem.id}
                      className={`p-4 hover:bg-gray-50 transition-all ${
                        isSelected ? 'bg-green-50 border-l-4 border-[#8AAA19]' : ''
                      }`}
                    >
                      {/* Desktop: Tabla tipo Monday */}
                      <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                        {/* Checkbox */}
                        <div className="col-span-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onSelectCase(caseItem.id)}
                            className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                          />
                        </div>

                        {/* Ticket */}
                        <div className="col-span-1">
                          {caseItem.ticket_ref && (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300">
                              #{caseItem.ticket_ref}
                            </span>
                          )}
                        </div>

                        {/* Cliente */}
                        <div className="col-span-2">
                          <p className="font-semibold text-[#010139] truncate">
                            {caseItem.client_name || caseItem.client?.name || 'Sin nombre'}
                          </p>
                        </div>

                        {/* Aseguradora */}
                        <div className="col-span-2">
                          <p className="text-sm text-gray-700 truncate">
                            {caseItem.insurer?.name || 'Sin aseguradora'}
                          </p>
                        </div>

                        {/* Estado - Dropdown inline */}
                        <div className="col-span-2">
                          {userRole === 'master' ? (
                            <select
                              value={caseItem.status}
                              onChange={(e) => onChangeStatus?.(caseItem.id, e.target.value)}
                              className={`w-full px-2 py-1 rounded text-xs font-semibold border-2 ${STATUS_COLORS[caseItem.status as keyof typeof STATUS_COLORS]}`}
                            >
                              <option value="PENDIENTE_REVISION">Pendiente revisión</option>
                              <option value="EN_PROCESO">En proceso</option>
                              <option value="FALTA_DOC">Falta documentación</option>
                              <option value="APLAZADO">Aplazado</option>
                              <option value="EMITIDO">Emitido</option>
                              <option value="CERRADO">Cerrado</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${STATUS_COLORS[caseItem.status as keyof typeof STATUS_COLORS]}`}>
                              {CASE_STATUS_LABELS[caseItem.status as keyof typeof CASE_STATUS_LABELS]}
                            </span>
                          )}
                        </div>

                        {/* SLA / Plazo */}
                        <div className="col-span-2">
                          {caseItem.sla_date && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${slaColor}`}>
                              <FaClock />
                              {slaLabel}
                            </span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="col-span-2 flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEmailHistoryCaseId(caseItem.id)}
                            className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition-all"
                            title="Historial de correos"
                          >
                            <FaEnvelope className="text-white" />
                          </button>

                          <button
                            onClick={() => onEdit?.(caseItem.id)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-all"
                            title="Editar"
                          >
                            <FaEdit />
                          </button>
                          
                          <Link
                            href={`/cases/${caseItem.id}`}
                            className="p-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded transition-all"
                            title="Ver expediente"
                          >
                            <FaFolder className="text-white" />
                          </Link>

                          {caseItem.ticket_ref && (
                            <button
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-all"
                              title="Ver ticket"
                            >
                              <FaTicketAlt className="text-white" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mobile: Card compacto */}
                      <div className="md:hidden space-y-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onSelectCase(caseItem.id)}
                            className="mt-1 w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#010139] mb-1">
                              {caseItem.client_name || caseItem.client?.name || 'Sin nombre'}
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                              {caseItem.insurer?.name || 'Sin aseguradora'}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[caseItem.status as keyof typeof STATUS_COLORS]}`}>
                                {CASE_STATUS_LABELS[caseItem.status as keyof typeof CASE_STATUS_LABELS]}
                              </span>
                              {caseItem.sla_date && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${slaColor}`}>
                                  <FaClock />
                                  {slaLabel}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setEmailHistoryCaseId(caseItem.id)}
                                className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-semibold"
                              >
                                <FaEnvelope className="inline mr-1 text-white" />
                                Correos
                              </button>
                              <button
                                onClick={() => onEdit?.(caseItem.id)}
                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-semibold"
                              >
                                <FaEdit className="inline mr-1" />
                                Editar
                              </button>
                              <Link
                                href={`/cases/${caseItem.id}`}
                                className="px-3 py-1 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded text-sm font-semibold"
                              >
                                <FaFolder className="inline mr-1 text-white" />
                                Expediente
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Email History Modal */}
      {emailHistoryCaseId && (
        <EmailHistoryModal
          caseId={emailHistoryCaseId}
          onClose={() => setEmailHistoryCaseId(null)}
        />
      )}
    </div>
  );
}
