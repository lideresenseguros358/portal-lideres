/**
 * Cliente HTTP robusto para Internacional de Seguros (IS)
 * Incluye: retry con backoff, token refresh, logging, timeout
 */

import { ISEnvironment, RETRY_CONFIG, getISBaseUrl, getISPrimaryToken, IS_USER_AGENT } from './config';
import { getDailyTokenWithRetry, invalidateToken } from './token-manager';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit, isCircuitOpen, recordWafFailure, recordSuccess, getBackoffDelay, type RateLimitCategory } from './rate-limiter';
import crypto from 'crypto';

// ============================================
// IS P1: HELPER CONSTRUCCIÓN SEGURA DE URLs
// ============================================

/**
 * Une base URL y path SIN duplicar /api
 * Garantiza 1 solo slash entre segmentos
 * 
 * @example
 * joinUrl('https://...com/api', '/tokens') -> 'https://...com/api/tokens'
 * joinUrl('https://...com/api/', '/tokens') -> 'https://...com/api/tokens'
 * joinUrl('https://...com/api', 'tokens') -> 'https://...com/api/tokens'
 */
function joinUrl(base: string, path: string): string {
  // Eliminar trailing slashes de base
  const normalizedBase = base.replace(/\/+$/, '');
  
  // Asegurar leading slash en path
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  
  // VALIDACIÓN CRÍTICA: detectar /api/api
  const joined = normalizedBase + normalizedPath;
  if (joined.includes('/api/api')) {
    console.error('[IS] ⚠️ URL INCORRECTA detectada:', joined);
    console.error('[IS] Base:', base);
    console.error('[IS] Path:', path);
    throw new Error('URL construction error: /api/api detected');
  }
  
  return joined;
}

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
  
  // CIRCUIT BREAKER: Si está abierto, no hacer request
  if (isCircuitOpen(env)) {
    console.error(`[IS] ⛔ Circuit breaker ABIERTO para ${env} — rechazando ${method} ${endpoint}`);
    return {
      success: false,
      error: 'Servicio de IS temporalmente no disponible (circuit breaker activo). Intente en unos minutos.',
      statusCode: 503,
    };
  }
  
  // RATE LIMIT: Determinar categoría y esperar slot
  const rlCategory: RateLimitCategory = method === 'POST' ? 'quote' : 'catalog';
  const rlAllowed = await checkRateLimit(env, rlCategory);
  if (!rlAllowed) {
    console.warn(`[IS] Rate limit excedido para ${rlCategory} (${env})`);
    return {
      success: false,
      error: 'Demasiadas solicitudes a IS. Intente en unos segundos.',
      statusCode: 429,
    };
  }
  
  // IS P1: CONSTRUIR URL usando helper seguro (previene /api/api)
  const baseUrl = getISBaseUrl(env);
  
  let url: string;
  if (endpoint.startsWith('http')) {
    url = endpoint;
  } else {
    url = joinUrl(baseUrl, endpoint);
  }
  
  // Validación: URL debe ser absoluta con https
  if (!url.startsWith('http')) {
    console.error('[IS HTTP Client] ERROR: URL no es absoluta:', url);
    return {
      success: false,
      error: 'URL debe ser absoluta (https://...)',
      statusCode: 0,
    };
  }
  
  // Obtener token diario (OBLIGATORIO para endpoints de IS)
  // IMPORTANTE: El token principal SOLO sirve para generar/recuperar el token diario.
  // Usar el token principal en endpoints de datos siempre devuelve 401.
  let authToken: string;
  if (useEnvironmentToken) {
    // Usar token principal directamente (solo para obtener token diario)
    const { getISPrimaryToken } = await import('./config');
    authToken = getISPrimaryToken(env);
  } else {
    const dailyToken = await getDailyToken(env);
    if (!dailyToken) {
      console.error('[IS HTTP Client] No se pudo obtener token diario. El token principal NO funciona en endpoints de datos.');
      return {
        success: false,
        error: 'No se pudo obtener token diario de IS. Verificar conectividad con POST /tokens.',
        statusCode: 401,
      };
    } else {
      authToken = dailyToken;
    }
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      // Preparar request con headers consistentes (evitar WAF flags)
      const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fetchHeaders: Record<string, string> = {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
        'User-Agent': IS_USER_AGENT,
        'X-Request-Id': requestId,
        'Accept-Language': 'es-PA,es;q=0.9,en;q=0.8',
        ...headers,
      };
      // Solo agregar Content-Type si hay body
      if (body && (method === 'POST' || method === 'PUT')) {
        fetchHeaders['Content-Type'] = 'application/json';
      }
      const fetchOptions: RequestInit = {
        method,
        headers: fetchHeaders,
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
      
      // WAF/BLOCK: Detectar bloqueo por firewall de IS
      const isWafBlock = (contentType.includes('text/html') && !response.ok) ||
        responseText.includes('unauthorized activity') ||
        responseText.includes('detected unauthorized') ||
        (response.status === 404 && responseText.includes('Acceso denegado')) ||
        (response.status === 403 && !responseText.includes('Table')) ||
        (response.status === 429) ||
        (responseText.includes('_event_transid') && !responseText.includes('Table'));
      if (isWafBlock) {
        // Registrar fallo en circuit breaker
        recordWafFailure(env);
        console.warn(`[IS] ⛔ WAF block (${requestId}): ${endpoint} — ${response.status} (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1})`);
        if (attempt < RETRY_CONFIG.maxRetries) {
          const wafDelay = getBackoffDelay(attempt, [3000, 6000, 12000]);
          console.log(`[IS] WAF retry en ${Math.round(wafDelay)}ms...`);
          await sleep(wafDelay);
          continue;
        }
        console.error(`[IS] ⛔ WAF persistente (${requestId}): ${endpoint} — ${responseText.substring(0, 80)}`);
        return {
          success: false,
          error: 'Servicio de IS temporalmente no disponible. El firewall está limitando las solicitudes. Intente nuevamente en unos minutos.',
          statusCode: response.status,
        };
      }
      
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
        // IS API a veces retorna JSON double-encoded (string con JSON dentro)
        // Ej: "{\r\n  \"Table\": [...]}" → necesita segundo parse
        if (typeof responseData === 'string' && (responseData.startsWith('{') || responseData.startsWith('['))) {
          try { responseData = JSON.parse(responseData); } catch { /* keep as string */ }
        }
      } catch {
        // Si no es JSON, guardar como string
        responseData = responseText;
      }
      
      // Guardar en auditoría (async, no bloquear)
      saveAudit(endpoint, method, body, responseData, response.status, env).catch(err => {
        console.error('[IS] Error guardando auditoría:', err);
      });
      
      // Manejar 401 - token expirado o inválido
      if (response.status === 401 && !skipTokenRefresh && attempt === 0) {
        console.log('[IS] 401 recibido. Token usado (primeros 30 chars):', authToken.substring(0, 30) + '...');
        console.log('[IS] 401 response body:', responseText.substring(0, 200));
        console.log('[IS] INVALIDANDO cache y regenerando token diario...');
        // CRÍTICO: Invalidar cache ANTES de pedir nuevo token
        invalidateToken(env);
        const newToken = await refreshDailyToken(env);
        if (newToken) {
          console.log('[IS] Nuevo token (primeros 30 chars):', newToken.substring(0, 30) + '...');
          const primaryToken = getISPrimaryToken(env);
          if (newToken === primaryToken) {
            // IMPORTANTE: NO usar token principal en endpoints - siempre devuelve 401
            console.error('[IS] ⚠️ Token diario es IGUAL al principal - NO se puede usar en endpoints');
            return {
              success: false,
              error: 'No se pudo obtener token diario válido. El token principal no funciona en endpoints de IS.',
              statusCode: 401,
            };
          } else {
            console.log('[IS] ✅ Token diario es DIFERENTE al principal');
          }
          authToken = newToken;
          console.log('[IS] Reintentando con nuevo token...');
          continue;
        } else {
          // NO hacer fallback a token principal - siempre da 401 en endpoints
          console.error('[IS] No se pudo renovar token diario. Abortando request.');
          return {
            success: false,
            error: 'No se pudo obtener token diario de IS. Verificar que POST /tokens funcione.',
            statusCode: 401,
          };
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
      
      // Manejar errores recuperables (5xx) — solo GET
      if (RETRY_CONFIG.retryableStatusCodes.includes(response.status) && method === 'GET' && attempt < RETRY_CONFIG.maxRetries) {
        const delay = getBackoffDelay(attempt);
        console.log(`[IS] Error ${response.status}, reintentando GET en ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }
      
      // Respuesta exitosa — registrar éxito en circuit breaker
      if (response.ok) {
        recordSuccess(env);
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
      
      // Si es timeout o network error, reintentar solo GET
      if (method === 'GET' && attempt < RETRY_CONFIG.maxRetries) {
        const delay = getBackoffDelay(attempt);
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
  env: ISEnvironment = 'development',
  options?: Partial<ISRequestOptions>
): Promise<ISResponse<T>> {
  return isRequest<T>(endpoint, { method: 'GET', ...options }, env);
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
