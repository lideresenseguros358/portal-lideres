import type { Tables } from '@/lib/supabase/server';

type BrokerRow = Tables<'brokers'>;
type FortnightBrokerTotal = Tables<'fortnight_broker_totals'>;

interface BankCsvRow {
  account_number: string;
  beneficiary_name: string;
  amount: number;
  reference: string;
}

/**
 * Build bank CSV content from fortnight broker totals
 */
export async function buildBankCsv(
  totalsByBroker: Array<FortnightBrokerTotal & { broker?: BrokerRow }>
): Promise<string> {
  const rows: BankCsvRow[] = [];
  
  for (const total of totalsByBroker) {
    // Skip if net amount is 0 or negative
    const netAmount = Number(total.net_amount) || 0;
    if (netAmount <= 0) continue;
    
    // Extract bank info from bank_snapshot or broker data
    const bankSnapshot = total.bank_snapshot as any || {};
    
    rows.push({
      account_number: bankSnapshot.account_no || total.broker?.bank_account_no || 'PENDING',
      beneficiary_name: bankSnapshot.name || total.broker?.name || 'Unknown',
      amount: netAmount,
      reference: `COM-${total.fortnight_id?.slice(0, 8)}`,
    });
  }
  
  // Build CSV content
  const headers = ['Cuenta', 'Beneficiario', 'Monto', 'Referencia'];
  const csvRows = [
    headers.join(','),
    ...rows.map(row => [
      row.account_number,
      `"${row.beneficiary_name}"`,
      row.amount.toFixed(2),
      row.reference,
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
