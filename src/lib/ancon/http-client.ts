/**
 * SOAP HTTP Client for Aseguradora ANCON
 * Handles SOAP envelope creation, token management, and response parsing
 */

import {
  ANCON_SOAP_URL,
  ANCON_AUTH_METHODS,
  getAnconCredentials,
  TOKEN_TTL_MS,
  RETRY_CONFIG,
} from './config';
import type { AnconLoginResponse, AnconSoapResponse } from './types';

// ═══ Token Cache ═══
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a valid ANCON token, refreshing if expired
 */
export async function getAnconToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

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

  cachedToken = login.Token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  console.log(`[ANCON] Token obtained: ${cachedToken.substring(0, 16)}... (TTL: ${TOKEN_TTL_MS / 60000}min)`);

  return cachedToken;
}

/**
 * Invalidate the cached token (e.g. after "Token Inactivo" error)
 */
export function invalidateAnconToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ═══ SOAP Envelope Builder ═══

function buildSoapEnvelope(method: string, params: Record<string, string>): string {
  const paramsXml = Object.entries(params)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
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
  const body = buildSoapEnvelope(method, params);

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
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

      // Check for "Token Inactivo" error
      if (isTokenInactive(data)) {
        if (!skipAuth) {
          console.log('[ANCON] Token inactive, refreshing...');
          invalidateAnconToken();
          const newToken = await getAnconToken();
          // Retry with new token
          if (params.token) {
            params.token = newToken;
          }
          if (params.par_token) {
            params.par_token = newToken;
          }
          return soapCall<T>(method, params, true);
        }
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
 * Convenience: SOAP call that auto-injects the current token
 */
export async function anconCall<T = unknown>(
  method: string,
  params: Record<string, string> = {}
): Promise<AnconSoapResponse<T>> {
  const token = await getAnconToken();
  return soapCall<T>(method, { token, ...params });
}

// ═══ Helpers ═══

function isTokenInactive(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const str = JSON.stringify(data);
  return str.includes('Token Inactivo') || str.includes('TOKEN INACTIVO');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
