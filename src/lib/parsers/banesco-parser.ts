/**
 * Parser especializado para archivos de BANESCO
 * 
 * Soporta:
 * 1. PDF: Extrae texto directamente y parsea con regex específicas
 * 2. XLSX convertido: Headers mezclados en Columna_A, datos en columnas específicas
 */

import * as XLSX from 'xlsx';

interface BanescoRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

/**
 * Parsea PDF de BANESCO directamente extrayendo texto
 */
export async function parseBanescoPDF(pdfBuffer: ArrayBuffer): Promise<BanescoRow[]> {
  console.log('[BANESCO PDF] Iniciando parseo directo de PDF');
  
  try {
    const { extractText } = await import('unpdf');
    const uint8Array = new Uint8Array(pdfBuffer);
    const result = await extractText(uint8Array);
    const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text);
    
    console.log('[BANESCO PDF] ===== TEXTO EXTRAÍDO =====');
    console.log(text);
    console.log('[BANESCO PDF] ===== FIN TEXTO =====');
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`[BANESCO PDF] Total líneas: ${lines.length}`);
    
    const rows: BanescoRow[] = [];
    
    // Regex para detectar líneas de datos de BANESCO
    // Formato real: "...Factura 2695 1131/01/20251-1-35339-0 45.00JOSE LUIS FERNANDEZ 41.87224862..."
    // Patrón: Póliza (1-1-35339-0) + Espacio + Porcentaje (45.00) SIN ESPACIO + Nombre (JOSE LUIS FERNANDEZ) + Espacio + Comisión (41.87)
    // Nota: El nombre está pegado al porcentaje, por eso usamos \s* (0 o más espacios)
    const policyRegex = /(\d{1,4}-\d{1,5}-\d{1,8}(?:-\d{1,2})?)\s+(\d+\.\d{2})\s*([A-Z][A-Z\s]{8,}?)\s+(\d+\.\d{2})/;
    
    for (const line of lines) {
      // Saltar headers y totales
      if (line.includes('Póliza') || line.includes('RESUMEN') || 
          line.includes('BALANCE') || line.includes('Total por Ramo') ||
          line.includes('DESCUENTOS') || line.includes('Monto a pagar') ||
          line.includes('Nombre Asegurado') || line.includes('Prima Cobrada')) {
        continue;
      }
      
      const policyMatch = line.match(policyRegex);
      if (policyMatch && policyMatch[1] && policyMatch[2] && policyMatch[3] && policyMatch[4]) {
        const policyNumber = policyMatch[1]; // Número de póliza
        const percentage = parseFloat(policyMatch[2]); // Porcentaje (no lo usamos pero lo validamos)
        const clientName = policyMatch[3].trim(); // Nombre del asegurado
        const commission = parseFloat(policyMatch[4]); // Comisión generada
        
        console.log(`[BANESCO PDF] Procesando línea con póliza: ${policyNumber}`);
        console.log(`[BANESCO PDF] Datos extraídos: Póliza=${policyNumber}, %=${percentage}, Cliente="${clientName}", Comisión=${commission}`);
        
        // Validaciones
        if (!clientName || clientName.length < 5) {
          console.log(`[BANESCO PDF] ⏭️ Rechazado (nombre inválido): "${clientName}"`);
          continue;
        }
        
        if (isNaN(commission) || commission <= 0) {
          console.log(`[BANESCO PDF] ⏭️ Rechazado (comisión inválida): ${commission}`);
          continue;
        }
        
        if (clientName.includes('TOTAL') || clientName.includes('RESUMEN')) {
          console.log(`[BANESCO PDF] ⏭️ Rechazado (es total/resumen): ${clientName}`);
          continue;
        }
        
        console.log(`[BANESCO PDF] ✅ Encontrado: Póliza=${policyNumber}, Cliente=${clientName}, Comisión=${commission}`);
        rows.push({
          policy_number: policyNumber,
          client_name: clientName,
          gross_amount: commission
        });
      }
    }
    
    console.log(`[BANESCO PDF] Total filas extraídas: ${rows.length}`);
    return rows;
    
  } catch (error) {
    console.error('[BANESCO PDF] Error:', error);
    throw new Error('Error al parsear PDF de BANESCO: ' + (error instanceof Error ? error.message : 'Error desconocido'));
  }
}

