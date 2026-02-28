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
   * ─── Coordinate reference (from PDF content-stream extraction) ─────────────
   * PDF page: 612 × 792 pts (origin = bottom-left)
   *
   * TEXT LABEL POSITIONS (from content stream Tm operators):
   *   y=695.5  Agente / Fecha labels
   *   y=664.7  PROPIETARIO / DIRECCION input blanks  (x:109.4, x:420.5)
   *   y=642.8  CEDULA / D.V. / TELEFONOS blanks     (x:109.4, x:283.0, x:420.5)
   *   y=613.6  COLOR / PLACA / AÑO / TIPO blanks    (x:109.4, x:240.5, x:394.4, x:506.9)
   *   y=592.2  MARCA / MODELO / MOTOR / CHASIS      (x:109.4, x:240.5, x:377.9, x:506.9)
   *   y=570.4  KM / PASAJEROS / COMERCIAL / PART.    (x:109.4, x:259.2, x:355.7, x:472.2, x:568.7)
   *   y=549.0  GAS / DIESEL / AUTO / MANUAL / CIL    (x:109.4, x:171.4, x:276.5, x:377.9, x:472.2, x:568.7)
   *   y=521.3→456.5  Extras checkbox grid (7 rows, step≈10.8pts)
   *             Columns: x:109.4, x:240.5, x:355.7, x:488.0, x:568.7
   *   y=420.0  EXTRAS label;  y=409.3→398.9 extras detail blanks
   *   y=371.4  B(BUENO)-R(REGULAR)... header
   *   y=357.5  B/R/A/RA column headers (left: 151,183,218,250 | right: 465,500,535,565)
   *   y=345.4  First condition row (TAPA DE MOTOR)
   *   y=175.3  SUMA SOLICITADA / SUMA RECOMENDADA labels
   *   y=154.6  OBSERVACIONES header
   *   y=138.6  (Apreciación del Inspector) sub-label
   *   y=91.9   Estuvo asegurado? Si(x:170.9) NO(x:216.6) Compañía(x:294)
   *   y=69.0   INSPECTOR label
   *   y=58.1   ASEGURADO(x:362.3) / CEDULA(x:534.1) labels
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
  // Fecha label at y=695.5 x=377.8; input blank at x≈411+
  T(data.fecha, 420, 695, FSS);

  // ─── ROW 1: PROPIETARIO | DIRECCION ────────────────────────────────────────
  // Input blanks at y=664.7 (x:109.4, x:420.5)
  T(fit(data.propietario, 28), 110, 665);
  T(fit(data.direccion, 22),   421, 665);

  // ─── ROW 2: CEDULA/RUC | D.V. | TELEFONOS ─────────────────────────────────
  // Input blanks at y=642.8 (x:109.4, x:283.0 for D.V., x:420.5)
  T(fit(data.cedula, 18),       110, 643);
  if (data.dv) T(fit(data.dv, 4), 284, 643);
  T(fit(data.telefonos, 22),    421, 643);

  // ─── ROW 3: COLOR | PLACA | AÑO | TIPO ────────────────────────────────────
  // Input blanks at y=613.6 (x:109.4, x:240.5, x:394.4, x:506.9)
  T(fit(data.color, 12),  110, 614);
  T(fit(data.placa, 8),   241, 614);
  T(fit(data.anio, 4),    395, 614);
  T(fit(data.tipo, 12),   507, 614);

  // ─── ROW 4: MARCA | MODELO | MOTOR | CHASIS ───────────────────────────────
  // Input blanks at y=592.2 (x:109.4, x:240.5, x:377.9, x:506.9)
  T(fit(data.marca, 14),   110, 592);
  T(fit(data.modelo, 12),  241, 592);
  T(fit(data.motor, 12),   378, 592);
  T(fit(data.chasis, 14),  507, 592);

  // ─── ROW 5: KILOMETRAJE | PASAJEROS | COMERCIAL | PARTICULAR | TRACCION ───
  // Input blanks at y=570.4 (x:109.4, x:259.2, x:355.7, x:472.2, x:568.7)
  T(fit(data.kilometraje, 10), 110, 570);
  if (data.pasajeros) T(fit(data.pasajeros, 3), 260, 570);
  // PARTICULAR checkbox NOT drawn — template already has it pre-checked

  // ─── ROW 6: GASOLINA | DIESEL | AUTOMATICO | MANUAL | CILINDROS | TONELADAS
  // Input blanks at y=549.0 (x:109.4, x:171.4, x:276.5, x:377.9, x:472.2, x:568.7)
  if (data.tipoCombustible === 'GASOLINA') {
    X(110, 549);
  } else {
    X(172, 549);
  }

  // AUTOMATICO / MANUAL
  if (data.tipoTransmision === 'AUTOMATICO') {
    X(277, 549);
  } else {
    X(378, 549);
  }

  // ─── EXTRAS CHECKBOXES ──────────────────────────────────────────────────────
  // Grid: 5 columns × 7 rows (from content stream blanks)
  // Row Y positions: 521.3, 510.5, 499.7, 488.9, 478.1, 467.3, 456.5
  // Column X positions: 109.4, 240.5, 355.7, 488.0, 568.7
  const extrasPositions: Record<string, { x: number; y: number }> = {
    // Column 1 (x≈110)
    'Alarma de Fca.':           { x: 110, y: 521 },
    'Otra Alarma':              { x: 110, y: 511 },
    'Inmobilizer':              { x: 110, y: 500 },
    'GPS':                      { x: 110, y: 489 },
    'Copas de Lujo':            { x: 110, y: 478 },
    'Rines Magnesio':           { x: 110, y: 467 },
    'Halógenos':                { x: 110, y: 457 },
    // Column 2 (x≈241)
    'Deflector de aire':        { x: 241, y: 521 },
    'Ventana de Techo':         { x: 241, y: 511 },
    'Bola de Trailer':          { x: 241, y: 500 },
    'Retrovisores':             { x: 241, y: 489 },
    'Retrovisores c/señal/luz': { x: 241, y: 478 },
    'Antena Eléctrica':         { x: 241, y: 467 },
    'Mataburro':                { x: 241, y: 457 },
    // Column 3 (x≈356)
    'Estribos':                 { x: 356, y: 521 },
    'Spoiler':                  { x: 356, y: 511 },
    'Ext. Guardafango':         { x: 356, y: 500 },
    'Ventanas Eléctricas':      { x: 356, y: 489 },
    'Papel Ahumado':            { x: 356, y: 478 },
    'Air Bags':                 { x: 356, y: 467 },
    'Aire Acondicionado':       { x: 356, y: 457 },
    // Column 4 (x≈488)
    'Cierre de ptas. Elect.':   { x: 488, y: 521 },
    'Tapicería de Tela':        { x: 488, y: 511 },
    'Tapicería de Cuero':       { x: 488, y: 500 },
    'Timón de posiciones':      { x: 488, y: 489 },
    'Timón Hidráulico':         { x: 488, y: 478 },
    'Viceras con espejos':      { x: 488, y: 467 },
    'Asiento del. Entero':      { x: 488, y: 457 },
    // Column 5 (x≈569)
    'Cd Player':                { x: 569, y: 521 },
    'R/Cassette':               { x: 569, y: 511 },
    'Bocinas':                  { x: 569, y: 500 },
    'Amplificador':             { x: 569, y: 489 },
    'Ecualizador':              { x: 569, y: 478 },
    'Teléfono':                 { x: 569, y: 467 },
    'DVD':                      { x: 569, y: 457 },
  };

  if (data.tieneExtras) {
    for (const extra of data.extrasSeleccionados) {
      const pos = extrasPositions[extra];
      if (pos) X(pos.x, pos.y);
    }
  }

  // EXTRAS detail text (box below the checkbox grid)
  // EXTRAS label at y=420, detail blanks at y≈432/420/409
  if (data.tieneExtras && data.extrasDetalle) {
    T(fit(data.extrasDetalle, 80), 110, 432, FSS);
    if (data.extrasDetalle.length > 80) {
      T(fit(data.extrasDetalle.substring(80), 80), 110, 421, FSS);
    }
  }

  // ─── PHYSICAL CONDITION TABLE ───────────────────────────────────────
  // Exact checkbox positions from PDF content stream (non-uniform spacing)
  // Left B column x=140.4, Right B column x=451.4
  if (data.buenEstadoFisico) {
    const rowYs = [346.7, 334.7, 324.2, 312.2, 301.8, 289.6, 277.3, 265.1, 252.8, 240.6, 228.4, 216.1];
    const leftBx = 141;
    const rightBx = 452;
    for (const y of rowYs) {
      X(leftBx, y);
      X(rightBx, y);
    }
  }

  // ─── INSURANCE VALUES ─────────────────────────────────────────────
  // SUMA SOLICITADA label at y=175.3 x=26.9; SUMA RECOMENDADA at y=175.3 x=294
  // Input fields are to the right of each label
  T(`$${data.sumaAsegurada}`, 142, 175);
  T(`$${data.sumaAsegurada}`, 420, 175);

  // ─── PREVIOUSLY INSURED ─────────────────────────────────────────────
  // y=91.9: "Estuvo asegurado anteriormente?" Si(x:170.9) → blank(x≈185)
  //         NO(x:216.6) → blank(x≈235)  Compañía(x:294) → blank(x≈340)
  if (data.aseguradoAnteriormente) {
    X(192, 92);  // SI checkbox (blank after "Si" text at x=170.9)
    if (data.aseguradoraAnterior) {
      T(fit(data.aseguradoraAnterior, 22), 370, 92);  // Compania
    }
  } else {
    X(240, 92);  // NO checkbox (blank after "NO" text at x=216.6)
  }

  // ─── OBSERVACIONES ─────────────────────────────────────────────
  // OBSERVACIONES header at y=154.6, sub-label "(Apreciación del Inspector)" at y=138.6
  // Text on the 2 underlines inside the green OBSERVACIONES box
  // First underline ~y=140, second underline ~y=129 (11pt line spacing)
  if (data.observaciones) {
    T(fit(data.observaciones, 80), 140, 140, FSS);
    if (data.observaciones.length > 80) {
      T(fit(data.observaciones.substring(80), 80), 140, 129, FSS);
    }
  }

  // ─── SIGNATURE & CEDULA (bottom ASEGURADO / CEDULA columns) ─────────
  // ASEGURADO label at y=58.1 x=362.3; CEDULA label at y=58.1 x=534.1
  // Signature area above ASEGURADO label (y≈65-80)
  // CEDULA text above CEDULA label (y≈65-80)
  T(data.cedula, 530, 68, FSS);

  if (data.firmaDataUrl) {
    try {
      const base64Data = data.firmaDataUrl
        .replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const sigBytes = Buffer.from(base64Data, 'base64');
      console.log('[IS PDF] Signature bytes:', sigBytes.length, 'header:', sigBytes.slice(0, 4).toString('hex'));

      let sigImage;
      if (data.firmaDataUrl.includes('image/jpeg')) {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      } else {
        sigImage = await pdfDoc.embedPng(sigBytes);
      }

      // Fit signature into ASEGURADO column area (x:362-530)
      // ASEGURADO label at y=58.1 — signature should sit above it (y≈62-82)
      const maxW = 140;
      const maxH = 18;
      const dims = sigImage.scaleToFit(maxW, maxH);

      // Center in ASEGURADO column (x:280→500)
      const colStart = 280;
      const colEnd = 500;
      const asgCenterX = colStart + (colEnd - colStart - dims.width) / 2;
      page.drawImage(sigImage, {
        x: asgCenterX,
        y: 62,
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
