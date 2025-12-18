/**
 * FORMATO OFICIAL BANCO GENERAL ACH - PANAMÁ
 * Basado en "FORMATO DE ARCHIVO TEXTO (clientes) (002).pdf"
 * 
 * Este archivo genera el formato ACH oficial para carga masiva de pagos
 * en Banca en Línea Comercial de Banco General.
 * 
 * Formato: Texto plano delimitado por punto y coma (;)
 * Codificación: UTF-8 sin BOM
 * Sin encabezados
 */

import type { Tables } from '@/lib/supabase/server';
import {
  toUpperNoAccents,
  formatAccountForACH,
  normalizeRoute,
  truncate,
  getAccountTypeCode,
  formatACHAmount,
  generateACHReference,
  validateBrokerForACH,
  cleanBeneficiaryId
} from './ach-normalization';

type BrokerRow = Tables<'brokers'>;
type FortnightBrokerTotal = Tables<'fortnight_broker_totals'>;

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

// Todas las funciones de normalización y validación están en ach-normalization.ts

/**
 * Genera una línea del archivo ACH
 */
function generateACHLine(record: ACHRecord): string {
  return [
    record.id_beneficiario,
    record.nombre_beneficiario,
    record.ruta_destino,
    record.cuenta_destino,
    record.producto_destino,
    record.monto,
    record.tipo_pago,
    record.referencia_texto
  ].join(';');
}

/**
 * Construye el contenido completo del archivo ACH para pagos de comisiones
 */
export async function buildBankACH(
  totalsByBroker: Array<FortnightBrokerTotal & { broker?: BrokerRow }>,
  referenceText: string = 'PAGO COMISIONES'
): Promise<{ 
  content: string; 
  errors: ValidationError[];
  validCount: number;
  totalAmount: number;
}> {
  const records: ACHRecord[] = [];
  const errors: ValidationError[] = [];
  let sequenceId = 1;
  let totalAmount = 0;
  
  for (const total of totalsByBroker) {
    // Skip if net amount is 0 or negative
    const netAmount = Number(total.net_amount) || 0;
    if (netAmount <= 0) {
      console.log(`[buildBankACH] Broker ${total.broker?.name} RECHAZADO: net <= 0 (${netAmount})`);
      continue;
    }
    
    const broker = total.broker;
    if (!broker) {
      console.log(`[buildBankACH] Total sin broker asociado`);
      continue;
    }
    
    // Validar datos del broker
    const validation = validateBrokerForACH(broker);
    if (!validation.valid) {
      console.log(`[buildBankACH] Broker ${broker.name} RECHAZADO por validación:`, validation.errors);
      errors.push({
        brokerId: broker.id,
        brokerName: broker.name || 'DESCONOCIDO',
        errors: validation.errors
      });
      continue; // Skip this broker
    }
    
    console.log(`[buildBankACH] Broker ${broker.name} APROBADO - Generando línea ACH`);

    
    // Extraer y normalizar datos del broker según formato ACH oficial
    // NOTA: bank_route está conectado con tabla ach_banks via foreign key,
    // garantizando que siempre sea un código de ruta válido de un banco activo
    const beneficiaryId = cleanBeneficiaryId(String(sequenceId).padStart(3, '0'));
    const beneficiaryName = toUpperNoAccents(broker.beneficiary_name || broker.nombre_completo || broker.name || '');
    const bankRoute = normalizeRoute(broker.bank_route); // Código de ruta del banco (ej: 71)
    const accountNumber = formatAccountForACH(broker.bank_account_no); // Formatea con 0 al inicio si es necesario
    const accountType = broker.tipo_cuenta || ''; // Solo '03' (Corriente) o '04' (Ahorro)
    
    // Construir registro ACH con formato exacto del instructivo oficial
    const record: ACHRecord = {
      // Campo 1: ID Beneficiario (alfanum., 1-15)
      id_beneficiario: truncate(beneficiaryId, 15),
      
      // Campo 2: Nombre Beneficiario (alfanum., 1-22, normalizado ACH)
      nombre_beneficiario: truncate(beneficiaryName, 22),
      
      // Campo 3: Ruta Destino (num., 1-9, sin ceros iniciales innecesarios)
      ruta_destino: bankRoute,
      
      // Campo 4: Cuenta Destino (alfanum., 1-17, sin espacios/guiones)
      cuenta_destino: truncate(accountNumber, 17),
      
      // Campo 5: Producto Destino (num., 2 chars: 03=Corriente, 04=Ahorro)
      producto_destino: getAccountTypeCode(accountType),
      
      // Campo 6: Monto (num., ###0.00, 2 decimales)
      monto: formatACHAmount(netAmount),
      
      // Campo 7: Tipo Pago (alfanum., 1: C=crédito, D=débito)
      tipo_pago: 'C',
      
      // Campo 8: Referencia Texto (alfanum., 1-80, inicia REF*TXT**, termina \)
      referencia_texto: generateACHReference(referenceText)
    };
    
    records.push(record);
    totalAmount += netAmount;
    sequenceId++;
  }
  
  // Ordenar registros alfabéticamente por nombre del beneficiario
  records.sort((a, b) => a.nombre_beneficiario.localeCompare(b.nombre_beneficiario));
  
  // Re-numerar IDs después de ordenar
  records.forEach((record, index) => {
    record.id_beneficiario = String(index + 1).padStart(3, '0');
  });
  
  // Generar contenido del archivo
  const lines = records.map(generateACHLine);
  const content = lines.join('\n');
  
  return {
    content,
    errors,
    validCount: records.length,
    totalAmount
  };
}

/**
 * Genera nombre de archivo ACH con timestamp
 */
export function getACHFilename(prefix: string = 'PAGOS_COMISIONES'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${prefix}_${year}${month}${day}.txt`;
}

/**
 * Crea blob descargable del archivo ACH
 * UTF-8 sin BOM
 */
export function createACHBlob(content: string): Blob {
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

/**
 * Descarga archivo ACH
 */
export function downloadACH(content: string, filename: string): void {
  const blob = createACHBlob(content);
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
