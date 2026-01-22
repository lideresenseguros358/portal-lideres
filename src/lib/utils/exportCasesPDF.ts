import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CASE_STATUS_LABELS } from '@/lib/constants/cases';

interface CaseForExport {
  id: string;
  ticket_ref: string | null;
  client_name: string | null;
  client?: { name: string } | null;
  insurer?: { name: string } | null;
  status: string;
  sla_date: string | null;
  created_at: string;
  broker?: {
    name: string | null;
    profiles?: {
      full_name: string | null;
    } | null;
  } | null;
}

export async function exportCasesByBrokerPDF(cases: CaseForExport[], selectedCaseIds?: string[]) {
  // Filtrar solo casos seleccionados si hay selección
  const casesToExport = selectedCaseIds && selectedCaseIds.length > 0
    ? cases.filter(c => selectedCaseIds.includes(c.id))
    : cases;

  if (casesToExport.length === 0) {
    throw new Error('No hay casos para exportar');
  }

  // Agrupar por broker
  const grouped: Record<string, CaseForExport[]> = {};
  casesToExport.forEach(caseItem => {
    const brokerId = caseItem.broker?.name || caseItem.broker?.profiles?.full_name || 'Sin broker asignado';
    if (!grouped[brokerId]) {
      grouped[brokerId] = [];
    }
    grouped[brokerId].push(caseItem);
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let isFirstPage = true;

  // Logo base64 (pequeño logo corporativo)
  const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  // Nota: Reemplazar con el logo real en base64 o cargar desde URL

  // Iterar por cada broker
  for (const [brokerName, brokerCases] of Object.entries(grouped)) {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    // Header con logo
    try {
      doc.addImage(logoBase64, 'PNG', 14, 10, 30, 12);
    } catch (error) {
      console.warn('Logo no disponible');
    }

    // Título
    doc.setFontSize(18);
    doc.setTextColor(1, 1, 57); // #010139
    doc.text('Pendientes (Trámites)', pageWidth / 2, 20, { align: 'center' });

    // Broker
    doc.setFontSize(14);
    doc.setTextColor(138, 170, 25); // #8AAA19
    doc.text(`Broker: ${brokerName}`, 14, 32);

    // Fecha de generación
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const today = new Date().toLocaleDateString('es-CR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${today}`, 14, 38);

    // Total de casos
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de casos: ${brokerCases.length}`, pageWidth - 14, 38, { align: 'right' });

    // Preparar datos para tabla
    const tableData = brokerCases.map(caseItem => {
      const clientName = caseItem.client_name || caseItem.client?.name || 'Sin nombre';
      const insurerName = caseItem.insurer?.name || 'Sin aseguradora';
      const status = CASE_STATUS_LABELS[caseItem.status as keyof typeof CASE_STATUS_LABELS] || caseItem.status;
      const slaDate = caseItem.sla_date
        ? new Date(caseItem.sla_date).toLocaleDateString('es-CR')
        : '-';
      const ticket = caseItem.ticket_ref ? `#${caseItem.ticket_ref}` : '-';

      return [ticket, clientName, insurerName, status, slaDate];
    });

    // Generar tabla
    autoTable(doc, {
      startY: 45,
      head: [['Ticket', 'Cliente', 'Aseguradora', 'Estado', 'Plazo']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [1, 1, 57], // #010139
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Ticket
        1: { cellWidth: 45 }, // Cliente
        2: { cellWidth: 45 }, // Aseguradora
        3: { cellWidth: 35 }, // Estado
        4: { cellWidth: 30 }  // Plazo
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data) {
        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        doc.text(
          'Portal Líderes en Seguros',
          pageWidth - 14,
          pageHeight - 10,
          { align: 'right' }
        );
      }
    });
  }

  // Guardar PDF
  const fileName = `Pendientes_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
