'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  FaTimes, FaSearch, FaCreditCard,
  FaFileInvoiceDollar, FaSpinner, FaExclamationTriangle,
  FaDownload, FaArrowLeft, FaShieldAlt, FaCheck, FaCheckCircle,
  FaCalendarCheck, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import CreditCardInput, { type CardData } from '@/components/is/CreditCardInput';

// ── Types ──

interface Installment {
  num: number;
  due_date: string;
  amount: number;
  status: 'PAGADO' | 'VENCIDO' | 'PENDIENTE';
  payment_id: string | null;
  existing_payment_id: string | null;
  existing_payment_status: string | null;
}

interface PolicyData {
  nro_poliza: string;
  client_name: string;
  insurer: string;
  cedula: string;
  recurrence_id: string;
  total_installments: number;
  frequency: string;
  installment_amount: number;
  pf_cod_oper: string | null;
  pf_rec_cod_oper: string | null;
  installments: Installment[];
  paidCount: number;
  pendingCount: number;
  hasOverdue: boolean;
}

type LookupStatus = 'no_recurrences' | 'al_dia' | 'has_overdue' | 'all_paid';
type Step = 'cedula' | 'status' | 'select' | 'card' | 'summary' | 'processing' | 'receipt';

interface Props { isOpen: boolean; onClose: () => void; prefillCedula?: string; }

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(d: string) {
  if (!d) return '\u2014';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' });
}
function maskCard(last4: string) { return `**** **** **** ${last4}`; }

// ── Unique key for each installment ──
function instKey(pol: PolicyData, inst: Installment) {
  return `${pol.recurrence_id}::${inst.num}`;
}

