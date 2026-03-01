'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSync,
  FaSearch,
  FaEnvelope,
  FaPaperclip,
  FaCheck,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaTimes,
} from 'react-icons/fa';
import type { OpsCaseMessage, OpsCase } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// SANITIZE HTML
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
// ASSIGN MODAL
// ════════════════════════════════════════════

function AssignModal({
  message,
  onClose,
  onAssign,
}: {
  message: OpsCaseMessage;
  onClose: () => void;
  onAssign: (messageId: string, caseId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<OpsCase[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/operaciones/renewals?search=${encodeURIComponent(search)}&limit=10`);
      const json = await res.json();
      setResults(json.data || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(doSearch, 400);
    return () => clearTimeout(t);
  }, [doSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-[#010139]">Asignar Correo a Caso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <FaTimes />
          </button>
        </div>

        {/* Email preview */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-[10px] text-gray-500">De: <strong>{message.from_email}</strong></p>
          <p className="text-[10px] text-gray-500 truncate">Asunto: {message.subject}</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <div className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar caso por ticket, póliza, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#010139]/30"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <FaSync className="animate-spin text-gray-300" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-6">
              {search ? 'Sin resultados' : 'Escribe para buscar casos'}
            </p>
          ) : (
            <div className="space-y-1">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onAssign(message.id, c.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 border border-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#010139]">{c.client_name || 'Sin nombre'}</span>
                    <span className="text-[10px] text-gray-400">{c.ticket}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                    <span>{c.policy_number || '—'}</span>
                    <span>·</span>
                    <span>{c.insurer_name || '—'}</span>
                    <span>·</span>
                    <span>{c.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function UnclassifiedMessages() {
  const [messages, setMessages] = useState<OpsCaseMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<OpsCaseMessage | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUnclassified = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/operaciones/messages?unclassified=true&limit=100');
      if (!res.ok) throw new Error('fetch error');
      const json = await res.json();
      setMessages(json.messages || []);
    } catch (err) {
      console.error('[Unclassified] fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUnclassified();
  }, [fetchUnclassified]);

  const handleAssign = async (messageId: string, caseId: string) => {
    setActionLoading(messageId);
    try {
      const res = await fetch('/api/operaciones/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', message_id: messageId, case_id: caseId }),
      });
      if (!res.ok) throw new Error('assign failed');
      setAssignTarget(null);
      // Remove from list
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('[Unclassified] assign error:', err);
    }
    setActionLoading(null);
  };

  const handleDiscard = async (messageId: string) => {
    if (!confirm('¿Descartar este correo? No se eliminará pero dejará de aparecer aquí.')) return;
    setActionLoading(messageId);
    try {
      const res = await fetch('/api/operaciones/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard', message_id: messageId }),
      });
      if (!res.ok) throw new Error('discard failed');
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('[Unclassified] discard error:', err);
    }
    setActionLoading(null);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-amber-500 text-sm" />
          <h2 className="text-sm font-bold text-[#010139]">Correos No Clasificados</h2>
          {messages.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchUnclassified}
          className="text-gray-400 hover:text-[#010139] cursor-pointer"
        >
          <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <FaSync className="animate-spin text-2xl" />
            <span className="text-xs">Cargando...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-16">
            <FaEnvelope className="text-3xl" />
            <span className="text-xs">Sin correos pendientes de clasificación</span>
          </div>
        ) : (
          messages.map((m) => {
            const isExpanded = expandedId === m.id;
            const isActioning = actionLoading === m.id;
            const hasAttach = m.metadata?.has_attachments;
            const preview = m.body_text
              ? m.body_text.substring(0, 100).replace(/\n/g, ' ') + (m.body_text.length > 100 ? '…' : '')
              : '';

            return (
              <div key={m.id} className="border-b border-gray-100">
                {/* Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#010139] truncate max-w-[60%]">
                      {m.from_email}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasAttach && <FaPaperclip className="text-gray-400 text-[10px]" />}
                      <span className="text-[10px] text-gray-400">{fmtDate(m.received_at)}</span>
                      {isExpanded ? (
                        <FaChevronUp className="text-[8px] text-gray-400" />
                      ) : (
                        <FaChevronDown className="text-[8px] text-gray-400" />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-700 font-medium truncate">{m.subject || '(sin asunto)'}</p>
                  {!isExpanded && preview && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{preview}</p>
                  )}
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {/* Body */}
                    <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-auto">
                      {m.body_html ? (
                        <div
                          className="prose prose-xs max-w-none text-[11px] text-gray-700"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body_html) }}
                        />
                      ) : m.body_text ? (
                        <pre className="whitespace-pre-wrap text-[11px] text-gray-700 font-sans">
                          {m.body_text}
                        </pre>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">(sin contenido)</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAssignTarget(m); }}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#010139] text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-[#020270] disabled:opacity-40 transition-colors"
                      >
                        <FaCheck className="text-[8px] text-white" /> Asignar a Caso
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDiscard(m.id); }}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        <FaTrash className="text-[8px]" /> Descartar
                      </button>
                      {isActioning && <FaSync className="animate-spin text-gray-400 text-xs" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal
          message={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssign}
        />
      )}
    </div>
  );
}
