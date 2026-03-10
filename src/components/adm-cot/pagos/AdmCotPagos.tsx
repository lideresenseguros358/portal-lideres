'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSearch,
  FaMoneyBillWave,
  FaLayerGroup,
  FaHistory,
  FaUndoAlt,
  FaSync as FaRecurrence,
  FaCheckCircle,
  FaCheck,
  FaClock,
  FaPlus,
  FaEdit,
  FaBan,
  FaTimes,
  FaSync,
  FaChevronDown,
  FaChevronUp,
  FaFilter,
  FaHourglassHalf,
  FaLock,
  FaUnlock,
  FaTag,
  FaDownload,
  FaExclamationTriangle,
  FaFileExport,
  FaHandHoldingUsd,
} from 'react-icons/fa';

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

const api = async (params: Record<string, string>) => {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`/api/adm-cot/payments?${q}`);
  return r.json();
};
const apiPost = async (action: string, data: Record<string, any>) => {
  const r = await fetch('/api/adm-cot/payments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  return r.json();
};
const fmtMoney = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-PA') : '—';

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; text: string }> = {
    PENDIENTE_CONFIRMACION: { bg: 'bg-orange-100', text: 'text-orange-800' },
    PENDIENTE: { bg: 'bg-amber-100', text: 'text-amber-800' },
    AGRUPADO: { bg: 'bg-blue-100', text: 'text-blue-800' },
    PAGADO: { bg: 'bg-green-100', text: 'text-green-800' },
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600' },
    CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800' },
    POSTED: { bg: 'bg-green-100', text: 'text-green-800' },
    OPEN: { bg: 'bg-green-100', text: 'text-green-800' },
    PARTIAL: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    EXHAUSTED: { bg: 'bg-gray-200', text: 'text-gray-600' },
    BLOCKED: { bg: 'bg-red-100', text: 'text-red-800' },
    CLOSED: { bg: 'bg-gray-200', text: 'text-gray-600' },
    ACTIVA: { bg: 'bg-green-100', text: 'text-green-800' },
    CANCELADA: { bg: 'bg-red-100', text: 'text-red-800' },
    COMPLETADA: { bg: 'bg-blue-100', text: 'text-blue-800' },
  };
  const s = m[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>{status}</span>;
}

// ════════════════════════════════════════════
// XLSX PER INSURER EXPORT
// ════════════════════════════════════════════

