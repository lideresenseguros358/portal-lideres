'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaTimes,
  FaHistory,
  FaStickyNote,
  FaRobot,
  FaBrain,
  FaClipboardList,
  FaExclamationTriangle,
  FaFileExcel,
  FaFilePdf,
  FaSpinner,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';

// ═══════════════════════════════════════════════════════
// Audit Drawer — Case Timeline with diffs, notes, AI, SLA
// ═══════════════════════════════════════════════════════

interface AuditDrawerProps {
  caseId: string;
  onClose: () => void;
  onExport: (format: 'xlsx' | 'pdf', caseId: string) => void;
}

interface TimelineEvent {
  type: 'history' | 'note' | 'ai_eval' | 'ai_event' | 'activity';
  timestamp: string;
  user: string | null;
  [key: string]: any;
}

interface CaseInfo {
  id: string;
  ticket_number: string;
  case_type: string;
  status: string;
  assigned_master: string | null;
  created_at: string;
  closed_at: string | null;
  sla_deadline: string | null;
}

export default function AuditDrawer({ caseId, onClose, onExport }: AuditDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operaciones/auditoria?view=case_timeline&case_id=${caseId}`);
      const json = await res.json();
      setCaseInfo(json.case || null);
      setTimeline(json.timeline || []);
    } catch (err) {
      console.error('Error fetching case timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('es-PA', { timeZone: 'America/Panama' }); }
    catch { return iso; }
  };

  const fmtShort = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-PA', { timeZone: 'America/Panama', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const statusColor = (st: string) => {
    if (st === 'nuevo') return 'bg-blue-100 text-blue-800';
    if (st === 'en_proceso') return 'bg-yellow-100 text-yellow-800';
    if (st === 'resuelto' || st === 'cerrado') return 'bg-green-100 text-green-800';
    if (st === 'sla_breached') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const severityDot = (sev: string) => {
    if (sev === 'critical') return 'bg-red-500';
    if (sev === 'warn') return 'bg-yellow-500';
    return 'bg-blue-400';
  };

  const eventIcon = (type: string) => {
    switch (type) {
      case 'history': return <FaHistory className="text-indigo-500" />;
      case 'note': return <FaStickyNote className="text-yellow-600" />;
      case 'ai_eval': return <FaRobot className="text-purple-500" />;
      case 'ai_event': return <FaBrain className="text-pink-500" />;
      case 'activity': return <FaClipboardList className="text-blue-500" />;
      default: return <FaClipboardList className="text-gray-400" />;
    }
  };

  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return null;
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const changed: { key: string; old: string; new: string }[] = [];
    keys.forEach(k => {
      const bv = JSON.stringify((before || {})[k]) ?? '';
      const av = JSON.stringify((after || {})[k]) ?? '';
      if (bv !== av) changed.push({ key: k, old: bv, new: av });
    });
    if (changed.length === 0) return <span className="text-gray-400 text-[10px]">Sin cambios detectados</span>;
    return (
      <div className="space-y-1 mt-1">
        {changed.map((c, i) => (
          <div key={i} className="text-[10px] font-mono bg-gray-50 rounded px-2 py-1">
            <span className="text-gray-500 font-semibold">{c.key}:</span>{' '}
            <span className="text-red-500 line-through">{c.old || '∅'}</span>{' → '}
            <span className="text-green-600 font-semibold">{c.new || '∅'}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#010139] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FaHistory className="text-sm flex-shrink-0" />
            <span className="font-semibold text-sm truncate">
              Auditoría del Caso
              {caseInfo ? ` — ${caseInfo.ticket_number}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onExport('xlsx', caseId)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Exportar Excel">
              <FaFileExcel className="text-xs text-green-300" />
            </button>
            <button onClick={() => onExport('pdf', caseId)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Exportar PDF">
              <FaFilePdf className="text-xs text-red-300" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded transition-colors">
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <FaSpinner className="animate-spin text-2xl text-gray-300" />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Case Summary */}
              {caseInfo && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#010139]">{caseInfo.ticket_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(caseInfo.status)}`}>
                      {caseInfo.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                      {caseInfo.case_type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-600">
                    <div><span className="font-medium">Creado:</span> {fmtDate(caseInfo.created_at)}</div>
                    <div><span className="font-medium">Asignado:</span> {caseInfo.assigned_master || '—'}</div>
                    {caseInfo.sla_deadline && (
                      <div><span className="font-medium">SLA:</span> {fmtDate(caseInfo.sla_deadline)}</div>
                    )}
                    {caseInfo.closed_at && (
                      <div><span className="font-medium">Cerrado:</span> {fmtDate(caseInfo.closed_at)}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {timeline.length === 0 ? (
                <div className="text-center py-12">
                  <FaHistory className="text-3xl text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Sin eventos para este caso</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-200" />

                  <div className="space-y-0">
                    {timeline.map((ev, idx) => (
                      <div key={idx} className="relative pl-10 pb-4">
                        {/* Dot */}
                        <div className={`absolute left-[10px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ${severityDot(ev.severity)}`} />

                        {/* Event card */}
                        <div className="bg-white border border-gray-200 rounded-lg p-2.5 hover:border-gray-300 transition-colors">
                          <div className="flex items-start gap-2">
                            <span className="text-xs mt-0.5 flex-shrink-0">{eventIcon(ev.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-gray-400">{fmtShort(ev.timestamp)}</span>
                                {ev.user && (
                                  <span className="text-[10px] font-medium text-gray-700">{ev.user}</span>
                                )}
                              </div>

                              {/* Type-specific content */}
                              {ev.type === 'history' && (
                                <div className="mt-1">
                                  <span className="text-xs font-medium text-indigo-700">
                                    {ev.change_type?.replace(/_/g, ' ')}
                                  </span>
                                  {(ev.before || ev.after) && (
                                    <button
                                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                                      className="ml-2 text-[10px] text-blue-500 hover:underline inline-flex items-center gap-0.5"
                                    >
                                      {expandedIdx === idx ? <FaChevronUp /> : <FaChevronDown />}
                                      {expandedIdx === idx ? 'Ocultar diff' : 'Ver diff'}
                                    </button>
                                  )}
                                  {expandedIdx === idx && renderDiff(ev.before, ev.after)}
                                </div>
                              )}

                              {ev.type === 'note' && (
                                <div className="mt-1">
                                  <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">
                                    {ev.note_type || 'nota'}
                                  </span>
                                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                                    {ev.content?.substring(0, 300)}
                                  </p>
                                </div>
                              )}

                              {ev.type === 'ai_eval' && (
                                <div className="mt-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${ev.effectiveness_score < 50 ? 'text-red-600' : ev.effectiveness_score < 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                                      Score: {ev.effectiveness_score}%
                                    </span>
                                    <span className="text-[10px] text-gray-500">{ev.sentiment}</span>
                                    {ev.escalation_recommended && (
                                      <span className="text-[10px] text-red-600 flex items-center gap-0.5">
                                        <FaExclamationTriangle /> Escalar
                                      </span>
                                    )}
                                  </div>
                                  {ev.rationale && (
                                    <p className="text-[10px] text-gray-500 italic">{ev.rationale.substring(0, 200)}</p>
                                  )}
                                </div>
                              )}

                              {ev.type === 'ai_event' && (
                                <div className="mt-1">
                                  <span className="text-xs text-gray-700">{ev.event_type?.replace(/_/g, ' ')}</span>
                                  <span className={`ml-2 text-[10px] ${ev.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {ev.success ? '✓ Éxito' : `✗ ${ev.error?.substring(0, 60) || 'Error'}`}
                                  </span>
                                </div>
                              )}

                              {ev.type === 'activity' && (
                                <div className="mt-1">
                                  <span className="text-xs text-gray-700">{ev.label}</span>
                                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                    <span className="text-[10px] text-gray-400 ml-2">
                                      {JSON.stringify(ev.metadata).substring(0, 80)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
