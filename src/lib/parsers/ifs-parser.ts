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
  // Intentar extraer texto nativo del PDF con pdf-parse
  try {
    const pdfParse = (await import('pdf-parse')).default as any;
    const result = await pdfParse(Buffer.from(fileBuffer));
    const text = String(result?.text || '');
    return text.trim();
  } catch {
    return '';
  }
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
  
  // Si no se pudo extraer texto, es un PDF escaneado - intentar OCR directo
  if (!rawText || rawText.trim().length < 100) {
    console.log('[IFS] PDF sin texto extraíble detectado, intentando OCR...');
    try {
      const { extractTextFromImageBuffer } = await import('@/lib/services/vision-ocr');
      
      console.log('[IFS] Aplicando Google Vision OCR al PDF...');
      rawText = await extractTextFromImageBuffer(fileBuffer);
      
      console.log(`[IFS] OCR completado: ${rawText.length} caracteres extraídos`);
      
      if (!rawText || rawText.trim().length < 100) {
        throw new Error('OCR no pudo extraer suficiente texto del PDF');
      }
    } catch (ocrError) {
      console.error('[IFS] Error en OCR:', ocrError instanceof Error ? ocrError.message : String(ocrError));
      throw new Error(
        'PDF ESCANEADO DETECTADO - Requiere conversión manual\n\n' +
        'Este PDF es una imagen escaneada. Para procesarlo:\n\n' +
        '1. Abre el PDF en cualquier visor\n' +
        '2. Usa "Guardar como imagen" o "Exportar a JPG/PNG"\n' +
        '3. Sube la imagen resultante en la sección de ASSISTCARD\n\n' +
        '✅ ASSISTCARD procesa tablas en imágenes perfectamente.\n\n' +
        'Nota: La conversión automática PDF→Imagen en Node.js requiere\n' +
        'dependencias nativas complejas que no están disponibles en este servidor.'
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

    // Extract commission amount: first money token after the percent
    const afterPercent = u.slice(percentStart + percentMatch[0].length);
    const monies = afterPercent.match(new RegExp(MONEY_TOKEN_RE, 'g')) || [];
    const gross_amount = monies.length > 0 ? parseMoneyToken(monies[0] || '') : 0;
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
