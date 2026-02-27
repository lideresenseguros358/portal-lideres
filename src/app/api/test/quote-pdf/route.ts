/**
 * GET /api/test/quote-pdf
 * Test route to render the IS Quote PDF with sample data.
 * Returns the PDF directly in the browser for visual inspection.
 */

import { NextResponse } from 'next/server';
import { generateISQuotePdf } from '@/lib/is/quote-pdf';

export async function GET() {
  try {
    // Sample coberturas data mimicking IS API response
    const sampleCoberturas = {
      // Opción 1 — Deducible bajo
      Table: [
        { COBERTURA: 'COMPRENSIVO', LIMITES: '15,000.00', PRIMA1: '450.00', DEDUCIBLE1: '250.00' },
        { COBERTURA: 'COLISION Y VUELCO', LIMITES: '15,000.00', PRIMA1: '620.00', DEDUCIBLE1: '500.00' },
        { COBERTURA: 'RESPONSABILIDAD CIVIL', LIMITES: '25,000.00', PRIMA1: '180.00', DEDUCIBLE1: '' },
        { COBERTURA: 'GASTOS MEDICOS', LIMITES: '5,000.00', PRIMA1: '85.00', DEDUCIBLE1: '' },
        { COBERTURA: 'MUERTE ACCIDENTAL', LIMITES: '10,000.00', PRIMA1: '12.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ASISTENCIA VIAL', LIMITES: 'INCLUIDO', PRIMA1: '0.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ROBO TOTAL', LIMITES: '15,000.00', PRIMA1: '95.00', DEDUCIBLE1: '' },
        { COBERTURA: 'HURTO PARCIAL', LIMITES: '2,000.00', PRIMA1: '40.00', DEDUCIBLE1: '' },
        { COBERTURA: 'EQUIPO ESPECIAL', LIMITES: '1,500.00', PRIMA1: '25.00', DEDUCIBLE1: '' },
        { COBERTURA: 'DAÑOS MALICIOSOS', LIMITES: '5,000.00', PRIMA1: '30.00', DEDUCIBLE1: '' },
      ],
      // Opción 2 — Deducible medio
      Table1: [
        { COBERTURA: 'COMPRENSIVO', LIMITES: '15,000.00', PRIMA1: '380.00', DEDUCIBLE1: '500.00' },
        { COBERTURA: 'COLISION Y VUELCO', LIMITES: '15,000.00', PRIMA1: '510.00', DEDUCIBLE1: '750.00' },
        { COBERTURA: 'RESPONSABILIDAD CIVIL', LIMITES: '25,000.00', PRIMA1: '180.00', DEDUCIBLE1: '' },
        { COBERTURA: 'GASTOS MEDICOS', LIMITES: '5,000.00', PRIMA1: '85.00', DEDUCIBLE1: '' },
        { COBERTURA: 'MUERTE ACCIDENTAL', LIMITES: '10,000.00', PRIMA1: '12.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ASISTENCIA VIAL', LIMITES: 'INCLUIDO', PRIMA1: '0.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ROBO TOTAL', LIMITES: '15,000.00', PRIMA1: '80.00', DEDUCIBLE1: '' },
        { COBERTURA: 'HURTO PARCIAL', LIMITES: '2,000.00', PRIMA1: '35.00', DEDUCIBLE1: '' },
        { COBERTURA: 'EQUIPO ESPECIAL', LIMITES: '1,500.00', PRIMA1: '20.00', DEDUCIBLE1: '' },
        { COBERTURA: 'DAÑOS MALICIOSOS', LIMITES: '5,000.00', PRIMA1: '25.00', DEDUCIBLE1: '' },
      ],
      // Opción 3 — Deducible alto
      Table2: [
        { COBERTURA: 'COMPRENSIVO', LIMITES: '15,000.00', PRIMA1: '310.00', DEDUCIBLE1: '1,000.00' },
        { COBERTURA: 'COLISION Y VUELCO', LIMITES: '15,000.00', PRIMA1: '420.00', DEDUCIBLE1: '1,500.00' },
        { COBERTURA: 'RESPONSABILIDAD CIVIL', LIMITES: '25,000.00', PRIMA1: '180.00', DEDUCIBLE1: '' },
        { COBERTURA: 'GASTOS MEDICOS', LIMITES: '5,000.00', PRIMA1: '85.00', DEDUCIBLE1: '' },
        { COBERTURA: 'MUERTE ACCIDENTAL', LIMITES: '10,000.00', PRIMA1: '12.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ASISTENCIA VIAL', LIMITES: 'INCLUIDO', PRIMA1: '0.00', DEDUCIBLE1: '' },
        { COBERTURA: 'ROBO TOTAL', LIMITES: '15,000.00', PRIMA1: '65.00', DEDUCIBLE1: '' },
        { COBERTURA: 'HURTO PARCIAL', LIMITES: '2,000.00', PRIMA1: '28.00', DEDUCIBLE1: '' },
        { COBERTURA: 'EQUIPO ESPECIAL', LIMITES: '1,500.00', PRIMA1: '15.00', DEDUCIBLE1: '' },
        { COBERTURA: 'DAÑOS MALICIOSOS', LIMITES: '5,000.00', PRIMA1: '20.00', DEDUCIBLE1: '' },
      ],
    };

    const testData = {
      clientName: 'Juan Carlos Pérez González',
      cedula: '8-888-1234',
      email: 'juanperez@ejemplo.com',
      telefono: '6789-0123',
      marca: 'TOYOTA',
      modelo: 'COROLLA',
      anio: 2023,
      valorVehiculo: 15000,
      tipoCobertura: 'CC' as const,
      idCotizacion: '98765',
      nroCotizacion: 12345,
      fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      opcionSeleccionada: 1 as const,
      endosoTexto: 'Endoso Porcelana',
      planType: 'premium',
      allCoberturas: sampleCoberturas,
      apiPrimaTotal: 850.00,
      descuentoFactor: 0.525,
      descuentoPorcentaje: 47.5,
    };

    console.log('[TEST QUOTE PDF] Generating IS quote PDF with sample data...');
    const pdfBuffer = await generateISQuotePdf(testData);
    console.log('[TEST QUOTE PDF] PDF generated:', pdfBuffer.length, 'bytes');

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="test_cotizacion_IS.pdf"',
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    console.error('[TEST QUOTE PDF] Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
