'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSearch,
  FaComments,
  FaChevronRight,
  FaExclamationTriangle,
  FaRobot,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaIdCard,
  FaMapMarkerAlt,
  FaTimesCircle,
  FaArrowUp,
  FaCheckCircle,
  FaLock,
  FaTimes,
  FaSync,
  FaTasks,
  FaWhatsapp,
  FaGlobe,
} from 'react-icons/fa';
import { maskIp, maskCedula } from '@/types/adm-cot.types';

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

const apiGet = async (params: Record<string, string>) => {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`/api/adm-cot/chat?${q}`);
  return r.json();
};
const apiPost = async (action: string, data: Record<string, any>) => {
  const r = await fetch('/api/adm-cot/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  return r.json();
};
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: 'bg-green-100', text: 'text-green-800' },
    ESCALATED: { bg: 'bg-red-100', text: 'text-red-800' },
    CLOSED: { bg: 'bg-gray-200', text: 'text-gray-600' },
  };
  const s = m[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      {status === 'ESCALATED' && <FaArrowUp className="mr-1" />}
      {status}
    </span>
  );
}

function ClassBadge({ classification }: { classification: string }) {
  const fallback = { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Consulta' };
  const m: Record<string, { bg: string; text: string; label: string }> = {
    CONSULTA: fallback,
    COTIZACION: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Cotización' },
    SOPORTE: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Soporte' },
    QUEJA: { bg: 'bg-red-100', text: 'text-red-800', label: 'Queja' },
  };
  const s = m[classification] ?? fallback;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      {classification === 'QUEJA' && <FaExclamationTriangle className="mr-1" />}
      {s.label}
    </span>
  );
}

function SourceIcon({ source }: { source: string }) {
  return source === 'WHATSAPP'
    ? <FaWhatsapp className="text-green-500" title="WhatsApp" />
    : <FaGlobe className="text-blue-500" title="Portal" />;
}

// ════════════════════════════════════════════
// DETAIL PANEL
// ════════════════════════════════════════════

