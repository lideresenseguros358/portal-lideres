'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaFilePdf,
  FaFileExcel,
  FaDownload,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaClock,
  FaSync,
  FaTimes,
  FaFilter,
} from 'react-icons/fa';
import { useDateRange } from '@/hooks/useAdmCot';
import {
  maskIp,
  maskCedula,
  maskEmail,
  maskPhone,
  maskName,
} from '@/types/adm-cot.types';
import type { AdmCotQuote, QuoteStatus } from '@/types/adm-cot.types';

// ════════════════════════════════════════════
// STATUS BADGE
// ════════════════════════════════════════════

function StatusBadge({ status }: { status: QuoteStatus }) {
  const map: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    COTIZADA: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Cotizada', icon: <FaClock className="text-[8px]" /> },
    EMITIDA: { bg: 'bg-green-100', text: 'text-green-800', label: 'Emitida', icon: <FaCheckCircle className="text-[8px]" /> },
    FALLIDA: { bg: 'bg-red-100', text: 'text-red-800', label: 'Fallida', icon: <FaTimesCircle className="text-[8px]" /> },
    ABANDONADA: { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Abandonada', icon: <FaExclamationTriangle className="text-[8px]" /> },
  };
  const s = map[status] ?? map['COTIZADA']!;
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ════════════════════════════════════════════
// INDIVIDUAL QUOTE PDF DOWNLOAD
// ════════════════════════════════════════════

async function downloadQuotePdf(q: AdmCotQuote) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(1, 1, 57);
  doc.rect(0, 0, w, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('COTIZACIÓN', 14, 15);
  doc.setFontSize(10);
  doc.text(q.quote_ref, 14, 23);
  doc.text(q.insurer + ' — ' + q.ramo, w - 14, 15, { align: 'right' });
  doc.text(new Date(q.quoted_at).toLocaleString('es-PA'), w - 14, 23, { align: 'right' });

  // Body
  doc.setTextColor(0, 0, 0);
  let y = 42;

  const addField = (label: string, value: string) => {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label, 14, y);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(value || '—', 70, y);
    y += 7;
  };

  doc.setFontSize(12);
  doc.setTextColor(1, 1, 57);
  doc.text('Datos del Cliente', 14, y); y += 8;

  addField('Nombre:', q.client_name);
  addField('Cédula:', q.cedula || '—');
  addField('Email:', q.email || '—');
  addField('Teléfono:', q.phone || '—');
  y += 4;

  doc.setFontSize(12);
  doc.setTextColor(1, 1, 57);
  doc.text('Detalle de Cotización', 14, y); y += 8;

  addField('Estado:', q.status);
  addField('Aseguradora:', q.insurer);
  addField('Ramo:', q.ramo);
  addField('Cobertura:', q.coverage_type || '—');
  addField('Plan:', q.plan_name || '—');
  addField('Prima Anual:', q.annual_premium ? `$${Number(q.annual_premium).toFixed(2)}` : '—');
  y += 4;

  if (q.vehicle_info) {
    doc.setFontSize(12);
    doc.setTextColor(1, 1, 57);
    doc.text('Vehículo', 14, y); y += 8;
    Object.entries(q.vehicle_info).forEach(([k, v]) => { addField(k + ':', String(v)); });
    y += 4;
  }

  if (q.status === 'EMITIDA' && q.quote_payload) {
    doc.setFontSize(12);
    doc.setTextColor(1, 1, 57);
    doc.text('Información de Emisión', 14, y); y += 8;
    addField('Nro. Póliza:', (q.quote_payload as any).nro_poliza || '—');
    addField('Fecha Emisión:', q.emitted_at ? new Date(q.emitted_at).toLocaleString('es-PA') : '—');
    if (q.quoted_at && q.emitted_at) {
      const diffMs = new Date(q.emitted_at).getTime() - new Date(q.quoted_at).getTime();
      const diffMin = Math.round(diffMs / 60000);
      addField('Tiempo:', diffMin + ' minutos');
    }
    y += 4;
  }

  if (q.steps_log && q.steps_log.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(1, 1, 57);
    doc.text('Funnel de Pasos', 14, y); y += 8;
    q.steps_log.forEach((s) => {
      addField(s.step + ':', new Date(s.ts).toLocaleString('es-PA'));
    });
    y += 4;
  }

  // Footer
  const fh = doc.internal.pageSize.getHeight();
  doc.setDrawColor(138, 170, 25);
  doc.line(14, fh - 25, w - 14, fh - 25);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`IP: ${q.ip_address || '—'} | Región: ${q.region || '—'} | Dispositivo: ${q.device || '—'}`, 14, fh - 19);
  doc.text(`Timestamp: ${new Date(q.quoted_at).toISOString()} | Ambiente: ${process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'}`, 14, fh - 14);
  doc.text(`ID: ${q.id} | Ref: ${q.quote_ref}`, 14, fh - 9);

  doc.save(`cotizacion-${q.quote_ref}.pdf`);
}

