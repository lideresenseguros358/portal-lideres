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

interface AssaCodeDetail {
  policy_number: string;
  assa_code?: string;
  client_name: string;
  commission_raw: number;
  percent_applied: number;
  commission_calculated: number;
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
  assa_codes?: AssaCodeDetail[];
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
export async function exportBrokerToPDF(
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
    // Cargar imagen de forma asíncrona
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          doc.addImage(img, 'PNG', 14, 12, 24, 12);
          resolve();
        } catch (e) {
          console.warn('Error adding logo to PDF:', e);
          resolve(); // Continuar sin logo
        }
      };
      img.onerror = () => {
        console.warn('Error loading logo image');
        resolve(); // Continuar sin logo
      };
      img.src = '/logo_alternativo.png';
    });
  } catch (e) {
    console.warn('Error processing logo:', e);
    // Continuar sin logo
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

  // AJUSTES - Si existen
  if ((broker as any).adjustments && (broker as any).adjustments.total > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(255, 193, 7); // amber
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠️ AJUSTES', 16, yPos + 5.5);
    doc.text(formatCurrency((broker as any).adjustments.total), pageWidth - 16, yPos + 5.5, { align: 'right' });
    yPos += 10;

    (broker as any).adjustments.insurers.forEach((adjInsurer: any) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Título de aseguradora de ajustes
      const tableWidth = 165;
      const leftMargin = (pageWidth - tableWidth) / 2;
      doc.setFillColor(251, 191, 36); // amber
      doc.rect(leftMargin, yPos, tableWidth, 7, 'F');
      doc.setTextColor(120, 53, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${adjInsurer.insurer_name} (Ajustes)`, leftMargin + 2, yPos + 5);
      doc.text(formatCurrency(adjInsurer.total), leftMargin + tableWidth - 2, yPos + 5, { align: 'right' });
      yPos += 7;

      const adjTableData = adjInsurer.items.map((item: any) => [
        item.policy_number,
        item.insured_name.substring(0, 35),
        formatCurrency(item.commission_raw),
        `${item.percentage}%`,
        formatCurrency(item.broker_commission),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Póliza', 'Cliente', 'Prima', '%', 'Comisión']],
        body: adjTableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 8 },
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

    yPos += 5;
  }

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
      head: [['Póliza', 'Cliente', 'Prima', '%', 'Comisión']],
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

  // Códigos ASSA
  if (broker.assa_codes && broker.assa_codes.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    const tableWidth = 165;
    const leftMargin = (pageWidth - tableWidth) / 2;
    const totalAssaCodes = broker.assa_codes.reduce((sum, item) => sum + item.net_amount, 0);
    
    // Título de códigos ASSA
    doc.setFillColor(234, 179, 8); // yellow
    doc.rect(leftMargin, yPos, tableWidth, 7, 'F');
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Codigos ASSA', leftMargin + 2, yPos + 5);
    doc.text(formatCurrency(totalAssaCodes), leftMargin + tableWidth - 2, yPos + 5, { align: 'right' });
    yPos += 7;

    const assaTableData = broker.assa_codes.map(item => [
      item.assa_code || item.policy_number,
      item.client_name.substring(0, 35),
      formatCurrency(item.commission_raw),
      `${(item.percent_applied * 100).toFixed(0)}%`,
      formatCurrency(item.commission_calculated),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Código', 'Cliente', 'Prima', '%', 'Comisión']],
      body: assaTableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [234, 179, 8], textColor: [255, 255, 255], fontSize: 8 },
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
  }

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

  // ADELANTOS DESCONTADOS
  if ((broker as any).discounts_json?.adelantos && (broker as any).discounts_json.adelantos.length > 0) {
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('ADELANTOS DESCONTADOS:', 14, yPos);
    
    (broker as any).discounts_json.adelantos.forEach((adelanto: any) => {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`- ${adelanto.description}:`, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...[220, 38, 38]); // red
      doc.text(formatCurrency(adelanto.amount), pageWidth - 14, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    });

    yPos += 8;
    doc.setLineWidth(0.3);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;
    
    const totalDescuentos = (broker as any).discounts_json.total || 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Descuentos:', 14, yPos);
    doc.setTextColor(...[220, 38, 38]);
    doc.text(formatCurrency(totalDescuentos), pageWidth - 14, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    yPos += 8;
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL NETO A PAGAR:', 14, yPos);
    doc.setTextColor(...secondaryColor);
    doc.text(formatCurrency(broker.total_net - totalDescuentos), pageWidth - 14, yPos, { align: 'right' });
  } else if (discounts && discounts.total > 0) {
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

  // AJUSTES - Si existen
  if ((broker as any).adjustments && (broker as any).adjustments.total > 0) {
    data.push(['⚠️ AJUSTES', '', '', '', formatCurrency((broker as any).adjustments.total)]);
    data.push([]);

    (broker as any).adjustments.insurers.forEach((adjInsurer: any) => {
      data.push([`${adjInsurer.insurer_name} (Ajustes)`, '', '', '', formatCurrency(adjInsurer.total)]);
      data.push(['Póliza', 'Cliente', 'Prima', '%', 'Comisión']);
      
      adjInsurer.items.forEach((item: any) => {
        data.push([
          item.policy_number,
          item.insured_name,
          item.commission_raw,
          `${item.percentage}%`,
          item.broker_commission,
        ]);
      });
      data.push([]);
    });
  }

  // Insurers and policies
  broker.insurers.forEach((insurer) => {
    data.push([insurer.insurer_name, '', '', '', formatCurrency(insurer.total_gross)]);
    data.push(['Póliza', 'Cliente', 'Prima', '%', 'Comisión']);
    
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

  // Códigos ASSA
  if (broker.assa_codes && broker.assa_codes.length > 0) {
    const totalAssaCodes = broker.assa_codes.reduce((sum: number, item: AssaCodeDetail) => sum + item.net_amount, 0);
    data.push(['Codigos ASSA', '', '', '', formatCurrency(totalAssaCodes)]);
    data.push(['Código', 'Cliente', 'Prima', '%', 'Comisión']);
    
    broker.assa_codes.forEach(item => {
      data.push([
        item.assa_code || item.policy_number,
        item.client_name,
        item.commission_raw,
        `${(item.percent_applied * 100).toFixed(0)}%`,
        item.commission_calculated,
      ]);
    });
    
    data.push([]);
  }

  data.push(['RESUMEN']);
  data.push(['Total Bruto:', '', '', '', broker.total_gross]);
  data.push(['Total Neto (sin descuentos):', '', '', '', broker.total_net]);

  // Adelantos descontados
  if ((broker as any).discounts_json?.adelantos && (broker as any).discounts_json.adelantos.length > 0) {
    data.push([]);
    data.push(['ADELANTOS DESCONTADOS']);
    (broker as any).discounts_json.adelantos.forEach((adelanto: any) => {
      data.push([adelanto.description, '', '', '', adelanto.amount]);
    });
    data.push([]);
    const totalDescuentos = (broker as any).discounts_json.total || 0;
    data.push(['TOTAL DESCUENTOS', '', '', '', totalDescuentos]);
    data.push(['TOTAL NETO A PAGAR', '', '', '', broker.total_net - totalDescuentos]);
  } else if (discounts && discounts.total > 0) {
    data.push([]);
    data.push(['DESCUENTOS']);
    discounts.details.forEach(d => {
      data.push([d.reason, '', '', '', d.amount]);
    });
    data.push([]);
    data.push(['TOTAL DESCUENTOS', '', '', '', discounts.total]);
    data.push(['TOTAL NETO A PAGAR', '', '', '', broker.total_net - discounts.total]);
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
  console.log('[PDF Export] Iniciando generación:', {
    brokersCount: brokers.length,
    label: fortnightLabel,
    totals
  });

  if (!brokers || brokers.length === 0) {
    console.error('[PDF Export] No hay brokers para exportar');
    throw new Error('No hay brokers para exportar');
  }

  // Ordenar brokers alfabéticamente
  brokers = [...brokers].sort((a, b) => a.broker_name.localeCompare(b.broker_name));

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

  const brokersTableData = brokers.map((b: any) => {
    const bruto = b.total_net; // Comisión con porcentaje aplicado
    const discountsTotal = b.discounts_json?.total || 0;
    const neto = bruto - discountsTotal; // Total a pagar
    
    return [
      capitalizeText(b.broker_name),
      formatCurrency(bruto),
      formatCurrency(discountsTotal),
      formatCurrency(neto)
    ];
  });

  // Calcular ancho total y centrar la tabla
  const tableWidth = 165; // Total: 90 + 25 + 25 + 25
  const marginHorizontal = (pageWidth - tableWidth) / 2;

  autoTable(doc, {
    startY: yPos,
    head: [['Corredor', 'Bruto', 'Desc.', 'Neto']],
    body: brokersTableData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3, halign: 'left' },
    headStyles: { fillColor: primaryColor, fontSize: 9, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 90 },  // Corredor
      1: { halign: 'right', cellWidth: 25 },  // Bruto
      2: { halign: 'right', cellWidth: 25 },  // Desc.
      3: { halign: 'right', cellWidth: 25 },  // Neto
    },
    margin: { left: marginHorizontal, right: marginHorizontal },
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
      const tableWidth = 145; // 30+85+30 (ancho total de las 3 columnas)
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
        formatCurrency(policy.net_amount),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Póliza', 'Cliente', 'Comisión']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: primaryColor, fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 85 },
          2: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: leftMargin, right: leftMargin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 4;
    });

    // Broker summary
    if (yPos > 230) {
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
    
    // Bruto (comisión con porcentaje aplicado)
    const bruto = (broker as any).total_net;
    doc.text('Total Bruto:', 14, yPos);
    doc.text(formatCurrency(bruto), pageWidth - 14, yPos, { align: 'right' });
    
    // Descuentos detallados
    const brokerDiscounts = (broker as any).discounts_json;
    const hasDiscounts = brokerDiscounts && brokerDiscounts.adelantos && brokerDiscounts.adelantos.length > 0;
    
    if (hasDiscounts) {
      yPos += 8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('DESCUENTOS APLICADOS:', 14, yPos);
      
      brokerDiscounts.adelantos.forEach((desc: any) => {
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`• ${desc.description || 'Adelanto'}`, 20, yPos);
        doc.setTextColor(220, 38, 38);
        doc.text(formatCurrency(desc.amount), pageWidth - 14, yPos, { align: 'right' });
      });
      
      yPos += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Total Descuentos:', 14, yPos);
      doc.setTextColor(220, 38, 38);
      doc.text(formatCurrency(brokerDiscounts.total || 0), pageWidth - 14, yPos, { align: 'right' });
    } else {
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Descuentos:', 14, yPos);
      doc.text(formatCurrency(0), pageWidth - 14, yPos, { align: 'right' });
    }
    
    yPos += 8;
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;
    
    // Total Neto (a pagar)
    const neto = bruto - (brokerDiscounts?.total || 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL NETO:', 14, yPos);
    doc.setTextColor(...secondaryColor);
    doc.text(formatCurrency(neto), pageWidth - 14, yPos, { align: 'right' });
    
    // Retención
    if ((broker as any).is_retained) {
      yPos += 8;
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text('⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO', pageWidth / 2, yPos, { align: 'center' });
    }
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
  console.log('[Excel Export] Iniciando generación:', {
    brokersCount: brokers.length,
    label: fortnightLabel,
    totals
  });

  if (!brokers || brokers.length === 0) {
    console.error('[Excel Export] No hay brokers para exportar');
    throw new Error('No hay brokers para exportar');
  }

  // Ordenar brokers alfabéticamente
  brokers = [...brokers].sort((a, b) => a.broker_name.localeCompare(b.broker_name));

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
    ['Corredor', 'Email', 'Bruto', 'Descuentos', 'Neto'],
  ];

  brokers.forEach((b: any) => {
    const bruto = b.total_net; // Comisión con porcentaje aplicado
    const discountsTotal = b.discounts_json?.total || 0;
    const neto = bruto - discountsTotal; // Total a pagar
    
    summaryData.push([
      capitalizeText(b.broker_name),
      b.broker_email,
      bruto,
      discountsTotal,
      neto
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [
    { wch: 30 }, // Corredor
    { wch: 25 }, // Email
    { wch: 15 }, // Bruto
    { wch: 15 }, // Descuentos
    { wch: 15 }  // Neto
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Individual sheets for each broker
  brokers.forEach((broker: any, idx) => {
    const brokerData: any[] = [];
    brokerData.push([capitalizeText(broker.broker_name)]);
    brokerData.push(['Email:', broker.broker_email]);
    brokerData.push(['Período:', fortnightLabel]);
    brokerData.push(['Porcentaje:', `${(broker.percent_default * 100).toFixed(0)}%`]);
    brokerData.push([]);

    broker.insurers.forEach((insurer: any) => {
      // Total aseguradora = suma de comisiones calculadas (neto de cada cliente)
      brokerData.push([insurer.insurer_name, '', '', '', formatCurrency(insurer.total_gross)]);
      brokerData.push(['Póliza', 'Cliente', 'Bruto', '%', 'Comisión']);
      
      insurer.policies.forEach((policy: any) => {
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

    brokerData.push(['RESUMEN']);
    
    const bruto = broker.total_net; // Comisión con porcentaje aplicado
    brokerData.push(['Total Bruto:', '', '', '', bruto]);
    
    // Descuentos detallados
    const discounts = broker.discounts_json;
    const hasDiscounts = discounts && discounts.adelantos && discounts.adelantos.length > 0;
    
    if (hasDiscounts) {
      brokerData.push([]);
      brokerData.push(['DESCUENTOS APLICADOS:']);
      discounts.adelantos.forEach((desc: any) => {
        brokerData.push([`• ${desc.description || 'Adelanto'}`, '', '', '', desc.amount]);
      });
      brokerData.push([]);
      brokerData.push(['Total Descuentos:', '', '', '', discounts.total || 0]);
    } else {
      brokerData.push(['Descuentos:', '', '', '', 0]);
    }
    
    brokerData.push([]);
    const neto = bruto - (discounts?.total || 0);
    brokerData.push(['TOTAL NETO:', '', '', '', neto]);
    
    if (broker.is_retained) {
      brokerData.push([]);
      brokerData.push(['⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO']);
    }

    const brokerSheet = XLSX.utils.aoa_to_sheet(brokerData);
    brokerSheet['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    
    // Truncate sheet name to 31 characters (Excel limit)
    const sheetName = capitalizeText(broker.broker_name).substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, brokerSheet, sheetName);
  });

  const filename = `reporte_completo_${fortnightLabel.replace(/\s+/g, '_')}.xlsx`;
  console.log('[Excel Export] Guardando archivo:', filename);
  XLSX.writeFile(workbook, filename);
  console.log('[Excel Export] Archivo generado exitosamente');
}
