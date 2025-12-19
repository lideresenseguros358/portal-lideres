/**
 * Parser para extractos bancarios del módulo BANCO (Comisiones)
 * Basado en el parser de cheques pero adaptado para comisiones
 * Formato: Fecha | Ref 1 | Descripción | Crédito
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface BankTransferCommRow {
  date: string; // ISO yyyy-mm-dd
  reference_number: string;
  description: string; // Descripción RAW del banco
  credit: number; // Monto en crédito
}

type HeaderMap = {
  dateIdx: number;
  ref1Idx: number;
  descIdx: number;
  creditIdx: number;
};

const MONTH_MAP: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sept: 8, sep: 8, oct: 9, nov: 10, dic: 11,
};

// Prefijos a eliminar de la descripción para normalizar
const DESCRIPTION_PREFIXES_TO_CLEAN = [
  'BANCA EN LINEA TRANSFERENCIA DE ',
  'ACH - ',
  'BANCA MOVIL TRANSFERENCIA DE ',
  'ACH EXPRESS - ',
];

// Descripciones a filtrar (LIDERES EN SEGUROS)
const DESCRIPTIONS_TO_FILTER = [
  'LIDERES EN SEGUROS',
  'LISSA',
];

/**
 * Normalizar descripción:
 * - Quitar prefijos comunes
 * - Mantener RAW para registro
 */
export function normalizeDescription(raw: string): string {
  if (!raw) return '';
  
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const upper = normalized.toUpperCase();
  
  // Quitar prefijos
  for (const prefix of DESCRIPTION_PREFIXES_TO_CLEAN) {
    if (upper.startsWith(prefix)) {
      return normalized.substring(prefix.length).trim();
    }
  }
  
  return normalized;
}

/**
 * Verificar si la descripción debe ser filtrada
 */
