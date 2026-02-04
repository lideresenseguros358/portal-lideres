import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface BankTransferRow {
  date: string; // ISO yyyy-mm-dd
  reference_number: string;
  transaction_code: string;
  description: string;
  amount: number;
}

type HeaderMap = {
  dateIdx: number;
  refIdx: number;
  transIdx: number;
  descIdx: number;
  creditIdx: number;
};

const MONTH_MAP: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sept: 8,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

/**
 * Parser para archivos XLSX del Banco General
 * Formato esperado:
 * - Fecha | Referencia | Transacción | Descripción | Débito | Crédito | Saldo total
 */
function parseBankHistoryXLSX(file: File): Promise<BankTransferRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Tomar la primera hoja
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No se encontraron hojas en el archivo');
        const firstSheet = workbook.Sheets[sheetName];
        if (!firstSheet) throw new Error('No se pudo leer la hoja del archivo');
        
        // Convertir a JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Encontrar el índice de la fila de encabezados - verificar TODAS las columnas clave
        let headerIndex = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i];
          if (!Array.isArray(row)) continue;
          
          const rowStr = row.map((cell: any) => String(cell || '').toLowerCase().trim()).join('|');
          
          // Verificar que tenga las columnas clave: Fecha, Referencia, Crédito
          const hasFecha = rowStr.includes('fecha');
          const hasReferencia = rowStr.includes('referencia');
          const hasCredito = rowStr.includes('crédito') || rowStr.includes('credito');
          
          if (hasFecha && hasReferencia && hasCredito) {
            headerIndex = i;
            console.log(`[BankParser] Header encontrado en fila ${i}:`, row);
            break;
          }
        }
        
        if (headerIndex === -1) {
          throw new Error('No se encontró el encabezado en el archivo. Verifica que tenga las columnas: Fecha, Referencia, Crédito');
        }
        
        // Obtener encabezados
        const headers = jsonData[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());
        console.log('[BankParser] Headers detectados:', headers);

        const headerMap: HeaderMap = {
          dateIdx: headers.findIndex((h: string) => h.includes('fecha')),
          refIdx: headers.findIndex((h: string) => {
            // Buscar cualquier variación de "referencia"
            const normalized = h.replace(/\s+/g, ' ').trim();
            return (
              normalized.includes('referencia 1') ||
              normalized === 'referencia' ||
              normalized.startsWith('ref.') ||
              normalized.startsWith('referencia') ||
              (normalized.includes('referencia') && !normalized.includes('transferencia'))
            );
          }),
          transIdx: headers.findIndex((h: string) => 
            (h.includes('transac') || h.includes('transacci') || h.includes('código')) && !h.includes('transferencia')
          ),
          descIdx: headers.findIndex((h: string) => h.includes('descri')),
          creditIdx: headers.findIndex((h: string) => h.includes('crédito') || h.includes('credito')),
        };
        
        console.log('[BankParser] HeaderMap:', headerMap);

        // Si no encontramos Referencia en el primer intento, buscar la primera columna que contenga "referencia"
        if (headerMap.refIdx === -1) {
          console.log('[BankParser] Referencia no encontrada, buscando alternativas...');
          for (let i = 0; i < headers.length; i++) {
            if (headers[i].includes('ref') && !headers[i].includes('transferencia')) {
              headerMap.refIdx = i;
              console.log(`[BankParser] Referencia encontrada en índice ${i}: ${headers[i]}`);
              break;
            }
          }
        }

        if (headerMap.dateIdx === -1 || headerMap.refIdx === -1 || headerMap.creditIdx === -1) {
          console.error('[BankParser] Error: Columnas no encontradas. Headers:', headers);
          console.error('[BankParser] HeaderMap resultante:', headerMap);
          throw new Error(`Columnas requeridas no encontradas. Fecha: ${headerMap.dateIdx}, Referencia: ${headerMap.refIdx}, Crédito: ${headerMap.creditIdx}`);
        }
        
        // Procesar filas de datos
        const transfers: BankTransferRow[] = [];
        
        for (let i = headerIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const transfer = normalizeTransferRow(
            row[headerMap.dateIdx],
            row[headerMap.refIdx],
            headerMap.transIdx !== -1 ? row[headerMap.transIdx] : '',
            headerMap.descIdx !== -1 ? row[headerMap.descIdx] : '',
            row[headerMap.creditIdx]
          );

          if (transfer) {
            transfers.push(transfer);
          }
        }
        
        console.log(`[BankParser] Total transferencias procesadas: ${transfers.length}`);
        resolve(transfers);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsBinaryString(file);
  });
}

function parseBankHistoryCSV(file: File): Promise<BankTransferRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim(),
      complete: (results) => {
        try {
          const rows = results.data as Record<string, any>[];
          const transfers: BankTransferRow[] = [];

          rows.forEach((row) => {
            const keys = Object.keys(row);
            const headerMap: HeaderMap = {
              dateIdx: keys.findIndex((k) => k.includes('fecha')),
              refIdx: keys.findIndex((k) => {
                const normalized = k.replace(/\s+/g, ' ').trim();
                return (
                  normalized.includes('referencia 1') ||
                  normalized === 'referencia' ||
                  normalized.startsWith('ref.') ||
                  normalized.startsWith('referencia') ||
                  (normalized.includes('referencia') && !normalized.includes('transferencia'))
                );
              }),
              transIdx: keys.findIndex((k) => 
                (k.includes('transac') || k.includes('transacci') || k.includes('código')) && !k.includes('transferencia')
              ),
              descIdx: keys.findIndex((k) => k.includes('descri')),
              creditIdx: keys.findIndex((k) => k.includes('crédito') || k.includes('credito') || k.includes('monto')),
            };

            if (headerMap.dateIdx === -1 || headerMap.refIdx === -1 || headerMap.creditIdx === -1) {
              return;
            }

            const values = keys.map((k) => row[k]);
            const transfer = normalizeTransferRow(
              values[headerMap.dateIdx],
              values[headerMap.refIdx],
              headerMap.transIdx !== -1 ? values[headerMap.transIdx] : '',
              headerMap.descIdx !== -1 ? values[headerMap.descIdx] : '',
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

function normalizeTransferRow(
  rawDate: any,
  rawReference: any,
  rawTransaction: any,
  rawDescription: any,
  rawAmount: any
): BankTransferRow | null {
  // Parse date
  const date = parseDateValue(rawDate);
  if (!date) return null;

  const reference = String(rawReference ?? '').trim();
  if (!reference) return null;

  const amount = parseAmountValue(rawAmount);
  if (amount <= 0) return null;

  return {
    date,
    reference_number: reference,
    transaction_code: String(rawTransaction ?? '').trim(),
    description: String(rawDescription ?? '').trim(),
    amount,
  };
}

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

export async function parseBankHistoryFile(file: File): Promise<BankTransferRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseBankHistoryCSV(file);
  }
  return parseBankHistoryXLSX(file);
}

/**
 * Validar formato del archivo
 */
export function validateBankFile(file: File): { valid: boolean; error?: string } {
  // Verificar extensión
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
    return { valid: false, error: 'El archivo debe ser formato Excel (.xlsx, .xls) o CSV (.csv)' };
  }
  
  // Verificar tamaño (máx 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'El archivo es demasiado grande (máx 10MB)' };
  }

  // Verificar mimetype básico
  const allowedTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv'];
  if (file.type && !allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Tipo de archivo no soportado' };
  }
  
  return { valid: true };
}