// ════════════════════════════════════════════
// ENTERPRISE PDF EXPORT
// ════════════════════════════════════════════

async function exportExecutivePdf(rows: AdmCotQuote[], filtersDesc: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(1, 1, 57);
  doc.rect(0, 0, w, 24, 'F');
  doc.setDrawColor(138, 170, 25);
  doc.setLineWidth(1.5);
  doc.line(0, 24, w, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('ADM COT — Log General de Cotizaciones', 14, 12);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleString('es-PA')} | Ambiente: ${process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'}`, 14, 20);

  // Summary
  let y = 32;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Filtros: ${filtersDesc || 'Ninguno'}`, 14, y); y += 5;
  const total = rows.length;
  const emitidas = rows.filter(r => r.status === 'EMITIDA').length;
  const fallidas = rows.filter(r => r.status === 'FALLIDA').length;
  const abandonadas = rows.filter(r => r.status === 'ABANDONADA').length;
  doc.text(`Total: ${total} | Emitidas: ${emitidas} | Fallidas: ${fallidas} | Abandonadas: ${abandonadas}`, 14, y); y += 8;

  // Table — show FULL data (unmasked) in export
  const tableData = rows.map(r => [
    r.quote_ref,
    new Date(r.quoted_at).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }),
    r.client_name,
    r.cedula || '',
    r.insurer,
    r.ramo,
    r.status,
    r.ip_address || '',
    r.region || '',
    r.device || '',
    r.annual_premium ? `$${Number(r.annual_premium).toFixed(2)}` : '',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { top: 32, bottom: 20, left: 8, right: 8 },
    head: [['Ref', 'Fecha', 'Nombre', 'Cédula', 'Aseg.', 'Ramo', 'Estado', 'IP', 'Región', 'Disp.', 'Prima']],
    body: tableData,
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    headStyles: { fillColor: [1, 1, 57], textColor: 255, fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didDrawPage: (data: any) => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${data.pageNumber}`, w - 20, h - 8);
    },
  });

  doc.save('adm-cot-cotizaciones-ejecutivo.pdf');
}

// ════════════════════════════════════════════
// ENTERPRISE EXCEL EXPORT
// ════════════════════════════════════════════

