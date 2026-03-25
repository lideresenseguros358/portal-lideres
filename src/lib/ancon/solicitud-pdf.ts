/**
 * ANCON Solicitud de Seguro de Automóviles — PDF Generator
 *
 * Overlays filled data onto the official 2-page ANCON template:
 *   public/API ANCON/SOLICITUD AUTO.pdf  (612 × 1008 pts per page)
 *
 * All coordinates (x, yFT) extracted directly from the PDF text content
 * using pdfjs-dist. yFT = distance from top of page in PDF points.
 * y_pdf = 1008 - yFT.
 *
 * Data values are placed ~8–10 pts to the right of the label's right edge,
 * on the same yFT baseline as the label.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface AnconSolicitudData {
  nombreCompleto: string;
  genero: 'M' | 'F';
  fechaNacDia: string;
  fechaNacMes: string;
  fechaNacAnio: string;
  cedula: string;
  paisNacimiento: string;
  nacionalidad: string;
  paisResidencia: string;
  direccionResidencial: string;
  email: string;
  telResidencia: string;
  celular: string;
  estadoCivil: string;
  profesion: string;
  ocupacion: string;
  empresa: string;
  nivelIngreso: string;
  anioVehiculo: string;
  marcaVehiculo: string;
  modeloVehiculo: string;
  tipoVehiculo?: string;
  capacidadVehiculo?: string;
  placa: string;
  motor: string;
  chasis: string;
  valorVehiculo?: string;
  acreedorHipotecario?: string;
  firmaDataUrl?: string;
  fechaEmision?: string;
}

// ── Income checkbox X positions on page 1 ────────────────────────────────────
// Labels extracted via pdfjs:
//   "Menos de 10 mil" x=39, "De 10 mil a 30 mil" x=187  yFT=363
//   "De 30 mil a 50 mil" x=40, "Más 50 mil" x=187       yFT=380
// Checkbox square is drawn BEFORE each label; square width ~8pts, so center at label_x - 5
type IngresoPos = { x: number; yFT: number };
const INGRESO_MAP: Record<string, IngresoPos> = {
  'Menos de $10,000':     { x: 29, yFT: 363 },
  'De $10,000 a $30,000': { x: 178, yFT: 363 },
  'De $30,000 a $50,000': { x: 30, yFT: 380 },
  'Más de $50,000':       { x: 178, yFT: 380 },
  menos_10k:              { x: 29, yFT: 363 },
  '10k_30k':              { x: 178, yFT: 363 },
  '30k_50k':              { x: 30, yFT: 380 },
  mas_50k:                { x: 178, yFT: 380 },
};

export async function generateAnconSolicitudPdf(data: AnconSolicitudData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'API ANCON', 'SOLICITUD AUTO.pdf');
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages  = pdfDoc.getPages();
  const p1     = pages[0]!;
  const p2     = pages[1]!;

  const H        = 1008;
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black    = rgb(0, 0, 0);
  const FS       = 7.5;

  /** Draw text at exact PDF coordinates; yFT = distance from page top */
  const T = (pg: typeof p1, text: string, x: number, yFT: number, size = FS) => {
    if (!text) return;
    pg.drawText(String(text).substring(0, 120), {
      x, y: H - yFT, size, font, color: black,
    });
  };

  /** Draw X checkbox mark */
  const X = (pg: typeof p1, x: number, yFT: number) => {
    pg.drawText('X', { x, y: H - yFT, size: 7, font: fontBold, color: black });
  };

  const fit = (s: string, max: number) => String(s || '').substring(0, max);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — DATOS DEL CONTRATANTE
  // Coordinates: label_x + widthOfTextAtSize(label, 8pt Helvetica) + 4pt gap
  // Label positions verified via pdfjs-dist text extraction
  // ════════════════════════════════════════════════════════════════════════════

  // "Nombre Completo:" end=320 → data x=322
  T(p1, fit(data.nombreCompleto, 38), 322, 160);

  // "Género: M" end=66 → M-checkbox at x=65; "F" end=97 → F-checkbox at x=97
  if (data.genero === 'M') {
    X(p1, 65, 181);
  } else {
    X(p1, 97, 181);
  }

  // Fecha Nacimiento p1 — graphical sub-cells between x=97 and x=365
  // Visual inspection: label "Fecha de Nac/Const:" occupies ~147pts → ends x=244
  // Día cell x=244-282, Mes x=285-321, Año x=324-363
  T(p1, fit(data.fechaNacDia,  2), 248, 181);
  T(p1, fit(data.fechaNacMes,  2), 291, 181);
  T(p1, fit(data.fechaNacAnio, 4), 332, 181);

  // "R.U.C. / Cédula / Pasaporte:" end=472 → data x=474
  T(p1, fit(data.cedula, 18), 474, 182);

  // "País de Nacimiento o Constitución:" end=151 → data x=153
  T(p1, fit(data.paisNacimiento, 16), 153, 198);

  // "Nacionalidad:" end=277 → data x=279
  T(p1, fit(data.nacionalidad, 14), 279, 198);

  // "País de Residencia:" end=434 → data x=436
  T(p1, fit(data.paisResidencia, 14), 436, 198);

  // "Dirección Residencial:" end=105 → data x=107
  T(p1, fit(data.direccionResidencial, 30), 107, 216);

  // "E-mail:" end=388 → data x=390
  T(p1, fit(data.email, 28), 390, 216);

  // "Tel. Residencia:" end=81 → data x=83
  T(p1, fit(data.telResidencia, 16), 83, 234);

  // "Celular:" end=254 → data x=256
  T(p1, fit(data.celular, 16), 256, 232);

  // "Estado civil:" end=407 → data x=409
  T(p1, fit(data.estadoCivil, 16), 409, 232);

  // "Profesión/Actividad Económica:" end=142 → data x=144
  T(p1, fit(data.profesion, 20), 144, 250);

  // "Ocupación Actual:" end=382 → data x=384
  T(p1, fit(data.ocupacion, 18), 384, 251);

  // "Empresa donde Trabaja:" end=117 → data x=119
  T(p1, fit(data.empresa, 22), 119, 270);

  // ── PERFIL FINANCIERO — Ingreso Anual Actividad Principal ─────────────────
  // Checkboxes are small □ boxes to the LEFT of each label
  // "Menos de 10 mil" x=39 → checkbox at x=27  yFT=363
  // "De 10 mil a 30 mil" x=187 → checkbox at x=175  yFT=363
  // "De 30 mil a 50 mil" x=40 → checkbox at x=27  yFT=380
  // "Más 50 mil" x=187 → checkbox at x=175  yFT=380
  const ingresoPos = INGRESO_MAP[data.nivelIngreso];
  if (ingresoPos) {
    X(p1, ingresoPos.x, ingresoPos.yFT);
  }

  // PEP: "No" label x=544, end=556 → checkbox after label at x=558
  X(p1, 558, 399);

  // Lavado: same pattern, yFT=422
  X(p1, 558, 422);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — DATOS DEL ASEGURADO
  // NOTE: Per policy, contratante = asegurado for natural persons.
  // This section is only filled when asegurado differs from contratante.
  // DO NOT fill this section — leave blank.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DESCRIPCIÓN DEL VEHÍCULO ASEGURADO ───────────────────────────────────
  // Column headers yFT=266: Año x=37, Marca x=126, Modelo x=261,
  //                          Tipo x=374, Capacidad x=452, Placa x=544
  // Data row ≈ 18pts below headers → yFT=284
  T(p2, fit(data.anioVehiculo,     4),  37, 284);
  T(p2, fit(data.marcaVehiculo,   14), 126, 284);
  T(p2, fit(data.modeloVehiculo,  14), 261, 284);
  if (data.tipoVehiculo)      T(p2, fit(data.tipoVehiculo, 10),     374, 284);
  if (data.capacidadVehiculo) T(p2, fit(data.capacidadVehiculo, 6), 452, 284);
  T(p2, fit(data.placa, 10), 544, 284);

  // Row 2 headers yFT=302: Uso x=29, Motor x=181, Chasis x=356, Valor x=501
  // Data row ≈ yFT=320
  T(p2, 'PARTICULAR',              29, 320, 7);
  T(p2, fit(data.motor,  20),     185, 320);
  T(p2, fit(data.chasis, 20),     358, 320);
  if (data.valorVehiculo) {
    T(p2, fit(data.valorVehiculo, 12), 501, 320);
  }

  // "Acreedor Hipotecario:" x=23 yFT=359, width≈78 → data_x=105 — solo CC
  if (data.acreedorHipotecario) {
    T(p2, fit(data.acreedorHipotecario, 30), 105, 359);
  }

  // ── FIRMA DEL CONTRATANTE ─────────────────────────────────────────────────
  // "Contratante" label at x=96 yFT=875 (pdfjs confirmed)
  // Signature LINE is drawn at yFT=875; image goes ABOVE → yFT=855 (20pts above line)
  // Contratante column: x=30..270 (before "Corredor" at x=289)
  if (data.firmaDataUrl) {
    try {
      const base64Data = data.firmaDataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const sigBytes   = Buffer.from(base64Data, 'base64');
      const sigImage   = data.firmaDataUrl.includes('image/jp')
        ? await pdfDoc.embedJpg(sigBytes)
        : await pdfDoc.embedPng(sigBytes);

      const maxW = 150;
      const maxH = 25;
      const dims = sigImage.scaleToFit(maxW, maxH);
      p2.drawImage(sigImage, {
        x: 35,
        y: H - 858,
        width:  dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('[ANCON Solicitud PDF] Signature embed error:', e);
    }
  }

  // "Fecha" label x=489 yFT=875 → date value just after label, same baseline
  if (data.fechaEmision) {
    T(p2, data.fechaEmision, 509, 875, 7);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
