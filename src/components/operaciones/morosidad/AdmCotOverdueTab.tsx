'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaEnvelope,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaClock,
  FaTimes,
  FaPaperPlane,
  FaEye,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';

const fmtMoney = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-PA') : '\u2014';

const ADM_COT_DEFAULT_SUBJECT = 'Aviso de pago pendiente - {{poliza_numero}}';
const ADM_COT_DEFAULT_BODY = `Estimado/a {{cliente_nombre}},

Le informamos que su cuota #{{cuota}} de la p\u00f3liza {{poliza_numero}} ({{aseguradora}}) presenta un pago pendiente de {{monto_adeudado}} con {{dias_atraso}} d\u00edas de atraso desde la fecha de vencimiento ({{fecha_vencimiento}}).

Le agradecemos realizar su pago a la mayor brevedad posible para evitar inconvenientes con su cobertura.

Saludos,
L\u00edderes en Seguros`;

const ADM_COT_MERGE_VARS = [
  '{{cliente_nombre}}',
  '{{poliza_numero}}',
  '{{monto_adeudado}}',
  '{{dias_atraso}}',
  '{{fecha_vencimiento}}',
  '{{cuota}}',
  '{{aseguradora}}',
];

interface OverduePayment {
  id: string;
  client_name: string;
  client_email: string | null;
  nro_poliza: string;
  insurer: string;
  amount: number;
  installment_num: number;
  payment_date: string;
  days_overdue: number;
  cedula?: string;
}

// ================================================================
// EMAIL MODAL
// ================================================================

