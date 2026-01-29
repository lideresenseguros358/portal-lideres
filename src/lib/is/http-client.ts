/**
 * Cliente HTTP robusto para Internacional de Seguros (IS)
 * Incluye: retry con backoff, token refresh, logging, timeout
 */

import { ISEnvironment, RETRY_CONFIG, getISBaseUrl } from './config';
import { getDailyTokenWithRetry } from './token-manager';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

export interface ISRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  skipTokenRefresh?: boolean;
  useEnvironmentToken?: boolean; // true = usar Bearer del ambiente, false = usar token diario
}

export interface ISResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: Date;
}

// Cache en memoria para tokens (fallback si DB falla)
const tokenCache: Map<ISEnvironment, TokenCacheEntry> = new Map();

/**
 * Cifrado simple para audit_payloads usando Base64
 * Temporal mientras se arregla el problema de crypto en Turbopack
 */
function encrypt(text: string): string {
  try {
    // Por ahora solo codificar en Base64 para evitar errores
    // TODO: Implementar encriptación real cuando Turbopack soporte crypto correctamente
    return Buffer.from(text, 'utf8').toString('base64');
  } catch (error) {
    console.error('[IS] Error en codificación, guardando sin cifrar:', error);
    return text; // Fallback: guardar sin cifrar en caso de error
  }
}

/**
 * DEPRECADO: Ahora se usa token-manager.ts
 * Mantener solo para compatibilidad temporal
 */
async function getDailyToken(env: ISEnvironment): Promise<string | null> {
  try {
    return await getDailyTokenWithRetry(env);
  } catch (error: any) {
    console.error('[IS HTTP Client] Error obteniendo token diario:', error.message);
    return null;
  }
}

/**
 * DEPRECADO: Movido a token-manager.ts
 */
async function refreshDailyToken(env: ISEnvironment): Promise<string | null> {
  try {
    return await getDailyTokenWithRetry(env);
  } catch (error: any) {
    console.error('[IS HTTP Client] Error renovando token:', error.message);
    return null;
  }
}

/**
 * Espera con backoff exponencial
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Request principal con reintentos
 */
