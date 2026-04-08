import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const NAVY = rgb(1/255, 1/255, 57/255);      // #010139
const GREEN = rgb(138/255, 170/255, 25/255); // #8AAA19
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const DARK_GRAY = rgb(0.3, 0.3, 0.3);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 20;
const CARD_MARGIN = 8;
const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 30;

interface PDFQuote {
  insurerName: string;
  planType: 'basico' | 'premium';
  annualPremium: number;
  _priceBreakdown?: {
    totalAlContado?: number;
    totalConTarjeta?: number;
    descuentoProntoPago?: number;
  };
  _deduciblesReales?: {
    comprensivo?: { amount: number; label: string };
    colisionVuelco?: { amount: number; label: string };
  };
  _coberturasDetalladas?: Array<{ nombre: string; incluida: boolean }>;
  _beneficios?: Array<{ nombre: string; incluido: boolean }>;
  _endosos?: Array<{ nombre: string; incluido: boolean }>;
  _endosoIncluido?: string;
  [key: string]: any;
}

export async function generarComparativaPDF(quotes: PDFQuote[], rootDir: string = process.cwd()): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper: Load image from filesystem
  const loadImageFromDisk = async (filePath: string): Promise<any | null> => {
    try {
      const absolutePath = path.join(rootDir, 'public', filePath.replace(/^\//, ''));
      if (!fs.existsSync(absolutePath)) {
        console.warn(`Image not found: ${absolutePath}`);
        return null;
      }
      const imageBytes = fs.readFileSync(absolutePath);
      return imageBytes;
    } catch (err) {
      console.warn(`Could not load image from ${filePath}:`, err);
      return null;
    }
  };

  // Load Lissa logo
  let logoImg: any = null;
  try {
    const logoBytes = await loadImageFromDisk('logo.png');
    if (logoBytes) {
      logoImg = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn('Error embedding logo:', err);
  }

  // Load insurer logos
  const insurerLogos: Record<string, any> = {};
  for (const name of ['fedpa', 'internacional', 'regional', 'ancon']) {
    try {
      const logoBytes = await loadImageFromDisk(`aseguradoras/${name}.png`);
      if (logoBytes) {
        insurerLogos[name.toUpperCase()] = await pdfDoc.embedPng(logoBytes);
      }
    } catch (err) {
      console.warn(`Error embedding ${name} logo:`, err);
    }
  }

  const basicQuotes = quotes.filter(q => q.planType === 'basico');
  const premiumQuotes = quotes.filter(q => q.planType === 'premium');

  await drawPage(pdfDoc, font, fontBold, logoImg, insurerLogos, basicQuotes, 'Planes Básicos');
  await drawPage(pdfDoc, font, fontBold, logoImg, insurerLogos, premiumQuotes, 'Planes Premium');

  return Buffer.from(await pdfDoc.save());
}

async function drawPage(
  pdfDoc: PDFDocument,
  font: any,
  fontBold: any,
  logoImg: any,
  insurerLogos: Record<string, any>,
  quotesList: PDFQuote[],
  pageTitle: string
) {
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // Draw header
  drawHeader(page, font, fontBold, logoImg, pageTitle);

  // Draw 2×2 grid of cards
  const gridStartY = PAGE_H - HEADER_HEIGHT - MARGIN;
  const cardWidth = (PAGE_W - 2 * MARGIN - CARD_MARGIN) / 2;
  const cardHeight = (gridStartY - FOOTER_HEIGHT - CARD_MARGIN) / 2;

  const positions = [
    { x: MARGIN, y: gridStartY - cardHeight, col: 0, row: 0 },
    { x: MARGIN + cardWidth + CARD_MARGIN, y: gridStartY - cardHeight, col: 1, row: 0 },
    { x: MARGIN, y: gridStartY - cardHeight - CARD_MARGIN - cardHeight, col: 0, row: 1 },
    {
      x: MARGIN + cardWidth + CARD_MARGIN,
      y: gridStartY - cardHeight - CARD_MARGIN - cardHeight,
      col: 1,
      row: 1,
    },
  ];

  for (let i = 0; i < Math.min(4, quotesList.length); i++) {
    const quote = quotesList[i];
    const pos = positions[i];
    drawCard(page, font, fontBold, quote, insurerLogos, pos.x, pos.y, cardWidth, cardHeight);
  }

  // Draw footer
  drawFooter(page, font);
}

function drawHeader(page: PDFPage, font: any, fontBold: any, logoImg: any, pageTitle: string) {
  // White background
  page.drawRectangle({
    x: 0,
    y: PAGE_H - HEADER_HEIGHT,
    width: PAGE_W,
    height: HEADER_HEIGHT,
    color: WHITE,
    borderColor: LIGHT_GRAY,
    borderWidth: 1,
  });

  // Logo
  if (logoImg) {
    page.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - HEADER_HEIGHT + 15,
      width: 100,
      height: 30,
    });
  }

  // Title
  page.drawText('Comparativa de Cobertura Completa', {
    x: MARGIN + 110,
    y: PAGE_H - HEADER_HEIGHT + 35,
    size: 14,
    font: fontBold,
    color: NAVY,
  });

  page.drawText(pageTitle, {
    x: MARGIN + 110,
    y: PAGE_H - HEADER_HEIGHT + 18,
    size: 10,
    font: font,
    color: GRAY,
  });
}

