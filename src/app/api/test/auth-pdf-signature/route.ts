/**
 * Test route: Generate Authorization PDF with a test signature to verify
 * the signature image is correctly embedded in the "Debida Diligencia" PDF.
 * 
 * GET /api/test/auth-pdf-signature → returns JSON summary, ?download=1 returns PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAuthorizationPdf } from '@/lib/authorization-pdf';
import { generateInspectionPdf } from '@/lib/is/inspection-pdf';

// Minimal valid 2x2 red PNG (for auth PDF test)
const MINI_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIW2P4z8BQDwADAQEA/RUhJQAAAABJRU5ErkJggg==';

// Realistic signature PNG (200x50, cursive-like strokes via sharp SVG→PNG)
const SIGNATURE_PNG = 'data:image/png;base64,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';

export async function GET(request: NextRequest) {
  const download = request.nextUrl.searchParams.get('download') === '1';

  try {
    const testData = {
      nombreCompleto: 'JUAN CARLOS PEREZ GOMEZ',
      cedula: '8-888-1234',
      email: 'test@ejemplo.com',
      direccion: 'Panama, Ciudad de Panama, Calle 50',
      nroPoliza: 'TEST-001-2026',
      marca: 'TOYOTA',
      modelo: 'COROLLA',
      anio: '2026',
      placa: 'AB1234',
      chasis: 'JTDBR32E160123456',
      motor: '1NZ-FE12345',
      color: 'BLANCO',
      firmaDataUrl: MINI_PNG,
      fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      fechaNacimiento: '15/06/1990',
      sexo: 'M',
      estadoCivil: 'soltero',
      telefono: '264-1234',
      celular: '6789-1234',
      actividadEconomica: 'Comercio',
      nivelIngresos: '$1,000 - $3,000',
      dondeTrabaja: 'Empresa Test S.A.',
      esPEP: false,
      tipoCobertura: 'DT',
      insurerName: 'Internacional de Seguros',
      valorAsegurado: '',
      primaAnual: 'B/.130.00',
    };

    console.log('[TEST AUTH PDF] Step 1: generating WITH signature...');
    const t1 = Date.now();
    const pdfWithSig = await generateAuthorizationPdf(testData);
    const d1 = Date.now() - t1;
    console.log('[TEST AUTH PDF] Step 1 done:', pdfWithSig.length, 'bytes in', d1, 'ms');

    console.log('[TEST AUTH PDF] Step 2: generating WITHOUT signature...');
    const t2 = Date.now();
    const pdfNoSig = await generateAuthorizationPdf({ ...testData, firmaDataUrl: '' });
    const d2 = Date.now() - t2;
    console.log('[TEST AUTH PDF] Step 2 done:', pdfNoSig.length, 'bytes in', d2, 'ms');

    const diff = pdfWithSig.length - pdfNoSig.length;
    console.log('[TEST AUTH PDF] Size diff:', diff, 'bytes (positive = signature embedded)');

    // ── Test Inspection PDF signature ──────────────────────────────
    let inspResult: any = { skipped: false };
    try {
      const inspData = {
        propietario: 'JUAN CARLOS PEREZ GOMEZ',
        direccion: 'Panama, Calle 50',
        cedula: '8-888-1234',
        telefonos: '264-1234 / 6789-1234',
        color: 'BLANCO',
        placa: 'AB1234',
        anio: '2026',
        tipo: 'SEDAN',
        marca: 'TOYOTA',
        modelo: 'COROLLA',
        motor: '1NZ-FE12345',
        chasis: 'JTDBR32E160123456',
        kilometraje: '15000',
        pasajeros: '5',
        tipoCombustible: 'GASOLINA' as const,
        tipoTransmision: 'AUTOMATICO' as const,
        buenEstadoFisico: true,
        tieneExtras: false,
        extrasSeleccionados: [],
        extrasDetalle: '',
        sumaAsegurada: '25,000.00',
        aseguradoAnteriormente: false,
        fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        firmaDataUrl: MINI_PNG,
      };

      console.log('[TEST INSP PDF] Step 3: generating inspection WITH signature...');
      const t3 = Date.now();
      const inspWithSig = await generateInspectionPdf(inspData);
      const d3 = Date.now() - t3;
      console.log('[TEST INSP PDF] Step 3 done:', inspWithSig.length, 'bytes in', d3, 'ms');

      console.log('[TEST INSP PDF] Step 4: generating inspection WITHOUT signature...');
      const t4 = Date.now();
      const inspNoSig = await generateInspectionPdf({ ...inspData, firmaDataUrl: '' });
      const d4 = Date.now() - t4;
      console.log('[TEST INSP PDF] Step 4 done:', inspNoSig.length, 'bytes in', d4, 'ms');

      const inspDiff = inspWithSig.length - inspNoSig.length;
      console.log('[TEST INSP PDF] Size diff:', inspDiff, 'bytes');

      inspResult = {
        signatureEmbedded: inspDiff > 0,
        sizeWithSignature: inspWithSig.length,
        sizeWithoutSignature: inspNoSig.length,
        sizeDifference: inspDiff,
        generationTimeWithSig: d3,
        generationTimeWithoutSig: d4,
        note: inspDiff > 0
          ? 'Signature IS being embedded in inspection PDF correctly'
          : 'WARNING: Signature is NOT being embedded in inspection PDF',
      };
    } catch (inspErr: any) {
      console.error('[TEST INSP PDF] Error:', inspErr.message);
      inspResult = { error: inspErr.message };
    }

    // Download inspection PDF for visual review
    if (request.nextUrl.searchParams.get('download') === 'insp') {
      const inspData2 = {
        propietario: 'JUAN CARLOS PEREZ GOMEZ RODRIGUEZ',
        direccion: 'Av. Balboa, Ed. Pacific',
        cedula: '8-888-1234',
        dv: '56',
        telefonos: '264-1234 / 6789-1234',
        color: 'BLANCO PERLA',
        placa: 'AZ9876',
        anio: '2026',
        tipo: 'SEDAN 4PTS',
        marca: 'TOYOTA',
        modelo: 'COROLLA XLE',
        motor: '1NZ-FE1234567',
        chasis: 'JTDBR32E160123456',
        kilometraje: '15,250',
        pasajeros: '5',
        tipoCombustible: 'GASOLINA' as const,
        tipoTransmision: 'AUTOMATICO' as const,
        buenEstadoFisico: true,
        tieneExtras: true,
        extrasSeleccionados: [
          // Column 1
          'Alarma de Fca.', 'Otra Alarma', 'Inmobilizer', 'GPS', 'Copas de Lujo', 'Rines Magnesio', 'Halógenos',
          // Column 2
          'Deflector de aire', 'Ventana de Techo', 'Bola de Trailer', 'Retrovisores', 'Retrovisores c/señal/luz', 'Antena Eléctrica', 'Mataburro',
          // Column 3
          'Estribos', 'Spoiler', 'Ext. Guardafango', 'Ventanas Eléctricas', 'Papel Ahumado', 'Air Bags', 'Aire Acondicionado',
          // Column 4
          'Cierre de ptas. Elect.', 'Tapicería de Tela', 'Tapicería de Cuero', 'Timón de posiciones', 'Timón Hidráulico', 'Viceras con espejos', 'Asiento del. Entero',
          // Column 5
          'Cd Player', 'R/Cassette', 'Bocinas', 'Amplificador', 'Ecualizador', 'Teléfono', 'DVD',
        ],
        extrasDetalle: 'Alarma de fábrica Toyota original, A/C dual zone automático, vidrios eléctricos 4 puertas, sistema GPS integrado con pantalla táctil de 9 pulgadas',
        sumaAsegurada: '35,000.00',
        aseguradoAnteriormente: true,
        aseguradoraAnterior: 'ASSA Compañía de Seg',
        observaciones: 'Vehículo en excelente estado general, sin golpes ni rayones visibles. Pintura original de fábrica, interiores en perfecto estado de conservación.',
        fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        firmaDataUrl: SIGNATURE_PNG,
      };
      const inspPdf = await generateInspectionPdf(inspData2);
      return new NextResponse(new Uint8Array(inspPdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="test_inspeccion_vehicular.pdf"',
        },
      });
    }

    // Download auth PDF
    if (download) {
      return new NextResponse(new Uint8Array(pdfWithSig), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="test_debida_diligencia_con_firma.pdf"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      authorizationPdf: {
        signatureEmbedded: diff > 0,
        sizeWithSignature: pdfWithSig.length,
        sizeWithoutSignature: pdfNoSig.length,
        sizeDifference: diff,
        generationTimeWithSig: d1,
        generationTimeWithoutSig: d2,
        note: diff > 0 
          ? 'Signature IS being embedded in the PDF correctly' 
          : 'WARNING: Signature is NOT being embedded — sizes are identical',
      },
      inspectionPdf: inspResult,
      downloadUrl: '/api/test/auth-pdf-signature?download=1',
    });
  } catch (error: any) {
    console.error('[TEST AUTH PDF] Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    }, { status: 500 });
  }
}
