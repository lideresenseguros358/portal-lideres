'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FaSearch,
  FaComments,
  FaExclamationTriangle,
  FaRobot,
  FaUser,
  FaPhone,
  FaMapMarkerAlt,
  FaTimes,
  FaSync,
  FaWhatsapp,
  FaPaperPlane,
  FaArrowLeft,
  FaUserTie,
  FaCog,
  FaTag,
  FaRedoAlt,
  FaCheck,
  FaBolt,
} from 'react-icons/fa';
import type { ChatThread, ChatMessage } from '@/types/chat.types';

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtRelative = (d: string | null) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

function CategoryBadge({ category }: { category: string }) {
  const fallback = { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Simple' };
  const m: Record<string, { bg: string; text: string; label: string }> = {
    simple: fallback,
    lead: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Lead' },
    urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },
  };
  const s = m[category] ?? fallback;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text}`}>
      {category === 'urgent' && <FaExclamationTriangle className="mr-0.5 text-[8px]" />}
      {category === 'lead' && <FaBolt className="mr-0.5 text-[8px]" />}
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string }> = {
    open: { bg: 'bg-green-100', text: 'text-green-700' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
    urgent: { bg: 'bg-red-100', text: 'text-red-700' },
    closed: { bg: 'bg-gray-200', text: 'text-gray-600' },
  };
  const s = m[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

function AssignedBadge({ type, aiEnabled }: { type: string; aiEnabled: boolean }) {
  if (type === 'ai') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
        <FaRobot className="text-[8px]" /> LISSA AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
      <FaUserTie className="text-[8px]" /> Master
    </span>
  );
}

// ════════════════════════════════════════════
// THREAD LIST
// ════════════════════════════════════════════

function ThreadList({
  threads, summary, loading, selectedId,
  onSelect, onRefresh,
  search, setSearch, filterStatus, setFilterStatus, filterCategory, setFilterCategory,
}: {
  threads: ChatThread[]; summary: any; loading: boolean; selectedId: string | null;
  onSelect: (id: string) => void; onRefresh: () => void;
  search: string; setSearch: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterCategory: string; setFilterCategory: (v: string) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#010139]">💬 Chats</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">{summary.total || 0} conv.</span>
            <button onClick={onRefresh} className="text-gray-400 hover:text-[#010139] cursor-pointer">
              <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none" />
          <input type="text" placeholder="Buscar..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#010139]/30" />
        </div>

        {/* Filters: Todos + Urgente pill + dropdown */}
        <div className="flex items-center gap-1.5">
          {/* Todos */}
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
            className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full cursor-pointer transition-all duration-150 ${
              !filterStatus && !filterCategory
                ? 'bg-[#010139] text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            Todos
            {summary.total ? <span className="text-[9px] opacity-70">({summary.total})</span> : null}
          </button>

          {/* Urgente — always visible, highlighted red */}
          <button
            onClick={() => {
              const isActive = filterStatus === 'urgent';
              setFilterStatus(isActive ? '' : 'urgent');
              if (!isActive) setFilterCategory('');
            }}
            className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full cursor-pointer transition-all duration-150 ${
              filterStatus === 'urgent'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}>
            <FaExclamationTriangle className="text-[9px]" />
            Urgente
            {summary.urgent ? <span className="text-[9px] opacity-70">({summary.urgent})</span> : null}
          </button>

          {/* Dropdown for remaining filters */}
          <div className="relative">
            <select
              value={
                filterStatus === 'urgent' ? '' :
                filterStatus ? `s:${filterStatus}` :
                filterCategory ? `c:${filterCategory}` : ''
              }
              onChange={e => {
                const v = e.target.value;
                if (!v) { setFilterStatus(''); setFilterCategory(''); return; }
                if (v.startsWith('s:')) { setFilterStatus(v.slice(2)); setFilterCategory(''); }
                else if (v.startsWith('c:')) { setFilterCategory(v.slice(2)); setFilterStatus(''); }
              }}
              className={`appearance-none pl-2.5 pr-6 py-1 text-[11px] font-medium rounded-full border cursor-pointer transition-all outline-none ${
                (filterStatus && filterStatus !== 'urgent') || filterCategory
                  ? 'bg-[#8AAA19] text-white border-[#8AAA19] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <option value="">Filtrar...</option>
              <optgroup label="Estado">
                <option value="s:open">🟢 Abierto{summary.open ? ` (${summary.open})` : ''}</option>
                <option value="s:closed">⚫ Cerrado</option>
              </optgroup>
              <optgroup label="Categoría">
                <option value="c:simple">💬 Simple</option>
                <option value="c:lead">⚡ Lead</option>
              </optgroup>
            </select>
            <FaTag className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] pointer-events-none opacity-50" />
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 bg-gray-50/80 text-[10px]">
        <span className="inline-flex items-center gap-1 text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#010139] animate-pulse" />
          No leídos: <strong className="text-[#010139]">{summary.unread || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1 text-gray-400">
          <FaRobot className="text-[9px] text-purple-400" />
          AI: <strong className="text-purple-600">{summary.ai || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1 text-gray-400">
          <FaUserTie className="text-[9px] text-blue-400" />
          Master: <strong className="text-blue-600">{summary.master || 0}</strong>
        </span>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="py-16 text-center">
            <FaComments className="text-3xl text-gray-300 mx-auto mb-3" />
            <p className="text-xs text-gray-500">Sin conversaciones</p>
            <p className="text-[10px] text-gray-400 mt-1">Las conversaciones se crean al recibir mensajes de WhatsApp</p>
          </div>
        ) : (
          threads.map(t => (
            <div key={t.id}
              onClick={() => onSelect(t.id)}
              className={`flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
                selectedId === t.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              } ${t.category === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}>

              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                t.category === 'urgent' ? 'bg-red-100' : t.category === 'lead' ? 'bg-emerald-100' : 'bg-gray-100'
              }`}>
                {t.category === 'urgent'
                  ? <FaExclamationTriangle className="text-red-500 text-sm" />
                  : <FaWhatsapp className="text-green-500 text-sm" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-[#010139] truncate">
                    {t.client_name || t.phone_e164}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                    {fmtRelative(t.last_message_at)}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 truncate mb-1">
                  {t.last_message_preview || 'Sin mensajes'}
                </p>

                <div className="flex items-center gap-1 flex-wrap">
                  <CategoryBadge category={t.category} />
                  <AssignedBadge type={t.assigned_type} aiEnabled={t.ai_enabled} />
                  {t.unread_count_master > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#010139] text-white text-[10px] font-bold">
                      {t.unread_count_master}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// CHAT VIEW
// ════════════════════════════════════════════

function ChatView({
  thread, messages, loading, onBack, onRefresh,
  onSend, sending, onToggleConfig,
}: {
  thread: ChatThread | null;
  messages: ChatMessage[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSend: (body: string) => void;
  sending: boolean;
  onToggleConfig: () => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  };

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
        <FaComments className="text-5xl mb-4" />
        <p className="text-sm font-medium">Selecciona una conversación</p>
        <p className="text-xs mt-1">Elige un chat del panel izquierdo</p>
      </div>
    );
  }

  const classification = thread.metadata?.last_classification;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat header */}
      <div className="bg-[#010139] text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden text-white cursor-pointer">
          <FaArrowLeft className="text-white" />
        </button>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          thread.category === 'urgent' ? 'bg-red-500' : 'bg-white/20'
        }`}>
          {thread.category === 'urgent'
            ? <FaExclamationTriangle className="text-white text-xs" />
            : <FaWhatsapp className="text-white text-xs" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{thread.client_name || thread.phone_e164}</span>
            <CategoryBadge category={thread.category} />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-blue-300">
            <FaPhone className="text-[8px]" /> {thread.phone_e164}
            {thread.region && <><span>·</span><FaMapMarkerAlt className="text-[8px]" /> {thread.region}</>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="text-white/60 hover:text-white cursor-pointer">
            <FaSync className={`text-xs text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onToggleConfig} className="text-white/60 hover:text-white cursor-pointer">
            <FaCog className="text-sm text-white" />
          </button>
        </div>
      </div>

      {/* Urgent banner */}
      {thread.category === 'urgent' && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-start gap-2">
          <FaExclamationTriangle className="text-red-500 mt-0.5 text-xs" />
          <div>
            <p className="text-xs font-bold text-red-800">🔴 CASO URGENTE — Severidad: {thread.severity?.toUpperCase()}</p>
            {classification?.executive_summary && (
              <ul className="text-[10px] text-red-700 mt-1 list-disc list-inside">
                {classification.executive_summary.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            )}
            {classification?.suggested_next_step && (
              <p className="text-[10px] text-red-600 mt-1 font-medium">→ {classification.suggested_next_step}</p>
            )}
          </div>
        </div>
      )}

      {/* AI Summary for non-urgent */}
      {thread.category !== 'urgent' && classification?.executive_summary?.length > 0 && (
        <div className="bg-purple-50 border-b border-purple-100 px-4 py-2">
          <div className="flex items-center gap-1 mb-1">
            <FaRobot className="text-purple-500 text-[10px]" />
            <span className="text-[10px] font-bold text-purple-700">Resumen IA</span>
          </div>
          <ul className="text-[10px] text-purple-600 list-disc list-inside">
            {classification.executive_summary.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Mode indicator */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <AssignedBadge type={thread.assigned_type} aiEnabled={thread.ai_enabled} />
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <FaTag className="text-[8px] text-gray-400" />
              {(thread.tags as string[]).slice(0, 3).map((tag, i) => (
                <span key={i} className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <StatusBadge status={thread.status} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {messages.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-400">
            <FaComments className="text-3xl mx-auto mb-2" />
            <p className="text-xs">Sin mensajes</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === 'inbound';
            const isSystem = msg.provider === 'system';
            const isAi = msg.ai_generated;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[10px] text-amber-700 max-w-[80%] text-center">
                    {msg.body}
                    <span className="block text-[9px] text-amber-400 mt-0.5">{fmtTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isInbound
                    ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                    : isAi
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : 'bg-[#010139] text-white rounded-br-md'
                }`}>
                  {/* Sender label */}
                  <div className={`flex items-center gap-1 mb-1 text-[9px] font-bold ${
                    isInbound ? 'text-gray-500' : 'text-white/70'
                  }`}>
                    {isInbound ? (
                      <><FaUser className="text-[7px]" /> Cliente</>
                    ) : isAi ? (
                      <><FaRobot className="text-[7px]" /> LISSA AI</>
                    ) : (
                      <><FaUserTie className="text-[7px]" /> Portal</>
                    )}
                  </div>

                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                  <div className={`flex items-center justify-end gap-2 mt-1.5 text-[9px] ${
                    isInbound ? 'text-gray-400' : 'text-white/50'
                  }`}>
                    {fmtTime(msg.created_at)}
                    {msg.tokens && msg.tokens > 0 && <span>· {msg.tokens}t</span>}
                    {msg.latency_ms && msg.latency_ms > 0 && <span>· {msg.latency_ms}ms</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex justify-center py-4">
            <FaSync className="animate-spin text-gray-300" />
          </div>
        )}
      </div>

      {/* Input bar */}
      {thread.status !== 'closed' && (
        <div className="border-t border-gray-200 px-3 py-2 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={thread.assigned_type === 'ai' ? '🤖 AI activa · Escribe para enviar' : 'Escribe un mensaje...'}
              rows={1}
              data-no-uppercase
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/30 max-h-24 normal-case"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#010139] text-white disabled:opacity-40 cursor-pointer flex-shrink-0">
              <FaPaperPlane className="text-xs text-white" />
            </button>
          </div>
          {thread.assigned_type === 'ai' && thread.ai_enabled && (
            <p className="text-[10px] text-purple-500 mt-1">🤖 LISSA AI está respondiendo automáticamente</p>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// CONFIG PANEL
// ════════════════════════════════════════════

interface MasterUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

function ConfigPanel({
  thread, onClose, onAssign, onChangeStatus, assigning,
}: {
  thread: ChatThread;
  onClose: () => void;
  onAssign: (target: 'ai' | { user_id: string }) => void;
  onChangeStatus: (status: string) => void;
  assigning: boolean;
}) {
  const classification = thread.metadata?.last_classification;
  const [masters, setMasters] = useState<MasterUser[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingMasters(true);
    fetch('/api/chats/masters')
      .then(r => r.json())
      .then(json => { if (!cancelled && json.success) setMasters(json.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingMasters(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-bold text-[#010139]">Configuración</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <FaTimes />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Assignment */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-2">Asignación</h4>
          <div className="space-y-2">
            {/* LISSA AI */}
            <button
              onClick={() => onAssign('ai')}
              disabled={assigning || (thread.assigned_type === 'ai' && thread.ai_enabled)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                thread.assigned_type === 'ai'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-purple-300 text-gray-700'
              }`}>
              <FaRobot className={thread.assigned_type === 'ai' ? 'text-purple-500' : 'text-gray-400'} />
              <div className="text-left">
                <p>LISSA AI</p>
                <p className="text-[10px] text-gray-400">Respuesta automática</p>
              </div>
              {thread.assigned_type === 'ai' && <FaCheck className="ml-auto text-purple-500" />}
            </button>

            {/* Master users list */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Asignar a Master</span>
              </div>
              {loadingMasters ? (
                <div className="px-3 py-4 text-center">
                  <FaSync className="animate-spin text-gray-300 mx-auto text-xs" />
                </div>
              ) : masters.length === 0 ? (
                <p className="px-3 py-3 text-[10px] text-gray-400 text-center">No se encontraron masters</p>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  {masters.map(m => {
                    const isAssigned = thread.assigned_type === 'master' && thread.assigned_master_user_id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onAssign({ user_id: m.id })}
                        disabled={assigning || isAssigned}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          isAssigned
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                          isAssigned ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                        </div>
                        {isAssigned && <FaCheck className="text-blue-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-2">Estado</h4>
          <div className="grid grid-cols-2 gap-2">
            {['open', 'pending', 'urgent', 'closed'].map(s => (
              <button key={s}
                onClick={() => onChangeStatus(s)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                  thread.status === s
                    ? s === 'urgent' ? 'bg-red-100 border-red-300 text-red-700' :
                      s === 'closed' ? 'bg-gray-200 border-gray-300 text-gray-700' :
                      'bg-green-100 border-green-300 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Classification detail */}
        {classification && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2">Clasificación IA</h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Intent:</span>
                <span className="font-medium text-gray-700">{classification.intent || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Categoría:</span>
                <CategoryBadge category={thread.category} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Severidad:</span>
                <span className={`font-bold ${
                  thread.severity === 'high' ? 'text-red-600' :
                  thread.severity === 'medium' ? 'text-amber-600' : 'text-green-600'
                }`}>{thread.severity?.toUpperCase()}</span>
              </div>
              {classification.suggested_next_step && (
                <div className="border-t border-gray-200 pt-2">
                  <span className="text-gray-500 block mb-1">Acción sugerida:</span>
                  <p className="text-gray-700">{classification.suggested_next_step}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {thread.tags && (thread.tags as string[]).length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {(thread.tags as string[]).map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                  <FaTag className="inline mr-1 text-[8px]" />{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Thread info */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 mb-2">Info</h4>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Thread ID:</span>
              <span className="font-mono text-gray-600 text-[9px]">{thread.id.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Canal:</span>
              <span className="text-gray-700">{thread.channel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Creado:</span>
              <span className="text-gray-700">{fmtDate(thread.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Último msg:</span>
              <span className="text-gray-700">{fmtDate(thread.last_message_at)}</span>
            </div>
          </div>
        </div>

        {/* Re-escalate button */}
        {thread.category === 'urgent' && (
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-red-700 transition-colors">
            <FaRedoAlt className="text-white" />
            <span className="text-white">Re-enviar Escalamiento</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function AdmCotChats() {
  const searchParams = useSearchParams();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loadingThreads, setLoadingThreads] = useState(false);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(searchParams.get('thread'));
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [showConfig, setShowConfig] = useState(false);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      const q = new URLSearchParams(params).toString();
      const res = await fetch(`/api/chats/threads?${q}`);
      const json = await res.json();
      if (json.success) {
        setThreads(json.data.rows);
        setSummary(json.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    }
    setLoadingThreads(false);
  }, [search, filterStatus, filterCategory]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchThreads, 15000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  // Fetch thread detail + messages
  const fetchThreadDetail = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chats/thread/${id}`);
      const json = await res.json();
      if (json.success) {
        setSelectedThread(json.data.thread);
        setMessages(json.data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch thread:', err);
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
      // Auto-refresh messages every 10s when viewing
      const interval = setInterval(() => fetchThreadDetail(selectedThreadId), 10000);
      return () => clearInterval(interval);
    } else {
      setSelectedThread(null);
      setMessages([]);
    }
  }, [selectedThreadId, fetchThreadDetail]);

  // Send manual message
  const handleSend = async (body: string) => {
    if (!selectedThreadId) return;
    setSending(true);
    try {
      await fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: selectedThreadId, body }),
      });
      await fetchThreadDetail(selectedThreadId);
      fetchThreads();
    } catch (err) {
      console.error('Send failed:', err);
    }
    setSending(false);
  };

  // Assign
  const handleAssign = async (target: 'ai' | { user_id: string }) => {
    if (!selectedThreadId) return;
    setAssigning(true);
    try {
      await fetch('/api/chats/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: selectedThreadId,
          assign_to: target === 'ai' ? 'ai' : target,
        }),
      });
      await fetchThreadDetail(selectedThreadId);
      fetchThreads();
    } catch (err) {
      console.error('Assign failed:', err);
    }
    setAssigning(false);
  };

  // Change status
  const handleChangeStatus = async (status: string) => {
    if (!selectedThreadId) return;
    try {
      await fetch(`/api/chats/thread/${selectedThreadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchThreadDetail(selectedThreadId);
      fetchThreads();
    } catch {}
  };

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    setShowConfig(false);
  };

  const goBackToList = () => {
    setSelectedThreadId(null);
    setShowConfig(false);
  };

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-[#010139]">Centro de Chats</h2>
        <p className="text-xs text-gray-500">WhatsApp + LISSA AI · Clasificación automática · Escalamiento urgente</p>
      </div>

      {/* Main layout */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* Left: Thread List */}
          <div className={`w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 ${
            selectedThreadId ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
          }`}>
            <ThreadList
              threads={threads}
              summary={summary}
              loading={loadingThreads}
              selectedId={selectedThreadId}
              onSelect={selectThread}
              onRefresh={fetchThreads}
              search={search}
              setSearch={setSearch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
            />
          </div>

          {/* Center: Chat View */}
          <div className={`flex-1 ${
            selectedThreadId ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}>
            <ChatView
              thread={selectedThread}
              messages={messages}
              loading={loadingMessages}
              onBack={goBackToList}
              onRefresh={() => selectedThreadId && fetchThreadDetail(selectedThreadId)}
              onSend={handleSend}
              sending={sending}
              onToggleConfig={() => setShowConfig(!showConfig)}
            />
          </div>

          {/* Right: Config Panel */}
          {showConfig && selectedThread && (
            <div className="w-72 xl:w-80 flex-shrink-0 hidden md:flex md:flex-col">
              <ConfigPanel
                thread={selectedThread}
                onClose={() => setShowConfig(false)}
                onAssign={handleAssign}
                onChangeStatus={handleChangeStatus}
                assigning={assigning}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