export function shouldFilterDescription(description: string): boolean {
  if (!description) return false;
  
  const upper = description.toUpperCase();
  
  // Filtrar si contiene LIDERES EN SEGUROS o LISSA
  for (const filter of DESCRIPTIONS_TO_FILTER) {
    if (upper.includes(filter)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Parser XLSX
 */
function parseBankCommXLSX(file: File): Promise<BankTransferCommRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No se encontraron hojas en el archivo');
        
        const firstSheet = workbook.Sheets[sheetName];
        if (!firstSheet) throw new Error('No se pudo leer la hoja del archivo');
        
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Encontrar encabezado - buscar fila que tenga TODAS las columnas clave
        let headerIndex = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i];
          if (!Array.isArray(row)) continue;
          
          const rowStr = row.map((cell: any) => String(cell || '').toLowerCase().trim()).join('|');
          
          // Verificar que tenga las columnas clave: Fecha, Referencia, Descripción, Crédito
          const hasFecha = rowStr.includes('fecha');
          const hasReferencia = rowStr.includes('referencia');
          const hasDescripcion = rowStr.includes('descri');
          const hasCredito = rowStr.includes('crédito') || rowStr.includes('credito');
          
          if (hasFecha && hasReferencia && hasDescripcion && hasCredito) {
            headerIndex = i;
            break;
          }
        }
        
        if (headerIndex === -1) {
          throw new Error('No se encontró el encabezado en el archivo. Verifica que tenga las columnas: Fecha, Referencia, Descripción, Crédito');
        }
        
        const headers = jsonData[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());

        const headerMap: HeaderMap = {
          dateIdx: headers.findIndex((h: string) => h.includes('fecha')),
          ref1Idx: headers.findIndex((h: string) => {
            const normalized = h.replace(/\s+/g, ' ').trim();
            return normalized === 'referencia 1' || normalized.includes('referencia 1');
          }),
          descIdx: headers.findIndex((h: string) => h.includes('descri')),
          creditIdx: headers.findIndex((h: string) => h.includes('crédito') || h.includes('credito')),
        };
        
        if (headerMap.dateIdx === -1 || headerMap.ref1Idx === -1 || headerMap.creditIdx === -1 || headerMap.descIdx === -1) {
          throw new Error('Columnas requeridas no encontradas: Fecha, Referencia 1, Descripción, Crédito');
        }
        
        const transfers: BankTransferCommRow[] = [];
        
        for (let i = headerIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const transfer = normalizeTransferRow(
            row[headerMap.dateIdx],
            row[headerMap.ref1Idx],
            row[headerMap.descIdx],
            row[headerMap.creditIdx]
          );

          if (transfer) {
            transfers.push(transfer);
          }
        }
        
        resolve(transfers);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Parser CSV
 */
function parseBankCommCSV(file: File): Promise<BankTransferCommRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: (results) => {
        try {
          const rows = results.data as Record<string, any>[];
          const transfers: BankTransferCommRow[] = [];

          rows.forEach((row) => {
            const keys = Object.keys(row);
            const headerMap: HeaderMap = {
              dateIdx: keys.findIndex((k) => k.includes('fecha')),
              ref1Idx: keys.findIndex((k) => {
                const normalized = k.replace(/\s+/g, ' ').trim();
                return normalized === 'referencia 1' || normalized.includes('referencia 1');
              }),
              descIdx: keys.findIndex((k) => k.includes('descri')),
              creditIdx: keys.findIndex((k) => k.includes('crédito') || k.includes('credito')),
            };

            if (headerMap.dateIdx === -1 || headerMap.ref1Idx === -1 || headerMap.descIdx === -1 || headerMap.creditIdx === -1) {
              return;
            }

            const values = keys.map((k) => row[k]);
            const transfer = normalizeTransferRow(
              values[headerMap.dateIdx],
              values[headerMap.ref1Idx],
              values[headerMap.descIdx],
              values[headerMap.creditIdx]
            );

            if (transfer) {
              transfers.push(transfer);
            }
          });

          resolve(transfers);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
}

/**
 * Normalizar fila de transferencia
 */
function normalizeTransferRow(
  rawDate: any,
  rawReference: any,
  rawDescription: any,
  rawCredit: any
): BankTransferCommRow | null {
  // Parse date
  const date = parseDateValue(rawDate);
  if (!date) return null;

  const reference = String(rawReference ?? '').trim();
  if (!reference) return null;

  const description = String(rawDescription ?? '').trim();
  
  // Filtrar si es 0.00 en crédito
  const credit = parseAmountValue(rawCredit);
  if (credit <= 0) return null;

  // Filtrar si la descripción contiene LIDERES EN SEGUROS
  if (shouldFilterDescription(description)) {
    return null;
  }

  return {
    date,
    reference_number: reference,
    description, // Mantener RAW
    credit,
  };
}

/**
 * Parsear fecha (igual que cheques)
 */
function parseDateValue(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;

  let date: Date | null = null;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      date = new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  } else if (typeof value === 'string') {
    const sanitized = value.trim();

    const parts = sanitized.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0] || '0', 10);
      const monthStr = (parts[1] || '').toLowerCase().substring(0, 3);
      const year = parseInt(parts[2] || '0', 10);
      const month = MONTH_MAP[monthStr];
      if (!isNaN(day) && !isNaN(year) && month !== undefined) {
        date = new Date(year, month, day);
      }
    }

    if (!date || isNaN(date.getTime())) {
      const parsed = new Date(sanitized);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
  }

  if (!date || isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0] as string;
}

/**
 * Parsear monto
 */
function parseAmountValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Parser principal
 */
export async function parseBankCommFile(file: File): Promise<BankTransferCommRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseBankCommCSV(file);
  }
  return parseBankCommXLSX(file);
}

/**
 * Validar archivo
 */
export function validateBankCommFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
    return { valid: false, error: 'El archivo debe ser formato Excel (.xlsx, .xls) o CSV (.csv)' };
  }
  
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'El archivo es demasiado grande (máx 10MB)' };
  }

  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv'
  ];
  
  if (file.type && !allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de archivo no soportado' };
  }
  
  return { valid: true };
}
