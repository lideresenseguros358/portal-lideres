import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface PolicyDetail {
  policy_number: string;
  insured_name: string;
  gross_amount: number;
  percentage: number;
  net_amount: number;
}

interface InsurerDetail {
  insurer_name: string;
  total_gross: number;
  policies: PolicyDetail[];
}

interface BrokerDetail {
  broker_name: string;
  broker_email: string;
  percent_default: number;
  total_gross: number;
  total_net: number;
  insurers: InsurerDetail[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const capitalizeText = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Export single broker commission report to PDF
 */
export function exportBrokerToPDF(
  broker: BrokerDetail,
  fortnightLabel: string,
  discounts?: { total: number; details: Array<{ reason: string; amount: number }> }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Colors
  const primaryColor: [number, number, number] = [1, 1, 57]; // #010139
  const secondaryColor: [number, number, number] = [138, 170, 25]; // #8AAA19
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo más pequeño con proporción 2:1 (típico logo horizontal)
  try {
    const img = new Image();
    img.src = '/logo_alternativo.png';
    // Logo pequeño sin distorsión
    doc.addImage(img, 'PNG', 14, 12, 24, 12);
  } catch (e) {
    // Si falla, solo mostrar texto
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LÍDERES EN SEGUROS', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Comisiones', pageWidth / 2, 28, { align: 'center' });

  // Broker Info
  let yPos = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Corredor: ${capitalizeText(broker.broker_name)}`, 14, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${broker.broker_email}`, 14, yPos);
  
  yPos += 5;
  doc.text(`Período: ${fortnightLabel}`, 14, yPos);
  
  yPos += 5;
  doc.text(`Porcentaje Base: ${(broker.percent_default * 100).toFixed(0)}%`, 14, yPos);
  
  yPos += 10;

  // Insurers and Policies
  broker.insurers.forEach((insurer, insurerIdx) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Insurer header integrado con la tabla
    const tableWidth = 165; // 30+70+25+15+25
    const leftMargin = (pageWidth - tableWidth) / 2;
    
    // Título de aseguradora como parte integrada
    doc.setFillColor(...secondaryColor);
    doc.rect(leftMargin, yPos, tableWidth, 7, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${insurer.insurer_name}`, leftMargin + 2, yPos + 5);
    doc.text(formatCurrency(insurer.total_gross), leftMargin + tableWidth - 2, yPos + 5, { align: 'right' });
    
    yPos += 7;

    // Policies table
    const tableData = insurer.policies.map(policy => [
      policy.policy_number,
      policy.insured_name.substring(0, 35),
      formatCurrency(policy.gross_amount),
      `${(policy.percentage * 100).toFixed(0)}%`,
      formatCurrency(policy.net_amount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Póliza', 'Cliente', 'Bruto', '%', 'Neto']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: leftMargin, right: leftMargin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  });

  // Summary
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  
  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN', 14, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Bruto:`, 14, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(broker.total_gross), pageWidth - 14, yPos, { align: 'right' });
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Neto (sin descuentos):`, 14, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(broker.total_net), pageWidth - 14, yPos, { align: 'right' });

  if (discounts && discounts.total > 0) {
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('DESCUENTOS:', 14, yPos);
    
    discounts.details.forEach(d => {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`- ${d.reason}:`, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...[220, 38, 38]); // red
      doc.text(formatCurrency(d.amount), pageWidth - 14, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    });

    yPos += 8;
    doc.setLineWidth(0.3);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL NETO A PAGAR:', 14, yPos);
    doc.setTextColor(...secondaryColor);
    doc.text(formatCurrency(broker.total_net - discounts.total), pageWidth - 14, yPos, { align: 'right' });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-PA')}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`comision_${broker.broker_name.replace(/\s+/g, '_')}_${fortnightLabel.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Export single broker commission report to Excel
 */
export function exportBrokerToExcel(
  broker: BrokerDetail,
  fortnightLabel: string,
  discounts?: { total: number; details: Array<{ reason: string; amount: number }> }
) {
  const workbook = XLSX.utils.book_new();
  
  // Create data array
  const data: any[] = [];
  
  // Header
  data.push(['LÍDERES EN SEGUROS - REPORTE DE COMISIONES']);
  data.push([]);
  data.push(['Corredor:', capitalizeText(broker.broker_name)]);
  data.push(['Email:', broker.broker_email]);
  data.push(['Período:', fortnightLabel]);
  data.push(['Porcentaje Base:', `${(broker.percent_default * 100).toFixed(0)}%`]);
  data.push([]);

  // Insurers and policies
  broker.insurers.forEach((insurer) => {
    data.push([insurer.insurer_name, '', '', '', formatCurrency(insurer.total_gross)]);
    data.push(['Póliza', 'Cliente', 'Bruto', '%', 'Neto']);
    
    insurer.policies.forEach(policy => {
      data.push([
        policy.policy_number,
        policy.insured_name,
        policy.gross_amount,
        `${(policy.percentage * 100).toFixed(0)}%`,
        policy.net_amount,
      ]);
    });
    
    data.push([]);
  });

  // Summary
  data.push(['RESUMEN']);
  data.push(['Total Bruto:', '', '', '', broker.total_gross]);
  data.push(['Total Neto (sin descuentos):', '', '', '', broker.total_net]);

  if (discounts && discounts.total > 0) {
    data.push([]);
    data.push(['DESCUENTOS:']);
    discounts.details.forEach(d => {
      data.push([`- ${d.reason}:`, '', '', '', -d.amount]);
    });
    data.push([]);
    data.push(['TOTAL NETO A PAGAR:', '', '', '', broker.total_net - discounts.total]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Column widths
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 40 },
    { wch: 15 },
    { wch: 10 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Comisiones');
  XLSX.writeFile(workbook, `comision_${broker.broker_name.replace(/\s+/g, '_')}_${fortnightLabel.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Export complete fortnight report with all brokers to PDF
 */
export function exportCompleteReportToPDF(
  brokers: BrokerDetail[],
  fortnightLabel: string,
  totals: { total_imported: number; total_paid_net: number; total_office_profit: number }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const primaryColor: [number, number, number] = [1, 1, 57];
  const secondaryColor: [number, number, number] = [138, 170, 25];

  // First page - Summary
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo pequeño con proporción 2:1
  try {
    const img = new Image();
    img.src = '/logo_alternativo.png';
    doc.addImage(img, 'PNG', 14, 12, 24, 12);
  } catch (e) {
    // Si falla, solo mostrar texto
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LÍDERES EN SEGUROS', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Reporte Completo de Comisiones', pageWidth / 2, 28, { align: 'center' });

  let yPos = 50;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`Período: ${fortnightLabel}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // Summary table
  const summaryData = [
    ['Total Importado', formatCurrency(totals.total_imported)],
    ['Total Pagado a Corredores (Neto)', formatCurrency(totals.total_paid_net)],
    ['Ganancia Oficina', formatCurrency(totals.total_office_profit)],
  ];

  const summaryTableWidth = 160; // 100+60
  const summaryTableMargin = (pageWidth - summaryTableWidth) / 2;

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'right', cellWidth: 60 },
    },
    margin: { left: summaryTableMargin, right: summaryTableMargin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Brokers summary table
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen por Corredor', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;

  const brokersTableData = brokers.map(b => [
    capitalizeText(b.broker_name),
    formatCurrency(b.total_gross),
    formatCurrency(b.total_net),
  ]);

  const brokerTableWidth = 190; // 100+45+45
  const brokerTableMargin = (pageWidth - brokerTableWidth) / 2;

  autoTable(doc, {
    startY: yPos,
    head: [['Corredor', 'Bruto', 'Neto']],
    body: brokersTableData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: primaryColor },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'right', cellWidth: 45 },
      2: { halign: 'right', cellWidth: 45 },
    },
    margin: { left: brokerTableMargin, right: brokerTableMargin },
  });

  // Detail pages for each broker
  brokers.forEach((broker, idx) => {
    doc.addPage();
    
    // Header con logo
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Logo pequeño con proporción 2:1
    try {
      const img = new Image();
      img.src = '/logo_alternativo.png';
      doc.addImage(img, 'PNG', 14, 11, 20, 10);
    } catch (e) {
      // Si falla, solo mostrar texto
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(capitalizeText(broker.broker_name), pageWidth / 2, 16, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${broker.broker_email} | ${fortnightLabel}`, pageWidth / 2, 25, { align: 'center' });

    yPos = 45;

    // Insurers and policies for this broker
    broker.insurers.forEach((insurer) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Insurer header integrado con la tabla
      const tableWidth = 146; // 25+65+22+12+22
      const leftMargin = (pageWidth - tableWidth) / 2;
      
      doc.setFillColor(...secondaryColor);
      doc.rect(leftMargin, yPos, tableWidth, 7, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${insurer.insurer_name}`, leftMargin + 2, yPos + 5);
      doc.text(formatCurrency(insurer.total_gross), leftMargin + tableWidth - 2, yPos + 5, { align: 'right' });
      
      yPos += 7;

      const tableData = insurer.policies.map(policy => [
        policy.policy_number,
        policy.insured_name.substring(0, 30),
        formatCurrency(policy.gross_amount),
        `${(policy.percentage * 100).toFixed(0)}%`,
        formatCurrency(policy.net_amount),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Póliza', 'Cliente', 'Bruto', '%', 'Neto']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: primaryColor, fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 65 },
          2: { cellWidth: 22, halign: 'right' },
          3: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: leftMargin, right: leftMargin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 4;
    });

    // Broker summary
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 5;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    
    yPos += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Bruto:', 14, yPos);
    doc.text(formatCurrency(broker.total_gross), pageWidth - 14, yPos, { align: 'right' });
    
    yPos += 6;
    doc.text('Total Neto:', 14, yPos);
    doc.setTextColor(...secondaryColor);
    doc.text(formatCurrency(broker.total_net), pageWidth - 14, yPos, { align: 'right' });
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-PA')}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`reporte_completo_${fortnightLabel.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Export complete fortnight report with all brokers to Excel
 */
export function exportCompleteReportToExcel(
  brokers: BrokerDetail[],
  fortnightLabel: string,
  totals: { total_imported: number; total_paid_net: number; total_office_profit: number }
) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: any[] = [
    ['LÍDERES EN SEGUROS - REPORTE COMPLETO'],
    [],
    ['Período:', fortnightLabel],
    [],
    ['TOTALES GENERALES'],
    ['Total Importado:', totals.total_imported],
    ['Total Pagado a Corredores (Neto):', totals.total_paid_net],
    ['Ganancia Oficina:', totals.total_office_profit],
    [],
    ['RESUMEN POR CORREDOR'],
    ['Corredor', 'Email', 'Bruto', 'Neto'],
  ];

  brokers.forEach(b => {
    summaryData.push([
      capitalizeText(b.broker_name),
      b.broker_email,
      b.total_gross,
      b.total_net,
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Individual sheets for each broker
  brokers.forEach((broker, idx) => {
    const brokerData: any[] = [];
    brokerData.push([capitalizeText(broker.broker_name)]);
    brokerData.push(['Email:', broker.broker_email]);
    brokerData.push(['Período:', fortnightLabel]);
    brokerData.push([]);

    broker.insurers.forEach((insurer) => {
      brokerData.push([insurer.insurer_name, '', '', '', formatCurrency(insurer.total_gross)]);
      brokerData.push(['Póliza', 'Cliente', 'Bruto', '%', 'Neto']);
      
      insurer.policies.forEach(policy => {
        brokerData.push([
          policy.policy_number,
          policy.insured_name,
          policy.gross_amount,
          `${(policy.percentage * 100).toFixed(0)}%`,
          policy.net_amount,
        ]);
      });
      
      brokerData.push([]);
    });

    brokerData.push(['Total Bruto:', '', '', '', broker.total_gross]);
    brokerData.push(['Total Neto:', '', '', '', broker.total_net]);

    const brokerSheet = XLSX.utils.aoa_to_sheet(brokerData);
    brokerSheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    
    // Truncate sheet name to 31 characters (Excel limit)
    const sheetName = capitalizeText(broker.broker_name).substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, brokerSheet, sheetName);
  });

  XLSX.writeFile(workbook, `reporte_completo_${fortnightLabel.replace(/\s+/g, '_')}.xlsx`);
}
