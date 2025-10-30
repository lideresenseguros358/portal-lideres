'use client';

import { useState } from 'react';
import { FaEye, FaChevronDown, FaChevronUp, FaClock, FaExclamationTriangle, FaCheckCircle, FaDownload, FaExternalLinkAlt, FaFolder, FaFileAlt } from 'react-icons/fa';
import { getSLAColor, getSLALabel, STATUS_COLORS, CASE_STATUS_LABELS, MANAGEMENT_TYPES } from '@/lib/constants/cases';
import { actionMarkCaseSeen } from '@/app/(app)/cases/actions';
import { toast } from 'sonner';
import Link from 'next/link';

interface CasesListProps {
  cases: any[];
  loading: boolean;
  selectedCases: string[];
  onSelectCase: (id: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  userRole: string;
}

export default function CasesList({
  cases,
  loading,
  selectedCases,
  onSelectCase,
  onSelectAll,
  onRefresh,
  userRole,
}: CasesListProps) {
  const [expandedCases, setExpandedCases] = useState<string[]>([]);

  const toggleExpand = (caseId: string) => {
    setExpandedCases(prev =>
      prev.includes(caseId)
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const handleMarkSeen = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await actionMarkCaseSeen(caseId);
    if (result.ok) {
      toast.success('Marcado como visto');
      onRefresh();
    } else {
      toast.error(result.error);
    }
  };

  const calculateProgress = (caseItem: any) => {
    // Simple progress based on status
    const statusProgress: Record<string, number> = {
      'PENDIENTE_REVISION': 10,
      'EN_PROCESO': 40,
      'FALTA_DOC': 30,
      'APROBADO_PEND_PAGO': 70,
      'EMITIDO': 90,
      'CERRADO': 100,
      'APLAZADO': 20,
      'RECHAZADO': 0,
    };
    return statusProgress[caseItem.status] || 0;
  };

  const calculateSLADaysRemaining = (slaDate: string | null) => {
    if (!slaDate) return null;
    const today = new Date();
    const sla = new Date(slaDate);
    const diffTime = sla.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Mapear management_type a ruta de descargas
  const getDownloadsLink = (managementType: string, insurerId?: string) => {
    // Mapeo de management_type a scope/type
    const typeMap: Record<string, { scope: string; type: string }> = {
      'EMISION_VIDA': { scope: 'personas', type: 'vida_assa' },
      'EMISION_AUTO': { scope: 'generales', type: 'auto' },
      'EMISION_SALUD': { scope: 'personas', type: 'salud' },
      'EMISION_INCENDIO': { scope: 'generales', type: 'incendio' },
      'RENOVACION_AUTO': { scope: 'generales', type: 'auto' },
      'RENOVACION_VIDA': { scope: 'personas', type: 'vida_assa' },
      'ENDOSO': { scope: 'generales', type: 'auto' },
      'RECLAMO': { scope: 'generales', type: 'auto' },
    };

    const mapping = typeMap[managementType];
    if (!mapping) return null;

    if (insurerId) {
      return `/downloads/${mapping.scope}/${mapping.type}/${insurerId}`;
    }
    return `/downloads/${mapping.scope}/${mapping.type}`;
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
    <>
      {/* Select All (Desktop only) */}
      <div className="hidden md:flex items-center gap-2 bg-white rounded-lg shadow p-3 border-2 border-gray-100 mb-3">
        <input
          type="checkbox"
          checked={selectedCases.length === cases.length}
          onChange={onSelectAll}
          className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
        />
        <label className="text-sm font-semibold text-gray-700">
          Seleccionar todos ({cases.length})
        </label>
      </div>

      {/* Cases Cards (Mobile-first) */}
      <div className="space-y-3 mt-4 md:mt-0">
      {cases.map((caseItem) => {
        const isExpanded = expandedCases.includes(caseItem.id);
        const isSelected = selectedCases.includes(caseItem.id);
        const progress = calculateProgress(caseItem);
        const daysRemaining = calculateSLADaysRemaining(caseItem.sla_date);
        const slaColor = getSLAColor(daysRemaining);
        const slaLabel = getSLALabel(daysRemaining);

        return (
          <div
            key={caseItem.id}
            className={`
              bg-white rounded-xl shadow-lg border-2 transition-all
              ${isSelected ? 'border-[#8AAA19] ring-2 ring-[#8AAA19] ring-opacity-50' : 'border-gray-100'}
              hover:shadow-xl
            `}
          >
            {/* Header (Always visible) */}
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelectCase(caseItem.id)}
                  className="mt-1 w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[#010139] text-lg">
                        {caseItem.client_name || caseItem.client?.name || 'Sin nombre'}
                      </h3>
                      {!caseItem.seen_by_broker && userRole === 'broker' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded-full text-xs font-semibold">
                          Nuevo
                        </span>
                      )}
                    </div>

                    {/* Actions Mobile-First */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Expediente Button - Only if client_id exists */}
                      {caseItem.client_id && (
                        <Link
                          href={`/cases/${caseItem.id}?tab=expediente`}
                          className="p-2 sm:px-3 sm:py-2 bg-[#8AAA19] hover:bg-[#6d8814] text-white rounded-lg transition-all flex items-center gap-1 text-sm font-semibold"
                          title="Ver Expediente"
                        >
                          <FaFolder />
                          <span className="hidden sm:inline">Expediente</span>
                        </Link>
                      )}

                      {/* Mark as Seen - Broker only */}
                      {!caseItem.seen_by_broker && userRole === 'broker' && (
                        <button
                          onClick={(e) => handleMarkSeen(caseItem.id, e)}
                          className="p-2 text-[#010139] hover:bg-blue-50 rounded-lg transition-all"
                          title="Marcar como visto"
                        >
                          <FaEye size={18} />
                        </button>
                      )}

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleExpand(caseItem.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                        title={isExpanded ? 'Contraer' : 'Expandir'}
                      >
                        {isExpanded ? <FaChevronUp size={18} /> : <FaChevronDown size={18} />}
                      </button>

                      {/* View Detail - Primary Action */}
                      <Link
                        href={`/cases/${caseItem.id}`}
                        className="px-3 py-2 sm:px-4 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-1"
                      >
                        <FaFileAlt className="sm:hidden" />
                        <span className="hidden sm:inline">Ver Detalle</span>
                        <span className="sm:hidden">Ver</span>
                      </Link>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-3">
                    <span className="font-semibold text-[#010139]">
                      {caseItem.insurer?.name || 'Sin aseguradora'}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span>{MANAGEMENT_TYPES[caseItem.management_type as keyof typeof MANAGEMENT_TYPES] || caseItem.management_type}</span>
                    {caseItem.ticket_ref && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          #{caseItem.ticket_ref}
                        </span>
                      </>
                    )}
                    {caseItem.client_id && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                          <FaFolder />
                          Expediente
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${STATUS_COLORS[caseItem.status as keyof typeof STATUS_COLORS]}`}>
                      {CASE_STATUS_LABELS[caseItem.status as keyof typeof CASE_STATUS_LABELS]}
                    </span>

                    {/* SLA Badge */}
                    {caseItem.sla_date && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${slaColor}`}>
                        <FaClock className="text-xs" />
                        {slaLabel}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar with Enhanced Design */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-gray-700">Progreso del trámite</span>
                      <span className="font-bold text-[#010139] text-sm">{progress}%</span>
                    </div>
                    <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-[#010139] via-[#020270] to-[#8AAA19] transition-all duration-700 ease-out rounded-full relative"
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 10 && (
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Broker (Master view) */}
                  {userRole === 'master' && caseItem.broker && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Broker:</span>{' '}
                      {(caseItem.broker.profiles as any)?.name || (caseItem.broker.profiles as any)?.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t-2 border-gray-100 p-4 sm:p-6 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[#010139] mb-3">Información general</h4>
                    
                    {caseItem.policy_number && (
                      <div>
                        <span className="text-sm text-gray-600">Póliza:</span>
                        <p className="font-semibold">{caseItem.policy_number}</p>
                      </div>
                    )}

                    {caseItem.premium && (
                      <div>
                        <span className="text-sm text-gray-600">Prima:</span>
                        <p className="font-semibold">${caseItem.premium.toFixed(2)}</p>
                      </div>
                    )}

                    {caseItem.payment_method && (
                      <div>
                        <span className="text-sm text-gray-600">Forma de pago:</span>
                        <p className="font-semibold">{caseItem.payment_method}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-sm text-gray-600">Creado:</span>
                      <p className="font-semibold">
                        {new Date(caseItem.created_at).toLocaleDateString('es-PA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-[#010139] mb-3">Notas</h4>
                    {caseItem.notes ? (
                      <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                        {caseItem.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Sin notas</p>
                    )}

                    {caseItem.postponed_until && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-sm text-purple-700 font-semibold flex items-center gap-2">
                          <FaExclamationTriangle />
                          Aplazado hasta: {new Date(caseItem.postponed_until).toLocaleDateString('es-PA')}
                        </span>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mt-4 space-y-2">
                      {/* Expediente Button */}
                      {caseItem.client_id && (
                        <Link
                          href={`/cases/${caseItem.id}?tab=expediente`}
                          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                        >
                          <FaFolder />
                          <span>Ver Expediente del Cliente</span>
                        </Link>
                      )}

                      {/* Deeplink a Descargas */}
                      {(() => {
                        const downloadsLink = getDownloadsLink(caseItem.management_type, caseItem.insurer_id);
                        if (downloadsLink) {
                          return (
                            <Link
                              href={downloadsLink}
                              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                            >
                              <FaDownload />
                              <span className="hidden sm:inline">Ver Documentos de Trámite</span>
                              <span className="sm:hidden">Documentos</span>
                              <FaExternalLinkAlt className="text-sm" />
                            </Link>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Accesos rápidos a información del caso
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}
