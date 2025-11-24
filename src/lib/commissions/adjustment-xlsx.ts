import * as XLSX from 'xlsx';

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
 * Generar archivo Excel de reporte de ajuste pagado
 */
export function generateAdjustmentXLSX(report: AdjustmentReport): XLSX.WorkBook {
  // Crear workbook
  const wb = XLSX.utils.book_new();

  // Hoja de información general
  const infoData = [
    ['REPORTE DE AJUSTES'],
    ['Portal Líderes en Seguros'],
    [],
    ['Información del Reporte'],
    ['Broker:', report.broker_name],
    ['Fecha de Creación:', new Date(report.created_at).toLocaleDateString('es-PA')],
    ['Fecha de Pago:', report.paid_date ? new Date(report.paid_date).toLocaleDateString('es-PA') : 'N/A'],
    ['Modalidad de Pago:', report.payment_mode === 'immediate' ? 'Pago Inmediato' : 'Siguiente Quincena'],
    ['Total de Items:', report.items.length],
    [],
    ['Detalle de Ajustes'],
    ['Póliza', 'Cliente', 'Aseguradora', 'Monto Crudo', 'Comisión Broker'],
  ];

  // Agregar items
  report.items.forEach(item => {
    infoData.push([
      item.policy_number,
      item.insured_name || 'N/A',
      item.insurer_name || 'N/A',
      Math.abs(item.commission_raw),
      item.broker_commission
    ]);
  });

  // Agregar total
  infoData.push([]);
  infoData.push(['', '', 'TOTAL:', '', report.total_amount]);

  // Crear hoja
  const ws = XLSX.utils.aoa_to_sheet(infoData);

  // Estilos (ancho de columnas)
  ws['!cols'] = [
    { wch: 15 }, // Póliza
    { wch: 30 }, // Cliente
    { wch: 20 }, // Aseguradora
    { wch: 15 }, // Monto Crudo
    { wch: 18 }  // Comisión Broker
  ];

  // Agregar hoja al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Ajustes');

  return wb;
}

/**
 * Descargar Excel de reporte de ajuste
 */
export function downloadAdjustmentXLSX(report: AdjustmentReport) {
  const wb = generateAdjustmentXLSX(report);
  const fileName = `Ajuste_${report.broker_name.replace(/\s+/g, '_')}_${new Date(report.paid_date || report.created_at).toLocaleDateString('es-PA').replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
