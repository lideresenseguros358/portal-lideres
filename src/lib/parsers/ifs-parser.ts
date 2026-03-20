import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface IFSRow {
  policy_number: string;
  client_name: string | null;
  gross_amount: number;
}

function parseMoneyToken(token: string): number {
  const cleaned = String(token || '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

// IFS PDFs often embed fonts without a ToUnicode map; extractors return private-use glyphs.
// The glyphs are consistent and can be mapped back to ASCII letters using known header words.
const IFS_GLYPH_MAP: Record<string, string> = {
  // Letters (from debug output)
  '\uF044': 'D',
  '\uF045': 'E',
  '\uF054': 'T',
  '\uF041': 'A',
  '\uF04C': 'L',
  '\uF043': 'C',
  '\uF04F': 'O',
  '\uF04D': 'M',
  '\uF049': 'I',
  '\uF053': 'S',
  '\uF04E': 'N',
  '\uF050': 'P',
  '\uF052': 'R',
  '\uF047': 'G',
  '\uF055': 'U',
  '\uF056': 'V',
  '\uF042': 'B',
  '\uF046': 'F',
  '\uF048': 'H',
  '\uF059': 'Y',
  '\uF057': 'W',
  '\uF04A': 'J',
  '\uF05A': 'Z',
  // Lowercase (from debug output)
  '\uF077': 'w',
  '\uF069': 'i',
  '\uF066': 'f',
  '\uF073': 's',
  '\uF063': 'c',
  '\uF06F': 'o',
  '\uF06D': 'm',
  '\uF070': 'p',
  '\uF061': 'a',
  '\uF065': 'e',
  // Digits (from debug output)
  '\uF030': '0',
  '\uF031': '1',
  '\uF032': '2',
  '\uF033': '3',
  '\uF034': '4',
  '\uF035': '5',
  '\uF036': '6',
  '\uF037': '7',
  '\uF038': '8',
  '\uF039': '9',
  // Punctuation (from debug output)
  '\uF020': ' ',
  '\uF02D': '-',
  '\uF02E': '.',
  '\uF02C': ',',
  '\uF025': '%',
  '\uF02F': '/',
  '\uF03A': ':',
};

function decodeIFSGlyphs(text: string): string {
  let out = '';
  for (const ch of String(text || '')) {
    if (IFS_GLYPH_MAP[ch] !== undefined) {
      out += IFS_GLYPH_MAP[ch];
      continue;
    }
    out += ch;
  }
  return out;
}

function normalizeIFSText(text: string): string {
  const decoded = decodeIFSGlyphs(String(text || ''));
  // Keep digits/letters/selected punctuation; replace everything else with space
  let t = decoded
    .replace(/[^\x20-\x7E\n]/g, ' ') // remove weird glyphs
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Insert spaces between digit<->letter boundaries to undo OCR/font concatenation
  t = t
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([0-9])/g, '$1 $2');

  // Collapse whitespace
  t = t.replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ');

  return t;
}


async function extractIFSText(fileBuffer: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(fileBuffer);

  // 1) Intentar pdf-parse
  let text = '';
  try {
    const pdfParse = (await import('pdf-parse')).default as any;
    const result = await pdfParse(buf);
    text = String(result?.text || '').trim();
    console.log(`[IFS extractText] pdf-parse: ${text.length} caracteres`);
    if (text.length > 20) {
      console.log('[IFS extractText] pdf-parse primeras 5 líneas:', text.split('\n').slice(0, 5).join(' | '));
      return text;
    }
  } catch (e) {
    console.log('[IFS extractText] pdf-parse falló:', e instanceof Error ? e.message : e);
  }

  // 2) Intentar unpdf
  try {
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(buf);
    const result = await extractText(uint8);
    const unpdfText = Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '');
    console.log(`[IFS extractText] unpdf: ${unpdfText.length} caracteres`);
    if (unpdfText.trim().length > 20) {
      console.log('[IFS extractText] unpdf primeras 5 líneas:', unpdfText.split('\n').slice(0, 5).join(' | '));
      return unpdfText.trim();
    }
  } catch (e) {
    console.log('[IFS extractText] unpdf falló:', e instanceof Error ? e.message : e);
  }

  return text; // Return whatever we got (even if short)
}

