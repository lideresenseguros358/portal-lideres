'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaClipboardList,
  FaFileExcel,
  FaFilePdf,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaInfoCircle,
  FaExclamationCircle,
  FaHistory,
  FaStickyNote,
  FaRobot,
  FaBrain,
  FaCog,
  FaServer,
  FaSpinner,
  FaTimesCircle,
  FaEye,
} from 'react-icons/fa';
import AuditDrawer from './AuditDrawer';

// ═══════════════════════════════════════════════════════
// OpsAuditoriaTab — Logs & Auditoría (Operaciones)
// Unified feed, advanced filters, case drill-down, exports
// ═══════════════════════════════════════════════════════

interface FeedItem {
  source: 'activity' | 'history' | 'ai_eval' | 'ai_event' | 'note' | 'session' | 'cron';
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  case_id: string | null;
  ticket: string | null;
  case_type: string | null;
  label: string;
  severity: 'info' | 'warn' | 'critical';
  summary: string;
  raw_ref: string;
  metadata: Record<string, any> | null;
}

interface Filters {
  masters: { id: string; name: string }[];
  action_types: string[];
  case_types: string[];
  statuses: string[];
}

interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info';
}

const PAGE_SIZE = 50;

function sevenDaysAgo(): string {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfDay(d: string): string {
  return `${d}T00:00:00.000Z`;
}
function endOfDay(d: string): string {
  return `${d}T23:59:59.999Z`;
}

export default function OpsAuditoriaTab() {
  // ── State ──
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, info: 0, warn: 0, critical: 0 });

  // Filters
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState(sevenDaysAgo());
  const [dateTo, setDateTo] = useState(todayStr());
  const [userId, setUserId] = useState('');
  const [caseType, setCaseType] = useState('');
  const [actionType, setActionType] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState<string | null>('week');

  // Filter options
  const [filterOpts, setFilterOpts] = useState<Filters>({ masters: [], action_types: [], case_types: [], statuses: [] });

  // Drawer
  const [drawerCaseId, setDrawerCaseId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const addToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  // Debounce
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch filter options ──
  useEffect(() => {
    fetch('/api/operaciones/auditoria?view=filters')
      .then(r => r.json())
      .then(d => setFilterOpts(d))
      .catch(() => {});
  }, []);

  // ── Fetch feed ──
  const fetchFeed = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: 'feed',
        from: startOfDay(dateFrom),
        to: endOfDay(dateTo),
        page: String(p),
        page_size: String(PAGE_SIZE),
      });
      if (userId) params.set('user_id', userId);
      if (caseType) params.set('case_type', caseType);
      if (actionType) params.set('action_type', actionType);
      if (q) params.set('q', q);
      if (onlyCritical) params.set('only_critical', 'true');

      const res = await fetch(`/api/operaciones/auditoria?${params}`);
      const json = await res.json();
      setFeed(json.data || []);
      setTotal(json.total || 0);
      setCounts(json.counts || { total: 0, info: 0, warn: 0, critical: 0 });
      setPage(p);
    } catch (err) {
      console.error('Feed error:', err);
      addToast('Error al cargar feed', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, userId, caseType, actionType, q, onlyCritical, addToast]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchFeed(1), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchFeed]);

  // Page change
  useEffect(() => {
    if (page > 1) fetchFeed(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Quick filter pills ──
  const applyQuickFilter = (key: string) => {
    const now = new Date();
    setQuickFilter(key);
    setOnlyCritical(false);
    setActionType('');
    setCaseType('');
    setUserId('');
    setQ('');

    switch (key) {
      case 'today':
        setDateFrom(todayStr());
        setDateTo(todayStr());
        break;
      case 'week':
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
        break;
      case 'sla':
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
        setQ('sla_breach');
        break;
      case 'ia':
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
        setActionType('ai_eval');
        break;
      case 'email':
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
        setQ('email_sent');
        break;
      case 'status':
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
        setQ('status_change');
        break;
      default:
        setDateFrom(sevenDaysAgo());
        setDateTo(todayStr());
    }
  };

  // ── Export ──
  const handleExport = async (format: 'xlsx' | 'pdf', caseId?: string) => {
    setExporting(format);
    try {
      const body: any = {
        from: startOfDay(dateFrom),
        to: endOfDay(dateTo),
      };
      if (userId) body.user_id = userId;
      if (caseType) body.case_type = caseType;
      if (actionType) body.action_type = actionType;
      if (q) body.q = q;
      if (caseId) {
        body.scope = 'case';
        body.case_id = caseId;
      } else {
        body.scope = 'global';
      }

      const res = await fetch(`/api/operaciones/auditoria/export?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        addToast('Espera 30 segundos entre exportaciones', 'error');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : 'html';
      a.download = `auditoria_${caseId ? caseId.substring(0, 8) + '_' : ''}${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(`${format.toUpperCase()} descargado`, 'success');
    } catch (err: any) {
      console.error('Export error:', err);
      addToast(err.message || 'Error al exportar', 'error');
    } finally {
      setExporting(null);
    }
  };

  // ── Helpers ──
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('es-PA', { timeZone: 'America/Panama' }); }
    catch { return iso; }
  };

  const severityBadge = (sev: string) => {
    if (sev === 'critical') return <FaExclamationTriangle className="text-red-500 text-[10px]" />;
    if (sev === 'warn') return <FaExclamationCircle className="text-yellow-500 text-[10px]" />;
    return <FaInfoCircle className="text-blue-400 text-[10px]" />;
  };

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'activity': return <FaClipboardList className="text-blue-500" />;
      case 'history': return <FaHistory className="text-indigo-500" />;
      case 'ai_eval': return <FaRobot className="text-purple-500" />;
      case 'ai_event': return <FaBrain className="text-pink-500" />;
      case 'note': return <FaStickyNote className="text-yellow-600" />;
      case 'session': return <FaCog className="text-gray-500" />;
      case 'cron': return <FaServer className="text-teal-600" />;
      default: return <FaClipboardList className="text-gray-400" />;
    }
  };

  const sourceLabel = (source: string) => {
    const m: Record<string, string> = {
      activity: 'Actividad',
      history: 'Historial',
      ai_eval: 'IA Eval',
      ai_event: 'IA Evento',
      note: 'Nota',
      session: 'Sesión',
      cron: 'Cron',
    };
    return m[source] || source;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pills = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta semana' },
    { key: 'sla', label: 'SLA breaches' },
    { key: 'ia', label: 'IA eventos' },
    { key: 'email', label: 'Envíos correo' },
    { key: 'status', label: 'Cambios estado' },
  ];

  return (
    <div className="space-y-3">
      {/* Toast */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium transition-all duration-300 animate-in slide-in-from-right-3 fade-in ${
            t.type === 'success' ? 'bg-gray-800 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-700 text-white'
          }`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 flex items-center gap-2.5">
        <FaClipboardList className="text-gray-400 text-xs flex-shrink-0" />
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-600">Auditoría</span> — Retención: 3 años. Diffs before/after se almacenan automáticamente.
        </p>
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
          <div className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Total</div>
          <div className="text-lg font-bold text-[#010139] tabular-nums">{counts.total}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
          <div className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Info</div>
          <div className="text-lg font-bold text-blue-500 tabular-nums">{counts.info}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
          <div className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Advertencias</div>
          <div className="text-lg font-bold text-amber-500 tabular-nums">{counts.warn}</div>
        </div>
        <div className={`bg-white border rounded-lg p-2.5 text-center ${counts.critical > 0 ? 'border-red-100' : 'border-gray-200'}`}>
          <div className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Críticos</div>
          <div className={`text-lg font-bold tabular-nums ${counts.critical > 0 ? 'text-red-600' : 'text-gray-400'}`}>{counts.critical}</div>
        </div>
      </div>

      {/* Search + Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        {/* Row 1: Search + buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px] pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setQuickFilter(null); }}
              placeholder="Buscar por usuario, ticket, evento..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none transition-all duration-150"
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className={`p-1.5 rounded-md transition-all duration-150 cursor-pointer flex-shrink-0 ${showFilters ? 'bg-[#010139] text-white' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}>
            <FaFilter className="text-[10px]" />
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="p-1.5 rounded-md text-gray-300 hover:text-red-400 hover:bg-gray-50 transition-all duration-150 cursor-pointer flex-shrink-0 disabled:opacity-50"
            title="Exportar PDF"
          >
            {exporting === 'pdf' ? <FaSpinner className="text-[10px] animate-spin text-red-400" /> : <FaFilePdf className="text-[10px]" />}
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="p-1.5 rounded-md text-gray-300 hover:text-green-500 hover:bg-gray-50 transition-all duration-150 cursor-pointer flex-shrink-0 disabled:opacity-50"
            title="Exportar Excel"
          >
            {exporting === 'xlsx' ? <FaSpinner className="text-[10px] animate-spin text-green-500" /> : <FaFileExcel className="text-[10px]" />}
          </button>
          <button onClick={() => fetchFeed(1)}
            className="p-1.5 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all duration-150 cursor-pointer flex-shrink-0"
            title="Refrescar"
          >
            <FaSync className={`text-[10px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Row 2: Quick filter pills */}
        <div className="flex flex-wrap gap-1">
          {pills.map(p => (
            <button
              key={p.key}
              onClick={() => applyQuickFilter(p.key)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 cursor-pointer
                ${quickFilter === p.key
                  ? 'bg-[#010139] text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Row 3: Date range */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <FaCalendarAlt className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 text-[9px] pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setQuickFilter(null); }}
              className="pl-6 pr-2 py-1 text-[10px] border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none transition-all duration-150"
            />
          </div>
          <span className="text-[10px] text-gray-300">—</span>
          <div className="relative">
            <FaCalendarAlt className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 text-[9px] pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setQuickFilter(null); }}
              className="pl-6 pr-2 py-1 text-[10px] border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none transition-all duration-150"
            />
          </div>
          {onlyCritical && (
            <button onClick={() => { setOnlyCritical(false); setQuickFilter(null); }}
              className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50/60 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-50 transition-colors duration-150">
              <FaTimesCircle className="text-[8px]" /> Solo críticos
            </button>
          )}
        </div>

        {/* Row 4: Expanded filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-gray-100">
            <select value={userId} onChange={e => { setUserId(e.target.value); setQuickFilter(null); }}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none">
              <option value="">Todos los usuarios</option>
              {filterOpts.masters.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select value={caseType} onChange={e => { setCaseType(e.target.value); setQuickFilter(null); }}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none">
              <option value="">Tipo de caso</option>
              {filterOpts.case_types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={actionType} onChange={e => { setActionType(e.target.value); setQuickFilter(null); }}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:ring-1 focus:ring-[#010139]/10 focus:border-gray-300 outline-none">
              <option value="">Tipo de acción</option>
              {filterOpts.action_types.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyCritical}
                onChange={e => { setOnlyCritical(e.target.checked); setQuickFilter(null); }}
                className="rounded border-gray-200 w-3.5 h-3.5"
              />
              Solo críticos
            </label>
          </div>
        )}
      </div>

      {/* Feed Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider w-[140px]">Fecha/Hora</th>
                <th className="text-center px-2 py-2.5 w-[28px]"></th>
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider w-[80px]">Fuente</th>
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider w-[120px]">Usuario</th>
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider">Acción</th>
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider w-[90px]">Ticket</th>
                <th className="text-left px-3 py-2.5 text-[9px] font-medium text-gray-400 uppercase tracking-wider">Resumen</th>
                <th className="text-center px-2 py-2.5 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && feed.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-100 rounded w-24" /></td>
                    <td className="px-2 py-2.5"><div className="h-2.5 bg-gray-50 rounded w-3 mx-auto" /></td>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-100 rounded w-14" /></td>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-100 rounded w-20" /></td>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-100 rounded w-28" /></td>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-50 rounded w-16" /></td>
                    <td className="px-3 py-2.5"><div className="h-2.5 bg-gray-100 rounded w-40" /></td>
                    <td className="px-2 py-2.5"><div className="h-2.5 bg-gray-50 rounded w-5 mx-auto" /></td>
                  </tr>
                ))
              ) : feed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                      <FaClipboardList className="text-gray-300 text-sm" />
                    </div>
                    <p className="text-xs font-medium text-gray-500">No hay eventos para este rango</p>
                    <p className="text-[10px] text-gray-400 mt-1">Ajusta los filtros o el periodo de búsqueda</p>
                  </td>
                </tr>
              ) : (
                feed.map((item, idx) => (
                  <tr
                    key={`${item.raw_ref}-${idx}`}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-100
                      ${item.severity === 'critical' ? 'bg-red-50/30' : item.severity === 'warn' ? 'bg-amber-50/20' : ''}`}
                  >
                    <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap tabular-nums">{fmtDate(item.timestamp)}</td>
                    <td className="px-2 py-2 text-center">{severityBadge(item.severity)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] opacity-60">{sourceIcon(item.source)}</span>
                        <span className="text-[10px] text-gray-400">{sourceLabel(item.source)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-medium text-gray-600 truncate max-w-[120px]">
                      {item.user_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600">{item.label}</td>
                    <td className="px-3 py-2">
                      {item.ticket ? (
                        <button
                          onClick={() => item.case_id && setDrawerCaseId(item.case_id)}
                          className="text-[#010139] hover:text-[#010139]/70 cursor-pointer font-mono text-[10px] transition-colors duration-150"
                        >
                          {item.ticket}
                        </button>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-400 truncate max-w-[250px]" title={item.summary}>
                      {item.summary}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {item.case_id && (
                        <button
                          onClick={() => setDrawerCaseId(item.case_id)}
                          className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-50 cursor-pointer transition-all duration-150"
                          title="Ver timeline del caso"
                        >
                          <FaEye className="text-[10px]" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
            <span className="text-[10px] text-gray-400 tabular-nums">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer transition-all duration-150"
              >
                <FaChevronLeft className="text-[10px]" />
              </button>
              <span className="text-[10px] text-gray-400 px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 cursor-pointer transition-all duration-150"
              >
                <FaChevronRight className="text-[10px]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading overlay on feed */}
      {loading && feed.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-md rounded-full px-4 py-2 flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <FaSpinner className="animate-spin text-gray-400 text-[10px]" />
          <span className="text-[10px] text-gray-500">Cargando...</span>
        </div>
      )}

      {/* Audit Drawer */}
      {drawerCaseId && (
        <AuditDrawer
          caseId={drawerCaseId}
          onClose={() => setDrawerCaseId(null)}
          onExport={(format, cid) => handleExport(format, cid)}
        />
      )}
    </div>
  );
}
