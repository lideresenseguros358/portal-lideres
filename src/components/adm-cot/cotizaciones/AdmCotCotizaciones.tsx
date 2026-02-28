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
// DOWNLOAD FORMAT MODAL
// ════════════════════════════════════════════

function DownloadModal({ onClose, onPdf, onExcel, exporting }: { onClose: () => void; onPdf: () => void; onExcel: () => void; exporting: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#010139]">Descargar Reporte</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><FaTimes /></button>
        </div>
        <div className="space-y-2">
          <button onClick={onPdf} disabled={exporting}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50">
            <FaFilePdf className="text-red-600 text-lg" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">PDF Ejecutivo</p>
              <p className="text-[10px] text-gray-500">Reporte con tabla resumida</p>
            </div>
          </button>
          <button onClick={onExcel} disabled={exporting}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-colors cursor-pointer disabled:opacity-50">
            <FaFileExcel className="text-green-600 text-lg" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">Excel Multi-hoja</p>
              <p className="text-[10px] text-gray-500">Datos completos + funnel + por aseguradora</p>
            </div>
          </button>
        </div>
        {exporting && <p className="text-xs text-center text-gray-500">Generando archivo...</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// FETCH RELATED QUOTES FOR A CLIENT
// ════════════════════════════════════════════

async function fetchRelatedQuotes(q: AdmCotQuote): Promise<AdmCotQuote[]> {
  // Find all quotes for same client (by cedula) on the same day
  if (!q.cedula) return [q]; // No cedula? just return this one
  const quotedDate = q.quoted_at.slice(0, 10); // YYYY-MM-DD
  try {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');
    params.set('dateFrom', quotedDate);
    params.set('dateTo', quotedDate);
    const res = await fetch(`/api/adm-cot/cotizaciones?${params.toString()}`);
    const json = await res.json();
    if (!json.success) return [q];
    // Filter by same cedula
    const all: AdmCotQuote[] = json.data.rows;
    const related = all.filter(r => r.cedula === q.cedula);
    return related.length > 0 ? related : [q];
  } catch { return [q]; }
}

// ════════════════════════════════════════════
// COMPREHENSIVE CLIENT SUMMARY PDF
// ════════════════════════════════════════════

async function downloadClientSummaryPdf(q: AdmCotQuote) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Fetch all related quotes for this client
  const allQuotes = await fetchRelatedQuotes(q);

  const doc = new jsPDF('portrait', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 14;
  const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('es-PA');

  // ── HEADER BAR ──
  doc.setFillColor(1, 1, 57);
  doc.rect(0, 0, w, 28, 'F');
  doc.setDrawColor(138, 170, 25);
  doc.setLineWidth(1.5);
  doc.line(0, 28, w, 28);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('RESUMEN DE COTIZACIONES', margin, 12);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleString('es-PA')} | Líderes en Seguros, S.A.`, margin, 22);
  doc.text(`${allQuotes.length} cotización(es) encontrada(s)`, w - margin, 22, { align: 'right' });

  let y = 36;

  // ── SECTION: CLIENT INFO ──
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, w - margin * 2, 32, 'F');
  doc.setDrawColor(1, 1, 57);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, w - margin * 2, 32, 'S');

  doc.setFontSize(9);
  doc.setTextColor(1, 1, 57);
  doc.text('DATOS DEL CLIENTE', margin + 4, y + 7);

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const col2 = margin + (w - margin * 2) * 0.5;
  doc.text(`Nombre: ${q.client_name}`, margin + 4, y + 15);
  doc.text(`Cédula: ${q.cedula || '—'}`, margin + 4, y + 22);
  doc.text(`Email: ${q.email || '—'}`, col2, y + 15);
  doc.text(`Teléfono: ${q.phone || '—'}`, col2, y + 22);
  doc.text(`Fecha: ${fmtDate(q.quoted_at)}`, margin + 4, y + 29);
  doc.text(`Región: ${q.region || '—'} | Dispositivo: ${q.device || '—'}`, col2, y + 29);

  y += 38;

  // ── SECTION: VEHICLE INFO (if available) ──
  const vehicleQuote = allQuotes.find(r => r.vehicle_info && Object.keys(r.vehicle_info).length > 0);
  if (vehicleQuote?.vehicle_info) {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, w - margin * 2, 18, 'F');
    doc.setDrawColor(1, 1, 57);
    doc.rect(margin, y, w - margin * 2, 18, 'S');

    doc.setFontSize(9);
    doc.setTextColor(1, 1, 57);
    doc.text('VEHÍCULO', margin + 4, y + 7);

    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const vi = vehicleQuote.vehicle_info;
    const vehicleStr = [vi.marca, vi.modelo, vi.anio].filter(Boolean).join(' ');
    const valorStr = vi.valor ? ` — Valor: ${fmtMoney(Number(vi.valor))}` : '';
    doc.text(`${vehicleStr}${valorStr}`, margin + 4, y + 14);

    y += 24;
  }

  // ── SECTION: ALL QUOTES TABLE ──
  doc.setFontSize(11);
  doc.setTextColor(1, 1, 57);
  doc.text('COTIZACIONES REALIZADAS', margin, y + 4);
  y += 8;

  // Group by insurer
  const byInsurer: Record<string, AdmCotQuote[]> = {};
  allQuotes.forEach(r => {
    if (!byInsurer[r.insurer]) byInsurer[r.insurer] = [];
    byInsurer[r.insurer]!.push(r);
  });

  // Sort each group: emitted first, then by premium descending
  Object.values(byInsurer).forEach(arr => arr.sort((a, b) => {
    if (a.status === 'EMITIDA' && b.status !== 'EMITIDA') return -1;
    if (b.status === 'EMITIDA' && a.status !== 'EMITIDA') return 1;
    return (Number(b.annual_premium) || 0) - (Number(a.annual_premium) || 0);
  }));

  // Build table data
  const tableBody: any[][] = [];
  for (const [insurerName, quotes] of Object.entries(byInsurer)) {
    quotes.forEach(r => {
      const isEmitted = r.status === 'EMITIDA';
      const selectedMark = isEmitted ? '✓ SELECCIONADO' : '';
      tableBody.push([
        insurerName,
        r.plan_name || '—',
        r.coverage_type || r.ramo || '—',
        r.annual_premium ? fmtMoney(Number(r.annual_premium)) : '—',
        r.status,
        selectedMark,
      ]);
    });
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Aseguradora', 'Plan', 'Cobertura', 'Prima Anual', 'Estado', '']],
    body: tableBody,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [1, 1, 57], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      3: { halign: 'right', fontStyle: 'bold' },
      5: { textColor: [138, 170, 25], fontStyle: 'bold', cellWidth: 30 },
    },
    didParseCell: (data: any) => {
      // Highlight emitted row with green background
      if (data.section === 'body' && data.row.raw) {
        const statusCell = data.row.raw[4];
        if (statusCell === 'EMITIDA') {
          data.cell.styles.fillColor = [232, 245, 215]; // light green
        }
      }
    },
    didDrawPage: (data: any) => {
      // Footer on every page
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${data.pageNumber}`, w - margin, h - 8, { align: 'right' });
      doc.text('Líderes en Seguros, S.A. — Documento generado automáticamente', margin, h - 8);
    },
  });

  y = (doc as any).lastAutoTable?.finalY || y + 40;
  y += 6;

  // ── SECTION: EMISSION DETAIL (if any emitted) ──
  const emittedQuote = allQuotes.find(r => r.status === 'EMITIDA');
  if (emittedQuote) {
    if (y > h - 60) { doc.addPage(); y = 20; }

    doc.setFillColor(232, 245, 215);
    doc.rect(margin, y, w - margin * 2, 28, 'F');
    doc.setDrawColor(138, 170, 25);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, w - margin * 2, 28, 'S');

    doc.setFontSize(9);
    doc.setTextColor(1, 1, 57);
    doc.text('PLAN SELECCIONADO — EMISIÓN EXITOSA', margin + 4, y + 7);

    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const nroPol = (emittedQuote.quote_payload as any)?.nro_poliza || '—';
    doc.text(`Aseguradora: ${emittedQuote.insurer} — Plan: ${emittedQuote.plan_name || '—'}`, margin + 4, y + 15);
    doc.text(`Nro. Póliza: ${nroPol}`, margin + 4, y + 22);

    const primaStr = emittedQuote.annual_premium ? fmtMoney(Number(emittedQuote.annual_premium)) : '—';
    doc.setFontSize(10);
    doc.setTextColor(138, 170, 25);
    doc.text(primaStr, w - margin - 4, y + 15, { align: 'right' });

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (emittedQuote.emitted_at) {
      doc.text(`Emitida: ${fmtDateTime(emittedQuote.emitted_at)}`, w - margin - 4, y + 22, { align: 'right' });
    }
    if (emittedQuote.quoted_at && emittedQuote.emitted_at) {
      const diffMin = Math.round((new Date(emittedQuote.emitted_at).getTime() - new Date(emittedQuote.quoted_at).getTime()) / 60000);
      doc.text(`Tiempo cotización → emisión: ${diffMin} min`, w - margin - 4, y + 27, { align: 'right' });
    }

    y += 34;
  }

  // ── SECTION: QUOTE DETAIL PER INSURER (individual details) ──
  if (y > h - 50) { doc.addPage(); y = 20; }

  doc.setFontSize(10);
  doc.setTextColor(1, 1, 57);
  doc.text('DETALLE POR COTIZACIÓN', margin, y + 4);
  y += 10;

  for (const r of allQuotes) {
    if (y > h - 45) { doc.addPage(); y = 20; }

    const isEmitted = r.status === 'EMITIDA';
    // Card outline
    doc.setFillColor(isEmitted ? 232 : 255, isEmitted ? 245 : 255, isEmitted ? 215 : 255);
    doc.setDrawColor(isEmitted ? 138 : 200, isEmitted ? 170 : 200, isEmitted ? 25 : 200);
    doc.setLineWidth(isEmitted ? 0.5 : 0.3);
    doc.rect(margin, y, w - margin * 2, 28, 'FD');

    // Ref + insurer
    doc.setFontSize(8);
    doc.setTextColor(1, 1, 57);
    doc.text(`${r.insurer} — ${r.plan_name || '—'}`, margin + 4, y + 7);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Ref: ${r.quote_ref}`, margin + 4, y + 13);

    // Status badge
    const statusColors: Record<string, number[]> = {
      COTIZADA: [59, 130, 246],   // blue
      EMITIDA: [34, 197, 94],    // green
      FALLIDA: [239, 68, 68],    // red
      ABANDONADA: [156, 163, 175], // gray
    };
    const sc = statusColors[r.status] || [100, 100, 100];
    doc.setTextColor(sc[0]!, sc[1]!, sc[2]!);
    doc.setFontSize(7);
    doc.text(r.status, w - margin - 4, y + 7, { align: 'right' });

    if (isEmitted) {
      doc.setTextColor(138, 170, 25);
      doc.setFontSize(7);
      doc.text('✓ SELECCIONADO', w - margin - 4, y + 13, { align: 'right' });
    }

    // Prima + details
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const prima = r.annual_premium ? fmtMoney(Number(r.annual_premium)) : '—';
    doc.text(`Prima: ${prima}`, margin + 4, y + 20);
    doc.text(`Cobertura: ${r.coverage_type || r.ramo || '—'}`, margin + (w - margin * 2) * 0.4, y + 20);
    doc.text(`Fecha: ${fmtDateTime(r.quoted_at)}`, margin + 4, y + 26);

    // Steps
    if (r.steps_log && r.steps_log.length > 0) {
      const stepsStr = r.steps_log.map(s => s.step).join(' → ');
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text(`Pasos: ${stepsStr}`, margin + (w - margin * 2) * 0.4, y + 26);
    }

    y += 32;
  }

  // ── FOOTER ON LAST PAGE ──
  doc.setDrawColor(138, 170, 25);
  doc.line(margin, h - 20, w - margin, h - 20);
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('Este documento es un resumen generado por Líderes en Seguros, S.A. La prima final puede variar al momento de la emisión.', margin, h - 15);
  doc.text('Regulado por la Superintendencia de Seguros y Reaseguros de Panamá.', margin, h - 11);

  const fileName = `resumen-cotizaciones-${q.cedula || q.quote_ref}.pdf`;
  doc.save(fileName);
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

// ════════════════════════════════════════════
// EXPANDABLE DETAIL (shared between mobile card & desktop row)
// ════════════════════════════════════════════

function QuoteDetail({ quote }: { quote: AdmCotQuote }) {
  const fmtFull = (d: string) => new Date(d).toLocaleString('es-PA');
  return (
    <div className="p-3 sm:p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Datos Completos</h4>
          <div className="space-y-1.5 text-xs text-gray-700">
            <p><span className="font-medium text-gray-500">Nombre:</span> {quote.client_name}</p>
            <p><span className="font-medium text-gray-500">Cédula:</span> {quote.cedula || '—'}</p>
            <p><span className="font-medium text-gray-500">Email:</span> {quote.email || '—'}</p>
            <p><span className="font-medium text-gray-500">Teléfono:</span> {quote.phone || '—'}</p>
            <p><span className="font-medium text-gray-500">IP:</span> <span className="font-mono">{quote.ip_address || '—'}</span></p>
            <p><span className="font-medium text-gray-500">Región:</span> {quote.region || '—'}</p>
            <p><span className="font-medium text-gray-500">Timestamp:</span> {fmtFull(quote.quoted_at)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h4 className="text-[10px] font-bold text-[#010139] uppercase tracking-wider mb-2">Emisión</h4>
          <div className="space-y-1.5 text-xs text-gray-700">
            {quote.status === 'EMITIDA' ? (
              <>
                <p><span className="font-medium text-gray-500">Nro. Póliza:</span> {(quote.quote_payload as any)?.nro_poliza || '—'}</p>
                <p><span className="font-medium text-gray-500">Fecha:</span> {quote.emitted_at ? fmtFull(quote.emitted_at) : '—'}</p>
                {quote.quoted_at && quote.emitted_at && (
                  <p><span className="font-medium text-gray-500">Tiempo:</span> {Math.round((new Date(quote.emitted_at).getTime() - new Date(quote.quoted_at).getTime()) / 60000)} min</p>
                )}
              </>
            ) : quote.status === 'FALLIDA' ? (
              <>
                <p className="text-red-600 font-medium">Emisión Fallida</p>
                <p><span className="font-medium text-gray-500">Error:</span> {(quote.quote_payload as any)?.error_message || '—'}</p>
              </>
            ) : (
              <p className="text-gray-400 italic">Sin emisión</p>
            )}
          </div>
        </div>

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
            <p className="text-gray-400 text-xs italic">Sin historial</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); downloadClientSummaryPdf(quote); }}
          className="p-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-colors cursor-pointer"
          title="Descargar resumen de cotizaciones"
        >
          <FaDownload className="text-sm text-white" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MOBILE CARD
// ════════════════════════════════════════════

function MobileQuoteCard({ quote }: { quote: AdmCotQuote }) {
  const [expanded, setExpanded] = useState(false);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#010139] truncate">{maskName(quote.client_name)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{quote.insurer} · {quote.ramo}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={quote.status} />
            {expanded ? <FaChevronUp className="text-[10px] text-[#010139]" /> : <FaChevronDown className="text-[10px] text-gray-400" />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
          <span>{fmtDate(quote.quoted_at)} {fmtTime(quote.quoted_at)}</span>
          {quote.cedula && <span>· {maskCedula(quote.cedula)}</span>}
          {quote.annual_premium && <span className="font-semibold text-[#8AAA19]">${Number(quote.annual_premium).toFixed(2)}</span>}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <QuoteDetail quote={quote} />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// DESKTOP TABLE ROW
// ════════════════════════════════════════════

function AuditRow({ quote }: { quote: AdmCotQuote }) {
  const [expanded, setExpanded] = useState(false);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
            <QuoteDetail quote={quote} />
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

  const [showDownloadModal, setShowDownloadModal] = useState(false);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[#010139]">Log de Cotizaciones</h2>
          <p className="text-[11px] sm:text-xs text-gray-500 truncate">{total.toLocaleString()} registros</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => fetchQuotes(1)} disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer" title="Refrescar">
            <FaSync className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowDownloadModal(true)}
            className="p-2 rounded-lg bg-[#010139] text-white hover:bg-[#020270] transition-colors cursor-pointer" title="Descargar reporte">
            <FaDownload className="text-sm text-white" />
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4 space-y-3">
        {/* Row 1: Search + Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input type="text" placeholder="Buscar nombre, cédula, email..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
              className="w-full pl-8 pr-3 py-2 text-sm sm:text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139]/20 focus:border-[#010139] outline-none" />
          </div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0 ${showAdvanced ? 'bg-[#010139] text-white' : 'text-gray-500 hover:bg-gray-100'}`} title="Filtros">
            <FaFilter className="text-sm" />
          </button>
          {(searchTerm || insurer || ramo || status || region || device || quoteRef || policyNumber) && (
            <button onClick={resetFilters} className="p-2 text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0" title="Limpiar filtros">
              <FaTimes className="text-sm" />
            </button>
          )}
        </div>

        {/* Row 2: Date presets (always visible) */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(['today', 'week', 'month', '3months', 'year'] as const).map((p) => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                preset === p ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {p === 'today' ? 'Hoy' : p === 'week' ? '7d' : p === 'month' ? '30d' : p === '3months' ? '90d' : 'Año'}
            </button>
          ))}
        </div>

        {/* Advanced filters (collapsible) */}
        {showAdvanced && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="w-full max-w-full overflow-hidden">
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); applyPreset('custom'); }}
                  className="w-full max-w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5" style={{ WebkitAppearance: 'none' }} />
              </div>
              <div className="w-full max-w-full overflow-hidden">
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); applyPreset('custom'); }}
                  className="w-full max-w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5" style={{ WebkitAppearance: 'none' }} />
              </div>
              <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
                <option value="">Aseguradora</option>
                <option value="INTERNACIONAL">Internacional</option>
                <option value="FEDPA">FEDPA</option>
              </select>
              <select value={ramo} onChange={(e) => setRamo(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
                <option value="">Ramo</option>
                <option value="AUTO">Auto</option>
                <option value="SALUD">Salud</option>
                <option value="VIDA">Vida</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
                <option value="">Estado</option>
                <option value="COTIZADA">Cotizada</option>
                <option value="EMITIDA">Emitida</option>
                <option value="FALLIDA">Fallida</option>
                <option value="ABANDONADA">Abandonada</option>
              </select>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
                <option value="">Región</option>
                <option value="Panamá">Panamá</option>
                <option value="Panamá Oeste">Panamá Oeste</option>
                <option value="Colón">Colón</option>
                <option value="Chiriquí">Chiriquí</option>
                <option value="Coclé">Coclé</option>
                <option value="Veraguas">Veraguas</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <select value={device} onChange={(e) => setDevice(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
                <option value="">Dispositivo</option>
                <option value="Windows">Windows</option>
                <option value="macOS">macOS</option>
                <option value="iOS">iOS</option>
                <option value="Android">Android</option>
                <option value="Linux">Linux</option>
              </select>
              <input type="text" placeholder="ID Cotización" value={quoteRef} onChange={(e) => setQuoteRef(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
                className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5" />
              <input type="text" placeholder="Nro. Póliza" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQuotes(1)}
                className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => fetchQuotes(1)} disabled={loading}
                className="px-4 py-2 sm:py-1.5 bg-[#010139] text-white text-sm sm:text-xs font-medium rounded-lg hover:bg-[#020270] transition-colors flex items-center gap-1.5 cursor-pointer">
                <FaSync className={`text-white ${loading ? 'animate-spin' : ''}`} /> <span className="text-white">Aplicar Filtros</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <FaTimesCircle className="inline mr-2" /> {error}
        </div>
      )}

      {/* ── Loading / Empty ── */}
      {loading && quotes.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FaSync className="animate-spin text-2xl mx-auto mb-2" />
          <p className="text-sm">Cargando cotizaciones...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="py-16 text-center">
          <FaSearch className="text-3xl text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No se encontraron cotizaciones</p>
          <p className="text-xs text-gray-400 mt-1">Ajusta los filtros o espera nuevas cotizaciones</p>
        </div>
      ) : (
        <>
          {/* ── Mobile Card List (< md) ── */}
          <div className="md:hidden space-y-2">
            {quotes.map((q) => <MobileQuoteCard key={q.id} quote={q} />)}
          </div>

          {/* ── Desktop Table (>= md) ── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                  {quotes.map((q) => <AuditRow key={q.id} quote={q} />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
              <p className="text-xs text-gray-500">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchQuotes(1)} disabled={page === 1 || loading}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">«</button>
                <button onClick={() => fetchQuotes(page - 1)} disabled={page === 1 || loading}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Ant.</button>
                <span className="px-3 py-1 text-xs text-gray-600 font-medium">{page} / {totalPages}</span>
                <button onClick={() => fetchQuotes(page + 1)} disabled={page === totalPages || loading}
                  className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Sig.</button>
                <button onClick={() => fetchQuotes(totalPages)} disabled={page === totalPages || loading}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 cursor-pointer">»</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Download Format Modal */}
      {showDownloadModal && (
        <DownloadModal
          onClose={() => setShowDownloadModal(false)}
          onPdf={() => { handleExportPdf(); setShowDownloadModal(false); }}
          onExcel={() => { handleExportExcel(); setShowDownloadModal(false); }}
          exporting={exporting}
        />
      )}
    </div>
  );
}
