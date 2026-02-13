/**
 * IS Inspection PDF Generator
 * Generates the "Informe de Inspección de Vehículos" PDF
 * using pdf-lib to draw text on the template form
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface InspectionPdfData {
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
  tipo: string; // SEDAN, CAMIONETA, VAN, etc.
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
  
  // Signature
  firmaDataUrl?: string; // base64 PNG
  
  // Date
  fecha: string;
}

export async function generateInspectionPdf(data: InspectionPdfData): Promise<Buffer> {
  // Load the template PDF
  const templatePath = path.join(process.cwd(), 'public', 'API INTERNACIONAL', 'formulario-inspeccion-auto.pdf');
  const templateBytes = fs.readFileSync(templatePath);
  
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0]!;
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 8;
  const smallFontSize = 7;
  const black = rgb(0, 0, 0);
  
  const { height } = page.getSize();
  
  // Helper: draw text at approximate form position
  // Coordinates are from bottom-left of PDF page
  const drawText = (text: string, x: number, y: number, size = fontSize, bold = false) => {
    page.drawText(text || '', {
      x,
      y: height - y, // Convert from top-left to bottom-left
      size,
      font: bold ? fontBold : font,
      color: black,
    });
  };
  
  // Helper: draw a checkmark
  const drawCheck = (x: number, y: number) => {
    drawText('✓', x, y, 10, true);
  };
  
  // ═══════════════════════════════════════
  // FILL IN FORM FIELDS
  // ═══════════════════════════════════════
  
  // Fecha (top right area)
  drawText(data.fecha, 430, 82, fontSize);
  
  // PROPIETARIO
  drawText(data.propietario, 155, 112, fontSize);
  
  // DIRECCION
  drawText(data.direccion, 370, 112, fontSize);
  
  // CEDULA/RUC
  drawText(data.cedula, 155, 132, fontSize);
  
  // D.V.
  if (data.dv) {
    drawText(data.dv, 310, 132, fontSize);
  }
  
  // TELEFONOS
  drawText(data.telefonos, 410, 132, fontSize);
  
  // COLOR
  drawText(data.color, 115, 152, fontSize);
  
  // PLACA
  drawText(data.placa, 235, 152, fontSize);
  
  // AÑO
  drawText(data.anio, 370, 152, fontSize);
  
  // TIPO
  drawText(data.tipo, 460, 152, fontSize);
  
  // MARCA
  drawText(data.marca, 115, 172, fontSize);
  
  // MODELO
  drawText(data.modelo, 250, 172, fontSize);
  
  // MOTOR
  drawText(data.motor, 370, 172, fontSize);
  
  // CHASIS
  drawText(data.chasis, 460, 172, fontSize);
  
  // KILOMETRAJE
  drawText(data.kilometraje, 115, 192, fontSize);
  
  // PASAJEROS - leave blank or fill
  if (data.pasajeros) {
    drawText(data.pasajeros, 235, 192, fontSize);
  }
  
  // PARTICULAR checkbox (always checked per requirements)
  drawCheck(430, 190);
  
  // Fuel type checkboxes (GASOLINA / DIESEL)
  if (data.tipoCombustible === 'GASOLINA') {
    drawCheck(100, 210);
  } else {
    drawCheck(175, 210);
  }
  
  // Transmission type (AUTOMATICO / MANUAL)
  if (data.tipoTransmision === 'AUTOMATICO') {
    drawCheck(240, 210);
  } else {
    drawCheck(320, 210);
  }
  
  // ═══════════════════════════════════════
  // EXTRAS CHECKBOXES
  // ═══════════════════════════════════════
  // The extras are laid out in a grid on the form
  // Map extras to approximate checkbox positions
  const extrasPositions: Record<string, { x: number; y: number }> = {
    'Alarma de Fca.': { x: 68, y: 232 },
    'Otra Alarma': { x: 68, y: 242 },
    'Inmobilizer': { x: 68, y: 252 },
    'GPS': { x: 68, y: 262 },
    'Copas de Lujo': { x: 68, y: 272 },
    'Rines Magnesio': { x: 68, y: 282 },
    'Halógenos': { x: 68, y: 292 },
    'Deflector de aire': { x: 175, y: 232 },
    'Ventana de Techo': { x: 175, y: 242 },
    'Bola de Trailer': { x: 175, y: 252 },
    'Retrovisores': { x: 175, y: 262 },
    'Retrovisores c/señal/luz': { x: 175, y: 272 },
    'Antena Eléctrica': { x: 175, y: 282 },
    'Mataburro': { x: 175, y: 292 },
    'Estribos': { x: 280, y: 232 },
    'Spoiler': { x: 280, y: 242 },
    'Ext. Guardafango': { x: 280, y: 252 },
    'Ventanas Eléctricas': { x: 280, y: 262 },
    'Papel Ahumado': { x: 280, y: 272 },
    'Air Bags': { x: 280, y: 282 },
    'Aire Acondicionado': { x: 280, y: 292 },
    'Cierre de ptas. Elect.': { x: 385, y: 232 },
    'Tapicería de Tela': { x: 385, y: 242 },
    'Tapicería de Cuero': { x: 385, y: 252 },
    'Timón de posiciones': { x: 385, y: 262 },
    'Timón Hidráulico': { x: 385, y: 272 },
    'Viceras con espejos': { x: 385, y: 282 },
    'Asiento del. Entero': { x: 385, y: 292 },
    'Cd Player': { x: 485, y: 232 },
    'R/Cassette': { x: 485, y: 242 },
    'Bocinas': { x: 485, y: 252 },
    'Amplificador': { x: 485, y: 262 },
    'Ecualizador': { x: 485, y: 272 },
    'Teléfono': { x: 485, y: 282 },
    'DVD': { x: 485, y: 292 },
  };
  
  if (data.tieneExtras) {
    for (const extra of data.extrasSeleccionados) {
      const pos = extrasPositions[extra];
      if (pos) {
        drawCheck(pos.x, pos.y);
      }
    }
  }
  
  // EXTRAS detail text
  if (data.tieneExtras && data.extrasDetalle) {
    drawText(data.extrasDetalle.substring(0, 80), 135, 318, smallFontSize);
  }
  
  // ═══════════════════════════════════════
  // PHYSICAL CONDITION (B/R/A/RA columns)
  // ═══════════════════════════════════════
  // If buenEstadoFisico = true, mark all items in column B (Bueno)
  // Left column items
  const leftColumnItems = [
    'TAPA DE MOTOR', 'V/PARABRISAS', 'PARRILLA/CAMISA', 'FAROLES',
    'DEFENSA DELANTERA', 'DEFLECTOR DEL.', 'GUARD. DEL. LH',
    'GUARD. TRAS. LH', 'PUERTA DEL. LH', 'PUERTA TRAS. LH',
    'LUCES DIRECC. DEL', 'LAMP. DE DEF. TRAS.',
  ];
  // Right column items
  const rightColumnItems = [
    'TAPA DEL BAUL', 'VIDRIO TRASERO', 'LUCES TRASERAS',
    'DEFENSAS TRASERAS', 'DEFLECTOR TRASERO', 'GUARD. DEL RH',
    'GUARD. TRAS. RH', 'PUERTA DEL. RH', 'PUERTA TRAS. RH',
    'CONDICION DE LAS VENTANAS', 'CONDICION DE LLANTAS',
    'CONDICION GENERAL DEL AUTO',
  ];
  
  if (data.buenEstadoFisico) {
    // Mark B column for all left items (B column is first after label)
    const leftStartY = 365;
    const leftBx = 155; // B column x position for left side
    for (let i = 0; i < leftColumnItems.length; i++) {
      drawCheck(leftBx, leftStartY + i * 13);
    }
    
    // Mark B column for all right items
    const rightBx = 400; // B column x position for right side
    for (let i = 0; i < rightColumnItems.length; i++) {
      drawCheck(rightBx, leftStartY + i * 13);
    }
  }
  
  // SUMA SOLICITADA
  drawText(`$${data.sumaAsegurada}`, 135, 530, fontSize);
  
  // Estuvo asegurado anteriormente
  if (data.aseguradoAnteriormente) {
    drawCheck(225, 575); // Si checkbox
    if (data.aseguradoraAnterior) {
      drawText(data.aseguradoraAnterior, 350, 575, fontSize);
    }
  } else {
    drawCheck(270, 575); // No checkbox
  }
  
  // ═══════════════════════════════════════
  // SIGNATURE
  // ═══════════════════════════════════════
  if (data.firmaDataUrl) {
    try {
      // Convert data URL to bytes
      const base64Data = data.firmaDataUrl.replace(/^data:image\/png;base64,/, '');
      const signatureBytes = Buffer.from(base64Data, 'base64');
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      // Draw signature in the ASEGURADO area (bottom right)
      const sigDims = signatureImage.scale(0.3);
      page.drawImage(signatureImage, {
        x: 340,
        y: height - 600,
        width: Math.min(sigDims.width, 120),
        height: Math.min(sigDims.height, 40),
      });
    } catch (e) {
      console.error('Error embedding signature in PDF:', e);
    }
  }
  
  // CEDULA next to signature
  drawText(data.cedula, 470, 595, fontSize);
  
  // Save and return
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