export default function PayOverdueModal({ isOpen, onClose, prefillCedula }: Props) {
  const [step, setStep] = useState<Step>('cedula');
  const [cedula, setCedula] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null);
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showAdelanto, setShowAdelanto] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [cardError, setCardError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    codOper: string; cardDisplay: string; cardType: string; totalPaid: number;
    paidItems: Array<{ nro_poliza: string; insurer: string; num: number; amount: number }>;
    date: string; clientName: string; cedula: string;
    cancelledRecurrences: number;
  } | null>(null);

  // ── Auto-prefill cedula from morosidad email link ──
  const prefillDone = useRef(false);
  useEffect(() => {
    if (isOpen && prefillCedula && prefillCedula.length >= 3 && !prefillDone.current) {
      prefillDone.current = true;
      setCedula(prefillCedula);
    }
  }, [isOpen, prefillCedula]);

  // ── Helpers ──

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllForPolicy = (pol: PolicyData, insts: Installment[]) => {
    const keys = insts.map(i => instKey(pol, i));
    const allSelected = keys.every(k => selectedKeys.has(k));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => { if (allSelected) next.delete(k); else next.add(k); });
      return next;
    });
  };

  // Build selected installment objects for API
  const selectedInstallments = useMemo(() => {
    const result: Array<{ recurrence_id: string; num: number; amount: number; existing_payment_id: string | null; nro_poliza: string; insurer: string }> = [];
    for (const pol of policies) {
      for (const inst of pol.installments) {
        if (selectedKeys.has(instKey(pol, inst))) {
          result.push({
            recurrence_id: pol.recurrence_id,
            num: inst.num,
            amount: inst.amount,
            existing_payment_id: inst.existing_payment_id,
            nro_poliza: pol.nro_poliza,
            insurer: pol.insurer,
          });
        }
      }
    }
    return result;
  }, [policies, selectedKeys]);

  const selectedTotal = useMemo(() => selectedInstallments.reduce((s, i) => s + i.amount, 0), [selectedInstallments]);

  // ── Lookup ──

  const handleLookup = useCallback(async () => {
    if (!cedula.trim() || cedula.trim().length < 3) { setLookupError('Ingrese un número de cédula válido'); return; }
    setLookupLoading(true); setLookupError(''); setLookupStatus(null);
    try {
      const res = await fetch(`/api/public/overdue-payments?cedula=${encodeURIComponent(cedula.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en la búsqueda');

      const status: LookupStatus = json.status || 'no_recurrences';
      setLookupStatus(status);
      setPolicies(json.data || []);

      if (status === 'no_recurrences') {
        setStep('status');
      } else if (status === 'al_dia' || status === 'all_paid') {
        setStep('status');
      } else if (status === 'has_overdue') {
        // Auto-select all overdue installments
        const autoKeys = new Set<string>();
        for (const pol of (json.data || [])) {
          for (const inst of pol.installments) {
            if (inst.status === 'VENCIDO') autoKeys.add(instKey(pol, inst));
          }
        }
        setSelectedKeys(autoKeys);
        setStep('status');
      }
    } catch (err: any) { setLookupError(err.message || 'Error de conexión'); }
    setLookupLoading(false);
  }, [cedula]);

  // ── Payment ──

  const processPayment = useCallback(async () => {
    if (!cardData || selectedInstallments.length === 0) return;
    setStep('processing'); setProgress(0); setProgressStep('Iniciando procesamiento de pago...'); setProcessingError(null);
    try {
      setProgress(10); setProgressStep('Conectando con procesador de pagos...');
      const clientName = policies[0]?.client_name || 'Cliente';
      const policyNumbers = [...new Set(selectedInstallments.map(i => i.nro_poliza))].join(', ');

      const chargeRes = await fetch('/api/paguelofacil/charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedTotal,
          description: `Pago cuotas - ${policyNumbers}`,
          concept: `Pago póliza ${policyNumbers}`,
          cardNumber: cardData.cardNumber, expMonth: cardData.expMonth, expYear: cardData.expYear,
          cvv: cardData.cvv, cardholderName: cardData.cardName, cardType: cardData.brand,
          email: 'noreply@lideresenseguros.com',
        }),
      });
      const chargeJson = await chargeRes.json();
      setProgress(40);
      if (!chargeJson.success) throw new Error(chargeJson.error || 'Error al procesar el pago');

      setProgressStep('Pago aprobado. Registrando en el sistema...'); setProgress(60);

      // Confirm all selected installments (overdue + adelanto)
      const confirmRes = await fetch('/api/public/overdue-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_payment',
          installments: selectedInstallments.map(i => ({
            recurrence_id: i.recurrence_id,
            num: i.num,
            amount: i.amount,
            existing_payment_id: i.existing_payment_id,
          })),
          pf_cod_oper: chargeJson.codOper,
          pf_card_type: chargeJson.cardType || cardData.brand,
          pf_card_display: chargeJson.displayNum || cardData.last4,
          total_paid: selectedTotal,
          client_name: clientName,
          cedula: cedula.trim(),
        }),
      });
      const confirmJson = await confirmRes.json();
      setProgress(80);

      // If some recurrences are now fully paid, cancel PF recurrence
      let cancelledCount = 0;
      const completedRecs = confirmJson?.data?.completedRecurrences || [];
      if (completedRecs.length > 0) {
        setProgressStep('Cancelando recurrencias completadas en PagueloFácil...');
        for (const cr of completedRecs) {
          if (cr.pf_rec_cod_oper) {
            try {
              await fetch('/api/paguelofacil/recurrent', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codOper: cr.pf_rec_cod_oper }),
              });
              cancelledCount++;
            } catch (e) {
              console.warn('[PayOverdueModal] Could not cancel PF recurrence:', cr.pf_rec_cod_oper, e);
            }
          }
        }
      }
      setProgress(95); setProgressStep('Generando comprobante...');

      setReceiptData({
        codOper: chargeJson.codOper,
        cardDisplay: chargeJson.displayNum || cardData.last4,
        cardType: chargeJson.cardType || cardData.brand,
        totalPaid: selectedTotal,
        paidItems: selectedInstallments.map(i => ({
          nro_poliza: i.nro_poliza, insurer: i.insurer, num: i.num, amount: i.amount,
        })),
        date: new Date().toISOString(),
        clientName, cedula: cedula.trim(),
        cancelledRecurrences: cancelledCount,
      });
      setProgress(100); setProgressStep('¡Pago completado!');
      setTimeout(() => setStep('receipt'), 1200);
    } catch (err: any) { setProcessingError(err.message || 'Error inesperado'); }
  }, [cardData, selectedInstallments, selectedTotal, policies, cedula]);

  // ── Receipt download ──

  const downloadReceipt = useCallback(() => {
    if (!receiptData) return;
    const r = receiptData;
    const now = new Date(r.date);
    const dateStr = now.toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const itemsHtml = r.paidItems.map((item) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${item.nro_poliza}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${item.insurer}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.num}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;">${fmtCurrency(item.amount)}</td></tr>`
    ).join('');
    const html = `<html><head><meta charset="utf-8"><title>Recibo de Pago</title></head><body style="margin:0;padding:40px;font-family:Arial,sans-serif;color:#333;"><div style="max-width:600px;margin:0 auto;"><div style="text-align:center;margin-bottom:30px;"><img src="${window.location.origin}/logo.png" alt="Líderes en Seguros" style="height:60px;margin-bottom:10px;" /><h1 style="color:#010139;font-size:22px;margin:0;">Recibo de Pago</h1><p style="color:#6b7280;font-size:12px;margin:4px 0 0;">Líderes en Seguros, S.A.</p></div><div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;"><table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Fecha:</td><td style="font-weight:600;">${dateStr}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Código:</td><td style="font-weight:600;font-family:monospace;">${r.codOper}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Cliente:</td><td style="font-weight:600;">${r.clientName}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Cédula:</td><td style="font-weight:600;">${r.cedula}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Tarjeta:</td><td style="font-weight:600;">${r.cardType} ${maskCard(r.cardDisplay)}</td></tr></table></div><table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><thead><tr style="background:#010139;color:white;"><th style="padding:10px 12px;text-align:left;font-size:12px;">Póliza</th><th style="padding:10px 12px;text-align:left;font-size:12px;">Aseguradora</th><th style="padding:10px 12px;text-align:center;font-size:12px;">Cuota</th><th style="padding:10px 12px;text-align:right;font-size:12px;">Monto</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr style="background:#f0fdf4;"><td colspan="3" style="padding:12px;font-weight:700;font-size:14px;color:#010139;">TOTAL PAGADO</td><td style="padding:12px;text-align:right;font-weight:700;font-size:16px;color:#010139;">${fmtCurrency(r.totalPaid)}</td></tr></tfoot></table><p style="text-align:center;color:#9ca3af;font-size:10px;margin-top:30px;">Este recibo es generado automáticamente por el portal de Líderes en Seguros.<br/>Para cualquier consulta: contacto@lideresenseguros.com</p></div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  }, [receiptData]);

  // ── Reset ──

  const handleClose = () => {
    setStep('cedula'); setCedula(''); setLookupError(''); setLookupStatus(null);
    setPolicies([]); setSelectedKeys(new Set()); setShowAdelanto(false); setExpandedPolicies(new Set());
    setCardData(null); setCardError(''); setProgress(0); setProgressStep('');
    setProcessingError(null); setReceiptData(null); prefillDone.current = false; onClose();
  };

  if (!isOpen) return null;

  // ── Derived data ──
  const overdueInstallments = policies.flatMap(pol => pol.installments.filter(i => i.status === 'VENCIDO').map(i => ({ ...i, _pol: pol })));
  const upcomingInstallments = policies.flatMap(pol => pol.installments.filter(i => i.status === 'PENDIENTE').map(i => ({ ...i, _pol: pol })));

  const stepTitles: Record<Step, { title: string; sub: string }> = {
    cedula: { title: 'Realiza tu Pago', sub: 'Ingresa tu cédula para consultar tu estado de pagos' },
    status: { title: lookupStatus === 'has_overdue' ? 'Pagos Pendientes' : 'Estado de Pagos', sub: lookupStatus === 'has_overdue' ? 'Tienes cuotas vencidas que requieren atención' : 'Consulta de estado de pagos' },
    select: { title: 'Selecciona tus Cuotas', sub: 'Selecciona las cuotas que deseas pagar' },
    card: { title: 'Datos de Tarjeta', sub: 'Ingresa los datos de tu tarjeta' },
    summary: { title: 'Resumen de Pago', sub: 'Verifica los detalles antes de confirmar' },
    processing: { title: '', sub: '' },
    receipt: { title: 'Pago Confirmado', sub: 'Tu pago ha sido procesado exitosamente' },
  };

  const backStep = () => {
    if (step === 'status') setStep('cedula');
    if (step === 'select') setStep('status');
    if (step === 'card') setStep('select');
    if (step === 'summary') setStep('card');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {step !== 'processing' && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              {(['status', 'select', 'card', 'summary'] as Step[]).includes(step) && (
                <button onClick={backStep} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><FaArrowLeft className="text-sm" /></button>
              )}
              <div>
                <h2 className="text-base font-bold text-[#010139]">{stepTitles[step].title}</h2>
                <p className="text-[10px] text-gray-400">{stepTitles[step].sub}</p>
              </div>
            </div>
            {step !== 'receipt' && <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><FaTimes /></button>}
          </div>
        )}

        {!['processing', 'receipt', 'status'].includes(step) && (
          <div className="flex gap-1 px-5 pt-3">
            {['cedula', 'select', 'card', 'summary'].map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                ['cedula', 'select', 'card', 'summary'].indexOf(step) >= i ? 'bg-[#8AAA19]' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">

          {/* ═══ STEP: CEDULA ═══ */}
          {step === 'cedula' && (
            <div className="space-y-6">
              <div className="text-center pt-4">
                <div className="w-16 h-16 mx-auto bg-[#010139]/5 rounded-full flex items-center justify-center mb-4"><FaFileInvoiceDollar className="text-2xl text-[#010139]" /></div>
                <p className="text-sm text-gray-600">Consulta el estado de tus pagos y paga tus cuotas de forma segura.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Número de Cédula</label>
                <div className="flex gap-2">
                  <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLookup()} placeholder="Ej: 8-888-8888" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-colors" autoFocus />
                  <button onClick={handleLookup} disabled={lookupLoading} className="px-5 py-3 bg-[#010139] text-white rounded-xl font-semibold text-sm hover:bg-[#020270] disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-2">
                    {lookupLoading ? <FaSpinner className="animate-spin" /> : <FaSearch />} Buscar
                  </button>
                </div>
                {lookupError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" /> {lookupError}</p>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 justify-center"><FaShieldAlt /> Pago seguro procesado por PagueloFácil</div>
            </div>
          )}

          {/* ═══ STEP: STATUS (main intelligence layer) ═══ */}
          {step === 'status' && (
            <div className="space-y-5">

              {/* ── No recurrences ── */}
              {(lookupStatus === 'no_recurrences' || lookupStatus === 'all_paid') && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center"><FaCheckCircle className="text-4xl text-green-500" /></div>
                  <h3 className="text-lg font-bold text-[#010139]">Sin pagos pendientes</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {lookupStatus === 'no_recurrences'
                      ? 'No se encontraron pólizas con plan de pagos asociadas a esta cédula.'
                      : 'Todas tus cuotas han sido pagadas. ¡Gracias por mantenerte al día!'
                    }
                  </p>
                  <button onClick={handleClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm cursor-pointer hover:bg-gray-200 transition-colors">Cerrar</button>
                </div>
              )}

              {/* ── Al día (has pending but none overdue) ── */}
              {lookupStatus === 'al_dia' && (
                <div className="space-y-5">
                  <div className="text-center pt-2">
                    <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4"><FaCalendarCheck className="text-3xl text-green-500" /></div>
                    <h3 className="text-lg font-bold text-green-700">¡Te encuentras al día!</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                      Tus pagos están al corriente. No tienes cuotas vencidas en este momento.
                    </p>
                  </div>

                  {/* Policy summary cards */}
                  {policies.map(pol => (
                    <div key={pol.recurrence_id} className="border border-green-200 bg-green-50/30 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#010139]">Póliza {pol.nro_poliza}</p>
                          <p className="text-[10px] text-gray-500">{pol.insurer} &middot; {pol.client_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Progreso</p>
                          <p className="text-xs font-bold text-green-700">{pol.paidCount}/{pol.total_installments} cuotas pagadas</p>
                        </div>
                      </div>
                      <div className="px-4 pb-3">
                        <div className="w-full bg-green-100 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(pol.paidCount / pol.total_installments) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Adelanto option */}
                  {upcomingInstallments.length > 0 && (
                    <div className="border-t border-gray-200 pt-5">
                      <button
                        onClick={() => { setShowAdelanto(true); setStep('select'); }}
                        className="w-full py-3 bg-[#010139] text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-[#020270] transition-colors flex items-center justify-center gap-2"
                      >
                        <FaCreditCard className="text-xs" /> ¿Deseas adelantar algún pago?
                      </button>
                      <p className="text-[10px] text-gray-400 text-center mt-2">
                        Puedes adelantar una o varias cuotas futuras y la recurrencia automática se ajustará.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Has overdue ── */}
              {lookupStatus === 'has_overdue' && (
                <div className="space-y-5">
                  {/* Alert banner */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <FaExclamationTriangle className="text-red-500 text-lg mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-700">Tienes {overdueInstallments.length} cuota{overdueInstallments.length > 1 ? 's' : ''} vencida{overdueInstallments.length > 1 ? 's' : ''}</p>
                      <p className="text-xs text-red-600 mt-1">Para mantener tu póliza vigente, realiza el pago lo antes posible.</p>
                    </div>
                  </div>

                  {/* Policy cards with overdue */}
                  {policies.filter(p => p.hasOverdue).map(pol => {
                    const overdueInsts = pol.installments.filter(i => i.status === 'VENCIDO');
                    const overdueTotal = overdueInsts.reduce((s, i) => s + i.amount, 0);
                    return (
                      <div key={pol.recurrence_id} className="border-2 border-red-200 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-4 py-3">
                          <p className="text-sm font-bold text-[#010139]">Póliza {pol.nro_poliza}</p>
                          <p className="text-[10px] text-gray-500">{pol.insurer} &middot; {pol.client_name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs font-bold text-red-600">{overdueInsts.length} cuota{overdueInsts.length > 1 ? 's' : ''} vencida{overdueInsts.length > 1 ? 's' : ''}</span>
                            <span className="text-xs font-bold text-red-700">{fmtCurrency(overdueTotal)}</span>
                          </div>
                        </div>
                        <div className="px-4 pb-3 pt-2">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(pol.paidCount / pol.total_installments) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">{pol.paidCount}/{pol.total_installments} cuotas pagadas</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Action buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => { setShowAdelanto(false); setStep('select'); }}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FaCreditCard className="text-xs" /> Pagar cuotas vencidas ({fmtCurrency(overdueInstallments.reduce((s, i) => s + i.amount, 0))})
                    </button>

                    {upcomingInstallments.length > 0 && (
                      <button
                        onClick={() => { setShowAdelanto(true); setStep('select'); }}
                        className="w-full py-2.5 bg-white border-2 border-[#010139] text-[#010139] rounded-xl font-bold text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        Pagar vencidas + adelantar cuotas futuras
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP: SELECT ═══ */}
          {step === 'select' && (
            <div className="space-y-4">
              {policies.map(pol => {
                const payableInsts = pol.installments.filter(i => i.status !== 'PAGADO');
                // If came from "pagar vencidas" only, show only overdue unless showAdelanto
                const displayInsts = showAdelanto ? payableInsts : payableInsts.filter(i => i.status === 'VENCIDO');
                // If al_dia flow (all adelanto), show all pending
                const finalInsts = lookupStatus === 'al_dia' ? payableInsts : displayInsts;
                if (finalInsts.length === 0) return null;

                const isExpanded = expandedPolicies.has(pol.recurrence_id);
                const visibleInsts = isExpanded ? finalInsts : finalInsts.slice(0, 5);
                const hasMore = finalInsts.length > 5;

                return (
                  <div key={pol.recurrence_id} className="border-2 border-gray-100 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#010139]">Póliza {pol.nro_poliza}</p>
                        <p className="text-[10px] text-gray-500">{pol.insurer} &middot; {pol.client_name} &middot; {pol.paidCount}/{pol.total_installments} pagadas</p>
                      </div>
                      <button onClick={() => selectAllForPolicy(pol, finalInsts)} className="text-[10px] text-[#8AAA19] font-bold cursor-pointer hover:underline">
                        {finalInsts.every(i => selectedKeys.has(instKey(pol, i))) ? 'Deseleccionar' : 'Seleccionar todas'}
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {visibleInsts.map(inst => {
                        const key = instKey(pol, inst);
                        const isOverdue = inst.status === 'VENCIDO';
                        return (
                          <label key={key} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors">
                            <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggleKey(key)} className="w-4 h-4 accent-[#8AAA19] cursor-pointer" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-800">Cuota {inst.num}</span>
                                {isOverdue ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">Vencida</span>
                                ) : (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">Próxima</span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400">Vence: {fmtDate(inst.due_date)}</span>
                            </div>
                            <span className="text-sm font-bold text-[#010139]">{fmtCurrency(inst.amount)}</span>
                          </label>
                        );
                      })}
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => setExpandedPolicies(prev => {
                          const next = new Set(prev);
                          if (next.has(pol.recurrence_id)) next.delete(pol.recurrence_id); else next.add(pol.recurrence_id);
                          return next;
                        })}
                        className="w-full px-4 py-2 text-[10px] text-[#8AAA19] font-bold cursor-pointer hover:bg-gray-50 flex items-center justify-center gap-1"
                      >
                        {isExpanded ? <><FaChevronUp className="text-[8px]" /> Mostrar menos</> : <><FaChevronDown className="text-[8px]" /> Ver {finalInsts.length - 5} cuota{finalInsts.length - 5 > 1 ? 's' : ''} más</>}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* If overdue-only mode, show option to also add upcoming */}
              {lookupStatus === 'has_overdue' && !showAdelanto && upcomingInstallments.length > 0 && (
                <button
                  onClick={() => setShowAdelanto(true)}
                  className="w-full py-2 text-xs text-[#010139] font-bold cursor-pointer hover:underline"
                >
                  + También deseo adelantar cuotas futuras ({upcomingInstallments.length} disponibles)
                </button>
              )}

              <div className="flex items-center justify-between bg-[#010139] text-white rounded-xl px-5 py-4">
                <div>
                  <p className="text-[10px] text-gray-300">Total seleccionado ({selectedInstallments.length} cuota{selectedInstallments.length !== 1 ? 's' : ''})</p>
                  <p className="text-xl font-bold">{fmtCurrency(selectedTotal)}</p>
                </div>
                <button onClick={() => { if (selectedInstallments.length > 0) setStep('card'); }} disabled={selectedInstallments.length === 0} className="px-6 py-2.5 bg-[#8AAA19] text-white rounded-lg font-bold text-sm disabled:opacity-40 cursor-pointer hover:bg-[#6d8814] transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP: CARD ═══ */}
          {step === 'card' && (
            <div className="space-y-4">
              <CreditCardInput
                onTokenReceived={() => {}}
                onCardDataReady={(data) => { setCardData(data); setCardError(''); }}
                onError={(err) => setCardError(err)}
              />
              {cardError && <p className="text-xs text-red-500 flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" /> {cardError}</p>}
              <div className="flex justify-end pt-2">
                <button onClick={() => { if (cardData) setStep('summary'); else setCardError('Complete los datos de la tarjeta'); }} className="px-6 py-2.5 bg-[#010139] text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-[#020270] disabled:opacity-40 transition-colors">Siguiente</button>
              </div>
            </div>
          )}

          {/* ═══ STEP: SUMMARY ═══ */}
          {step === 'summary' && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Datos del Cliente</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Nombre:</span> <span className="font-semibold text-gray-800">{policies[0]?.client_name}</span></div>
                  <div><span className="text-gray-400">Cédula:</span> <span className="font-semibold text-gray-800">{cedula}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cuotas a Pagar</p>
                {policies.map(pol => {
                  const selInsts = pol.installments.filter(i => selectedKeys.has(instKey(pol, i)));
                  if (selInsts.length === 0) return null;
                  return (
                    <div key={pol.recurrence_id} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2"><p className="text-[11px] font-bold text-[#010139]">Póliza {pol.nro_poliza} &middot; {pol.insurer}</p></div>
                      {selInsts.map(inst => (
                        <div key={inst.num} className="flex justify-between px-3 py-2 text-xs border-t border-gray-50">
                          <span className="text-gray-600">
                            Cuota {inst.num} ({fmtDate(inst.due_date)})
                            {inst.status === 'VENCIDO' && <span className="ml-1 text-red-500 font-semibold">\u2022 Vencida</span>}
                            {inst.status === 'PENDIENTE' && <span className="ml-1 text-blue-500 font-semibold">\u2022 Adelanto</span>}
                          </span>
                          <span className="font-bold text-gray-800">{fmtCurrency(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <FaCreditCard className="text-lg text-[#010139]" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{cardData?.brand} {maskCard(cardData?.last4 || '')}</p>
                  <p className="text-[10px] text-gray-400">{cardData?.cardName}</p>
                </div>
              </div>

              {/* Info about recurrence cancellation */}
              {selectedInstallments.length > 0 && (() => {
                const willComplete = policies.some(pol => {
                  const unpaidNonSelected = pol.installments.filter(i => i.status !== 'PAGADO' && !selectedKeys.has(instKey(pol, i)));
                  return unpaidNonSelected.length === 0;
                });
                return willComplete ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-[10px] text-amber-700 font-semibold flex items-center gap-2">
                    <FaCheck className="text-[8px]" /> Al completar este pago se cancelará la recurrencia automática en PagueloFácil.
                  </div>
                ) : null;
              })()}

              <div className="bg-[#010139] text-white rounded-xl px-5 py-4 flex items-center justify-between">
                <div><p className="text-[10px] text-gray-300">Total a pagar</p><p className="text-2xl font-bold">{fmtCurrency(selectedTotal)}</p></div>
                <button onClick={processPayment} className="px-8 py-3 bg-[#8AAA19] text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-[#6d8814] transition-colors shadow-lg">Pagar</button>
              </div>
            </div>
          )}

          {/* ═══ STEP: PROCESSING ═══ */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              {processingError ? (
                <div className="text-center space-y-4">
                  <FaExclamationTriangle className="text-red-500 text-5xl mx-auto" />
                  <h3 className="text-xl font-bold text-gray-900">Error al Procesar</h3>
                  <p className="text-sm text-red-600 max-w-xs mx-auto">{processingError}</p>
                  <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-3"><div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                  <button onClick={() => { setStep('summary'); setProcessingError(null); }} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors">Reintentar</button>
                </div>
              ) : (
                <div className="text-center space-y-4 w-full max-w-sm">
                  <FaSpinner className="text-[#8AAA19] text-4xl mx-auto animate-spin" />
                  <h3 className="text-lg font-bold text-[#010139]">Procesando tu pago</h3>
                  <p className="text-sm text-[#8AAA19] font-semibold">Espere un momento...</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden"><div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                  <p className="text-sm text-gray-500 font-mono">{Math.round(Math.min(progress, 100))}%</p>
                  <p className="text-sm text-gray-600">{progressStep}</p>
                  <p className="text-xs text-gray-400 mt-4">Por favor no cierre esta ventana...</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP: RECEIPT ═══ */}
          {step === 'receipt' && receiptData && (
            <div className="space-y-5">
              <div className="text-center pt-2">
                <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4"><FaCheckCircle className="text-4xl text-green-500" /></div>
                <h3 className="text-xl font-bold text-[#010139]">¡Pago Exitoso!</h3>
                <p className="text-sm text-gray-500 mt-1">Tu pago ha sido procesado correctamente.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Fecha:</span><span className="font-semibold">{new Date(receiptData.date).toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Código:</span><span className="font-mono font-semibold">{receiptData.codOper}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cliente:</span><span className="font-semibold">{receiptData.clientName}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Tarjeta:</span><span className="font-semibold">{receiptData.cardType} {maskCard(receiptData.cardDisplay)}</span></div>
              </div>

              <div className="space-y-1">
                {receiptData.paidItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs">
                    <div><span className="font-semibold text-gray-800">{item.nro_poliza}</span> <span className="text-gray-400">&middot; {item.insurer} &middot; Cuota {item.num}</span></div>
                    <span className="font-bold text-[#010139]">{fmtCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              {receiptData.cancelledRecurrences > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-semibold flex items-center gap-2">
                  <FaCheck className="text-[10px]" /> Se canceló la recurrencia automática en PagueloFácil ({receiptData.cancelledRecurrences} póliza{receiptData.cancelledRecurrences > 1 ? 's' : ''} completada{receiptData.cancelledRecurrences > 1 ? 's' : ''}).
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
                <div><p className="text-[10px] text-green-600">Total pagado</p><p className="text-2xl font-bold text-green-700">{fmtCurrency(receiptData.totalPaid)}</p></div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={downloadReceipt} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#010139] text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-[#020270] transition-colors"><FaDownload className="text-xs" /> Descargar Recibo</button>
                <button onClick={handleClose} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm cursor-pointer hover:bg-gray-200 transition-colors">Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
