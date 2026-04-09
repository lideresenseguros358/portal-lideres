/**
 * Comparativa de Cobertura Completa — PDF Generator (pdf-lib)
 * ============================================================
 * Genera 4 páginas en orientación horizontal A4:
 *   Pág 1: Coberturas de Planes Básicos (tabla comparativa por aseguradora)
 *   Pág 2: Beneficios de Planes Básicos (tabla si/no por aseguradora)
 *   Pág 3: Coberturas de Planes Premium
 *   Pág 4: Beneficios de Planes Premium
 *
 * IMPORTANTE: Solo usa caracteres WinAnsi (Helvetica estándar).
 * No usar emoji ni símbolos Unicode fuera del rango 0x00-0xFF.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// ── Brand Colors ─────────────────────────────────────────────────────────────
const NAVY        = rgb(1/255,   1/255,  57/255);   // #010139
const GREEN       = rgb(138/255, 170/255, 25/255);  // #8AAA19
const WHITE       = rgb(1,   1,   1);
const DARK        = rgb(0.1, 0.1, 0.1);
const GRAY        = rgb(0.45, 0.45, 0.45);
const GRAY_LIGHT  = rgb(0.82, 0.82, 0.82);
const STRIPE      = rgb(0.965, 0.965, 0.965);
const GREEN_CELL  = rgb(0.88, 0.96, 0.72);
const BLUE_LIGHT  = rgb(0.92, 0.95, 1.0);
const NAVY_LIGHT  = rgb(0.12, 0.12, 0.28);
const CROSS_GRAY  = rgb(0.72, 0.72, 0.72);  // soft gray for ✗
const ROW_LINE    = rgb(0.91, 0.91, 0.91);  // ultra-light row separator

// ── Page layout (A4 Landscape) ────────────────────────────────────────────────
const PW   = 841.89;  // page width  (pt)
const PH   = 595.28;  // page height (pt)
const M    = 20;       // horizontal margin
const CW   = PW - 2*M; // content width ≈ 802

const HDR_H  = 62;   // header height
const VEH_H  = 42;   // vehicle/client info bar height (pages 1 & 3 only)
const FTR_H  = 52;   // footer height (with observations + SSRP)
const ROW_H      = 15;   // (legacy — kept for reference)
const DATA_ROW_H = 23;   // uniform data row height (matches subtext rows)
const SEC_H  = 19;   // section header row height
const INS_H  = 40;   // insurer column header height
const LPAD   = 6;    // left padding inside cells
const RPAD   = 4;    // right padding inside cells

// ── Contact Info ──────────────────────────────────────────────────────────────
const WEBSITE    = 'www.lideresenseguros.com';
const WHATSAPP   = '6833-9167';
const EMAIL      = 'contacto@lideresenseguros.com';
const LICENCIA   = 'Licencia PJ750';
const SSRP_LINE  = `Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panama - ${LICENCIA}`;
const OBS_LINE   = 'OBSERVACIONES: Comparativa informativa, no constituye contrato de seguro. Primas sujetas a confirmacion segun datos del vehiculo y conductor. Validez: 15 dias. Pago en cuotas: maximo 10 cuotas mensuales.';
const TIP_LINE   = 'TIP: Los planes Premium incluyen mejores coberturas de asistencia y endosos adicionales. Consulta con tu asesor para mas detalles.';

// ── Data interfaces ───────────────────────────────────────────────────────────
interface Limite {
  tipo: string;
  limitePorPersona?: string;
  limitePorAccidente?: string;
  descripcion: string;
}

interface CobDet {
  nombre: string;
  incluida: boolean;
  limite?: string;
  emoji?: string;
}

interface Beneficio {
  nombre: string;
  incluido: boolean;
}

interface Endoso {
  nombre: string;
  incluido: boolean;
  codigo?: string;
  subBeneficios?: string[];
}

interface PriceBreak {
  totalAlContado?: number;
  totalConTarjeta?: number;
  descuentoProntoPago?: number;
}

interface Deducibles {
  comprensivo?:    { amount: number; label: string } | null;
  colisionVuelco?: { amount: number; label: string } | null;
}

export interface PDFQuote {
  insurerName: string;
  planType: 'basico' | 'premium';
  annualPremium: number;
  isRecommended?: boolean;
  _priceBreakdown?: PriceBreak;
  _deduciblesReales?: Deducibles;
  _coberturasDetalladas?: CobDet[];
  _limites?: Limite[];
  _beneficios?: Beneficio[];
  _endosos?: Endoso[];
  _endosoIncluido?: string;
  _sumaAsegurada?: number;
  [key: string]: any;
}

export interface ClientInfo {
  nombreCompleto?: string;
  fechaNacimiento?: string;   // YYYY-MM-DD
  estadoCivil?: string;       // soltero, casado, divorciado, viudo
  codProvincia?: number;
  lesionCorporalPersona?: number;
  lesionCorporalAccidente?: number;
  danoPropiedad?: number;
  gastosMedicosPersona?: number;
  gastosMedicosAccidente?: number;
}

// Province code → name (Panama)
const PROV_MAP: Record<number, string> = {
  1: 'Bocas del Toro', 2: 'Cocle', 3: 'Colon', 4: 'Chiriqui',
  5: 'Darien', 6: 'Herrera', 7: 'Los Santos', 8: 'Panama',
  9: 'Veraguas', 10: 'Guna Yala', 11: 'Embera', 12: 'Ngobe-Bugle',
  13: 'Panama Oeste',
};
function provinciaName(cod: number | undefined): string {
  if (!cod) return '';
  return PROV_MAP[cod] || `Prov. ${cod}`;
}

/** Convert YYYY-MM-DD to DD/MM/YYYY */
function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Capitalize first letter */
function capitalize(s: string | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip chars outside WinAnsi range so pdf-lib Helvetica doesn't throw */
function safe(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/[^\x00-\xFF]/g, '')  // remove chars outside Latin-1
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars
}

