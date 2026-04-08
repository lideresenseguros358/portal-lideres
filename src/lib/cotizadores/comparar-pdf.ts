import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const NAVY = rgb(1/255, 1/255, 57/255);       // #010139
const GREEN = rgb(138/255, 170/255, 25/255);  // #8AAA19
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const DARK_GRAY = rgb(0.3, 0.3, 0.3);
const BLUE_LIGHT = rgb(0.96, 0.96, 0.99);     // Light blue-ish

// Landscape dimensions (wider for better horizontal card layout)
const PAGE_W = 1100;
const PAGE_H = 700;
const MARGIN = 30;
const CARD_MARGIN = 20;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 40;

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

  // Draw cards in horizontal layout (2-3 per row depending on content)
  const cardsPerRow = 2;
  const gridStartY = PAGE_H - HEADER_HEIGHT - MARGIN;
  const cardWidth = (PAGE_W - 2 * MARGIN - (cardsPerRow - 1) * CARD_MARGIN) / cardsPerRow;
  const cardHeight = gridStartY - FOOTER_HEIGHT - MARGIN;

  let cardIndex = 0;
  for (let i = 0; i < Math.min(cardsPerRow, quotesList.length); i++) {
    const quote = quotesList[i];
    if (!quote) continue;
    const x = MARGIN + i * (cardWidth + CARD_MARGIN);
    drawCard(page, font, fontBold, quote, insurerLogos, x, gridStartY - cardHeight, cardWidth, cardHeight);
    cardIndex++;
  }

  // Draw footer
  drawFooter(page, font);
}

