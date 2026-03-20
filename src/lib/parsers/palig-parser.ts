/**
 * Parser especial para archivos de PALIG (PAN AMERICAN LIFE)
 * PALIG tiene múltiples tablas en un mismo PDF con diferentes líneas de negocio
 */

import { extractTextFromPDF } from '@/lib/services/vision-ocr';

export interface PaligRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const str = String(value || '').trim();
  if (!str) return 0;
  
  // Verificar si tiene paréntesis (indica número negativo)
  const hasParentheses = str.includes('(') && str.includes(')');
  
  // Remover símbolos de moneda, comas y paréntesis
  const cleaned = str.replace(/[$,()]/g, '');
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return 0;
  
  // Si tenía paréntesis, convertir a negativo
  return hasParentheses ? -Math.abs(num) : num;
}

export async function parsePaligXLSX(fileBuffer: ArrayBuffer): Promise<PaligRow[]> {
  console.log('[PALIG XLSX] Iniciando parseo de archivo Excel');

  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    console.log('[PALIG XLSX] No se encontró hoja en el archivo');
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    console.log('[PALIG XLSX] No se pudo leer la hoja');
    return [];
  }

  // Leer todas las filas como arrays
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  });

  console.log('[PALIG XLSX] Total filas en Excel:', jsonData.length);
  if (jsonData.length < 2) return [];

  // Buscar la fila de headers que contenga "Grupo(Póliza)" o similar
  let headerRowIndex = -1;
  let colPolicy = -1;    // Grupo(Póliza)
  let colName = -1;      // Nombre del Asegurado
  let colCredit = -1;    // Créditos o Crédito

  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (cell.includes('grupo') && cell.includes('poliza')) {
        colPolicy = j;
      }
      if (cell.includes('nombre') && cell.includes('asegurado')) {
        colName = j;
      }
      if (cell === 'creditos' || cell === 'credito' || cell === 'créditos' || cell === 'crédito') {
        colCredit = j;
      }
    }

    // Si encontramos al menos póliza y crédito, tenemos el header
    if (colPolicy !== -1 && colCredit !== -1) {
      headerRowIndex = i;
      break;
    }

    // Reset si no encontramos todo en esta fila
    colPolicy = -1;
    colName = -1;
    colCredit = -1;
  }

  if (headerRowIndex === -1 || colPolicy === -1 || colCredit === -1) {
    console.log('[PALIG XLSX] No se encontraron headers esperados (Grupo(Póliza), Crédito)');
    console.log('[PALIG XLSX] Primeras 5 filas:', jsonData.slice(0, 5));
    return [];
  }

  console.log(`[PALIG XLSX] Headers encontrados en fila ${headerRowIndex}: policy=${colPolicy}, name=${colName}, credit=${colCredit}`);

  const results: PaligRow[] = [];

  // Procesar filas de datos (después del header)
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;

    const policyRaw = String(row[colPolicy] || '').trim();
    const nameRaw = colName !== -1 ? String(row[colName] || '').trim() : '';
    const creditRaw = row[colCredit];

    // Si la celda de póliza está vacía o contiene "Sub Total", "Total", etc. → saltar
    const policyUpper = policyRaw.toUpperCase();
    if (!policyRaw || policyUpper.includes('TOTAL') || policyUpper.includes('LINEA DE NEGOCIO')) {
      // Si es "Linea de Negocio", ya estamos en la sección inferior → parar
      if (policyUpper.includes('LINEA DE NEGOCIO')) {
        console.log(`[PALIG XLSX] Fin de datos en fila ${i} (Linea de Negocio detectada)`);
        break;
      }
      continue;
    }

    // Parsear comisión
    const commission = parseAmount(creditRaw);

    // Solo incluir filas con póliza válida y comisión != 0
    if (policyRaw.length >= 2 && commission !== 0) {
      results.push({
        policy_number: policyRaw,
        client_name: nameRaw || 'SIN NOMBRE',
        gross_amount: commission
      });
    }
  }

  console.log(`[PALIG XLSX] Total filas extraídas: ${results.length}`);
  return results;
}

