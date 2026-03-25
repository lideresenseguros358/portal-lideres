/**
 * HTTP Client para La Regional de Seguros
 * Maneja autenticación Basic Auth + headers codInter/token
 */

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import {
  getRegionalBaseUrl,
  getRegionalCredentials,
  RETRY_CONFIG,
} from './config';

// Regional PROD server uses a self-signed TLS cert on port 7443.
// Node.js global fetch (undici) does NOT respect NODE_TLS_REJECT_UNAUTHORIZED at runtime,
// so we use node:https directly with rejectUnauthorized:false.
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
    const lib = isHttps ? https : http;
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}) },
      rejectUnauthorized: false,
    };
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`Regional request timeout after ${timeoutMs}ms`)); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function getBasicAuthHeader(): string {
  const creds = getRegionalCredentials();
  const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  return `Basic ${encoded}`;
}

function getDefaultHeaders(useTokenCC = false): Record<string, string> {
  const creds = getRegionalCredentials();
  return {
    'Content-Type': 'application/json',
    Authorization: getBasicAuthHeader(),
    codInter: creds.codInter,
    codProv: creds.codInter,   // CC endpoints require codProv (same value as codInter)
    token: useTokenCC ? creds.tokenCC : creds.token,
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string>;
  /** Send these as request HEADERS instead of query-string params (required by cotizar endpoint) */
  headerParams?: Record<string, string>;
  timeout?: number;
  extraHeaders?: Record<string, string>;
  /** Use the CC-specific token (tokenCC) instead of the default RC token */
  useTokenCC?: boolean;
  /** Skip default headers (Content-Type/codInter/token) — only use Authorization + headerParams */
  headerParamsOnly?: boolean;
}

export interface RegionalResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  raw?: unknown;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Core request function with retry logic
 */
export async function regionalRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<RegionalResponse<T>> {
  const { method = 'GET', body, params, headerParams, timeout = 30000, extraHeaders, useTokenCC } = options;
  const baseUrl = getRegionalBaseUrl();

  let url = `${baseUrl}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  // headerParams are merged into the request headers (used by cotizar endpoint)
  // headerParamsOnly=true: skip default codInter/token/Content-Type — cotizar only needs Authorization+cotizar headers
  const baseHeaders = options.headerParamsOnly
    ? { Authorization: getBasicAuthHeader() }
    : getDefaultHeaders(useTokenCC);
  const headers = { ...baseHeaders, ...headerParams, ...extraHeaders };

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(
        `[REGIONAL] ${method} ${endpoint}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`
      );

      const rawBody = body ? JSON.stringify(body) : undefined;
      const nodeRes = await nodeHttpsRequest(url, method, headers, rawBody, timeout);

      // status / text from node:https
      const resStatus = nodeRes.status;
      const text = nodeRes.text;
      // Fake a minimal res.ok / res.status for the rest of the logic below
      const resOk = resStatus >= 200 && resStatus < 300;

      let data: unknown;

      // Always read as text first, then try to parse as JSON.
      // Some REGIONAL endpoints return bare key-value like "PLANES":[...]
      // which is not valid JSON — we wrap it in {} before parsing.
      try {
        data = JSON.parse(text);
      } catch {
        // Try wrapping bare key-value pairs in {}
        const trimmed = text.trim();
        if (trimmed.startsWith('"') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          try {
            data = JSON.parse(`{${trimmed}}`);
          } catch {
            data = text;
          }
        } else {
          data = text;
        }
      }

      console.log(
        `[REGIONAL] ${method} ${endpoint} → ${resStatus}${resOk ? '' : ` ERROR: ${JSON.stringify(data).slice(0, 200)}`}`
      );

      if (!resOk) {
        // Retry on retryable status codes
        if (
          RETRY_CONFIG.retryableStatusCodes.includes(resStatus) &&
          attempt < RETRY_CONFIG.maxRetries
        ) {
          const delay = RETRY_CONFIG.baseDelays[attempt] || 3000;
          console.log(`[REGIONAL] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        return {
          success: false,
          error:
            typeof data === 'object' && data !== null
              ? (data as Record<string, unknown>).message?.toString() ||
                (data as Record<string, unknown>).mensaje?.toString() ||
                JSON.stringify(data)
              : String(data),
          status: resStatus,
          raw: data,
        };
      }

      return {
        success: true,
        data: data as T,
        status: resStatus,
        raw: data,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[REGIONAL] ${method} ${endpoint} ERROR: ${errMsg}`);

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.baseDelays[attempt] || 3000;
        console.log(`[REGIONAL] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      return {
        success: false,
        error: errMsg,
      };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * GET request helper
 */
export async function regionalGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string>,
  opts?: { headerParams?: Record<string, string>; useTokenCC?: boolean; headerParamsOnly?: boolean }
): Promise<RegionalResponse<T>> {
  return regionalRequest<T>(endpoint, { method: 'GET', params, ...opts });
}

/**
 * POST request helper
 */
export async function regionalPost<T = unknown>(
  endpoint: string,
  body: unknown,
  opts?: { useTokenCC?: boolean }
): Promise<RegionalResponse<T>> {
  return regionalRequest<T>(endpoint, { method: 'POST', body, ...opts });
}

/**
 * PUT request helper
 */
export async function regionalPut<T = unknown>(
  endpoint: string,
  body: unknown,
  opts?: { useTokenCC?: boolean }
): Promise<RegionalResponse<T>> {
  return regionalRequest<T>(endpoint, { method: 'PUT', body, ...opts });
}