const POLICY_RE = /[A-Z]{2,10}-\d{2,6}(?:-[A-Z]-\d{1,3})?/;
const PERCENT_RE = /\d{1,3}(?:\.\d+)?%/;
const MONEY_TOKEN_RE = /\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/;

function isLikelyClientName(s: string): boolean {
  const u = s.toUpperCase();
  if (!u) return false;
  if (u.includes('DETALLE') || u.includes('COMISION') || u.includes('RESUMEN')) return false;
  if (u.includes('LIDERES EN SEGUROS')) return false;
  return u.replace(/[^A-Z]/g, '').length >= 6;
}

export async function parseIFSPDF(fileBuffer: ArrayBuffer): Promise<IFSRow[]> {
  let rawText = await extractIFSText(fileBuffer);
  
  // Si no se pudo extraer texto suficiente, usar Google Vision OCR para PDFs
  if (!rawText || rawText.trim().length < 20) {
    console.log('[IFS] PDF sin texto extraíble, usando Google Vision batchAnnotateFiles...');
    try {
      const { extractTextFromPDFVision } = await import('@/lib/services/vision-ocr');
      rawText = await extractTextFromPDFVision(Buffer.from(fileBuffer));
      
      if (!rawText || rawText.trim().length < 20) {
        throw new Error('Vision API no pudo extraer texto del PDF');
      }
    } catch (ocrError) {
      console.error('[IFS] Error en Vision OCR:', ocrError instanceof Error ? ocrError.message : String(ocrError));
      throw new Error(
        'No se pudo extraer texto del PDF de IFS.\n\n' +
        'Alternativas:\n' +
        '1. Exporta el reporte a Excel/CSV desde el sistema de IFS\n' +
        '2. Abre el PDF, selecciona todo el texto, cópialo y pégalo en un archivo .txt\n' +
        '3. Guarda el PDF como imagen (JPG/PNG) y súbelo aquí'
      );
    }
  }

  const normalized = normalizeIFSText(rawText);
  console.log(`[IFS] Texto normalizado (${normalized.length} chars):\n${normalized.slice(0, 500)}`);

  const lines = normalized
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let rows: IFSRow[] = [];

  // Strategy 1: Single-line parsing (text-based PDFs where all data is on one line)
  rows = parseSingleLine(lines);
  if (rows.length > 0) {
    console.log(`[IFS] Strategy 1 (single-line) found ${rows.length} rows`);
    return rows;
  }

  // Strategy 2: Multi-line OCR parsing (Vision OCR splits fields across lines)
  rows = parseMultiLineOCR(lines);
  if (rows.length > 0) {
    console.log(`[IFS] Strategy 2 (multi-line OCR) found ${rows.length} rows`);
    return rows;
  }

  // Strategy 3: Full-text scan - join all text and look for patterns
  rows = parseFullTextScan(normalized);
  if (rows.length > 0) {
    console.log(`[IFS] Strategy 3 (full-text scan) found ${rows.length} rows`);
    return rows;
  }

  const snippet = lines.slice(0, 40).join('\n');
  throw new Error(
    'No se pudieron detectar filas en el PDF de IFS con el parser actual.\n\n' +
      'Snippet (texto normalizado):\n' +
      snippet
  );
}

