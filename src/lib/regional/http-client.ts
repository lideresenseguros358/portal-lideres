/**
 * HTTP Client para La Regional de Seguros
 * Maneja autenticación Basic Auth + headers codInter/token
 */

import {
  getRegionalBaseUrl,
  getRegionalCredentials,
  RETRY_CONFIG,
} from './config';

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
    token: useTokenCC ? creds.tokenCC : creds.token,
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  extraHeaders?: Record<string, string>;
  /** Use the CC-specific token (tokenCC) instead of the default RC token */
  useTokenCC?: boolean;
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
  const { method = 'GET', body, params, timeout = 30000, extraHeaders, useTokenCC } = options;
  const baseUrl = getRegionalBaseUrl();

  let url = `${baseUrl}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const headers = { ...getDefaultHeaders(useTokenCC), ...extraHeaders };

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      console.log(
        `[REGIONAL] ${method} ${endpoint}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`
      );

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      let data: unknown;

      // Always read as text first, then try to parse as JSON.
      // Some REGIONAL endpoints return bare key-value like "PLANES":[...]
      // which is not valid JSON — we wrap it in {} before parsing.
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        // Try wrapping bare key-value pairs in {}
        const trimmed = text.trim();
        if (trimmed.startsWith('"') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          try {
            data = JSON.parse(`{${trimmed}}`);
          } catch {
            data = contentType.includes('text') ? text : text;
          }
        } else {
          data = text;
        }
      }

      console.log(
        `[REGIONAL] ${method} ${endpoint} → ${res.status}${
          res.ok ? '' : ` ERROR: ${JSON.stringify(data).slice(0, 200)}`
        }`
      );

      if (!res.ok) {
        // Retry on retryable status codes
        if (
          RETRY_CONFIG.retryableStatusCodes.includes(res.status) &&
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
          status: res.status,
          raw: data,
        };
      }

      return {
        success: true,
        data: data as T,
        status: res.status,
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
  params?: Record<string, string>
): Promise<RegionalResponse<T>> {
  return regionalRequest<T>(endpoint, { method: 'GET', params });
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
