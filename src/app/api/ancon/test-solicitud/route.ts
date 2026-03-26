/**
 * DEV-ONLY: GET /api/ancon/test-solicitud
 * Generates a sample ANCON Solicitud PDF for visual alignment testing.
 * Returns the PDF inline in the browser.
 */
import { NextResponse } from 'next/server';
import { generateAnconSolicitudPdf } from '@/lib/ancon/solicitud-pdf';

const FIRMA_TEST =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAeCAYAAADzfUFDAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVRoge3BMQEAAADCoPVP7WsIoAAAeAMBxAABJRU5ErkJggg==';

export async function GET() {
  const buf = await generateAnconSolicitudPdf({
    nombreCompleto: 'JUAN PABLO RODRIGUEZ MENDEZ',
    genero: 'M',
    fechaNacDia: '15', fechaNacMes: '06', fechaNacAnio: '1985',
    cedula: '8-123-4567',
    paisNacimiento: 'PANAMA', nacionalidad: 'PANAMENA',
    paisResidencia: 'PANAMA',
    direccionResidencial: 'CALLE 50 EL CANGREJO PANAMA',
    email: 'test@email.com',
    telResidencia: '264-0000', celular: '6000-0000',
    estadoCivil: 'SOLTERO', profesion: 'INGENIERO',
    ocupacion: 'EMPLEADO', empresa: 'EMPRESA TEST SA',
    nivelIngreso: 'De $10,000 a $30,000',
    anioVehiculo: '2022', marcaVehiculo: 'TOYOTA', modeloVehiculo: 'COROLLA',
    tipoVehiculo: 'SEDAN', capacidadVehiculo: '5',
    placa: '123-ABC', motor: 'M12345678', chasis: 'JT2BF3K1X0123456',
    valorVehiculo: 'B/. 18,500.00',
    acreedorHipotecario: 'BANCO GENERAL SA',
    firmaDataUrl: FIRMA_TEST,
    fechaEmision: '26/03/2026',
  });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="test-solicitud-ancon.pdf"',
    },
  });
}
