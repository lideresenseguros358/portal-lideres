import * as XLSX from 'xlsx';

export interface BankTransferRow {
  date: Date;
  reference_number: string;
  transaction_code: string;
  description: string;
  amount: number;
}

/**
 * Parser para archivos XLSX del Banco General
 * Formato esperado:
 * - Fecha | Referencia | Transacción | Descripción | Débito | Crédito | Saldo total
 */
export async function parseBankHistoryXLSX(file: File): Promise<BankTransferRow[]> {
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
        
        // Encontrar el índice de la fila de encabezados
        let headerIndex = -1;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (Array.isArray(row) && row.some((cell: any) => 
            String(cell).toLowerCase().includes('fecha') || 
            String(cell).toLowerCase().includes('referencia')
          )) {
            headerIndex = i;
            break;
          }
        }
        
        if (headerIndex === -1) {
          throw new Error('No se encontró el encabezado en el archivo');
        }
        
        // Obtener encabezados
        const headers = jsonData[headerIndex].map((h: any) => String(h || '').toLowerCase().trim());
        
        // Mapear índices de columnas
        const dateIdx = headers.findIndex((h: string) => h.includes('fecha'));
        const refIdx = headers.findIndex((h: string) => h.includes('referencia'));
        const transIdx = headers.findIndex((h: string) => h.includes('transac') || h.includes('transacci'));
        const descIdx = headers.findIndex((h: string) => h.includes('descri'));
        const creditIdx = headers.findIndex((h: string) => h.includes('crédito') || h.includes('credito'));
        
        if (dateIdx === -1 || refIdx === -1 || creditIdx === -1) {
          throw new Error('Columnas requeridas no encontradas: Fecha, Referencia, Crédito');
        }
        
        // Procesar filas de datos
        const transfers: BankTransferRow[] = [];
        
        for (let i = headerIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!Array.isArray(row) || row.length === 0) continue;
          
          // Obtener valores
          const dateValue = row[dateIdx];
          const refValue = row[refIdx];
          const creditValue = row[creditIdx];
          
          // Saltar si no hay crédito (solo procesamos ingresos)
          if (!creditValue || creditValue === '' || creditValue === 0) continue;
          
          // Parsear fecha
          let date: Date;
          if (typeof dateValue === 'number') {
            // Excel serial date
            date = XLSX.SSF.parse_date_code(dateValue);
          } else if (typeof dateValue === 'string') {
            // Formato DD-MMM-YYYY o similar
            const parts = dateValue.split('-');
            if (parts.length === 3) {
              const monthMap: { [key: string]: number } = {
                'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
              };
              const day = parseInt(parts[0] || '0');
              const monthStr = (parts[1] || '').toLowerCase().substring(0, 3);
              const year = parseInt(parts[2] || '0');
              const month = monthMap[monthStr] ?? 0;
              
              if (month !== undefined && !isNaN(day) && !isNaN(year)) {
                date = new Date(year, month, day);
              } else {
                date = new Date(dateValue);
              }
            } else {
              date = new Date(dateValue);
            }
          } else {
            continue; // Saltar fila sin fecha válida
          }
          
          if (isNaN(date.getTime())) continue;
          
          // Parsear referencia
          const reference = String(refValue).trim();
          if (!reference || reference === '') continue;
          
          // Parsear monto
          let amount = 0;
          if (typeof creditValue === 'number') {
            amount = creditValue;
          } else if (typeof creditValue === 'string') {
            // Limpiar formato: $115.00 → 115.00
            amount = parseFloat(creditValue.replace(/[$,]/g, ''));
          }
          
          if (isNaN(amount) || amount <= 0) continue;
          
          transfers.push({
            date,
            reference_number: reference,
            transaction_code: transIdx !== -1 ? String(row[transIdx] || '').trim() : '',
            description: descIdx !== -1 ? String(row[descIdx] || '').trim() : '',
            amount
          });
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
 * Validar formato del archivo
 */
export function validateBankFile(file: File): { valid: boolean; error?: string } {
  // Verificar extensión
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') {
    return { valid: false, error: 'El archivo debe ser formato Excel (.xlsx o .xls)' };
  }
  
  // Verificar tamaño (máx 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'El archivo es demasiado grande (máx 10MB)' };
  }
  
  return { valid: true };
}
