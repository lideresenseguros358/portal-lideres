import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface MercantilRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

/**
 * Parser especializado para PDFs de MERCANTIL
 * Similar a BANESCO - extrae texto del PDF y parsea con regex
 */
export async function parseMercantilPDF(fileBuffer: ArrayBuffer): Promise<MercantilRow[]> {
  console.log('[MERCANTIL PDF] Iniciando parseo directo de PDF');
  
  // Convertir ArrayBuffer a Buffer
  const buffer = Buffer.from(fileBuffer);
  
  // Extraer texto del PDF
  const text = await extractTextFromPDF(buffer);
  
  console.log('[MERCANTIL PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[MERCANTIL PDF] ===== FIN TEXTO =====');
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`[MERCANTIL PDF] Total líneas: ${lines.length}`);
  
  const rows: MercantilRow[] = [];
  
  // Regex para detectar líneas de datos de MERCANTIL
  // Formato NUEVO: "2032 Factura 178120... 26.9820.00134.90ERIC ABDEL CHICHACORecibos Cobrados"
  // Póliza: número simple al inicio
  // Comisión pegada: XX.YY antes del nombre
  // Nombre: letras mayúsculas antes de "Recibos Cobrados" o "USD"
  
  for (const line of lines) {
    // Saltar headers, resumen y totales
    if (line.includes('No. de Póliza') || line.includes('RESUMEN') || 
        line.includes('COMISIONES POR RAMO') || line.includes('CONSOLIDADO') ||
        line.includes('Total de comisiones') || line.includes('DESCUENTOS') ||
        line.includes('Total por Ramo') ||
        line.includes('Monto a pagar') || line.includes('Comisión a liquidar')) {
      continue;
    }
    
    // Buscar líneas con "Factura" (indica línea de datos)
    if (!line.includes('Factura')) continue;
    
    // 1) Extraer número de póliza (primeros dígitos de la línea)
    const policyMatch = line.match(/^(\d{2,6})\s+Factura/);
    if (!policyMatch || !policyMatch[1]) continue;
    
    const policyNumber = policyMatch[1];
    console.log(`[MERCANTIL PDF] Procesando póliza: ${policyNumber}`);
    console.log(`[MERCANTIL PDF] Línea: ${line.substring(0, 200)}`);
    
    // 2) Extraer comisión y nombre
    // Formato común: "26.98 20.00 134.90 ERIC ABDEL CHICHACO Recibos Cobrados"
    // O pegado: "26.9820.00134.90ERIC ABDEL CHICHACO"
    // La comisión CORRECTA es el primer número (más a la izquierda después de la póliza)
    
    // ESTRATEGIA: Buscar todos los números decimales antes del nombre del cliente
    // y tomar el PRIMERO como la comisión
    const numbersBeforeName = line.match(/Factura\s+\d+.*?(\d+\.\d{2})\s*(\d+\.\d{2})?\s*(\d+\.\d{2})?\s*([A-ZÑÁÉÍÓÚÜ][A-ZÑÁÉÍÓÚÜ\s]{4,}?)(?:Recibos|USD|Bs)/);
    
    if (numbersBeforeName && numbersBeforeName[1]) {
      // El primer grupo capturado es la comisión
      const commission = parseFloat(numbersBeforeName[1]!);
      const clientName = numbersBeforeName[4]?.trim() || '';
      
      console.log(`[MERCANTIL PDF] 🔍 Números encontrados: ${numbersBeforeName[1]}, ${numbersBeforeName[2]}, ${numbersBeforeName[3]}`);
      console.log(`[MERCANTIL PDF] 🔍 Nombre extraído: "${clientName}"`);
      
      // Validar
      if (Math.abs(commission) > 0.01 && clientName.length > 3 && !clientName.includes('TOTAL') && !clientName.includes('DESCUENTO')) {
        console.log(`[MERCANTIL PDF] ✅ VÁLIDO - Póliza=${policyNumber}, Cliente="${clientName}", Comisión=$${commission}`);
        rows.push({
          policy_number: policyNumber,
          client_name: clientName,
          gross_amount: commission
        });
      } else {
        console.log(`[MERCANTIL PDF] ⏭️ Rechazado (validación): ${clientName} - ${commission}`);
      }
    } else {
      console.log(`[MERCANTIL PDF] ⏭️ No se pudo extraer comisión/nombre de la línea`);
    }
  }
  
  console.log(`[MERCANTIL PDF] Total filas extraídas: ${rows.length}`);
  return rows;
}