async function exportMultiSheetExcel(rows: AdmCotQuote[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const emitidas = rows.filter(r => r.status === 'EMITIDA');
  const fallidas = rows.filter(r => r.status === 'FALLIDA');
  const abandonadas = rows.filter(r => r.status === 'ABANDONADA');
  const cotizadas = rows.filter(r => r.status === 'COTIZADA');
  const summaryData = [
    { Metrica: 'Total Registros', Valor: rows.length },
    { Metrica: 'Cotizadas', Valor: cotizadas.length },
    { Metrica: 'Emitidas', Valor: emitidas.length },
    { Metrica: 'Fallidas', Valor: fallidas.length },
    { Metrica: 'Abandonadas', Valor: abandonadas.length },
    { Metrica: 'Conversión %', Valor: rows.length > 0 ? ((emitidas.length / rows.length) * 100).toFixed(1) + '%' : '0%' },
    { Metrica: 'Generado', Valor: new Date().toLocaleString('es-PA') },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Resumen');

  // Full data — UNMASKED
  const mapRow = (r: AdmCotQuote) => ({
    Referencia: r.quote_ref,
    Fecha: new Date(r.quoted_at).toLocaleString('es-PA'),
    Nombre: r.client_name,
    Cedula: r.cedula || '',
    Email: r.email || '',
    Telefono: r.phone || '',
    Aseguradora: r.insurer,
    Ramo: r.ramo,
    Estado: r.status,
    Cobertura: r.coverage_type || '',
    Plan: r.plan_name || '',
    'Prima Anual': r.annual_premium ? Number(r.annual_premium) : '',
    IP: r.ip_address || '',
    Region: r.region || '',
    Dispositivo: r.device || '',
    'Último Step': r.last_step || '',
    'Emitida En': r.emitted_at ? new Date(r.emitted_at).toLocaleString('es-PA') : '',
    'Nro Póliza': (r.quote_payload as any)?.nro_poliza || '',
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(mapRow)), 'Cotizaciones');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emitidas.map(mapRow)), 'Emisiones');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fallidas.map(mapRow)), 'Fallidas');

  // Funnel breakdown
  const stepMap: Record<string, number> = {};
  rows.forEach(r => { const s = r.last_step || 'inicio'; stepMap[s] = (stepMap[s] || 0) + 1; });
  const funnelData = Object.entries(stepMap).map(([step, count]) => ({ Step: step, Cantidad: count, Porcentaje: ((count / rows.length) * 100).toFixed(1) + '%' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(funnelData), 'Funnel');

  // By Insurer
  const insurerMap: Record<string, { total: number; emitidas: number }> = {};
  rows.forEach(r => {
    if (!insurerMap[r.insurer]) insurerMap[r.insurer] = { total: 0, emitidas: 0 };
    insurerMap[r.insurer]!.total++;
    if (r.status === 'EMITIDA') insurerMap[r.insurer]!.emitidas++;
  });
  const insurerData = Object.entries(insurerMap).map(([ins, v]) => ({ Aseguradora: ins, Total: v.total, Emitidas: v.emitidas, 'Conversión %': v.total > 0 ? ((v.emitidas / v.total) * 100).toFixed(1) + '%' : '0%' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(insurerData), 'Por Aseguradora');

  // By Region
  const regionMap: Record<string, number> = {};
  rows.forEach(r => { const rg = r.region || 'Desconocida'; regionMap[rg] = (regionMap[rg] || 0) + 1; });
  const regionData = Object.entries(regionMap).map(([region, count]) => ({ Region: region, Cantidad: count }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regionData), 'Por Región');

  XLSX.writeFile(wb, 'adm-cot-cotizaciones.xlsx');
}

// ════════════════════════════════════════════
// EXPANDABLE AUDIT ROW
// ════════════════════════════════════════════

function AuditRow({ quote }: { quote: AdmCotQuote }) {
  const [expanded, setExpanded] = useState(false);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtFull = (d: string) => new Date(d).toLocaleString('es-PA');

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 px-2 w-7">
          {expanded
            ? <FaChevronUp className="text-[#010139] text-[10px]" />
            : <FaChevronDown className="text-gray-400 text-[10px] group-hover:text-[#010139]" />}
        </td>
        <td className="py-2 px-2 text-[11px] font-mono text-[#010139] font-semibold whitespace-nowrap">{quote.quote_ref}</td>
        <td className="py-2 px-2 text-[11px] text-gray-500 whitespace-nowrap">{fmtDate(quote.quoted_at)}</td>
        <td className="py-2 px-2 text-[11px] text-gray-500 whitespace-nowrap">{fmtTime(quote.quoted_at)}</td>
        <td className="py-2 px-2 text-[11px] font-medium text-gray-700">{maskName(quote.client_name)}</td>
        <td className="py-2 px-2 text-[11px] text-gray-500">{maskCedula(quote.cedula)}</td>
        <td className="py-2 px-2 text-[11px] text-gray-600">{quote.insurer}</td>
        <td className="py-2 px-2 text-[11px] text-gray-600">{quote.ramo}</td>
        <td className="py-2 px-2"><StatusBadge status={quote.status} /></td>
        <td className="py-2 px-2 text-[11px] text-gray-500">{quote.region || '—'}</td>
        <td className="py-2 px-2 text-[11px] text-gray-500">{quote.device || '—'}</td>
        <td className="py-2 px-2 text-[11px] text-gray-400 font-mono">{maskIp(quote.ip_address)}</td>
      </tr>
      {expanded && (
        <tr className="bg-gradient-to-b from-blue-50/50 to-white">
          <td colSpan={12} className="p-0">
            <div className="p-4 space-y-4">
              {/* ─── A. FULL UNMASKED DATA ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Datos Completos</h4>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <p><span className="font-medium text-gray-500">Nombre:</span> {quote.client_name}</p>
                    <p><span className="font-medium text-gray-500">Cédula:</span> {quote.cedula || '—'}</p>
                    <p><span className="font-medium text-gray-500">Email:</span> {quote.email || '—'}</p>
                    <p><span className="font-medium text-gray-500">Teléfono:</span> {quote.phone || '—'}</p>
                    <p><span className="font-medium text-gray-500">IP:</span> <span className="font-mono">{quote.ip_address || '—'}</span></p>
                    <p><span className="font-medium text-gray-500">User Agent:</span> <span className="text-[10px] break-all">{quote.user_agent || '—'}</span></p>
                    <p><span className="font-medium text-gray-500">Región:</span> {quote.region || '—'}</p>
                    <p><span className="font-medium text-gray-500">Timestamp:</span> {fmtFull(quote.quoted_at)}</p>
                    <p><span className="font-medium text-gray-500">Ambiente:</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${process.env.NODE_ENV === 'production' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* ─── B. EMISSION INFO ─── */}
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Emisión</h4>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    {quote.status === 'EMITIDA' ? (
                      <>
                        <p><span className="font-medium text-gray-500">Nro. Póliza:</span> {(quote.quote_payload as any)?.nro_poliza || '—'}</p>
                        <p><span className="font-medium text-gray-500">Fecha Emisión:</span> {quote.emitted_at ? fmtFull(quote.emitted_at) : '—'}</p>
                        {quote.quoted_at && quote.emitted_at && (
                          <p><span className="font-medium text-gray-500">Tiempo:</span> {Math.round((new Date(quote.emitted_at).getTime() - new Date(quote.quoted_at).getTime()) / 60000)} min</p>
                        )}
                        <p><span className="font-medium text-gray-500">Pago:</span> {(quote.quote_payload as any)?.payment_confirmed ? 'Confirmado' : 'Pendiente'}</p>
                      </>
                    ) : quote.status === 'FALLIDA' ? (
                      <>
                        <p className="text-red-600 font-medium">Emisión Fallida</p>
                        <p><span className="font-medium text-gray-500">Error:</span> {(quote.quote_payload as any)?.error_message || '—'}</p>
                        <p><span className="font-medium text-gray-500">Endpoint:</span> {(quote.quote_payload as any)?.error_endpoint || '—'}</p>
                      </>
                    ) : (
                      <p className="text-gray-400 italic">Sin emisión</p>
                    )}
                  </div>
                </div>

                {/* ─── COTIZACIÓN DETAIL ─── */}
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Cotización</h4>
                  <div className="space-y-1.5 text-xs text-gray-700">
                    <p><span className="font-medium text-gray-500">Cobertura:</span> {quote.coverage_type || '—'}</p>
                    <p><span className="font-medium text-gray-500">Plan:</span> {quote.plan_name || '—'}</p>
                    <p><span className="font-medium text-gray-500">Prima:</span> {quote.annual_premium ? `$${Number(quote.annual_premium).toFixed(2)}` : '—'}</p>
                    {quote.vehicle_info && Object.entries(quote.vehicle_info).map(([k, v]) => (
                      <p key={k}><span className="font-medium text-gray-500 capitalize">{k}:</span> {String(v)}</p>
                    ))}
                  </div>
                </div>

                {/* ─── C. FUNNEL ─── */}
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Funnel</h4>
                  {quote.steps_log && quote.steps_log.length > 0 ? (
                    <div className="space-y-1">
                      {quote.steps_log.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#010139] flex-shrink-0" />
                          <span className="font-medium text-gray-700">{s.step}</span>
                          <span className="text-gray-400 text-[10px]">{new Date(s.ts).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      ))}
                      {quote.status === 'ABANDONADA' && (
                        <p className="text-red-500 text-[10px] font-medium mt-1">Abandonado en: {quote.last_step}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs italic">Sin historial de pasos</p>
                  )}
                </div>
              </div>

              {/* ─── D. DOWNLOAD BUTTON ─── */}
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadQuotePdf(quote); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg hover:bg-[#020270] transition-colors cursor-pointer"
                >
                  <FaDownload className="text-white" /> Descargar Cotización Original (PDF)
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function AdmCotCotizaciones() {
  const { preset, dateFrom, dateTo, applyPreset, setDateFrom, setDateTo } = useDateRange();

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [insurer, setInsurer] = useState('');
  const [ramo, setRamo] = useState('');
  const [status, setStatus] = useState('');
  const [region, setRegion] = useState('');
  const [device, setDevice] = useState('');
  const [quoteRef, setQuoteRef] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Data state
  const [quotes, setQuotes] = useState<AdmCotQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 50;
  const loadingRef = useRef(false);

  const fetchQuotes = useCallback(async (newPage = 1) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(newPage));
      params.set('pageSize', String(PAGE_SIZE));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (insurer) params.set('insurer', insurer);
      if (ramo) params.set('ramo', ramo);
      if (status) params.set('status', status);
      if (region) params.set('region', region);
      if (device) params.set('device', device);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (quoteRef.trim()) params.set('quoteRef', quoteRef.trim());
      if (policyNumber.trim()) params.set('policyNumber', policyNumber.trim());

      const res = await fetch(`/api/adm-cot/cotizaciones?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuotes(json.data.rows);
        setTotal(json.data.total);
        setPage(newPage);
      } else {
        setError(json.error || 'Error cargando datos');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [dateFrom, dateTo, insurer, ramo, status, region, device, searchTerm, quoteRef, policyNumber]);

  useEffect(() => { fetchQuotes(1); }, [fetchQuotes]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('export', 'true');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (insurer) params.set('insurer', insurer);
      if (ramo) params.set('ramo', ramo);
      if (status) params.set('status', status);
      if (region) params.set('region', region);
      if (device) params.set('device', device);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/adm-cot/cotizaciones?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const filtersDesc = [
          dateFrom && `Desde: ${dateFrom}`,
          dateTo && `Hasta: ${dateTo}`,
          insurer && `Aseg: ${insurer}`,
          ramo && `Ramo: ${ramo}`,
          status && `Estado: ${status}`,
        ].filter(Boolean).join(' | ');
        await exportExecutivePdf(json.data.rows, filtersDesc);
      }
    } catch (e: any) { console.error(e); }
    finally { setExporting(false); }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('export', 'true');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (insurer) params.set('insurer', insurer);
      if (ramo) params.set('ramo', ramo);
      if (status) params.set('status', status);
      if (region) params.set('region', region);
      if (device) params.set('device', device);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/adm-cot/cotizaciones?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        await exportMultiSheetExcel(json.data.rows);
      }
    } catch (e: any) { console.error(e); }
    finally { setExporting(false); }
  };

  const resetFilters = () => {
    setSearchTerm(''); setInsurer(''); setRamo(''); setStatus('');
    setRegion(''); setDevice(''); setQuoteRef(''); setPolicyNumber('');
    applyPreset('month');
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#010139]">Log General de Cotizaciones</h2>
          <p className="text-xs text-gray-500">Fuente oficial de auditoría — Retención mínima: 3 años — {total.toLocaleString()} registros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPdf} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50">
            <FaFilePdf className="text-white" /> <span className="text-white">PDF Ejecutivo</span>
          </button>
          <button onClick={handleExportExcel} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50">
            <FaFileExcel className="text-white" /> <span className="text-white">Excel Multi-hoja</span>
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Global search */}
          <div className="relative flex-1 min-w-[200px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input type="text" placeholder="Buscar nombre, cédula, email, referencia, IP..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139]/20 focus:border-[#010139] outline-none" />
          </div>

          {/* Date presets */}
          <div className="flex gap-1">
            {(['today', 'week', 'month', '3months', 'year'] as const).map((p) => (
              <button key={p} onClick={() => applyPreset(p)}
                className={`px-2.5 py-1.5 text-[10px] rounded-lg font-medium transition-colors cursor-pointer ${
                  preset === p ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p === 'today' ? 'Hoy' : p === 'week' ? '7d' : p === 'month' ? '30d' : p === '3months' ? '90d' : 'Año'}
              </button>
            ))}
          </div>

          {/* Custom dates */}
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); applyPreset('custom'); }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); applyPreset('custom'); }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" />

          <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="">Aseguradora</option>
            <option value="INTERNACIONAL">Internacional</option>
            <option value="FEDPA">FEDPA</option>
          </select>

          <select value={ramo} onChange={(e) => setRamo(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="">Ramo</option>
            <option value="AUTO">Auto</option>
            <option value="SALUD">Salud</option>
            <option value="VIDA">Vida</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
            <option value="">Estado</option>
            <option value="COTIZADA">Cotizada</option>
            <option value="EMITIDA">Emitida</option>
            <option value="FALLIDA">Fallida</option>
            <option value="ABANDONADA">Abandonada</option>
          </select>

          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-gray-500 hover:text-[#010139] flex items-center gap-1 cursor-pointer">
            <FaFilter className="text-[10px]" /> {showAdvanced ? 'Menos' : 'Más'}
          </button>

          <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"><FaTimes /></button>

          <button onClick={() => fetchQuotes(1)} disabled={loading}
            className="px-3 py-1.5 bg-[#010139] text-white text-xs font-medium rounded-lg hover:bg-[#020270] transition-colors flex items-center gap-1.5 cursor-pointer">
            <FaSync className={`text-white ${loading ? 'animate-spin' : ''}`} /> <span className="text-white">Buscar</span>
          </button>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
              <option value="">Región</option>
              <option value="Panamá">Panamá</option>
              <option value="Panamá Oeste">Panamá Oeste</option>
              <option value="Colón">Colón</option>
              <option value="Chiriquí">Chiriquí</option>
              <option value="Coclé">Coclé</option>
              <option value="Veraguas">Veraguas</option>
            </select>

            <select value={device} onChange={(e) => setDevice(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5">
              <option value="">Dispositivo</option>
              <option value="Windows">Windows</option>
              <option value="macOS">macOS</option>
              <option value="iOS">iOS</option>
              <option value="Android">Android</option>
              <option value="Linux">Linux</option>
            </select>

            <input type="text" placeholder="ID Cotización" value={quoteRef} onChange={(e) => setQuoteRef(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-36" />

            <input type="text" placeholder="Nro. Póliza" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 w-36" />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <FaTimesCircle className="inline mr-2" /> {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2 px-2 w-7"></th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">ID Cotización</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Hora</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Cédula</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Aseg.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Ramo</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Estado</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Región</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">Disp.</th>
                <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && quotes.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center text-gray-400">
                  <FaSync className="animate-spin text-2xl mx-auto mb-2" />
                  <p className="text-sm">Cargando cotizaciones...</p>
                </td></tr>
              ) : quotes.length === 0 ? (
                <tr><td colSpan={12} className="py-16 text-center">
                  <FaSearch className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No se encontraron cotizaciones</p>
                  <p className="text-xs text-gray-400 mt-1">Ajusta los filtros o espera nuevas cotizaciones</p>
                </td></tr>
              ) : (
                quotes.map((q) => <AuditRow key={q.id} quote={q} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchQuotes(1)} disabled={page === 1 || loading}
                className="px-2 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">«</button>
              <button onClick={() => fetchQuotes(page - 1)} disabled={page === 1 || loading}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Anterior</button>
              <span className="px-3 py-1 text-xs text-gray-600 font-medium">{page} / {totalPages}</span>
              <button onClick={() => fetchQuotes(page + 1)} disabled={page === totalPages || loading}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Siguiente</button>
              <button onClick={() => fetchQuotes(totalPages)} disabled={page === totalPages || loading}
                className="px-2 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
