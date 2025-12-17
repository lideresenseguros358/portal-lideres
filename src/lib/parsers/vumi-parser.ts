/**
 * Parser especial para archivos de VUMI (LA REGIONAL DE SEGUROS)
 * VUMI tiene múltiples tablas en un mismo PDF: Nuevos Negocios, Renovaciones, Otros Ajustes
 */

import { extractTextFromPDF } from '@/lib/services/vision-ocr';

export interface VumiRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const str = String(value || '').trim();
  if (!str) return 0;
  
  // Remover símbolos de moneda y comas
  const cleaned = str.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function parseVumiPDF(fileBuffer: ArrayBuffer): Promise<VumiRow[]> {
  console.log('[VUMI PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[VUMI PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[VUMI PDF] ===== FIN TEXTO =====');

  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
  
  const results: VumiRow[] = [];
  let currentSection: string | null = null;
  let inDataRows = false;
  let policyColIdx = -1;
  let insuredColIdx = -1;
  let commissionColIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineUpper = line.toUpperCase();

    // Detectar inicio de secciones - solo si no estamos ya en una sección procesando datos
    if (!inDataRows) {
      if (lineUpper === 'NUEVOS NEGOCIOS') {
        currentSection = 'NUEVOS NEGOCIOS';
        console.log('[VUMI PDF] Sección detectada:', currentSection, 'en línea', i);
        continue;
      }

      if (lineUpper === 'RENOVACIONES') {
        currentSection = 'RENOVACIONES';
        console.log('[VUMI PDF] Sección detectada:', currentSection, 'en línea', i);
        continue;
      }

      if (lineUpper === 'OTROS AJUSTES') {
        currentSection = 'OTROS AJUSTES';
        console.log('[VUMI PDF] Sección detectada:', currentSection, 'en línea', i);
        continue;
      }
    }

    // Detectar fila de headers (puede estar en varias líneas)
    if (currentSection && !inDataRows) {
      if (lineUpper.includes('NÚMERO') || lineUpper.includes('PÓLIZA') || 
          lineUpper.includes('TITULAR') || lineUpper.includes('MONTO')) {
        // Estamos en la zona de headers, esperar a que termine
        continue;
      }
      // Si encontramos una fecha o un número de póliza, comenzar a extraer datos
      if (/\d{2}\/\d{2}\/\d{4}/.test(line) || /^\d{10}/.test(line)) {
        inDataRows = true;
        console.log('[VUMI PDF] Inicio de datos detectado en línea', i);
        // No hacer continue, procesar esta línea
      }
    }

    // Detectar fin de sección (solo si ya estábamos procesando datos)
    if (inDataRows && (lineUpper.includes('NO GENERÓ COMISIONES') || lineUpper.includes('TOTAL'))) {
      inDataRows = false;
      currentSection = null;
      console.log('[VUMI PDF] Fin de sección en línea', i);
      continue;
    }

    // Si estamos en una sección con datos, intentar extraer la información
    if (currentSection && inDataRows) {
      // En el texto de VUMI, los datos pueden estar distribuidos en varias líneas
      // Buscar número de póliza en la línea actual
      const policyMatch = line.match(/\b(\d{10})\b/);
      
      if (policyMatch) {
        const policyNum = policyMatch[1];
        
        // Buscar el nombre del titular en las siguientes líneas
        // El nombre suele estar después del número de póliza
        let nameTokens: string[] = [];
        let commission = 0;
        
        // Procesar la línea actual y las siguientes para encontrar nombre y comisión
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j];
          if (!nextLine) continue;
          const nextLineUpper = nextLine.toUpperCase();
          
          // Si llegamos a otra sección o total, parar
          if (nextLineUpper.includes('TOTAL') || 
              nextLineUpper.includes('NO GENERÓ') ||
              nextLineUpper.includes('CICLO DE')) {
            break;
          }
          
          // Buscar comisión (formato $XX.XX)
          const commissionMatch = nextLine.match(/\$(\d+\.?\d*)/g);
          if (commissionMatch && commissionMatch.length > 0) {
            // El último monto es la comisión
            const lastAmount = commissionMatch[commissionMatch.length - 1];
            if (lastAmount) {
              commission = parseAmount(lastAmount);
            }
          }
          
          // Buscar nombre (palabras en mayúsculas que no sean keywords)
          const words = nextLine.split(/\s+/);
          for (const word of words) {
            if (!word) continue;
            const wordUpper = word.toUpperCase();
            
            // Si es una palabra que parece nombre (mayúsculas, no números, no keywords)
            if (/^[A-ZÑÁÉÍÓÚÜ]+$/.test(wordUpper) && 
                word.length > 2 &&
                !wordUpper.includes('COMMISSION') &&
                !wordUpper.includes('LIDERES') &&
                !wordUpper.includes('LISSA') &&
                !wordUpper.includes('SEGUROS') &&
                !wordUpper.includes('AGENTE') &&
                !wordUpper.includes('GRUPO')) {
              nameTokens.push(word);
            }
          }
        }
        
        // Si encontramos póliza, nombre y comisión, agregar
        if (policyNum && nameTokens.length >= 2 && commission > 0) {
          const clientName = nameTokens.join(' ');
          
          results.push({
            policy_number: policyNum,
            client_name: clientName,
            gross_amount: commission
          });
          
          console.log('[VUMI PDF] Fila extraída:', {
            policy: policyNum,
            name: clientName,
            commission
          });
          
          // Saltar las líneas que ya procesamos
          i += 5;
        }
      }
    }
  }

  console.log('[VUMI PDF] Total filas extraídas:', results.length);
  return results;
}
