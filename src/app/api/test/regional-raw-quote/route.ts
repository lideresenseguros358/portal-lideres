/**
 * Diagnostic: Raw CC quote with custom codInter to test if codInter:1 returns prima
 * GET /api/test/regional-raw-quote?codinter=1
 */
import { NextRequest, NextResponse } from 'next/server';
import { regionalGet } from '@/lib/regional/http-client';
import { getRegionalCredentials } from '@/lib/regional/config';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const codinter = request.nextUrl.searchParams.get('codinter') || '99';
  const creds = getRegionalCredentials();

  const headerParams: Record<string, string> = {
    cToken:      creds.tokenCC,
    cCodInter:   codinter,
    nEdad:       '53',
    cSexo:       'F',
    cEdocivil:   'C',
    cMarca:      '74',
    cModelo:     '5',
    nAnio:       '2025',
    nMontoVeh:   '12500',
    nLesiones:   '10000',
    nDanios:     '20000',
    nGastosMed:  '2000',
    cEndoso:     'PLUS',
    cTipoCobert: 'CC',
  };

  const res = await regionalGet(
    '/regional/auto/cotizar/',
    undefined,
    { headerParams, headerParamsOnly: true }
  );

  return NextResponse.json({
    codinterUsed: codinter,
    success: res.success,
    status: res.status,
    data: res.data,
    raw: res.raw,
    error: res.error,
  });
}
