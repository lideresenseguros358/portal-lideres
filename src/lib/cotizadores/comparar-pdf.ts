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

// ── Page layout (A4 Landscape) ────────────────────────────────────────────────
const PW   = 841.89;  // page width  (pt)
const PH   = 595.28;  // page height (pt)
const M    = 20;       // horizontal margin
const CW   = PW - 2*M; // content width ≈ 802

const HDR_H  = 62;   // header height
const VEH_H  = 26;   // vehicle/client info bar height (pages 1 & 3 only)
const FTR_H  = 52;   // footer height (with observations + SSRP)
const ROW_H  = 15;   // standard data row height
const SEC_H  = 19;   // section header row height
const INS_H  = 30;   // insurer column header height
const LPAD   = 6;    // left padding inside cells
const RPAD   = 4;    // right padding inside cells

// ── Contact Info ──────────────────────────────────────────────────────────────
const WEBSITE    = 'www.lideresenseguros.com';
const WHATSAPP   = '6833-9167';
const EMAIL      = 'contacto@lideresenseguros.com';
const LICENCIA   = 'Licencia PJ750';
const SSRP_LINE  = `Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panama - ${LICENCIA}`;
const OBS_LINE   = 'OBSERVACIONES: Comparativa informativa, no constituye contrato de seguro. Primas sujetas a confirmacion segun datos del vehiculo y conductor. Validez: 15 dias.';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip chars outside WinAnsi range so pdf-lib Helvetica doesn't throw */
function safe(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .replace(/[^\x00-\xFF]/g, '')  // remove chars outside Latin-1
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars
}

