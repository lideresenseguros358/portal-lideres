/**
 * FORMATO OFICIAL BANCO GENERAL ACH PARA AJUSTES
 * Utilidades para generar archivos ACH de ajustes
 * Formato oficial Banco General de Panamá
 */

import type { ClaimReport } from './adjustments-utils';
import {
  toUpperNoAccents,
  formatAccountForACH,
  normalizeRoute,
  truncate,
  getAccountTypeCode,
  formatACHAmount,
  cleanBeneficiaryId,
  generateACHReference
} from './ach-normalization';

/**
 * Genera referencia ACH para ajustes con fecha actual
 */
function generateAdjustmentReference(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  
  return generateACHReference(`AJUSTES ${day}/${month}/${year}`);
}

interface ACHRecord {
  id_beneficiario: string;        // 1-15 chars
  nombre_beneficiario: string;    // 1-22 chars
  ruta_destino: string;            // 1-9 numeric (código de ruta del banco desde ach_banks)
  cuenta_destino: string;          // 1-17 alphanumeric
  producto_destino: string;        // 2 chars (solo 03=Corriente o 04=Ahorro)
  monto: string;                   // ###0.00 format
  tipo_pago: string;               // C=Crédito, D=Débito
  referencia_texto: string;        // 1-80 chars, debe iniciar con REF*TXT** y finalizar con \
}

interface ValidationError {
  brokerId: string;
  brokerName: string;
  errors: string[];
}

/**
 * Genera archivo ACH para ajustes aprobados
 */
export function generateAdjustmentsACH(reports: ClaimReport[]): {
  content: string;
  errors: ValidationError[];
  validCount: number;
  totalAmount: number;
} {
  const records: ACHRecord[] = [];
  const errors: ValidationError[] = [];
  let sequenceId = 1;
  let totalAmount = 0;
  
  for (const report of reports) {
    const broker = report.items[0]?.brokers;
    if (!broker || report.total_broker_amount <= 0) continue;
    
    // Validar datos bancarios
    const validationErrors: string[] = [];
    
    const rawBankRoute = (broker as any).bank_route || '';
    const rawAccountNumber = (broker as any).bank_account_no || '';
    const rawAccountType = (broker as any).tipo_cuenta || '';
    
    if (!rawBankRoute) {
      validationErrors.push('Falta ruta bancaria');
    }
    if (!rawAccountNumber) {
      validationErrors.push('Falta número de cuenta');
    }
    if (!rawAccountType) {
      validationErrors.push('Falta tipo de cuenta');
    }
    
    if (validationErrors.length > 0) {
      errors.push({
        brokerId: broker.id,
        brokerName: broker.name || 'DESCONOCIDO',
        errors: validationErrors
      });
      continue;
    }
    
    // Normalizar datos según formato ACH oficial
    const beneficiaryId = cleanBeneficiaryId(String(sequenceId).padStart(3, '0'));
    const beneficiaryName = toUpperNoAccents((broker as any).beneficiary_name || (broker as any).nombre_completo || broker.profiles?.full_name || broker.name || '');
    const bankRoute = normalizeRoute(rawBankRoute);
    const accountNumber = formatAccountForACH(rawAccountNumber); // Formatea con 0 al inicio si es necesario
    const accountType = rawAccountType;
    
    const record: ACHRecord = {
      id_beneficiario: truncate(beneficiaryId, 15),
      nombre_beneficiario: truncate(beneficiaryName, 22),
      ruta_destino: bankRoute,
      cuenta_destino: truncate(accountNumber, 17),
      producto_destino: getAccountTypeCode(accountType),
      monto: formatACHAmount(report.total_broker_amount),
      tipo_pago: 'C',
      referencia_texto: generateAdjustmentReference()
    };
    
    records.push(record);
    totalAmount += report.total_broker_amount;
    sequenceId++;
  }
  
  const lines = records.map(r => [
    r.id_beneficiario,
    r.nombre_beneficiario,
    r.ruta_destino,
    r.cuenta_destino,
    r.producto_destino,
    r.monto,
    r.tipo_pago,
    r.referencia_texto
  ].join(';'));
  
  return {
    content: lines.join('\n'),
    errors,
    validCount: records.length,
    totalAmount
  };
}

/**
 * Genera nombre de archivo ACH para ajustes
 */
export function getAdjustmentsACHFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `AJUSTES_COMISIONES_${year}${month}${day}.txt`;
}

/**
 * Descarga archivo ACH de ajustes
 */
export function downloadAdjustmentsACH(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
