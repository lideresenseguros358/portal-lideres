/**
 * Parser especial para archivos de SURA
 * SURA tiene un formato muy complejo con múltiples tablas en un mismo Excel
 */

import * as XLSX from 'xlsx';

export interface SuraRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

export function parseSuraExcel(buffer: ArrayBuffer): SuraRow[] {
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
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  });

  console.log('[SURA] Total rows:', jsonData.length);

  const results: SuraRow[] = [];
  let currentSection: string | null = null;
  let headerRowIndex = -1;
  let policyColIndex = -1;
  let insuredColIndex = -1;
  let commissionColIndex = -1;

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] as string[];
    const rowText = row.join('|').toUpperCase();

    // Detectar inicio de una nueva sección de "Detalle de Honorarios Corretaje"
    if (rowText.includes('DETALLE') && rowText.includes('HONORARIOS') && rowText.includes('CORRETAJE')) {
      currentSection = row.find(cell => cell && cell.includes('Detalle')) || null;
      console.log('[SURA] Nueva sección encontrada:', currentSection, 'en fila', i);
      headerRowIndex = -1; // Reset header detection
      continue;
    }

    // Si estamos en una sección, buscar la fila de headers
    if (currentSection && headerRowIndex === -1) {
      // Buscar columnas con "Póliza", "Asegurado", "Comisión" o "Neto"
      let foundPolicy = false;
      let foundInsured = false;
      let foundCommission = false;

      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cell = String(row[colIdx] || '').trim().toUpperCase();
        
        if (cell.includes('PÓLIZA') || cell.includes('POLIZA')) {
          policyColIndex = colIdx;
          foundPolicy = true;
          console.log('[SURA] Columna Póliza:', colIdx, 'en fila', i);
        }
        
        if (cell.includes('ASEGURADO')) {
          insuredColIndex = colIdx;
          foundInsured = true;
          console.log('[SURA] Columna Asegurado:', colIdx, 'en fila', i);
        }
        
        if (cell.includes('COMISIÓN') || cell.includes('COMISION') || cell === 'NETO') {
          commissionColIndex = colIdx;
          foundCommission = true;
          console.log('[SURA] Columna Comisión:', colIdx, 'en fila', i);
        }
      }

      // Si encontramos las 3 columnas, esta es la fila de headers
      if (foundPolicy && foundInsured && foundCommission) {
        headerRowIndex = i;
        console.log('[SURA] Headers encontrados en fila', i);
        continue;
      }
    }

    // Si ya tenemos los headers, extraer datos
    if (currentSection && headerRowIndex !== -1 && i > headerRowIndex) {
      const policyNum = String(row[policyColIndex] || '').trim();
      const insured = String(row[insuredColIndex] || '').trim();
      const commissionRaw = String(row[commissionColIndex] || '').trim();

      // Saltar filas de totales o vacías
      if (!policyNum || policyNum.toUpperCase() === 'TOTAL' || policyNum.toUpperCase().includes('SOLUCIONES')) {
        // Si encontramos "Total", terminamos esta sección
        if (policyNum.toUpperCase() === 'TOTAL') {
          console.log('[SURA] Fin de sección en fila', i);
          currentSection = null;
          headerRowIndex = -1;
        }
        continue;
      }

      // Validar que sea una póliza válida
      const isValidPolicy = policyNum.length > 3 && !policyNum.includes('NEGOCIO');

      // Validar que tenga asegurado
      const isValidInsured = insured.length > 2 && 
                            !insured.toUpperCase().includes('ASEGURADO') &&
                            !insured.toUpperCase().includes('DETALLE');

      // Limpiar y parsear comisión
      const commissionCleaned = commissionRaw.replace(/[$,\s]/g, '');
      const commission = parseFloat(commissionCleaned);
      const isValidCommission = !isNaN(commission) && Math.abs(commission) > 0.01;

      if (isValidPolicy && isValidInsured && isValidCommission) {
        results.push({
          policy_number: policyNum,
          client_name: insured,
          gross_amount: commission
        });
        console.log('[SURA] Fila válida:', policyNum, '|', insured, '|', commission);
      } else {
        console.log('[SURA] Fila rechazada:', policyNum, '|', insured, '|', commission, 
                   '| Validaciones:', isValidPolicy, isValidInsured, isValidCommission);
      }
    }
  }

  console.log('[SURA] Total filas extraídas:', results.length);
  return results;
}