function drawHeader(page: PDFPage, font: any, fontBold: any, logoImg: any, pageTitle: string) {
  // White background with bottom border
  page.drawRectangle({
    x: 0,
    y: PAGE_H - HEADER_HEIGHT,
    width: PAGE_W,
    height: HEADER_HEIGHT,
    color: WHITE,
    borderColor: LIGHT_GRAY,
    borderWidth: 2,
  });

  // Logo - preserve aspect ratio (assuming 200x60 original size)
  if (logoImg) {
    const logoWidth = 60;
    const logoHeight = 50;
    page.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - HEADER_HEIGHT + 15,
      width: logoWidth,
      height: logoHeight,
    });
  }

  // Title
  page.drawText('Comparativa de Cobertura Completa', {
    x: MARGIN + 75,
    y: PAGE_H - HEADER_HEIGHT + 40,
    size: 16,
    font: fontBold,
    color: NAVY,
  });

  page.drawText(pageTitle, {
    x: MARGIN + 75,
    y: PAGE_H - HEADER_HEIGHT + 20,
    size: 12,
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
  // Card border and background
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: WHITE,
    borderColor: GRAY,
    borderWidth: 0.5,
  });

  let contentY = y + height - 6;
  const padding = 10;
  const lineHeight = 11;

  // ═══ 1. HEADER (Navy background with logo, name, badge) ═══
  const headerHeight = 45;
  page.drawRectangle({
    x,
    y: contentY - headerHeight,
    width,
    height: headerHeight,
    color: NAVY,
  });

  // Insurer logo (left side of header)
  const insurerKey = quote.insurerName?.toUpperCase();
  let logoX = x + padding;
  if (insurerKey && insurerLogos[insurerKey]) {
    page.drawImage(insurerLogos[insurerKey], {
      x: logoX,
      y: contentY - headerHeight + 8,
      width: 28,
      height: 28,
    });
  }

  // Insurer name + plan type in header
  const planLabel = quote.planType === 'basico' ? 'BÁSICO' : 'PREMIUM';
  const nameAndType = `${quote.insurerName || 'Asegurador'} ${planLabel}`;
  page.drawText(nameAndType, {
    x: logoX + 35,
    y: contentY - headerHeight + 18,
    size: 9,
    font: fontBold,
    color: WHITE,
    maxWidth: width - 60,
  });

  contentY -= headerHeight + 4;

  // ═══ 2. PRICE SECTION (Light blue background) ═══
  const priceBlockHeight = 38;
  page.drawRectangle({
    x,
    y: contentY - priceBlockHeight,
    width,
    height: priceBlockHeight,
    color: BLUE_LIGHT,
  });

  const totalPrice = quote._priceBreakdown?.totalAlContado ?? quote.annualPremium ?? 0;
  const priceText = `$${totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  page.drawText('Al Contado', {
    x: x + padding,
    y: contentY - priceBlockHeight + 25,
    size: 7,
    font: font,
    color: DARK_GRAY,
  });

  page.drawText(priceText, {
    x: x + padding,
    y: contentY - priceBlockHeight + 10,
    size: 13,
    font: fontBold,
    color: NAVY,
  });

  contentY -= priceBlockHeight + 4;

  // ═══ 3. DEDUCTIBLES ═══
  const deductText = formatDeductiblesShort(quote);
  page.drawText(deductText, {
    x: x + padding,
    y: contentY,
    size: 6.5,
    font: font,
    color: GRAY,
    maxWidth: width - 2 * padding,
  });

  contentY -= 10;

  // ═══ 4. COBERTURAS ═══
  page.drawText('Coberturas:', {
    x: x + padding,
    y: contentY,
    size: 8,
    font: fontBold,
    color: NAVY,
  });

  contentY -= lineHeight;

  const coberturas = quote._coberturasDetalladas ?? [];
  for (const cob of coberturas.slice(0, 5)) {
    // Bullet point with inclusion status via color
    const bullet = '•';
    const txt = `${bullet} ${cob.nombre}`;
    const textColor = cob.incluida ? rgb(70/255, 130/255, 70/255) : GRAY; // Green if included, gray if not
    page.drawText(txt, {
      x: x + padding,
      y: contentY,
      size: 6.5,
      font: font,
      color: textColor,
      maxWidth: width - 2 * padding,
    });
    contentY -= lineHeight;
  }

  if (coberturas.length > 5) {
    page.drawText(`+${coberturas.length - 5} coberturas más`, {
      x: x + padding,
      y: contentY,
      size: 6,
      font: font,
      color: GRAY,
    });
    contentY -= lineHeight;
  }

  contentY -= 3;

  // ═══ 5. BENEFICIOS ═══
  const beneficios = quote._beneficios ?? [];
  if (beneficios.length > 0) {
    page.drawText('Beneficios:', {
      x: x + padding,
      y: contentY,
      size: 8,
      font: fontBold,
      color: NAVY,
    });
    contentY -= lineHeight;

    for (const ben of beneficios.slice(0, 3)) {
      const bullet = ben.incluido ? '✔' : '○';
      const txt = `${bullet} ${ben.nombre}`;
      page.drawText(txt, {
        x: x + padding,
        y: contentY,
        size: 6.5,
        font: font,
        color: ben.incluido ? GREEN : GRAY,
        maxWidth: width - 2 * padding,
      });
      contentY -= lineHeight;
    }

    if (beneficios.length > 3) {
      page.drawText(`+${beneficios.length - 3} beneficios más`, {
        x: x + padding,
        y: contentY,
        size: 6,
        font: font,
        color: GRAY,
      });
      contentY -= lineHeight;
    }
  }

  contentY -= 2;

  // ═══ 6. ENDOSOS ═══
  const endosos = quote._endosos ?? [];
  const endosoIncluido = quote._endosoIncluido;

  if (endosos.length > 0 || endosoIncluido) {
    page.drawText('Endosos:', {
      x: x + padding,
      y: contentY,
      size: 8,
      font: fontBold,
      color: NAVY,
    });
    contentY -= lineHeight;

    if (endosoIncluido) {
      page.drawText(`+ ${endosoIncluido}`, {
        x: x + padding,
        y: contentY,
        size: 6.5,
        font: fontBold,
        color: GREEN,
        maxWidth: width - 2 * padding,
      });
      contentY -= lineHeight;
    }

    for (const endoso of endosos.slice(0, 2)) {
      if (endoso.incluido) {
        page.drawText(`+ ${endoso.nombre}`, {
          x: x + padding,
          y: contentY,
          size: 6.5,
          font: font,
          color: GREEN,
          maxWidth: width - 2 * padding,
        });
        contentY -= lineHeight;
      }
    }
  }
}

function formatDeductiblesShort(quote: PDFQuote): string {
  const comp = quote._deduciblesReales?.comprensivo;
  const colis = quote._deduciblesReales?.colisionVuelco;

  const compText = comp ? `Comprensivo: ${comp.label}` : 'Comprensivo: —';
  const colisText = colis ? `Colisión: ${colis.label}` : 'Colisión: —';

  return `${compText}  |  ${colisText}`;
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
