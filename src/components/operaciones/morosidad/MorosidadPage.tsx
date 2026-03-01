'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaEnvelope,
  FaCheckCircle,
  FaBan,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaClock,
  FaEllipsisV,
  FaStickyNote,
  FaExternalLinkAlt,
  FaBookmark,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import type { OpsMorosidadRow, OpsMorosidadStatus } from '@/types/operaciones.types';
import type { MorosidadCounts, MorosidadFilterKey } from './morosidad-helpers';
import {
  STATUS_CONFIG,
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  fmtCurrency,
  fmtDate,
  daysOverdueSeverity,
  daysOverdueColor,
} from './morosidad-helpers';
import { BulkEmailModal, NoteModal } from './MorosidadModals';

// ════════════════════════════════════════════
// Toast
// ════════════════════════════════════════════

interface Toast { id: number; msg: string; type: 'success' | 'error' }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium transition-all duration-300 animate-in slide-in-from-right-3 fade-in ${
          t.type === 'success' ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'
        }`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// Skeleton
// ════════════════════════════════════════════

function SkeletonTable() {
  return (
    <div className="space-y-1.5 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-50 rounded" style={{ animationDuration: '1.8s', animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// Action Dropdown
// ════════════════════════════════════════════

function ActionDropdown({ row, onAction }: {
  row: OpsMorosidadRow;
  onAction: (action: string, row: OpsMorosidadRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-50 cursor-pointer transition-all duration-150"
      >
        <FaEllipsisV className="text-[10px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { onAction('view_payments', row); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors duration-100"
          >
            <FaExternalLinkAlt className="text-[10px] text-gray-400" /> Ver historial pagos
          </button>
          {row.morosidad_status !== 'pago_recibido' && (
            <button
              onClick={() => { onAction('send_individual', row); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors duration-100"
            >
              <FaEnvelope className="text-[10px] text-gray-400" /> Enviar aviso individual
            </button>
          )}
          <div className="border-t border-gray-100 my-0.5" />
          <button
            onClick={() => { onAction('add_note', row); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors duration-100"
          >
            <FaStickyNote className="text-[10px] text-gray-400" /> Añadir nota
          </button>
          <button
            onClick={() => { onAction('follow_up', row); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors duration-100"
          >
            <FaBookmark className="text-[10px] text-gray-400" /> Marcar seguimiento
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════

const PAGE_SIZE = 25;
const emptyCounts: MorosidadCounts = { total: 0, al_dia: 0, atrasado: 0, pago_recibido: 0, cancelado: 0 };

export default function MorosidadPage() {
  // ── Data state ──
  const [rows, setRows] = useState<OpsMorosidadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<MorosidadCounts>(emptyCounts);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [ramos, setRamos] = useState<string[]>([]);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ramoFilter, setRamoFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [overdue30, setOverdue30] = useState(false);
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [contadoOnly, setContadoOnly] = useState(false);

  // ── Multi-select ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Modals ──
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [noteModal, setNoteModal] = useState<{ open: boolean; row: OpsMorosidadRow | null }>({ open: false, row: null });
  const [modalSaving, setModalSaving] = useState(false);

  // ── Toasts ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const addToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Debounced search ──
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearch = useRef('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      debouncedSearch.current = search;
      setPage(1);
      fetchData(1, search);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ═══════════════════════════════════════════
  // FETCH
  // ═══════════════════════════════════════════

  const fetchData = useCallback(async (p?: number, s?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p ?? page));
      params.set('limit', String(PAGE_SIZE));
      const q = s ?? debouncedSearch.current;
      if (q) params.set('search', q);
      if (statusFilter) params.set('status', statusFilter);
      if (ramoFilter) params.set('ramo', ramoFilter);
      if (overdue30) params.set('overdue_30', 'true');
      if (recurringOnly) params.set('recurring', 'true');
      if (contadoOnly) params.set('contado', 'true');

      const res = await fetch(`/api/operaciones/morosidad?${params}`);
      const json = await res.json();
      setRows(json.data || []);
      setTotal(json.total || 0);
      setCounts(json.counts || emptyCounts);
      setRamos(json.ramos || []);
    } catch (err) {
      console.error('[Morosidad] fetch error:', err);
    }
    setLoading(false);
  }, [page, statusFilter, ramoFilter, overdue30, recurringOnly, contadoOnly]);

  // Initial load
  useEffect(() => { fetchData(1); }, []);// eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on filter changes
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    fetchData(1, debouncedSearch.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, ramoFilter, overdue30, recurringOnly, contadoOnly]);

  // Refetch on page change
  useEffect(() => {
    if (page > 1) fetchData(page, debouncedSearch.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchData(page, debouncedSearch.current), 30000);
    return () => clearInterval(interval);
  }, [fetchData, page]);

  // ═══════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════

  const handleRefresh = () => {
    setSelected(new Set());
    fetchData(page, debouncedSearch.current);
  };

  const handleCardClick = (status: string) => {
    setStatusFilter((prev) => (prev === status ? '' : status));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = rows.filter((r) => r.morosidad_status !== 'pago_recibido');
    if (selected.size === selectable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((r) => r.policy_id)));
    }
  };

  const selectedRows = rows.filter((r) => selected.has(r.policy_id));

  const handleBulkEmail = async (subject: string, bodyTemplate: string) => {
    setModalSaving(true);
    try {
      const payload = selectedRows.map((r) => ({
        policy_id: r.policy_id,
        client_name: r.client_name,
        client_email: r.client_email,
        policy_number: r.policy_number,
        ramo: r.ramo,
        payment_amount: r.payment_amount,
        installment_amount: r.installment_amount,
        days_overdue: r.days_overdue,
        renewal_date: r.renewal_date,
      }));
      const res = await fetch('/api/operaciones/morosidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_email', rows: payload, subject, bodyTemplate }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`${json.sent} correos enviados correctamente${json.failed ? ` (${json.failed} fallidos)` : ''}`);
        setSelected(new Set());
      } else {
        addToast(json.error || 'Error en envío', 'error');
      }
    } catch {
      addToast('Error de conexión', 'error');
    }
    setModalSaving(false);
    setBulkModalOpen(false);
  };

  const handleAction = async (action: string, row: OpsMorosidadRow) => {
    switch (action) {
      case 'view_payments':
        window.open(`/adm-cot/pagos?client=${row.client_id}`, '_blank');
        break;

      case 'send_individual':
        if (!row.client_email) { addToast('Cliente sin correo', 'error'); return; }
        try {
          const res = await fetch('/api/operaciones/morosidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'bulk_email',
              rows: [{
                policy_id: row.policy_id, client_name: row.client_name, client_email: row.client_email,
                policy_number: row.policy_number, ramo: row.ramo, payment_amount: row.payment_amount,
                installment_amount: row.installment_amount, days_overdue: row.days_overdue, renewal_date: row.renewal_date,
              }],
              subject: DEFAULT_SUBJECT,
              bodyTemplate: DEFAULT_BODY,
            }),
          });
          const json = await res.json();
          if (json.sent > 0) addToast(`Aviso enviado a ${row.client_name}`);
          else addToast(json.errors?.[0] || 'Error al enviar', 'error');
        } catch { addToast('Error de conexión', 'error'); }
        break;

      case 'add_note':
        setNoteModal({ open: true, row });
        break;

      case 'follow_up':
        try {
          await fetch('/api/operaciones/morosidad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_follow_up', policy_id: row.policy_id }),
          });
          addToast('Marcado en seguimiento');
        } catch { addToast('Error', 'error'); }
        break;
    }
  };

  const handleAddNote = async (note: string) => {
    if (!noteModal.row) return;
    setModalSaving(true);
    try {
      const res = await fetch('/api/operaciones/morosidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', policy_id: noteModal.row.policy_id, note }),
      });
      const json = await res.json();
      if (json.success) addToast('Nota agregada');
      else addToast(json.error || 'Error', 'error');
    } catch { addToast('Error', 'error'); }
    setModalSaving(false);
    setNoteModal({ open: false, row: null });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  const CARDS: { key: string; label: string; icon: typeof FaMoneyBillWave; bg: string; border: string; color: string; dot: string }[] = [
    { key: 'total', label: 'Total Pólizas', icon: FaMoneyBillWave, bg: 'bg-gray-50', border: 'border-gray-200', color: 'text-gray-500', dot: 'bg-gray-400' },
    { key: 'al_dia', label: 'Al Día', icon: FaCheckCircle, bg: 'bg-white', border: 'border-green-100', color: 'text-green-600', dot: 'bg-green-400' },
    { key: 'pago_recibido', label: 'Pago Recibido', icon: FaClock, bg: 'bg-white', border: 'border-amber-100', color: 'text-amber-600', dot: 'bg-amber-400' },
    { key: 'atrasado', label: 'Atrasadas', icon: FaExclamationCircle, bg: 'bg-white', border: 'border-red-100', color: 'text-red-600', dot: 'bg-red-400' },
    { key: 'cancelado', label: 'Canceladas', icon: FaBan, bg: 'bg-white', border: 'border-gray-100', color: 'text-gray-500', dot: 'bg-gray-400' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Dashboard Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {CARDS.map((c) => {
          const count = (counts as Record<string, number>)[c.key] || 0;
          const isActive = statusFilter === c.key || (c.key === 'total' && !statusFilter);
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => handleCardClick(c.key === 'total' ? '' : c.key)}
              className={`${c.bg} border ${c.border} rounded-xl p-3 sm:p-4 cursor-pointer transition-all duration-150 text-left ${
                isActive ? 'ring-2 ring-[#010139]/20 shadow-sm' : 'hover:shadow-sm hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`text-[10px] ${c.color}`} />
                <p className={`text-[10px] ${c.color} font-medium uppercase tracking-wider`}>{c.label}</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[#010139] tabular-nums">{count}</p>
            </button>
          );
        })}
      </div>

      {/* ── Search + Filters + Actions Bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, póliza..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#010139]/30 focus:ring-1 focus:ring-[#010139]/10 transition-all duration-150 placeholder:text-gray-300"
            />
          </div>
          <button
            onClick={() => setShowFilters((f) => !f)}
            className={`p-2 rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0 ${
              showFilters ? 'bg-[#010139] text-white' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            }`}
          >
            <FaFilter className="text-sm" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all duration-150 cursor-pointer flex-shrink-0"
          >
            <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-50">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-gray-600 focus:border-[#010139]/30 transition-colors duration-150"
            >
              <option value="">Todos los estados</option>
              <option value="al_dia">Al Día</option>
              <option value="atrasado">Atrasado</option>
              <option value="pago_recibido">Pago Recibido</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select
              value={ramoFilter}
              onChange={(e) => setRamoFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-gray-600 focus:border-[#010139]/30 transition-colors duration-150"
            >
              <option value="">Todos los ramos</option>
              {ramos.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={overdue30} onChange={(e) => setOverdue30(e.target.checked)} className="rounded border-gray-300" />
                <span className="text-xs text-gray-600">30+ días</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={recurringOnly} onChange={(e) => { setRecurringOnly(e.target.checked); if (e.target.checked) setContadoOnly(false); }} className="rounded border-gray-300" />
                <span className="text-xs text-gray-600">Recurrente</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={contadoOnly} onChange={(e) => { setContadoOnly(e.target.checked); if (e.target.checked) setRecurringOnly(false); }} className="rounded border-gray-300" />
                <span className="text-xs text-gray-600">Contado</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── 30-day alert ── */}
      {counts.atrasado > 0 && (
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex items-center gap-2.5">
          <FaExclamationTriangle className="text-red-400 text-xs flex-shrink-0" />
          <p className="text-xs text-red-600">
            <span className="font-medium">Alerta:</span> Clientes con 30+ días de atraso generan notificación interna automática cada 7 días.
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
        {loading && rows.length === 0 ? (
          <SkeletonTable />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <FaMoneyBillWave className="text-gray-300 text-lg" />
            </div>
            <p className="text-sm font-medium text-gray-500">Sin registros de morosidad</p>
            <p className="text-xs text-gray-400 mt-1.5">Ajusta los filtros o busca por cliente/póliza</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-3 py-2.5 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === rows.filter((r) => r.morosidad_status !== 'pago_recibido').length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Cliente</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Póliza</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Ramo</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden md:table-cell">Vence</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Estado</th>
                    <th className="px-2 py-2.5 text-right font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Monto</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Días</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Pago Rec.</th>
                    <th className="px-2 py-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = selected.has(row.policy_id);
                    const isPagoRecibido = row.morosidad_status === 'pago_recibido';
                    const sc = STATUS_CONFIG[row.morosidad_status] || STATUS_CONFIG.al_dia;
                    const daySev = daysOverdueSeverity(row.days_overdue);
                    const dayC = daysOverdueColor(daySev);

                    return (
                      <tr key={row.policy_id} className={`border-b border-gray-50 transition-all duration-150 ${
                        isSelected ? 'bg-[#010139]/[0.02]' : 'hover:bg-gray-50/60'
                      } ${daySev === 'critical' ? 'border-l-[3px] border-l-red-400' : ''}`}>
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.policy_id)}
                            disabled={isPagoRecibido}
                            className="rounded border-gray-300 disabled:opacity-20"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="font-semibold text-[#010139] truncate block max-w-[140px] text-[11px]">{row.client_name || '—'}</span>
                          {row.client_email && <span className="text-[9px] text-gray-400 block truncate max-w-[140px]">{row.client_email}</span>}
                        </td>
                        <td className="px-2 py-2.5 font-mono text-gray-500 text-[10px]">{row.policy_number || '—'}</td>
                        <td className="px-2 py-2.5 text-gray-400 hidden sm:table-cell">{row.ramo || '—'}</td>
                        <td className="px-2 py-2.5 text-gray-400 hidden md:table-cell tabular-nums">{fmtDate(row.renewal_date)}</td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          {isPagoRecibido && (
                            <span className="block text-[9px] text-amber-500 mt-0.5">Pendiente de transferir</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono font-semibold text-gray-700 tabular-nums">
                          {fmtCurrency(row.payment_amount || row.installment_amount)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {row.days_overdue > 0 ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${dayC.bg} ${dayC.text}`}>
                              {row.days_overdue}d
                            </span>
                          ) : (
                            <span className="text-green-500 text-[10px] font-medium">0</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row.is_recurring ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-500'
                          }`}>
                            {row.is_recurring ? 'Recurrente' : 'Contado'}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center hidden lg:table-cell">
                          {row.payment_status === 'received' || isPagoRecibido ? (
                            <FaCheckCircle className="text-green-400 text-xs mx-auto" />
                          ) : (
                            <span className="text-gray-200 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <ActionDropdown row={row} onAction={handleAction} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
              <span className="text-[10px] text-gray-400 tabular-nums">
                {total} registros · Página {page} de {totalPages || 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); }}
                  disabled={page <= 1}
                  className="px-2 py-1 text-xs bg-gray-50 rounded-md disabled:opacity-30 cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <FaChevronLeft className="text-[10px] text-gray-500" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page + i - 2;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors duration-150 ${
                        p === page ? 'bg-[#010139] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); }}
                  disabled={page >= totalPages}
                  className="px-2 py-1 text-xs bg-gray-50 rounded-md disabled:opacity-30 cursor-pointer hover:bg-gray-100 transition-colors duration-150"
                >
                  <FaChevronRight className="text-[10px] text-gray-500" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Floating bulk action ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200">
          <button
            onClick={() => setBulkModalOpen(true)}
            className="bg-[#010139] text-white px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer hover:bg-[#020270] transition-all duration-150 shadow-lg shadow-[#010139]/20"
          >
            <FaEnvelope className="text-white text-xs" />
            Enviar aviso a {selected.size} {selected.size === 1 ? 'cliente' : 'clientes'}
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      <BulkEmailModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        selectedRows={selectedRows}
        onConfirm={handleBulkEmail}
        sending={modalSaving}
      />

      {noteModal.row && (
        <NoteModal
          open={noteModal.open}
          onClose={() => setNoteModal({ open: false, row: null })}
          policyNumber={noteModal.row.policy_number}
          clientName={noteModal.row.client_name}
          onConfirm={handleAddNote}
          saving={modalSaving}
        />
      )}

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
