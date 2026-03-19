/**
 * SOAP HTTP Client for Aseguradora ANCON
 * Handles SOAP envelope creation, token management, and response parsing
 *
 * IMPORTANT: Next.js Turbopack creates separate module instances per API route.
 * ANCON invalidates old tokens when GenerarToken is called, so if two routes
 * each generate their own token, they destroy each other's sessions.
 * We solve this by sharing the token via a temp file + in-memory cache so ALL
 * routes reuse the same token.
 */

import {
  ANCON_SOAP_URL,
  ANCON_AUTH_METHODS,
  getAnconCredentials,
  TOKEN_TTL_MS,
  RETRY_CONFIG,
} from './config';
import type { AnconLoginResponse, AnconSoapResponse } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ═══ Cross-Worker Token Cache (file-based + in-memory) ═══

const TOKEN_FILE = path.join(os.tmpdir(), 'ancon-token.json');

interface TokenData {
  token: string;
  expiresAt: number;
}

// In-memory fast cache (per module instance)
let memToken: string | null = null;
let memExpiresAt = 0;

function readTokenFile(): TokenData | null {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    const data = JSON.parse(raw) as TokenData;
    if (data.token && data.expiresAt > Date.now()) return data;
  } catch { /* file missing or corrupt — ignore */ }
  return null;
}

function writeTokenFile(token: string, expiresAt: number): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiresAt }), 'utf8');
  } catch (e) {
    console.warn('[ANCON] Could not write token file:', e);
  }
}

function clearTokenFile(): void {
  try { fs.unlinkSync(TOKEN_FILE); } catch { /* ignore */ }
}

/**
 * Get a valid ANCON token, refreshing if expired.
 * Checks in-memory cache first, then file cache, then generates new.
 */
export async function getAnconToken(): Promise<string> {
  // 1. In-memory cache (fastest, same module instance)
  if (memToken && Date.now() < memExpiresAt) {
    return memToken;
  }

  // 2. File cache (cross-worker — another route may have generated one)
  const fileData = readTokenFile();
  if (fileData) {
    memToken = fileData.token;
    memExpiresAt = fileData.expiresAt;
    console.log(`[ANCON] Token loaded from file cache: ${memToken.substring(0, 16)}...`);
    return memToken;
  }

  // 3. Generate new token
  console.log('[ANCON] Generating new token...');
  const creds = getAnconCredentials();

  const result = await soapCall<AnconLoginResponse>(
    ANCON_AUTH_METHODS.GENERAR_TOKEN,
    {
      par_usuario: creds.usuario,
      par_password: creds.password,
    },
    true // skipAuth — don't try to get token recursively
  );

  if (!result.success || !result.data) {
    throw new Error(`ANCON token generation failed: ${result.error || 'Unknown error'}`);
  }

  const login = result.data.Login?.[0];
  if (!login?.Token) {
    const msg = login?.Usuario || 'No token in response';
    throw new Error(`ANCON login failed: ${msg}`);
  }

  memToken = login.Token;
  memExpiresAt = Date.now() + TOKEN_TTL_MS;
  writeTokenFile(memToken, memExpiresAt);
  console.log(`[ANCON] Token obtained: ${memToken.substring(0, 16)}... (TTL: ${TOKEN_TTL_MS / 60000}min)`);

  return memToken;
}

/**
 * Invalidate the cached token (e.g. after "Token Inactivo" error).
 * Clears both in-memory and file caches.
 */
export function invalidateAnconToken(): void {
  memToken = null;
  memExpiresAt = 0;
  clearTokenFile();
}

// ═══ SOAP Envelope Builder ═══

function buildSoapEnvelope(method: string, params: Record<string, string>): string {
  const paramsXml = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escapeXml(String(v))}</${k}>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">
  <soap:Body>
    <tns:${method}>${paramsXml}</tns:${method}>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ═══ SOAP Response Parser ═══

function parseSoapResponse(xml: string): unknown {
  // Try to extract data from known SOAP response patterns
  // Pattern 1: <return xsi:type="xsd:string">JSON</return>
  let match = xml.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  // Pattern 2: <data xsi:type="xsd:string">JSON</data>
  if (!match) match = xml.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  // Pattern 3: Entire response body between ns1 tags
  if (!match) match = xml.match(/<ns1:\w+Response[^>]*>([\s\S]*?)<\/ns1:\w+Response>/);

  if (!match) return xml;

  // Decode HTML entities
  let decoded = match[1]!
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");

  // Try to extract JSON from decoded string
  const jsonMatch = decoded.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]!);
    } catch {
      // Fall through
    }
  }

  // Return decoded string if no JSON found
  return decoded.trim() || xml;
}