/**
 * Parser para archivos Excel de MERCANTIL (si se convierte manualmente)
 * Similar estructura a BANESCO Excel
 */
export function parseMercantilExcel(fileBuffer: ArrayBuffer): MercantilRow[] {
  console.log('[MERCANTIL PARSER] Iniciando parseo de archivo MERCANTIL Excel');
  
  const XLSX = require('xlsx');
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  
  if (!firstSheet['!ref']) {
    console.log('[MERCANTIL PARSER] ❌ Hoja vacía');
    return [];
  }
  
  console.log('[MERCANTIL PARSER] Rango:', firstSheet['!ref']);
  
  // Buscar fila de header
  let headerRow = -1;
  for (let i = 0; i < 20; i++) {
    const cell = firstSheet[`A${i + 1}`];
    if (cell && typeof cell.v === 'string' && cell.v.includes('No. de Póliza')) {
      headerRow = i;
      console.log('[MERCANTIL PARSER] ✅ Header encontrado en fila:', i + 1);
      break;
    }
  }
  
  if (headerRow === -1) {
    console.log('[MERCANTIL PARSER] ❌ No se encontró el header');
    return [];
  }
  
  const rows: MercantilRow[] = [];
  
  // Procesar filas de datos (después del header)
  for (let i = headerRow + 1; i < 1000; i++) {
    const cellA = firstSheet[`A${i + 1}`];
    if (!cellA || !cellA.v) break;
    
    const cellValue = String(cellA.v).trim();
    
    // Saltar totales y resúmenes
    if (cellValue.includes('RESUMEN') || cellValue.includes('Total') || 
        cellValue.includes('COMISIONES') || cellValue.includes('CONSOLIDADO')) {
      break;
    }
    
    // Buscar póliza en la primera columna
    const policyMatch = cellValue.match(/^(\d{1,4}-\d{1,5}-\d{1,8})/);
    if (policyMatch && policyMatch[1]) {
      const policyNumber = policyMatch[1];
      
      // Buscar nombre y comisión en las columnas siguientes
      let clientName = '';
      let commission = 0;
      
      // Iterar por las columnas para encontrar el nombre y la comisión
      for (let col = 1; col < 20; col++) {
        const colLetter = String.fromCharCode(65 + col); // B, C, D...
        const cell = firstSheet[`${colLetter}${i + 1}`];
        
        if (cell && cell.v) {
          const value = String(cell.v).trim();
          
          // Detectar nombre (mayúsculas, más de 10 caracteres)
          if (!clientName && /^[A-Z\s]{10,}$/.test(value)) {
            clientName = value;
          }
          
          // Detectar comisión (número decimal)
          const numMatch = value.match(/^-?(\d+\.?\d*)$/);
          if (numMatch && Math.abs(parseFloat(value)) > 0.01) {
            commission = parseFloat(value);
          }
        }
      }
      
      if (clientName && Math.abs(commission) > 0.01) {
        console.log(`[MERCANTIL PARSER]   ✅ VÁLIDA - Póliza: ${policyNumber}, Cliente: ${clientName}, Comisión: ${commission}`);
        rows.push({
          policy_number: policyNumber,
          client_name: clientName,
          gross_amount: commission
        });
      }
    }
  }
  
  console.log('[MERCANTIL PARSER] Total extraído:', rows.length, 'filas');
  
  // DEBUG: Calcular suma total de comisiones
  const totalCommissions = rows.reduce((sum, row) => sum + row.gross_amount, 0);
  console.log(`[MERCANTIL PARSER] 💰 Suma total de comisiones: $${totalCommissions.toFixed(2)}`);
  
  // DEBUG: Detectar duplicados por póliza
  const policyCount = new Map<string, number>();
  rows.forEach(row => {
    policyCount.set(row.policy_number, (policyCount.get(row.policy_number) || 0) + 1);
  });
  const duplicates = Array.from(policyCount.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`[MERCANTIL PARSER] 🚨 DUPLICADOS DETECTADOS:`);
    duplicates.forEach(([policy, count]) => {
      console.log(`[MERCANTIL PARSER]   - Póliza ${policy}: ${count} veces`);
    });
  }
  
  return rows;
}