async function exportXlsxPerInsurer(groupItems: any[]) {
  const XLSX = await import('xlsx');
  const byInsurer: Record<string, any[]> = {};
  groupItems.forEach((item: any) => {
    const ins = item.insurer || 'UNKNOWN';
    if (!byInsurer[ins]) byInsurer[ins] = [];
    byInsurer[ins].push(item);
  });

  const today = new Date().toISOString().slice(0, 10);
  for (const [insurer, items] of Object.entries(byInsurer)) {
    const wb = XLSX.utils.book_new();
    const rows = items.map((it: any) => ({
      Asegurado: it.client_name || '',
      Poliza: it.nro_poliza || '',
      'Monto Aplicado': Number(it.amount_applied || 0),
      Fecha: today,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pagos');
    XLSX.writeFile(wb, `${today}_${insurer}.xlsx`);
  }
}

// ════════════════════════════════════════════
// 1. PAGOS PENDIENTES TAB
// ════════════════════════════════════════════

function PendientesTab({ onRefresh }: { onRefresh: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [insurer, setInsurer] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedConfirm, setSelectedConfirm] = useState<Set<string>>(new Set());
  const [confirmingIds, setConfirmingIds] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);
  const [refundForm, setRefundForm] = useState({ bank: '', account: '', accountType: 'Ahorro', reason: '' });
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { tab: 'pending' };
    if (search) params.search = search;
    if (insurer) params.insurer = insurer;
    if (status) params.status = status;
    if (type) params.type = type;
    const res = await api(params);
    if (res.success) { setPayments(res.data.rows); setSummary(res.data.summary); }
    setLoading(false);
  }, [search, insurer, status, type]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    const pending = payments.filter(p => p.status === 'PENDIENTE');
    setSelected(prev => prev.size === pending.length ? new Set() : new Set(pending.map(p => p.id)));
  };
  const toggleSelectConfirm = (id: string) => {
    setSelectedConfirm(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllConfirm = () => {
    const unconfirmed = payments.filter(p => p.status === 'PENDIENTE_CONFIRMACION');
    setSelectedConfirm(prev => prev.size === unconfirmed.length ? new Set() : new Set(unconfirmed.map(p => p.id)));
  };

  const handleConfirmRecurring = async () => {
    if (selectedConfirm.size === 0) return;
    setConfirmingIds(true);
    const res = await apiPost('confirm_recurring_payment', { payment_ids: Array.from(selectedConfirm) });
    if (res.success) { setSelectedConfirm(new Set()); fetchPayments(); }
    setConfirmingIds(false);
  };

  const handleMarkRefund = async () => {
    if (!showRefundModal) return;
    await apiPost('mark_refund', {
      payment_id: showRefundModal,
      refund_bank: refundForm.bank,
      refund_account: refundForm.account,
      refund_account_type: refundForm.accountType,
      refund_reason: refundForm.reason,
    });
    setShowRefundModal(null);
    setRefundForm({ bank: '', account: '', accountType: 'Ahorro', reason: '' });
    fetchPayments();
  };

  // Split payments into unconfirmed recurring vs rest (groupable)
  const unconfirmedPayments = payments.filter(p => p.status === 'PENDIENTE_CONFIRMACION');
  const groupablePayments = payments.filter(p => p.status !== 'PENDIENTE_CONFIRMACION');

  const selectedPayments = payments.filter(p => selected.has(p.id));
  const selectedTotal = selectedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const hasActiveFilters = search || insurer || status || type;

  const slaBadge = (p: any) => {
    if (!p.sla_status || p.sla_status === 'none' || p.sla_status === 'unknown') return null;
    const cfg: Record<string, { bg: string; text: string; label: string }> = {
      overdue: { bg: 'bg-red-100', text: 'text-red-700', label: `Vencido (${Math.abs(p.days_until_due)}d)` },
      urgent: { bg: 'bg-red-50', text: 'text-red-600', label: `Urgente (${p.days_until_due}d)` },
      warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: `${p.days_until_due}d` },
      on_track: { bg: 'bg-green-50', text: 'text-green-700', label: `${p.days_until_due}d` },
    };
    const fallback = { bg: 'bg-green-50', text: 'text-green-700', label: `${p.days_until_due ?? '?'}d` };
    const c = cfg[p.sla_status] ?? fallback;
    return <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${c.bg} ${c.text}`}><FaClock className="text-[8px]" />{c.label}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: 'Por Confirmar', count: summary.pendingConfirm || 0, amt: summary.pendingConfirmAmt || 0, bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-600' },
          { label: 'Pendientes', count: summary.pending || 0, amt: summary.pendingAmt || 0, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-600' },
          { label: 'Agrupados', count: summary.grouped || 0, amt: summary.groupedAmt || 0, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Pagados', count: summary.paid || 0, amt: summary.paidAmt || 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'Devoluciones', count: summary.refunds || 0, amt: summary.refundsAmt || 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 sm:p-3`}>
            <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
            <p className="text-lg sm:text-xl font-bold text-[#010139]">{c.count}</p>
            <p className="text-[11px] sm:text-xs text-gray-500">{fmtMoney(c.amt)}</p>
          </div>
        ))}
      </div>

      {/* SLA Alert Banner */}
      {((summary.overdueCount || 0) > 0 || (summary.urgentCount || 0) > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-800">
              {(summary.overdueCount || 0) > 0 && <span>{summary.overdueCount} pago(s) vencido(s)</span>}
              {(summary.overdueCount || 0) > 0 && (summary.urgentCount || 0) > 0 && <span> · </span>}
              {(summary.urgentCount || 0) > 0 && <span>{summary.urgentCount} pago(s) urgente(s) (≤3 días)</span>}
            </p>
            <p className="text-[10px] text-red-600 mt-0.5">Estos pagos requieren atención inmediata para evitar mora.</p>
          </div>
        </div>
      )}

      {/* Search + Filter toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 border-2 border-gray-200 rounded-lg focus-within:border-[#8AAA19] focus-within:ring-2 focus-within:ring-[#8AAA19]/20 bg-white px-3 py-2">
            <div className="flex-shrink-0 text-gray-400">
              <FaSearch size={14} />
            </div>
            <input type="text" placeholder="Buscar cliente, póliza..." value={search}
              onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPayments()}
              className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm bg-transparent p-0" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${showFilters ? 'bg-[#010139] text-white' : 'text-gray-500 hover:bg-gray-100'}`} title="Filtros">
            <FaFilter className="text-sm" />
          </button>
          <button onClick={fetchPayments} disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Refrescar">
            <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowManualWizard(true)}
            className="p-2 rounded-lg text-[#8AAA19] hover:bg-[#8AAA19]/10 transition-colors cursor-pointer flex-shrink-0" title="Wizard Manual">
            <FaHandHoldingUsd className="text-sm" />
          </button>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setInsurer(''); setStatus(''); setType(''); }} className="p-2 text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0" title="Limpiar">
              <FaTimes className="text-sm" />
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <select value={insurer} onChange={e => setInsurer(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Aseguradora</option><option value="INTERNACIONAL">Internacional</option><option value="FEDPA">FEDPA</option><option value="REGIONAL">Regional</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Estado</option><option value="PENDIENTE_CONFIRMACION">Por Confirmar</option><option value="PENDIENTE">Pendiente</option><option value="AGRUPADO">Agrupado</option><option value="PAGADO">Pagado</option>
            </select>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Tipo</option><option value="PAY">Pago Aseg.</option><option value="REFUND">Devolución</option>
            </select>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* POR CONFIRMAR — Recurring payments awaiting receipt confirmation */}
      {/* ════════════════════════════════════════════ */}
      {unconfirmedPayments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FaHourglassHalf className="text-orange-500 text-sm" />
              <h4 className="text-xs font-bold text-orange-700 uppercase tracking-wide">Por Confirmar Recibo ({unconfirmedPayments.length})</h4>
            </div>
            <div className="flex items-center gap-2">
              {selectedConfirm.size > 0 && (
                <button onClick={handleConfirmRecurring} disabled={confirmingIds}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <FaCheck className="text-white text-[10px]" /> <span className="text-white">{confirmingIds ? 'Confirmando...' : `Confirmar (${selectedConfirm.size})`}</span>
                </button>
              )}
              <button onClick={selectAllConfirm}
                className="px-2 py-1 text-[10px] text-orange-600 hover:bg-orange-50 rounded cursor-pointer font-medium">
                {selectedConfirm.size === unconfirmedPayments.length ? 'Deseleccionar' : 'Seleccionar todos'}
              </button>
            </div>
          </div>

          <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2 space-y-1.5">
            {unconfirmedPayments.map(p => (
              <div key={p.id} className="bg-white rounded-lg border border-orange-100 p-2.5 flex items-center gap-2.5">
                <input type="checkbox" checked={selectedConfirm.has(p.id)} onChange={() => toggleSelectConfirm(p.id)} className="cursor-pointer flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#010139] truncate">{p.client_name}</p>
                    <p className="text-xs font-bold text-[#8AAA19] flex-shrink-0">{fmtMoney(p.amount)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                    <span>{p.insurer}</span>
                    <span>·</span>
                    <span>{p.nro_poliza || '—'}</span>
                    <span>·</span>
                    <span>Cuota {p.installment_num || '—'}</span>
                    <span>·</span>
                    <span>{fmtDate(p.payment_date)}</span>
                  </div>
                </div>
                <button onClick={async () => {
                  await apiPost('confirm_recurring_payment', { payment_ids: [p.id] });
                  fetchPayments();
                }} className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded cursor-pointer flex-shrink-0" title="Confirmar recibo">
                  <FaCheck className="text-xs" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-orange-500 italic">Estos pagos recurrentes requieren confirmación de recibo antes de ser agrupados.</p>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* PAGOS LISTOS — Confirmed payments ready for grouping */}
      {/* ════════════════════════════════════════════ */}

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-xs text-blue-800 font-medium">{selected.size} seleccionados — Total: {fmtMoney(selectedTotal)}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 bg-[#8AAA19] text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer hover:bg-[#7a9916] transition-colors">
              <FaDownload className="text-white text-[10px]" /> <span className="text-white">Descargar</span>
            </button>
            <button onClick={() => setShowGroupModal(true)}
              className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer">
              <FaLayerGroup className="text-white" /> <span className="text-white">Agrupar y Pagar</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile Card List ── */}
      <div className="md:hidden space-y-2">
        {groupablePayments.length === 0 && unconfirmedPayments.length === 0 ? (
          <div className="py-12 text-center">
            <FaMoneyBillWave className="text-3xl text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No hay pagos registrados</p>
            <p className="text-xs text-gray-400 mt-1">Se crean automáticamente al confirmar emisión</p>
          </div>
        ) : groupablePayments.length === 0 ? (
          <div className="py-8 text-center">
            <FaCheckCircle className="text-2xl text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No hay pagos listos para agrupar</p>
          </div>
        ) : groupablePayments.map(p => (
          <div key={p.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-3 ${p.is_refund ? 'border-l-4 border-l-red-300' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {p.status === 'PENDIENTE' && (
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="cursor-pointer flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#010139] truncate">{p.client_name}</p>
                  <p className="text-[11px] text-gray-500">{p.insurer} · {p.nro_poliza || '—'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-sm font-bold text-[#8AAA19]">{fmtMoney(p.amount)}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span>{fmtDate(p.payment_date)}</span>
                {p.is_refund
                  ? <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">DEV</span>
                  : <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">ASEG</span>}
                {p.installment_num && <span>Cuota {p.installment_num}</span>}
                {slaBadge(p)}
              </div>
              {p.status === 'PENDIENTE' && !p.is_refund && (
                <button onClick={() => setShowRefundModal(p.id)} className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer" title="Marcar devolución"><FaUndoAlt /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 w-8"><input type="checkbox" onChange={selectAll} checked={selected.size > 0 && selected.size === groupablePayments.filter(p => p.status === 'PENDIENTE').length} className="cursor-pointer" /></th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Póliza</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Monto</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Aseg.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cuota</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">SLA</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody>
              {groupablePayments.length === 0 && unconfirmedPayments.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <FaMoneyBillWave className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No hay pagos registrados</p>
                  <p className="text-xs text-gray-400 mt-1">Se crean automáticamente al confirmar emisión</p>
                </td></tr>
              ) : groupablePayments.length === 0 ? (
                <tr><td colSpan={11} className="py-8 text-center text-gray-400 text-xs">No hay pagos listos para agrupar</td></tr>
              ) : groupablePayments.map(p => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${p.is_refund ? 'bg-red-50/30' : ''}`}>
                  <td className="py-2 px-2">
                    {p.status === 'PENDIENTE' && <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="cursor-pointer" />}
                  </td>
                  <td className="py-2 px-2 text-[11px] font-medium text-[#010139]">{p.client_name}</td>
                  <td className="py-2 px-2 text-[11px] font-mono text-gray-600">{p.nro_poliza || '—'}</td>
                  <td className="py-2 px-2 text-[11px] font-bold text-[#8AAA19]">{fmtMoney(p.amount)}</td>
                  <td className="py-2 px-2 text-[11px] text-gray-600">{p.insurer}</td>
                  <td className="py-2 px-2 text-[11px] text-gray-500">{fmtDate(p.payment_date)}</td>
                  <td className="py-2 px-2">
                    {p.is_refund
                      ? <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">DEV</span>
                      : <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">ASEG</span>}
                  </td>
                  <td className="py-2 px-2"><StatusBadge status={p.status} /></td>
                  <td className="py-2 px-2 text-[11px] text-gray-500">{p.installment_num || '—'}</td>
                  <td className="py-2 px-2">{slaBadge(p)}</td>
                  <td className="py-2 px-2">
                    {p.status === 'PENDIENTE' && !p.is_refund && (
                      <button onClick={() => setShowRefundModal(p.id)} className="p-1 text-red-400 hover:text-red-600 cursor-pointer" title="Marcar devolución"><FaUndoAlt /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#010139]">Marcar como Devolución</h3>
              <button onClick={() => setShowRefundModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Banco *</label>
                <input type="text" value={refundForm.bank} onChange={e => setRefundForm(p => ({ ...p, bank: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Banco Nacional" /></div>
              <div><label className="text-xs text-gray-500">Número de Cuenta *</label>
                <input type="text" value={refundForm.account} onChange={e => setRefundForm(p => ({ ...p, account: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="0401234567890" /></div>
              <div><label className="text-xs text-gray-500">Tipo de Cuenta *</label>
                <select value={refundForm.accountType} onChange={e => setRefundForm(p => ({ ...p, accountType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                  <option>Ahorro</option><option>Corriente</option></select></div>
              <div><label className="text-xs text-gray-500">Motivo</label>
                <input type="text" value={refundForm.reason} onChange={e => setRefundForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Cancelación de póliza" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRefundModal(null)} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
              <button onClick={handleMarkRefund} disabled={!refundForm.bank || !refundForm.account}
                className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                <span className="text-white">Confirmar Devolución</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && <GroupModal selectedPayments={selectedPayments} onClose={() => { setShowGroupModal(false); setSelected(new Set()); fetchPayments(); onRefresh(); }} />}

      {/* Export Modal */}
      {showExportModal && <ExportModal payments={selectedPayments} onClose={() => setShowExportModal(false)} />}

      {/* Manual Wizard Modal */}
      {showManualWizard && <ManualWizardModal onClose={() => { setShowManualWizard(false); fetchPayments(); onRefresh(); }} />}
    </div>
  );
}

// ════════════════════════════════════════════
// EXPORT MODAL (Excel / PDF)
// ════════════════════════════════════════════

function ExportModal({ payments, onClose }: { payments: any[]; onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const insurerLabel = payments.length > 0 ? (payments.every((p: any) => p.insurer === payments[0].insurer) ? payments[0].insurer : 'VARIAS') : '';

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = payments.map((p: any) => ({
        Cliente: p.client_name || '',
        'Cédula': p.cedula || '',
        'Póliza': p.nro_poliza || '',
        Aseguradora: p.insurer || '',
        Ramo: p.ramo || '',
        Cuota: p.installment_num || 1,
        Monto: Number(p.amount || 0),
        'Fecha Registro': p.payment_date || '',
        Estado: p.status || '',
      }));
      rows.push({ Cliente: '', 'Cédula': '', 'Póliza': '', Aseguradora: '', Ramo: '', Cuota: '' as any, Monto: total, 'Fecha Registro': 'TOTAL', Estado: '' });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 7 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
      XLSX.writeFile(wb, `pagos_${insurerLabel}_${today}.xlsx`);
    } catch (e) { console.error('Export Excel error:', e); }
    setExporting(false);
    onClose();
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

      doc.setFontSize(14);
      doc.setTextColor(1, 1, 57);
      doc.text('Líderes en Seguros — Pagos Seleccionados', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Fecha: ${today}  |  ${payments.length} pagos  |  Total: $${total.toFixed(2)}${insurerLabel !== 'VARIAS' ? `  |  Aseguradora: ${insurerLabel}` : ''}`, 14, 22);

      autoTable(doc, {
        startY: 28,
        head: [['Cliente', 'Cédula', 'Póliza', 'Aseg.', 'Ramo', 'Cuota', 'Monto', 'Fecha', 'Estado']],
        body: [
          ...payments.map((p: any) => [
            p.client_name || '', p.cedula || '', p.nro_poliza || '', p.insurer || '',
            p.ramo || '', p.installment_num || 1, `$${Number(p.amount || 0).toFixed(2)}`,
            p.payment_date || '', p.status || '',
          ]),
          ['', '', '', '', '', 'TOTAL', `$${total.toFixed(2)}`, '', ''],
        ],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [1, 1, 57], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [245, 245, 245], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      doc.save(`pagos_${insurerLabel}_${today}.pdf`);
    } catch (e) { console.error('Export PDF error:', e); }
    setExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#010139]">Descargar Pagos ({payments.length})</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        </div>
        <p className="text-xs text-gray-500">Total seleccionado: <span className="font-bold text-[#8AAA19]">{fmtMoney(total)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExportExcel} disabled={exporting}
            className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8AAA19] hover:bg-green-50/50 transition-all cursor-pointer disabled:opacity-50">
            <FaFileExport className="text-2xl text-green-600" />
            <span className="text-xs font-bold text-[#010139]">Excel</span>
            <span className="text-[10px] text-gray-400">.xlsx</span>
          </button>
          <button onClick={handleExportPdf} disabled={exporting}
            className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/50 transition-all cursor-pointer disabled:opacity-50">
            <FaDownload className="text-2xl text-red-500" />
            <span className="text-xs font-bold text-[#010139]">PDF</span>
            <span className="text-[10px] text-gray-400">.pdf</span>
          </button>
        </div>
        {exporting && <p className="text-[10px] text-center text-gray-400">Generando archivo...</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// GROUP + PAY MODAL (Multi-reference)
// ════════════════════════════════════════════

function GroupModal({ selectedPayments, onClose }: { selectedPayments: any[]; onClose: () => void }) {
  const [step, setStep] = useState<'references' | 'confirm' | 'done'>('references');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);

  const totalPayments = selectedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRefs = Object.values(selectedRefs).reduce((s, v) => s + v, 0);

  useEffect(() => {
    api({ tab: 'transfers', status: 'OPEN' }).then(res => {
      if (res.success) setTransfers(res.data.transfers);
    });
  }, []);

  const handleConfirm = async () => {
    if (totalRefs < totalPayments) { setError(`Referencias ($${totalRefs.toFixed(2)}) < Pagos ($${totalPayments.toFixed(2)})`); return; }
    setLoading(true); setError('');
    try {
      // 1. Create group
      const grpRes = await apiPost('create_group', {});
      if (!grpRes.success) throw new Error(grpRes.error);
      const gid = grpRes.data.group_id;
      setGroupId(gid);

      // 2. Confirm with RPC
      const items = selectedPayments.map(p => ({
        pending_payment_id: p.id, insurer: p.insurer, amount_applied: Number(p.amount),
      }));
      const references = Object.entries(selectedRefs)
        .filter(([, v]) => v > 0)
        .map(([id, amount]) => ({ bank_transfer_id: id, amount_used: amount }));

      const confirmRes = await apiPost('confirm_group', { group_id: gid, items, references });
      if (!confirmRes.success && confirmRes.data && !confirmRes.data.success) {
        throw new Error(confirmRes.data?.error || confirmRes.error || 'Error confirming');
      }
      setStep('confirm');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!groupId) return;
    setLoading(true);
    const res = await apiPost('post_group', { group_id: groupId });
    if (res.success) {
      // Export XLSX per insurer
      const items = selectedPayments.map(p => ({ ...p, amount_applied: p.amount }));
      await exportXlsxPerInsurer(items);
      setStep('done');
    } else { setError(res.error || 'Error posting'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#010139]">
            {step === 'references' && 'Asignar Referencias Bancarias'}
            {step === 'confirm' && 'Confirmar Posteo'}
            {step === 'done' && 'Grupo Posteado'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
          <p><strong>{selectedPayments.length}</strong> pagos seleccionados — Total: <strong>{fmtMoney(totalPayments)}</strong></p>
          <p>Aseguradoras: {[...new Set(selectedPayments.map(p => p.insurer))].join(', ')}</p>
        </div>

        {step === 'references' && (
          <>
            <p className="text-xs text-gray-500">Seleccione transferencias bancarias y asigne montos:</p>
            {transfers.length === 0 ? (
              <p className="text-xs text-amber-600">No hay transferencias OPEN. Importe una primero en Historial Banco.</p>
            ) : (
              <div className="space-y-2">
                {transfers.map(t => (
                  <div key={t.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-xs font-mono font-bold text-[#010139]">{t.reference_number}</p>
                      <p className="text-[10px] text-gray-500">{t.bank_name} — {fmtDate(t.transfer_date)} — Disponible: <strong>{fmtMoney(t.remaining_amount)}</strong></p>
                    </div>
                    <input type="number" min={0} max={Number(t.remaining_amount)} step={0.01}
                      value={selectedRefs[t.id] || ''} placeholder="0.00"
                      onChange={e => {
                        const v = Math.min(Number(e.target.value), Number(t.remaining_amount));
                        setSelectedRefs(p => ({ ...p, [t.id]: v }));
                      }}
                      className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-right" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>Total referencias: <strong className={totalRefs >= totalPayments ? 'text-green-600' : 'text-red-600'}>{fmtMoney(totalRefs)}</strong> / {fmtMoney(totalPayments)}</span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={handleConfirm} disabled={loading || totalRefs < totalPayments}
                className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">{loading ? 'Procesando...' : 'Confirmar Agrupación'}</span></button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
              <FaCheckCircle className="inline mr-1" /> Agrupación confirmada. Pagos marcados como AGRUPADO. ¿Desea postear (marcar como PAGADO)?
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cerrar sin postear</button>
              <button onClick={handlePost} disabled={loading}
                className="px-4 py-2 bg-green-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">{loading ? 'Posteando...' : 'Postear y Descargar XLSX'}</span></button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <FaCheckCircle className="text-green-600 text-3xl mx-auto mb-2" />
              <p className="text-sm font-bold text-green-800">Grupo posteado exitosamente</p>
              <p className="text-xs text-green-600 mt-1">Los XLSX por aseguradora se han descargado.</p>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg cursor-pointer">
                <span className="text-white">Cerrar</span></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 2. HISTORIAL BANCO TAB (Enhanced: counters, categorization, blocking, 110% flex)
// ════════════════════════════════════════════

const CATEGORIES = [
  { value: 'paguelofacil', label: 'PagueloFacil', color: 'bg-purple-100 text-purple-800' },
  { value: 'interno', label: 'Mov. Interno', color: 'bg-blue-100 text-blue-800' },
  { value: 'financiamiento', label: 'Financiamiento', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'comision', label: 'Comisión', color: 'bg-green-100 text-green-800' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-100 text-gray-600' },
  { value: 'uncategorized', label: 'Sin categoría', color: 'bg-gray-50 text-gray-400' },
];

function CategoryBadge({ category }: { category: string }) {
  const fallback = { value: 'uncategorized', label: 'Sin categoría', color: 'bg-gray-50 text-gray-400' };
  const c = CATEGORIES.find(ct => ct.value === category) ?? fallback;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${c.color}`}>{c.label}</span>;
}

function FlexBar({ t }: { t: any }) {
  const total = Number(t.transfer_amount || 0);
  const used = Number(t.used_amount || 0);
  const maxAllowed = Number(t.max_allowed || 0);
  if (total <= 0) return null;
  const usedPct = Math.min((used / maxAllowed) * 100, 100);
  const basePct = (total / maxAllowed) * 100;
  const isFinancing = used > total;

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-[9px] text-gray-500 mb-0.5">
        <span>Usado: {fmtMoney(used)} / {fmtMoney(maxAllowed)} (110%)</span>
        {isFinancing && <span className="text-amber-600 font-bold">+{t.flex_pct}% financ.</span>}
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
        <div className="absolute h-full bg-gray-300 rounded-full" style={{ width: `${basePct}%` }} />
        <div className={`absolute h-full rounded-full ${isFinancing ? 'bg-amber-500' : 'bg-[#8AAA19]'}`} style={{ width: `${usedPct}%` }} />
      </div>
    </div>
  );
}

function HistorialBancoTab() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ bank_name: '', reference_number: '', transfer_amount: '', transfer_date: '', notes: '', is_paguelofacil: false });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  // Block modal
  const [blockModal, setBlockModal] = useState<{ id: string; ref: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  // Categorize modal
  const [catModal, setCatModal] = useState<{ id: string; ref: string; current: string } | null>(null);
  const [catForm, setCatForm] = useState({ category: '', is_paguelofacil: false, notes: '' });

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { tab: 'transfers' };
    if (categoryFilter !== 'all') params.category = categoryFilter;
    const res = await api(params);
    if (res.success) {
      setTransfers(res.data.transfers);
      setSummary(res.data.summary || {});
    }
    setLoading(false);
  }, [categoryFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleImport = async () => {
    if (!importForm.bank_name || !importForm.reference_number || !importForm.transfer_amount || !importForm.transfer_date) return;
    const res = await apiPost('import_transfer', importForm);
    if (res.success && importForm.is_paguelofacil) {
      await apiPost('categorize_transfer', { transfer_id: res.data.id, category: 'paguelofacil', is_paguelofacil: true });
    }
    setShowImport(false);
    setImportForm({ bank_name: '', reference_number: '', transfer_amount: '', transfer_date: '', notes: '', is_paguelofacil: false });
    fetch_();
  };

  const handleBlock = async () => {
    if (!blockModal || !blockReason) return;
    await apiPost('block_transfer', { transfer_id: blockModal.id, reason: blockReason });
    setBlockModal(null); setBlockReason('');
    fetch_();
  };

  const handleUnblock = async (id: string) => {
    if (!confirm('¿Desbloquear esta referencia?')) return;
    await apiPost('unblock_transfer', { transfer_id: id });
    fetch_();
  };

  const handleCategorize = async () => {
    if (!catModal || !catForm.category) return;
    await apiPost('categorize_transfer', {
      transfer_id: catModal.id,
      category: catForm.category,
      is_paguelofacil: catForm.is_paguelofacil,
      category_notes: catForm.notes,
    });
    setCatModal(null); setCatForm({ category: '', is_paguelofacil: false, notes: '' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      {/* ── Summary Counters ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 sm:p-3">
          <p className="text-[10px] text-green-600 font-semibold uppercase">Total Recibido</p>
          <p className="text-lg sm:text-xl font-bold text-[#010139]">{fmtMoney(summary.totalReceived || 0)}</p>
          <p className="text-[11px] text-gray-500">{summary.count || 0} referencias</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 sm:p-3">
          <p className="text-[10px] text-blue-600 font-semibold uppercase">Total Aplicado</p>
          <p className="text-lg sm:text-xl font-bold text-[#010139]">{fmtMoney(summary.totalUsed || 0)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3">
          <p className="text-[10px] text-amber-600 font-semibold uppercase">Balance Disp.</p>
          <p className="text-lg sm:text-xl font-bold text-[#010139]">{fmtMoney(summary.balance || 0)}</p>
          {(summary.balance || 0) < 0 && <p className="text-[10px] text-red-600 font-bold flex items-center gap-1"><FaExclamationTriangle /> Inconsistencia</p>}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 sm:p-3">
          <p className="text-[10px] text-red-600 font-semibold uppercase">Bloqueadas</p>
          <p className="text-lg sm:text-xl font-bold text-[#010139]">{summary.blockedCount || 0}</p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <p className="text-[11px] sm:text-xs text-gray-500 min-w-0">Transferencias bancarias para asignar a pagos.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetch_} disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer" title="Refrescar">
            <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowImport(true)}
            className="p-2 rounded-lg bg-[#010139] text-white hover:bg-[#020270] transition-colors cursor-pointer" title="Importar transferencia">
            <FaPlus className="text-sm text-white" />
          </button>
        </div>
      </div>

      {/* ── Mobile Card List ── */}
      <div className="md:hidden space-y-2">
        {transfers.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200">
            <FaHistory className="text-3xl text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Sin transferencias</p>
          </div>
        ) : transfers.map(t => (
          <div key={t.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${t.is_blocked ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
            <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              className="w-full p-3 text-left cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {t.is_blocked && <FaLock className="text-red-500 text-[10px] flex-shrink-0" />}
                    <p className="text-sm font-mono font-bold text-[#010139]">{t.reference_number}</p>
                  </div>
                  <p className="text-[11px] text-gray-500">{t.bank_name} · {fmtDate(t.transfer_date)}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CategoryBadge category={t.category} />
                    {t.is_paguelofacil && <span className="text-[8px] bg-purple-200 text-purple-800 px-1 rounded font-bold">PF</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-sm font-bold text-[#8AAA19]">{fmtMoney(t.remaining_amount)}</p>
                  <StatusBadge status={t.is_blocked ? 'BLOCKED' : t.status} />
                </div>
              </div>
              <FlexBar t={t} />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-gray-400">Total: {fmtMoney(t.transfer_amount)} · Máx 110%: {fmtMoney(t.max_allowed)}</p>
                {expanded === t.id ? <FaChevronUp className="text-[10px] text-gray-400" /> : <FaChevronDown className="text-[10px] text-gray-400" />}
              </div>
            </button>
            {expanded === t.id && (
              <div className="px-3 pb-3 text-xs border-t border-gray-100 pt-2 space-y-2">
                {t.blocked_reason && <p className="text-red-600 text-[10px]"><FaLock className="inline mr-1" />Bloqueada: {t.blocked_reason}</p>}
                {t.notes && <p className="text-[10px] text-gray-500">Notas: {t.notes}</p>}
                {/* Payment details */}
                {t.payment_details && t.payment_details.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-gray-600 text-[10px]">Pagos Aplicados ({t.payment_details.length}):</p>
                    {t.payment_details.map((pd: any, i: number) => (
                      <div key={i} className="bg-blue-50 rounded-lg p-2.5 border-l-4 border-[#8AAA19]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[11px] text-gray-900 truncate">{pd.client_name}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{pd.insurer} · {pd.nro_poliza || '—'}{pd.installment_num ? ` · Cuota ${pd.installment_num}` : ''}</p>
                          </div>
                          <span className="font-bold text-[11px] text-[#8AAA19] flex-shrink-0">{fmtMoney(pd.amount_applied)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 italic text-[10px]">Sin pagos aplicados aún</p>}
                {/* Action buttons */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => { setCatModal({ id: t.id, ref: t.reference_number, current: t.category }); setCatForm({ category: t.category, is_paguelofacil: t.is_paguelofacil, notes: '' }); }}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#010139] cursor-pointer"><FaTag /> Categorizar</button>
                  {t.is_blocked ? (
                    <button onClick={() => handleUnblock(t.id)}
                      className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-800 cursor-pointer"><FaUnlock /> Desbloquear</button>
                  ) : (
                    <button onClick={() => setBlockModal({ id: t.id, ref: t.reference_number })}
                      className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 cursor-pointer"><FaLock /> Bloquear</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 w-7"></th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Referencia</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Banco</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Monto Total</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Aplicado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Disponible</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">110% Máx</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Financ.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center">
                  <FaHistory className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Sin transferencias</p>
                </td></tr>
              ) : transfers.map(t => (
                <>
                  <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${t.is_blocked ? 'bg-red-50/30' : ''}`} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        {t.is_blocked && <FaLock className="text-red-400 text-[9px]" />}
                        {expanded === t.id ? <FaChevronUp className="text-[10px]" /> : <FaChevronDown className="text-[10px] text-gray-400" />}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-[11px] font-mono font-bold text-[#010139]">{t.reference_number}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-600">{t.bank_name}</td>
                    <td className="py-2 px-2"><CategoryBadge category={t.category} /></td>
                    <td className="py-2 px-2 text-[11px] font-bold">{fmtMoney(t.transfer_amount)}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-600">{fmtMoney(t.used_amount)}</td>
                    <td className="py-2 px-2 text-[11px] font-bold text-[#8AAA19]">{fmtMoney(t.remaining_amount)}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-500">{fmtMoney(t.max_allowed)}</td>
                    <td className="py-2 px-2 text-[11px]">
                      {t.flex_used > 0 ? <span className="text-amber-600 font-bold">{t.flex_pct}%</span> : <span className="text-gray-400">0%</span>}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-gray-500">{fmtDate(t.transfer_date)}</td>
                    <td className="py-2 px-2"><StatusBadge status={t.is_blocked ? 'BLOCKED' : t.status} /></td>
                    <td className="py-2 px-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => { setCatModal({ id: t.id, ref: t.reference_number, current: t.category }); setCatForm({ category: t.category, is_paguelofacil: t.is_paguelofacil, notes: '' }); }}
                          className="p-1 text-gray-400 hover:text-[#010139] cursor-pointer" title="Categorizar"><FaTag className="text-[10px]" /></button>
                        {t.is_blocked ? (
                          <button onClick={() => handleUnblock(t.id)}
                            className="p-1 text-green-500 hover:text-green-700 cursor-pointer" title="Desbloquear"><FaUnlock className="text-[10px]" /></button>
                        ) : (
                          <button onClick={() => setBlockModal({ id: t.id, ref: t.reference_number })}
                            className="p-1 text-red-400 hover:text-red-600 cursor-pointer" title="Bloquear"><FaLock className="text-[10px]" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === t.id && (
                    <tr key={t.id + '-detail'} className="bg-blue-50/50">
                      <td colSpan={12} className="px-4 py-3">
                        {t.blocked_reason && <p className="text-red-600 text-[10px] mb-2"><FaLock className="inline mr-1" />Bloqueada: {t.blocked_reason}</p>}
                        {t.notes && <p className="text-[10px] text-gray-500 mb-2">Notas: {t.notes}</p>}
                        {t.payment_details && t.payment_details.length > 0 ? (
                          <div className="space-y-1.5">
                            <h4 className="font-semibold text-xs text-[#010139] mb-2">Pagos Aplicados ({t.payment_details.length}):</h4>
                            {t.payment_details.map((pd: any, i: number) => (
                              <div key={i} className="bg-white rounded-lg p-2.5 border-l-4 border-[#8AAA19] flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="font-medium text-xs text-gray-900">{pd.client_name}</span>
                                    {pd.nro_poliza && <span className="text-[11px] text-gray-600 font-mono">{pd.nro_poliza}</span>}
                                    <span className="text-[11px] text-gray-500">{pd.insurer}</span>
                                    {pd.installment_num && <span className="text-[10px] text-gray-400">Cuota {pd.installment_num}</span>}
                                  </div>
                                </div>
                                <span className="font-bold text-xs text-[#8AAA19] flex-shrink-0 ml-3">{fmtMoney(pd.amount_applied)}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-gray-400 italic text-xs">Sin pagos aplicados aún</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#010139]">Importar Transferencia Bancaria</h3>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Banco *</label>
                <input type="text" value={importForm.bank_name} onChange={e => setImportForm(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Banco General" /></div>
              <div><label className="text-xs text-gray-500">Número de Referencia *</label>
                <input type="text" value={importForm.reference_number} onChange={e => setImportForm(p => ({ ...p, reference_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="REF-2026-001" /></div>
              <div><label className="text-xs text-gray-500">Monto *</label>
                <input type="number" step="0.01" value={importForm.transfer_amount} onChange={e => setImportForm(p => ({ ...p, transfer_amount: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="5000.00" /></div>
              <div><label className="text-xs text-gray-500">Fecha *</label>
                <input type="date" value={importForm.transfer_date} onChange={e => setImportForm(p => ({ ...p, transfer_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div>
              <div><label className="text-xs text-gray-500">Notas</label>
                <input type="text" value={importForm.notes} onChange={e => setImportForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={importForm.is_paguelofacil} onChange={e => setImportForm(p => ({ ...p, is_paguelofacil: e.target.checked }))} />
                <span className="text-xs text-gray-600">Origen PagueloFacil</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={handleImport} disabled={!importForm.bank_name || !importForm.reference_number || !importForm.transfer_amount || !importForm.transfer_date}
                className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Importar</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-600">Bloquear Referencia</h3>
              <button onClick={() => setBlockModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <p className="text-xs text-gray-600">Referencia: <strong>{blockModal.ref}</strong></p>
            <p className="text-xs text-gray-500">Al bloquear, esta referencia no podrá usarse para cubrir pagos.</p>
            <div><label className="text-xs text-gray-500">Motivo *</label>
              <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Ej: Transferencia no identificada" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBlockModal(null)} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={handleBlock} disabled={!blockReason}
                className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Bloquear</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Categorize Modal */}
      {catModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#010139]">Categorizar Referencia</h3>
              <button onClick={() => setCatModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <p className="text-xs text-gray-600">Referencia: <strong>{catModal.ref}</strong></p>
            <div><label className="text-xs text-gray-500">Categoría *</label>
              <select value={catForm.category} onChange={e => setCatForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="">Seleccione...</option>
                {CATEGORIES.filter(c => c.value !== 'uncategorized').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={catForm.is_paguelofacil} onChange={e => setCatForm(p => ({ ...p, is_paguelofacil: e.target.checked }))} />
              <span className="text-xs text-gray-600">Origen PagueloFacil</span>
            </label>
            <div><label className="text-xs text-gray-500">Notas</label>
              <input type="text" value={catForm.notes} onChange={e => setCatForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Detalle opcional" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCatModal(null)} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={handleCategorize} disabled={!catForm.category}
                className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Guardar</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// 3. RECURRENCIA TAB
// ════════════════════════════════════════════

function RecurrenciaTab() {
  const [recurrences, setRecurrences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<{ id: string; currentDate: string } | null>(null);
  const [newDate, setNewDate] = useState('');
  const [applyTo, setApplyTo] = useState<'only_this' | 'all_future'>('only_this');
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await api({ tab: 'recurrences' });
    if (res.success) setRecurrences(res.data.recurrences);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleEdit = async () => {
    if (!editModal || !newDate) return;
    await apiPost('update_recurrence', { recurrence_id: editModal.id, new_date: newDate, apply_to: applyTo });
    setEditModal(null); setNewDate('');
    fetch_();
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    await apiPost('cancel_recurrence', { recurrence_id: cancelModal, reason: cancelReason });
    setCancelModal(null); setCancelReason('');
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] sm:text-xs text-gray-500">Se crean al emitir con cuotas. Frecuencia según plan.</p>
        <button onClick={fetch_} disabled={loading}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Refrescar">
          <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Mobile Card List ── */}
      <div className="md:hidden space-y-2">
        {recurrences.length === 0 ? (
          <div className="py-12 text-center">
            <FaRecurrence className="text-3xl text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No hay recurrencias</p>
            <p className="text-xs text-gray-400 mt-1">Se crean al emitir con cuotas</p>
          </div>
        ) : recurrences.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#010139] truncate">{r.client_name}</p>
                <p className="text-[11px] text-gray-500">{r.insurer} · {r.nro_poliza || '—'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="text-sm font-bold text-[#8AAA19]">{fmtMoney(r.installment_amount)}</p>
                <StatusBadge status={r.status} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>{(Array.isArray(r.schedule) ? r.schedule.filter((s: any) => s.status === 'PENDIENTE').length : r.total_installments)} de {r.total_installments} cuotas restantes · {r.frequency}</span>
                <span>Próx: {fmtDate(r.next_due_date)}</span>
              </div>
              {r.status === 'ACTIVA' && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditModal({ id: r.id, currentDate: r.next_due_date || '' }); setNewDate(r.next_due_date || ''); }}
                    className="p-1.5 text-gray-400 hover:text-[#010139] cursor-pointer" title="Editar fecha"><FaEdit /></button>
                  <button onClick={() => setCancelModal(r.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer" title="Cancelar"><FaBan /></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Póliza</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Aseg.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cuotas</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Frec.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Monto</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Próxima</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recurrences.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <FaRecurrence className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No hay recurrencias</p>
                  <p className="text-xs text-gray-400 mt-1">Se crean al emitir con cuotas</p>
                </td></tr>
              ) : recurrences.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2 text-[11px] font-medium text-[#010139]">{r.client_name}</td>
                  <td className="py-2 px-2 text-[11px] font-mono text-gray-600">{r.nro_poliza || '—'}</td>
                  <td className="py-2 px-2 text-[11px]">{r.insurer}</td>
                  <td className="py-2 px-2 text-[11px]">{(Array.isArray(r.schedule) ? r.schedule.filter((s: any) => s.status === 'PENDIENTE').length : r.total_installments)}/{r.total_installments}</td>
                  <td className="py-2 px-2 text-[11px]">{r.frequency}</td>
                  <td className="py-2 px-2 text-[11px] font-bold text-[#8AAA19]">{fmtMoney(r.installment_amount)}</td>
                  <td className="py-2 px-2 text-[11px] text-gray-500">{fmtDate(r.next_due_date)}</td>
                  <td className="py-2 px-2"><StatusBadge status={r.status} /></td>
                  <td className="py-2 px-2">
                    {r.status === 'ACTIVA' && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditModal({ id: r.id, currentDate: r.next_due_date || '' }); setNewDate(r.next_due_date || ''); }}
                          className="p-1 text-gray-400 hover:text-[#010139] cursor-pointer" title="Editar fecha"><FaEdit /></button>
                        <button onClick={() => setCancelModal(r.id)}
                          className="p-1 text-gray-400 hover:text-red-600 cursor-pointer" title="Cancelar"><FaBan /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#010139]">Editar Próxima Fecha</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <div><label className="text-xs text-gray-500">Nueva fecha</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="apply" checked={applyTo === 'only_this'} onChange={() => setApplyTo('only_this')} /> Solo esta fecha
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="radio" name="apply" checked={applyTo === 'all_future'} onChange={() => setApplyTo('all_future')} /> Todas las futuras
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={handleEdit} disabled={!newDate}
                className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Guardar</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-600">Cancelar Recurrencia</h3>
              <button onClick={() => setCancelModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
            </div>
            <p className="text-xs text-gray-600">Esta acción desactivará todas las cuotas futuras. Las ya pagadas NO se modifican.</p>
            <div><label className="text-xs text-gray-500">Motivo *</label>
              <input type="text" value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" placeholder="Póliza cancelada" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Volver</button>
              <button onClick={handleCancel} disabled={!cancelReason}
                className="px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Cancelar Recurrencia</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// 4. MANUAL WIZARD — Apply references directly to payments
// ════════════════════════════════════════════

function ManualWizardModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'select_payments' | 'assign_refs' | 'done'>('select_payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [refAllocations, setRefAllocations] = useState<Record<string, number>>({});
  const [searchPay, setSearchPay] = useState('');

  useEffect(() => {
    api({ tab: 'pending', status: 'PENDIENTE' }).then(res => {
      if (res.success) setPayments(res.data.rows.filter((p: any) => !p.is_refund));
    });
    api({ tab: 'transfers', status: 'OPEN' }).then(res => {
      if (res.success) {
        const unblocked = (res.data.transfers || []).filter((t: any) => !t.is_blocked && Number(t.remaining_amount) > 0);
        setTransfers(unblocked);
      }
    });
  }, []);

  const togglePayment = (id: string) => {
    setSelectedPayments(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const chosenPayments = payments.filter(p => selectedPayments.has(p.id));
  const totalPayments = chosenPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRefs = Object.values(refAllocations).reduce((s, v) => s + v, 0);

  const filteredPayments = searchPay
    ? payments.filter(p => `${p.client_name} ${p.nro_poliza} ${p.insurer}`.toLowerCase().includes(searchPay.toLowerCase()))
    : payments;

  const handleApply = async () => {
    if (selectedPayments.size === 0) { setError('Seleccione al menos un pago'); return; }
    const allocations = Object.entries(refAllocations).filter(([, v]) => v > 0).map(([id, amount]) => ({ transfer_id: id, amount }));
    if (allocations.length === 0) { setError('Asigne al menos una referencia'); return; }
    if (totalRefs < totalPayments) { setError(`Total refs ($${totalRefs.toFixed(2)}) < Total pagos ($${totalPayments.toFixed(2)})`); return; }

    setLoading(true); setError('');
    try {
      const res = await apiPost('apply_references_to_payments', {
        payment_ids: Array.from(selectedPayments),
        reference_allocations: allocations,
      });
      if (!res.success) throw new Error(res.error || 'Error al aplicar');
      setStep('done');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#010139] flex items-center gap-2">
            <FaHandHoldingUsd className="text-[#8AAA19]" />
            {step === 'select_payments' && 'Wizard Manual — Seleccionar Pagos'}
            {step === 'assign_refs' && 'Wizard Manual — Asignar Referencias'}
            {step === 'done' && 'Wizard Manual — Completado'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        </div>

        {step === 'select_payments' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
              <strong>Modo manual:</strong> Asigne referencias bancarias directamente a pagos seleccionados. No se deduce comisión del corredor. No se divide monto.
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <FaSearch className="text-gray-400 text-xs" />
              <input type="text" value={searchPay} onChange={e => setSearchPay(e.target.value)}
                className="flex-1 border-0 focus:outline-none text-xs bg-transparent p-0" placeholder="Buscar pagos..." />
            </div>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {filteredPayments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay pagos pendientes disponibles</p>
              ) : filteredPayments.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedPayments.has(p.id) ? 'border-[#8AAA19] bg-[#8AAA19]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedPayments.has(p.id)} onChange={() => togglePayment(p.id)} className="cursor-pointer flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#010139] truncate">{p.client_name}</p>
                      <p className="text-xs font-bold text-[#8AAA19] flex-shrink-0">{fmtMoney(p.amount)}</p>
                    </div>
                    <p className="text-[10px] text-gray-500">{p.insurer} · {p.nro_poliza || '—'} · {fmtDate(p.payment_date)}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedPayments.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
                <strong>{selectedPayments.size}</strong> pagos seleccionados — Total: <strong>{fmtMoney(totalPayments)}</strong>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">Cancelar</button>
              <button onClick={() => { if (selectedPayments.size === 0) { setError('Seleccione al menos un pago'); return; } setError(''); setStep('assign_refs'); }}
                disabled={selectedPayments.size === 0}
                className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">Siguiente →</span></button>
            </div>
          </>
        )}

        {step === 'assign_refs' && (
          <>
            <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
              <p><strong>{chosenPayments.length}</strong> pagos — Total: <strong>{fmtMoney(totalPayments)}</strong></p>
              <p className="text-gray-500">Aseguradoras: {[...new Set(chosenPayments.map(p => p.insurer))].join(', ')}</p>
            </div>
            <p className="text-xs text-gray-500">Asigne montos de las referencias bancarias disponibles:</p>
            {transfers.length === 0 ? (
              <p className="text-xs text-amber-600 py-4 text-center">No hay transferencias disponibles. Importe una primero en Historial Banco.</p>
            ) : (
              <div className="space-y-2 max-h-[35vh] overflow-y-auto">
                {transfers.map(t => (
                  <div key={t.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono font-bold text-[#010139]">{t.reference_number}</p>
                        {t.category && t.category !== 'uncategorized' && <CategoryBadge category={t.category} />}
                      </div>
                      <p className="text-[10px] text-gray-500">{t.bank_name} · {fmtDate(t.transfer_date)} · Disp: <strong>{fmtMoney(t.remaining_amount)}</strong> · Máx 110%: {fmtMoney(t.max_allowed)}</p>
                    </div>
                    <input type="number" min={0} max={Number(t.capacity_remaining || t.remaining_amount)} step={0.01}
                      value={refAllocations[t.id] || ''} placeholder="0.00"
                      onChange={e => {
                        const max = Number(t.capacity_remaining || t.remaining_amount);
                        const v = Math.min(Number(e.target.value), max);
                        setRefAllocations(p => ({ ...p, [t.id]: v }));
                      }}
                      className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-right" />
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>Total asignado: <strong className={totalRefs >= totalPayments ? 'text-green-600' : 'text-red-600'}>{fmtMoney(totalRefs)}</strong> / {fmtMoney(totalPayments)}</span>
              {totalRefs > totalPayments && <span className="text-amber-600">Excedente: {fmtMoney(totalRefs - totalPayments)}</span>}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setStep('select_payments'); setError(''); }} className="px-4 py-2 text-xs text-gray-500 cursor-pointer">← Atrás</button>
              <button onClick={handleApply} disabled={loading || totalRefs < totalPayments || transfers.length === 0}
                className="px-4 py-2 bg-[#8AAA19] text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                <span className="text-white">{loading ? 'Aplicando...' : 'Aplicar Referencias'}</span></button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <FaCheckCircle className="text-green-600 text-3xl mx-auto mb-2" />
              <p className="text-sm font-bold text-green-800">Referencias aplicadas exitosamente</p>
              <p className="text-xs text-green-600 mt-1">{chosenPayments.length} pago(s) marcados como AGRUPADO con {Object.values(refAllocations).filter(v => v > 0).length} referencia(s).</p>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg cursor-pointer">
                <span className="text-white">Cerrar</span></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

type PagosTab = 'pendientes' | 'historial' | 'recurrencia';

const TABS: { key: PagosTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { key: 'pendientes', label: 'Pendientes', shortLabel: 'Pend.', icon: <FaClock /> },
  { key: 'historial', label: 'Historial Banco', shortLabel: 'Banco', icon: <FaHistory /> },
  { key: 'recurrencia', label: 'Recurrencia', shortLabel: 'Recur.', icon: <FaRecurrence /> },
];

export default function AdmCotPagos() {
  const [activeTab, setActiveTab] = useState<PagosTab>('pendientes');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 sm:p-2 flex gap-1.5 sm:gap-2 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}>
            <span className={activeTab === tab.key ? 'text-white' : 'text-gray-400'}>{tab.icon}</span>
            <span className={`hidden sm:inline ${activeTab === tab.key ? 'text-white' : ''}`}>{tab.label}</span>
            <span className={`sm:hidden ${activeTab === tab.key ? 'text-white' : ''}`}>{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {activeTab === 'pendientes' && <PendientesTab key={refreshKey} onRefresh={() => setRefreshKey(k => k + 1)} />}
      {activeTab === 'historial' && <HistorialBancoTab />}
      {activeTab === 'recurrencia' && <RecurrenciaTab />}
    </div>
  );
}
