import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AdjustmentItem {
  policy_number: string;
  insured_name: string | null;
  insurer_name: string | null;
  commission_raw: number;
  broker_commission: number;
}

interface AdjustmentReport {
  id: string;
  broker_name: string;
  total_amount: number;
  created_at: string;
  paid_date: string | null;
  payment_mode: 'immediate' | 'next_fortnight' | null;
  items: AdjustmentItem[];
}

/**
 * Generar PDF de reporte de ajuste pagado
 */
export function generateAdjustmentPDF(report: AdjustmentReport): jsPDF {
  const doc = new jsPDF();
  
  // Configuración
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DE AJUSTES', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Portal Líderes en Seguros', pageWidth / 2, yPos, { align: 'center' });

  // Información del reporte
  yPos += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Información del Reporte', margin, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const info = [
    ['Broker:', report.broker_name],
    ['Fecha de Creación:', new Date(report.created_at).toLocaleDateString('es-PA')],
    ['Fecha de Pago:', report.paid_date ? new Date(report.paid_date).toLocaleDateString('es-PA') : 'N/A'],
    ['Modalidad de Pago:', report.payment_mode === 'immediate' ? 'Pago Inmediato' : 'Siguiente Quincena'],
    ['Total de Items:', report.items.length.toString()],
  ];

  info.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label as string, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value as string, margin + 45, yPos);
    yPos += 6;
  });

  // Tabla de items
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle de Ajustes', margin, yPos);
  
  yPos += 5;

  const tableData = report.items.map(item => [
    item.policy_number,
    item.insured_name || 'N/A',
    item.insurer_name || 'N/A',
    `$${Math.abs(item.commission_raw).toFixed(2)}`,
    `$${item.broker_commission.toFixed(2)}`
  ]);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Póliza', 'Cliente', 'Aseguradora', 'Monto Crudo', 'Comisión Broker']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [1, 1, 57], // #010139
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    foot: [[
      '',
      '',
      'TOTAL:',
      '',
      `$${report.total_amount.toFixed(2)}`
    ]],
    footStyles: {
      fillColor: [138, 170, 25], // #8AAA19
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'right'
    }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  yPos = finalY + 15;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Documento generado el ${new Date().toLocaleString('es-PA')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc;
}

/**
 * Descargar PDF de reporte de ajuste
 */
export function downloadAdjustmentPDF(report: AdjustmentReport) {
  const doc = generateAdjustmentPDF(report);
  const fileName = `Ajuste_${report.broker_name.replace(/\s+/g, '_')}_${new Date(report.paid_date || report.created_at).toLocaleDateString('es-PA').replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}
