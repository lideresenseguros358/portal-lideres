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

  const lines = normalized
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rows: IFSRow[] = [];

  for (const line of lines) {
    const u = line.toUpperCase();

    const policyMatch = u.match(POLICY_RE);
    if (!policyMatch || policyMatch.index == null) continue;

    const percentMatch = u.match(PERCENT_RE);
    if (!percentMatch || percentMatch.index == null) continue;

    const policy_number = policyMatch[0].trim();

    // Extract text between policy and percent for client name
    const policyEnd = (policyMatch.index || 0) + policyMatch[0].length;
    const percentStart = percentMatch.index || 0;
    const between = u.slice(policyEnd, percentStart).trim();

    const client_name = isLikelyClientName(between)
      ? between.replace(/\s+/g, ' ').trim()
      : null;

    // Extract commission amount: first money token after the percent (preserve negative sign)
    const afterPercent = u.slice(percentStart + percentMatch[0].length);
    const signedMoneyRe = /-?\s*(?:\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;
    const moneyMatch = signedMoneyRe.exec(afterPercent);
    const gross_amount = moneyMatch ? parseMoneyToken(moneyMatch[0]) : 0;
    console.log(`[IFS] afterPercent: "${afterPercent.slice(0, 60)}" -> match: "${moneyMatch?.[0]}" -> amount: ${gross_amount}`);
    if (!gross_amount) continue;

    rows.push({
      policy_number,
      client_name,
      gross_amount,
    });
  }

  if (rows.length === 0) {
    const snippet = normalized
      .split('\n')
      .slice(0, 40)
      .join('\n');
    throw new Error(
      'No se pudieron detectar filas en el PDF de IFS con el parser actual.\n\n' +
        'Snippet (texto normalizado):\n' +
        snippet
    );
  }

  return rows;
}
