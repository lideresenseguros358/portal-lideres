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
  // Policy line MUST start with a date DD/MM/YYYY to distinguish from codes like AG-0139
  const DATE_POLICY_RE = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([A-Z]{2,10}-\d{2,6}(?:-[A-Z]-\d{1,3})?)/;
  // IFS product names to skip when looking for client name
  const PRODUCT_WORDS = ['FIANZA', 'INCENDIO', 'MULTIRIESGO', 'RESPONSABILIDAD', 'TRANSPORTE',
    'EQUIPO', 'TODO RIESGO', 'ROTURA', 'FIDELIDAD', 'LUCRO', 'AUTOMOVIL', 'TERREMOTO',
    'VIDA', 'SALUD', 'ACCIDENTE'];

  // Find all policy line indices
  const policyIndices: { idx: number; policy: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.toUpperCase();
    const m = line.match(DATE_POLICY_RE);
    if (m) {
      policyIndices.push({ idx: i, policy: m[2]!.trim() });
    }
  }

  console.log(`[IFS OCR] Found ${policyIndices.length} policy lines with dates`);

  for (let p = 0; p < policyIndices.length; p++) {
    const { idx: i, policy: policy_number } = policyIndices[p]!;
    // Scan until next policy or end of document
    const endIdx = p + 1 < policyIndices.length 
      ? policyIndices[p + 1]!.idx 
      : Math.min(i + 30, lines.length);

    // Collect all lines between this policy and the next into ordered tokens
    // IFS OCR layout per policy block (each on its own line):
    //   PRODUCT_NAME
    //   CLIENT_NAME  
    //   RECIBO_NUMBER (digits only)
    //   PRIMA (money)
    //   PORCENTAJE (nn.n%)
    //   COMISION (money)
    let client_name: string | null = null;
    let commission = 0;
    let sawPercentage = false;
    const textLines: string[] = [];
    const amounts: number[] = [];

    for (let j = i + 1; j < endIdx; j++) {
      const fwd = lines[j]!.trim();
      const fwdU = fwd.toUpperCase();
      if (!fwd) continue;

      // Check if this line is a percentage like "15.0%" or "25.0%"
      if (/^\d{1,3}(\.\d+)?%$/.test(fwd)) {
        sawPercentage = true;
        console.log(`[IFS OCR]   line ${j}: PERCENTAGE = ${fwd}`);
        continue;
      }

      // Check if this line is a money amount (with optional B/. prefix)
      const moneyMatch = fwd.match(/^(?:B\/\.\s*)?(\d{1,3}(?:[,.]?\d{3})*[.,]\d{2})$/);
      if (moneyMatch) {
        const val = parseMoneyToken(moneyMatch[1]!.replace(',', '.'));
        amounts.push(val);
        // The amount right AFTER the percentage is the commission
        if (sawPercentage && commission === 0) {
          commission = val;
          console.log(`[IFS OCR]   line ${j}: COMMISSION (after %) = ${val}`);
        } else {
          console.log(`[IFS OCR]   line ${j}: amount = ${val} (sawPct=${sawPercentage})`);
        }
        continue;
      }

      // Check if it's a pure number (recibo)
      if (/^\d{3,10}$/.test(fwd)) {
        console.log(`[IFS OCR]   line ${j}: RECIBO = ${fwd}`);
        continue;
      }

      // It's a text line — could be product or client name
      textLines.push(fwd);
    }

    // Identify client from text lines
    // IFS format: first text line = product, second = client
    // Products start with known words (FIANZA, INCENDIO, etc.)
    // Client names usually have commas, S.A., or are person names
    for (const txt of textLines) {
      const u = txt.toUpperCase();
      const isProduct = PRODUCT_WORDS.some(w => u.startsWith(w));
      if (isProduct) continue;
      if (isLikelyClientName(u)) {
        client_name = txt.replace(/\s+/g, ' ').trim();
        break;
      }
    }

    // Fallback: if no commission found after percentage, check for "COMISION" label pattern
    // or use the last amount in the block
    if (commission === 0 && amounts.length >= 2) {
      // [prima, comision] — commission is the last amount
      commission = amounts[amounts.length - 1]!;
      console.log(`[IFS OCR] Fallback commission (last amount): ${commission}`);
    } else if (commission === 0 && amounts.length === 1) {
      commission = amounts[0]!;
    }

    console.log(`[IFS OCR] Result: policy=${policy_number}, client="${client_name}", amounts=[${amounts}], commission=${commission}`);

    if (Math.abs(commission) > 0.01) {
      rows.push({ policy_number, client_name, gross_amount: commission });
    }
  }

  return rows;
}

/** Strategy 3: Join all text and find DATE POLICY ... COMISION amount patterns */
function parseFullTextScan(normalized: string): IFSRow[] {
  const rows: IFSRow[] = [];
  const fullText = normalized.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  // Require date before policy to avoid false matches
  const policyGlobalRe = /\d{1,2}\/\d{1,2}\/\d{2,4}\s+([A-Z]{2,10}-\d{2,6}(?:-[A-Z]-\d{1,3})?)/g;
  let match;
  
  while ((match = policyGlobalRe.exec(fullText)) !== null) {
    const policy_number = match[1]!;
    const afterPolicy = fullText.slice(match.index + match[0].length, match.index + match[0].length + 400);
    
    // Find commission: look for "COMISION" label followed by an amount
    let commission = 0;
    const comisionMatch = afterPolicy.match(/COMISION\s+(?:B\/\.\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})/i);
    if (comisionMatch) {
      commission = parseMoneyToken(comisionMatch[1]!);
    }
    
    // Fallback: find all amounts and take the last one
    if (!commission) {
      const moneyRe = /(?:B\/\.\s*)?(\d{1,3}(?:,\d{3})*\.\d{2})/g;
      const amounts: number[] = [];
      let m;
      while ((m = moneyRe.exec(afterPolicy)) !== null) {
        amounts.push(parseMoneyToken(m[1]!));
        if (amounts.length >= 4) break;
      }
      if (amounts.length >= 2) commission = amounts[amounts.length - 1]!;
      else if (amounts.length === 1) commission = amounts[0]!;
    }
    
    // Try to find client name between policy and first number
    const firstNumMatch = afterPolicy.match(/\d{1,3}(?:,\d{3})*\.\d{2}/);
    let client_name: string | null = null;
    if (firstNumMatch && firstNumMatch.index != null) {
      const textBefore = afterPolicy.slice(0, firstNumMatch.index).trim();
      const cleaned = textBefore.replace(/RESPONSABILIDAD CIVIL|RAMO|GENERAL|FIANZAS|TOTAL|RESUMEN[^.]*|PRIMA|PORCENTAJE|COMISION/gi, '').trim();
      if (isLikelyClientName(cleaned)) {
        client_name = cleaned.replace(/\s+/g, ' ').trim();
      }
    }

    if (Math.abs(commission) > 0.01) {
      rows.push({ policy_number, client_name, gross_amount: commission });
    }
  }

  return rows;
}
