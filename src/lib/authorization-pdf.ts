/**
 * Unified PDF Generator — "Debida Diligencia y Autorización"
 * Generates a single document combining:
 *   Section 0: Formulario de Debida Diligencia del Cliente (KYC/AML)
 *   Sections 1-10: Legal clauses (T&C, Veracidad, AML, Aceptación Digital)
 *   Signature block with digital signature image
 *   Page X of Y footer
 *
 * Consent version: 1.0
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import type { DueDiligencePdfData } from '@/lib/pdf/form-mapping';

// ─── Legacy interface (backward compat with send-expediente callers) ────────
export interface AuthorizationPdfData {
  nombreCompleto: string;
  cedula: string;
  email: string;
  direccion: string;
  nroPoliza: string;
  marca: string;
  modelo: string;
  anio: string | number;
  placa: string;
  chasis: string;
  motor: string;
  firmaDataUrl?: string;
  fecha: string;
  // New optional KYC fields (from DueDiligencePdfData)
  fechaNacimiento?: string;
  sexo?: string;
  estadoCivil?: string;
  telefono?: string;
  celular?: string;
  actividadEconomica?: string;
  nivelIngresos?: string;
  dondeTrabaja?: string;
  esPEP?: boolean;
  tipoCobertura?: string;
  insurerName?: string;
  valorAsegurado?: string;
  color?: string;
  primaAnual?: string;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_L = 50;
const MARGIN_R = 50;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const FONT_BODY = 9.5;
const FONT_TITLE = 13;
const FONT_CLAUSE = 10;
const LINE_H_BODY = 14;
const LINE_H_TITLE = 18;
const NAVY = rgb(0.004, 0.004, 0.224);
const GREEN = rgb(0.541, 0.667, 0.098);
const BLACK = rgb(0, 0, 0);

// ─── Helper: wrap text into lines of max `maxWidth` ─────────────────────────
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Page manager: auto-adds new pages ───────────────────────────────────────
class PageManager {
  private doc: PDFDocument;
  private pages: PDFPage[] = [];
  private currentPage!: PDFPage;
  private y: number = 0;
  private font!: PDFFont;
  private fontBold!: PDFFont;

  constructor(doc: PDFDocument, font: PDFFont, fontBold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.fontBold = fontBold;
    this.addPage();
  }

  addPage() {
    const page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(page);
    this.currentPage = page;
    this.y = PAGE_H - 50;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < 60) this.addPage();
  }

  getY() { return this.y; }
  getPage() { return this.currentPage; }

  drawText(text: string, x: number, size: number, color = BLACK, bold = false) {
    this.currentPage.drawText(text, {
      x,
      y: this.y,
      size,
      font: bold ? this.fontBold : this.font,
      color,
    });
  }

  drawWrapped(text: string, x: number, size: number, maxWidth: number, color = BLACK, bold = false, lineH = LINE_H_BODY) {
    const lines = wrapText(text, bold ? this.fontBold : this.font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lineH + 2);
      this.currentPage.drawText(line, { x, y: this.y, size, font: bold ? this.fontBold : this.font, color });
      this.y -= lineH;
    }
    return lines.length;
  }

  moveDown(amount: number) {
    this.y -= amount;
    if (this.y < 60) this.addPage();
  }

  drawLine(x1: number, y: number, x2: number) {
    this.currentPage.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness: 0.5,
      color: NAVY,
    });
  }

  getPageCount() { return this.pages.length; }
  getPages() { return this.pages; }
  getFont() { return this.font; }
  getFontBold() { return this.fontBold; }

  setY(val: number) { this.y = val; }

  drawTableRow(label: string, value: string, labelWidth = 180) {
    this.ensureSpace(LINE_H_BODY + 4);
    const rowY = this.y;
    // Label cell background
    this.currentPage.drawRectangle({
      x: MARGIN_L, y: rowY - 4, width: labelWidth, height: LINE_H_BODY + 4,
      color: rgb(0.94, 0.95, 0.96), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.3,
    });
    // Value cell border
    this.currentPage.drawRectangle({
      x: MARGIN_L + labelWidth, y: rowY - 4, width: CONTENT_W - labelWidth, height: LINE_H_BODY + 4,
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.3,
    });
    this.currentPage.drawText(label, {
      x: MARGIN_L + 4, y: rowY, size: 8, font: this.fontBold, color: NAVY,
    });
    // Truncate value if too long
    const maxValW = CONTENT_W - labelWidth - 8;
    let displayVal = value;
    while (this.font.widthOfTextAtSize(displayVal, 8.5) > maxValW && displayVal.length > 3) {
      displayVal = displayVal.slice(0, -4) + '...';
    }
    this.currentPage.drawText(displayVal, {
      x: MARGIN_L + labelWidth + 4, y: rowY, size: 8.5, font: this.font, color: BLACK,
    });
    this.y -= (LINE_H_BODY + 4);
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateAuthorizationPdf(data: AuthorizationPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pm = new PageManager(doc, font, fontBold);

  // ── HEADER ────────────────────────────────────────────────────────────────
  // Top green bar
  pm.getPage().drawRectangle({ x: 0, y: PAGE_H - 38, width: PAGE_W, height: 38, color: NAVY });
  pm.getPage().drawText('LÍDERES EN SEGUROS, S.A.', {
    x: MARGIN_L, y: PAGE_H - 24, size: 13, font: fontBold, color: rgb(1, 1, 1),
  });
  pm.getPage().drawText('Corredor de Seguros — República de Panamá', {
    x: MARGIN_L, y: PAGE_H - 35, size: 7.5, font, color: rgb(0.8, 0.9, 0.6),
  });
  const rightLabel = `Fecha: ${data.fecha}`;
  const rightLabelW = font.widthOfTextAtSize(rightLabel, 8);
  pm.getPage().drawText(rightLabel, {
    x: PAGE_W - MARGIN_R - rightLabelW, y: PAGE_H - 27, size: 8, font, color: rgb(1, 1, 1),
  });

  pm['y'] = PAGE_H - 58;

  // ── MAIN TITLE ────────────────────────────────────────────────────────────
  pm.ensureSpace(50);
  const mainTitle = 'DEBIDA DILIGENCIA Y AUTORIZACIÓN';
  const t1W = fontBold.widthOfTextAtSize(mainTitle, FONT_TITLE);
  pm.drawText(mainTitle, (PAGE_W - t1W) / 2, FONT_TITLE, NAVY, true);
  pm.moveDown(LINE_H_TITLE);
  const mainTitle2 = 'Líderes en Seguros, S.A. — Corredor de Seguros Autorizado';
  const t2W = font.widthOfTextAtSize(mainTitle2, 9);
  pm.drawText(mainTitle2, (PAGE_W - t2W) / 2, 9, rgb(0.4, 0.4, 0.4), false);
  pm.moveDown(LINE_H_TITLE + 4);

  // Separator
  pm.drawLine(MARGIN_L, pm.getY(), PAGE_W - MARGIN_R);
  pm.moveDown(10);

  // ══════════════════════════════════════════════════════════════════════════
  // SECCIÓN 0: FORMULARIO DE DEBIDA DILIGENCIA DEL CLIENTE (KYC/AML)
  // ══════════════════════════════════════════════════════════════════════════
  pm.ensureSpace(30);
  pm.drawWrapped('SECCIÓN 0: FORMULARIO DE DEBIDA DILIGENCIA DEL CLIENTE (KYC/AML)', MARGIN_L, FONT_CLAUSE, CONTENT_W, NAVY, true, 15);
  pm.moveDown(6);

  // (1) Identificación Básica
  pm.drawWrapped('(1) Identificación Básica', MARGIN_L, 9, CONTENT_W, GREEN, true, 13);
  pm.moveDown(2);
  pm.drawTableRow('Nombres completos', data.nombreCompleto?.toUpperCase() || 'NO SUMINISTRADO');
  pm.drawTableRow('Número de identidad', data.cedula || 'NO SUMINISTRADO');
  pm.drawTableRow('Fecha de nacimiento', data.fechaNacimiento || 'NO SUMINISTRADO');
  pm.drawTableRow('Sexo', data.sexo === 'M' ? 'Masculino' : data.sexo === 'F' ? 'Femenino' : (data.sexo || 'NO SUMINISTRADO'));
  pm.drawTableRow('Estado civil', data.estadoCivil || 'NO SUMINISTRADO');
  pm.drawTableRow('Dirección física', data.direccion || 'NO SUMINISTRADO');
  pm.drawTableRow('Correo electrónico', data.email || 'NO SUMINISTRADO');
  pm.drawTableRow('Teléfono', data.telefono || 'NO SUMINISTRADO');
  if (data.celular) pm.drawTableRow('Celular', data.celular);
  pm.moveDown(8);

  // (2) Perfil Económico y de Fondos
  pm.drawWrapped('(2) Perfil Económico y de Fondos', MARGIN_L, 9, CONTENT_W, GREEN, true, 13);
  pm.moveDown(2);
  pm.drawTableRow('Actividad económica / profesión', data.actividadEconomica || 'NO SUMINISTRADO');
  pm.drawTableRow('Nivel de ingresos mensuales', data.nivelIngresos || 'NO SUMINISTRADO');
  pm.drawTableRow('Lugar donde labora', data.dondeTrabaja || 'NO SUMINISTRADO');
  pm.moveDown(8);

  // (3) Persona Expuesta Políticamente (PEP)
  pm.drawWrapped('(3) Persona Expuesta Políticamente (PEP)', MARGIN_L, 9, CONTENT_W, GREEN, true, 13);
  pm.moveDown(2);
  const pepLabel = '¿Usted, o un familiar cercano, desempeña o ha desempeñado funciones públicas destacadas en los últimos años?';
  pm.drawWrapped(pepLabel, MARGIN_L, 8, CONTENT_W, BLACK, false, 12);
  pm.moveDown(6);
  const pepValue = data.esPEP ? 'SÍ' : 'NO';
  pm.drawTableRow('Respuesta', pepValue);
  pm.moveDown(8);

  // (4) Datos del Vehículo
  pm.drawWrapped('(4) Datos del Vehículo Asegurado', MARGIN_L, 9, CONTENT_W, GREEN, true, 13);
  pm.moveDown(2);
  pm.drawTableRow('Marca', data.marca || 'NO SUMINISTRADO');
  pm.drawTableRow('Modelo', data.modelo || 'NO SUMINISTRADO');
  pm.drawTableRow('Año', String(data.anio || 'NO SUMINISTRADO'));
  if (data.placa) pm.drawTableRow('Placa', data.placa);
  if (data.chasis) pm.drawTableRow('Chasis / VIN', data.chasis);
  if (data.motor) pm.drawTableRow('Motor', data.motor);
  if (data.color) pm.drawTableRow('Color', data.color);
  if (data.valorAsegurado) pm.drawTableRow('Valor asegurado', data.valorAsegurado);
  if (data.tipoCobertura) pm.drawTableRow('Tipo de cobertura', data.tipoCobertura === 'CC' ? 'Cobertura Completa' : data.tipoCobertura === 'DT' ? 'Daños a Terceros' : data.tipoCobertura);
  if (data.insurerName) pm.drawTableRow('Aseguradora', data.insurerName);
  if (data.nroPoliza) pm.drawTableRow('Póliza No.', data.nroPoliza);
  if (data.primaAnual) pm.drawTableRow('Prima anual', data.primaAnual);
  pm.moveDown(10);

  pm.drawLine(MARGIN_L, pm.getY(), PAGE_W - MARGIN_R);
  pm.moveDown(14);

  // ══════════════════════════════════════════════════════════════════════════
  // SECCIONES 1-10: CLÁUSULAS LEGALES — Always start on a new page
  // ══════════════════════════════════════════════════════════════════════════
  pm.addPage();
  pm.drawWrapped('AUTORIZACIÓN, DECLARACIÓN DE VERACIDAD, TRATAMIENTO DE DATOS PERSONALES Y RELEVO DE RESPONSABILIDAD', MARGIN_L, FONT_CLAUSE, CONTENT_W, NAVY, true, 15);
  pm.moveDown(8);

  // ── OPENING PARAGRAPH ────────────────────────────────────────────────────
  const vehiculoDesc = `${data.marca} ${data.modelo} ${data.anio}${data.placa ? `, Placa: ${data.placa}` : ''}${data.chasis ? `, Chasis: ${data.chasis}` : ''}${data.motor ? `, Motor: ${data.motor}` : ''}`;
  const polizaRef = data.nroPoliza ? ` para la póliza No. ${data.nroPoliza}` : '';

  const openingParts = [
    { text: `Yo, `, bold: false },
    { text: data.nombreCompleto.toUpperCase(), bold: true },
    { text: `, mayor de edad, portador(a) de la cédula de identidad personal No. `, bold: false },
    { text: data.cedula, bold: true },
    { text: `, residente en la República de Panamá, con domicilio en `, bold: false },
    { text: data.direccion || 'Panamá', bold: true },
    { text: `, actuando en mi propio nombre y derecho${polizaRef}, en relación con el vehículo: `, bold: false },
    { text: vehiculoDesc, bold: true },
    { text: `; por medio del presente documento declaro, acepto y autorizo expresamente lo siguiente:`, bold: false },
  ];

  // Draw opening as inline mixed bold/regular
  let lineBuffer = '';
  let boldBuffer = '';
  // Build full text then draw wrapped (mixed inline not supported in pdf-lib; draw as single block with highlights)
  let fullOpening = openingParts.map(p => p.text).join('');
  pm.drawWrapped(fullOpening, MARGIN_L, FONT_BODY, CONTENT_W, BLACK, false, LINE_H_BODY);
  pm.moveDown(8);

  // ── CLAUSES ───────────────────────────────────────────────────────────────
  const clauses: Array<{ title: string; paragraphs: Array<string | string[]> }> = [
    {
      title: 'PRIMERA: AUTORIZACIÓN PARA TRATAMIENTO DE DATOS PERSONALES',
      paragraphs: [
        `De conformidad con lo establecido en la Ley 81 de 26 de marzo de 2019 sobre Protección de Datos Personales de la República de Panamá y sus reglamentaciones vigentes, autorizo de manera libre, expresa, informada e inequívoca a LÍDERES EN SEGUROS, S.A., en su condición de corredor de seguros debidamente autorizado conforme a la legislación panameña, para:`,
        [
          'Recopilar, almacenar, organizar, estructurar, conservar, consultar, utilizar, transmitir y/o transferir mis datos personales.',
          'Compartir dicha información con la(s) compañía(s) aseguradora(s) correspondiente(s), reaseguradoras, ajustadores, talleres, proveedores médicos, entidades financieras, pasarelas de pago y cualquier tercero estrictamente necesario para la gestión, cotización, emisión, administración, renovación o cancelación de pólizas.',
          'Realizar validaciones, verificaciones, consultas en bases de datos públicas o privadas y análisis de riesgo necesarios para la suscripción del seguro.',
        ],
        'Declaro conocer que mis datos serán utilizados exclusivamente para fines relacionados con la intermediación y gestión del contrato de seguro.',
      ],
    },
    {
      title: 'SEGUNDA: NATURALEZA DE LA INTERMEDIACIÓN',
      paragraphs: [
        `Reconozco y acepto que LÍDERES EN SEGUROS, S.A. actúa única y exclusivamente en calidad de corredor e intermediario de seguros, conforme a lo dispuesto en el Decreto Ley 12 de 3 de abril de 2012, que regula la actividad de seguros y reaseguros en la República de Panamá. En consecuencia:`,
        [
          'El contrato de seguro se celebra única y exclusivamente entre el cliente y la compañía aseguradora.',
          'El corredor no forma parte del contrato de seguro como asegurador.',
          'Las obligaciones contractuales, coberturas, exclusiones, condiciones, límites y responsabilidades derivan directamente de la póliza emitida por la aseguradora.',
          'El deber del corredor se limita a asesorar, orientar e intermediar de buena fe entre las partes.',
        ],
      ],
    },
    {
      title: 'TERCERA: COMUNICACIONES OFICIALES',
      paragraphs: [
        `Declaro que el correo electrónico suministrado por mí durante el proceso de cotización y emisión, a saber: ${data.email}, será el medio oficial de comunicación para: envío de cotizaciones, envío de pólizas, endosos, renovaciones, avisos de cobro, notificaciones de morosidad, cancelaciones, modificaciones contractuales y cualquier comunicado relevante relacionado con mi póliza. Acepto que:`,
        [
          'Es mi responsabilidad suministrar un correo correcto y funcional.',
          'Es mi obligación revisar periódicamente dicho correo, incluyendo bandejas de spam o correo no deseado.',
          'El corredor no será responsable por errores en la digitación del correo suministrado por mí.',
          'La falta de revisión de mi correo electrónico no invalida notificaciones enviadas correctamente.',
        ],
      ],
    },
    {
      title: 'CUARTA: RESPONSABILIDAD SOBRE PAGOS Y MOROSIDAD',
      paragraphs: [
        `Reconozco que la prima del seguro es una obligación contractual directa entre el cliente y la aseguradora. Aunque el portal permita registrar pagos recurrentes o automatizados, ello no traslada la responsabilidad del pago al corredor. La falta de pago oportuno puede generar cancelación automática de la póliza, suspensión de coberturas y rechazo de reclamos. Declaro que la responsabilidad por morosidad es exclusivamente mía, aun cuando:`,
        [
          'Existan pagos recurrentes registrados.',
          'Haya errores bancarios.',
          'Existan rechazos por fondos insuficientes.',
          'Se produzcan fallas en tarjetas registradas por mí.',
        ],
        'El corredor no garantiza continuidad de cobertura por fallas en medios de pago.',
      ],
    },
    {
      title: 'QUINTA: CLÁUSULA DE DEVOLUCIONES Y CARGOS ADMINISTRATIVOS',
      paragraphs: [
        'Acepto que:',
        [
          'Si por error imputable a mi persona se genera un cobro incorrecto, duplicado o mal gestionado por información suministrada de forma errónea, asumiré totalmente la responsabilidad.',
          'Toda solicitud de reverso o devolución podrá generar cargos administrativos, bancarios y operativos.',
          'Dichos cargos serán descontados del monto a devolver.',
          'El corredor no será responsable por demoras propias del banco, pasarela de pago o aseguradora.',
          'En caso de devoluciones, el tiempo y procedimiento dependerá exclusivamente de las políticas del tercero procesador.',
        ],
      ],
    },
    {
      title: 'SEXTA: RELEVO DE RESPONSABILIDAD',
      paragraphs: [
        `Por medio del presente documento libero y exonero expresamente a LÍDERES EN SEGUROS, S.A., sus directores, agentes, colaboradores y representantes, de cualquier reclamación derivada de:`,
        [
          'Decisiones de suscripción tomadas por la aseguradora.',
          'Rechazos de cobertura.',
          'Aplicación de deducibles.',
          'Exclusiones contractuales.',
          'Cancelaciones por morosidad.',
          'Errores en información suministrada por el cliente.',
          'Fallas en medios de pago proporcionados por el cliente.',
        ],
      ],
    },
    {
      title: 'SÉPTIMA: DECLARACIÓN DE VERACIDAD (INTEGRAL)',
      paragraphs: [
        `Declaro y certifico, bajo la gravedad de juramento, que toda la información suministrada durante este proceso, incluyendo pero no limitándose a: datos personales del asegurado y/o contratante, información del vehículo, fotografías, documentos adjuntos, inspección visual, condiciones del bien asegurado y cualquier otro dato proporcionado de forma escrita, digital o gráfica, es real, exacta, completa y veraz.`,
        `Manifiesto expresamente que no he omitido, alterado ni falseado información alguna que pueda influir directa o indirectamente en la evaluación del riesgo, la aceptación del seguro, la determinación de primas, deducibles, coberturas o condiciones contractuales.`,
        `Reconozco que la presentación de información falsa, inexacta, incompleta u omisiones relevantes constituye riesgo moral, y puede dar lugar, conforme a la legislación vigente de la República de Panamá y a las condiciones generales y particulares de la póliza:`,
        [
          'A la nulidad del contrato de seguro.',
          'A la cancelación de la póliza.',
          'A la pérdida total o parcial de coberturas.',
          'Al rechazo de reclamaciones derivadas de siniestros.',
        ],
        `Acepto que la aseguradora y/o el corredor de seguros podrán verificar, auditar y contrastar la información suministrada en cualquier momento, antes o después de la emisión de la póliza.`,
        `Declaro que he leído, comprendido y aceptado plenamente el contenido de esta declaración, la cual forma parte integral del proceso de emisión del seguro.`,
      ],
    },
    {
      title: 'OCTAVA: DECLARACIÓN DE ORIGEN LÍCITO DE FONDOS Y CUMPLIMIENTO EN MATERIA DE PREVENCIÓN DE BLANQUEO DE CAPITALES',
      paragraphs: [
        `Declaro bajo la gravedad de juramento que:`,
        `Los fondos utilizados para el pago de primas, cargos recurrentes, financiamientos o cualquier otra obligación derivada de la contratación del seguro tienen origen lícito, provienen de actividades legales y no guardan relación directa o indirecta con actividades ilícitas.`,
        `No mantengo vinculación alguna, directa o indirecta, con:`,
        [
          'Actividades de blanqueo de capitales.',
          'Financiamiento del terrorismo.',
          'Proliferación de armas de destrucción masiva.',
          'Narcotráfico.',
          'Delitos financieros.',
          'Corrupción.',
          'Fraude.',
          'Trata de personas.',
          'Delincuencia organizada.',
          'Cualquier otro delito tipificado en la legislación penal de la República de Panamá o en tratados internacionales ratificados por el Estado Panameño.',
        ],
        `No me encuentro incluido en listas restrictivas nacionales o internacionales, incluyendo pero no limitándose a:`,
        [
          'Listas emitidas por la Organización de las Naciones Unidas (ONU).',
          'Listas OFAC (Office of Foreign Assets Control).',
          'Listas de la Unión Europea.',
          'Listas de la Superintendencia de Seguros y Reaseguros de Panamá.',
          'Cualquier otra lista de control aplicable en materia de prevención de blanqueo de capitales.',
        ],
        `No actúo como testaferro, intermediario oculto o representante de terceros cuyos fondos tengan origen ilícito.`,
        `En caso de actuar en representación de una persona jurídica, declaro que la entidad está debidamente constituida, sus beneficiarios finales no están vinculados a actividades ilícitas y los fondos provienen de operaciones comerciales legítimas.`,
      ],
    },
    {
      title: 'NOVENA: FACULTAD DE VERIFICACIÓN, DEBIDA DILIGENCIA Y CONSECUENCIAS',
      paragraphs: [
        `Acepto que, en cumplimiento de la Ley 23 de 27 de abril de 2015 y sus reglamentaciones sobre prevención de blanqueo de capitales, financiamiento del terrorismo y financiamiento de proliferación de armas de destrucción masiva, LÍDERES EN SEGUROS, S.A. podrá:`,
        [
          'Solicitar documentación adicional de identificación.',
          'Requerir información sobre actividad económica.',
          'Verificar identidad mediante validaciones biométricas o documentales.',
          'Consultar bases de datos públicas o privadas.',
          'Suspender temporalmente procesos de emisión si se detectan inconsistencias.',
          'Negarse a intermediar operaciones cuando existan alertas razonables.',
        ],
        `Reconozco que el suministro de información falsa o la omisión de información relevante en materia de origen de fondos podrá dar lugar a:`,
        [
          'Cancelación inmediata del trámite o póliza.',
          'Reporte a las autoridades competentes conforme a la normativa vigente.',
          'Terminación de la relación comercial sin responsabilidad para el corredor.',
          'Conservación de registros como respaldo ante requerimientos regulatorios.',
        ],
        `Me comprometo a notificar cualquier cambio en mi condición financiera, actividad económica o situación legal que pueda impactar el análisis de debida diligencia.`,
      ],
    },
    {
      title: 'DÉCIMA: ACEPTACIÓN DIGITAL',
      paragraphs: [
        `Acepto que la firma digital incorporada en el portal mediante validación electrónica constituye aceptación plena, válida y vinculante del presente documento, conforme a la legislación vigente sobre comercio electrónico en la República de Panamá.`,
      ],
    },
  ];

  for (const clause of clauses) {
    pm.ensureSpace(LINE_H_TITLE + 4);
    pm.drawWrapped(clause.title, MARGIN_L, FONT_CLAUSE, CONTENT_W, NAVY, true, 15);
    pm.moveDown(4);

    for (const para of clause.paragraphs) {
      if (Array.isArray(para)) {
        for (const item of para) {
          pm.ensureSpace(LINE_H_BODY + 2);
          pm.drawWrapped(`• ${item}`, MARGIN_L + 10, FONT_BODY, CONTENT_W - 10, BLACK, false, LINE_H_BODY);
        }
        pm.moveDown(4);
      } else {
        pm.drawWrapped(para, MARGIN_L, FONT_BODY, CONTENT_W, BLACK, false, LINE_H_BODY);
        pm.moveDown(4);
      }
    }
    pm.moveDown(6);
  }

  // ── SIGNATURE BLOCK ───────────────────────────────────────────────────────
  pm.ensureSpace(160);
  pm.moveDown(10);
  pm.drawLine(MARGIN_L, pm.getY(), PAGE_W - MARGIN_R);
  pm.moveDown(14);

  // Title
  pm.drawText('FIRMADO DIGITALMENTE POR:', MARGIN_L, FONT_CLAUSE, NAVY, true);
  pm.moveDown(16);

  // Client info fields
  const fields = [
    { label: 'Nombre completo:', value: data.nombreCompleto.toUpperCase() },
    { label: 'Cédula de identidad:', value: data.cedula },
    { label: 'Correo electrónico:', value: data.email },
    { label: 'Fecha de aceptación:', value: data.fecha },
    ...(data.nroPoliza ? [{ label: 'Número de póliza:', value: data.nroPoliza }] : []),
  ];

  for (const f of fields) {
    pm.ensureSpace(18);
    pm.drawText(f.label, MARGIN_L, FONT_BODY, BLACK, true);
    pm.drawText(f.value, MARGIN_L + 150, FONT_BODY, BLACK, false);
    pm.moveDown(16);
  }

  pm.moveDown(6);

  // Signature image
  if (data.firmaDataUrl) {
    try {
      const base64Data = data.firmaDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imgBytes = Buffer.from(base64Data, 'base64');
      let embeddedImg;
      if (data.firmaDataUrl.startsWith('data:image/png')) {
        embeddedImg = await doc.embedPng(imgBytes);
      } else {
        embeddedImg = await doc.embedJpg(imgBytes);
      }
      const sigW = 160;
      const sigH = 50;
      pm.ensureSpace(sigH + 20);
      pm.getPage().drawImage(embeddedImg, {
        x: MARGIN_L,
        y: pm.getY() - sigH,
        width: sigW,
        height: sigH,
      });
      pm.moveDown(sigH + 8);
      pm.drawLine(MARGIN_L, pm.getY(), MARGIN_L + sigW);
      pm.moveDown(10);
      pm.drawText('Firma digital del declarante', MARGIN_L, 8, rgb(0.4, 0.4, 0.4), false);
      pm.moveDown(16);
    } catch (e) {
      // Skip signature if embedding fails
      pm.drawLine(MARGIN_L, pm.getY(), MARGIN_L + 200);
      pm.moveDown(10);
      pm.drawText('Firma digital del declarante', MARGIN_L, 8, rgb(0.4, 0.4, 0.4), false);
      pm.moveDown(20);
    }
  } else {
    pm.drawLine(MARGIN_L, pm.getY(), MARGIN_L + 200);
    pm.moveDown(10);
    pm.drawText('Firma digital del declarante', MARGIN_L, 8, rgb(0.4, 0.4, 0.4), false);
    pm.moveDown(20);
  }

  // ── FOOTER NOTE ───────────────────────────────────────────────────────────
  pm.ensureSpace(40);
  pm.drawLine(MARGIN_L, pm.getY(), PAGE_W - MARGIN_R);
  pm.moveDown(10);
  pm.drawWrapped(
    'Este documento fue generado electrónicamente por el portal de LÍDERES EN SEGUROS, S.A. La firma digital incorporada constituye aceptación válida conforme a la Ley 51 de 22 de julio de 2008 y normativa de comercio electrónico vigente en la República de Panamá.',
    MARGIN_L, 7.5, CONTENT_W, rgb(0.45, 0.45, 0.45), false, 12,
  );

  // ── PAGE NUMBERS (Página X de Y) + consent version ──────────────────────
  const totalPages = pm.getPageCount();
  const allPages = pm.getPages();
  const footerFont = pm.getFont();
  for (let i = 0; i < totalPages; i++) {
    const page = allPages[i];
    if (!page) continue;
    const pageLabel = `Página ${i + 1} de ${totalPages}`;
    const pageLabelW = footerFont.widthOfTextAtSize(pageLabel, 7.5);
    page.drawText(pageLabel, {
      x: (PAGE_W - pageLabelW) / 2, y: 25, size: 7.5, font: footerFont, color: rgb(0.5, 0.5, 0.5),
    });
    const versionLabel = `Consentimiento v1.0`;
    const versionW = footerFont.widthOfTextAtSize(versionLabel, 6.5);
    page.drawText(versionLabel, {
      x: PAGE_W - MARGIN_R - versionW, y: 25, size: 6.5, font: footerFont, color: rgb(0.65, 0.65, 0.65),
    });
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
