/**
 * Utilities para cálculo de comisiones en ajustes
 */

export interface BrokerInfo {
  id: string;
  name: string;
  percent_default: number | null;
  tipo_cuenta: string | null;
  national_id: string | null;
  nombre_completo: string | null;
  bank_account_no: string | null;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export interface CommItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  gross_amount: number;
  insurer_id: string | null;
  insurers?: {
    name: string;
  };
}

export interface ClaimItem {
  id: string;
  comm_item_id: string;
  broker_id: string;
  status: string;
  created_at: string;
  payment_type?: string | null;
  paid_date?: string | null;
  rejection_reason?: string | null;
  comm_items?: CommItem;
  brokers?: BrokerInfo;
}

export interface SelectedItem extends CommItem {
  rawAmount: number;
  brokerPercent: number;
  brokerAmount: number;
}

export interface ClaimReport {
  broker_id: string;
  broker_name: string;
  broker_email: string;
  total_raw_amount: number;
  total_broker_amount: number;
  item_count: number;
  status: string;
  items: ClaimItem[];
}

/**
 * Calcula el monto bruto de comisión del broker
 * @param rawAmount - Monto crudo de la importación
 * @param broker - Información del broker
 * @returns Monto bruto calculado
 */
export function calculateBrokerCommission(
  rawAmount: number,
  broker: BrokerInfo
): number {
  const percent = broker.percent_default ?? 0;
  return rawAmount * (percent / 100);
}

/**
 * Obtiene el porcentaje del broker
 * @param broker - Información del broker
 * @returns Porcentaje (0-100)
 */
export function getBrokerPercent(broker: BrokerInfo): number {
  return broker.percent_default ?? 0;
}

/**
 * Calcula totales de items seleccionados
 * @param items - Items seleccionados
 * @param broker - Información del broker
 * @returns Totales calculados
 */
export function calculateSelectionTotals(
  items: CommItem[],
  broker: BrokerInfo
): {
  totalRaw: number;
  totalBroker: number;
  count: number;
  percent: number;
} {
  const percent = getBrokerPercent(broker);
  const totalRaw = items.reduce((sum, item) => sum + Math.abs(item.gross_amount), 0);
  const totalBroker = totalRaw * (percent / 100);

  return {
    totalRaw,
    totalBroker,
    count: items.length,
    percent,
  };
}

/**
 * Agrupa claims por broker
 * @param claims - Lista de claims
 * @returns Claims agrupados por broker
 */
export function groupClaimsByBroker(claims: ClaimItem[]): Map<string, ClaimReport> {
  const grouped = new Map<string, ClaimReport>();

  claims.forEach((claim) => {
    if (!claim.brokers || !claim.comm_items) return;

    const brokerId = claim.broker_id;
    const broker = claim.brokers;
    const item = claim.comm_items;

    if (!grouped.has(brokerId)) {
      grouped.set(brokerId, {
        broker_id: brokerId,
        broker_name: broker.name,
        broker_email: broker.profiles?.email || '',
        total_raw_amount: 0,
        total_broker_amount: 0,
        item_count: 0,
        status: claim.status,
        items: [],
      });
    }

    const report = grouped.get(brokerId)!;
    const rawAmount = Math.abs(item.gross_amount);
    const brokerAmount = calculateBrokerCommission(rawAmount, broker);

    report.total_raw_amount += rawAmount;
    report.total_broker_amount += brokerAmount;
    report.item_count += 1;
    report.items.push(claim);
  });

  return grouped;
}

/**
 * Formatea un número como moneda USD
 * @param amount - Monto
 * @returns String formateado
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea porcentaje
 * @param percent - Porcentaje (0-100)
 * @returns String formateado
 */
export function formatPercent(percent: number): string {
  return `${percent.toFixed(2)}%`;
}

/**
 * Genera datos para CSV bancario de ajustes
 * @param reports - Reportes de ajustes aprobados
 * @returns Array de filas para CSV
 */
export function generateAdjustmentsCSVData(reports: ClaimReport[]): {
  headers: string[];
  rows: string[][];
} {
  const headers = [
    'NOMBRE',
    'TIPO',
    'CEDULA',
    'BANCO',
    'CUENTA',
    'MONTO',
    'CORREO',
    'DESCRIPCION',
  ];

  const rows: string[][] = [];

  reports.forEach((report) => {
    const broker = report.items[0]?.brokers;
    if (!broker || report.total_broker_amount <= 0) return;

    const fullName = broker.nombre_completo || broker.profiles?.full_name || broker.name;
    const accountType = broker.tipo_cuenta?.toUpperCase() || 'NATURAL';
    const nationalId = broker.national_id || '';
    const bankName = 'BANCO GENERAL'; // Campo bank_name no existe en brokers
    const accountNumber = broker.bank_account_no || '';
    const amount = report.total_broker_amount.toFixed(2);
    const email = broker.profiles?.email || '';

    rows.push([
      fullName,
      accountType,
      nationalId,
      bankName,
      accountNumber,
      amount,
      email,
      'AJUSTE COMISION',
    ]);
  });

  return { headers, rows };
}

/**
 * Convierte datos a formato CSV string
 * @param headers - Headers del CSV
 * @param rows - Filas del CSV
 * @returns String CSV
 */
export function convertToCSV(headers: string[], rows: string[][]): string {
  const csvRows = [headers.join(',')];
  
  rows.forEach((row) => {
    const escaped = row.map((cell) => {
      // Escapar comillas y envolver en comillas si contiene comas
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(escaped.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Descarga CSV como archivo
 * @param csv - String CSV
 * @param filename - Nombre del archivo
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Valida datos bancarios del broker
 * @param broker - Información del broker
 * @returns Objeto con validación y errores
 */
export function validateBrokerBankData(broker: BrokerInfo): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!broker.national_id) {
    errors.push('Falta cédula/RUC');
  }

  if (!broker.bank_account_no) {
    errors.push('Falta número de cuenta');
  }

  if (!broker.tipo_cuenta) {
    errors.push('Falta tipo de cuenta');
  }

  if (!broker.profiles?.full_name) {
    errors.push('Falta nombre completo');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Obtiene el estado badge para UI
 * @param status - Estado del claim
 * @returns Configuración de badge
 */
export function getClaimStatusBadge(status: string): {
  label: string;
  variant: 'warning' | 'success' | 'danger' | 'info' | 'default';
  icon: string;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Esperando Revisión',
        variant: 'warning',
        icon: 'FaClock',
      };
    case 'approved':
      return {
        label: 'Aprobado',
        variant: 'success',
        icon: 'FaCheckCircle',
      };
    case 'rejected':
      return {
        label: 'Rechazado',
        variant: 'danger',
        icon: 'FaTimesCircle',
      };
    case 'paid':
      return {
        label: 'Pagado',
        variant: 'success',
        icon: 'FaMoneyBillWave',
      };
    case 'queued':
      return {
        label: 'En Cola',
        variant: 'info',
        icon: 'FaCalendarAlt',
      };
    default:
      return {
        label: status,
        variant: 'default',
        icon: 'FaQuestion',
      };
  }
}
