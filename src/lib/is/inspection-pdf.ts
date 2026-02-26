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

  // ─── Helpers ────────────────────────────────────────────────────────────────
  // All (x,y) are already in PDF bottom-left coordinates (calculated from JPG).
  const T = (text: string, x: number, y: number, size = FS, bold = false) => {
    if (!text) return;
    page.drawText(String(text), { x, y, size, font: bold ? fontBold : font, color: black });
  };

  const X = (x: number, y: number) =>
    page.drawText('X', { x, y, size: 9, font: fontBold, color: black });

  // ─── HEADER ─────────────────────────────────────────────────────────────────
  // FECHA  (top right)
  T(data.fecha, 443, 722);

  // ─── CLIENT INFO ────────────────────────────────────────────────────────────
  // PROPIETARIO  |  DIRECCION
  T(data.propietario.substring(0, 35), 151, 684);
  T(data.direccion.substring(0, 25), 397, 684);

  // CEDULA  |  D.V.  |  TELEFONOS
  T(data.cedula, 151, 663);
  if (data.dv) T(data.dv, 299, 663);
  T(data.telefonos.substring(0, 22), 409, 663);

  // ─── VEHICLE INFO ───────────────────────────────────────────────────────────
  // COLOR  |  PLACA  |  AÑO  |  TIPO
  T(data.color.substring(0, 10),  101, 643);
  T(data.placa,                   227, 643);
  T(data.anio,                    360, 643);
  T(data.tipo.substring(0, 10),   460, 643);

  // MARCA  |  MODELO  |  MOTOR  |  CHASIS
  T(data.marca.substring(0, 12),  101, 622);
  T(data.modelo.substring(0, 12), 227, 622);
  T(data.motor.substring(0, 12),  360, 622);
  T(data.chasis.substring(0, 12), 460, 622);

  // KILOMETRAJE  |  PASAJEROS  |  PARTICULAR checkbox
  T(data.kilometraje, 101, 601);
  if (data.pasajeros) T(data.pasajeros, 247, 601);
  X(441, 601);  // PARTICULAR always checked

  // GASOLINA / DIESEL
  if (data.tipoCombustible === 'GASOLINA') {
    X(83, 580);
  } else {
    X(158, 580);
  }

  // AUTOMATICO / MANUAL
  if (data.tipoTransmision === 'AUTOMATICO') {
    X(223, 580);
  } else {
    X(299, 580);
  }

  // ─── EXTRAS CHECKBOXES ──────────────────────────────────────────────────────
  // Grid: 5 columns × 7 rows. Checkbox x positions per column,
  // row y positions start at 562 and decrease by 20 each row.
  const extrasPositions: Record<string, { x: number; y: number }> = {
    // Column 1  (x=29)
    'Alarma de Fca.':           { x: 29, y: 562 },
    'Otra Alarma':              { x: 29, y: 542 },
    'Inmobilizer':              { x: 29, y: 522 },
    'GPS':                      { x: 29, y: 502 },
    'Copas de Lujo':            { x: 29, y: 482 },
    'Rines Magnesio':           { x: 29, y: 462 },
    'Halógenos':                { x: 29, y: 441 },
    // Column 2  (x=162)
    'Deflector de aire':        { x: 162, y: 562 },
    'Ventana de Techo':         { x: 162, y: 542 },
    'Bola de Trailer':          { x: 162, y: 522 },
    'Retrovisores':             { x: 162, y: 502 },
    'Retrovisores c/señal/luz': { x: 162, y: 482 },
    'Antena Eléctrica':         { x: 162, y: 462 },
    'Mataburro':                { x: 162, y: 441 },
    // Column 3  (x=266)
    'Estribos':                 { x: 266, y: 562 },
    'Spoiler':                  { x: 266, y: 542 },
    'Ext. Guardafango':         { x: 266, y: 522 },
    'Ventanas Eléctricas':      { x: 266, y: 502 },
    'Papel Ahumado':            { x: 266, y: 482 },
    'Air Bags':                 { x: 266, y: 462 },
    'Aire Acondicionado':       { x: 266, y: 441 },
    // Column 4  (x=358)
    'Cierre de ptas. Elect.':   { x: 358, y: 562 },
    'Tapicería de Tela':        { x: 358, y: 542 },
    'Tapicería de Cuero':       { x: 358, y: 522 },
    'Timón de posiciones':      { x: 358, y: 502 },
    'Timón Hidráulico':         { x: 358, y: 482 },
    'Viceras con espejos':      { x: 358, y: 462 },
    'Asiento del. Entero':      { x: 358, y: 441 },
    // Column 5  (x=457)
    'Cd Player':                { x: 457, y: 562 },
    'R/Cassette':               { x: 457, y: 542 },
    'Bocinas':                  { x: 457, y: 522 },
    'Amplificador':             { x: 457, y: 502 },
    'Ecualizador':              { x: 457, y: 482 },
    'Teléfono':                 { x: 457, y: 462 },
    'DVD':                      { x: 457, y: 441 },
  };

  if (data.tieneExtras) {
    for (const extra of data.extrasSeleccionados) {
      const pos = extrasPositions[extra];
      if (pos) X(pos.x, pos.y);
    }
  }

  // EXTRAS detail text (below extras grid)
  if (data.tieneExtras && data.extrasDetalle) {
    T(data.extrasDetalle.substring(0, 90), 120, 418, FSS);
  }

  // ─── PHYSICAL CONDITION TABLE ───────────────────────────────────────────────
  // Columns: B(Bueno) R(Regular) A(Abollado) RA(Rayado/Roto)
  // B column x: left side=155, right side=403
  // Rows start at y=457 and decrease by 18 per row (12 rows each side)
  if (data.buenEstadoFisico) {
    const condStartY = 457;
    const condRowH = 18;
    const leftBx = 155;
    const rightBx = 403;
    for (let i = 0; i < 12; i++) {
      const y = condStartY - i * condRowH;
      X(leftBx, y);
      X(rightBx, y);
    }
  }

  // ─── INSURANCE VALUES ───────────────────────────────────────────────────────
  // FECHA COMPRA DEL AUTO  |  VALOR ORIGINAL  |  VALOR DE COMPRA
  // (leave blank — not always known)

  // SUMA SOLICITADA
  T(`$${data.sumaAsegurada}`, 126, 295);

  // SUMA RECOMENDADA (same as requested)
  T(`$${data.sumaAsegurada}`, 378, 295);

  // ─── PREVIOUSLY INSURED ─────────────────────────────────────────────────────
  if (data.aseguradoAnteriormente) {
    X(209, 254);  // SI checkbox
    if (data.aseguradoraAnterior) {
      T(data.aseguradoraAnterior.substring(0, 20), 378, 254);
    }
  } else {
    X(250, 254);  // NO checkbox
  }

  // ─── SIGNATURE ──────────────────────────────────────────────────────────────
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

      // Fit signature into a 120×35 box at ASEGURADO field
      const maxW = 120;
      const maxH = 35;
      const dims = sigImage.scaleToFit(maxW, maxH);

      page.drawImage(sigImage, {
        x: 396,
        y: 205,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('[IS PDF] Error embedding signature:', e);
    }
  }

  // CEDULA next to ASEGURADO label
  T(data.cedula, 518, 205);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