/** Format money: 909.00 → "B/. 909.00" */
function money(n: number | undefined | null, prefix = 'B/.'): string {
  if (n == null || isNaN(n)) return '—';
  return `${prefix} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

async function loadInsurerLogos(pdfDoc: PDFDocument, rootDir: string): Promise<Record<string, any>> {
  const logos: Record<string, any> = {};
  for (const name of ['fedpa', 'internacional', 'regional', 'ancon']) {
    try {
      const img = await tryLoadPng(pdfDoc, rootDir, `aseguradoras/${name}.png`);
      if (img) logos[name.toUpperCase()] = img;
      if (name === 'internacional') logos['INTERNACIONAL'] = img;
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

/** Draw a full-width horizontal rule */
function hLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5, color = GRAY_LIGHT) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color });
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

  // Left accent bar
  page.drawRectangle({ x: 0, y: PH - HDR_H, width: 4, height: HDR_H, color: GREEN });

  // Logo — maintain natural aspect ratio
  let logoEnd = M + 4;
  if (logoImg) {
    const maxH = HDR_H - 14;
    const maxW = 110;
    const ratio = logoImg.width / logoImg.height;
    const lh = Math.min(maxH, maxW / ratio);
    const lw = lh * ratio;
    page.drawImage(logoImg, { x: M + 8, y: PH - HDR_H + (HDR_H - lh) / 2, width: lw, height: lh });
    logoEnd = M + 8 + lw + 10;
  }

  // Title block
  page.drawText(safe('Comparativa de Cobertura Completa'), {
    x: logoEnd, y: PH - HDR_H + 36, size: 14, font: fontBold, color: NAVY,
  });
  page.drawText(safe(subtitle), {
    x: logoEnd, y: PH - HDR_H + 20, size: 10, font, color: GRAY,
  });

  // Right block: contact
  const rx = PW - M - 180;
  page.drawText(safe(WEBSITE), { x: rx, y: PH - HDR_H + 42, size: 8, font, color: NAVY });
  page.drawText(safe(`WhatsApp: ${WHATSAPP}`), { x: rx, y: PH - HDR_H + 28, size: 8, font, color: GRAY });
  page.drawText(safe(EMAIL), { x: rx, y: PH - HDR_H + 15, size: 7, font, color: GRAY });

  // Bottom border
  page.drawLine({
    start: { x: 0, y: PH - HDR_H },
    end:   { x: PW, y: PH - HDR_H },
    thickness: 1.5, color: NAVY,
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
) {
  const q = quotes[0];
  if (!q) return;

  const barY = PH - HDR_H - VEH_H;

  // Background: light navy stripe
  page.drawRectangle({ x: 0, y: barY, width: PW, height: VEH_H, color: BLUE_LIGHT });

  // Left accent
  page.drawRectangle({ x: 0, y: barY, width: 4, height: VEH_H, color: GREEN });

  // Bottom border
  page.drawLine({ start: { x: 0, y: barY }, end: { x: PW, y: barY }, thickness: 0.8, color: NAVY });

  const textY = barY + (VEH_H - 8) / 2 + 1;

  // Vehicle label
  page.drawText('VEHICULO:', { x: M + 8, y: textY, size: 7, font: fontBold, color: NAVY });

  // Año + Marca + Modelo
  const anio   = safe(String(q._anio || ''));
  const marca  = safe(q._marcaNombre || '');
  const modelo = safe(q._modeloNombre || '');
  const vehicleStr = [anio, marca, modelo].filter(Boolean).join('  ');
  page.drawText(vehicleStr, { x: M + 62, y: textY, size: 8, font: fontBold, color: DARK });

  // Suma asegurada
  if (q._sumaAsegurada && q._sumaAsegurada > 0) {
    const valorStr = `Valor Asegurado:  ${money(q._sumaAsegurada)}`;
    page.drawText(safe('COBERTURA COMPLETA'), { x: PW * 0.48, y: textY, size: 7, font: fontBold, color: NAVY });
    page.drawText(safe(valorStr), { x: PW * 0.64, y: textY, size: 7.5, font, color: DARK });
  }

  // Deducible type
  const dedType = safe(q._deducibleOriginal || '');
  if (dedType) {
    page.drawText(safe(`Deducible: ${dedType.charAt(0).toUpperCase() + dedType.slice(1)}`),
      { x: PW - M - 115, y: textY, size: 7, font, color: GRAY });
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
) {
  if (!quotes.length) return;
  const page = pdfDoc.addPage([PW, PH]);
  drawHeader(page, font, fontBold, logoImg, subtitle);
  drawVehicleBar(page, font, fontBold, quotes);
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
        size: 6, font, color: bg ? WHITE : GRAY,
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

    // Horizontal rule below row
    hLine(page, M, y - rh, CW, 0.3);

    y -= rh;
  };

  // ── Insurer header row (navy) ─────────────────────────────────────────────
  // Label column header
  page.drawRectangle({ x: M, y: y - INS_H, width: labelW, height: INS_H, color: STRIPE });
  page.drawText(safe('Cobertura Completa'), {
    x: M + LPAD, y: y - INS_H + (INS_H - 8) / 2,
    size: 7.5, font: fontBold, color: NAVY,
  });

  // Insurer columns
  for (let i = 0; i < n; i++) {
    const q = quotes[i]!;
    const cx = colXs[i + 1]!;
    const isRec = q.isRecommended;

    // Background
    page.drawRectangle({ x: cx, y: y - INS_H, width: insW, height: INS_H, color: NAVY });

    // Insurer logo — maintain aspect ratio, fit in INS_H cell
    const key = insurerKey(q.insurerName);
    const logo = insurerLogos[key] || insurerLogos[key.split(' ')[0]!];
    let logoEndX = cx + 6;
    if (logo) {
      const maxH = INS_H - 8;
      const maxW = Math.min(insW * 0.38, 52);
      const ratio = logo.width / logo.height;
      const lh = Math.min(maxH, maxW / ratio);
      const lw = lh * ratio;
      page.drawImage(logo, { x: cx + 4, y: y - INS_H + (INS_H - lh) / 2, width: lw, height: lh });
      logoEndX = cx + 4 + lw + 4;
    }

    // Insurer name
    const sName = trunc(shortInsurerName(q.insurerName), 18);
    page.drawText(safe(sName), {
      x: logoEndX, y: y - INS_H + INS_H / 2 + 1,
      size: 7.5, font: fontBold, color: WHITE,
    });

    // Plan badge
    const badgeColor = isPremium ? GREEN : rgb(0.5, 0.5, 0.55);
    page.drawRectangle({ x: cx + insW - 38, y: y - INS_H + 6, width: 34, height: 12, color: badgeColor });
    page.drawText(safe(planBadge), {
      x: cx + insW - 36, y: y - INS_H + 9,
      size: 6, font: fontBold, color: WHITE,
    });

    // Recommended star
    if (isRec) {
      page.drawRectangle({ x: cx, y: y - INS_H, width: insW, height: 3, color: GREEN });
    }
  }

  hLine(page, M, y - INS_H, CW, 0.8, NAVY);
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

  // Lesiones Corporales
  const lesValues = quotes.map(q => resolveLimit(q, ['lesiones', 'corporales'], ['lesiones', 'corporal'], true));
  drawLabelRow('Lesiones Corporales', 'por persona / por accidente', lesValues, {
    bg: STRIPE, rh: ROW_H + 2,
  });

  // Danos Propiedad
  const dpaValues = quotes.map(q => resolveLimit(q, ['propiedad', 'dano'], ['propiedad', 'daños', 'dano'], false));
  drawLabelRow('Danos a la Propiedad Ajena', null, dpaValues, { rh: ROW_H });

  // Gastos Medicos
  const gmValues = quotes.map(q => resolveLimit(q, ['medico', 'gastos'], ['medico', 'medic', 'gastos'], true));
  drawLabelRow('Gastos Medicos', 'por persona / por accidente', gmValues, {
    bg: STRIPE, rh: ROW_H + 2,
  });

  // Comprensivo (valor asegurado)
  const compValues = quotes.map(q => {
    const sa = q._sumaAsegurada;
    return sa ? money(sa) : 'Valor del Auto';
  });
  drawLabelRow('Comprensivo', null, compValues, { rh: ROW_H });

  // Colision/Vuelco
  const colValues = quotes.map(q => {
    const sa = q._sumaAsegurada;
    return sa ? money(sa) : 'Valor del Auto';
  });
  drawLabelRow('Colision o Vuelco', null, colValues, { bg: STRIPE, rh: ROW_H });

  // ── Section B: Deducibles ────────────────────────────────────────────────
  drawLabelRow('DEDUCIBLES', null, Array(n).fill(''),
    { bg: NAVY, labelBold: true, rh: SEC_H, fontSize: 8 },
  );

  const dedCompValues = quotes.map(q => {
    const d = q._deduciblesReales?.comprensivo;
    return d ? money(d.amount) : '—';
  });
  drawLabelRow('Comprensivo', null, dedCompValues, { rh: ROW_H });

  const dedColValues = quotes.map(q => {
    const d = q._deduciblesReales?.colisionVuelco;
    return d ? money(d.amount) : '—';
  });
  drawLabelRow('Colision o Vuelco', null, dedColValues, { bg: STRIPE, rh: ROW_H });

  // ── Section C: Precios ───────────────────────────────────────────────────
  drawLabelRow('PRIMA ANUAL', null, Array(n).fill('Total'),
    { bg: GREEN, labelBold: true, rh: SEC_H, fontSize: 8,
      valColor: WHITE, labelColor: WHITE },
  );

  const contadoValues = quotes.map(q => {
    const p = q._priceBreakdown?.totalAlContado ?? q.annualPremium;
    return money(p, 'B/.');
  });
  drawLabelRow('Al Contado (5% descuento)', null, contadoValues, {
    labelBold: false, valueBold: true, rh: ROW_H + 4,
    valColor: NAVY, labelColor: DARK,
  });

  const tarjetaValues = quotes.map(q => {
    const p = q._priceBreakdown?.totalConTarjeta ?? q.annualPremium;
    return money(p, 'B/.');
  });
  drawLabelRow('Con Tarjeta de Credito', null, tarjetaValues, {
    bg: STRIPE, rh: ROW_H,
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
    rh: ROW_H, valColor: GREEN,
  });

  // ── Outer border for table ────────────────────────────────────────────────
  const tableTop = PH - HDR_H - VEH_H - 4;
  const tableH   = tableTop - y;
  page.drawRectangle({
    x: M, y, width: CW, height: tableH,
    borderColor: GRAY_LIGHT, borderWidth: 0.6,
  });

  // Vertical dividers
  for (let i = 1; i < colXs.length; i++) {
    page.drawLine({
      start: { x: colXs[i]!, y }, end: { x: colXs[i]!, y: tableTop },
      thickness: 0.4, color: GRAY_LIGHT,
    });
  }
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
  { pattern: /gastos m[eé]dicos|adelanto.*m[eé]dic|hospitali[sz]/i, label: 'Gastos Médicos' },
  { pattern: /efectos personales/i,                           label: 'Efectos Personales' },
  { pattern: /defensa penal|gastos legales.*penal/i,          label: 'Defensa Penal' },
  { pattern: /asistencia legal/i,                             label: 'Asistencia Legal' },
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
  const BEN_ROW_H = 18;   // taller to fit detail text below "Si"
  const isPremium = quotes[0]?.planType === 'premium';

  // ── Insurer column header row (navy, with logos) ──────────────────────────
  page.drawRectangle({ x: M, y: y - INS_H, width: labelW, height: INS_H, color: STRIPE });
  page.drawText(safe(isPremium ? 'Plan Premium' : 'Plan Básico'), {
    x: M + LPAD, y: y - INS_H + (INS_H - 8) / 2 + 1, size: 7.5, font: fontBold, color: NAVY,
  });
  for (let i = 0; i < n; i++) {
    const q   = quotes[i]!;
    const cx  = colXs[i + 1]!;
    page.drawRectangle({ x: cx, y: y - INS_H, width: insW, height: INS_H, color: NAVY });
    const key  = insurerKey(q.insurerName);
    const logo = insurerLogos[key] || insurerLogos[key.split(' ')[0]!];
    let logoEndX = cx + 6;
    if (logo) {
      const maxH = INS_H - 8, maxW = Math.min(insW * 0.36, 48);
      const ratio = logo.width / logo.height;
      const lh = Math.min(maxH, maxW / ratio);
      const lw = lh * ratio;
      page.drawImage(logo, { x: cx + 4, y: y - INS_H + (INS_H - lh) / 2, width: lw, height: lh });
      logoEndX = cx + 4 + lw + 4;
    }
    page.drawText(safe(trunc(shortInsurerName(q.insurerName), 18)), {
      x: logoEndX, y: y - INS_H + INS_H / 2 + 1, size: 7, font: fontBold, color: WHITE,
    });
  }
  hLine(page, M, y - INS_H, CW, 0.8, NAVY);
  y -= INS_H;

  // ── Section header helper ─────────────────────────────────────────────────
  const drawSectionHeader = (title: string, bg: ReturnType<typeof rgb> = NAVY) => {
    if (y - SEC_H < yMin) return;
    page.drawRectangle({ x: M, y: y - SEC_H, width: CW, height: SEC_H, color: bg });
    page.drawText(safe(title), {
      x: M + LPAD, y: y - SEC_H + (SEC_H - 8) / 2 + 1,
      size: 8, font: fontBold, color: WHITE,
    });
    // Insurer names in section header
    for (let i = 0; i < n; i++) {
      const q = quotes[i]!;
      const sName = trunc(shortInsurerName(q.insurerName), 20);
      page.drawText(safe(sName), {
        x: colXs[i + 1]! + LPAD, y: y - SEC_H + (SEC_H - 8) / 2 + 1,
        size: 7, font: fontBold, color: WHITE,
      });
    }
    hLine(page, M, y - SEC_H, CW, 0.3);
    y -= SEC_H;
  };

  // ── Benefit row helper ────────────────────────────────────────────────────
  // Layout inside each BEN_ROW_H (18pt) cell:
  //   Top 10pt:  "Si" green badge  OR  "—" gray line
  //   Bottom 7pt: detail text (small, centered) when included
  const drawBenRow = (row: BenefitRow, stripe: boolean) => {
    if (y - BEN_ROW_H < yMin) return;
    const bg = stripe ? STRIPE : WHITE;
    page.drawRectangle({ x: M, y: y - BEN_ROW_H, width: CW, height: BEN_ROW_H, color: bg });

    // Label — bold, vertically centered
    page.drawText(safe(trunc(row.label, 46)), {
      x: M + LPAD, y: y - BEN_ROW_H + (BEN_ROW_H - 7) / 2 + 1,
      size: 7, font: fontBold, color: DARK,
    });

    // Per-insurer values
    for (let i = 0; i < n; i++) {
      const v = row.values[i];
      if (!v) continue;
      const cx = colXs[i + 1]!;

      if (v.included) {
        // Green "Si" badge in upper portion of cell
        const badgeW = 20, badgeH = 8;
        const bx = cx + (insW - badgeW) / 2;
        const by = y - BEN_ROW_H + BEN_ROW_H - badgeH - 2; // near top
        page.drawRectangle({ x: bx, y: by, width: badgeW, height: badgeH, color: GREEN });
        page.drawText('Si', {
          x: bx + (badgeW - textWidth('Si', 6.5)) / 2,
          y: by + (badgeH - 6.5) / 2 + 0.5,
          size: 6.5, font: fontBold, color: WHITE,
        });
        // Detail text in lower portion — truncated to fit column, centered
        if (v.detail) {
          const maxChars = Math.floor((insW - 8) / (5 * 0.56));
          const dText = trunc(v.detail, maxChars);
          const dw = textWidth(dText, 5);
          page.drawText(safe(dText), {
            x: cx + Math.max(2, (insW - dw) / 2),
            y: y - BEN_ROW_H + 2.5,
            size: 5, font, color: GRAY,
          });
        }
      } else {
        // Clear "—" indicator: a short horizontal line in GRAY, visually distinct
        const lineY  = y - BEN_ROW_H + BEN_ROW_H / 2;
        const lineX1 = cx + insW * 0.30;
        const lineX2 = cx + insW * 0.70;
        page.drawLine({ start: { x: lineX1, y: lineY }, end: { x: lineX2, y: lineY }, thickness: 1.5, color: GRAY });
      }
    }

    hLine(page, M, y - BEN_ROW_H, CW, 0.25);
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

  // ── Outer border ─────────────────────────────────────────────────────────
  if (y < tableTop) {
    page.drawRectangle({
      x: M, y, width: CW, height: tableTop - y,
      borderColor: GRAY_LIGHT, borderWidth: 0.6,
    });
    for (let i = 1; i < colXs.length; i++) {
      page.drawLine({
        start: { x: colXs[i]!, y }, end: { x: colXs[i]!, y: tableTop },
        thickness: 0.4, color: GRAY_LIGHT,
      });
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function generarComparativaPDF(
  quotes: PDFQuote[],
  rootDir: string = process.cwd(),
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
    basicQuotes, 'Planes Basicos — Coberturas',
  );

  // Page 2: Basic benefits comparison
  await drawBenefitsPage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    basicQuotes, 'Planes Basicos — Beneficios y Asistencia',
  );

  // Page 3: Premium coverages
  await drawCoveragePage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    premiumQuotes, 'Planes Premium — Coberturas',
  );

  // Page 4: Premium benefits comparison
  await drawBenefitsPage(
    pdfDoc, font, fontBold, logoImg, insurerLogos,
    premiumQuotes, 'Planes Premium — Beneficios y Asistencia',
  );

  return Buffer.from(await pdfDoc.save());
}
