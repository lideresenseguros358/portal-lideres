// PDF Generator for Cases
// Uses jsPDF to generate branded PDFs

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { Tables } from '@/lib/database.types';
import { getSlaInfo } from './sla';
import { formatDate } from './utils';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Brand colors
const BRAND_COLORS = {
  primary: '#010139', // Azul oscuro
  secondary: '#8AAA19', // Oliva
  gray: '#6B7280',
  lightGray: '#F3F4F6',
};

// =====================================================
// GENERATE SINGLE CASE PDF
// =====================================================

export function generateCasePDF(
  caseData: Tables<'cases'> & {
    broker?: { name: string };
    insurer?: { name: string };
    client?: { name: string };
    checklist?: Tables<'case_checklist'>[];
    files?: Tables<'case_files'>[];
    history?: Tables<'case_history'>[];
  }
): Blob {
  const doc = new jsPDF();
  let yPos = 20;

  // Header with branding
  doc.setFillColor(BRAND_COLORS.primary);
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Portal Líderes en Seguros', 105, 15, { align: 'center' });
  
  yPos = 35;

  // Case number and status
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(`Caso: ${caseData.case_number || caseData.id.substring(0, 8)}`, 20, yPos);
  
  // Status badge
  const statusConfig = getStatusConfig(caseData.status);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(statusConfig.color[0], statusConfig.color[1], statusConfig.color[2]);
  doc.rect(150, yPos - 5, 40, 8, 'F');
  doc.text(statusConfig.label, 170, yPos, { align: 'center' });
  
  yPos += 15;

  // Case details section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Detalles del Caso', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  const details = [
    ['Cliente:', caseData.client_name || caseData.client?.name || 'N/A'],
    ['Aseguradora:', caseData.insurer?.name || 'N/A'],
    ['Tipo de gestión:', caseData.ctype],
    ['Broker asignado:', caseData.broker?.name || 'N/A'],
    ['Póliza:', caseData.policy_number || 'Pendiente'],
    ['Prima:', caseData.premium ? `$${caseData.premium.toFixed(2)}` : 'N/A'],
    ['Fecha creación:', formatDate(caseData.created_at)],
  ];

  details.forEach((detail) => {
    const [label, value] = detail;
    doc.setFont('helvetica', 'bold');
    doc.text(label || '', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 70, yPos);
    yPos += 6;
  });

  yPos += 5;

  // SLA section
  if (caseData.sla_date) {
    const slaInfo = getSlaInfo(caseData.sla_date);
    doc.setFontSize(14);
    doc.text('SLA', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Fecha SLA: ${formatDate(caseData.sla_date)}`, 20, yPos);
    yPos += 6;
    doc.text(`Estado: ${slaInfo.text}`, 20, yPos);
    yPos += 10;
  }

  // Checklist section
  if (caseData.checklist && caseData.checklist.length > 0) {
    doc.setFontSize(14);
    doc.text('Checklist de Documentos', 20, yPos);
    yPos += 5;

    const checklistData = caseData.checklist.map(item => [
      item.completed ? '✓' : '○',
      item.label,
      item.required ? 'Obligatorio' : 'Opcional',
      item.completed ? 'Completado' : 'Pendiente',
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['✓', 'Documento', 'Tipo', 'Estado']],
      body: checklistData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [1, 1, 57] }, // Brand primary
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Files section
  if (caseData.files && caseData.files.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Archivos Adjuntos', 20, yPos);
    yPos += 5;

    const filesData = caseData.files.map(file => [
      file.original_name || 'Sin nombre',
      file.mime_type || 'N/A',
      formatDate(file.created_at),
    ]);

    doc.autoTable({
      startY: yPos,
      head: [['Archivo', 'Tipo', 'Fecha']],
      body: filesData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [1, 1, 57] },
    });

    yPos = doc.lastAutoTable.finalY + 10;
  }

  // Notes section
  if (caseData.notes) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Notas', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(caseData.notes, 170);
    doc.text(splitNotes, 20, yPos);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(BRAND_COLORS.gray);
    doc.text(
      `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-PA')}`,
      105,
      285,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}

// =====================================================
// GENERATE CONSOLIDATED PDF (Multiple cases)
// =====================================================

export function generateConsolidatedPDF(
  cases: (Tables<'cases'> & {
    broker?: { name: string };
    insurer?: { name: string };
    client?: { name: string };
  })[]
): Blob {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(BRAND_COLORS.primary);
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Portal Líderes en Seguros', 105, 15, { align: 'center' });
  
  let yPos = 35;

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(`Reporte de Casos (${cases.length} total)`, 20, yPos);
  yPos += 10;

  // Summary table
  const tableData = cases.map(c => {
    const slaInfo = c.sla_date ? getSlaInfo(c.sla_date) : null;
    return [
      c.case_number || c.id.substring(0, 8),
      c.insurer?.name || 'N/A',
      c.ctype,
      c.client_name || 'N/A',
      getStatusConfig(c.status).label,
      slaInfo ? slaInfo.text : 'N/A',
      c.ticket_ref || '-',
    ];
  });

  doc.autoTable({
    startY: yPos,
    head: [['Caso', 'Aseguradora', 'Gestión', 'Cliente', 'Estado', 'SLA', 'Ticket']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [1, 1, 57] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 25 },
      5: { cellWidth: 30 },
      6: { cellWidth: 20 },
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(BRAND_COLORS.gray);
    doc.text(
      `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-PA')}`,
      105,
      285,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getStatusConfig(status: string): { label: string; color: [number, number, number] } {
  const configs: Record<string, { label: string; color: [number, number, number] }> = {
    PENDIENTE_REVISION: { label: 'Pendiente Revisión', color: [234, 179, 8] },
    PENDIENTE_DOCUMENTACION: { label: 'Pend. Documentación', color: [249, 115, 22] },
    EN_PROCESO: { label: 'En Proceso', color: [59, 130, 246] },
    COTIZANDO: { label: 'Cotizando', color: [99, 102, 241] },
    FALTA_DOC: { label: 'Falta Doc', color: [239, 68, 68] },
    APLAZADO: { label: 'Aplazado', color: [107, 114, 128] },
    RECHAZADO: { label: 'Rechazado', color: [220, 38, 38] },
    APROBADO_PEND_PAGO: { label: 'Aprobado - Pend. Pago', color: [34, 197, 94] },
    EMITIDO: { label: 'Emitido', color: [22, 163, 74] },
    CERRADO: { label: 'Cerrado', color: [75, 85, 99] },
    REVISAR_ORIGEN: { label: 'Revisar Origen', color: [168, 85, 247] },
  };

  return configs[status] || { label: status, color: [107, 114, 128] };
}
