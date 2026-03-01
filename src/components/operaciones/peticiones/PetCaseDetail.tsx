'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaSync,
  FaClock,
  FaExclamationTriangle,
  FaUserTie,
  FaArrowLeft,
  FaHistory,
  FaPaperPlane,
  FaPaperclip,
  FaChevronDown,
  FaChevronUp,
  FaEnvelope,
  FaEnvelopeOpen,
  FaFileAlt,
  FaArrowRight,
  FaTimesCircle,
  FaShieldAlt,
  FaIdBadge,
  FaInbox,
  FaReply,
  FaRocket,
  FaTag,
  FaUser,
  FaPhone,
} from 'react-icons/fa';
import type { OpsCaseMessage } from '@/types/operaciones.types';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { MasterUser } from './pet-helpers';
import { VALID_TRANSITIONS, fmtDate, fmtDateTime, hoursElapsed, RAMO_LABELS, RAMO_COLORS } from './pet-helpers';

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
// SANITIZE HTML (XSS prevention)
// ════════════════════════════════════════════

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '');
}

// ════════════════════════════════════════════
// MESSAGE BUBBLE
// ════════════════════════════════════════════

function MessageBubble({ msg }: { msg: OpsCaseMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isInbound = msg.direction === 'inbound';
  const hasAttach = msg.metadata?.has_attachments;

  const displayBody = expanded
    ? msg.body_html
      ? sanitizeHtml(msg.body_html)
      : msg.body_text || ''
    : null;

  const preview = msg.body_text
    ? msg.body_text.substring(0, 120).replace(/\n/g, ' ') + (msg.body_text.length > 120 ? '…' : '')
    : '(sin contenido)';

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 text-xs border ${
          isInbound
            ? 'bg-gray-50/80 border-gray-100'
            : 'bg-blue-50/50 border-blue-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {isInbound ? (
            <FaInbox className="text-gray-300 text-[10px]" />
          ) : (
            <FaReply className="text-blue-300 text-[10px]" />
          )}
          <span className="font-semibold text-[10px] text-gray-600 truncate">
            {msg.from_email}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            {fmtDateTime(msg.received_at)}
          </span>
          {hasAttach && <FaPaperclip className="text-gray-300 text-[9px]" />}
        </div>

        {/* Subject */}
        <p className="text-[10px] text-gray-500 mb-1 truncate">{msg.subject}</p>

        {/* Body */}
        {expanded && msg.body_html ? (
          <div
            className="prose prose-xs max-w-none text-[11px] text-gray-700 mt-2 border-t border-gray-100 pt-2 overflow-auto max-h-80"
            dangerouslySetInnerHTML={{ __html: displayBody || '' }}
          />
        ) : expanded && msg.body_text ? (
          <pre className="whitespace-pre-wrap text-[11px] text-gray-700 mt-2 border-t border-gray-100 pt-2 max-h-80 overflow-auto font-sans">
            {msg.body_text}
          </pre>
        ) : (
          <p className="text-[10px] text-gray-500 italic">{preview}</p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[9px] text-gray-400 hover:text-gray-600 cursor-pointer font-medium flex items-center gap-0.5 transition-colors duration-150"
        >
          {expanded ? <><FaChevronUp className="text-[7px]" /> Colapsar</> : <><FaChevronDown className="text-[7px]" /> Ver completo</>}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MESSAGE THREAD PANEL
// ════════════════════════════════════════════

function MessageThread({ caseId }: { caseId: string }) {
  const [messages, setMessages] = useState<OpsCaseMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(true);
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
      console.error('[MessageThread] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchMessages(page);
  }, [fetchMessages, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 cursor-pointer transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <FaEnvelopeOpen className="text-gray-300 text-[10px]" />
          <span className="text-xs font-medium text-gray-600">Hilo de Mensajes</span>
          {total > 0 && (
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{total}</span>
          )}
        </div>
        <FaChevronDown className={`text-gray-300 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-gray-50">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-6">
              <FaSync className="animate-spin text-gray-200 text-xs" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-6">Sin mensajes en este caso</p>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-50">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer transition-colors duration-150"
                  >
                    ← Ant
                  </button>
                  <span className="text-[10px] text-gray-400">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 disabled:opacity-30 cursor-pointer transition-colors duration-150"
                  >
                    Sig →
                  </button>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => fetchMessages(page)}
            className="w-full text-center text-[9px] text-gray-400 hover:text-gray-600 cursor-pointer font-medium py-1 transition-colors duration-150"
          >
            <FaSync className="inline text-[8px] mr-1" /> Refrescar
          </button>
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
  onStatusChange: (status: OpsCaseStatus) => void;
  onMarkLost: () => void;
  onConvertToEmission: () => void;
  onReassign: (masterId: string) => void;
  onShowHistory: () => void;
  onSendEmail: (body: string, template: string) => void;
  masters: MasterUser[];
}

export default function PetCaseDetail({
  caseData, loading, onBack, onRefresh,
  onStatusChange, onMarkLost, onConvertToEmission, onReassign,
  onShowHistory, onSendEmail, masters,
}: CaseDetailProps) {
  const [showReassign, setShowReassign] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 text-gray-400">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FaInbox className="text-xl text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Selecciona un caso</p>
        <p className="text-[10px] text-gray-400 mt-1">Elige una petición del panel izquierdo</p>
      </div>
    );
  }

  if (loading) return <SkeletonDetail />;

  const c = caseData;
  const validTransitions = VALID_TRANSITIONS[c.status] || [];
  const isClosed = c.status === 'cerrado' || c.status === 'perdido';
  const assignedMaster = masters.find((m) => m.id === c.assigned_master_id);
  const ramoKey = (c.ramo || '').toLowerCase();
  const ramoLabel = RAMO_LABELS[ramoKey] || c.ramo || '—';
  const ramoColor = RAMO_COLORS[ramoKey];

  const TEMPLATES: Record<string, string> = {
    cotizacion: `Estimado/a ${c.client_name || 'Cliente'},\n\nAdjunto encontrará la cotización solicitada para su ${ramoLabel === '—' ? 'seguro' : `seguro de ${ramoLabel}`}.\n\nQuedamos atentos a su respuesta.\n\nSaludos cordiales,\nLíderes en Seguros`,
    seguimiento: `Estimado/a ${c.client_name || 'Cliente'},\n\nLe escribimos en seguimiento a su solicitud de cotización.\n\n¿Ha tenido oportunidad de revisar la propuesta enviada?\n\nQuedamos a su disposición.\n\nSaludos cordiales,\nLíderes en Seguros`,
    info: `Estimado/a ${c.client_name || 'Cliente'},\n\nAdjuntamos información adicional referente a su solicitud.\n\nNo dude en contactarnos si tiene alguna consulta.\n\nSaludos cordiales,\nLíderes en Seguros`,
  };

  const applyTemplate = (key: string) => {
    setEmailBody(TEMPLATES[key] || '');
    setEmailTemplate(key);
  };

  const handleSendEmail = () => {
    if (!emailBody.trim()) return;
    onSendEmail(emailBody, emailTemplate);
    setEmailBody('');
    setEmailTemplate('');
    setAttachments([]);
    setComposerOpen(false);
  };

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
              <span className="text-[15px] font-semibold truncate">{c.client_name || 'Sin nombre'}</span>
              {(() => {
                const sc = STATUS_COLORS[c.status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                );
              })()}
              {ramoColor && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ramoColor.bg} ${ramoColor.text}`}>
                  <FaTag className="text-[8px]" /> {ramoLabel}
                </span>
              )}
              {c.sla_breached && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-200">
                  <FaClock className="text-[8px]" /> SLA
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/40">
              <span className="flex items-center gap-1"><FaIdBadge className="text-[8px]" /> {c.ticket}</span>
              {c.client_email && <span className="flex items-center gap-1"><FaEnvelope className="text-[8px]" /> {c.client_email}</span>}
              {c.insurer_name && <span>{c.insurer_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button onClick={onShowHistory} className="text-white/30 hover:text-white/80 cursor-pointer transition-colors duration-150" title="Ver Historial">
              <FaHistory className="text-xs" />
            </button>
            <button onClick={onRefresh} className="text-white/30 hover:text-white/80 cursor-pointer transition-colors duration-150">
              <FaSync className={`text-[10px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── SLA Banner ── */}
      {c.sla_breached && (
        <div className="bg-red-50/60 border-b border-red-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <FaExclamationTriangle className="text-red-400 text-[10px]" />
          <span className="text-[10px] font-medium text-red-600">SLA vencido — Primera respuesta excedió 48h</span>
        </div>
      )}

      {/* ── No first response banner ── */}
      {!c.first_response_at && !isClosed && hoursElapsed(c.created_at) > 24 && (
        <div className="bg-amber-50/60 border-b border-amber-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <FaClock className="text-amber-400 text-[10px]" />
          <span className="text-[10px] text-amber-600">
            Sin primera respuesta — {Math.round(hoursElapsed(c.created_at))}h desde creación
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
          {c.source && <span>· {c.source}</span>}
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
          <InfoCard label="Cliente" value={c.client_name || '—'} icon={<FaUser />} />
          <InfoCard label="Ramo" value={ramoLabel} icon={<FaTag />} />
          <InfoCard label="Email" value={c.client_email || '—'} icon={<FaEnvelope />} />
          <InfoCard label="Teléfono" value={c.client_phone || '—'} icon={<FaPhone />} />
          <InfoCard
            label="Primera Respuesta"
            value={c.first_response_at ? fmtDateTime(c.first_response_at) : 'Pendiente'}
            icon={<FaClock />}
            critical={!c.first_response_at && !isClosed}
          />
          {c.insurer_name && <InfoCard label="Aseguradora" value={c.insurer_name} icon={<FaShieldAlt />} />}
        </div>

        {/* Closed — Cerrado (converted) */}
        {c.status === 'cerrado' && (
          <div className="rounded-lg p-3 bg-green-50 border border-green-200">
            <p className="text-xs font-bold text-green-800 mb-1">✅ Petición Cerrada</p>
            <p className="text-[10px] text-green-600">Cerrado: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* Closed — Perdido */}
        {c.status === 'perdido' && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200">
            <p className="text-xs font-bold text-red-800 mb-1">❌ Petición Perdida</p>
            {c.cancellation_reason && <p className="text-[10px] text-red-700">Motivo: {c.cancellation_reason}</p>}
            <p className="text-[10px] text-red-600">Cerrado: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* ── Convert to Emission button (only when status = enviado) ── */}
        {c.status === 'enviado' && (
          <div className="bg-gray-50/80 border border-gray-100 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#010139] mb-0.5">¿El cliente aceptó la cotización?</p>
                <p className="text-[10px] text-gray-400">Convierte esta petición en una emisión para procesar la póliza.</p>
              </div>
              <button
                onClick={onConvertToEmission}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] transition-colors duration-150 flex-shrink-0"
              >
                <FaRocket className="text-[10px]" /> Convertir a Emisión
              </button>
            </div>
          </div>
        )}

        {/* ── Status transition buttons ── */}
        {!isClosed && validTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {validTransitions.map((target) => {
              if (target === 'perdido') {
                return (
                  <button
                    key={target}
                    onClick={onMarkLost}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 cursor-pointer transition-all duration-150"
                  >
                    <FaTimesCircle className="text-[10px]" /> Perdido
                  </button>
                );
              }
              const colors = STATUS_COLORS[target];
              return (
                <button
                  key={target}
                  onClick={() => onStatusChange(target)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border ${colors.bg} ${colors.text} hover:opacity-80`}
                >
                  <FaArrowRight className="text-[8px]" /> {STATUS_LABELS[target]}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Email Composer ── */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setComposerOpen(!composerOpen)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 cursor-pointer transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <FaEnvelope className="text-gray-300 text-[10px]" />
              <span className="text-xs font-medium text-gray-600">Enviar Correo</span>
            </div>
            <FaChevronDown className={`text-gray-300 text-[10px] transition-transform duration-200 ${composerOpen ? 'rotate-180' : ''}`} />
          </button>

          {composerOpen && (
            <div className="p-3 space-y-2.5 border-t border-gray-50">
              {/* Templates */}
              <div className="flex gap-1 items-center">
                <span className="text-[10px] text-gray-400 mr-1">Plantilla:</span>
                {(['cotizacion', 'seguimiento', 'info'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => applyTemplate(t)}
                    className={`px-2 py-0.5 text-[10px] rounded-full cursor-pointer transition-all duration-150 ${
                      emailTemplate === t ? 'bg-[#010139] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {t === 'cotizacion' ? 'Cotización' : t === 'seguimiento' ? 'Seguimiento' : 'Info'}
                  </button>
                ))}
              </div>

              {/* Subject (auto) */}
              <div className="text-[10px] text-gray-400 bg-gray-50/80 px-2.5 py-1.5 rounded-md font-mono">
                [{c.ticket}] Cotización {ramoLabel} — {c.client_name || ''}
              </div>

              {/* Body */}
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 resize-none transition-all duration-150"
              />

              {/* Attachments + Send */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 rounded cursor-pointer hover:bg-gray-50 transition-all duration-150"
                  >
                    <FaPaperclip className="text-[8px]" /> Adjuntar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) setAttachments(Array.from(e.target.files));
                    }}
                  />
                  {attachments.map((f, i) => (
                    <span key={i} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
                      {f.name}
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={!emailBody.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] disabled:opacity-40 transition-colors duration-150"
                >
                  <FaPaperPlane className="text-[10px]" /> Enviar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Last email summary */}
        {c.last_email_summary && (
          <div className="bg-gray-50/60 border border-gray-100 rounded-lg p-3">
            <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">Último correo</p>
            <p className="text-[10px] text-gray-500">{c.last_email_summary}</p>
          </div>
        )}

        {/* ── Message Thread (IMAP synced messages) ── */}
        <MessageThread caseId={c.id} />
      </div>
    </div>
  );
}