export function parseBanescoExcel(fileBuffer: ArrayBuffer): BanescoRow[] {
  console.log('[BANESCO PARSER] Iniciando parseo de archivo BANESCO');
  
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  
  if (!sheetName) {
    console.log('[BANESCO PARSER] ❌ No se encontró ninguna hoja en el archivo');
    return [];
  }
  
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.log('[BANESCO PARSER] ❌ No se pudo acceder al worksheet');
    return [];
  }
  
  // Convertir a JSON para acceder a las celdas
  const refRange = worksheet['!ref'];
  if (!refRange) {
    console.log('[BANESCO PARSER] ❌ No se pudo obtener el rango del worksheet');
    return [];
  }
  
  const range = XLSX.utils.decode_range(refRange);
  console.log('[BANESCO PARSER] Rango:', refRange);
  
  const rows: BanescoRow[] = [];
  let headerRowIndex = -1;
  
  // PASO 1: Buscar la fila que contiene "Nombre Asegurado" (indica el header)
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v) {
        const cellValue = String(cell.v).toUpperCase();
        if (cellValue.includes('NOMBRE ASEGURADO') || cellValue.includes('TIPO DE MOVIMIENTO')) {
          headerRowIndex = R;
          console.log('[BANESCO PARSER] Header encontrado en fila:', R);
          break;
        }
      }
    }
    if (headerRowIndex !== -1) break;
  }
  
  if (headerRowIndex === -1) {
    console.log('[BANESCO PARSER] ❌ No se encontró el header');
    return [];
  }
  
  // PASO 2: Procesar filas de datos (después del header)
  for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
    // Leer las columnas clave
    const colA = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })]; // Columna_A (póliza mezclada)
    const colI = worksheet[XLSX.utils.encode_cell({ r: R, c: 8 })]; // Columna_I (nombre)
    const colR = worksheet[XLSX.utils.encode_cell({ r: R, c: 17 })]; // Columna_R (comisión)
    
    const dataA = colA?.v !== undefined ? String(colA.v).trim() : '';
    const dataI = colI?.v !== undefined ? String(colI.v).trim() : '';
    const dataR = colR?.v !== undefined ? String(colR.v).trim() : '';
    
    console.log(`[BANESCO PARSER] Fila ${R}: A="${dataA.substring(0, 50)}", I="${dataI}", R="${dataR}"`);
    
    // Validar que es una fila de datos válida
    if (!dataI || !dataR) {
      console.log(`[BANESCO PARSER]   ⏭️ Saltando (faltan datos)`);
      continue;
    }
    
    // Saltar filas de totales y resúmenes
    const upperDataA = dataA.toUpperCase();
    const upperDataI = dataI.toUpperCase();
    if (
      upperDataA.includes('TOTAL') ||
      upperDataA.includes('RESUMEN') ||
      upperDataA.includes('BALANCE') ||
      upperDataA.includes('DESCUENTO') ||
      upperDataI.includes('TOTAL') ||
      upperDataI.includes('RESUMEN')
    ) {
      console.log(`[BANESCO PARSER]   ⏭️ Saltando (fila de total/resumen)`);
      continue;
    }
    
    // EXTRAER PÓLIZA: Los primeros caracteres de Columna_A (antes de "Factura" o espacio múltiple)
    let policyNumber = '';
    const policyMatch = dataA.match(/^([\d\-]+)/);
    if (policyMatch && policyMatch[1]) {
      policyNumber = policyMatch[1].trim();
    } else {
      console.log(`[BANESCO PARSER]   ⏭️ Saltando (no se pudo extraer póliza)`);
      continue;
    }
    
    // EXTRAER COMISIÓN
    const commission = parseFloat(dataR);
    if (isNaN(commission) || commission === 0) {
      console.log(`[BANESCO PARSER]   ⏭️ Saltando (comisión inválida: ${dataR})`);
      continue;
    }
    
    // VALIDAR NOMBRE
    if (dataI.length < 3) {
      console.log(`[BANESCO PARSER]   ⏭️ Saltando (nombre muy corto)`);
      continue;
    }
    
    console.log(`[BANESCO PARSER]   ✅ VÁLIDA - Póliza: ${policyNumber}, Cliente: ${dataI}, Comisión: ${commission}`);
    
    rows.push({
      policy_number: policyNumber,
      client_name: dataI,
      gross_amount: commission
    });
  }
  
  console.log(`[BANESCO PARSER] Total extraído: ${rows.length} filas`);
  return rows;
}
