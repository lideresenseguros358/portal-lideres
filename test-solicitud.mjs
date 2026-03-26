// Pure Node.js ESM script — no tsx, no compilation needed
// Run: node test-solicitud.mjs
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIRMA_TEST = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAeCAYAAADzfUFDAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVRoge3BMQEAAADCoPVP7WsIoAAAeAMBxAABJRU5ErkJggg==';

const H = 1008;
const FS = 7.5;

(async () => {
  const templatePath = path.join(__dirname, 'public', 'API ANCON', 'SOLICITUD AUTO.pdf');
  console.log('Reading template:', templatePath);
  const templateBytes = fs.readFileSync(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages  = pdfDoc.getPages();
  const p1     = pages[0];
  const p2     = pages[1];

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black    = rgb(0, 0, 0);

  const T = (pg, text, x, yFT, size = FS) => {
    if (!text) return;
    pg.drawText(String(text).substring(0, 120), { x, y: H - yFT, size, font, color: black });
  };
  const X = (pg, x, yFT) => {
    pg.drawText('X', { x, y: H - yFT, size: 7, font: fontBold, color: black });
  };
  const fit = (s, max) => String(s || '').substring(0, max);

  // PAGE 1
  T(p1, fit('JUAN PABLO RODRIGUEZ MENDEZ', 38), 322, 160);
  X(p1, 65, 181); // genero M
  T(p1, '15', 248, 181);
  T(p1, '06', 291, 181);
  T(p1, '1985', 332, 181);
  T(p1, '8-123-4567', 474, 182);
  T(p1, 'PANAMA', 153, 198);
  T(p1, 'PANAMENA', 279, 198);
  T(p1, 'PANAMA', 436, 198);
  T(p1, 'CALLE 50 EL CANGREJO PANAMA', 107, 216);
  T(p1, 'test@email.com', 390, 216);
  T(p1, '264-0000', 83, 234);
  T(p1, '6000-0000', 256, 232);
  T(p1, 'SOLTERO', 409, 232);
  T(p1, 'INGENIERO', 144, 250);
  T(p1, 'EMPLEADO', 384, 251);
  T(p1, 'EMPRESA TEST SA', 119, 270);
  X(p1, 178, 363); // De $10,000 a $30,000
  X(p1, 558, 399); // PEP No
  X(p1, 558, 422); // Lavado No

  // PAGE 2
  T(p2, '2022', 37, 284);
  T(p2, 'TOYOTA', 126, 284);
  T(p2, 'COROLLA', 261, 284);
  T(p2, 'SEDAN', 374, 284);
  T(p2, '5', 452, 284);
  T(p2, '123-ABC', 544, 284);
  T(p2, 'PARTICULAR', 29, 320, 7);
  T(p2, 'M12345678', 185, 320);
  T(p2, 'JT2BF3K1X0123456', 358, 320);
  T(p2, 'B/. 18,500.00', 501, 320);
  T(p2, 'BANCO GENERAL SA', 105, 359);

  // Firma
  const base64Data = FIRMA_TEST.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const sigBytes = Buffer.from(base64Data, 'base64');
  const sigImage = await pdfDoc.embedPng(sigBytes);
  const dims = sigImage.scaleToFit(150, 25);
  p2.drawImage(sigImage, { x: 35, y: H - 858, width: dims.width, height: dims.height });

  T(p2, '26/03/2026', 509, 875, 7);

  const pdfBytes = await pdfDoc.save();
  const out = path.join(__dirname, '_test_solicitud_output.pdf');
  fs.writeFileSync(out, pdfBytes);
  console.log(`✅ PDF generado: ${out} (${pdfBytes.length} bytes)`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
