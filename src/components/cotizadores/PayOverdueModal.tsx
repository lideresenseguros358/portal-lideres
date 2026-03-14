'use client';

import { useState, useCallback } from 'react';
import {
  FaTimes, FaSearch, FaCreditCard,
  FaFileInvoiceDollar, FaSpinner, FaExclamationTriangle,
  FaDownload, FaArrowLeft, FaShieldAlt, FaCheck, FaCheckCircle,
} from 'react-icons/fa';
import CreditCardInput, { type CardData } from '@/components/is/CreditCardInput';

interface OverduePayment {
  id: string;
  amount: number;
  installment_num: number | null;
  payment_date: string;
  status: string;
  recurrence_id: string | null;
}

interface OverduePolicy {
  nro_poliza: string;
  client_name: string;
  insurer: string;
  ramo: string;
  cedula: string;
  payments: OverduePayment[];
  recurrences: Array<{
    id: string;
    total_installments: number;
    frequency: string;
    installment_amount: number;
    schedule: Array<{ num: number; due_date: string; status: string; payment_id: string | null }>;
    pf_cod_oper: string | null;
    pf_rec_cod_oper: string | null;
    status: string;
  }>;
}

type Step = 'cedula' | 'select' | 'card' | 'summary' | 'processing' | 'receipt';

interface Props { isOpen: boolean; onClose: () => void; }

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(d: string) {
  if (!d) return '\u2014';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' });
}
function maskCard(last4: string) { return `**** **** **** ${last4}`; }