/** Strategy 1: All data on a single line (policy + % + money) */
function parseSingleLine(lines: string[]): IFSRow[] {
  const rows: IFSRow[] = [];
  for (const line of lines) {
    const u = line.toUpperCase();
    const policyMatch = u.match(POLICY_RE);
    if (!policyMatch || policyMatch.index == null) continue;
    const percentMatch = u.match(PERCENT_RE);
    if (!percentMatch || percentMatch.index == null) continue;

    const policy_number = policyMatch[0].trim();
    const policyEnd = policyMatch.index + policyMatch[0].length;
    const percentStart = percentMatch.index;
    const between = u.slice(policyEnd, percentStart).trim();
    const client_name = isLikelyClientName(between) ? between.replace(/\s+/g, ' ').trim() : null;

    const afterPercent = u.slice(percentStart + percentMatch[0].length);
    const signedMoneyRe = /-?\s*(?:\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;
    const moneyMatch = signedMoneyRe.exec(afterPercent);
    const gross_amount = moneyMatch ? parseMoneyToken(moneyMatch[0]) : 0;
    if (!gross_amount) continue;
    rows.push({ policy_number, client_name, gross_amount });
  }
  return rows;
}

/** Strategy 2: Multi-line OCR text where fields are on separate lines.
 *  IFS OCR format:
 *    DATE POLICY_NUMBER
 *    PRODUCT_TYPE
 *    CLIENT_NAME
 *    ...
 *    PRIMA   COMISION   (or amounts on separate lines)
 *    275.63  55.13
 *  We find policy lines, then scan forward for client name and money amounts.
 */
function parseMultiLineOCR(lines: string[]): IFSRow[] {
  const rows: IFSRow[] = [];
  // Date + policy pattern: "02/10/2026 RGRCG-953" or just "RGRCG-953"
  const DATE_POLICY_RE = /(?:\d{1,2}\/\d{1,2}\/\d{2,4}\s+)?([A-Z]{2,10}-\d{2,6}(?:-[A-Z]-\d{1,3})?)/;
  const NOISE_WORDS = ['DETALLE', 'LIDERES', 'DIRECCION', 'LICENCIA', 'CODIGO',
    'PORCENTAJE', 'RECIBO', 'FECHA', 'POLIZA', 'PRODUCTO', 'CLIENTE',
    'FIANZAS', 'SECUROS', 'SEGUROS', 'INTERAMERICANA', 'HUELLAS', 'GENERALES', 'PERSONAS',
    'DEJANDO', 'PH BAY', 'AVE 3', 'PISO', 'OFIC'];
  // Money regex that also handles B/.prefix: "275.63" or "B/.55.13"
  const MONEY_LINE_RE = /(?:B\/\.\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})/g;

  // Find all policy lines first
  const policyIndices: { idx: number; policy: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.toUpperCase();
    const m = line.match(DATE_POLICY_RE);
    if (m) {
      policyIndices.push({ idx: i, policy: m[1]!.trim() });
    }
  }

  for (let p = 0; p < policyIndices.length; p++) {
    const { idx: i, policy: policy_number } = policyIndices[p]!;
    // Scan from policy line to end of section (next policy or end of page)
    const endIdx = p + 1 < policyIndices.length 
      ? policyIndices[p + 1]!.idx 
      : Math.min(i + 25, lines.length);

    console.log(`[IFS OCR] Found policy at line ${i}: ${policy_number}, scanning to line ${endIdx}`);

    let client_name: string | null = null;
    const moneyValues: number[] = [];
    let lastComisionIdx = -1;

    for (let j = i + 1; j < endIdx; j++) {
      const fwd = lines[j]!.trim();
      const fwdU = fwd.toUpperCase();

      // Skip pure noise lines
      const isNoise = NOISE_WORDS.some(w => fwdU === w || (fwdU.length < 25 && fwdU.startsWith(w)));
      
      // Track if this line or a preceding line says "COMISION" to know which amounts are commissions
      if (fwdU.includes('COMISION')) {
        lastComisionIdx = j;
      }

      // Collect money values (handle B/. prefix)
      let moneyMatch;
      const moneyReCopy = /(?:B\/\.\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})/g;
      while ((moneyMatch = moneyReCopy.exec(fwd)) !== null) {
        moneyValues.push(parseMoneyToken(moneyMatch[1]!));
      }

      // Try to identify client name
      if (!client_name && !isNoise && fwdU.replace(/[^A-Z]/g, '').length >= 4) {
        const looksLikeClient = (fwdU.includes(',') || fwdU.includes('S.A') || fwdU.includes('S. A'))
          || (!fwdU.match(/^(RESPONSABILIDAD|RAMO|GENERAL|VIDA|SALUD|AUTO|INCENDIO|TOTAL|RESUMEN|PRIMA|COMISION)\b/));
        if (looksLikeClient && isLikelyClientName(fwdU)) {
          client_name = fwd.replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Determine commission from collected amounts.
    // IFS reports show: PRIMA, COMISION as paired values.
    // Typically amounts appear as pairs: [prima, comision] possibly repeated with B/. prefix.
    // The commission is the SMALLER of each pair, or the one after "COMISION" label.
    // For OCR text like: "275.63" then "55.13" then "B/.275.63" then "B/.55.13"
    // → unique amounts are [275.63, 55.13], commission is 55.13 (smaller)
    let commission = 0;
    
    // Deduplicate amounts (B/. values repeat the same numbers)
    const uniqueAmounts = [...new Set(moneyValues.map(v => Math.round(v * 100)))].map(v => v / 100);
    
    if (uniqueAmounts.length >= 2) {
      // Commission is the smaller amount (prima > commission)
      uniqueAmounts.sort((a, b) => a - b);
      commission = uniqueAmounts[0]!; // smallest = commission
    } else if (uniqueAmounts.length === 1) {
      commission = uniqueAmounts[0]!;
    }

    console.log(`[IFS OCR] Policy ${policy_number}: client="${client_name}", money=[${moneyValues}], unique=[${uniqueAmounts}], commission=${commission}`);

    if (Math.abs(commission) > 0.01) {
      rows.push({ policy_number, client_name, gross_amount: commission });
    }
  }

  return rows;
}

/** Strategy 3: Join all text and use regex to find patterns across the full blob */
function parseFullTextScan(normalized: string): IFSRow[] {
  const rows: IFSRow[] = [];
  // Look for policy number followed eventually by money amounts
  const fullText = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const policyGlobalRe = /([A-Z]{2,10}-\d{2,6}(?:-[A-Z]-\d{1,3})?)/g;
  let match;
  
  while ((match = policyGlobalRe.exec(fullText)) !== null) {
    const policy_number = match[1]!;
    const afterPolicy = fullText.slice(match.index + match[0].length, match.index + match[0].length + 300);
    
    // Find all money tokens after this policy
    const moneyRe = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
    const amounts: number[] = [];
    let m;
    while ((m = moneyRe.exec(afterPolicy)) !== null) {
      amounts.push(parseMoneyToken(m[1]!));
      if (amounts.length >= 4) break; // enough
    }
    
    // Try to find client name: text between policy and first number
    const firstNumMatch = afterPolicy.match(/\d{1,3}(?:,\d{3})*\.\d{2}/);
    let client_name: string | null = null;
    if (firstNumMatch && firstNumMatch.index != null) {
      const textBefore = afterPolicy.slice(0, firstNumMatch.index).trim();
      // Remove product/ramo words
      const cleaned = textBefore.replace(/RESPONSABILIDAD CIVIL|RAMO|GENERAL|FIANZAS/gi, '').trim();
      if (isLikelyClientName(cleaned)) {
        client_name = cleaned.replace(/\s+/g, ' ').trim();
      }
    }

    // Last amount is commission
    const commission = amounts.length >= 2 ? amounts[amounts.length - 1]! : (amounts[0] ?? 0);
    
    if (Math.abs(commission) > 0.01) {
      rows.push({ policy_number, client_name, gross_amount: commission });
    }
  }

  return rows;
}
