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
  // Formato: "2-8-163 Factura 146315 ... 17.52 ... JOSE ANTONIO PRADO DUÑA"
  // IMPORTANTE: el texto viene “pegado” y la línea también incluye No. Egreso tipo "2-1-47268USD".
  // Para evitar confundir No. Egreso con póliza, usamos contexto:
  // la póliza es el patrón X-Y-Z que va antes del % (20.00/25.00/50.00) y del nombre.
  // Ej: "...20252-8-103 20.00JOSE..." => póliza = 2-8-103
  const policyByYearRegex = /20\d{2}(\d{1,4}-\d{1,5}-\d{1,8})(?=\s*\d{1,3}\.\d{2}\s*[A-ZÑÁÉÍÓÚÜ])/;
  const policyByContextRegex = /(?:^|[^\d\/])(\d{1,4}-\d{1,5}-\d{1,8})(?=\s*\d{1,3}\.\d{2}\s*[A-ZÑÁÉÍÓÚÜ])/;
  
  for (const line of lines) {
    // Saltar headers, resumen y totales
    if (line.includes('No. de Póliza') || line.includes('RESUMEN') || 
        line.includes('COMISIONES POR RAMO') || line.includes('CONSOLIDADO') ||
        line.includes('Total de comisiones') || line.includes('DESCUENTOS') ||
        line.includes('Monto a pagar') || line.includes('Comisión a liquidar')) {
      continue;
    }
    
    // 1) Prioridad: patrón pegado a año (20xx + póliza)
    //    Esto evita que se capture "252-..." desde "20252-..."
    const policyMatch = line.match(policyByYearRegex) || line.match(policyByContextRegex);
    if (policyMatch && policyMatch[1]) {
      const rawPolicyNumber = policyMatch[1];
      const parts = rawPolicyNumber.split('-');
      const firstPart = parts[0] ? String(parseInt(parts[0], 10)) : parts[0];
      const policyNumber = [firstPart, ...parts.slice(1)].filter(Boolean).join('-');
      
      console.log(`[MERCANTIL PDF] Procesando línea con póliza: ${policyNumber}`);
      console.log(`[MERCANTIL PDF] Línea completa: ${line.substring(0, 150)}`);

      const lineFromPolicy = line.slice(Math.max(0, line.indexOf(rawPolicyNumber)));

      // Extraer comisión en formato pegado al No. de ingreso: "3.56296102" => comisión=3.56
      // En el texto real, esto aparece justo antes de un No. egreso tipo "2-1-47268" y luego "USD"
      const commissionAndIngresoMatch = lineFromPolicy.match(/\b(\d+\.\d{2})(?=\d{4,}\s+\d{1,4}-\d{1,4}-\d{3,}\s*USD\b)/);

      // Nombre suele estar después del % (20.00/25.00/50.00) y antes de la comisión pegada al ingreso
      const nameMatch = commissionAndIngresoMatch
        ? lineFromPolicy.match(/\b\d{1,3}\.\d{2}\s*([A-ZÑÁÉÍÓÚÜ\s]{5,}?)(?=\s*\d+\.\d{2}\d{4,})/)
        : null;

      console.log(`[MERCANTIL PDF] Nombre detectado: ${nameMatch ? nameMatch[1] : 'NO ENCONTRADO'}`);
      console.log(`[MERCANTIL PDF] Comisión detectada: ${commissionAndIngresoMatch ? commissionAndIngresoMatch[1] : 'NO ENCONTRADA'}`);

      if (nameMatch && nameMatch[1] && commissionAndIngresoMatch && commissionAndIngresoMatch[1]) {
        const clientName = nameMatch[1].trim();
        const commission = parseFloat(commissionAndIngresoMatch[1]);
        
        // Validar que no sea un total o resumen
        if (commission > 0 && !clientName.includes('TOTAL') && clientName.length > 5) {
          console.log(`[MERCANTIL PDF] ✅ Encontrado: Póliza=${policyNumber}, Cliente=${clientName}, Comisión=${commission}`);
          rows.push({
            policy_number: policyNumber,
            client_name: clientName,
            gross_amount: commission
          });
        } else {
          console.log(`[MERCANTIL PDF] ⏭️ Rechazado (validación): ${clientName} - ${commission}`);
        }
      } else {
        console.log(`[MERCANTIL PDF] ⏭️ No se encontró nombre o comisión en la línea`);
      }
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
          const numMatch = value.match(/^(\d+\.?\d*)$/);
          if (numMatch && numMatch[1] && parseFloat(numMatch[1]) > 0.01) {
            commission = parseFloat(numMatch[1]);
          }
        }
      }
      
      if (clientName && commission > 0) {
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
  return rows;
}
