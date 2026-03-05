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
 * ACERTA PDF text format:
 *
 * pdf-parse extracts row-by-row:
 *   "ROLANDO OLIVARES IGUALA02 1024065"
 *   "03/02/2026 COMISIONES PRIMA AVS 745779 1788382REC 176.19 20 35.23 100"
 *
 * unpdf extracts COLUMN-BY-COLUMN (common case):
 *   49.23 8.512
 *   25/02/2026
 *   26/02/2026
 *   COMISIONES PRIMA
 *   ...
 *   8.94
 *   40.29
 *   5.03      <-- these are the %comision values
 *   20
 *   0.45      <-- these are the commission amounts
 *   8.06
 *   100
 *   100
 *   Total:
 *   ANTONIO OMAR GUERRA GUERRA
 *   MANOLO DEL ROSARIO GARCIA
 *   20 1000008
 *   02 1012445
 *
 * Both formats must be supported.
 */
export async function parseAcertaPDF(fileBuffer: ArrayBuffer): Promise<AcertaRow[]> {
  console.log('[ACERTA PDF] Iniciando parseo directo de PDF');

  const buf = Buffer.from(fileBuffer);

  // Try pdf-parse first, then unpdf
  let text = '';
  let usedParser = '';
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule.default || pdfParseModule) as any;
    const result = await pdfParse(buf);
    text = String(result?.text || '').trim();
    if (text.length >= 50) usedParser = 'pdf-parse';
    console.log(`[ACERTA PDF] pdf-parse: ${text.length} caracteres`);
  } catch (e) {
    console.log('[ACERTA PDF] pdf-parse falló:', e instanceof Error ? e.message : e);
  }

  if (!text || text.length < 50) {
    try {
      const { extractText } = await import('unpdf');
      const result = await extractText(new Uint8Array(buf));
      text = (Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '')).trim();
      if (text.length >= 50) usedParser = 'unpdf';
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
      if (text.length >= 50) usedParser = 'vision';
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
  console.log(`[ACERTA PDF] Total líneas: ${lines.length}, parser: ${usedParser}`);

  // Try row-based parsing first (pdf-parse format), then columnar (unpdf format)
  let rows = parseRowBased(lines);
  if (rows.length === 0) {
    console.log('[ACERTA PDF] Row-based parsing found 0 rows, trying columnar parsing...');
    rows = parseColumnar(lines);
  }

  console.log(`[ACERTA PDF] Total filas extraídas: ${rows.length}`);
  return rows;
}

/**
 * Strategy 1: Row-based (pdf-parse format)
 * Client line: "NOMBRE CLIENTE02 1024065" → name + ramo(2d) + policy(5+d)
 * Amounts line (nearby): "DD/MM/YYYY COMISIONES PRIMA ... 176.19 20 35.23 100"
 */
function parseRowBased(lines: string[]): AcertaRow[] {
  const rows: AcertaRow[] = [];
  const clientLineRe = /^(.+?)(\d{2,4})\s+(\d{5,})$/;
  const dateLineRe = /^\d{2}\/\d{2}\/\d{4}\s+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isSkipLine(line)) continue;

    const clientMatch = line.match(clientLineRe);
    if (!clientMatch) continue;

    const clientName = clientMatch[1]!.trim();
    const ramo = clientMatch[2]!;
    const poliza = clientMatch[3]!;

    if (clientName.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '').length < 3) continue;
    if (/^(Telef|Total|Fecha|Inicio|Fin|Credito)/i.test(clientName)) continue;

    const policyNumber = `${ramo}-${poliza}`;
    let commission = 0;

    // Search backwards (amounts line before client name)
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const amountLine = lines[j]!;
      if (dateLineRe.test(amountLine)) {
        commission = extractCommissionFromAmountLine(amountLine);
        break;
      }
    }

    // Search forwards if not found
    if (!commission) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const amountLine = lines[j]!;
        if (dateLineRe.test(amountLine)) {
          commission = extractCommissionFromAmountLine(amountLine);
          break;
        }
      }
    }

    if (!commission) {
      console.log(`[ACERTA PDF] ⚠️ Row-based: sin comisión "${clientName}" Póliza=${policyNumber}`);
      continue;
    }

    console.log(`[ACERTA PDF] ✅ Row-based: "${clientName}" Póliza=${policyNumber} Comisión=${commission}`);
    rows.push({ policy_number: policyNumber, client_name: clientName, gross_amount: commission });
  }

  return rows;
}

function extractCommissionFromAmountLine(line: string): number {
  const decimals = line.match(/\d+\.\d{2}/g);
  if (decimals && decimals.length >= 2) {
    return parseNumber(decimals[decimals.length - 1]!);
  } else if (decimals && decimals.length === 1) {
    return parseNumber(decimals[0]!);
  }
  return 0;
}

