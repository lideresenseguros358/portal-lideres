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
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaShieldAlt,
  FaIdBadge,
  FaInbox,
  FaReply,
} from 'react-icons/fa';
import type { OpsCaseMessage } from '@/types/operaciones.types';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { MasterUser } from './ren-helpers';
import { VALID_TRANSITIONS, fmtDate, fmtDateTime, hoursElapsed } from './ren-helpers';

// ════════════════════════════════════════════
// INFO CARD
// ════════════════════════════════════════════

function InfoCard({ label, value, icon, critical }: { label: string; value: string; icon: React.ReactNode; critical?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${critical ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[10px] ${critical ? 'text-red-400' : 'text-gray-400'}`}>{icon}</span>
        <span className={`text-[10px] font-medium ${critical ? 'text-red-500' : 'text-gray-500'}`}>{label}</span>
      </div>
      <p className={`text-xs font-bold ${critical ? 'text-red-800' : 'text-gray-800'}`}>{value}</p>
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
            ? 'bg-gray-50 border-gray-200'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {isInbound ? (
            <FaInbox className="text-gray-400 text-[10px]" />
          ) : (
            <FaReply className="text-blue-400 text-[10px]" />
          )}
          <span className="font-bold text-[10px] text-gray-700 truncate">
            {msg.from_email}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            {fmtDateTime(msg.received_at)}
          </span>
          {hasAttach && <FaPaperclip className="text-gray-400 text-[9px]" />}
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
          className="mt-1.5 text-[9px] text-blue-500 hover:text-blue-700 cursor-pointer font-medium flex items-center gap-0.5"
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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2">
          <FaEnvelopeOpen className="text-gray-400 text-xs" />
          <span className="text-xs font-bold text-gray-700">Hilo de Mensajes</span>
          {total > 0 && (
            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{total}</span>
          )}
        </div>
        <FaChevronDown className={`text-gray-400 text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-gray-100">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center py-4">
              <FaSync className="animate-spin text-gray-300" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-4">Sin mensajes en este caso</p>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 text-[10px] bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                  >
                    ← Ant
                  </button>
                  <span className="text-[10px] text-gray-500">{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 text-[10px] bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                  >
                    Sig →
                  </button>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => fetchMessages(page)}
            className="w-full text-center text-[9px] text-blue-500 hover:text-blue-700 cursor-pointer font-medium py-1"
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
    <div className="flex-1 animate-pulse p-6 space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded" />
      <div className="h-4 w-32 bg-gray-100 rounded" />
      <div className="space-y-3 mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
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
  onConfirmRenewal: () => void;
  onCancel: () => void;
  onReassign: (masterId: string) => void;
  onShowHistory: () => void;
  onSendEmail: (body: string, template: string) => void;
  masters: MasterUser[];
}

export default function RenCaseDetail({
  caseData, loading, onBack, onRefresh,
  onStatusChange, onConfirmRenewal, onCancel, onReassign,
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
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
        <FaSync className="text-5xl mb-4" />
        <p className="text-sm font-medium">Selecciona un caso</p>
        <p className="text-xs mt-1">Elige una renovación del panel izquierdo</p>
      </div>
    );
  }

  if (loading) return <SkeletonDetail />;

  const c = caseData;
  const validTransitions = VALID_TRANSITIONS[c.status] || [];
  const isClosed = c.status === 'cerrado_renovado' || c.status === 'cerrado_cancelado';
  const assignedMaster = masters.find((m) => m.id === c.assigned_master_id);

  const TEMPLATES: Record<string, string> = {
    renovar: `Estimado/a ${c.client_name || 'Cliente'},\n\nLe informamos que su póliza ${c.policy_number || ''} está próxima a vencer.\n\nPor favor confirme si desea renovarla en las mismas condiciones.\n\nQuedamos atentos.\n\nSaludos cordiales,\nLíderes en Seguros`,
    pago: `Estimado/a ${c.client_name || 'Cliente'},\n\nAdjunto encontrará la información de pago para la renovación de su póliza ${c.policy_number || ''}.\n\nQuedamos atentos a su confirmación.\n\nSaludos cordiales,\nLíderes en Seguros`,
    caratula: `Estimado/a ${c.client_name || 'Cliente'},\n\nAdjunto encontrará la carátula de su póliza ${c.policy_number || ''} renovada.\n\nNo dude en contactarnos si tiene alguna consulta.\n\nSaludos cordiales,\nLíderes en Seguros`,
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
              {c.sla_breached && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-200">
                  <FaClock className="text-[8px]" /> SLA
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/40">
              <span className="flex items-center gap-1"><FaShieldAlt className="text-[8px]" /> {c.policy_number || '—'}</span>
              <span className="flex items-center gap-1"><FaIdBadge className="text-[8px]" /> {c.ticket}</span>
              {c.insurer_name && <span>{c.insurer_name}</span>}
              {c.ramo && <span>· {c.ramo}</span>}
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
        <div className="bg-red-50/60 border-b border-red-100 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <FaExclamationTriangle className="text-red-400 text-[10px]" />
          <span className="text-[10px] font-medium text-red-600">SLA vencido — primera respuesta excedió 48h</span>
        </div>
      )}

      {/* ── No first response banner ── */}
      {!c.first_response_at && !isClosed && hoursElapsed(c.created_at) > 24 && (
        <div className="bg-amber-50/60 border-b border-amber-100 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <FaClock className="text-amber-400 text-[10px]" />
          <span className="text-[10px] text-amber-600">
            Sin primera respuesta — {Math.round(hoursElapsed(c.created_at))}h desde creación
          </span>
        </div>
      )}

      {/* ── Assignment bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-400">Asignado:</span>
          <span className="font-medium text-gray-600 flex items-center gap-1">
            <FaUserTie className="text-[8px] text-gray-400" />
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
        <div className="flex items-center gap-2 text-[10px] text-gray-400 tabular-nums">
          <span>Creado: {fmtDate(c.created_at)}</span>
          {c.renewal_date && <span>· Vence: {fmtDate(c.renewal_date)}</span>}
        </div>
      </div>

      {/* ── Reassign dropdown ── */}
      {showReassign && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-gray-500">Reasignar a:</span>
            {masters.map((m) => (
              <button
                key={m.id}
                onClick={() => { onReassign(m.id); setShowReassign(false); }}
                className={`px-2.5 py-1 text-[10px] rounded-full cursor-pointer transition-all duration-150 ${
                  m.id === c.assigned_master_id
                    ? 'bg-[#010139] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#010139]/30'
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
          <InfoCard label="Fecha Vigencia" value={fmtDate(c.renewal_date)} icon={<FaCalendarAlt />} />
          <InfoCard label="Aseguradora" value={c.insurer_name || '—'} icon={<FaShieldAlt />} />
          <InfoCard label="Ramo" value={c.ramo || '—'} icon={<FaFileAlt />} />
          <InfoCard
            label="Primera Respuesta"
            value={c.first_response_at ? fmtDateTime(c.first_response_at) : 'Pendiente'}
            icon={<FaClock />}
            critical={!c.first_response_at && !isClosed}
          />
        </div>

        {/* Aplazado info */}
        {c.status === 'aplazado' && c.aplazado_until && (
          <div className={`rounded-lg p-3 flex items-center gap-3 ${
            new Date(c.aplazado_until) < new Date() ? 'bg-orange-50 border border-orange-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <FaClock className={new Date(c.aplazado_until) < new Date() ? 'text-orange-500' : 'text-amber-500'} />
            <div>
              <p className="text-xs font-bold text-gray-800">Aplazado hasta: {fmtDate(c.aplazado_until)}</p>
              {new Date(c.aplazado_until) < new Date() && (
                <p className="text-[10px] text-orange-700 font-medium">⚠ Fecha de aplazamiento vencida</p>
              )}
            </div>
          </div>
        )}

        {/* Closed — Renovado */}
        {c.status === 'cerrado_renovado' && (
          <div className="rounded-lg p-3 bg-green-50 border border-green-200">
            <p className="text-xs font-bold text-green-800 mb-1">✅ Renovación Confirmada</p>
            {c.new_start_date && (
              <p className="text-[10px] text-green-700">Nueva vigencia: {fmtDate(c.new_start_date)} → {fmtDate(c.new_end_date)}</p>
            )}
            <p className="text-[10px] text-green-600">Cerrado: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* Closed — Cancelado */}
        {c.status === 'cerrado_cancelado' && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200">
            <p className="text-xs font-bold text-red-800 mb-1">❌ Cancelado</p>
            {c.cancellation_reason && <p className="text-[10px] text-red-700">Motivo: {c.cancellation_reason}</p>}
            <p className="text-[10px] text-red-600">Cerrado: {fmtDateTime(c.closed_at)}</p>
          </div>
        )}

        {/* ── Status transition buttons ── */}
        {!isClosed && validTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {validTransitions.map((target) => {
              if (target === 'cerrado_renovado') {
                return (
                  <button
                    key={target}
                    onClick={onConfirmRenewal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-pointer transition-all duration-150"
                  >
                    <FaCheckCircle className="text-[10px]" /> Renovado
                  </button>
                );
              }
              if (target === 'cerrado_cancelado') {
                return (
                  <button
                    key={target}
                    onClick={onCancel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 cursor-pointer transition-all duration-150"
                  >
                    <FaTimesCircle className="text-[10px]" /> Cancelado
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
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <FaEnvelope className="text-gray-300 text-[10px]" />
              <span className="text-xs font-medium text-gray-600">Enviar Correo</span>
            </div>
            <FaChevronDown className={`text-gray-300 text-[10px] transition-transform duration-200 ${composerOpen ? 'rotate-180' : ''}`} />
          </button>

          {composerOpen && (
            <div className="p-3 space-y-3 border-t border-gray-100">
              {/* Templates */}
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] text-gray-400">Plantilla:</span>
                {(['renovar', 'pago', 'caratula'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => applyTemplate(t)}
                    className={`px-2 py-0.5 text-[10px] rounded-full cursor-pointer transition-all duration-150 ${
                      emailTemplate === t ? 'bg-[#010139] text-white' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Subject (auto) */}
              <div className="text-[10px] text-gray-400 bg-gray-50/80 px-2.5 py-1.5 rounded-md font-mono">
                Asunto: [{c.ticket}] Renovación póliza {c.policy_number} — {c.insurer_name || ''}
              </div>

              {/* Body */}
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Escribe tu mensaje..."
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#010139]/30 focus:ring-1 focus:ring-[#010139]/10 resize-none transition-all duration-150 placeholder:text-gray-300"
              />

              {/* Attachments + Send */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 rounded-md cursor-pointer hover:bg-gray-50 transition-colors duration-150"
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
                    <span key={i} className="inline-flex items-center text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {f.name}
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={!emailBody.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#010139] text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#020270] disabled:opacity-30 transition-all duration-150"
                >
                  <FaPaperPlane className="text-[9px]" /> Enviar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Last email summary */}
        {c.last_email_summary && (
          <div className="bg-gray-50/80 border border-gray-100 rounded-lg p-3">
            <p className="text-[10px] font-medium text-gray-500 mb-1">Último correo</p>
            <p className="text-[10px] text-gray-600 leading-relaxed">{c.last_email_summary}</p>
          </div>
        )}

        {/* ── Message Thread (IMAP synced messages) ── */}
        <MessageThread caseId={c.id} />
      </div>
    </div>
  );
}
