import type { Tables } from '@/lib/supabase/server';

type BrokerRow = Tables<'brokers'>;
type FortnightBrokerTotal = Tables<'fortnight_broker_totals'>;

interface BankCsvRow {
  tipo_cuenta: string;
  numero_cuenta: string;
  numero_cedula: string;
  nombre_completo: string;
  monto: number;
  concepto: string;
}

/**
 * Build bank CSV content from fortnight broker totals
 * Formato Banco General:
 * "Tipo de cuenta","Numero de cuenta","Numero de cedula o identificacion","Nombre completo","Monto","Concepto de pago"
 */
export async function buildBankCsv(
  totalsByBroker: Array<FortnightBrokerTotal & { broker?: BrokerRow }>,
  fortnightLabel?: string
): Promise<string> {
  const rows: BankCsvRow[] = [];
  
  for (const total of totalsByBroker) {
    // Skip if net amount is 0 or negative
    const netAmount = Number(total.net_amount) || 0;
    if (netAmount <= 0) continue;
    
    const broker = total.broker;
    if (!broker) continue;
    
    rows.push({
      tipo_cuenta: (broker as any).tipo_cuenta || 'Ahorro',
      numero_cuenta: (broker as any).numero_cuenta || 'PENDIENTE',
      numero_cedula: (broker as any).numero_cedula || 'PENDIENTE',
      nombre_completo: (broker as any).nombre_completo || broker.name || 'PENDIENTE',
      monto: netAmount,
      concepto: `Pago comisiones ${fortnightLabel || 'quincena'}`,
    });
  }
  
  // Build CSV content con headers Banco General
  const headers = ['"Tipo de cuenta"', '"Numero de cuenta"', '"Numero de cedula o identificacion"', '"Nombre completo"', '"Monto"', '"Concepto de pago"'];
  const csvRows = [
    headers.join(','),
    ...rows.map(row => [
      `"${row.tipo_cuenta}"`,
      `"${row.numero_cuenta}"`,
      `"${row.numero_cedula}"`,
      `"${row.nombre_completo}"`,
      `"${row.monto.toFixed(2)}"`,
      `"${row.concepto}"`,
    ].join(','))
  ];
  
  return csvRows.join('\n');
}

/**
 * Generate bank CSV filename with timestamp
 */
export function getBankCsvFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:-]/g, '')
    .replace('T', '_')
    .split('.')[0];
  
  return `pagos_banco_${timestamp}.csv`;
}

/**
 * Create downloadable blob from CSV content
 */
export function createCsvBlob(csvContent: string): Blob {
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}
