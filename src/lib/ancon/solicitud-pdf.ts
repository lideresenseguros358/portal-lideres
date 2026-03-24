/**
 * ANCON Solicitud de Seguro de Automóviles — PDF Generator
 *
 * Overlays filled data onto the official 2-page ANCON template:
 *   public/API ANCON/SOLICITUD AUTO.pdf  (612 × 1008 pts per page)
 *
 * Page 1: Datos del Contratante + Perfil Financiero Persona Natural
 * Page 2: Datos del Asegurado (=Contratante) + Vehículo + Firma
 *
 * Coordinate system: PDF origin = bottom-left corner.
 * y_pdf = pageHeight - y_from_top
 *
 * Calibration: images are ~612×990px ≈ PDF 612×1008 pts.
 * Scale factor: 1008/990 ≈ 1.018 — negligible, treat 1:1 from image top.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface AnconSolicitudData {
  // ── Datos del Contratante / Asegurado ──────────────────────────────────
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

  // ── Perfil Financiero ──────────────────────────────────────────────────
  // nivelIngreso: uno de estos valores del dropdown del portal
  nivelIngreso: string; // e.g. "menos_10k" | "10k_30k" | "30k_50k" | "mas_50k"

  // ── Descripción del vehículo ──────────────────────────────────────────
  anioVehiculo: string;
  marcaVehiculo: string;
  modeloVehiculo: string;
  tipoVehiculo?: string;
  capacidadVehiculo?: string;
  placa: string;
  motor: string;
  chasis: string;
  valorVehiculo?: string;   // Solo para CC; vacío para DT

  // ── Acreedor hipotecario ──────────────────────────────────────────────
  acreedorHipotecario?: string; // Solo para CC

  // ── Firma ─────────────────────────────────────────────────────────────
  firmaDataUrl?: string; // base64 PNG data URL

  // ── Fecha de emisión ──────────────────────────────────────────────────
  fechaEmision?: string; // e.g. "24/03/2026"
}

// ── Ingreso anual mapping → checkbox position on page 1 ──────────────────────
// Perfil Financiero Natural — Ingreso Anual Actividad Principal row
// 4 checkboxes in a row. Left to right:
//   "Menos de 10 mil USD anual"   x≈91,  y_from_top≈453
//   "De 10 mil a 30 mil USD anual" x≈183, y_from_top≈453
//   "De 30 mil a 50 mil USD anual" x≈91,  y_from_top≈465
//   "Más de 50 mil USD anual"      x≈183, y_from_top≈465
type IngresoCheckbox = { x: number; yFromTop: number };
const INGRESO_MAP: Record<string, IngresoCheckbox> = {
  menos_10k:  { x: 91,  yFromTop: 453 },
  '10k_30k':  { x: 183, yFromTop: 453 },
  '30k_50k':  { x: 91,  yFromTop: 465 },
  mas_50k:    { x: 183, yFromTop: 465 },
  // Alternative label formats from the portal
  'Menos de $10,000':          { x: 91,  yFromTop: 453 },
  'De $10,000 a $30,000':      { x: 183, yFromTop: 453 },
  'De $30,000 a $50,000':      { x: 91,  yFromTop: 465 },
  'Más de $50,000':            { x: 183, yFromTop: 465 },
};

export async function generateAnconSolicitudPdf(data: AnconSolicitudData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'API ANCON', 'SOLICITUD AUTO.pdf');
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const p1 = pages[0]!;   // Page 1: Contratante + Perfil Financiero
  const p2 = pages[1]!;   // Page 2: Asegurado + Vehículo + Firma

  const H = 1008; // page height in pts

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black    = rgb(0, 0, 0);
  const FS  = 8;
  const FSS = 7;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Draw text at (x, yFromTop) on the given page */
  const T = (pg: typeof p1, text: string, x: number, yFromTop: number, size = FS, bold = false) => {
    if (!text) return;
    pg.drawText(String(text).substring(0, 120), {
      x,
      y: H - yFromTop,
      size,
      font: bold ? fontBold : font,
      color: black,
    });
  };

  /** Draw an X checkbox mark */
  const X = (pg: typeof p1, x: number, yFromTop: number) => {
    pg.drawText('X', { x, y: H - yFromTop, size: 8, font: fontBold, color: black });
  };

  const fit = (text: string, max: number) => String(text || '').substring(0, max);

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 1 — DATOS DEL CONTRATANTE
  // ════════════════════════════════════════════════════════════════════════

  // Row: PERSONA NATURAL checkbox (already pre-checked in template, skip)
  // Nombre Completo
  T(p1, fit(data.nombreCompleto, 35), 300, 148, FS);

  // Género — M/F checkboxes
  // "Género: M □  F □"  M checkbox x≈72 y_from_top≈159, F checkbox x≈90
  if (data.genero === 'M') {
    X(p1, 71, 160);
  } else {
    X(p1, 90, 160);
  }

  // Fecha de nacimiento: Día / Mes / Año
  T(p1, fit(data.fechaNacDia,  2), 183, 160, FS);
  T(p1, fit(data.fechaNacMes,  2), 205, 160, FS);
  T(p1, fit(data.fechaNacAnio, 4), 225, 160, FS);

  // R.U.C. / Cédula / Pasaporte
  T(p1, fit(data.cedula, 20), 430, 160, FS);

  // País de nacimiento / Constitución
  T(p1, fit(data.paisNacimiento, 20), 30,  172, FS);

  // Nacionalidad
  T(p1, fit(data.nacionalidad, 20),   185, 172, FS);

  // País de Residencia
  T(p1, fit(data.paisResidencia, 20), 420, 172, FS);

  // Dirección Residencial
  T(p1, fit(data.direccionResidencial, 50), 30, 183, FS);

  // Email
  T(p1, fit(data.email, 35), 420, 183, FS);

  // Tel. Residencia
  T(p1, fit(data.telResidencia, 18), 30,  195, FS);

  // Celular
  T(p1, fit(data.celular, 18),       280, 195, FS);

  // Estado civil
  T(p1, fit(data.estadoCivil, 18),   420, 195, FS);

  // Profesión/Actividad Económica
  T(p1, fit(data.profesion, 35), 30,  207, FS);

  // Ocupación Actual
  T(p1, fit(data.ocupacion, 30), 420, 207, FS);

  // Empresa donde Trabaja
  T(p1, fit(data.empresa, 35), 30, 219, FS);

  // ── PERFIL FINANCIERO DE PERSONA NATURAL ──────────────────────────────
  // Mark the correct income checkbox (Ingreso Anual Actividad Principal only)
  const ingresoPos = INGRESO_MAP[data.nivelIngreso];
  if (ingresoPos) {
    X(p1, ingresoPos.x, ingresoPos.yFromTop);
  }

  // PEP: always "No" (No □ at x≈520 y_from_top≈478)
  X(p1, 521, 479);

  // Lavado: always "No" (No □ at x≈520 y_from_top≈492)
  X(p1, 521, 492);

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 2 — DATOS DEL ASEGURADO (= mismo contratante para persona N)
  // ════════════════════════════════════════════════════════════════════════

  // Persona Natural checkbox (p2 has same header row)
  // Already pre-printed "X" in template for PERSONA NATURAL — skip

  // Nombre Completo (p2)
  T(p2, fit(data.nombreCompleto, 35), 300, 106, FS);

  // Género (p2)
  if (data.genero === 'M') {
    X(p2, 64, 117);
  } else {
    X(p2, 84, 117);
  }

  // Fecha de nacimiento (p2)
  T(p2, fit(data.fechaNacDia,  2), 175, 117, FS);
  T(p2, fit(data.fechaNacMes,  2), 196, 117, FS);
  T(p2, fit(data.fechaNacAnio, 4), 216, 117, FS);

  // R.U.C. / Cédula (p2)
  T(p2, fit(data.cedula, 20), 430, 117, FS);

  // País de Nacimiento (p2)
  T(p2, fit(data.paisNacimiento, 20), 30,  128, FS);

  // Nacionalidad (p2)
  T(p2, fit(data.nacionalidad, 20),   185, 128, FS);

  // País de Residencia (p2)
  T(p2, fit(data.paisResidencia, 20), 420, 128, FS);

  // Dirección Residencial (p2)
  T(p2, fit(data.direccionResidencial, 50), 30, 140, FS);

  // Email (p2)
  T(p2, fit(data.email, 35), 420, 140, FS);

  // Tel. Residencia (p2)
  T(p2, fit(data.telResidencia, 18), 30,  152, FS);

  // Tel. Oficina (p2) — blank
  // Celular (p2)
  T(p2, fit(data.celular, 18), 410, 152, FS);

  // Estado civil (p2)
  T(p2, fit(data.estadoCivil, 18), 30, 164, FS);

  // Profesión/Actividad Económica (p2)
  T(p2, fit(data.profesion, 35), 295, 164, FS);

  // Ocupación Actual (p2)
  T(p2, fit(data.ocupacion, 30), 30, 176, FS);

  // Empresa (p2)
  T(p2, fit(data.empresa, 35), 295, 176, FS);

  // ── VIGENCIA DE LA PÓLIZA ─────────────────────────────────────────────
  // Skip — ANCON fills this

  // ── DESCRIPCIÓN DEL VEHÍCULO ASEGURADO ──────────────────────────────────
  // Row: Año | Marca | Modelo | Tipo | Capacidad | Placa
  // y_from_top ≈ 265 for the data row (header row ≈ 256)
  T(p2, fit(data.anioVehiculo,    4),  28, 268, FS);
  T(p2, fit(data.marcaVehiculo,  12), 100, 268, FS);
  T(p2, fit(data.modeloVehiculo, 12), 220, 268, FS);
  if (data.tipoVehiculo)    T(p2, fit(data.tipoVehiculo, 10),    370, 268, FS);
  if (data.capacidadVehiculo) T(p2, fit(data.capacidadVehiculo, 6), 460, 268, FS);
  T(p2, fit(data.placa, 10), 540, 268, FS);

  // Row 2: Uso del Vehículo | Número de motor | Número de chasis | Valor del vehículo
  // y_from_top ≈ 280
  T(p2, 'PARTICULAR',               28,  283, FSS);
  T(p2, fit(data.motor,   20),      170, 283, FS);
  T(p2, fit(data.chasis,  20),      360, 283, FS);
  // Valor del vehículo — solo CC
  if (data.valorVehiculo) {
    T(p2, fit(data.valorVehiculo, 12), 500, 283, FS);
  }

  // Acreedor Hipotecario — solo CC
  if (data.acreedorHipotecario) {
    T(p2, fit(data.acreedorHipotecario, 30), 130, 296, FS);
  }

  // ── FIRMA DEL CONTRATANTE (bottom of page 2) ──────────────────────────
  // "Contratante" label at y_from_top ≈ 858
  // Signature area just above — y_from_top ≈ 830-850
  if (data.firmaDataUrl) {
    try {
      const base64Data = data.firmaDataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      const sigBytes = Buffer.from(base64Data, 'base64');

      let sigImage;
      if (data.firmaDataUrl.includes('image/jpeg') || data.firmaDataUrl.includes('image/jpg')) {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      } else {
        sigImage = await pdfDoc.embedPng(sigBytes);
      }

      const maxW = 130;
      const maxH = 22;
      const dims = sigImage.scaleToFit(maxW, maxH);

      // Center in "Contratante" column (x: 30 → 200)
      const sigX = 30 + (170 - dims.width) / 2;
      p2.drawImage(sigImage, {
        x: sigX,
        y: H - 852,
        width: dims.width,
        height: dims.height,
      });
    } catch (e) {
      console.error('[ANCON Solicitud PDF] Error embedding signature:', e);
    }
  }

  // Fecha at bottom
  if (data.fechaEmision) {
    T(p2, data.fechaEmision, 530, 858, FSS);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
