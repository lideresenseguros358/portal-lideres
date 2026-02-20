interface AssistcardRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseNumber(token: string): number {
  const cleaned = String(token || '')
    .replace(/,/g, '')
    .replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function isHeaderLine(line: string): boolean {
  const u = line.toUpperCase();
  return (
    (u.includes('AGENCY') && u.includes('NAME')) ||
    (u.includes('VOUCHER') && u.includes('DOC')) ||
    (u.includes('NOMBRE') && u.includes('PAX')) ||
    (u.includes('NET') && u.includes('SALES')) ||
    (u.includes('COMISSION') || u.includes('COMMISSION'))
  );
}

/**
 * Parse ASSISTCARD OCR text into rows.
 *
 * Expected line format from OCR (may vary slightly):
 *   LIDERES EN SEGUROS5077217982  507100014148  GUERRA, ISABELLA  31.50  6.30
 *
 * Structure:
 *   - Agency name (contains "SEGUROS" or "LIDERES")
 *   - Voucher: first long digit sequence (e.g. 5077217982) — THIS is the policy_number
 *   - Doc number: second long digit sequence (e.g. 507100014148) — SKIP this
 *   - Client name: text with comma (e.g. GUERRA, ISABELLA)
 *   - Net Sales: decimal number
 *   - Commission: last decimal number — THIS is gross_amount
 */
function extractRowsFromText(text: string): AssistcardRow[] {
  const lines = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  console.log(`[ASSISTCARD PARSER] Total líneas a procesar: ${lines.length}`);

  // ── Phase 1: Extract all client entries (voucher + name) in order ──
  // Also try inline amounts if OCR puts everything on one line.
  const clients: { voucher: string; name: string; inlineCommission?: number }[] = [];
  // ── Phase 2: Collect all standalone decimal amounts ──
  const standaloneAmounts: number[] = [];

  for (const line of lines) {
    if (isHeaderLine(line)) continue;
    const u = line.toUpperCase();
    if (u.includes('TOTAL') || u.includes('SUBTOTAL')) continue;

    // Check if this is a client data line (has LIDERES/SEGUROS + digit sequences)
    const hasAgency = u.includes('LIDERES') || u.includes('SEGUROS');
    const digitSeqs = [...line.matchAll(/\d{7,}/g)].map(m => ({ value: m[0], index: m.index! }));

    if (hasAgency && digitSeqs.length >= 2) {
      // Voucher = first digit sequence after agency name
      const voucher = digitSeqs[0]!.value;
      const docNumber = digitSeqs[1]!;

      // Client name = text after doc number, before any decimal amounts
      const afterDoc = line.substring(docNumber.index + docNumber.value.length);
      const decimalMatches = [...afterDoc.matchAll(/\d+\.\d{2}/g)];

      let clientName: string;
      let inlineCommission: number | undefined;

      if (decimalMatches.length >= 2) {
        // Amounts are on the same line: "NAME 31.50 6.30"
        clientName = afterDoc.substring(0, decimalMatches[0]!.index!).trim();
        // Commission = last decimal
        inlineCommission = parseNumber(decimalMatches[decimalMatches.length - 1]![0]);
      } else if (decimalMatches.length === 1) {
        clientName = afterDoc.substring(0, decimalMatches[0]!.index!).trim();
        inlineCommission = parseNumber(decimalMatches[0]![0]);
      } else {
        // No amounts on this line — they'll come on subsequent lines
        clientName = afterDoc.trim();
      }

      // Clean up name
      clientName = clientName.replace(/^\s*[,.\-]\s*/, '').replace(/\s*[,.\-]\s*$/, '').trim();

      if (clientName && clientName.length >= 2) {
        clients.push({ voucher, name: clientName, inlineCommission });
        console.log(`[ASSISTCARD PARSER] Cliente: Voucher=${voucher} Name="${clientName}"${inlineCommission ? ` InlineComm=${inlineCommission}` : ''}`);
      }
      continue;
    }

    // Check if this is a standalone amount line (just a decimal number)
    if (/^-?\d+\.\d{2}$/.test(line.trim())) {
      standaloneAmounts.push(parseNumber(line));
      continue;
    }
  }

  // Filter out trailing total line:
  // If standalone amounts count is odd (not a clean multiple of 2),
  // check if the last amount is a sum of commissions — if so, remove it.
  if (standaloneAmounts.length > 0 && standaloneAmounts.length % 2 !== 0) {
    const last = standaloneAmounts[standaloneAmounts.length - 1]!;
    // Check if removing the last gives us 2× clients
    if (Math.abs((standaloneAmounts.length - 1) / clients.length - 2) < 0.3) {
      console.log(`[ASSISTCARD PARSER] Removiendo total final: ${last}`);
      standaloneAmounts.pop();
    }
  }

  console.log(`[ASSISTCARD PARSER] Clientes encontrados: ${clients.length}, Montos standalone: ${standaloneAmounts.length}`);

  // ── Phase 3: Build rows ──
  const rows: AssistcardRow[] = [];

  // Check if all clients have inline commissions
  const allInline = clients.length > 0 && clients.every(c => c.inlineCommission !== undefined && c.inlineCommission > 0);

  if (allInline) {
    // All amounts were on the same line as the client
    for (const c of clients) {
      rows.push({ policy_number: c.voucher, client_name: c.name, gross_amount: c.inlineCommission! });
      console.log(`[ASSISTCARD PARSER] ✅ (inline) Voucher=${c.voucher} Client="${c.name}" Commission=${c.inlineCommission}`);
    }
  } else {
    // Amounts come as standalone lines in pairs: [NetSales, Commission, NetSales, Commission, ...]
    // Commission is every 2nd amount (index 1, 3, 5, ...)
    // If we have exactly 2× clients amounts, pair them
    // If we have exactly 1× clients amounts, each amount IS the commission
    const ratio = clients.length > 0 ? standaloneAmounts.length / clients.length : 0;

    if (ratio >= 1.8 && ratio <= 2.2) {
      // 2 amounts per client: [NetSales, Commission] pairs
      for (let i = 0; i < clients.length; i++) {
        const commIdx = i * 2 + 1; // Commission is the 2nd of each pair
        const commission = commIdx < standaloneAmounts.length ? standaloneAmounts[commIdx]! : 0;
        if (commission) {
          rows.push({ policy_number: clients[i]!.voucher, client_name: clients[i]!.name, gross_amount: commission });
          console.log(`[ASSISTCARD PARSER] ✅ (paired) Voucher=${clients[i]!.voucher} Client="${clients[i]!.name}" Commission=${commission}`);
        }
      }
    } else if (ratio >= 0.8 && ratio <= 1.2) {
      // 1 amount per client: each amount is the commission
      for (let i = 0; i < clients.length; i++) {
        const commission = i < standaloneAmounts.length ? standaloneAmounts[i]! : 0;
        if (commission) {
          rows.push({ policy_number: clients[i]!.voucher, client_name: clients[i]!.name, gross_amount: commission });
          console.log(`[ASSISTCARD PARSER] ✅ (single) Voucher=${clients[i]!.voucher} Client="${clients[i]!.name}" Commission=${commission}`);
        }
      }
    } else {
      // Fallback: try to use inline commissions for those that have them,
      // and pair remaining standalone amounts with those that don't
      const remaining = [...standaloneAmounts];
      for (const c of clients) {
        if (c.inlineCommission && c.inlineCommission > 0) {
          rows.push({ policy_number: c.voucher, client_name: c.name, gross_amount: c.inlineCommission });
          console.log(`[ASSISTCARD PARSER] ✅ (mixed-inline) Voucher=${c.voucher} Client="${c.name}" Commission=${c.inlineCommission}`);
        } else if (remaining.length >= 2) {
          // Take pair: skip NetSales, use Commission
          remaining.shift(); // NetSales
          const commission = remaining.shift()!; // Commission
          rows.push({ policy_number: c.voucher, client_name: c.name, gross_amount: commission });
          console.log(`[ASSISTCARD PARSER] ✅ (mixed-paired) Voucher=${c.voucher} Client="${c.name}" Commission=${commission}`);
        } else if (remaining.length === 1) {
          const commission = remaining.shift()!;
          rows.push({ policy_number: c.voucher, client_name: c.name, gross_amount: commission });
          console.log(`[ASSISTCARD PARSER] ✅ (mixed-single) Voucher=${c.voucher} Client="${c.name}" Commission=${commission}`);
        }
      }
    }
  }

  console.log(`[ASSISTCARD PARSER] Total filas extraídas: ${rows.length}`);
  return rows;
}

/**
 * Parse ASSISTCARD PDF by extracting native text (no OCR needed).
 * Falls back to OCR only if native text extraction yields nothing.
 */
export async function parseAssistcardPDF(fileBuffer: ArrayBuffer): Promise<AssistcardRow[]> {
  // Try native text extraction first (pdf-parse)
  let text = '';
  try {
    const pdfParse = (await import('pdf-parse')).default as any;
    const result = await pdfParse(Buffer.from(fileBuffer));
    text = String(result?.text || '').trim();
    console.log(`[ASSISTCARD PDF] Texto nativo extraído: ${text.length} caracteres`);
  } catch (err) {
    console.log('[ASSISTCARD PDF] pdf-parse falló:', err instanceof Error ? err.message : err);
  }

  if (text && text.length > 50) {
    const rows = extractRowsFromText(text);
    if (rows.length > 0) {
      console.log(`[ASSISTCARD PDF] Filas extraídas del texto nativo: ${rows.length}`);
      return rows;
    }
    console.log('[ASSISTCARD PDF] Texto nativo no produjo filas, intentando OCR...');
  }

  // Fallback: OCR (may fail if billing not enabled)
  try {
    const { extractTextFromImageBuffer } = await import('@/lib/services/vision-ocr');
    const ocrText = await extractTextFromImageBuffer(fileBuffer);
    const rows = extractRowsFromText(ocrText);
    console.log(`[ASSISTCARD PDF OCR] Filas extraídas: ${rows.length}`);
    return rows;
  } catch (ocrErr) {
    console.error('[ASSISTCARD PDF] OCR también falló:', ocrErr instanceof Error ? ocrErr.message : ocrErr);
    if (text) {
      // Log what we got from native extraction for debugging
      console.log('[ASSISTCARD PDF] Primeras 25 líneas del texto nativo:');
      console.log(text.split('\n').slice(0, 25).join('\n'));
    }
    throw new Error(
      'No se pudo extraer datos del PDF de ASSISTCARD. ' +
      'Intente exportar el reporte como imagen (JPG/PNG) o como Excel/CSV.'
    );
  }
}

export async function parseAssistcardImage(fileBuffer: ArrayBuffer, fileName: string): Promise<AssistcardRow[]> {
  const ext = fileName.toLowerCase().split('.').pop();

  // Handle PDFs
  if (ext === 'pdf') {
    return parseAssistcardPDF(fileBuffer);
  }

  if (!ext || !['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(ext)) {
    return [];
  }

  // Google Vision OCR
  console.log('[ASSISTCARD] Usando Google Vision OCR...');
  const { extractTextFromImageBuffer } = await import('@/lib/services/vision-ocr');
  const text = await extractTextFromImageBuffer(fileBuffer);
  console.log(`[ASSISTCARD Vision] Texto extraído: ${text.length} caracteres`);
  console.log('[ASSISTCARD Vision] Primeras 30 líneas del OCR:');
  console.log(text.split('\n').slice(0, 30).join('\n'));

  const rows = extractRowsFromText(text);
  if (rows.length === 0) {
    console.log('[ASSISTCARD Vision] No se detectaron filas del texto OCR.');
  } else {
    console.log(`[ASSISTCARD Vision] Filas extraídas: ${rows.length}`);
  }
  return rows;
}

export function parseAssistcardText(text: string): AssistcardRow[] {
  return extractRowsFromText(text);
}
