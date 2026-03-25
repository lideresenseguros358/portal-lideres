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

  // ── Test 1: Exact CURL from Regional (cMarca=74, cModelo=5, edad=53, F, C, PLUS, CC) ──
  console.log('\n── TEST 1: Exact Regional PROD CURL ──');
  const url1 = `${BASE_URL}/regional/auto/cotizar/`;
  const headers1: Record<string, string> = {
    Accept:       'application/json',
    Authorization: basicAuth,
    cToken:       TOKEN,
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
  console.log('URL:', url1);
  console.log('Headers:', JSON.stringify(headers1, null, 2));
  const r1 = await nodeHttpsRequest(url1, 'GET', headers1, undefined, 15000);
  console.log(`Status: ${r1.status}`);
  console.log(`Response: ${r1.text.slice(0, 1000)}`);

  // ── Test 2: Same but RC ──
  console.log('\n── TEST 2: Same vehicle, RC instead ──');
  const headers2 = { ...headers1, cTipoCobert: 'RC', nMontoVeh: '0' };
  const r2 = await nodeHttpsRequest(url1, 'GET', headers2, undefined, 15000);
  console.log(`Status: ${r2.status}`);
  console.log(`Response: ${r2.text.slice(0, 1000)}`);

  // ── Test 3: CC with BASICO endoso ──
  console.log('\n── TEST 3: CC with BASICO endoso ──');
  const headers3 = { ...headers1, cEndoso: 'BASICO' };
  const r3 = await nodeHttpsRequest(url1, 'GET', headers3, undefined, 15000);
  console.log(`Status: ${r3.status}`);
  console.log(`Response: ${r3.text.slice(0, 1000)}`);

  // ── Test 4: Try different endpoint format ──
  console.log('\n── TEST 4: Without trailing slash ──');
  const url4 = `${BASE_URL}/regional/auto/cotizar`;
  const r4 = await nodeHttpsRequest(url4, 'GET', headers1, undefined, 15000);
  console.log(`Status: ${r4.status}`);
  console.log(`Response: ${r4.text.slice(0, 1000)}`);

  // ── Test 5: Lista de endosos ──
  console.log('\n── TEST 5: GET /regional/ws/endosos (catalog) ──');
  const url5 = `${BASE_URL}/regional/ws/endosos`;
  const headers5 = { Authorization: basicAuth };
  const r5 = await nodeHttpsRequest(url5, 'GET', headers5, undefined, 15000);
  console.log(`Status: ${r5.status}`);
  console.log(`Response: ${r5.text.slice(0, 500)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
