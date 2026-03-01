'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSync,
  FaClock,
  FaExclamationTriangle,
  FaUserTie,
  FaArrowLeft,
  FaHistory,
  FaArrowRight,
  FaTimesCircle,
  FaCheckCircle,
  FaIdBadge,
  FaFire,
  FaExternalLinkAlt,
  FaBrain,
  FaStickyNote,
  FaChevronDown,
  FaPaperPlane,
} from 'react-icons/fa';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { MasterUser, OpsNote } from './urg-helpers';
import {
  URG_VALID_TRANSITIONS,
  calcBusinessHours,
  slaStatus,
  slaLabel,
  slaColor,
  fmtDate,
  fmtDateTime,
  buildChatDeepLink,
} from './urg-helpers';
import AiEvalWidget from './AiEvalWidget';

// ════════════════════════════════════════════
// INFO CARD
// ════════════════════════════════════════════

function InfoCard({ label, value, icon, critical }: { label: string; value: string; icon: React.ReactNode; critical?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 border ${critical ? 'border-red-100 bg-red-50/50' : 'border-gray-100 bg-gray-50/80'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-[9px] ${critical ? 'text-red-300' : 'text-gray-300'}`}>{icon}</span>
        <span className={`text-[9px] font-medium uppercase tracking-wider ${critical ? 'text-red-400' : 'text-gray-400'}`}>{label}</span>
      </div>
      <p className={`text-xs font-semibold ${critical ? 'text-red-700' : 'text-gray-700'}`}>{value}</p>
    </div>
  );
}

// ════════════════════════════════════════════
// NOTES PANEL
// ════════════════════════════════════════════

function NotesPanel({ caseId, onAddNote }: { caseId: string; onAddNote: (note: string, noteType: string) => Promise<void> }) {
  const [notes, setNotes] = useState<OpsNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operaciones/urgencies?view=notes&case_id=${caseId}`);
      const json = await res.json();
      setNotes(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [caseId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSubmit = async () => {
    if (newNote.trim().length < 10) return;
    setSaving(true);
    await onAddNote(newNote.trim(), 'manual');
    setNewNote('');
    setSaving(false);
    fetchNotes();
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case 'cierre': return '🔒 Cierre';
      case 'sla_breached': return '⏰ SLA';
      case 'status_change': return '🔄 Estado';
      default: return '📝 Nota';
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 cursor-pointer transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <FaStickyNote className="text-gray-300 text-[10px]" />
          <span className="text-xs font-medium text-gray-600">Notas del Caso</span>
          {notes.length > 0 && (
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{notes.length}</span>
          )}
        </div>
        <FaChevronDown className={`text-gray-300 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-3 space-y-2.5 border-t border-gray-50">
          {/* Add note form */}
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Agregar nota (mín. 10 caracteres)..."
              rows={2}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 resize-none transition-all duration-150"
            />
            <button
              onClick={handleSubmit}
              disabled={newNote.trim().length < 10 || saving}
              className="px-3 py-1.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] disabled:opacity-40 transition-colors duration-150 self-end"
            >
              <FaPaperPlane className="text-[10px]" />
            </button>
          </div>
          {newNote.length > 0 && newNote.trim().length < 10 && (
            <p className="text-[10px] text-red-400">Mínimo 10 caracteres ({newNote.trim().length}/10)</p>
          )}

          {/* Notes list */}
          {loading ? (
            <div className="flex justify-center py-6">
              <FaSync className="animate-spin text-gray-200 text-xs" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-4">Sin notas</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-gray-500">{typeLabel(n.note_type)}</span>
                    <span className="text-[9px] text-gray-400">{fmtDateTime(n.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-gray-600">{n.note}</p>
                  {n.user_name && (
                    <p className="text-[9px] text-gray-400 mt-0.5">— {n.user_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════

function SkeletonDetail() {
  return (
    <div className="flex-1 p-6 space-y-4" style={{ animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
      <div className="h-5 w-48 bg-gray-100 rounded" />
      <div className="h-3 w-32 bg-gray-50 rounded" />
      <div className="space-y-2 mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

interface CaseDetailProps {
  caseData: OpsCase | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onStatusChange: (status: OpsCaseStatus, note?: string) => void;
  onReassign: (masterId: string) => void;
  onShowHistory: () => void;
  onAddNote: (note: string, noteType: string) => Promise<void>;
  onReEvaluate: () => void;
  onOpenChat: () => void;
  masters: MasterUser[];
}

export default function UrgCaseDetail({
  caseData, loading, onBack, onRefresh,
  onStatusChange, onReassign, onShowHistory,
  onAddNote, onReEvaluate, onOpenChat, masters,
}: CaseDetailProps) {
  const [showReassign, setShowReassign] = useState(false);

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 text-gray-400">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FaFire className="text-xl text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Selecciona un caso</p>
        <p className="text-[10px] text-gray-400 mt-1">Elige una urgencia del panel izquierdo</p>
      </div>
    );
  }

  if (loading) return <SkeletonDetail />;

  const c = caseData;
  const validTransitions = URG_VALID_TRANSITIONS[c.status] || [];
  const isClosed = c.status === 'cerrado' || c.status === 'resuelto';
  const assignedMaster = masters.find((m) => m.id === c.assigned_master_id);

  // SLA business hours calculation
  const businessHours = calcBusinessHours(c.created_at, c.closed_at || undefined);
  const slaSt = slaStatus(businessHours);
  const slaC = slaColor(slaSt);

  // Deep link
  const chatLink = buildChatDeepLink(c.chat_thread_id);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="bg-[#010139] text-white px-4 py-3.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden text-white/60 hover:text-white cursor-pointer transition-colors duration-150">
            <FaArrowLeft />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <FaFire className="text-red-400/70 text-xs flex-shrink-0" />
              <span className="text-[15px] font-semibold truncate">{c.client_name || 'Sin nombre'}</span>
              {(() => {
                const sc = STATUS_COLORS[c.status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                );
              })()}
              {c.severity && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  c.severity === 'high' ? 'bg-red-500/20 text-red-200' : c.severity === 'medium' ? 'bg-amber-500/20 text-amber-200' : 'bg-green-500/20 text-green-200'
                }`}>
                  {c.severity === 'high' ? 'Alta' : c.severity === 'medium' ? 'Media' : 'Baja'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/40">
              <span className="flex items-center gap-1"><FaIdBadge className="text-[8px]" /> {c.ticket}</span>
              {c.category && <span>· {c.category}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {chatLink && (
              <button
                onClick={onOpenChat}
                className="text-white/30 hover:text-white/80 cursor-pointer transition-colors duration-150"
                title="Abrir Chat ADM COT"
              >
                <FaExternalLinkAlt className="text-xs" />
              </button>
            )}
            <button onClick={onShowHistory} className="text-white/30 hover:text-white/80 cursor-pointer transition-colors duration-150" title="Historial">
              <FaHistory className="text-xs" />
            </button>
            <button onClick={onRefresh} className="text-white/30 hover:text-white/80 cursor-pointer transition-colors duration-150">
              <FaSync className={`text-[10px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── SLA Business Hours Banner ── */}
      {!isClosed && (
        <div className={`${slaC.bg} border-b ${slaC.border} px-4 py-2 flex items-center gap-2 flex-shrink-0`}>
          <FaClock className={`${slaC.text} text-[10px]`} />
          <span className={`text-[10px] font-medium ${slaC.text}`}>
            SLA: {Math.round(businessHours)}h hábiles / 24h — {slaLabel(slaSt)}
          </span>
          {slaSt === 'breached' && (
            <span className="text-[10px] text-red-500 font-medium ml-auto">Nota obligatoria</span>
          )}
        </div>
      )}

      {/* ── SLA breached permanent banner ── */}
      {c.sla_breached && (
        <div className="bg-red-50/60 border-b border-red-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <FaExclamationTriangle className="text-red-400 text-[10px]" />
          <span className="text-[10px] font-medium text-red-600">SLA vencido — Nota obligatoria para cualquier cambio</span>
        </div>
      )}

      {/* ── No first response banner ── */}
      {!c.first_response_at && !isClosed && (
        <div className="bg-amber-50/60 border-b border-amber-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <FaClock className="text-amber-400 text-[10px]" />
          <span className="text-[10px] text-amber-600">
            Sin primera respuesta — {Math.round(businessHours)}h hábiles transcurridas
          </span>
        </div>
      )}

      {/* ── Assignment bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2.5 text-[10px]">
          <span className="text-gray-400">Asignado:</span>
          <span className="font-medium text-gray-600 flex items-center gap-1">
            <FaUserTie className="text-[8px] text-gray-300" />
            {assignedMaster ? assignedMaster.full_name : 'Sin asignar'}
          </span>
          {!isClosed && (
            <button
              onClick={() => setShowReassign(!showReassign)}
              className="text-[#010139]/50 hover:text-[#010139] cursor-pointer font-medium transition-colors duration-150"
            >
              {showReassign ? 'Cerrar' : 'Reasignar'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{fmtDate(c.created_at)}</span>
        </div>
      </div>

      {/* ── Reassign dropdown ── */}
      {showReassign && (
        <div className="px-4 py-2 bg-gray-50/80 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-medium text-gray-500 mr-1">Reasignar a:</span>
            {masters.map((m) => (
              <button
                key={m.id}
                onClick={() => { onReassign(m.id); setShowReassign(false); }}
                className={`px-2 py-0.5 text-[10px] rounded-full cursor-pointer transition-all duration-150 ${
                  m.id === c.assigned_master_id
                    ? 'bg-[#010139] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {m.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Categoría" value={c.category || '—'} icon={<FaFire />} />
          <InfoCard label="Severidad" value={c.severity === 'high' ? 'Alta' : c.severity === 'medium' ? 'Media' : 'Baja'} icon={<FaExclamationTriangle />} critical={c.severity === 'high'} />
          <InfoCard
            label="Primera Respuesta"
            value={c.first_response_at ? fmtDateTime(c.first_response_at) : 'Pendiente'}
            icon={<FaClock />}
            critical={!c.first_response_at && !isClosed}
          />
          <InfoCard
            label="SLA Hábil"
            value={`${Math.round(businessHours)}h / 24h`}
            icon={<FaClock />}
            critical={slaSt === 'breached' || slaSt === 'critical'}
          />
        </div>

        {/* Deep link to ADM COT chat */}
        {chatLink && (
          <button
            onClick={onOpenChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] transition-colors duration-150"
          >
            <FaExternalLinkAlt className="text-[10px]" />
            Abrir Conversación en ADM COT
          </button>
        )}

        {/* Closed — Resuelto */}
        {c.status === 'resuelto' && (
          <div className="rounded-lg p-3 bg-green-50 border border-green-200">
            <p className="text-xs font-bold text-green-800 mb-1">✅ Urgencia Resuelta</p>
            <p className="text-[10px] text-green-600">Resuelto: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* Closed — Cerrado */}
        {c.status === 'cerrado' && (
          <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
            <p className="text-xs font-bold text-gray-800 mb-1">🔒 Urgencia Cerrada</p>
            <p className="text-[10px] text-gray-600">Cerrado: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* ── Status transition buttons ── */}
        {!isClosed && validTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {validTransitions.map((target) => {
              if (target === 'cerrado') {
                return (
                  <button
                    key={target}
                    onClick={() => onStatusChange(target)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 cursor-pointer transition-all duration-150"
                  >
                    <FaTimesCircle className="text-[10px]" /> Cerrar
                  </button>
                );
              }
              if (target === 'resuelto') {
                return (
                  <button
                    key={target}
                    onClick={() => onStatusChange(target)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 cursor-pointer transition-all duration-150"
                  >
                    <FaCheckCircle className="text-[10px]" /> Resuelto
                  </button>
                );
              }
              const colors = STATUS_COLORS[target] || { bg: 'bg-gray-100', text: 'text-gray-600' };
              return (
                <button
                  key={target}
                  onClick={() => onStatusChange(target)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border ${colors.bg} ${colors.text} hover:opacity-80`}
                >
                  <FaArrowRight className="text-[8px]" /> {STATUS_LABELS[target] || target}
                </button>
              );
            })}
          </div>
        )}

        {/* ── AI Evaluation Widget ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <FaBrain className="text-[8px]" /> Evaluación IA
            </h4>
            {(c.status === 'resuelto' || c.status === 'cerrado') && (
              <button
                onClick={onReEvaluate}
                className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer font-medium transition-colors duration-150"
              >
                Re-evaluar
              </button>
            )}
          </div>
          <AiEvalWidget caseId={c.id} />
        </div>

        {/* ── Notes Panel ── */}
        <NotesPanel caseId={c.id} onAddNote={onAddNote} />
      </div>
    </div>
  );
}