function ChatDetailPanel({ convId, onClose, onAction }: { convId: string; onClose: () => void; onAction: () => void }) {
  const [conv, setConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await apiGet({ tab: 'detail', id: convId });
      if (res.success) {
        setConv(res.data.conversation);
        setMessages(res.data.messages);
        setTasks(res.data.tasks);
      }
      setLoading(false);
    })();
  }, [convId]);

  const handleClose = async () => {
    await apiPost('close_conversation', { conversation_id: convId });
    onAction();
    onClose();
  };

  const handleResolveTask = async (taskId: string) => {
    await apiPost('resolve_task', { task_id: taskId });
    const res = await apiGet({ tab: 'detail', id: convId });
    if (res.success) setTasks(res.data.tasks);
    onAction();
  };

  if (loading || !conv) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white shadow-2xl flex items-center justify-center">
          <FaSync className="animate-spin text-2xl text-gray-300" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#010139] text-white px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <SourceIcon source={conv.source} />
                <StatusBadge status={conv.status} />
                <ClassBadge classification={conv.classification} />
                {conv.is_complex && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                    <FaExclamationTriangle className="mr-1" /> COMPLEJA
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-300">
                {conv.client_name || 'Anónimo'} · {conv.region || '—'}
              </p>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-200 text-lg cursor-pointer">
              <FaTimesCircle />
            </button>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FaPhone className="text-gray-400" /> {conv.phone || '—'}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FaEnvelope className="text-gray-400" /> {conv.email || '—'}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FaIdCard className="text-gray-400" /> {maskCedula(conv.cedula)}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FaMapMarkerAlt className="text-gray-400" /> {conv.region || '—'}
          </div>
          {conv.ip_address && (
            <div className="flex items-center gap-2 text-xs text-gray-400 col-span-2">
              <FaLock className="text-gray-300" /> IP: {maskIp(conv.ip_address)}
            </div>
          )}
        </div>

        {/* AI Summary */}
        {conv.ai_summary && (
          <div className="p-4 bg-purple-50 border-b border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <FaRobot className="text-purple-500" />
              <span className="text-xs font-bold text-purple-800">Resumen IA</span>
            </div>
            <p className="text-xs text-purple-700 leading-relaxed">{conv.ai_summary}</p>
          </div>
        )}

        {/* Escalation warning */}
        {conv.status === 'ESCALATED' && (
          <div className="p-3 bg-red-50 border-b border-red-200 flex items-start gap-2">
            <FaExclamationTriangle className="text-red-500 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-800">Conversación Escalada</p>
              <p className="text-[10px] text-red-600">{conv.escalated_reason || 'Queja compleja detectada'}</p>
              <p className="text-[10px] text-red-500 mt-0.5">Escalada: {fmtDate(conv.escalated_at)}</p>
            </div>
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="p-3 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center gap-2 mb-2">
              <FaTasks className="text-amber-600" />
              <span className="text-xs font-bold text-amber-800">Tareas ({tasks.length})</span>
            </div>
            {tasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-xs mb-1">
                <div>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    t.priority === 'URGENTE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{t.priority}</span>
                  <span className={`ml-2 ${t.status === 'RESOLVED' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {t.summary || 'Sin resumen'}
                  </span>
                  <span className={`ml-2 text-[10px] ${
                    t.status === 'OPEN' ? 'text-amber-600' : t.status === 'RESOLVED' ? 'text-green-600' : 'text-blue-600'
                  }`}>[{t.status}]</span>
                </div>
                {t.status !== 'RESOLVED' && (
                  <button onClick={() => handleResolveTask(t.id)}
                    className="text-[10px] text-green-600 hover:text-green-800 cursor-pointer flex items-center gap-1">
                    <FaCheckCircle /> Resolver
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FaComments className="text-3xl mx-auto mb-2" />
              <p className="text-sm">Sin mensajes registrados</p>
            </div>
          ) : (
            messages.map((msg: any) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'USER' && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'SYSTEM' ? 'bg-amber-100' : 'bg-purple-100'
                  }`}>
                    {msg.role === 'SYSTEM' ? <FaLock className="text-amber-500 text-[10px]" /> : <FaRobot className="text-purple-500 text-[10px]" />}
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                  msg.role === 'USER' ? 'bg-[#010139] text-white'
                    : msg.role === 'SYSTEM' ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${msg.role === 'USER' ? 'text-blue-300' : 'text-gray-400'}`}>
                    {fmtDate(msg.created_at)}
                    {msg.tokens_used > 0 && ` · ${msg.tokens_used} tokens`}
                  </p>
                </div>
                {msg.role === 'USER' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FaUser className="text-blue-500 text-[10px]" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <FaLock />
              <span>Mensajes almacenados completos · IP mascarada en UI</span>
            </div>
            {conv.status !== 'CLOSED' && (
              <button onClick={handleClose}
                className="px-3 py-1.5 bg-gray-600 text-white text-[10px] font-medium rounded-lg cursor-pointer">
                <span className="text-white">Marcar Resuelto</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Creada: {fmtDate(conv.created_at)}
            {conv.closed_at && ` · Cerrada: ${fmtDate(conv.closed_at)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function AdmCotChats() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [classification, setClassification] = useState('');
  const [isComplex, setIsComplex] = useState('');
  const [source, setSource] = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { tab: 'conversations' };
    if (search) params.search = search;
    if (status) params.status = status;
    if (classification) params.classification = classification;
    if (isComplex) params.is_complex = isComplex;
    if (source) params.source = source;
    const res = await apiGet(params);
    if (res.success) {
      setConversations(res.data.rows);
      setSummary(res.data.summary);
    }
    setLoading(false);
  }, [search, status, classification, isComplex, source]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const clearFilters = () => {
    setSearch(''); setStatus(''); setClassification(''); setIsComplex(''); setSource('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#010139]">Seguimiento de Chats</h2>
        <p className="text-xs text-gray-500">Conversaciones con IA, clasificación automática, escalamiento y tareas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total || 0, bg: 'bg-gray-50', border: 'border-gray-200', color: 'text-gray-500' },
          { label: 'Abiertos', value: summary.open || 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'Escalados', value: summary.escalated || 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
          { label: 'Cerrados', value: summary.closed || 0, bg: 'bg-gray-50', border: 'border-gray-200', color: 'text-gray-500' },
          { label: 'Complejas', value: summary.complex || 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
            <p className={`text-[10px] font-semibold uppercase ${c.color}`}>{c.label}</p>
            <p className="text-xl font-bold text-[#010139]">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input type="text" placeholder="Buscar nombre, teléfono, email, cédula..."
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchConversations()}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#010139]/20" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Estado</option><option value="OPEN">Abierto</option><option value="ESCALATED">Escalado</option><option value="CLOSED">Cerrado</option>
        </select>
        <select value={classification} onChange={e => setClassification(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Clasificación</option><option value="CONSULTA">Consulta</option><option value="COTIZACION">Cotización</option><option value="SOPORTE">Soporte</option><option value="QUEJA">Queja</option>
        </select>
        <select value={isComplex} onChange={e => setIsComplex(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Compleja</option><option value="true">Sí</option><option value="false">No</option>
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Origen</option><option value="PORTAL">Portal</option><option value="WHATSAPP">WhatsApp</option>
        </select>
        <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"><FaTimes /></button>
        <button onClick={fetchConversations}
          className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer">
          <FaSync className={`text-white ${loading ? 'animate-spin' : ''}`} /> <span className="text-white">Buscar</span>
        </button>
      </div>

      {/* Conversations list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {conversations.length === 0 ? (
          <div className="py-16 text-center">
            <FaComments className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No hay conversaciones registradas</p>
            <p className="text-xs text-gray-400 mt-1">Las conversaciones se crean al procesar mensajes via /api/adm-cot/chat/process</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((c: any) => (
              <div key={c.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                  c.status === 'ESCALATED' ? 'border-l-4 border-red-500' : c.is_complex ? 'border-l-4 border-amber-400' : ''
                }`}
                onClick={() => setSelectedConvId(c.id)}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  c.status === 'ESCALATED' ? 'bg-red-100' : c.is_complex ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  {c.status === 'ESCALATED' ? <FaExclamationTriangle className="text-red-500" />
                    : c.is_complex ? <FaExclamationTriangle className="text-amber-500" />
                    : <SourceIcon source={c.source} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-medium text-[#010139]">{c.client_name || c.phone || c.email || 'Anónimo'}</span>
                    <ClassBadge classification={c.classification} />
                    <StatusBadge status={c.status} />
                    {c.is_complex && (
                      <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">COMPLEJA</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{c.ai_summary || 'Sin resumen'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {c.source} · {c.region || '—'} · {fmtDate(c.created_at)}
                  </p>
                </div>
                <FaChevronRight className="text-gray-400 text-xs flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedConvId && (
        <ChatDetailPanel
          convId={selectedConvId}
          onClose={() => setSelectedConvId(null)}
          onAction={fetchConversations}
        />
      )}
    </div>
  );
}