/** Format money: 909.50 → "B/. 909.50" — always 2 decimal places */
function money(n: number | undefined | null, prefix = 'B/.'): string {
  if (n == null || isNaN(n)) return '—';
  return `${prefix} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Truncate a string to maxLen chars with ellipsis */
function trunc(text: string, maxLen: number): string {
  const s = safe(text);
  return s.length > maxLen ? s.slice(0, maxLen - 2) + '..' : s;
}

/** Approximate text width in points (Helvetica, n pts font size ≈ 0.56 × n per char) */
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.56;
}

/** Shorten insurer name for column header */
function shortInsurerName(name: string): string {
  return safe(name)
    .replace(/\s+de\s+Seguros/i, '')
    .replace(/\s+Seguros/i, '')
    .replace(/La\s+/i, '')
    .trim();
}

/** Get insurer key for logo map */
function insurerKey(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('INTERNACIONAL') || n.includes('IS ')) return 'INTERNACIONAL';
  if (n.includes('FEDPA'))       return 'FEDPA';
  if (n.includes('REGIONAL'))    return 'REGIONAL';
  if (n.includes('ANCON') || n.includes('ANCON')) return 'ANCON';
  return n.split(' ')[0] || n;
}

// ── Image helpers ─────────────────────────────────────────────────────────────

async function tryLoadPng(pdfDoc: PDFDocument, rootDir: string, relPath: string): Promise<any | null> {
  try {
    const abs = path.join(rootDir, 'public', relPath.replace(/^\//, ''));
    if (!fs.existsSync(abs)) return null;
    return await pdfDoc.embedPng(fs.readFileSync(abs));
  } catch { return null; }
}

/**
 * Trim a PNG buffer to the bounding box of its non-transparent pixels.
 * For logos with large transparent padding (e.g. FEDPA 1800×1800 with
 * the actual content only in the center), this ensures the image embeds
 * at the real content dimensions so the aspect ratio is correct.
 */
async function trimTransparentPng(pngPath: string): Promise<Buffer> {
  const { data, info } = await sharp(pngPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = channels === 4 ? data[(y * width + x) * channels + 3] : 255;
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return fs.readFileSync(pngPath); // fully transparent — fallback

  // Add a small margin so the content isn't clipped at the very edge
  const pad = 4;
  const left   = Math.max(0, minX - pad);
  const top    = Math.max(0, minY - pad);
  const right  = Math.min(width,  maxX + pad + 1);
  const bottom = Math.min(height, maxY + pad + 1);

  return sharp(pngPath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
}

async function loadInsurerLogos(pdfDoc: PDFDocument, rootDir: string): Promise<Record<string, any>> {
  const logos: Record<string, any> = {};
  for (const name of ['fedpa', 'internacional', 'regional', 'ancon']) {
    try {
      const filePath = path.join(rootDir, 'public', 'aseguradoras', `${name}.png`);
      let pngBuffer: Buffer;

      // FEDPA's PNG canvas has large transparent padding — trim to real content bounds
      // so the embedded image has the correct aspect ratio for proportional scaling.
      if (name === 'fedpa' && fs.existsSync(filePath)) {
        pngBuffer = await trimTransparentPng(filePath);
      } else {
        pngBuffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
      }

      if (pngBuffer.length > 0) {
        const img = await pdfDoc.embedPng(pngBuffer);
        logos[name.toUpperCase()] = img;
        if (name === 'internacional') logos['INTERNACIONAL'] = img;
      }
    } catch { /* skip */ }
  }
  return logos;
}

// ── Table drawing helpers ─────────────────────────────────────────────────────

interface CellOpts {
  bg?: ReturnType<typeof rgb>;
  textColor?: ReturnType<typeof rgb>;
  bold?: boolean;
  size?: number;
  align?: 'left' | 'center' | 'right';
  paddingLeft?: number;
}

function drawCell(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: CellOpts = {},
) {
  const { bg, textColor = DARK, bold = false, size = 7.5, align = 'left', paddingLeft } = opts;

  if (bg) {
    page.drawRectangle({ x, y, width: w, height: h, color: bg });
  }

  const f  = bold ? fontBold : font;
  const s  = safe(text);
  const pl = paddingLeft ?? LPAD;

  if (!s) return;

  // Measure and truncate to fit
  let displayText = s;
  const availW = w - pl - RPAD;
  while (displayText.length > 2 && textWidth(displayText, size) > availW) {
    displayText = displayText.slice(0, -1);
  }
  if (displayText !== s) displayText = displayText.slice(0, -2) + '..';

  let tx: number;
  if (align === 'center') {
    tx = x + (w - textWidth(displayText, size)) / 2;
  } else if (align === 'right') {
    tx = x + w - RPAD - textWidth(displayText, size);
  } else {
    tx = x + pl;
  }

  const ty = y + (h - size) / 2 + 1;

  page.drawText(displayText, { x: tx, y: ty, size, font: f, color: textColor });
}

/** drawRectangle wrapper that supports borderRadius (not in @types/pdf-lib but supported at runtime) */
function roundedRect(
  page: PDFPage,
  opts: { x: number; y: number; width: number; height: number; color?: ReturnType<typeof rgb>; borderRadius?: number },
) {
  page.drawRectangle(opts as any);
}

/** Draw a full-width horizontal rule */
function hLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5, color = GRAY_LIGHT) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color });
}

/** Draw a minimal green checkmark (no box) centered at (cx, cy) */
function drawCheckmark(page: PDFPage, cx: number, cy: number, sz: number) {
  const p1 = { x: cx - sz * 0.40, y: cy + sz * 0.05 };
  const p2 = { x: cx - sz * 0.08, y: cy - sz * 0.30 };
  const p3 = { x: cx + sz * 0.46, y: cy + sz * 0.42 };
  page.drawLine({ start: p1, end: p2, thickness: 1.35, color: GREEN });
  page.drawLine({ start: p2, end: p3, thickness: 1.35, color: GREEN });
}

/** Draw a soft gray X centered at (cx, cy) */
function drawCross(page: PDFPage, cx: number, cy: number, sz: number) {
  const d = sz * 0.30;
  page.drawLine({ start: { x: cx - d, y: cy - d }, end: { x: cx + d, y: cy + d }, thickness: 1.1, color: CROSS_GRAY });
  page.drawLine({ start: { x: cx + d, y: cy - d }, end: { x: cx - d, y: cy + d }, thickness: 1.1, color: CROSS_GRAY });
}

/** Draw vertical borders for a row (left + right + dividers between columns) */
function drawRowBorders(page: PDFPage, colXs: number[], y: number, h: number, color = GRAY_LIGHT) {
  for (const cx of colXs) {
    page.drawLine({ start: { x: cx, y }, end: { x: cx, y: y + h }, thickness: 0.4, color });
  }
  const lastX = colXs[colXs.length - 1]!;
  // right border is drawn by the MARGIN line; skip to avoid double-drawing
}

// ── Table column geometry ─────────────────────────────────────────────────────

interface ColLayout {
  labelW: number;    // width of the label (first) column
  insW: number;      // width of each insurer column
  colXs: number[];   // x positions [label, ins1, ins2, ...]
  totalW: number;
}

function makeColLayout(n: number, labelFrac = 0.22): ColLayout {
  const labelW = Math.round(CW * labelFrac);
  const remaining = CW - labelW;
  const insW = Math.floor(remaining / n);
  const colXs: number[] = [M];
  for (let i = 0; i < n; i++) {
    colXs.push(M + labelW + i * insW);
  }
  return { labelW, insW, colXs, totalW: CW };
}

// ── Header & Footer ───────────────────────────────────────────────────────────

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  logoImg: any,
  subtitle: string,
) {
  // White header background
  page.drawRectangle({ x: 0, y: PH - HDR_H, width: PW, height: HDR_H, color: WHITE });

  // Logo — maintain natural aspect ratio, left-aligned
  let logoEnd = M;
  if (logoImg) {
    const maxH = HDR_H - 18;
    const maxW = 110;
    const ratio = logoImg.width / logoImg.height;
    const lh = Math.min(maxH, maxW / ratio);
    const lw = lh * ratio;
    page.drawImage(logoImg, { x: M, y: PH - HDR_H + (HDR_H - lh) / 2, width: lw, height: lh });
    logoEnd = M + lw + 12;
  }

  // Title block
  page.drawText(safe('Comparativa de Cobertura Completa'), {
    x: logoEnd, y: PH - HDR_H + 36, size: 14, font: fontBold, color: NAVY,
  });
  page.drawText(safe(subtitle), {
    x: logoEnd, y: PH - HDR_H + 20, size: 9.5, font, color: GRAY,
  });

  // Right block: contact
  const rx = PW - M - 180;
  page.drawText(safe(WEBSITE), { x: rx, y: PH - HDR_H + 42, size: 8, font, color: NAVY });
  page.drawText(safe(`WhatsApp: ${WHATSAPP}`), { x: rx, y: PH - HDR_H + 28, size: 8, font, color: GRAY });
  page.drawText(safe(EMAIL), { x: rx, y: PH - HDR_H + 15, size: 7, font, color: GRAY });

  // Subtle bottom separator
  page.drawLine({
    start: { x: 0, y: PH - HDR_H },
    end:   { x: PW, y: PH - HDR_H },
    thickness: 0.6, color: ROW_LINE,
  });
}

function drawFooter(page: PDFPage, font: PDFFont) {
  // Background
  page.drawRectangle({ x: 0, y: 0, width: PW, height: FTR_H, color: STRIPE });

  // Top border
  page.drawLine({ start: { x: 0, y: FTR_H }, end: { x: PW, y: FTR_H }, thickness: 1, color: NAVY_LIGHT });

  // SSRP line
  page.drawText(safe(SSRP_LINE), { x: M, y: FTR_H - 12, size: 6.5, font, color: GRAY });

  // Observations
  page.drawText(safe(OBS_LINE), {
    x: M, y: FTR_H - 24, size: 6, font, color: GRAY,
    maxWidth: PW - 2 * M,
  });

  // Tip
  page.drawText(safe(TIP_LINE), {
    x: M, y: FTR_H - 35, size: 6, font, color: GRAY,
    maxWidth: PW * 0.75,
  });

  // Right: contact in footer
  const rx = PW - M - 145;
  page.drawText(safe(WEBSITE), { x: rx, y: FTR_H - 18, size: 7, font, color: NAVY });
  page.drawText(safe(`WA: ${WHATSAPP}`), { x: rx, y: FTR_H - 30, size: 7, font, color: GRAY });
}

// ── Vehicle / Client info bar (pages 1 & 3 only) ─────────────────────────────

function drawVehicleBar(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  quotes: PDFQuote[],
  clientInfo?: ClientInfo,
) {
  const q = quotes[0];
  if (!q) return;

  const barY = PH - HDR_H - VEH_H;
  const rowH = VEH_H / 2;  // each row is half the bar height

  // Background: light navy stripe
  page.drawRectangle({ x: 0, y: barY, width: PW, height: VEH_H, color: BLUE_LIGHT });

  // Mid divider between client row and vehicle row
  page.drawLine({ start: { x: M, y: barY + rowH }, end: { x: PW - M, y: barY + rowH }, thickness: 0.4, color: GRAY_LIGHT });

  // Bottom border
  page.drawLine({ start: { x: 0, y: barY }, end: { x: PW, y: barY }, thickness: 0.8, color: NAVY });

  // ── Row 1: Client info ────────────────────────────────────────────────────
  const clientY = barY + rowH + (rowH - 7) / 2 + 1;

  page.drawText('CLIENTE:', { x: M + 8, y: clientY, size: 6.5, font: fontBold, color: NAVY });

  let clientX = M + 58;

  if (clientInfo?.nombreCompleto) {
    page.drawText(safe(clientInfo.nombreCompleto), { x: clientX, y: clientY, size: 7.5, font: fontBold, color: DARK });
    clientX += Math.min(textWidth(safe(clientInfo.nombreCompleto), 7.5) + 16, 220);
  }

  if (clientInfo?.fechaNacimiento) {
    page.drawText('Nac.:', { x: clientX, y: clientY, size: 6.5, font: fontBold, color: NAVY });
    page.drawText(safe(formatDate(clientInfo.fechaNacimiento)), { x: clientX + 28, y: clientY, size: 7, font, color: DARK });
    clientX += 90;
  }

  if (clientInfo?.estadoCivil) {
    page.drawText(safe(capitalize(clientInfo.estadoCivil)), { x: clientX, y: clientY, size: 7, font, color: DARK });
    clientX += Math.min(textWidth(safe(clientInfo.estadoCivil), 7) + 16, 80);
  }

  if (clientInfo?.codProvincia) {
    const prov = provinciaName(clientInfo.codProvincia);
    page.drawText(safe(prov), { x: clientX, y: clientY, size: 7, font, color: DARK });
  }

  // ── Row 2: Vehicle info ────────────────────────────────────────────────────
  const vehicleY = barY + (rowH - 7) / 2 + 1;

  page.drawText('VEHICULO:', { x: M + 8, y: vehicleY, size: 6.5, font: fontBold, color: NAVY });

  const anio   = safe(String(q._anio || ''));
  const marca  = safe(q._marcaNombre || '');
  const modelo = safe(q._modeloNombre || '');
  const vehicleStr = [anio, marca, modelo].filter(Boolean).join('  ');
  page.drawText(vehicleStr, { x: M + 62, y: vehicleY, size: 7.5, font: fontBold, color: DARK });

  if (q._sumaAsegurada && q._sumaAsegurada > 0) {
    page.drawText(safe('COBERTURA COMPLETA'), { x: PW * 0.48, y: vehicleY, size: 6.5, font: fontBold, color: NAVY });
    page.drawText(safe(`Valor Asegurado:  ${money(q._sumaAsegurada)}`), { x: PW * 0.63, y: vehicleY, size: 7, font, color: DARK });
  }
}

// ── Coverage page (pages 1 & 3) ───────────────────────────────────────────────

async function drawCoveragePage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  logoImg: any,
  insurerLogos: Record<string, any>,
  quotes: PDFQuote[],
  subtitle: string,
  clientInfo?: ClientInfo,
) {
  if (!quotes.length) return;
  const page = pdfDoc.addPage([PW, PH]);
  drawHeader(page, font, fontBold, logoImg, subtitle);
  drawVehicleBar(page, font, fontBold, quotes, clientInfo);
  drawFooter(page, font);

  const n = quotes.length;
  const lay = makeColLayout(n, 0.21);
  const { labelW, insW, colXs } = lay;

  const isPremium = quotes[0]?.planType === 'premium';
  const planBadge = isPremium ? 'PREMIUM' : 'BASICO';

  // Starting Y (just below header + vehicle bar)
  let y = PH - HDR_H - VEH_H - 4;

  // ── Row helper ────────────────────────────────────────────────────────────
  const drawLabelRow = (
    label: string, subLabel: string | null, values: string[],
    opts: { bg?: ReturnType<typeof rgb>; labelBold?: boolean; valueBold?: boolean;
            valColor?: ReturnType<typeof rgb>; labelColor?: ReturnType<typeof rgb>;
            subLabelColor?: ReturnType<typeof rgb>;
            rh?: number; fontSize?: number; }  = {},
  ) => {
    const rh = opts.rh ?? ROW_H;
    const bg = opts.bg;

    // Label cell
    drawCell(page, font, fontBold, M, y - rh, labelW, rh, label, {
      bg, bold: opts.labelBold, size: opts.fontSize ?? 7.5,
      textColor: opts.labelColor ?? (bg ? WHITE : DARK),
    });

    // Sublabel if any (drawn smaller, below main label)
    if (subLabel) {
      page.drawText(safe(subLabel), {
        x: M + LPAD, y: y - rh + 2,
        size: 6, font, color: opts.subLabelColor ?? (bg ? GRAY : GRAY),
      });
    }

    // Insurer value cells
    for (let i = 0; i < n; i++) {
      const val = values[i] ?? '—';
      drawCell(page, font, fontBold, colXs[i + 1]!, y - rh, insW, rh, val, {
        bg,
        align: 'center',
        bold: opts.valueBold,
        size: opts.fontSize ?? 7.5,
        textColor: opts.valColor ?? (bg ? WHITE : DARK),
      });
    }

    // Subtle row separator
    hLine(page, M, y - rh, CW, 0.2, ROW_LINE);

    y -= rh;
  };

  // ── Insurer header row (navy) ─────────────────────────────────────────────
  // Label column header
  page.drawRectangle({ x: M, y: y - INS_H, width: labelW, height: INS_H, color: STRIPE });
  page.drawText(safe('Cobertura Completa'), {
    x: M + LPAD, y: y - INS_H + (INS_H - 8) / 2,
    size: 7.5, font: fontBold, color: NAVY,
  });

  // Insurer columns — card style, logo centered, no text
  const COV_CARD_GAP = 3;
  for (let i = 0; i < n; i++) {
    const q = quotes[i]!;
    const cx = colXs[i + 1]!;
    const cardX = cx + COV_CARD_GAP / 2;
    const cardW = insW - COV_CARD_GAP;

    // Rounded card
    roundedRect(page, { x: cardX, y: y - INS_H, width: cardW, height: INS_H, color: NAVY, borderRadius: 5 });

    // Recommended top accent
    if (q.isRecommended) {
      roundedRect(page, { x: cardX, y: y - 5, width: cardW, height: 5, color: GREEN, borderRadius: 3 });
    }

    // Plan badge — rounded pill bottom-right
    const badgeColor = isPremium ? GREEN : rgb(0.32, 0.32, 0.42);
    const badgeW = 40, badgeH = 12;
    roundedRect(page, {
      x: cardX + cardW - badgeW - 4, y: y - INS_H + 4,
      width: badgeW, height: badgeH, color: badgeColor, borderRadius: 6,
    });
    page.drawText(safe(planBadge), {
      x: cardX + cardW - badgeW - 2, y: y - INS_H + 6.5,
      size: 6.5, font: fontBold, color: WHITE,
    });

    // Logo — centered, fit within card bounds
    const key = insurerKey(q.insurerName);
    const logo = insurerLogos[key] || insurerLogos[key.split(' ')[0]!];
    if (logo) {
      const maxH = INS_H - 10;
      const maxW = cardW - 14;
      const ratio = logo.width / logo.height;

      // Fit to maxH, then cap width
      let lh = maxH;
      let lw = lh * ratio;
      if (lw > maxW) { lw = maxW; lh = lw / ratio; }

      page.drawImage(logo, {
        x: cardX + (cardW - lw) / 2,
        y: y - INS_H + (INS_H - lh) / 2,
        width: lw, height: lh,
      });
    } else {
      page.drawText(safe(trunc(shortInsurerName(q.insurerName), 18)), {
        x: cardX + LPAD, y: y - INS_H + INS_H / 2 - 3,
        size: 7, font: fontBold, color: WHITE,
      });
    }
  }

  hLine(page, M, y - INS_H, CW, 0.3, ROW_LINE);
  y -= INS_H;

  // ── Section A: Coberturas RC (Límites de responsabilidad) ────────────────
  drawLabelRow('COBERTURAS', null,
    Array(n).fill('Limite de responsabilidad'),
    { bg: NAVY, labelBold: true, valueBold: false, rh: SEC_H, fontSize: 8 },
  );

  /** Resolve limit string from _limites, with fallback to _coberturasDetalladas */
  const resolveLimit = (
    q: PDFQuote,
    tipoKeywords: string[],
    nombreKeywords: string[],
    both = true,   // true → "persona / accidente", false → single value
  ): string => {
    // 1) Try _limites
    const l = (q._limites || []).find((x: any) =>
      tipoKeywords.some(k => (x.tipo || '').toLowerCase().includes(k)) ||
      nombreKeywords.some(k => (x.descripcion || '').toLowerCase().includes(k))
    );
    if (l) {
      const p = (l.limitePorPersona || '').replace('.00', '').trim();
      const a = (l.limitePorAccidente || '').replace('.00', '').trim();
      if (both) return (p && a) ? `${p} / ${a}` : p || a || 'Incluido';
      return p || a || 'Incluido';
    }
    // 2) Fallback to _coberturasDetalladas
    const cob = (q._coberturasDetalladas || []).find((c: any) =>
      nombreKeywords.some(k =>
        (c.nombre || '').toLowerCase().includes(k) ||
        (c.descripcion || '').toLowerCase().includes(k)
      )
    );
    if (cob) return safe(cob.limite || 'Incluido');
    return 'Incluido';  // CC always includes RC — "—" would be misleading
  };

  // ── RC Limits: clientInfo (form values) is the authoritative source ──
  // All insurers quote IDENTICAL RC limits defined by user's form inputs.
  // API _limites are used only as fallback if clientInfo is not available.
  const lesP = Number(clientInfo?.lesionCorporalPersona) || 0;
  const lesA = Number(clientInfo?.lesionCorporalAccidente) || 0;
  const lesText = lesP > 0
    ? `${money(lesP)} / ${money(lesA)}`
    : resolveLimit(quotes[0]!, ['lesiones', 'corporales'], ['lesion', 'corporal'], true);
  drawLabelRow('Lesiones Corporales', 'por persona / por accidente', quotes.map(() => lesText), {
    bg: STRIPE, rh: DATA_ROW_H, labelColor: DARK, valColor: GREEN, subLabelColor: DARK,
  });

  const dpa = Number(clientInfo?.danoPropiedad) || 0;
  const dpaText = dpa > 0
    ? money(dpa)
    : resolveLimit(quotes[0]!, ['propiedad'], ['propiedad', 'dano'], false);
  drawLabelRow('Danos a la Propiedad Ajena', null, quotes.map(() => dpaText), { rh: DATA_ROW_H });

  const gmP = Number(clientInfo?.gastosMedicosPersona) || 0;
  const gmA = Number(clientInfo?.gastosMedicosAccidente) || 0;
  const gmText = gmP > 0
    ? `${money(gmP)} / ${money(gmA)}`
    : resolveLimit(quotes[0]!, ['medic', 'gastos'], ['medic', 'gasto'], true);
  drawLabelRow('Gastos Medicos', 'por persona / por accidente', quotes.map(() => gmText), {
    bg: STRIPE, rh: DATA_ROW_H, labelColor: DARK, valColor: GREEN, subLabelColor: DARK,
  });

  // Comprensivo (valor asegurado)
  const compValues = quotes.map(q => {
    const sa = q._sumaAsegurada;
    return sa ? money(sa) : 'Valor del Auto';
  });
  drawLabelRow('Comprensivo', null, compValues, { rh: DATA_ROW_H });

  // Colision/Vuelco
  const colValues = quotes.map(q => {
    const sa = q._sumaAsegurada;
    return sa ? money(sa) : 'Valor del Auto';
  });
  drawLabelRow('Colision o Vuelco', null, colValues, { bg: STRIPE, rh: DATA_ROW_H, labelColor: DARK, valColor: GREEN });

  // ── Section B: Deducibles ────────────────────────────────────────────────
  drawLabelRow('DEDUCIBLES', null, Array(n).fill(''),
    { bg: NAVY, labelBold: true, rh: SEC_H, fontSize: 8 },
  );

  const dedCompValues = quotes.map(q => {
    const d = q._deduciblesReales?.comprensivo;
    if (d?.amount && d.amount > 0) return money(d.amount);
    // Fallback: _deducibleInfo.valor stores comprensivo amount
    const di = q._deducibleInfo;
    if (di?.valor && di.valor > 0) return money(di.valor);
    return 'Ver poliza';
  });
  drawLabelRow('Comprensivo', null, dedCompValues, { rh: DATA_ROW_H });

  const dedColValues = quotes.map(q => {
    // Priority 1: colisionVuelco from _deduciblesReales
    const col = q._deduciblesReales?.colisionVuelco;
    if (col?.amount && col.amount > 0) return money(col.amount);
    // Priority 2: Use comprensivo if colisión is same (many policies unify these)
    const comp = q._deduciblesReales?.comprensivo;
    if (comp?.amount && comp.amount > 0) return money(comp.amount);
    return 'Ver poliza';
  });
  drawLabelRow('Colision o Vuelco', null, dedColValues, { bg: STRIPE, rh: DATA_ROW_H, labelColor: DARK, valColor: GREEN });

  // ── Section C: Precios ───────────────────────────────────────────────────
  drawLabelRow('PRIMA', null, Array(n).fill(''),
    { bg: GREEN, labelBold: true, rh: SEC_H, fontSize: 8,
      valColor: WHITE, labelColor: WHITE },
  );

  const contadoValues = quotes.map(q => {
    const p = q._priceBreakdown?.totalAlContado ?? q.annualPremium;
    return money(p, 'B/.');
  });
  drawLabelRow('Prima al Contado', '(5% descuento pago anual)', contadoValues, {
    labelBold: false, valueBold: true, rh: DATA_ROW_H,
    valColor: NAVY, labelColor: DARK, subLabelColor: DARK,
  });

  const tarjetaValues = quotes.map(q => {
    const p = q._priceBreakdown?.totalConTarjeta ?? q.annualPremium;
    return money(p, 'B/.');
  });
  drawLabelRow('Prima en Cuotas', '(max. 10 cuotas mensuales)', tarjetaValues, {
    bg: STRIPE, rh: DATA_ROW_H, valColor: NAVY, labelColor: DARK, subLabelColor: DARK,
  });

  // ── Section D: Endosos Incluidos ─────────────────────────────────────────
  drawLabelRow('ENDOSO INCLUIDO', null, Array(n).fill(''),
    { bg: NAVY_LIGHT, labelBold: true, rh: SEC_H - 2, fontSize: 7.5,
      labelColor: WHITE },
  );

  const endosoValues = quotes.map(q => {
    // Collect included endorsement names
    const names = (q._endosos || [])
      .filter(e => e.incluido)
      .map(e => safe(e.nombre))
      .join(' + ');
    return names || q._endosoIncluido || '—';
  });
  drawLabelRow('', null, endosoValues, {
    rh: DATA_ROW_H, valColor: GREEN,
  });

}

// ── Benefits page (pages 2 & 4) ───────────────────────────────────────────────

interface BenefitRow {
  label: string;
  values: Array<{ included: boolean; detail?: string }>;
}

// ── Canonical benefit normalization ──────────────────────────────────────────
// Maps any insurer-specific benefit text to a single shared label used as the
// deduplication key across all insurers in the benefits matrix.

const CANONICAL_KEYS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /gr[uú]a/i,                                     label: 'Grúa' },
  { pattern: /asistencia vial/i,                              label: 'Asistencia Vial' },
  { pattern: /alquiler.*auto|auto.*alquiler|auto.*sustituto|sustituto.*auto/i, label: 'Auto de Alquiler' },
  { pattern: /muerte accidental/i,                            label: 'Muerte Accidental' },
  { pattern: /defensa penal|asistencia legal|gastos legales.*penal/i, label: 'Asistencia Legal' }, // Unify legal & penal
  { pattern: /efectos personales/i,                           label: 'Efectos Personales' },
  { pattern: /extensi[oó]n territorial|extraterritorial/i,    label: 'Extensión Territorial' },
  { pattern: /ambulancia/i,                                   label: 'Ambulancia' },
  { pattern: /deprecia/i,                                     label: 'Sin Depreciación' },
  { pattern: /dscto.*deducible|descuento.*deducible|devoluci[oó]n.*deducible/i, label: 'Dscto. Deducible' },
  { pattern: /cobertura.*vidrios|vidrios|parabrisas/i,        label: 'Cobertura de Vidrios' },
  { pattern: /accidentes personales/i,                        label: 'Accidentes Personales' },
  { pattern: /bono.*mantenimiento/i,                          label: 'Bono de Mantenimiento' },
  { pattern: /gastos funerarios|funerario/i,                  label: 'Gastos Funerarios' },
  { pattern: /mensajes urgentes|transmisi[oó]n.*mensajes/i,   label: 'Mensajes Urgentes' },
  { pattern: /revisi[oó]n sin costo|revisado sin/i,           label: 'Revisión sin Costo' },
  { pattern: /asistencia en viaje|hospedaje.*transporte/i,    label: 'Asistencia en Viaje' },
  { pattern: /optiseguro|seguro residencial/i,                label: 'Dscto. Seguro Residencial' },
  { pattern: /dscto.*alarma|descuento.*alarma/i,              label: 'Dscto. Alarmas' },
  // Filter out: Gastos Médicos should never appear as a benefit (it's a coverage limit)
];

function canonicalize(text: string): string {
  for (const { pattern, label } of CANONICAL_KEYS) {
    if (pattern.test(text)) return label;
  }
  const s = safe(text).trim();
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Extract the detail portion from benefit text: what comes after ": " or " — " */
function extractDetailFromText(rawText: string, canonicalLabel: string): string {
  const s = safe(rawText).trim();
  const colonIdx = s.indexOf(': ');
  const dashIdx  = s.indexOf(' — ');
  let startIdx = -1;
  if (colonIdx >= 0 && (dashIdx < 0 || colonIdx < dashIdx)) {
    startIdx = colonIdx + 2;
  } else if (dashIdx >= 0) {
    startIdx = dashIdx + 3;
  }
  if (startIdx > 0) {
    return s.slice(startIdx).replace(/\s+/g, ' ').trim();
  }
  // No separator — strip canonical prefix and use remainder
  return s.replace(new RegExp(`^${canonicalLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();
}

// Static detail fallback for benefits without dynamic detail from API
const BENEFIT_STATIC_DETAILS: Record<string, string> = {
  'Grúa':                  '1 por averia, 1 por accidente',
  'Asistencia Vial':        'Corriente, combustible, llanta, cerrajeria',
  'Auto de Alquiler':       'Por colision o vuelco',
  'Muerte Accidental':      'Fallecimiento del conductor',
  'Asistencia Legal':       'Asesoría legal y procesos penal/administrativo',
  'Ambulancia':             '24h / 365 dias',
  'Efectos Personales':     'Objetos dentro del vehiculo',
  'Asistencia en Viaje':    'Hospedaje, transporte o renta',
  'Gastos Funerarios':      'Conductor y ocupantes',
  'Dscto. Deducible':       'Reduccion en el deducible',
  'Sin Depreciación':       'Perdida total, autos 0km',
  'Extensión Territorial':  'Costa Rica, 30 dias',
  'Cobertura de Vidrios':   'Parabrisas, faros, espejos',
  'Revisión sin Costo':     'Revision del vehiculo',
  'Bono de Mantenimiento':  'B/.50 en mantenimiento',
  'Accidentes Personales':  'Cobertura conductor y pasajeros',
};

function buildBenefitMatrix(quotes: PDFQuote[]): BenefitRow[] {
  // label (UPPERCASED) → { displayLabel, order, perQuote: quoteIdx → { included, detail } }
  const matrix = new Map<string, {
    label: string;
    order: number;
    perQuote: Map<number, { included: boolean; detail: string }>;
  }>();
  let order = 0;

  quotes.forEach((q, qi) => {
    (q._beneficios || []).forEach((b: any) => {
      const rawName = safe(b.nombre || '').trim();
      if (!rawName) return;

      // Filter out: Gastos Médicos is a coverage limit, not a benefit
      if (/gastos m[eé]dic/i.test(rawName)) return;

      const label = canonicalize(rawName);
      const key   = label.toUpperCase();

      if (!matrix.has(key)) {
        matrix.set(key, { label, order: order++, perQuote: new Map() });
      }

      const entry = matrix.get(key)!;

      // Resolve detail: explicit detalle field > descripcion field > extracted from rawName
      const detail = safe(b.detalle || b.descripcion || extractDetailFromText(rawName, label)).trim();

      const existing = entry.perQuote.get(qi);
      if (existing) {
        // Same insurer has multiple benefits mapping to this canonical key
        // (e.g., FEDPA: Auto de Alquiler base + Auto de Alquiler mejorado → one row)
        if (b.incluido) existing.included = true;
        if (detail && !existing.detail.toLowerCase().includes(detail.toLowerCase().slice(0, 15))) {
          existing.detail = existing.detail ? `${existing.detail} / ${detail}` : detail;
        }
      } else {
        entry.perQuote.set(qi, { included: !!b.incluido, detail });
      }
    });
  });

  const sorted = [...matrix.values()].sort((a, b) => a.order - b.order);
  return sorted.map(entry => ({
    label: entry.label,
    values: quotes.map((_, qi) => {
      const e = entry.perQuote.get(qi);
      return e ? { included: e.included, detail: e.detail } : { included: false, detail: '' };
    }),
  }));
}

function buildEndosoMatrix(quotes: PDFQuote[]): BenefitRow[] {
  const seen = new Map<string, Map<number, { included: boolean }>>();

  quotes.forEach((q, qi) => {
    (q._endosos || []).forEach(e => {
      const key = safe(e.nombre).trim().toUpperCase();
      if (!key) return;
      if (!seen.has(key)) seen.set(key, new Map());
      seen.get(key)!.set(qi, { included: e.incluido });
    });
  });

  const result: BenefitRow[] = [];
  for (const [key, insurerMap] of seen) {
    const label = key.charAt(0) + key.slice(1).toLowerCase();
    result.push({
      label,
      values: quotes.map((_, qi) => insurerMap.get(qi) ?? { included: false }),
    });
  }
  return result;
}

/** Normalize logo dimensions — scale proportionally to max height */
function normalizeLogo(logo: any, maxH: number): { width: number; height: number } {
  if (!logo) return { width: 0, height: 0 };
  const ratio = logo.width / logo.height;
  const h = Math.min(maxH, maxH);
  return { width: h * ratio, height: h };
}

async function drawBenefitsPage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  logoImg: any,
  insurerLogos: Record<string, any>,
  quotes: PDFQuote[],
  subtitle: string,
) {
  if (!quotes.length) return;
  const page = pdfDoc.addPage([PW, PH]);
  drawHeader(page, font, fontBold, logoImg, subtitle);
  drawFooter(page, font);

  const n = quotes.length;
  // Benefits table: wider label column
  const lay = makeColLayout(n, 0.30);
  const { labelW, insW, colXs } = lay;

  const benefitRows  = buildBenefitMatrix(quotes);
  const endosoRows   = buildEndosoMatrix(quotes);

  let y = PH - HDR_H - 4;
  const yMin = FTR_H + 6;
  const BEN_ROW_H = 20;   // checkmark + optional detail text below
  const isPremium = quotes[0]?.planType === 'premium';

  // ── Insurer column header row (navy, with logos) ──────────────────────────
  page.drawRectangle({ x: M, y: y - INS_H, width: labelW, height: INS_H, color: STRIPE });
  page.drawText(safe(isPremium ? 'Plan Premium' : 'Plan Básico'), {
    x: M + LPAD, y: y - INS_H + (INS_H - 8) / 2 + 1, size: 7.5, font: fontBold, color: NAVY,
  });
  const BEN_CARD_GAP = 3;
  for (let i = 0; i < n; i++) {
    const q = quotes[i]!;
    const cx = colXs[i + 1]!;
    const cardX = cx + BEN_CARD_GAP / 2;
    const cardW = insW - BEN_CARD_GAP;

    roundedRect(page, { x: cardX, y: y - INS_H, width: cardW, height: INS_H, color: NAVY, borderRadius: 5 });

    const key  = insurerKey(q.insurerName);
    const logo = insurerLogos[key] || insurerLogos[key.split(' ')[0]!];
    if (logo) {
      const maxH = INS_H - 10;
      const maxW = cardW - 14;
      const minW = maxW * 0.45;
      const ratio = logo.width / logo.height;

      // Fit to maxH, then cap width
      let lh = maxH;
      let lw = lh * ratio;
      if (lw > maxW) { lw = maxW; lh = lw / ratio; }

      // Scale up if too narrow — only if height stays within bounds
      if (lw < minW) {
        const scaledLw = minW;
        const scaledLh = scaledLw / ratio;
        if (scaledLh <= maxH) { lw = scaledLw; lh = scaledLh; }
      }

      page.drawImage(logo, {
        x: cardX + (cardW - lw) / 2,
        y: y - INS_H + (INS_H - lh) / 2,
        width: lw, height: lh,
      });
    } else {
      page.drawText(safe(trunc(shortInsurerName(q.insurerName), 18)), {
        x: cardX + LPAD, y: y - INS_H + INS_H / 2 - 3,
        size: 7, font: fontBold, color: WHITE,
      });
    }
  }
  hLine(page, M, y - INS_H, CW, 0.3, ROW_LINE);
  y -= INS_H;

  // ── Section header helper ─────────────────────────────────────────────────
  const drawSectionHeader = (title: string, bg: ReturnType<typeof rgb> = NAVY) => {
    if (y - SEC_H < yMin) return;
    page.drawRectangle({ x: M, y: y - SEC_H, width: CW, height: SEC_H, color: bg });
    page.drawText(safe(title), {
      x: M + LPAD, y: y - SEC_H + (SEC_H - 8) / 2 + 1,
      size: 8, font: fontBold, color: WHITE,
    });
    hLine(page, M, y - SEC_H, CW, 0.2, ROW_LINE);
    y -= SEC_H;
  };

  // ── Benefit row helper ────────────────────────────────────────────────────
  const drawBenRow = (row: BenefitRow, stripe: boolean) => {
    if (y - BEN_ROW_H < yMin) return;
    const bg = stripe ? STRIPE : WHITE;
    page.drawRectangle({ x: M, y: y - BEN_ROW_H, width: CW, height: BEN_ROW_H, color: bg });

    // Label — bold, vertically centered
    page.drawText(safe(trunc(row.label, 46)), {
      x: M + LPAD, y: y - BEN_ROW_H + (BEN_ROW_H - 7) / 2 + 1,
      size: 7, font: fontBold, color: DARK,
    });

    // Per-insurer values: green checkmark (+ detail below) or soft gray X
    for (let i = 0; i < n; i++) {
      const v = row.values[i];
      if (!v) continue;
      const cx = colXs[i + 1]! + insW / 2;
      const colLeft = colXs[i + 1]!;

      if (v.included) {
        // Resolve detail: from API data first, then static map
        const detail = safe(v.detail || BENEFIT_STATIC_DETAILS[row.label] || '').trim();
        const hasDetail = detail.length > 0;

        // Checkmark: upper portion when has detail, centered when not
        const cy = hasDetail
          ? y - BEN_ROW_H + BEN_ROW_H * 0.68
          : y - BEN_ROW_H + BEN_ROW_H / 2;
        drawCheckmark(page, cx, cy, 8);

        // Detail text: small gray, centered in column, below checkmark
        if (hasDetail) {
          const maxChars = Math.floor((insW - 6) / (4.2 * 0.56));
          const dText = trunc(detail, maxChars);
          const dw = textWidth(dText, 4.2);
          page.drawText(dText, {
            x: colLeft + Math.max(2, (insW - dw) / 2),
            y: y - BEN_ROW_H + 3.5,
            size: 4.2, font, color: GRAY,
          });
        }
      } else {
        const cy = y - BEN_ROW_H + BEN_ROW_H / 2;
        drawCross(page, cx, cy, 8);
      }
    }

    hLine(page, M, y - BEN_ROW_H, CW, 0.2, ROW_LINE);
    y -= BEN_ROW_H;
  };

  // ── Draw tables ───────────────────────────────────────────────────────────
  const tableTop = y;

  drawSectionHeader(`Beneficios y Asistencia — ${isPremium ? 'Plan Premium' : 'Plan Basico'}`);

  benefitRows.forEach((row, idx) => drawBenRow(row, idx % 2 === 0));

  if (endosoRows.length > 0) {
    if (y - SEC_H - 4 > yMin) {
      y -= 4; // gap before endosos section
      drawSectionHeader('Endosos Incluidos', NAVY_LIGHT);
      endosoRows.forEach((row, idx) => drawBenRow(row, idx % 2 === 0));
    }
  }

}

// ── Public entry point ────────────────────────────────────────────────────────

export async function generarComparativaPDF(
  quotes: PDFQuote[],
  rootDir: string = process.cwd(),
  clientInfo?: ClientInfo,
): Promise<Buffer> {
  const pdfDoc  = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoImg     = await tryLoadPng(pdfDoc, rootDir, 'logo.png');
  const insurerLogos = await loadInsurerLogos(pdfDoc, rootDir);

  const basicQuotes   = quotes.filter(q => q.planType === 'basico');
  const premiumQuotes = quotes.filter(q => q.planType === 'premium');

  // Page 1: Basic coverages
  await drawCoveragePage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    basicQuotes, 'Planes Basicos — Coberturas', clientInfo,
  );

  // Page 2: Basic benefits comparison
  await drawBenefitsPage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    basicQuotes, 'Planes Basicos — Beneficios y Asistencia',
  );

  // Page 3: Premium coverages
  await drawCoveragePage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    premiumQuotes, 'Planes Premium — Coberturas', clientInfo,
  );

  // Page 4: Premium benefits comparison
  await drawBenefitsPage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    premiumQuotes, 'Planes Premium — Beneficios y Asistencia',
  );

  return Buffer.from(await pdfDoc.save());
}
