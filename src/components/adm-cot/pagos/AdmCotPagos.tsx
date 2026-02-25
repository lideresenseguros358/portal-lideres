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
  FaClock,
  FaPlus,
  FaEdit,
  FaBan,
  FaTimes,
  FaSync,
  FaChevronDown,
  FaChevronUp,
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
    PENDIENTE: { bg: 'bg-amber-100', text: 'text-amber-800' },
    AGRUPADO: { bg: 'bg-blue-100', text: 'text-blue-800' },
    PAGADO: { bg: 'bg-green-100', text: 'text-green-800' },
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600' },
    CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800' },
    POSTED: { bg: 'bg-green-100', text: 'text-green-800' },
    OPEN: { bg: 'bg-green-100', text: 'text-green-800' },
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);
  const [refundForm, setRefundForm] = useState({ bank: '', account: '', accountType: 'Ahorro', reason: '' });

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

  const selectedPayments = payments.filter(p => selected.has(p.id));
  const selectedTotal = selectedPayments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', count: summary.pending || 0, amt: summary.pendingAmt || 0, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-600' },
          { label: 'Agrupados', count: summary.grouped || 0, amt: summary.groupedAmt || 0, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Pagados', count: summary.paid || 0, amt: summary.paidAmt || 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'Devoluciones', count: summary.refunds || 0, amt: summary.refundsAmt || 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
            <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
            <p className="text-xl font-bold text-[#010139]">{c.count}</p>
            <p className="text-xs text-gray-500">{fmtMoney(c.amt)}</p>
          </div>
        ))}
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input type="text" placeholder="Buscar cliente, póliza..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPayments()}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#010139]/20" />
        </div>
        <select value={insurer} onChange={e => setInsurer(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Aseguradora</option><option value="INTERNACIONAL">Internacional</option><option value="FEDPA">FEDPA</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Estado</option><option value="PENDIENTE">Pendiente</option><option value="AGRUPADO">Agrupado</option><option value="PAGADO">Pagado</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">Tipo</option><option value="PAY">Pago Aseg.</option><option value="REFUND">Devolución</option>
        </select>
        <button onClick={() => { setSearch(''); setInsurer(''); setStatus(''); setType(''); }} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"><FaTimes /></button>
        <button onClick={fetchPayments} className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer">
          <FaSync className={`text-white ${loading ? 'animate-spin' : ''}`} /> <span className="text-white">Buscar</span>
        </button>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-blue-800 font-medium">{selected.size} seleccionados — Total: {fmtMoney(selectedTotal)}</span>
          <div className="flex gap-2">
            <button onClick={() => setShowGroupModal(true)}
              className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer">
              <FaLayerGroup className="text-white" /> <span className="text-white">Agrupar y Pagar</span>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 w-8"><input type="checkbox" onChange={selectAll} checked={selected.size > 0 && selected.size === payments.filter(p => p.status === 'PENDIENTE').length} className="cursor-pointer" /></th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Póliza</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Monto</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Aseg.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cuota</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <FaMoneyBillWave className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No hay pagos registrados</p>
                  <p className="text-xs text-gray-400 mt-1">Se crean automáticamente al confirmar emisión</p>
                </td></tr>
              ) : payments.map(p => (
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
                  <td className="py-2 px-2">
                    {p.status === 'PENDIENTE' && !p.is_refund && (
                      <button onClick={() => setShowRefundModal(p.id)} className="text-[10px] text-red-500 hover:text-red-700 cursor-pointer" title="Marcar devolución"><FaUndoAlt /></button>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#010139]">Marcar como Devolución</h3>
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
// 2. HISTORIAL BANCO TAB
// ════════════════════════════════════════════

function HistorialBancoTab() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ bank_name: '', reference_number: '', transfer_amount: '', transfer_date: '', notes: '' });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await api({ tab: 'transfers' });
    if (res.success) setTransfers(res.data.transfers);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleImport = async () => {
    if (!importForm.bank_name || !importForm.reference_number || !importForm.transfer_amount || !importForm.transfer_date) return;
    await apiPost('import_transfer', importForm);
    setShowImport(false);
    setImportForm({ bank_name: '', reference_number: '', transfer_amount: '', transfer_date: '', notes: '' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Transferencias bancarias importadas. Disponibles para asignar a grupos.</p>
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg cursor-pointer">
          <FaPlus className="text-white" /> <span className="text-white">Importar Transferencia</span></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 w-7"></th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Referencia</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Banco</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Monto Total</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Disponible</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <FaHistory className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Sin transferencias</p>
                </td></tr>
              ) : transfers.map(t => (
                <>
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                    <td className="py-2 px-2">{expanded === t.id ? <FaChevronUp className="text-[10px]" /> : <FaChevronDown className="text-[10px] text-gray-400" />}</td>
                    <td className="py-2 px-2 text-[11px] font-mono font-bold text-[#010139]">{t.reference_number}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-600">{t.bank_name}</td>
                    <td className="py-2 px-2 text-[11px] font-bold">{fmtMoney(t.transfer_amount)}</td>
                    <td className="py-2 px-2 text-[11px] font-bold text-[#8AAA19]">{fmtMoney(t.remaining_amount)}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-500">{fmtDate(t.transfer_date)}</td>
                    <td className="py-2 px-2"><StatusBadge status={t.status} /></td>
                  </tr>
                  {expanded === t.id && (
                    <tr key={t.id + '-detail'} className="bg-gray-50">
                      <td colSpan={7} className="p-3 text-xs">
                        {t.usages && t.usages.length > 0 ? (
                          <div><strong>Usos:</strong>
                            {t.usages.map((u: any, i: number) => <span key={i} className="ml-2">Grupo {u.group_id?.slice(0, 8)}... — {fmtMoney(u.amount_used)}</span>)}
                          </div>
                        ) : <p className="text-gray-400 italic">Sin usos aún</p>}
                        {t.notes && <p className="mt-1 text-gray-500">Notas: {t.notes}</p>}
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
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#010139]">Importar Transferencia Bancaria</h3>
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Reglas:</strong> No supera 1 año. Frecuencia según cuotas. Editar siguiente fecha (solo esta / todas futuras). Cancelar = desactiva futuras.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                  <td className="py-2 px-2 text-[11px]">{r.total_installments}</td>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#010139]">Editar Próxima Fecha</h3>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-red-600">Cancelar Recurrencia</h3>
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
// MAIN COMPONENT
// ════════════════════════════════════════════

type PagosTab = 'pendientes' | 'historial' | 'recurrencia';

const TABS: { key: PagosTab; label: string; icon: React.ReactNode }[] = [
  { key: 'pendientes', label: 'Pagos Pendientes', icon: <FaClock /> },
  { key: 'historial', label: 'Historial Banco', icon: <FaHistory /> },
  { key: 'recurrencia', label: 'Recurrencia', icon: <FaRecurrence /> },
];

export default function AdmCotPagos() {
  const [activeTab, setActiveTab] = useState<PagosTab>('pendientes');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[#010139]">Pagos</h2>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.key ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <span className={activeTab === tab.key ? 'text-white' : ''}>{tab.icon}</span>
            <span className={activeTab === tab.key ? 'text-white' : ''}>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'pendientes' && <PendientesTab key={refreshKey} onRefresh={() => setRefreshKey(k => k + 1)} />}
      {activeTab === 'historial' && <HistorialBancoTab />}
      {activeTab === 'recurrencia' && <RecurrenciaTab />}
    </div>
  );
}
