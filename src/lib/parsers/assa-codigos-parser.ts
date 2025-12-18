/**
 * Parser especial para CÓDIGOS ASSA
 * Lee reportes de estado de cuenta de ASSA con códigos PJ750-xxx
 * Extrae licencias y comisiones pagadas para distribución a brokers
 */

import * as XLSX from 'xlsx';

export interface AssaCodigoRow {
  licencia: string; // Código ASSA (ej: PJ750-54)
  comision_pagada: number;
}

const EXCLUDED_CODES = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];

/**
 * Valida si un código ASSA es válido para procesamiento
 * Debe ser PJ750-xxx donde xxx NO tiene ceros a la izquierda
 * y NO está en la lista de exclusión
 */
function isValidAssaCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  
  // Excluir códigos específicos
  if (EXCLUDED_CODES.includes(normalized)) {
    return false;
  }
  
  // Debe empezar con PJ750-
  if (!normalized.startsWith('PJ750-')) {
    return false;
  }
  
  // Extraer el número después del guion
  const parts = normalized.split('-');
  if (parts.length !== 2) {
    return false;
  }
  
  const numberPart = parts[1];
  if (!numberPart) {
    return false;
  }
  
  // Verificar que es un número válido
  if (!/^\d+$/.test(numberPart)) {
    return false;
  }
  
  // NO debe empezar con cero (excepto si es solo "0")
  if (numberPart.length > 1 && numberPart.startsWith('0')) {
    return false;
  }
  
  return true;
}

/**
 * Parsea archivo Excel de ASSA con códigos
 * Busca columnas "LICENCIA" y "COMISION PAGADA"
 */
export function parseAssaCodigosExcel(buffer: ArrayBuffer): AssaCodigoRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  
  if (!firstSheetName) {
    throw new Error('El archivo Excel no tiene hojas');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('No se pudo leer la hoja de Excel');
  }

  // Convertir a array de arrays
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet as XLSX.WorkSheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  });

  console.log('[ASSA_CODIGOS] Total rows:', jsonData.length);

  // Buscar fila de headers (más flexible con nombres de columnas)
  let headerRowIndex = -1;
  let licenciaColIndex = -1;
  let comisionColIndex = -1;

  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i] as string[];
    
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = String(row[colIdx] || '').trim().toUpperCase();
      
      // Buscar columna de licencia/código (más flexible)
      if (cell.includes('LICENCIA') || cell.includes('CODIGO') || cell.includes('CÓDIGO') || 
          cell.includes('LIC') || cell.includes('COD')) {
        licenciaColIndex = colIdx;
        headerRowIndex = i;
        console.log('[ASSA_CODIGOS] Columna Licencia:', colIdx, 'en fila', i, '- Header:', cell);
      }
      
      // Buscar columna de comisión (más flexible)
      if ((cell.includes('COMISION') || cell.includes('COMISIÓN')) && 
          (cell.includes('PAGADA') || cell.includes('PAGAR') || cell.includes('TOTAL'))) {
        comisionColIndex = colIdx;
        console.log('[ASSA_CODIGOS] Columna Comisión:', colIdx, 'en fila', i, '- Header:', cell);
      }
      
      // Alternativa: buscar solo "COMISION" o "HONORARIOS"
      if (comisionColIndex === -1 && (cell.includes('COMISION') || cell.includes('COMISIÓN') || 
          cell.includes('HONORARIO') || cell.includes('MONTO'))) {
        comisionColIndex = colIdx;
        console.log('[ASSA_CODIGOS] Columna Comisión (alternativa):', colIdx, 'en fila', i, '- Header:', cell);
      }
    }
    
    if (headerRowIndex !== -1 && licenciaColIndex !== -1 && comisionColIndex !== -1) {
      console.log('[ASSA_CODIGOS] Headers encontrados en fila', i);
      break;
    }
  }

  if (headerRowIndex === -1 || licenciaColIndex === -1 || comisionColIndex === -1) {
    console.error('[ASSA_CODIGOS] No se encontraron columnas. Licencia:', licenciaColIndex, 'Comisión:', comisionColIndex);
    console.error('[ASSA_CODIGOS] Primeras 5 filas del archivo:', jsonData.slice(0, 5));
    throw new Error('No se encontraron las columnas requeridas. Verifica que el archivo contenga columnas de LICENCIA/CODIGO y COMISION');
  }

  const results: AssaCodigoRow[] = [];
  
  // Procesar filas de datos (después del header)
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as string[];
    
    const licencia = String(row[licenciaColIndex] || '').trim();
    const comisionStr = String(row[comisionColIndex] || '').trim();
    
    // Saltar filas vacías
    if (!licencia && !comisionStr) {
      continue;
    }
    
    // Validar código ASSA
    if (!isValidAssaCode(licencia)) {
      console.log('[ASSA_CODIGOS] Código excluido o inválido:', licencia);
      continue;
    }
    
    // Parse comisión
    const comisionPagada = parseFloat(comisionStr.replace(/[,$]/g, '')) || 0;
    
    if (comisionPagada === 0) {
      console.log('[ASSA_CODIGOS] Comisión 0 en código:', licencia);
      continue;
    }
    
    results.push({
      licencia: licencia.toUpperCase(),
      comision_pagada: Math.abs(comisionPagada)
    });
  }

  console.log('[ASSA_CODIGOS] Códigos válidos extraídos:', results.length);
  console.log('[ASSA_CODIGOS] Muestra:', results.slice(0, 5));
  
  return results;
}

/**
 * Valida que un archivo tenga el formato esperado de ASSA Códigos
 */
export function validateAssaCodigosFile(buffer: ArrayBuffer): { valid: boolean; error?: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    
    if (!firstSheetName) {
      return { valid: false, error: 'El archivo no tiene hojas' };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return { valid: false, error: 'No se pudo leer la hoja de Excel' };
    }
    
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet as XLSX.WorkSheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    // Buscar columnas requeridas en las primeras 20 filas
    let hasLicencia = false;
    let hasComision = false;

    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i] as string[];
      const rowText = row.join('|').toUpperCase();
      
      if (rowText.includes('LICENCIA')) hasLicencia = true;
      if (rowText.includes('COMISION') && rowText.includes('PAGADA')) hasComision = true;
      
      if (hasLicencia && hasComision) break;
    }

    if (!hasLicencia || !hasComision) {
      return { 
        valid: false, 
        error: 'El archivo no contiene las columnas requeridas: LICENCIA y COMISION PAGADA' 
      };
    }

    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Error al validar archivo: ${error instanceof Error ? error.message : 'Desconocido'}` 
    };
  }
}
