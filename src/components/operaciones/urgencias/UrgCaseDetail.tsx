'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  FaEnvelope,
  FaCommentDots,
  FaReply,
  FaPaperclip,
  FaLink,
  FaEllipsisH,
  FaEnvelopeOpen,
} from 'react-icons/fa';
import type { OpsCase, OpsCaseStatus, OpsCaseMessage } from '@/types/operaciones.types';
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
              data-no-uppercase
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
// EMAIL MESSAGE BUBBLE
// ════════════════════════════════════════════

function MessageBubble({ msg }: { msg: OpsCaseMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isInbound = msg.direction === 'inbound';
  const hasAttach = msg.metadata?.has_attachments;

  return (
    <div className={`rounded-lg p-3 border ${isInbound ? 'bg-blue-50/40 border-blue-100' : 'bg-green-50/40 border-green-100'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {isInbound ? <FaEnvelope className="text-blue-300 text-[10px]" /> : <FaReply className="text-green-300 text-[10px]" />}
        <span className="font-semibold text-[10px] text-gray-600 truncate">{msg.from_email}</span>
        <span className="text-[9px] text-gray-400 flex-shrink-0">{fmtDateTime(msg.received_at)}</span>
        {hasAttach && <FaPaperclip className="text-gray-300 text-[9px]" />}
      </div>
      <p className="text-[10px] text-gray-500 mb-1 font-medium">{msg.subject}</p>
      <div
        className={`text-[11px] text-gray-600 leading-relaxed ${!expanded ? 'line-clamp-4' : ''}`}
        dangerouslySetInnerHTML={{ __html: msg.body_html || msg.body_text?.replace(/\n/g, '<br/>') || '' }}
      />
      {(msg.body_text?.length || 0) > 300 && (
        <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-blue-500 mt-1 cursor-pointer hover:underline">
          {expanded ? 'Menos' : 'Más...'}
        </button>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// EMAIL THREAD PANEL (for email-sourced urgencies)
// ════════════════════════════════════════════

function MessageThread({ caseId }: { caseId: string }) {
  const [messages, setMessages] = useState<OpsCaseMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchMessages = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operaciones/messages?case_id=${caseId}&page=${p}&limit=${limit}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setMessages(json.messages || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('[UrgMessageThread] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { fetchMessages(page); }, [fetchMessages, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaEnvelopeOpen className="text-gray-400 text-xs" />
          <span className="text-xs font-bold text-gray-700">Hilo de Correos</span>
          {total > 0 && (
            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{total}</span>
          )}
        </div>
        <button
          onClick={() => fetchMessages(page)}
          className="text-[9px] text-blue-500 hover:text-blue-700 cursor-pointer font-medium flex items-center gap-1"
        >
          <FaSync className="text-[8px]" /> Refrescar
        </button>
      </div>

      {loading && messages.length === 0 ? (
        <div className="flex justify-center py-8">
          <FaSync className="animate-spin text-gray-300" />
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8">
          <FaEnvelopeOpen className="text-gray-200 text-2xl mx-auto mb-2" />
          <p className="text-[11px] text-gray-400">Sin mensajes en este caso</p>
        </div>
      ) : (
        <>
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 text-[10px] bg-gray-100 rounded disabled:opacity-30 cursor-pointer">← Ant</button>
              <span className="text-[10px] text-gray-500">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 text-[10px] bg-gray-100 rounded disabled:opacity-30 cursor-pointer">Sig →</button>
            </div>
          )}
        </>
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
  onSendEmail: (body: string, template: string) => void;
  onSendPaymentLink: (paymentLink: string) => void;
  masters: MasterUser[];
}

const EMAIL_TEMPLATES: Record<string, string> = {
  seguimiento: 'Estimado/a cliente,\n\nLe escribimos para dar seguimiento a su caso urgente. ¿Podría indicarnos si la situación ha sido resuelta o si necesita asistencia adicional?\n\nQuedamos atentos.',
  documentos: 'Estimado/a cliente,\n\nPara poder avanzar con la resolución de su caso, necesitamos que nos envíe la siguiente documentación:\n\n- [Documento requerido]\n\nQuedamos atentos.',
  resolucion: 'Estimado/a cliente,\n\nNos complace informarle que su caso ha sido atendido y resuelto satisfactoriamente.\n\nSi tiene alguna consulta adicional, no dude en comunicarse con nosotros.\n\nSaludos cordiales.',
};

export default function UrgCaseDetail({
  caseData, loading, onBack, onRefresh,
  onStatusChange, onReassign, onShowHistory,
  onAddNote, onReEvaluate, onOpenChat, onSendEmail, onSendPaymentLink, masters,
}: CaseDetailProps) {
  const [showReassign, setShowReassign] = useState(false);
  const [activeView, setActiveView] = useState<'history' | 'compose' | 'payment_link'>('history');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const applyTemplate = (key: string) => {
    setEmailBody(EMAIL_TEMPLATES[key] || '');
    setEmailTemplate(key);
  };

  const handleSendEmail = () => {
    if (!emailBody.trim()) return;
    onSendEmail(emailBody, emailTemplate);
    setEmailBody('');
    setEmailTemplate('');
    setActiveView('history');
  };

  const handleSendPaymentLink = () => {
    if (!paymentLink.trim()) return;
    onSendPaymentLink(paymentLink.trim());
    setPaymentLink('');
    setActiveView('history');
  };

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

  // Source detection
  const isChat = !!c.chat_thread_id || c.source === 'adm_cot_chat' || c.source === 'whatsapp';
  const isEmail = !isChat;
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

        {/* ── Source-aware action block ── */}
        {isChat && chatLink && (
          <div className="space-y-2">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2.5">
              <FaCommentDots className="text-indigo-400 text-sm flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-800">Urgencia detectada desde Chat</p>
                <p className="text-[10px] text-indigo-600 mt-0.5">Vertex AI categorizó este caso como urgente. Atiéndelo desde el módulo de Chats en ADM COT.</p>
              </div>
            </div>
            <button
              onClick={onOpenChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#010139] text-white rounded-lg text-sm font-bold cursor-pointer hover:bg-[#020270] transition-colors duration-150"
            >
              <FaExternalLinkAlt className="text-xs" />
              Ir a ADM COT — Atender Chat
            </button>
          </div>
        )}

        {isEmail && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-2.5">
            <FaEnvelope className="text-teal-400 text-sm flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-teal-800">Urgencia detectada desde Correo</p>
              <p className="text-[10px] text-teal-600 mt-0.5">Vertex AI categorizó este correo como urgente. Responde por correo desde aquí.</p>
            </div>
          </div>
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

        {/* ── Actions Bar (email-sourced only) ── */}
        {isEmail && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeView !== 'history' && (
                <button
                  onClick={() => setActiveView('history')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors duration-150"
                >
                  <FaArrowLeft className="text-[8px]" /> Volver al histórico
                </button>
              )}
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {activeView === 'history' ? 'Histórico de Mensajes' : activeView === 'compose' ? 'Nuevo Correo' : 'Enlace de Pago'}
              </span>
            </div>

            {!isClosed && (
              <div className="relative" ref={actionsRef}>
                <button
                  onClick={() => setActionsOpen(!actionsOpen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#010139] text-white rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-[#020270] transition-colors duration-150"
                >
                  <FaEllipsisH className="text-[9px]" /> Acciones
                </button>
                {actionsOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => { setActiveView('compose'); setActionsOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer transition-colors duration-100 ${
                        activeView === 'compose' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FaEnvelope className="text-[10px]" /> Enviar Correo
                    </button>
                    <button
                      onClick={() => { setActiveView('payment_link'); setActionsOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer transition-colors duration-100 ${
                        activeView === 'payment_link' ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FaLink className="text-[10px]" /> Enlace de Pago
                    </button>
                    <button
                      onClick={() => { setActiveView('history'); setActionsOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer transition-colors duration-100 ${
                        activeView === 'history' ? 'bg-gray-100 text-gray-800 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FaHistory className="text-[10px]" /> Ver Histórico
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW: Message History (email-sourced) ── */}
        {isEmail && activeView === 'history' && (
          <MessageThread caseId={c.id} />
        )}

        {/* ── VIEW: Email Composer ── */}
        {isEmail && activeView === 'compose' && (
          <div className="space-y-3">
            {/* Templates */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-medium mr-1">Plantillas:</span>
              {(['seguimiento', 'documentos', 'resolucion'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTemplate(t)}
                  className={`px-2 py-0.5 text-[10px] rounded-full cursor-pointer transition-all duration-150 ${
                    emailTemplate === t ? 'bg-[#010139] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {t === 'seguimiento' ? 'Seguimiento' : t === 'documentos' ? 'Documentos' : 'Resolución'}
                </button>
              ))}
            </div>

            {/* Recipient */}
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="font-medium">Para:</span>
              <span>{c.client_email || 'Sin email del cliente'}</span>
            </div>

            {/* Body */}
            <textarea
              data-no-uppercase
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 resize-none transition-all duration-150"
            />

            {/* Send */}
            <div className="flex items-center justify-end">
              <button
                onClick={handleSendEmail}
                disabled={!emailBody.trim() || !c.client_email}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] disabled:opacity-40 transition-colors duration-150"
              >
                <FaPaperPlane className="text-[10px]" /> Enviar
              </button>
            </div>
          </div>
        )}

        {/* ── VIEW: Payment Link ── */}
        {isEmail && activeView === 'payment_link' && (
          <div className="space-y-4">
            <div className="bg-green-50/50 border border-green-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                <FaLink className="text-[10px]" /> Enviar Enlace de Pago
              </p>
              <p className="text-[11px] text-green-700 mb-3">Pega el enlace de pago. Se enviará al cliente con la plantilla de pago corporativa.</p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                <span className="font-medium">Para:</span>
                <span>{c.client_email || 'Sin email del cliente'}</span>
              </div>
              <input
                type="url"
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                placeholder="https://pago.example.com/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 transition-all duration-150 mb-3"
              />
              <div className="flex items-center justify-end">
                <button
                  onClick={handleSendPaymentLink}
                  disabled={!paymentLink.trim() || !c.client_email}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8AAA19] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#7a9916] disabled:opacity-40 transition-colors duration-150"
                >
                  <FaLink className="text-[10px]" /> Enviar Enlace de Pago
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Notes Panel ── */}
        <NotesPanel caseId={c.id} onAddNote={onAddNote} />
      </div>
    </div>
  );
}
