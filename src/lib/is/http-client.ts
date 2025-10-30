/**
 * Cliente HTTP robusto para Internacional de Seguros (IS)
 * Incluye: retry con backoff, token refresh, logging, timeout
 */

import { IS_CONFIG, ISEnvironment, RETRY_CONFIG } from './config';
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
 * Cifrado simple para audit_payloads
 */
function encrypt(text: string): string {
  // En producción usar una key del .env
  const key = process.env.AUDIT_ENCRYPTION_KEY || 'default-key-change-me';
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Obtener token diario válido (con cache y refresh automático)
 */
async function getDailyToken(env: ISEnvironment): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  
  // 1. Verificar cache en memoria
  const cached = tokenCache.get(env);
  if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return cached.token;
  }
  
  // 2. Verificar base de datos
  const { data: dbToken, error: dbError } = await supabase
    .from('is_daily_tokens')
    .select('token, expires_at')
    .eq('environment', env)
    .gt('expires_at', new Date(Date.now() + 5 * 60 * 1000).toISOString())
    .single();
  
  if (dbToken && !dbError) {
    // Actualizar cache
    tokenCache.set(env, {
      token: dbToken.token,
      expiresAt: new Date(dbToken.expires_at),
    });
    return dbToken.token;
  }
  
  // 3. Token expirado o no existe - obtener nuevo
  return await refreshDailyToken(env);
}

/**
 * Renovar token diario llamando a IS
 */
async function refreshDailyToken(env: ISEnvironment): Promise<string | null> {
  const config = IS_CONFIG[env];
  const supabase = getSupabaseAdmin();
  
  try {
    console.log(`[IS] Renovando token diario para ${env}...`);
    
    const response = await fetch(`${config.baseUrl}/api/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.bearerToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 segundos
    });
    
    if (!response.ok) {
      console.error(`[IS] Error al renovar token: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.token) {
      console.error('[IS] Respuesta de token no contiene "token":', data);
      return null;
    }
    
    // Calcular expiración (asumiendo 24 horas si no viene en respuesta)
    const expiresAt = data.expiresAt 
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Guardar en base de datos
    await supabase
      .from('is_daily_tokens')
      .upsert({
        environment: env,
        token: data.token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'environment',
      });
    
    // Actualizar cache
    tokenCache.set(env, {
      token: data.token,
      expiresAt,
    });
    
    console.log(`[IS] Token renovado exitosamente para ${env}`);
    
    return data.token;
  } catch (error) {
    console.error('[IS] Error al renovar token:', error);
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
  
  const config = IS_CONFIG[env];
  const url = `${config.baseUrl}${endpoint}`;
  
  // Obtener token
  let authToken: string;
  if (useEnvironmentToken) {
    authToken = config.bearerToken;
  } else {
    const dailyToken = skipTokenRefresh ? null : await getDailyToken(env);
    authToken = dailyToken || config.bearerToken;
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
      
      // Log request
      console.log(`[IS] ${method} ${endpoint} (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1})`);
      
      // Hacer request
      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }
      
      const duration = Date.now() - startTime;
      
      // Log response
      console.log(`[IS] ${method} ${endpoint} - ${response.status} (${duration}ms)`);
      
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
      
      // Manejar errores recuperables (5xx, 429)
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