export async function parsePaligPDF(fileBuffer: ArrayBuffer): Promise<PaligRow[]> {
  console.log('[PALIG PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[PALIG PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[PALIG PDF] ===== FIN TEXTO =====');

  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
  
  const results: PaligRow[] = [];
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineUpper = line.toUpperCase();

    // Detectar inicio de tabla de datos (cuando vemos el header "PÓLIZA / CERT")
    if (lineUpper.includes('PÓLIZA') && lineUpper.includes('CERT')) {
      inDataSection = true;
      console.log('[PALIG PDF] Header de tabla detectado en línea', i);
      continue;
    }

    // Detectar fin de tabla (líneas de totales o nuevas secciones)
    if (lineUpper.startsWith('TOTAL') || 
        lineUpper.includes('LINEA DE NEGOCIO') ||
        lineUpper.includes('CODIGO DE AGENTE') ||
        lineUpper.includes('REGULADO Y SUPERVISADO')) {
      if (lineUpper.startsWith('TOTAL') && inDataSection) {
        console.log('[PALIG PDF] Fin de tabla en línea', i);
      }
      inDataSection = false;
      continue;
    }

    // Si estamos en una sección de datos, intentar extraer la información
    if (inDataSection) {
      // El OCR extrae en formato: "PRIMA % DÉBITOS CRÉDITOS NOMBRE COMISIÓN PÓLIZA"
      // Ejemplo: "167.76 15.00 0.00 25.16BAYARDO A. HERRERA 25.166000130"
      // O: "195.30 10.00 0.00 19.53JAMES THOMPSON 19.5366636 / 0000000976"
      
      // NUEVO ENFOQUE: Buscar el NOMBRE primero (última secuencia de letras mayúsculas)
      // Luego extraer comisión y póliza del resto
      // Ejemplo: "35.17 3.00 0.00 1.06RODRIGUEZ 1.064239-384"
      // Nombre: RODRIGUEZ, Resto: "1.064239-384" → comisión: 1.06, póliza: 4239-384
      
      console.log('[PALIG PDF] Procesando línea:', line);
      
      // Buscar el nombre: última secuencia de letras mayúsculas (puede incluir espacios, comas, puntos)
      const nameMatch = line.match(/([A-ZÑÁÉÍÓÚÜ][A-ZÑÁÉÍÓÚÜ\s,.]*)\s*(\d+\.?\d*).*$/i);
      
      if (!nameMatch) {
        console.log('[PALIG PDF] No se encontró nombre');
        continue;
      }
      
      if (!nameMatch[1]) continue;
      
      const clientName = nameMatch[1].trim();
      const restAfterName = line.substring(line.indexOf(clientName) + clientName.length).trim();
      
      console.log('[PALIG PDF] Nombre encontrado:', clientName);
      console.log('[PALIG PDF] Resto después del nombre:', restAfterName);
      
      // El resto tiene formato: "COMISIONPOLIZA"
      // Comisión SIEMPRE tiene 2 decimales (formato moneda): ej. 1.06, 19.53, 62.39
      // Después de los 2 decimales, TODO lo demás es póliza hasta "/" o letra mayúscula
      // Ejemplos:
      // "1.064239-384" → comisión: 1.06, póliza: 4239-384
      // "19.5366636 / 0000000976" → comisión: 19.53, póliza: 66636
      // "1.50C8000 / C150000972" → comisión: 1.50, póliza: C8000
      
      let policyNum = '';
      let commission = 0;
      
      // PASO 1: Extraer comisión (número con exactamente 2 decimales)
      const commMatch = restAfterName.match(/^(\d+\.\d{2})/);
      if (!commMatch || !commMatch[1]) {
        console.log('[PALIG PDF] No se encontró comisión en formato moneda (X.XX)');
        continue;
      }
      
      const commissionStr = commMatch[1];
      commission = parseAmount(commissionStr);
      
      // PASO 2: Lo que queda después de la comisión es la póliza
      const afterCommission = restAfterName.substring(commissionStr.length).trim();
      console.log('[PALIG PDF] Comisión:', commission);
      console.log('[PALIG PDF] Después de comisión:', afterCommission);
      
      // PASO 3: Extraer póliza (todo hasta "/" o letra mayúscula del siguiente cliente)
      // Primero, si hay "/" tomar solo hasta ahí (ignorar certificado)
      let policyPart = afterCommission;
      if (policyPart.includes('/')) {
        const parts = policyPart.split('/');
        policyPart = parts[0] ? parts[0].trim() : policyPart;
      }
      
      // Si la póliza es alfanumérica (empieza con letra), tomar solo esa parte
      if (policyPart.match(/^[A-Z]\d+/i)) {
        const alphaMatch = policyPart.match(/^([A-Z]\d+)/i);
        if (alphaMatch && alphaMatch[1]) {
          policyNum = alphaMatch[1];
        }
      }
      // Si es numérica, tomar todos los dígitos (puede incluir guión)
      else {
        const numMatch = policyPart.match(/^(\d+[-]?\d*)/);
        if (numMatch && numMatch[1]) {
          policyNum = numMatch[1].replace(/^0+/, ''); // Remover ceros iniciales
        }
      }
      
      if (!policyNum || policyNum.length < 4) {
        console.log('[PALIG PDF] Póliza inválida:', policyNum);
        continue;
      }
      
      // Manejar comisiones negativas (con paréntesis)
      if (restAfterName.includes('(')) {
        commission = -Math.abs(commission);
      }
      
      console.log('[PALIG PDF] ✓ Datos extraídos:', {
        policy: policyNum,
        name: clientName,
        commission
      });
      
      // Filtrar nombres que parecen ser headers
      const nameUpper = clientName.toUpperCase();
      if (!nameUpper.includes('REFERENCIA') &&
          !nameUpper.includes('PRIMA') &&
          !nameUpper.includes('DÉBITOS') &&
          !nameUpper.includes('TOTAL')) {
        
        results.push({
          policy_number: policyNum,
          client_name: clientName,
          gross_amount: commission
        });
      }
    }
  }

  console.log('[PALIG PDF] Total filas extraídas:', results.length);
  return results;
}
