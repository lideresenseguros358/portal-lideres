/**
 * IS Inspection PDF Generator
 * Generates the "Informe de Inspección de Vehículos" PDF
 * Overlays text on the official IS template (formulario-inspeccion-auto.pdf)
 *
 * Coordinates derived from JPG (1700x2200px) → PDF (612x792pts):
 *   scaleX = 612/1700 ≈ 0.36,  scaleY = 792/2200 ≈ 0.36
 *   PDF y = 792 - (jpgY * scaleY)   [PDF origin = bottom-left]
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface InspectionPdfData {
  // Client data
  propietario: string;
  direccion: string;
  cedula: string;
  dv?: string;
  telefonos: string;

  // Vehicle data
  color: string;
  placa: string;
  anio: string;
  tipo: string;
  marca: string;
  modelo: string;
  motor: string;
  chasis: string;
  kilometraje: string;
  pasajeros?: string;

  // Fuel & transmission
  tipoCombustible: 'GASOLINA' | 'DIESEL';
  tipoTransmision: 'AUTOMATICO' | 'MANUAL';

  // Inspection
  buenEstadoFisico: boolean;
  tieneExtras: boolean;
  extrasSeleccionados: string[];
  extrasDetalle: string;

  // Insurance
  sumaAsegurada: string;
  valorVehiculo?: string;
  aseguradoAnteriormente: boolean;
  aseguradoraAnterior?: string;

  // Signature (base64 PNG data URL)
  firmaDataUrl?: string;

  // Observaciones
  observaciones?: string;

  // Date
  fecha: string;
}

export async function generateInspectionPdf(data: InspectionPdfData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'API INTERNACIONAL', 'formulario-inspeccion-auto.pdf');
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0]!;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const FS = 8;   // default font size
  const FSS = 7;  // small font size

  /*
   * ─── Coordinate reference (from PDF content-stream analysis) ──────────────
   * PDF page: 612 × 792 pts (origin = bottom-left)
   *
   * KEY HORIZONTAL LINES (underlines / row borders):
   *   y=706.6  Agente input top       x:108-309
   *   y=692.3  Agente input bottom    x:108-309
   *   y=678.3  GREEN BORDER TOP       x:21-596  (full width)
   *   y=672.8  PROPIETARIO underline  x:108-354  |  DIRECCION x:419-587
   *   y=656.5  CEDULA underline       x:108-354  |  TELEFONOS x:419-587
   *   y=651.0  COLOR underline (left) x:108-239
   *   y=632.7  MARCA underline (left) x:108-239
   *   y=621.9  KM area               x:108-...; right sub-cells x:505-587
   *   y=611.1  GASOLINA row           x:505-587 (right sub-cells)
   *   y=600.4  extras checkbox area top
   *   y=448.5  GREEN BORDER BOTTOM    x:21-596
   *
   * KEY VERTICAL SEPARATORS:
   *   x=107.4  Left edge of input fields
   *   x=238.4  PLACA/MODELO column divider
   *   x=280.9  AÑO start
   *   x=308.9  AÑO/MOTOR column divider (right edge of left-third)
   *   x=353.6  D.V. divider
   *   x=418.3  DIRECCION / TELEFONOS / TIPO / CHASIS column start
   *   x=504.8  Right sub-divider (PARTICULAR, CILINDROS)
   *   x=555.2  Agente right-side divider
   *   x=586.8  Right edge of input fields
   *   x=594.7  GREEN BORDER RIGHT
   *
   * Text baselines sit ~2-3pts above the underline.
   */

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const T = (text: string, x: number, y: number, size = FS, bold = false) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size, font: bold ? fontBold : font, color: black });
  };

  const X = (x: number, y: number) =>
    page.drawText('X', { x, y, size: 9, font: fontBold, color: black });

  const fit = (text: string, maxChars: number) => String(text || '').substring(0, maxChars);

  // ─── HEADER / AGENTE ──────────────────────────────────────────────────────
  // Template already prints "LIDERES EN SEGUROS, S.A." in Agente field — do NOT overlay.
  // Only add the date in the Fecha field.
  T(data.fecha, 500, 696, FSS);

  // ─── ROW 1: PROPIETARIO | DIRECCION ────────────────────────────────────────
  // Input area between underlines 672.8→656.5.  Text baseline ≈ 659.
  T(fit(data.propietario, 28), 110, 659);
  T(fit(data.direccion, 22),   420, 659);

  // ─── ROW 2: CEDULA/RUC | D.V. | TELEFONOS ─────────────────────────────────
  // Tall row y=656.5→632.7 split by sub-line at 651.0
  // Upper sub-row (CEDULA+TEL): baseline ≈ 641
  T(fit(data.cedula, 18),       110, 641);
  if (data.dv) T(fit(data.dv, 4), 358, 641);
  T(fit(data.telefonos, 22),    420, 641);

  // ─── ROW 3: COLOR | PLACA | AÑO | TIPO ────────────────────────────────────
  // Lower sub-row of tall row (below 651.0 sub-line): baseline ≈ 613
  T(fit(data.color, 12),  110, 613);
  T(fit(data.placa, 8),   242, 613);
  T(fit(data.anio, 4),    285, 613);
  T(fit(data.tipo, 12),   420, 613);

  // ─── ROW 4: MARCA | MODELO | MOTOR | CHASIS ───────────────────────────────
  // Row y=632.7→621.9 (10.8pts). Baseline ≈ 592.
  T(fit(data.marca, 14),   110, 592);
  T(fit(data.modelo, 12),  242, 592);
  T(fit(data.motor, 12),   420, 592);
  T(fit(data.chasis, 14),  508, 592);

  // ─── ROW 5: KILOMETRAJE | PASAJEROS | COMERCIAL | PARTICULAR | TRACCION ───
  // Row y=621.9→611.1 (10.8pts). Baseline ≈ 569.
  T(fit(data.kilometraje, 10), 110, 569);
  if (data.pasajeros) T(fit(data.pasajeros, 3), 242, 569);
  X(508, 569);  // PARTICULAR always checked

  // ─── ROW 6: GASOLINA | DIESEL | AUTOMATICO | MANUAL | CILINDROS | TONELADAS
  // Row y=611.1→600.4 (10.7pts). Baseline ≈ 571.
  if (data.tipoCombustible === 'GASOLINA') {
    X(110, 571);
  } else {
    X(172, 571);
  }

  // AUTOMATICO / MANUAL
  if (data.tipoTransmision === 'AUTOMATICO') {
    X(242, 571);
  } else {
    X(314, 571);
  }

  // ─── EXTRAS CHECKBOXES ──────────────────────────────────────────────────────
  // Grid: 5 columns × 7 rows
  // Vertical separators from stream: x≈123, 169/187, 238/257, 354/376, 470/486, 567
  // Row top lines from stream: y≈600, 589, 578, 567, 557, 546, (530 area)
  // Row step ≈ 11pts,  Checkbox X positions inside each cell
  const extrasPositions: Record<string, { x: number; y: number }> = {
    // Column 1 (x≈110)
    'Alarma de Fca.':           { x: 110, y: 575 },
    'Otra Alarma':              { x: 110, y: 564 },
    'Inmobilizer':              { x: 110, y: 553 },
    'GPS':                      { x: 110, y: 542 },
    'Copas de Lujo':            { x: 110, y: 532 },
    'Rines Magnesio':           { x: 110, y: 521 },
    'Halógenos':                { x: 110, y: 510 },
    // Column 2 (x≈190)
    'Deflector de aire':        { x: 190, y: 575 },
    'Ventana de Techo':         { x: 190, y: 564 },
    'Bola de Trailer':          { x: 190, y: 553 },
    'Retrovisores':             { x: 190, y: 542 },
    'Retrovisores c/señal/luz': { x: 190, y: 532 },
    'Antena Eléctrica':         { x: 190, y: 521 },
    'Mataburro':                { x: 190, y: 510 },
    // Column 3 (x≈278)
    'Estribos':                 { x: 278, y: 575 },
    'Spoiler':                  { x: 278, y: 564 },
    'Ext. Guardafango':         { x: 278, y: 553 },
    'Ventanas Eléctricas':      { x: 278, y: 542 },
    'Papel Ahumado':            { x: 278, y: 532 },
    'Air Bags':                 { x: 278, y: 521 },
    'Aire Acondicionado':       { x: 278, y: 510 },
    // Column 4 (x≈378)
    'Cierre de ptas. Elect.':   { x: 378, y: 575 },
    'Tapicería de Tela':        { x: 378, y: 564 },
    'Tapicería de Cuero':       { x: 378, y: 553 },
    'Timón de posiciones':      { x: 378, y: 542 },
    'Timón Hidráulico':         { x: 378, y: 532 },
    'Viceras con espejos':      { x: 378, y: 521 },
    'Asiento del. Entero':      { x: 378, y: 510 },
    // Column 5 (x≈472)
    'Cd Player':                { x: 472, y: 575 },
    'R/Cassette':               { x: 472, y: 564 },
    'Bocinas':                  { x: 472, y: 553 },
    'Amplificador':             { x: 472, y: 542 },
    'Ecualizador':              { x: 472, y: 532 },
    'Teléfono':                 { x: 472, y: 521 },
    'DVD':                      { x: 472, y: 510 },
  };

  if (data.tieneExtras) {
    for (const extra of data.extrasSeleccionados) {
      const pos = extrasPositions[extra];
      if (pos) X(pos.x, pos.y);
    }
  }

  // EXTRAS detail text (box below the checkbox grid)
  if (data.tieneExtras && data.extrasDetalle) {
    T(fit(data.extrasDetalle, 95), 145, 434, FSS);
  }

  // ─── PHYSICAL CONDITION TABLE ───────────────────────────────────────
  // From stream: vertical cols left B x=138-169 (center 153), right B x=449-486 (center 467)
  // Row bottom lines: 354.8,342.7,332.4,320.2,310,297.7,285.5,273.2,261,248.8,236.5,224.3,212
  // Text baseline ≈ 3pts above lower line of each row
  if (data.buenEstadoFisico) {
    const rowBottoms = [342.7,332.4,320.2,310,297.7,285.5,273.2,261,248.8,236.5,224.3,212];
    const leftBx = 153;
    const rightBx = 467;
    for (const yb of rowBottoms) {
      X(leftBx, yb + 2);
      X(rightBx, yb + 2);
    }
  }

  // ─── INSURANCE VALUES ─────────────────────────────────────────────
  // The condition table rows (x:138-274 and x:449-587) double as INSURANCE VALUE rows
  // SUMA SOLICITADA is in the row between y=212 and y=203.9 (leftBx area)
  // SUMA RECOMENDADA is in the same Y range (rightBx area)
  // From stream: y=203.9 is the line BELOW the last value row
  // Baseline for SUMA ≈ 174
  T(`$${data.sumaAsegurada}`, 142, 174);
  T(`$${data.sumaAsegurada}`, 452, 174);

  // ─── PREVIOUSLY INSURED ─────────────────────────────────────────────
  // Visual row near bottom section: baseline ≈ 91.
  // SI checkbox after "Si" label (x≈215), NO after "NO" label (x≈340)
  // Compania field starts at x≈440
  if (data.aseguradoAnteriormente) {
    X(232, 91);  // SI checkbox (right after "Si" text)
    if (data.aseguradoraAnterior) {
      T(fit(data.aseguradoraAnterior, 16), 450, 91);  // Compania
    }
  } else {
    X(305, 91);  // NO checkbox (right after "NO" text)
  }

  // ─── OBSERVACIONES ─────────────────────────────────────────────
  // OBSERVACIONES green box
  // Two text lines available inside the box
  if (data.observaciones) {
    T(fit(data.observaciones, 80), 110, 142, FSS);
    if (data.observaciones.length > 80) {
      T(fit(data.observaciones.substring(80), 80), 110, 134, FSS);
    }
  }

  // ─── SIGNATURE & CEDULA (bottom ASEGURADO / CEDULA columns) ─────────
  // From stream: ASEGURADO column x:354-505, CEDULA column x:505-587
  // Bottom label row at y=66.3-79.8 (INSPECTOR | ASEGURADO | CEDULA)
  // Signature goes ABOVE the ASEGURADO label, in the box between y=79.8 and y=89.3/102.8
  // CEDULA text goes in the CEDULA column at same height
  T(data.cedula, 520, 71, FSS);

  if (data.firmaDataUrl) {
    try {
      const base64Data = data.firmaDataUrl
        .replace(/^data:image\/png;base64,/, '')
        .replace(/^data:image\/jpeg;base64,/, '');
      const sigBytes = Buffer.from(base64Data, 'base64');

      let sigImage;
      if (data.firmaDataUrl.includes('image/jpeg')) {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      } else {
        sigImage = await pdfDoc.embedPng(sigBytes);
      }

      // Fit signature into ASEGURADO column area (x:354-505)
      const maxW = 140;
      const maxH = 16;
      const dims = sigImage.scaleToFit(maxW, maxH);

      // Center in ASEGURADO column
      const asgCenterX = 354 + (151 - dims.width) / 2;
      page.drawImage(sigImage, {
        x: asgCenterX,
        y: 71,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('[IS PDF] Error embedding signature:', e);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