// ═══ Core SOAP Call ═══

export async function soapCall<T = unknown>(
  method: string,
  params: Record<string, string>,
  skipAuth = false
): Promise<AnconSoapResponse<T>> {
  // Build body inside loop so token refreshes produce a new envelope
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    const body = buildSoapEnvelope(method, params);

    try {
      console.log(
        `[ANCON] SOAP ${method}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`
      );

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(ANCON_SOAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: `urn:server_otros#${method}`,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const text = await res.text();

      if (!res.ok) {
        console.error(`[ANCON] SOAP ${method} → ${res.status}`);
        if (attempt < RETRY_CONFIG.maxRetries) {
          await sleep(RETRY_CONFIG.baseDelays[attempt] ?? 3000);
          continue;
        }
        return { success: false, error: `HTTP ${res.status}`, raw: text };
      }

      const data = parseSoapResponse(text);

      // Check for "Token Inactivo" error (check both parsed data and raw text)
      if (isTokenInactive(data) || text.includes('Token Inactivo')) {
        if (!skipAuth) {
          console.log(`[ANCON] Token inactive for ${method}, refreshing...`);
          invalidateAnconToken();
          const newToken = await getAnconToken();
          console.log(`[ANCON] New token: ${newToken.substring(0, 16)}...`);
          // Update params in place so next iteration rebuilds envelope with fresh token
          if ('token' in params) params.token = newToken;
          if ('par_token' in params) params.par_token = newToken;
          skipAuth = true; // only retry once
          continue; // re-enter loop → rebuilds body with updated params
        }
        console.error(`[ANCON] ${method} still returns Token Inactivo after refresh`);
        return { success: false, error: 'Token Inactivo' };
      }

      console.log(`[ANCON] SOAP ${method} → OK`);
      return { success: true, data: data as T, raw: data };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ANCON] SOAP ${method} ERROR: ${errMsg}`);

      if (attempt < RETRY_CONFIG.maxRetries) {
        await sleep(RETRY_CONFIG.baseDelays[attempt] ?? 3000);
        continue;
      }

      return { success: false, error: errMsg };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Convenience: SOAP call that auto-injects a valid token.
 *
 * Generates a fresh token, calls the method, and if "Token Inactivo" is
 * returned (e.g. another worker invalidated our token), generates a NEW
 * token in-line and retries once. Uses skipAuth=true on soapCall to avoid
 * double-refresh conflicts.
 */
export async function anconCall<T = unknown>(
  method: string,
  params: Record<string, string> = {}
): Promise<AnconSoapResponse<T>> {
  // Attempt 1: use cached-or-fresh token
  // IMPORTANT: token MUST be the first XML param — ANCON's PHP SOAP parser is order-sensitive
  let token = await getAnconToken();
  let result = await soapCall<T>(method, { token, ...params }, true);

  // If "Token Inactivo", another worker may have generated a newer token.
  // Re-read file cache first; only generate new if file is also stale.
  if (!result.success && result.error === 'Token Inactivo') {
    console.log(`[ANCON] anconCall ${method}: Token Inactivo, checking file cache...`);
    // Clear in-memory cache so getAnconToken re-reads the file
    memToken = null;
    memExpiresAt = 0;
    const fileToken = await getAnconToken(); // reads file → may find a newer token
    if (fileToken !== token) {
      // Another worker generated a valid token — use it
      console.log(`[ANCON] anconCall ${method}: Found newer token in file cache`);
      token = fileToken;
      result = await soapCall<T>(method, { token, ...params }, true);
    }
    // If still failing, force-generate a brand new token
    if (!result.success && result.error === 'Token Inactivo') {
      console.log(`[ANCON] anconCall ${method}: Force-generating new token...`);
      invalidateAnconToken();
      token = await getAnconToken();
      result = await soapCall<T>(method, { token, ...params }, true);
    }
  }

  return result;
}

/**
 * SOAP call with a pre-obtained token — NO auto-refresh.
 * Use this when orchestrating multiple SOAP calls with a single token.
 * ANCON invalidates old tokens when GenerarToken is called, so auto-refresh
 * would kill the shared token for subsequent steps.
 */
export async function anconCallWithToken<T = unknown>(
  method: string,
  params: Record<string, string>,
  token: string
): Promise<AnconSoapResponse<T>> {
  return soapCall<T>(method, { token, ...params }, true /* skipAuth — never auto-refresh */);
}

// ═══ Helpers ═══

function isTokenInactive(data: unknown): boolean {
  if (!data) return false;

  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.includes('Token Inactivo') || str.includes('TOKEN INACTIVO');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