export async function isRequest<T = any>(
  endpoint: string,
  options: ISRequestOptions = {},
  env: ISEnvironment = 'development'
): Promise<ISResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 30000,
    skipTokenRefresh = false,
    useEnvironmentToken = false,
  } = options;
  
  // B2: NORMALIZAR BASE URL sin trailing slash
  let baseUrl = getISBaseUrl(env);
  baseUrl = baseUrl.replace(/\/+$/, ''); // Eliminar trailing slashes
  
  // B2: CONSTRUIR URL ABSOLUTA correctamente
  let url: string;
  if (endpoint.startsWith('http')) {
    // Ya es URL absoluta
    url = endpoint;
  } else {
    // Normalizar path con leading slash
    let path = endpoint;
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // Concatenar: baseUrl nunca termina en /, path siempre empieza con /
    url = baseUrl + path;
  }
  
  // Validación: URL debe ser absoluta con https
  if (!url.startsWith('http')) {
    console.error('[IS HTTP Client] ERROR: URL no es absoluta:', url);
    console.error('[IS HTTP Client] baseUrl:', baseUrl, 'endpoint:', endpoint);
    return {
      success: false,
      error: 'URL debe ser absoluta (https://...)',
      statusCode: 0,
    };
  }
  
  // B5: LOG URL COMPLETA para detectar paths relativos
  console.log(`[IS] URL completa: ${url}`);
  
  // Obtener token diario (recomendado) o usar token principal como fallback
  let authToken: string;
  if (useEnvironmentToken) {
    // Usar token principal directamente (solo para obtener token diario)
    const { getISPrimaryToken } = await import('./config');
    authToken = getISPrimaryToken(env);
  } else {
    const dailyToken = skipTokenRefresh ? null : await getDailyToken(env);
    if (!dailyToken) {
      // Fallback a token principal si falla el diario
      const { getISPrimaryToken } = await import('./config');
      authToken = getISPrimaryToken(env);
    } else {
      authToken = dailyToken;
    }
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      // Preparar request
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
      };
      
      if (body && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(body);
      }
      
      // B4: NO COTIZAR SIN TOKEN VÁLIDO
      if (!authToken || authToken.length < 10) {
        console.error('[IS] ERROR: Token inválido o vacío, abortando request');
        return {
          success: false,
          error: 'Token de autenticación inválido',
          statusCode: 0,
        };
      }
      
      // Log request con URL completa
      console.log(`[IS] ${method} ${url} (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1})`);
      
      // Hacer request
      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      
      const duration = Date.now() - startTime;
      
      // Log response (con endpoint original y URL completa)
      console.log(`[IS] ${method} ${endpoint} → ${url} - ${response.status} (${duration}ms) - ${contentType}`);
      
      // B5: DETECTAR 404 por path relativo
      if (response.status === 404 && !endpoint.startsWith('http')) {
        console.error('[IS] ERROR 404: Posible path relativo o endpoint incorrecto');
        console.error('[IS] URL construida:', url);
        console.error('[IS] Verificar que endpoint no incluya /api duplicado');
      }
      
      // WAF/BLOCK: Si es HTML en lugar de JSON
      if (contentType.includes('text/html') && !response.ok) {
        console.error('[IS] WAF/BLOCK detectado - respuesta HTML');
        return {
          success: false,
          error: 'Bloqueado por WAF',
          statusCode: response.status,
        };
      }
      
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // Si no es JSON, guardar como string
        responseData = responseText;
      }
      
      // Guardar en auditoría (async, no bloquear)
      saveAudit(endpoint, method, body, responseData, response.status, env).catch(err => {
        console.error('[IS] Error guardando auditoría:', err);
      });
      
      // Manejar 401 - token expirado
      if (response.status === 401 && !skipTokenRefresh && attempt === 0) {
        console.log('[IS] Token expirado (401), renovando...');
        const newToken = await refreshDailyToken(env);
        if (newToken) {
          authToken = newToken;
          continue; // Reintentar con nuevo token
        }
      }
      
      // B4: NO reintentar 404 - es error permanente (endpoint incorrecto)
      if (response.status === 404) {
        console.error('[IS] ERROR 404 - endpoint no existe o path incorrecto - NO REINTENTAR');
        return {
          success: false,
          error: `Endpoint no encontrado (404): ${endpoint}`,
          statusCode: 404,
          data: responseData,
        };
      }
      
      // Manejar errores recuperables (5xx, 429) - NO 404
      if (RETRY_CONFIG.retryableStatusCodes.includes(response.status) && attempt < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
        console.log(`[IS] Error ${response.status}, reintentando en ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      // Respuesta exitosa
      if (response.ok) {
        return {
          success: true,
          data: responseData,
          statusCode: response.status,
        };
      }
      
      // Error no recuperable
      return {
        success: false,
        error: responseData?.message || responseData?.error || `HTTP ${response.status}`,
        statusCode: response.status,
        data: responseData,
      };
      
    } catch (error: any) {
      lastError = error;
      console.error(`[IS] Error en request (attempt ${attempt + 1}):`, error.message);
      
      // Si es timeout o network error, reintentar
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
        await sleep(delay);
        continue;
      }
    }
  }
  
  // Todos los reintentos fallaron
  return {
    success: false,
    error: lastError?.message || 'Error desconocido después de múltiples intentos',
    statusCode: 0,
  };
}

/**
 * Guardar auditoría en base de datos (cifrada)
 */
async function saveAudit(
  endpoint: string,
  method: string,
  request: any,
  response: any,
  statusCode: number,
  env: ISEnvironment
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    await supabase.from('audit_payloads').insert({
      endpoint: `${method} ${endpoint}`,
      request_json: encrypt(JSON.stringify(request || {})),
      response_json: encrypt(JSON.stringify(response || {})),
      status_code: statusCode,
      environment: env,
      actor: 'system',
    });
  } catch (error) {
    // No fallar si la auditoría falla
    console.error('[IS] Error al guardar auditoría:', error);
  }
}

/**
 * Helper para GET
 */
export async function isGet<T = any>(
  endpoint: string,
  env: ISEnvironment = 'development'
): Promise<ISResponse<T>> {
  return isRequest<T>(endpoint, { method: 'GET' }, env);
}

/**
 * Helper para POST
 */
export async function isPost<T = any>(
  endpoint: string,
  body: any,
  env: ISEnvironment = 'development'
): Promise<ISResponse<T>> {
  return isRequest<T>(endpoint, { method: 'POST', body }, env);
}
