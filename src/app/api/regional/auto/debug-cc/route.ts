/**
 * Diagnostic endpoint for Regional CC cotización
 * GET /api/regional/auto/debug-cc
 *
 * Returns the exact request body sent to Regional + raw response.
 * Used to share with Regional support when debugging ORA errors.
 */

import { NextResponse } from 'next/server';
import { getRegionalBaseUrl, getRegionalCredentials, REGIONAL_CC_ENDPOINTS } from '@/lib/regional/config';

export const maxDuration = 60;

export async function GET() {
  const creds = getRegionalCredentials();
  const baseUrl = getRegionalBaseUrl();
  const endpoint = `${baseUrl}${REGIONAL_CC_ENDPOINTS.COTIZACION}`;

  // Sample body matching API docs exactly (page 3-4)
  const requestBody = {
    cliente: {
      nomter: 'CARLOS',
      apeter: 'LOPEZ',
      edad: 45,
      sexo: 'M',
      edocivil: 'S',
      identificacion: {
        tppersona: 'N',
        tpodoc: 'C',
        prov: null,
        letra: null,
        tomo: null,
        asiento: null,
        dv: null,
        pasaporte: null,
      },
      t1numero: '2900000',
      t2numero: '62900000',
      email: 'test@lideresenseguros.com',
    },
    datosveh: {
      vehnuevo: 'N',
      codmarca: 74,   // TOYOTA (resolved from Regional catalog)
      codmodelo: 1,
      anio: 2022,
      valorveh: 12500,
      numpuestos: 4,
    },
    tpcobert: '1',
    endoso: '2',
    limites: {
      lescor: '10000*20000',
      danpro: '20000',
      gasmed: '2000',
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`,
    codInter: creds.codInter,
    codProv: creds.codInter,
    token: creds.tokenCC,
  };

  // Mask sensitive values for logging
  const maskedHeaders = {
    ...headers,
    Authorization: 'Basic ***',
    token: `${creds.tokenCC.slice(0, 6)}***`,
  };

  console.log('[DEBUG-CC] Endpoint:', endpoint);
  console.log('[DEBUG-CC] Headers (masked):', JSON.stringify(maskedHeaders));
  console.log('[DEBUG-CC] Body:', JSON.stringify(requestBody));

  let rawResponse: string;
  let statusCode: number;

  try {
    const https = await import('node:https');
    const { URL: NodeURL } = await import('node:url');

    const parsed = new NodeURL(endpoint);
    const bodyStr = JSON.stringify(requestBody);

    const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const options: import('node:https').RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(bodyStr).toString(),
        },
        rejectUnauthorized: false,
      };

      const req = https.default.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
        );
        res.on('error', reject);
      });
      req.setTimeout(30000, () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });

    statusCode = result.status;
    rawResponse = result.text;
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      endpoint,
      requestBody,
      headers: maskedHeaders,
    });
  }

  let parsedResponse: unknown = rawResponse;
  try {
    parsedResponse = JSON.parse(rawResponse);
  } catch {
    // non-JSON response
  }

  console.log('[DEBUG-CC] Response status:', statusCode);
  console.log('[DEBUG-CC] Response body:', rawResponse.slice(0, 1000));

  return NextResponse.json({
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    endpoint,
    requestBody,
    headers: maskedHeaders,
    response: parsedResponse,
    responseRaw: rawResponse.slice(0, 2000),
  });
}
