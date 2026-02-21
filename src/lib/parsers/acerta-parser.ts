interface AcertaRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseNumber(s: string): number {
  const cleaned = String(s || '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * ACERTA PDF text format (from pdf-parse / unpdf):
 *
 * The text has client+ramo+policy on one line, then amounts on the next line:
 *   "ROLANDO OLIVARES IGUALA02 1024065"
 *   "03/02/2026 COMISIONES PRIMA AVS 745779 1788382REC 176.19 20 35.23 100"
 *
 * Structure of the client line:
 *   CLIENT_NAME + RAMO(2 digits) + SPACE + POLICY_NUMBER
 *   e.g. "ROLANDO OLIVARES IGUALA" + "02" + " " + "1024065"
 *
 * Structure of the amounts line:
 *   DATE OPERATION ... PRIMA % COMISION %COA
 *   e.g. "03/02/2026 COMISIONES PRIMA AVS 745779 1788382REC 176.19 20 35.23 100"
 *   The commission is the second-to-last number, last is %Coa (usually 100).
 *
 * Multiple clients may appear between the header and "Total:" lines.
 */
export async function parseAcertaPDF(fileBuffer: ArrayBuffer): Promise<AcertaRow[]> {
  console.log('[ACERTA PDF] Iniciando parseo directo de PDF');

  const buf = Buffer.from(fileBuffer);

  // Try pdf-parse first, then unpdf
  let text = '';
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule.default || pdfParseModule) as any;
    const result = await pdfParse(buf);
    text = String(result?.text || '').trim();
    console.log(`[ACERTA PDF] pdf-parse: ${text.length} caracteres`);
  } catch (e) {
    console.log('[ACERTA PDF] pdf-parse falló:', e instanceof Error ? e.message : e);
  }

  if (!text || text.length < 50) {
    try {
      const { extractText } = await import('unpdf');
      const result = await extractText(new Uint8Array(buf));
      text = (Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '')).trim();
      console.log(`[ACERTA PDF] unpdf: ${text.length} caracteres`);
    } catch (e) {
      console.log('[ACERTA PDF] unpdf falló:', e instanceof Error ? e.message : e);
    }
  }

  if (!text || text.length < 50) {
    // Fallback: Vision OCR for PDF
    try {
      const { extractTextFromPDFVision } = await import('@/lib/services/vision-ocr');
      text = await extractTextFromPDFVision(buf);
      console.log(`[ACERTA PDF] Vision OCR: ${text.length} caracteres`);
    } catch (e) {
      console.log('[ACERTA PDF] Vision OCR falló:', e instanceof Error ? e.message : e);
    }
  }

  if (!text) {
    throw new Error('No se pudo extraer texto del PDF de ACERTA.');
  }

  console.log('[ACERTA PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[ACERTA PDF] ===== FIN TEXTO =====');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`[ACERTA PDF] Total líneas: ${lines.length}`);

  const rows: AcertaRow[] = [];

  // Strategy 1: Look for client lines that end with "NAME + RAMO(digits) + POLICY"
  // followed by an amounts line starting with a date
  // Client line pattern: text ending with digits(2-4) space digits(5+)
  // e.g. "ROLANDO OLIVARES IGUALA02 1024065"
  const clientLineRe = /^(.+?)(\d{2,4})\s+(\d{5,})$/;
  // Amounts line: starts with date DD/MM/YYYY, contains decimal numbers
  const dateLineRe = /^\d{2}\/\d{2}\/\d{4}\s+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const u = line.toUpperCase();

    // Skip header/footer/summary lines
    if (u.includes('FECHA POLIZA') || u.includes('LIDERES EN SEGUROS') ||
        u.includes('ESTADO DE CUENTA') || u.includes('RESUMEN') ||
        u.includes('DESCUENTOS') || u.includes('NETO A PAGAR') ||
        u.includes('CORREDOR DE SEGUROS') || u.includes('BELLA VISTA') ||
        u.includes('CONTACTO@') || u.includes('LICENCIA') ||
        u.includes('PÁGINA') || u.includes('ESTADISA') ||
        u.includes('TELEF') || u.includes('PANAM') ||
        u.includes('CREDITO:') || u.includes('TIPO DE PAGO')) continue;

    const clientMatch = line.match(clientLineRe);
    if (!clientMatch) continue;

    const clientName = clientMatch[1]!.trim();
    const ramo = clientMatch[2]!;
    const poliza = clientMatch[3]!;

    // Validate: client name should have at least 3 alpha chars and not be a known non-name
    if (clientName.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '').length < 3) continue;
    if (/^(Telef|Total|Fecha|Inicio|Fin|Credito)/i.test(clientName)) continue;

    const policyNumber = `${ramo}-${poliza}`;

    // Look for the amounts line BOTH backwards and forwards (nearby lines with date)
    let commission = 0;

    // Search backwards first (ACERTA text has amounts BEFORE client name)
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const amountLine = lines[j]!;
      if (dateLineRe.test(amountLine)) {
        const decimals = amountLine.match(/\d+\.\d{2}/g);
        if (decimals && decimals.length >= 2) {
          commission = parseNumber(decimals[decimals.length - 1]!);
        } else if (decimals && decimals.length === 1) {
          commission = parseNumber(decimals[0]!);
        }
        break;
      }
    }

    // If not found backwards, search forwards
    if (!commission) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const amountLine = lines[j]!;
        if (dateLineRe.test(amountLine)) {
          const decimals = amountLine.match(/\d+\.\d{2}/g);
          if (decimals && decimals.length >= 2) {
            commission = parseNumber(decimals[decimals.length - 1]!);
          } else if (decimals && decimals.length === 1) {
            commission = parseNumber(decimals[0]!);
          }
          break;
        }
      }
    }

    if (!commission) {
      console.log(`[ACERTA PDF] ⚠️ Cliente sin comisión: "${clientName}" Póliza=${policyNumber}`);
      continue;
    }

    console.log(`[ACERTA PDF] ✅ Cliente="${clientName}" Póliza=${policyNumber} Comisión=${commission}`);
    rows.push({ policy_number: policyNumber, client_name: clientName, gross_amount: commission });
  }

  console.log(`[ACERTA PDF] Total filas extraídas: ${rows.length}`);
  return rows;
}
