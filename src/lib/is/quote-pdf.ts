/**
 * IS Quotation PDF Generator
 * Generates a styled quotation PDF for Internacional de Seguros
 * Shows all 3 deductible options (bajo/medio/alto) and highlights the selected one.
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';

export interface ISQuotePdfData {
  // Client
  clientName: string;
  cedula: string;
  email?: string;
  telefono?: string;

  // Vehicle
  marca: string;
  modelo: string;
  anio: string | number;
  valorVehiculo: number;
  tipoCobertura: 'CC' | 'DT';

  // Quote identifiers
  idCotizacion: string;
  nroCotizacion?: number;
  fecha: string;

  // Selected option (1=bajo, 2=medio, 3=alto)
  opcionSeleccionada: 1 | 2 | 3;
  endosoTexto?: string;
  planType?: string; // 'basico' | 'premium'

  // All 3 coberturas tables from IS API
  allCoberturas: {
    Table?: any[];   // Opción 1 - deducible bajo
    Table1?: any[];  // Opción 2 - deducible medio
    Table2?: any[];  // Opción 3 - deducible alto
  };

  // Pricing
  apiPrimaTotal: number;  // PTOTAL from IS (Opt1, post-discount+6% tax)
  descuentoFactor: number; // e.g. 0.5250 means 47.50% discount
  descuentoPorcentaje: number;
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLOR_NAVY  = rgb(0.004, 0.004, 0.224);   // #010139
const COLOR_GREEN = rgb(0.541, 0.667, 0.098);   // #8AAA19
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_BLACK = rgb(0, 0, 0);
const COLOR_GRAY  = rgb(0.45, 0.45, 0.45);
const COLOR_LGRAY = rgb(0.93, 0.93, 0.93);
const COLOR_SELECTED_BG = rgb(0.878, 0.949, 0.820); // light green highlight
const COLOR_SELECTED_BORDER = rgb(0.541, 0.667, 0.098);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const parsePrima = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/,/g, '')) || 0;
};

const fmtMoney = (n: number) =>
  `B/.${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLOR_BLACK,
) {
  if (!text) return;
  page.drawText(String(text), { x, y, size, font, color });
}

function drawRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  fill: ReturnType<typeof rgb>,
  borderColor?: ReturnType<typeof rgb>,
  borderWidth = 1,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor, borderWidth });
}

// ─── Compute pricing for a given option ──────────────────────────────────────
function computeOptionPricing(
  tableRows: any[],
  descuentoFactor: number,
  IS_TAX = 0.06,
): { primaBruta: number; primaBase: number; primaTotal: number } {
  const primaBruta = tableRows.reduce((s: number, c: any) => s + parsePrima(c.PRIMA1), 0);
  const primaBase = Math.round(primaBruta * descuentoFactor * 100) / 100;
  const primaTotal = Math.round(primaBase * (1 + IS_TAX) * 100) / 100;
  return { primaBruta, primaBase, primaTotal };
}

export async function generateISQuotePdf(data: ISQuotePdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  // Landscape Letter for wider columns
  const pageW = 792;
  const pageH = 612;
  const page = pdfDoc.addPage([pageW, pageH]);

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 28;

  const T  = (txt: string, x: number, y: number, sz: number, clr = COLOR_BLACK, bold = false) =>
    drawText(page, txt, x, y, sz, bold ? fontBold : font, clr);
  const TB = (txt: string, x: number, y: number, sz: number, clr = COLOR_BLACK) =>
    T(txt, x, y, sz, clr, true);

  // ─── HEADER BAR ────────────────────────────────────────────────────────────
  drawRect(page, 0, pageH - 60, pageW, 60, COLOR_NAVY);
  TB('COTIZACIÓN DE SEGURO DE AUTO', margin, pageH - 25, 15, COLOR_WHITE);
  T('Internacional de Seguros, S.A.', margin, pageH - 40, 9, COLOR_GREEN);
  T(`Fecha: ${data.fecha}`, pageW - 180, pageH - 25, 9, COLOR_WHITE);
  if (data.nroCotizacion) {
    TB(`Nro. Cotización: ${data.nroCotizacion}`, pageW - 180, pageH - 40, 9, COLOR_GREEN);
  }
  T(`ID: ${data.idCotizacion}`, pageW - 180, pageH - 52, 7, rgb(0.7, 0.7, 0.9));

  // ─── CLIENT & VEHICLE INFO ─────────────────────────────────────────────────
  let y = pageH - 72;
  const infoBoxW = pageW - margin * 2;
  drawRect(page, margin, y - 48, infoBoxW, 50, COLOR_LGRAY);

  const col2x = margin + infoBoxW * 0.35;
  const col3x = margin + infoBoxW * 0.65;

  TB('DATOS DEL ASEGURADO', margin + 8, y - 10, 7.5, COLOR_NAVY);
  T(`Nombre: ${data.clientName}`, margin + 8, y - 22, 7.5);
  T(`Cédula: ${data.cedula}`, margin + 8, y - 33, 7.5);
  if (data.email)    T(`Email: ${data.email}`,       col2x, y - 22, 7.5);
  if (data.telefono) T(`Teléfono: ${data.telefono}`, col2x, y - 33, 7.5);
  TB('VEHÍCULO', col3x, y - 10, 7.5, COLOR_NAVY);
  T(`${data.marca} ${data.modelo} ${data.anio}`, col3x, y - 22, 7.5);
  T(`Valor: ${fmtMoney(data.valorVehiculo)}`, col3x, y - 33, 7.5);
  T(`Cobertura: ${data.tipoCobertura === 'CC' ? 'Cobertura Completa' : 'Daños a Terceros'}`, col3x, y - 44, 7.5);

  y -= 58;

  // ─── DEDUCTIBLE OPTIONS ────────────────────────────────────────────────────
  TB('OPCIONES DE DEDUCIBLE', margin, y, 10, COLOR_NAVY);
  T('El cliente seleccionó la opción resaltada en verde. Se muestran las 3 opciones disponibles.', margin, y - 12, 7, COLOR_GRAY);
  y -= 24;

  const options: Array<{ key: 'Table' | 'Table1' | 'Table2'; label: string; opt: 1 | 2 | 3; nivel: string }> = [
    { key: 'Table',  label: 'OPCIÓN 1 — DEDUCIBLE BAJO',  opt: 1, nivel: 'Bajo'  },
    { key: 'Table1', label: 'OPCIÓN 2 — DEDUCIBLE MEDIO', opt: 2, nivel: 'Medio' },
    { key: 'Table2', label: 'OPCIÓN 3 — DEDUCIBLE ALTO',  opt: 3, nivel: 'Alto'  },
  ];

  const colGap = 8;
  const usableW = pageW - margin * 2;
  const colW = (usableW - colGap * 2) / 3;
  const pad = 8; // internal card padding

  // Card height is dynamic based on coverage rows — compute max rows across all options
  const maxRowsAcross = Math.max(
    ...options.map(o => ((data.allCoberturas as any)[o.key] || []).length),
    1,
  );
  const rowH = 13;
  const headerBlockH = 70;  // card header + prima + divider
  const tableHeaderH = 36;  // COBERTURA / LÍMITE / PRIMA header
  const footerBlockH = 65;  // deducibles + total
  const cardH = headerBlockH + tableHeaderH + Math.min(maxRowsAcross, 18) * rowH + footerBlockH;

  let idx = 0;
  for (const opt of options) {
    const rows: any[] = (data.allCoberturas as any)[opt.key] || [];
    const isSelected = opt.opt === data.opcionSeleccionada;
    const x0 = margin + idx * (colW + colGap);

    const pricing = computeOptionPricing(rows, data.descuentoFactor);

    // Card background
    const cardColor = isSelected ? COLOR_SELECTED_BG : COLOR_WHITE;
    const borderColor = isSelected ? COLOR_SELECTED_BORDER : rgb(0.8, 0.8, 0.8);
    drawRect(page, x0, y - cardH, colW, cardH + 2, cardColor, borderColor, isSelected ? 2 : 1);

    // Card header band
    drawRect(page, x0, y - 22, colW, 24, isSelected ? COLOR_GREEN : COLOR_NAVY);
    TB(opt.label, x0 + pad, y - 15, 7.5, COLOR_WHITE);

    if (isSelected) {
      TB('>> SELECCIONADO', x0 + pad, y - 35, 7, COLOR_GREEN);
    } else {
      T(`Nivel: ${opt.nivel}`, x0 + pad, y - 35, 7, COLOR_GRAY);
    }

    // Prima display
    TB(fmtMoney(pricing.primaTotal), x0 + pad, y - 51, 12, isSelected ? COLOR_NAVY : COLOR_GRAY);
    T('prima anual (inc. impuestos)', x0 + pad, y - 63, 6.5, COLOR_GRAY);

    // Divider
    const divY = y - headerBlockH;
    page.drawLine({ start: { x: x0 + pad, y: divY }, end: { x: x0 + colW - pad, y: divY }, thickness: 0.5, color: borderColor });

    // Coberturas table header — navy band with white text
    const hdrH = 28;
    const hdrTop = divY - 4;
    const limColX = x0 + colW * 0.53;
    const primaColX = x0 + colW - pad - 2;
    drawRect(page, x0 + pad - 2, hdrTop - hdrH, colW - (pad - 2) * 2, hdrH, COLOR_NAVY);
    const hdrTextY = hdrTop - hdrH / 2 - 4; // vertically centered
    TB('COBERTURA', x0 + pad + 4, hdrTextY, 9, COLOR_WHITE);
    TB('LIMITE', limColX, hdrTextY, 9, COLOR_WHITE);
    TB('PRIMA', primaColX - 30, hdrTextY, 9, COLOR_WHITE);
    let ry = hdrTop - hdrH - 5;

    // Coverage rows
    const maxRows = 18;
    let rowCount = 0;
    for (const cob of rows) {
      if (rowCount >= maxRows) break;
      // Truncate name to fit within 52% of column width
      const maxNameChars = Math.floor(colW * 0.52 / 4);
      const nombre = String(cob.COBERTURA || '').substring(0, maxNameChars);
      const limite = String(cob.LIMITES || cob.LIMITES2 || '').substring(0, 14);
      const prima  = parsePrima(cob.PRIMA1);
      const rowBg  = rowCount % 2 === 0
        ? (isSelected ? rgb(0.92, 0.97, 0.86) : rgb(0.97, 0.97, 0.97))
        : (isSelected ? COLOR_SELECTED_BG : COLOR_WHITE);
      drawRect(page, x0 + pad - 2, ry - 2, colW - (pad - 2) * 2, rowH, rowBg);
      T(nombre, x0 + pad, ry + 2, 5.5, COLOR_BLACK);
      if (limite) T(limite, limColX, ry + 2, 5.5, COLOR_GRAY);
      T(prima > 0 ? fmtMoney(prima) : '—', primaColX - 22, ry + 2, 5.5, COLOR_BLACK);
      ry -= rowH;
      rowCount++;
    }

    idx++;

    // Deductibles from first available row with deductible data
    const compRow = rows.find((r: any) => String(r.COBERTURA || '').toUpperCase().includes('COMPRENSIVO'));
    const colRow  = rows.find((r: any) => String(r.COBERTURA || '').toUpperCase().includes('COLISION') || String(r.COBERTURA || '').toUpperCase().includes('VUELCO'));
    const dedComp = compRow ? parsePrima(compRow.DEDUCIBLE1) : 0;
    const dedCol  = colRow  ? parsePrima(colRow.DEDUCIBLE1)  : 0;

    // Pricing breakdown footer — anchored to bottom of card
    const ftrY = y - cardH + footerBlockH - 5;
    page.drawLine({ start: { x: x0 + pad, y: ftrY + 2 }, end: { x: x0 + colW - pad, y: ftrY + 2 }, thickness: 0.5, color: borderColor });
    TB('DEDUCIBLES:', x0 + pad, ftrY - 8, 6, COLOR_NAVY);
    T(`Comprensivo: ${dedComp > 0 ? fmtMoney(dedComp) : '—'}`, x0 + pad, ftrY - 20, 6, COLOR_GRAY);
    T(`Col/Vuelco: ${dedCol > 0  ? fmtMoney(dedCol)  : '—'}`, x0 + pad, ftrY - 31, 6, COLOR_GRAY);
    page.drawLine({ start: { x: x0 + pad, y: ftrY - 36 }, end: { x: x0 + colW - pad, y: ftrY - 36 }, thickness: 0.5, color: borderColor });
    TB(`TOTAL: ${fmtMoney(pricing.primaTotal)}`, x0 + pad, ftrY - 47, 8, isSelected ? COLOR_NAVY : COLOR_GRAY);
    T('(inc. 6% imp.)', x0 + pad + 2, ftrY - 57, 5.5, COLOR_GRAY);
  }

  y -= cardH + 12;

  // ─── PRICING SUMMARY ───────────────────────────────────────────────────────
  const summaryH = data.endosoTexto ? 68 : 55;
  drawRect(page, margin, y - summaryH, usableW, summaryH, COLOR_LGRAY, COLOR_NAVY, 1);
  TB('RESUMEN DE LA OPCIÓN SELECCIONADA', margin + 10, y - 13, 9, COLOR_NAVY);

  const selKey = data.opcionSeleccionada === 1 ? 'Table' : data.opcionSeleccionada === 2 ? 'Table1' : 'Table2';
  const selRows: any[] = (data.allCoberturas as any)[selKey] || [];
  const selPricing = computeOptionPricing(selRows, data.descuentoFactor);

  // Row 1: Prima bruta + descuento
  const sr1y = y - 30;
  T('Prima bruta:', margin + 10, sr1y, 8);
  T(fmtMoney(selPricing.primaBruta), margin + 85, sr1y, 8);
  if (data.descuentoPorcentaje > 0) {
    const descLabel = `Desc. buena exp. (${data.descuentoPorcentaje}%):  `;
    const descLabelW = font.widthOfTextAtSize(descLabel, 8);
    T(descLabel, margin + 180, sr1y, 8, COLOR_GRAY);
    T(`-${fmtMoney(selPricing.primaBruta - selPricing.primaBase)}`, margin + 180 + descLabelW, sr1y, 8, COLOR_GREEN);
  }

  // Row 2: Prima neta + impuestos + TOTAL
  const sr2y = y - 44;
  T('Prima neta:', margin + 10, sr2y, 8);
  T(fmtMoney(selPricing.primaBase), margin + 85, sr2y, 8);
  const taxLabel = 'Impuestos (6%):  ';
  const taxLabelW = font.widthOfTextAtSize(taxLabel, 8);
  T(taxLabel, margin + 180, sr2y, 8, COLOR_GRAY);
  T(fmtMoney(selPricing.primaTotal - selPricing.primaBase), margin + 180 + taxLabelW, sr2y, 8, COLOR_GRAY);
  TB('PRIMA TOTAL:', margin + 450, sr2y, 10, COLOR_NAVY);
  TB(fmtMoney(selPricing.primaTotal), margin + 550, sr2y, 10, COLOR_NAVY);

  if (data.endosoTexto) {
    T(`Endoso incluido: ${data.endosoTexto}`, margin + 10, y - 60, 7.5, COLOR_GREEN);
  }

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 20;
  page.drawLine({ start: { x: margin, y: footerY + 18 }, end: { x: pageW - margin, y: footerY + 18 }, thickness: 0.5, color: COLOR_LGRAY });
  T('Este documento es una cotización generada por Líderes en Seguros, S.A. en base a los datos proporcionados.', margin, footerY + 8, 6, COLOR_GRAY);
  T('La prima final puede variar al momento de la emisión. Regulado por la Superintendencia de Seguros de Panamá.', margin, footerY, 6, COLOR_GRAY);
  // Right-aligned reference — measure text width
  const refText = `Cot. IS ${data.nroCotizacion || data.idCotizacion} | Líderes en Seguros`;
  const refWidth = font.widthOfTextAtSize(refText, 5.5);
  T(refText, pageW - margin - refWidth, footerY + 4, 5.5, COLOR_GRAY);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
