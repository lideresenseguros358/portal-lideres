/**
 * DEBUG: ANCON connectivity test
 * GET /api/ancon/debug
 *
 * Tests: token generation + Estandar CC + Estandar DT quotes
 */
import { NextResponse } from 'next/server';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';

export async function GET() {
  const t0 = Date.now();
  const cc = await cotizarEstandar({
    cod_marca: '00122', cod_modelo: '10393', ano: '2023',
    suma_asegurada: '18000', cod_producto: '00312', cedula: '8-888-9999',
    nombre: 'TEST', apellido: 'TEST', vigencia: 'A', email: 'test@lideresenseguros.com',
    tipo_persona: 'N', fecha_nac: '16/06/1994', nuevo: '0',
  });
  const dt = await cotizarEstandar({
    cod_marca: '00122', cod_modelo: '10393', ano: '2023',
    suma_asegurada: '0', cod_producto: '07159', cedula: '8-888-9999',
    nombre: 'TEST', apellido: 'TEST', vigencia: 'A', email: 'test@lideresenseguros.com',
    tipo_persona: 'N', fecha_nac: '16/06/1994', nuevo: '0',
  });
  return NextResponse.json({
    cc: { success: cc.success, noCot: cc.data?.noCotizacion, options: cc.data?.options?.length, error: cc.error },
    dt: { success: dt.success, noCot: dt.data?.noCotizacion, options: dt.data?.options?.length, error: dt.error },
    elapsed: Date.now() - t0,
  });
}
