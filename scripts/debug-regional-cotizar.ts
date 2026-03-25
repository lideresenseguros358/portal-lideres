/**
 * debug-regional-cotizar.ts
 * Replicate the EXACT Regional PROD CURL to diagnose empty items response
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

function nodeHttpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : (http as any);
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}) },
      rejectUnauthorized: false,
    };
    const req = lib.request(options, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`timeout`)); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const BASE_URL = process.env.REGIONAL_BASE_URL_PROD!;
  const TOKEN    = process.env.REGIONAL_TOKEN_PROD!;
  const COD_INTER = process.env.REGIONAL_COD_INTER_PROD!;
  const USERNAME  = process.env.REGIONAL_USERNAME_PROD!;
  const PASSWORD  = process.env.REGIONAL_PASSWORD_PROD!;

  const basicAuth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`COD_INTER: ${COD_INTER}`);
  console.log(`TOKEN: ${TOKEN.slice(0,20)}...`);
  console.log(`AUTH: ${basicAuth}`);

  // Skip PROD URL tests (port 7443 blocked) — go straight to DESA URL tests
  console.log('\n(Skipping PROD URL tests — port 7443 blocked from this machine)\n');

  // Use DESA base URL for all tests below
  const DESA_URL2 = process.env.REGIONAL_BASE_URL_DESA || 'https://desa.laregionaldeseguros.com:10443/desaw';
  const DESA_USERNAME2 = process.env.REGIONAL_USERNAME_DESA || 'LIDERES_EN_SEGUROS_99';
  const DESA_PASSWORD2 = process.env.REGIONAL_PASSWORD_DESA || '';
  const desaAuth2 = `Basic ${Buffer.from(`${DESA_USERNAME2}:${DESA_PASSWORD2}`).toString('base64')}`;
  const DESA_TOKEN2 = process.env.REGIONAL_TOKEN_DESA || '';
  console.log(`DESA URL: ${DESA_URL2}`);
  console.log(`DESA TOKEN: ${DESA_TOKEN2.slice(0,20)}...`);
  console.log(`PROD TOKEN: ${TOKEN.slice(0,20)}...`);

  // ── Test 5: Lista de endosos (DESA) ──
  console.log('\n── TEST 5: GET /regional/ws/endosos (DESA catalog) ──');
  const url5 = `${DESA_URL2}/regional/ws/endosos`;
  const headers5 = { Authorization: desaAuth2 };
  const r5 = await nodeHttpsRequest(url5, 'GET', headers5, undefined, 15000);
  console.log(`Status: ${r5.status}`);
  console.log(`Response: ${r5.text.slice(0, 500)}`);

  // ── Test 6: CC cotizar on DESA URL with PROD credentials ──
  console.log('\n── TEST 6: CC cotizar on DESA URL with PROD credentials ──');
  const DESA_URL = process.env.REGIONAL_BASE_URL_DESA || 'https://desa.laregionaldeseguros.com:10443/desaw';
  const DESA_USERNAME = process.env.REGIONAL_USERNAME_DESA || 'LIDERES_EN_SEGUROS_99';
  const DESA_PASSWORD = process.env.REGIONAL_PASSWORD_DESA || '';
  const desaBasicAuth = `Basic ${Buffer.from(`${DESA_USERNAME}:${DESA_PASSWORD}`).toString('base64')}`;
  // Use PROD token with DESA URL
  const url6 = `${DESA_URL}/regional/auto/cotizar/`;
  const headers6: Record<string, string> = {
    Accept:       'application/json',
    Authorization: desaBasicAuth,
    cToken:       TOKEN,  // PROD token
    cCodInter:    COD_INTER,
    nEdad:        '53',
    cSexo:        'F',
    cEdocivil:    'C',
    cMarca:       '74',
    cModelo:      '5',
    nAnio:        '2017',
    nMontoVeh:    '14000',
    nLesiones:    '10000',
    nDanios:      '20000',
    nGastosMed:   '2000',
    cEndoso:      'PLUS',
    cTipoCobert:  'CC',
  };
  console.log('URL:', url6);
  const r6 = await nodeHttpsRequest(url6, 'GET', headers6, undefined, 15000);
  console.log(`Status: ${r6.status}`);
  console.log(`Response: ${r6.text.slice(0, 500)}`);

  // ── Test 7: CC cotizar on DESA URL with DESA credentials + DESA token ──
  console.log('\n── TEST 7: CC cotizar on DESA URL with full DESA credentials ──');
  const DESA_TOKEN = process.env.REGIONAL_TOKEN_DESA || '';
  const url7 = `${DESA_URL}/regional/auto/cotizar/`;
  const headers7: Record<string, string> = {
    Accept:       'application/json',
    Authorization: desaBasicAuth,
    cToken:       DESA_TOKEN,
    cCodInter:    process.env.REGIONAL_COD_INTER_DESA || '99',
    nEdad:        '53',
    cSexo:        'F',
    cEdocivil:    'C',
    cMarca:       '74',
    cModelo:      '5',
    nAnio:        '2017',
    nMontoVeh:    '14000',
    nLesiones:    '10000',
    nDanios:      '20000',
    nGastosMed:   '2000',
    cEndoso:      'PLUS',
    cTipoCobert:  'CC',
  };
  console.log('DESA TOKEN:', DESA_TOKEN.slice(0,20) + '...');
  const r7 = await nodeHttpsRequest(url7, 'GET', headers7, undefined, 15000);
  console.log(`Status: ${r7.status}`);
  console.log(`Response: ${r7.text.slice(0, 500)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