/**
 * Strategy 2: Columnar (unpdf format)
 *
 * unpdf extracts text column-by-column. The structure repeats per page:
 *   - Dates (DD/MM/YYYY) in order
 *   - Operations ("COMISIONES PRIMA")
 *   - Types ("AVS")
 *   - Invoice/factura numbers
 *   - "REC" markers
 *   - Prima amounts (decimal numbers)
 *   - Commission % (integers like 20)
 *   - Commission amounts (decimal numbers)
 *   - %Coa (usually 100)
 *   - "Total:"
 *   - Client names (ALL CAPS, multiple words, letters only)
 *   - Ramo + Policy lines ("20 1000008")
 *
 * We collect client names and ramo+policy lines, pair them positionally,
 * then extract commission amounts from the numeric columns.
 */
function parseColumnar(lines: string[]): AcertaRow[] {
  const rows: AcertaRow[] = [];

  // Ramo+Policy pattern: exactly "DD NNNNNNN" (2-digit ramo, space, 5+ digit policy)
  const ramoPolicyRe = /^(\d{2})\s+(\d{5,})$/;
  // Client name: at least 2 words, all uppercase letters/spaces/accents, no digits
  const clientNameRe = /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]{4,}$/;
  // Date line
  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;
  // Decimal number (amounts like 8.94, 0.45)
  const decimalRe = /^\d+\.\d{1,2}$/;
  // Integer that could be commission % (e.g., 20, 100)
  const intRe = /^\d{1,3}$/;

  // Collect all data points
  const dates: { idx: number; value: string }[] = [];
  const clientNames: { idx: number; value: string }[] = [];
  const ramoPolicies: { idx: number; ramo: string; policy: string }[] = [];
  const decimals: { idx: number; value: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isSkipLine(line)) continue;

    if (dateRe.test(line)) {
      dates.push({ idx: i, value: line });
      continue;
    }

    const rpMatch = line.match(ramoPolicyRe);
    if (rpMatch) {
      ramoPolicies.push({ idx: i, ramo: rpMatch[1]!, policy: rpMatch[2]! });
      continue;
    }

    if (clientNameRe.test(line) && line.split(/\s+/).length >= 2) {
      // Exclude known non-names
      const u = line.toUpperCase();
      if (u === 'COMISIONES PRIMA' || u.startsWith('TOTAL') || u.includes('RESUMEN')) continue;
      clientNames.push({ idx: i, value: line });
      continue;
    }

    if (decimalRe.test(line)) {
      decimals.push({ idx: i, value: parseNumber(line) });
      continue;
    }
  }

  console.log(`[ACERTA PDF] Columnar: dates=${dates.length}, clients=${clientNames.length}, policies=${ramoPolicies.length}, decimals=${decimals.length}`);

  // The number of transactions = min(clientNames, ramoPolicies)
  const txCount = Math.min(clientNames.length, ramoPolicies.length);
  if (txCount === 0) return rows;

  // Columnar format decimal sequence (for N transactions):
  //   prima₁..primaN, %com₁..%comN, comisión₁..comisiónN
  // But %com can be decimal (e.g. 5.03) or integer (e.g. 20).
  // After the commissions come %Coa values (integers like 100).
  //
  // Strategy: take the last N decimals BEFORE the client names section.
  // These are the commission amounts. %Coa values are integers and won't appear.
  
  const firstDateIdx = dates.length > 0 ? dates[0]!.idx : 0;
  const firstClientIdx = clientNames.length > 0 ? clientNames[0]!.idx : lines.length;
  const decimalsBeforeClients = decimals.filter(d => d.idx > firstDateIdx && d.idx < firstClientIdx);

  console.log(`[ACERTA PDF] Columnar: ${decimalsBeforeClients.length} decimals between dates and clients, need last ${txCount}`);
  decimalsBeforeClients.forEach(d => console.log(`[ACERTA PDF]   decimal[${d.idx}] = ${d.value}`));

  // The last N decimals before client names are the commission amounts
  const commissionDecimals = decimalsBeforeClients.slice(-txCount);

  for (let t = 0; t < txCount; t++) {
    const clientName = clientNames[t]!.value;
    const rp = ramoPolicies[t]!;
    const policyNumber = `${rp.ramo}-${rp.policy}`;
    const commission = commissionDecimals[t]?.value ?? 0;

    if (commission <= 0) {
      console.log(`[ACERTA PDF] ⚠️ Columnar: sin comisión "${clientName}" Póliza=${policyNumber}`);
      continue;
    }

    console.log(`[ACERTA PDF] ✅ Columnar: "${clientName}" Póliza=${policyNumber} Comisión=${commission}`);
    rows.push({ policy_number: policyNumber, client_name: clientName, gross_amount: commission });
  }

  return rows;
}

function isSkipLine(line: string): boolean {
  const u = line.toUpperCase();
  return (
    u.includes('FECHA POLIZA') || u.includes('LIDERES EN SEGUROS') ||
    u.includes('ESTADO DE CUENTA') || u.includes('RESUMEN') ||
    u.includes('DESCUENTOS') || u.includes('NETO A PAGAR') ||
    u.includes('CORREDOR DE SEGUROS') || u.includes('BELLA VISTA') ||
    u.includes('CONTACTO@') || u.includes('LICENCIA') ||
    u.includes('PÁGINA') || u.includes('ESTADISA') ||
    u.includes('TELEF') || u.includes('PANAM') ||
    u.includes('CREDITO:') || u.includes('TIPO DE PAGO')
  );
}
