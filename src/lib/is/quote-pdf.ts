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
  const pageW = 612;
  const pageH = 792;
  const page = pdfDoc.addPage([pageW, pageH]);

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const T  = (txt: string, x: number, y: number, sz: number, clr = COLOR_BLACK, bold = false) =>
    drawText(page, txt, x, y, sz, bold ? fontBold : font, clr);
  const TB = (txt: string, x: number, y: number, sz: number, clr = COLOR_BLACK) =>
    T(txt, x, y, sz, clr, true);

  // ─── HEADER BAR ────────────────────────────────────────────────────────────
  drawRect(page, 0, pageH - 70, pageW, 70, COLOR_NAVY);
  TB('COTIZACIÓN DE SEGURO DE AUTO', 30, pageH - 30, 14, COLOR_WHITE);
  T('Internacional de Seguros, S.A.', 30, pageH - 47, 9, COLOR_GREEN);
  T(`Fecha: ${data.fecha}`, pageW - 140, pageH - 30, 8, COLOR_WHITE);
  if (data.nroCotizacion) {
    TB(`Nro. Cotización: ${data.nroCotizacion}`, pageW - 140, pageH - 46, 8, COLOR_GREEN);
  }
  T(`ID: ${data.idCotizacion}`, pageW - 140, pageH - 58, 7, rgb(0.7, 0.7, 0.9));

  // ─── CLIENT & VEHICLE INFO ─────────────────────────────────────────────────
  let y = pageH - 85;
  drawRect(page, 20, y - 55, pageW - 40, 58, COLOR_LGRAY);
  TB('DATOS DEL ASEGURADO', 28, y - 12, 8, COLOR_NAVY);
  T(`Nombre: ${data.clientName}`, 28, y - 26, 8);
  T(`Cédula: ${data.cedula}`, 28, y - 38, 8);
  if (data.email)    T(`Email: ${data.email}`,       200, y - 26, 8);
  if (data.telefono) T(`Teléfono: ${data.telefono}`, 200, y - 38, 8);
  TB('VEHÍCULO', 390, y - 12, 8, COLOR_NAVY);
  T(`${data.marca} ${data.modelo} ${data.anio}`, 390, y - 26, 8);
  T(`Valor asegurado: ${fmtMoney(data.valorVehiculo)}`, 390, y - 38, 8);
  T(`Cobertura: ${data.tipoCobertura === 'CC' ? 'Cobertura Completa' : 'Daños a Terceros'}`, 390, y - 50, 8);

  y -= 70;

  // ─── DEDUCTIBLE OPTIONS ────────────────────────────────────────────────────
  TB('OPCIONES DE DEDUCIBLE', 20, y, 10, COLOR_NAVY);
  T('El cliente seleccionó la opción resaltada en verde. Se muestran las 3 opciones disponibles.', 20, y - 13, 7, COLOR_GRAY);
  y -= 28;

  const options: Array<{ key: 'Table' | 'Table1' | 'Table2'; label: string; opt: 1 | 2 | 3; nivel: string }> = [
    { key: 'Table',  label: 'OPCIÓN 1 — DEDUCIBLE BAJO',  opt: 1, nivel: 'Bajo'  },
    { key: 'Table1', label: 'OPCIÓN 2 — DEDUCIBLE MEDIO', opt: 2, nivel: 'Medio' },
    { key: 'Table2', label: 'OPCIÓN 3 — DEDUCIBLE ALTO',  opt: 3, nivel: 'Alto'  },
  ];

  const colW = (pageW - 50) / 3;  // ~187pt each

  let idx = 0;
  for (const opt of options) {
    const rows: any[] = (data.allCoberturas as any)[opt.key] || [];
    const isSelected = opt.opt === data.opcionSeleccionada;
    const x0 = 20 + idx * (colW + 5);

    // Compute pricing
    const pricing = computeOptionPricing(rows, data.descuentoFactor);

    // Card background
    const cardColor = isSelected ? COLOR_SELECTED_BG : COLOR_WHITE;
    const borderColor = isSelected ? COLOR_SELECTED_BORDER : rgb(0.8, 0.8, 0.8);
    drawRect(page, x0, y - 300, colW, 305, cardColor, borderColor, isSelected ? 2 : 1);

    // Card header
    drawRect(page, x0, y - 22, colW, 25, isSelected ? COLOR_GREEN : COLOR_NAVY);
    TB(opt.label, x0 + 5, y - 15, 7, COLOR_WHITE);

    if (isSelected) {
      TB('>> SELECCIONADO', x0 + 5, y - 35, 7, COLOR_GREEN);
    } else {
      T(`Nivel: ${opt.nivel}`, x0 + 5, y - 35, 7, COLOR_GRAY);
    }

    // Prima display
    TB(fmtMoney(pricing.primaTotal), x0 + 5, y - 51, 11, isSelected ? COLOR_NAVY : COLOR_GRAY);
    T('prima anual (inc. impuestos)', x0 + 5, y - 62, 6.5, COLOR_GRAY);

    // Divider
    page.drawLine({ start: { x: x0 + 5, y: y - 67 }, end: { x: x0 + colW - 5, y: y - 67 }, thickness: 0.5, color: borderColor });

    // Coberturas header row
    let ry = y - 78;
    TB('COBERTURA', x0 + 5, ry, 6.5, COLOR_NAVY);
    TB('LÍMITE', x0 + colW - 58, ry, 6.5, COLOR_NAVY);
    TB('PRIMA', x0 + colW - 28, ry, 6.5, COLOR_NAVY);
    ry -= 4;
    page.drawLine({ start: { x: x0 + 5, y: ry }, end: { x: x0 + colW - 5, y: ry }, thickness: 0.5, color: COLOR_GRAY });
    ry -= 2;

    // Coverage rows
    const maxRows = 18;
    let rowCount = 0;
    for (const cob of rows) {
      if (rowCount >= maxRows) break;
      const nombre = String(cob.COBERTURA || '').substring(0, 22);
      const limite = String(cob.LIMITES || cob.LIMITES2 || '').substring(0, 12);
      const prima  = parsePrima(cob.PRIMA1);
      const rowBg  = rowCount % 2 === 0 ? (isSelected ? rgb(0.92, 0.97, 0.86) : rgb(0.97, 0.97, 0.97)) : (isSelected ? COLOR_SELECTED_BG : COLOR_WHITE);
      drawRect(page, x0 + 3, ry - 1, colW - 6, 11, rowBg);
      T(nombre, x0 + 5, ry + 2, 5.5, COLOR_BLACK);
      if (limite) T(limite, x0 + colW - 60, ry + 2, 5, COLOR_GRAY);
      T(prima > 0 ? fmtMoney(prima) : '—', x0 + colW - 32, ry + 2, 5, COLOR_BLACK);
      ry -= 12;
      rowCount++;
    }

    idx++;

    // Deductibles from first available row with deductible data
    const compRow = rows.find((r: any) => String(r.COBERTURA || '').toUpperCase().includes('COMPRENSIVO'));
    const colRow  = rows.find((r: any) => String(r.COBERTURA || '').toUpperCase().includes('COLISION') || String(r.COBERTURA || '').toUpperCase().includes('VUELCO'));
    const dedComp = compRow ? parsePrima(compRow.DEDUCIBLE1) : 0;
    const dedCol  = colRow  ? parsePrima(colRow.DEDUCIBLE1)  : 0;

    // Pricing breakdown footer
    const ftrY = y - 280;
    page.drawLine({ start: { x: x0 + 5, y: ftrY + 40 }, end: { x: x0 + colW - 5, y: ftrY + 40 }, thickness: 0.5, color: borderColor });
    TB('DEDUCIBLES:', x0 + 5, ftrY + 29, 6, COLOR_NAVY);
    T(`Comprensivo: ${dedComp > 0 ? fmtMoney(dedComp) : '—'}`, x0 + 5, ftrY + 18, 5.5, COLOR_GRAY);
    T(`Col/Vuelco:   ${dedCol > 0  ? fmtMoney(dedCol)  : '—'}`, x0 + 5, ftrY + 8,  5.5, COLOR_GRAY);
    page.drawLine({ start: { x: x0 + 5, y: ftrY + 3 }, end: { x: x0 + colW - 5, y: ftrY + 3 }, thickness: 0.5, color: borderColor });
    TB(`TOTAL: ${fmtMoney(pricing.primaTotal)}`, x0 + 5, ftrY - 8, 7.5, isSelected ? COLOR_NAVY : COLOR_GRAY);
    T(`(inc. 6% imp.)`, x0 + 5, ftrY - 19, 5.5, COLOR_GRAY);
  }

  y -= 310;

  // ─── PRICING SUMMARY ───────────────────────────────────────────────────────
  y -= 10;
  drawRect(page, 20, y - 55, pageW - 40, 58, COLOR_LGRAY, COLOR_NAVY, 1);
  TB('RESUMEN DE LA OPCIÓN SELECCIONADA', 28, y - 13, 9, COLOR_NAVY);

  const selKey = data.opcionSeleccionada === 1 ? 'Table' : data.opcionSeleccionada === 2 ? 'Table1' : 'Table2';
  const selRows: any[] = (data.allCoberturas as any)[selKey] || [];
  const selPricing = computeOptionPricing(selRows, data.descuentoFactor);

  T(`Prima bruta:`,       28, y - 27, 8);
  T(fmtMoney(selPricing.primaBruta), 130, y - 27, 8);
  if (data.descuentoPorcentaje > 0) {
    T(`Desc. buena exp. (${data.descuentoPorcentaje}%):`, 210, y - 27, 8, COLOR_GRAY);
    T(`-${fmtMoney(selPricing.primaBruta - selPricing.primaBase)}`, 370, y - 27, 8, COLOR_GREEN);
  }
  T(`Prima neta:`,        28, y - 40, 8);
  T(fmtMoney(selPricing.primaBase), 130, y - 40, 8);
  T(`Impuestos (6%):`,   210, y - 40, 8, COLOR_GRAY);
  T(fmtMoney(selPricing.primaTotal - selPricing.primaBase), 300, y - 40, 8, COLOR_GRAY);
  TB(`PRIMA TOTAL:`,      390, y - 40, 9, COLOR_NAVY);
  TB(fmtMoney(selPricing.primaTotal), 465, y - 40, 9, COLOR_NAVY);

  if (data.endosoTexto) {
    T(`Endoso incluido: ${data.endosoTexto}`, 28, y - 52, 7.5, COLOR_GREEN);
  }

  y -= 70;

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 30;
  page.drawLine({ start: { x: 20, y: footerY + 20 }, end: { x: pageW - 20, y: footerY + 20 }, thickness: 0.5, color: COLOR_LGRAY });
  T('Este documento es una cotización generada por Líderes en Seguros, S.A. en base a los datos proporcionados.', 20, footerY + 10, 6, COLOR_GRAY);
  T('La prima final puede variar al momento de la emisión. Regulado por la Superintendencia de Seguros de Panamá.', 20, footerY, 6, COLOR_GRAY);
  T(`Cotización IS Nro. ${data.nroCotizacion || data.idCotizacion} | Líderes en Seguros, S.A. | contacto@lideresenseguros.com`, pageW - 20, footerY + 5, 5.5, COLOR_GRAY);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