export default function PayOverdueModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>('cedula');
  const [cedula, setCedula] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [policies, setPolicies] = useState<OverduePolicy[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [updateCard, setUpdateCard] = useState(false);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [cardError, setCardError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    codOper: string; cardDisplay: string; cardType: string; totalPaid: number;
    paidItems: Array<{ nro_poliza: string; insurer: string; installment_num: number | null; amount: number }>;
    date: string; clientName: string; cedula: string;
  } | null>(null);

  const handleLookup = useCallback(async () => {
    if (!cedula.trim() || cedula.trim().length < 3) { setLookupError('Ingrese un n\u00famero de c\u00e9dula v\u00e1lido'); return; }
    setLookupLoading(true); setLookupError('');
    try {
      const res = await fetch(`/api/public/overdue-payments?cedula=${encodeURIComponent(cedula.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en la b\u00fasqueda');
      if (!json.data || json.data.length === 0) { setLookupError('No se encontraron pagos pendientes para esta c\u00e9dula.'); setLookupLoading(false); return; }
      setPolicies(json.data);
      setStep('select');
    } catch (err: any) { setLookupError(err.message || 'Error de conexi\u00f3n'); }
    setLookupLoading(false);
  }, [cedula]);

  const togglePayment = (id: string) => {
    setSelectedPaymentIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAllForPolicy = (payments: OverduePayment[]) => {
    const allSelected = payments.every((p) => selectedPaymentIds.has(p.id));
    setSelectedPaymentIds((prev) => { const next = new Set(prev); payments.forEach((p) => { if (allSelected) next.delete(p.id); else next.add(p.id); }); return next; });
  };
  const selectedTotal = policies.flatMap((p) => p.payments).filter((p) => selectedPaymentIds.has(p.id)).reduce((sum, p) => sum + p.amount, 0);
  const hasActiveRecurrence = policies.some((p) => p.recurrences.length > 0 && p.payments.some((pay) => selectedPaymentIds.has(pay.id)));

  const processPayment = useCallback(async () => {
    if (!cardData || selectedPaymentIds.size === 0) return;
    setStep('processing'); setProgress(0); setProgressStep('Iniciando procesamiento de pago...'); setProcessingError(null);
    try {
      setProgress(10); setProgressStep('Conectando con procesador de pagos...');
      const selectedPolicies = policies.flatMap((pol) => pol.payments.filter((p) => selectedPaymentIds.has(p.id)).map((p) => ({ ...p, nro_poliza: pol.nro_poliza, insurer: pol.insurer })));
      const clientName = policies[0]?.client_name || 'Cliente';
      const policyNumbers = [...new Set(selectedPolicies.map((p) => p.nro_poliza))].join(', ');

      const chargeRes = await fetch('/api/paguelofacil/charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedTotal, description: `Pago cuotas pendientes - ${policyNumbers}`, concept: `Pago morosidad p\u00f3liza ${policyNumbers}`, cardNumber: cardData.cardNumber, expMonth: cardData.expMonth, expYear: cardData.expYear, cvv: cardData.cvv, cardholderName: cardData.cardName, cardType: cardData.brand, email: 'noreply@lideresenseguros.com' }),
      });
      const chargeJson = await chargeRes.json();
      setProgress(40);
      if (!chargeJson.success) throw new Error(chargeJson.error || 'Error al procesar el pago');

      setProgressStep('Pago aprobado. Registrando en el sistema...'); setProgress(60);
      await fetch('/api/public/overdue-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_payment', payment_ids: [...selectedPaymentIds], pf_cod_oper: chargeJson.codOper, pf_card_type: chargeJson.cardType || cardData.brand, pf_card_display: chargeJson.displayNum || cardData.last4, total_paid: selectedTotal }),
      });
      setProgress(75);

      if (updateCard && hasActiveRecurrence) {
        setProgressStep('Actualizando tarjeta para pagos futuros...');
        const recIds = policies.filter((p) => p.recurrences.length > 0 && p.payments.some((pay) => selectedPaymentIds.has(pay.id))).flatMap((p) => p.recurrences.map((r) => r.id));
        for (const recId of recIds) {
          const rec = policies.flatMap((p) => p.recurrences).find((r) => r.id === recId);
          if (!rec) continue;
          const recRes = await fetch('/api/paguelofacil/recurrent', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codOper: chargeJson.codOper, amount: rec.installment_amount, description: `Recurrencia p\u00f3liza`, concept: 'Pago recurrente de p\u00f3liza', email: 'noreply@lideresenseguros.com', totalInstallments: rec.total_installments }),
          });
          const recJson = await recRes.json();
          await fetch('/api/public/overdue-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_recurrence_card', recurrence_id: recId, pf_cod_oper: chargeJson.codOper, pf_rec_cod_oper: recJson.codOper || null }) });
        }
      }
      setProgress(95); setProgressStep('Generando comprobante...');
      setReceiptData({ codOper: chargeJson.codOper, cardDisplay: chargeJson.displayNum || cardData.last4, cardType: chargeJson.cardType || cardData.brand, totalPaid: selectedTotal, paidItems: selectedPolicies.map((p) => ({ nro_poliza: p.nro_poliza, insurer: p.insurer, installment_num: p.installment_num, amount: p.amount })), date: new Date().toISOString(), clientName, cedula: cedula.trim() });
      setProgress(100); setProgressStep('\u00a1Pago completado!');
      setTimeout(() => setStep('receipt'), 1200);
    } catch (err: any) { setProcessingError(err.message || 'Error inesperado'); }
  }, [cardData, selectedPaymentIds, selectedTotal, policies, cedula, updateCard, hasActiveRecurrence]);

  const downloadReceipt = useCallback(() => {
    if (!receiptData) return;
    const r = receiptData;
    const now = new Date(r.date);
    const dateStr = now.toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const itemsHtml = r.paidItems.map((item) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${item.nro_poliza}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${item.insurer}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.installment_num || '\u2014'}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;">${fmtCurrency(item.amount)}</td></tr>`).join('');
    const html = `<html><head><meta charset="utf-8"><title>Recibo de Pago</title></head><body style="margin:0;padding:40px;font-family:Arial,sans-serif;color:#333;"><div style="max-width:600px;margin:0 auto;"><div style="text-align:center;margin-bottom:30px;"><img src="${window.location.origin}/logo.png" alt="L\u00edderes en Seguros" style="height:60px;margin-bottom:10px;" /><h1 style="color:#010139;font-size:22px;margin:0;">Recibo de Pago</h1><p style="color:#6b7280;font-size:12px;margin:4px 0 0;">L\u00edderes en Seguros, S.A.</p></div><div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;"><table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Fecha:</td><td style="font-weight:600;">${dateStr}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">C\u00f3digo operaci\u00f3n:</td><td style="font-weight:600;font-family:monospace;">${r.codOper}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Cliente:</td><td style="font-weight:600;">${r.clientName}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">C\u00e9dula:</td><td style="font-weight:600;">${r.cedula}</td></tr><tr><td style="color:#6b7280;padding:4px 0;">Tarjeta:</td><td style="font-weight:600;">${r.cardType} ${maskCard(r.cardDisplay)}</td></tr></table></div><table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><thead><tr style="background:#010139;color:white;"><th style="padding:10px 12px;text-align:left;font-size:12px;">P\u00f3liza</th><th style="padding:10px 12px;text-align:left;font-size:12px;">Aseguradora</th><th style="padding:10px 12px;text-align:center;font-size:12px;">Cuota</th><th style="padding:10px 12px;text-align:right;font-size:12px;">Monto</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot><tr style="background:#f0fdf4;"><td colspan="3" style="padding:12px;font-weight:700;font-size:14px;color:#010139;">TOTAL PAGADO</td><td style="padding:12px;text-align:right;font-weight:700;font-size:16px;color:#010139;">${fmtCurrency(r.totalPaid)}</td></tr></tfoot></table><div style="text-align:center;padding:20px 0;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:11px;margin:0;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panam\u00e1 | Licencia PJ750</p><p style="color:#9ca3af;font-size:10px;margin:4px 0 0;">\u00a9 ${now.getFullYear()} L\u00edderes en Seguros, S.A.</p></div></div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  }, [receiptData]);

  const handleClose = () => {
    setStep('cedula'); setCedula(''); setLookupError(''); setPolicies([]); setSelectedPaymentIds(new Set()); setUpdateCard(false); setCardData(null); setCardError(''); setProgress(0); setProgressStep(''); setProcessingError(null); setReceiptData(null); onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {step !== 'processing' && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              {(['select', 'card', 'summary'] as Step[]).includes(step) && (
                <button onClick={() => { if (step === 'select') setStep('cedula'); if (step === 'card') setStep('select'); if (step === 'summary') setStep('card'); }} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><FaArrowLeft className="text-sm" /></button>
              )}
              <div>
                <h2 className="text-base font-bold text-[#010139]">
                  {step === 'cedula' && 'Realiza tu Pago'}{step === 'select' && 'Selecciona tus Cuotas'}{step === 'card' && 'Datos de Tarjeta'}{step === 'summary' && 'Resumen de Pago'}{step === 'receipt' && 'Pago Confirmado'}
                </h2>
                <p className="text-[10px] text-gray-400">
                  {step === 'cedula' && 'Ingresa tu c\u00e9dula para consultar pagos pendientes'}{step === 'select' && 'Selecciona las cuotas que deseas pagar'}{step === 'card' && 'Ingresa los datos de tu tarjeta'}{step === 'summary' && 'Verifica los detalles antes de confirmar'}{step === 'receipt' && 'Tu pago ha sido procesado exitosamente'}
                </p>
              </div>
            </div>
            {step !== 'receipt' && <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><FaTimes /></button>}
          </div>
        )}

        {step !== 'processing' && step !== 'receipt' && (
          <div className="flex gap-1 px-5 pt-3">
            {['cedula', 'select', 'card', 'summary'].map((s, i) => (<div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${['cedula', 'select', 'card', 'summary'].indexOf(step) >= i ? 'bg-[#8AAA19]' : 'bg-gray-200'}`} />))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">

          {step === 'cedula' && (
            <div className="space-y-6">
              <div className="text-center pt-4">
                <div className="w-16 h-16 mx-auto bg-[#010139]/5 rounded-full flex items-center justify-center mb-4"><FaFileInvoiceDollar className="text-2xl text-[#010139]" /></div>
                <p className="text-sm text-gray-600">Consulta y paga tus cuotas pendientes de forma segura.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">N&uacute;mero de C&eacute;dula</label>
                <div className="flex gap-2">
                  <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLookup()} placeholder="Ej: 8-888-8888" className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-colors" autoFocus />
                  <button onClick={handleLookup} disabled={lookupLoading} className="px-5 py-3 bg-[#010139] text-white rounded-xl font-semibold text-sm hover:bg-[#020270] disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-2">
                    {lookupLoading ? <FaSpinner className="animate-spin" /> : <FaSearch />} Buscar
                  </button>
                </div>
                {lookupError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" /> {lookupError}</p>}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 justify-center"><FaShieldAlt /> Pago seguro procesado por PagueloF&aacute;cil</div>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              {policies.map((pol) => (
                <div key={pol.nro_poliza} className="border-2 border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#010139]">P&oacute;liza {pol.nro_poliza}</p>
                      <p className="text-[10px] text-gray-500">{pol.insurer} &middot; {pol.ramo} &middot; {pol.client_name}</p>
                    </div>
                    <button onClick={() => toggleAllForPolicy(pol.payments)} className="text-[10px] text-[#8AAA19] font-bold cursor-pointer hover:underline">
                      {pol.payments.every((p) => selectedPaymentIds.has(p.id)) ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {pol.payments.map((pay) => (
                      <label key={pay.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedPaymentIds.has(pay.id)} onChange={() => togglePayment(pay.id)} className="w-4 h-4 accent-[#8AAA19] cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-800">Cuota {pay.installment_num || '—'}</span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{pay.status === 'PENDIENTE_CONFIRMACION' ? 'Vencida' : 'Pendiente'}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">Fecha: {fmtDate(pay.payment_date)}</span>
                        </div>
                        <span className="text-sm font-bold text-[#010139]">{fmtCurrency(pay.amount)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {hasActiveRecurrence && (
                <label className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer">
                  <input type="checkbox" checked={updateCard} onChange={(e) => setUpdateCard(e.target.checked)} className="w-4 h-4 accent-[#010139] mt-0.5 cursor-pointer" />
                  <div>
                    <p className="text-xs font-bold text-[#010139]">&iquest;Desea registrar esta tarjeta para el resto de las cuotas pendientes?</p>
                    <p className="text-[10px] text-gray-500 mt-1">Los pagos futuros se cobrar&aacute;n autom&aacute;ticamente a la nueva tarjeta.</p>
                  </div>
                </label>
              )}

              <div className="flex items-center justify-between bg-[#010139] text-white rounded-xl px-5 py-4">
                <div><p className="text-[10px] text-gray-300">Total seleccionado</p><p className="text-xl font-bold">{fmtCurrency(selectedTotal)}</p></div>
                <button onClick={() => { if (selectedPaymentIds.size > 0) setStep('card'); }} disabled={selectedPaymentIds.size === 0} className="px-6 py-2.5 bg-[#8AAA19] text-white rounded-lg font-bold text-sm disabled:opacity-40 cursor-pointer hover:bg-[#6d8814] transition-colors">Siguiente</button>
              </div>
            </div>
          )}

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

          {step === 'summary' && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Datos del Cliente</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Nombre:</span> <span className="font-semibold text-gray-800">{policies[0]?.client_name}</span></div>
                  <div><span className="text-gray-400">C&eacute;dula:</span> <span className="font-semibold text-gray-800">{cedula}</span></div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cuotas a Pagar</p>
                {policies.map((pol) => {
                  const selPays = pol.payments.filter((p) => selectedPaymentIds.has(p.id));
                  if (selPays.length === 0) return null;
                  return (
                    <div key={pol.nro_poliza} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2"><p className="text-[11px] font-bold text-[#010139]">P&oacute;liza {pol.nro_poliza} &middot; {pol.insurer}</p></div>
                      {selPays.map((p) => (
                        <div key={p.id} className="flex justify-between px-3 py-2 text-xs border-t border-gray-50">
                          <span className="text-gray-600">Cuota {p.installment_num || '—'} ({fmtDate(p.payment_date)})</span>
                          <span className="font-bold text-gray-800">{fmtCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {cardData && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                  <FaCreditCard className="text-lg text-[#010139]" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{cardData.brand} {maskCard(cardData.last4)}</p>
                    <p className="text-[10px] text-gray-400">{cardData.cardName}</p>
                  </div>
                </div>
              )}

              {updateCard && <div className="bg-blue-50 rounded-lg px-4 py-2 text-[10px] text-blue-700 font-semibold flex items-center gap-2"><FaCheck className="text-[8px]" /> Se registrar&aacute; esta tarjeta para los pagos futuros.</div>}

              <div className="bg-[#010139] text-white rounded-xl px-5 py-4 flex items-center justify-between">
                <div><p className="text-[10px] text-gray-300">Total a pagar</p><p className="text-2xl font-bold">{fmtCurrency(selectedTotal)}</p></div>
                <button onClick={processPayment} className="px-8 py-3 bg-[#8AAA19] text-white rounded-lg font-bold text-sm cursor-pointer hover:bg-[#6d8814] transition-colors shadow-lg">Pagar</button>
              </div>
            </div>
          )}

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

          {step === 'receipt' && receiptData && (
            <div className="space-y-5">
              <div className="text-center pt-2">
                <div className="w-20 h-20 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4"><FaCheckCircle className="text-4xl text-green-500" /></div>
                <h3 className="text-xl font-bold text-[#010139]">&iexcl;Pago Exitoso!</h3>
                <p className="text-sm text-gray-500 mt-1">Tu pago ha sido procesado correctamente.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Fecha:</span><span className="font-semibold">{new Date(receiptData.date).toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">C&oacute;digo:</span><span className="font-mono font-semibold">{receiptData.codOper}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cliente:</span><span className="font-semibold">{receiptData.clientName}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Tarjeta:</span><span className="font-semibold">{receiptData.cardType} {maskCard(receiptData.cardDisplay)}</span></div>
              </div>

              <div className="space-y-1">
                {receiptData.paidItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs">
                    <div><span className="font-semibold text-gray-800">{item.nro_poliza}</span> <span className="text-gray-400">&middot; {item.insurer} &middot; Cuota {item.installment_num || '—'}</span></div>
                    <span className="font-bold text-[#010139]">{fmtCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

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