function drawCard(
  page: PDFPage,
  font: any,
  fontBold: any,
  quote: PDFQuote,
  insurerLogos: Record<string, any>,
  x: number,
  y: number,
  width: number,
  height: number
) {
  // Card background
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: WHITE,
    borderColor: LIGHT_GRAY,
    borderWidth: 1,
  });

  let contentY = y + height - 8;

  // 1. Header band (NAVY + logo + plan type)
  const headerHeight = 36;
  page.drawRectangle({
    x,
    y: contentY - headerHeight,
    width,
    height: headerHeight,
    color: NAVY,
  });

  // Insurer logo in header (left)
  const insurerKey = quote.insurerName?.toUpperCase();
  if (insurerKey && insurerLogos[insurerKey]) {
    page.drawImage(insurerLogos[insurerKey], {
      x: x + 5,
      y: contentY - headerHeight + 3,
      width: 28,
      height: 28,
    });
  }

  // Insurer name (white text)
  page.drawText(quote.insurerName || 'Asegurador', {
    x: x + 38,
    y: contentY - headerHeight + 15,
    size: 10,
    font: fontBold,
    color: WHITE,
    maxWidth: width - 50,
  });

  // Plan type badge (right)
  const planLabel = quote.planType === 'basico' ? 'BÁSICO' : 'PREMIUM';
  page.drawText(planLabel, {
    x: x + width - 35,
    y: contentY - headerHeight + 15,
    size: 7,
    font: fontBold,
    color: WHITE,
  });

  contentY -= headerHeight + 4;

  // 2. Price block (GREEN background)
  const priceBlock = 30;
  page.drawRectangle({
    x,
    y: contentY - priceBlock,
    width,
    height: priceBlock,
    color: GREEN,
  });

  const totalPrice = quote._priceBreakdown?.totalAlContado ?? quote.annualPremium ?? 0;
  const priceText = `$${totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  page.drawText('Total al Contado', {
    x: x + 5,
    y: contentY - priceBlock + 18,
    size: 7,
    font: font,
    color: WHITE,
  });

  page.drawText(priceText, {
    x: x + 5,
    y: contentY - priceBlock + 6,
    size: 11,
    font: fontBold,
    color: WHITE,
  });

  contentY -= priceBlock + 4;

  // 3. Deductibles
  const deductText = formatDeductibles(quote);
  page.drawText(deductText, {
    x: x + 4,
    y: contentY,
    size: 7,
    font: font,
    color: DARK_GRAY,
    maxWidth: width - 8,
  });

  contentY -= 13;

  // 4. Coberturas (with checkmarks)
  const coberturaLabel = 'Coberturas:';
  page.drawText(coberturaLabel, {
    x: x + 4,
    y: contentY,
    size: 7,
    font: fontBold,
    color: NAVY,
  });

  contentY -= 10;

  const coberturas = quote._coberturasDetalladas ?? [];
  let coberturasShown = 0;
  for (const cob of coberturas.slice(0, 4)) {
    const check = cob.incluida ? '✓' : '✗';
    const txt = `${check} ${cob.nombre}`;
    page.drawText(txt, {
      x: x + 6,
      y: contentY,
      size: 6,
      font: font,
      color: cob.incluida ? rgb(50/255, 100/255, 50/255) : GRAY,
      maxWidth: width - 12,
    });
    contentY -= 8;
    coberturasShown++;
  }

  if (coberturas.length > 4) {
    page.drawText(`+${coberturas.length - 4} más`, {
      x: x + 6,
      y: contentY,
      size: 6,
      font: font,
      color: GRAY,
    });
    contentY -= 8;
  }

  contentY -= 2;

  // 5. Beneficios
  const beneficios = quote._beneficios ?? [];
  if (beneficios.length > 0) {
    const benLabel = 'Beneficios:';
    page.drawText(benLabel, {
      x: x + 4,
      y: contentY,
      size: 7,
      font: fontBold,
      color: NAVY,
    });

    contentY -= 9;

    for (const ben of beneficios.slice(0, 2)) {
      const check = ben.incluido ? '✓' : '✗';
      const txt = `${check} ${ben.nombre}`;
      page.drawText(txt, {
        x: x + 6,
        y: contentY,
        size: 6,
        font: font,
        color: ben.incluido ? rgb(50/255, 100/255, 50/255) : GRAY,
        maxWidth: width - 12,
      });
      contentY -= 8;
    }

    if (beneficios.length > 2) {
      page.drawText(`+${beneficios.length - 2} más`, {
        x: x + 6,
        y: contentY,
        size: 6,
        font: font,
        color: GRAY,
      });
      contentY -= 8;
    }
  }

  contentY -= 2;

  // 6. Endosos (if any)
  const endosos = quote._endosos ?? [];
  const endosoIncluido = quote._endosoIncluido;

  if (endosos.length > 0 || endosoIncluido) {
    const endLabel = 'Endosos:';
    page.drawText(endLabel, {
      x: x + 4,
      y: contentY,
      size: 7,
      font: fontBold,
      color: NAVY,
    });

    contentY -= 9;

    if (endosoIncluido) {
      const endText = `+ ${endosoIncluido}`;
      page.drawText(endText, {
        x: x + 6,
        y: contentY,
        size: 6,
        font: fontBold,
        color: GREEN,
      });
      contentY -= 8;
    }

    for (const endoso of endosos.slice(0, 1)) {
      if (endoso.incluido) {
        const txt = `+ ${endoso.nombre}`;
        page.drawText(txt, {
          x: x + 6,
          y: contentY,
          size: 6,
          font: font,
          color: GREEN,
        });
        contentY -= 8;
      }
    }
  }
}

function formatDeductibles(quote: PDFQuote): string {
  const comp = quote._deduciblesReales?.comprensivo;
  const colis = quote._deduciblesReales?.colisionVuelco;

  const compText = comp ? `Comprensivo: ${comp.label}` : 'Comprensivo: —';
  const colisText = colis ? `Colisión: ${colis.label}` : 'Colisión: —';

  return `${compText} | ${colisText}`;
}

function drawFooter(page: PDFPage, font: any) {
  // Footer background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: FOOTER_HEIGHT,
    color: LIGHT_GRAY,
  });

  // SSRP cintillo
  const footerText =
    'Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá – Licencia PJ750';
  page.drawText(footerText, {
    x: MARGIN,
    y: 8,
    size: 7,
    font: font,
    color: GRAY,
    maxWidth: PAGE_W - 2 * MARGIN,
  });
}