function AdmCotEmailModal({
  open, onClose, payments, onConfirm, sending,
}: {
  open: boolean;
  onClose: () => void;
  payments: OverduePayment[];
  onConfirm: (subject: string, bodyTemplate: string) => void;
  sending: boolean;
}) {
  const [subject, setSubject] = useState(ADM_COT_DEFAULT_SUBJECT);
  const [body, setBody] = useState(ADM_COT_DEFAULT_BODY);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(ADM_COT_DEFAULT_SUBJECT);
      setBody(ADM_COT_DEFAULT_BODY);
      setShowPreview(false);
    }
  }, [open]);

  if (!open || payments.length === 0) return null;

  const previewRow = payments[0]!;
  const mergedPreview = body
    .replace(/\{\{cliente_nombre\}\}/g, previewRow.client_name || 'Cliente')
    .replace(/\{\{poliza_numero\}\}/g, previewRow.nro_poliza || '\u2014')
    .replace(/\{\{monto_adeudado\}\}/g, fmtMoney(previewRow.amount))
    .replace(/\{\{dias_atraso\}\}/g, String(previewRow.days_overdue || 0))
    .replace(/\{\{fecha_vencimiento\}\}/g, fmtDate(previewRow.payment_date))
    .replace(/\{\{cuota\}\}/g, String(previewRow.installment_num || '\u2014'))
    .replace(/\{\{aseguradora\}\}/g, previewRow.insurer || '\u2014');

  const withEmail = payments.filter(p => p.client_email);
  const withoutEmail = payments.filter(p => !p.client_email);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FaEnvelope className="text-[#010139] text-sm" />
            <h3 className="text-sm font-bold text-[#010139]">Enviar aviso de pago pendiente</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium">{withEmail.length} destinatario(s) con correo</p>
            {withoutEmail.length > 0 && (
              <p className="text-[10px] text-orange-600 mt-1">
                <FaExclamationTriangle className="inline mr-1" />
                {withoutEmail.length} pago(s) sin correo — se omitirán
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Asunto</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#010139] focus:ring-1 focus:ring-[#010139]/20 outline-none" />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Cuerpo del correo</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-[#010139] focus:ring-1 focus:ring-[#010139]/20 outline-none resize-none" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {ADM_COT_MERGE_VARS.map(v => (
                <button key={v} onClick={() => setBody(prev => prev + ' ' + v)}
                  className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded cursor-pointer hover:bg-gray-200">
                  {v}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 text-xs text-[#010139] font-medium cursor-pointer">
            <FaEye className="text-[10px]" />
            {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
            {showPreview ? <FaChevronUp className="text-[8px]" /> : <FaChevronDown className="text-[8px]" />}
          </button>
          {showPreview && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line">
              {mergedPreview}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Cancelar</button>
          <button onClick={() => onConfirm(subject, body)} disabled={sending || withEmail.length === 0}
            className="px-4 py-2 bg-[#010139] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-[#020270] disabled:opacity-50 transition-colors">
            <FaPaperPlane className="text-white text-[10px]" />
            <span className="text-white">{sending ? 'Enviando...' : `Enviar (${withEmail.length})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function AdmCotOverdueTab() {
  const [payments, setPayments] = useState<OverduePayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [insurer, setInsurer] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: 'adm_cot_overdue' });
      if (search) params.set('search', search);
      if (insurer) params.set('insurer', insurer);
      const res = await fetch(`/api/operaciones/morosidad?${params}`);
      const json = await res.json();
      if (json.success) setPayments(json.data || []);
    } catch (err) {
      console.error('[AdmCotOverdue] fetch error:', err);
    }
    setLoading(false);
  }, [search, insurer]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selected.size === payments.length) setSelected(new Set());
    else setSelected(new Set(payments.map(p => p.id)));
  };

  const selectedPayments = payments.filter(p => selected.has(p.id));

  const handleSendEmails = async (subject: string, bodyTemplate: string) => {
    setSending(true);
    try {
      const res = await fetch('/api/operaciones/morosidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_adm_cot_overdue_email',
          payments: selectedPayments.map(p => ({
            id: p.id,
            client_name: p.client_name,
            client_email: p.client_email,
            nro_poliza: p.nro_poliza,
            insurer: p.insurer,
            amount: p.amount,
            installment_num: p.installment_num,
            payment_date: p.payment_date,
            days_overdue: p.days_overdue,
          })),
          subject,
          bodyTemplate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelected(new Set());
        fetchData();
      }
    } catch (err) {
      console.error('[AdmCotOverdue] send error:', err);
    }
    setSending(false);
    setEmailModalOpen(false);
  };

  const totalOverdueAmt = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const severityColor = (days: number) => {
    if (days >= 30) return { bg: 'bg-red-100', text: 'text-red-700' };
    if (days >= 20) return { bg: 'bg-orange-100', text: 'text-orange-700' };
    return { bg: 'bg-amber-100', text: 'text-amber-700' };
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-[10px] text-red-600 font-semibold uppercase">Cuotas Vencidas</p>
          <p className="text-xl font-bold text-[#010139]">{payments.length}</p>
          <p className="text-[11px] text-gray-500">+15 días sin confirmar</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[10px] text-amber-600 font-semibold uppercase">Monto Total</p>
          <p className="text-xl font-bold text-[#010139]">{fmtMoney(totalOverdueAmt)}</p>
          <p className="text-[11px] text-gray-500">Pendiente de cobro</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-[10px] text-blue-600 font-semibold uppercase">Con Correo</p>
          <p className="text-xl font-bold text-[#010139]">{payments.filter(p => p.client_email).length}</p>
          <p className="text-[11px] text-gray-500">Disponibles para aviso</p>
        </div>
      </div>

      {/* Alert */}
      {payments.length > 0 && (
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex items-center gap-2.5">
          <FaExclamationTriangle className="text-red-400 text-xs flex-shrink-0" />
          <p className="text-xs text-red-600">
            <span className="font-medium">{payments.length} cuota(s) recurrente(s)</span> llevan más de 15 días sin confirmación de pago en PagueloFacil.
          </p>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 border-2 border-gray-200 rounded-lg focus-within:border-[#8AAA19] focus-within:ring-2 focus-within:ring-[#8AAA19]/20 bg-white px-3 py-2">
            <FaSearch className="text-gray-400 text-sm flex-shrink-0" />
            <input type="text" placeholder="Buscar cliente, póliza, cédula..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm bg-transparent p-0" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${showFilters ? 'bg-[#010139] text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
            <FaFilter className="text-sm" />
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 cursor-pointer flex-shrink-0">
            <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {showFilters && (
          <div className="pt-2 border-t border-gray-100">
            <select value={insurer} onChange={e => setInsurer(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-gray-600">
              <option value="">Todas las aseguradoras</option>
              <option value="FEDPA">FEDPA</option>
              <option value="INTERNACIONAL">Internacional</option>
              <option value="REGIONAL">Regional</option>
              <option value="ANCON">ANCÓN</option>
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && payments.length === 0 ? (
          <div className="space-y-1.5 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <FaMoneyBillWave className="text-3xl text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">Sin cuotas vencidas</p>
            <p className="text-xs text-gray-400 mt-1">Todos los pagos recurrentes están al día</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 p-3">
              {payments.map(p => {
                const dc = severityColor(p.days_overdue);
                return (
                  <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="cursor-pointer flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#010139] truncate">{p.client_name}</p>
                          <p className="text-[11px] text-gray-500">{p.insurer} · {p.nro_poliza || '\u2014'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-sm font-bold text-red-600">{fmtMoney(p.amount)}</p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${dc.bg} ${dc.text}`}>
                          <FaClock className="text-[8px] mr-0.5" />{p.days_overdue}d
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                      <span>Cuota {p.installment_num || '\u2014'}</span>
                      <span>·</span>
                      <span>Vencía: {fmtDate(p.payment_date)}</span>
                      {p.client_email && <><span>·</span><FaEnvelope className="text-[8px] text-green-500" /></>}
                      {!p.client_email && <><span>·</span><span className="text-red-400">Sin correo</span></>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-3 py-2.5 text-left w-8">
                      <input type="checkbox" checked={selected.size > 0 && selected.size === payments.length} onChange={toggleSelectAll} className="rounded border-gray-300 cursor-pointer" />
                    </th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Cliente</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Póliza</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Aseg.</th>
                    <th className="px-2 py-2.5 text-right font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Monto</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Cuota</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Vencimiento</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Días Atraso</th>
                    <th className="px-2 py-2.5 text-center font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const dc = severityColor(p.days_overdue);
                    return (
                      <tr key={p.id} className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${p.days_overdue >= 30 ? 'border-l-[3px] border-l-red-400' : ''}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-gray-300 cursor-pointer" />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="font-semibold text-[#010139] text-[11px]">{p.client_name}</span>
                          {p.cedula && <span className="block text-[9px] text-gray-400">{p.cedula}</span>}
                        </td>
                        <td className="px-2 py-2.5 font-mono text-gray-500 text-[10px]">{p.nro_poliza || '\u2014'}</td>
                        <td className="px-2 py-2.5 text-gray-600 text-[11px]">{p.insurer}</td>
                        <td className="px-2 py-2.5 text-right font-mono font-semibold text-red-600">{fmtMoney(p.amount)}</td>
                        <td className="px-2 py-2.5 text-center text-gray-500">{p.installment_num || '\u2014'}</td>
                        <td className="px-2 py-2.5 text-gray-500 tabular-nums">{fmtDate(p.payment_date)}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${dc.bg} ${dc.text}`}>
                            {p.days_overdue}d
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {p.client_email
                            ? <FaEnvelope className="text-green-500 text-[10px] inline" title={p.client_email} />
                            : <span className="text-[10px] text-red-300">N/A</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Floating bulk action */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200">
          <button
            onClick={() => setEmailModalOpen(true)}
            className="bg-[#010139] text-white px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer hover:bg-[#020270] transition-all duration-150 shadow-lg shadow-[#010139]/20"
          >
            <FaEnvelope className="text-white text-xs" />
            <span className="text-white">Enviar aviso a {selected.size} {selected.size === 1 ? 'cliente' : 'clientes'}</span>
          </button>
        </div>
      )}

      {/* Email Modal */}
      <AdmCotEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        payments={selectedPayments}
        onConfirm={handleSendEmails}
        sending={sending}
      />
    </div>
  );
}
