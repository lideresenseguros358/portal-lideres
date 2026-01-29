/**
 * Sistema de Token Diario para Internacional de Seguros (IS)
 * Según instructivo IS: obtener token diario desde /api/tokens
 */

import { ISEnvironment, getISBaseUrl } from './config';

interface TokenCache {
  token: string;
  expiresAt: number; // timestamp en ms
}

const tokenCache: Record<ISEnvironment, TokenCache | null> = {
  development: null,
  production: null,
};

// IS-J: Single-flight promises para evitar llamadas duplicadas
const tokenFetchPromises: Record<ISEnvironment, Promise<string> | null> = {
  development: null,
  production: null,
};

const TOKEN_TTL_HOURS = 23; // 23 horas según instructivo IS

/**
 * Obtener token principal desde ENV vars
 */
function getPrimaryToken(env: ISEnvironment): string {
  const token = env === 'production'
    ? process.env.KEY_PRODUCCION_IS
    : process.env.KEY_DESARROLLO_IS;

  if (!token) {
    throw new Error(
      `Variable de entorno no configurada: ${
        env === 'production' ? 'KEY_PRODUCCION_IS' : 'KEY_DESARROLLO_IS'
      }`
    );
  }

  return token;
}

/**
 * Obtener token diario desde IS
 * B3: ENDPOINT CORRECTO según manual IS original: /tokens (NO /diario)
 * El manual indica GET /tokens con Bearer del token principal
 * Parser FLEXIBLE: text/plain, JSON con múltiples estructuras
 */
async function fetchDailyToken(env: ISEnvironment): Promise<string> {
  const primaryToken = getPrimaryToken(env);
  let baseUrl = getISBaseUrl(env);
  // B3: Normalizar baseUrl sin trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // B3: ENDPOINT CORRECTO: /tokens (según manual IS)
  // La base URL ya incluye /api, entonces /tokens es suficiente
  const endpoint = `${baseUrl}/tokens`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${primaryToken}`,
        'Accept': 'application/json',
      },
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`[IS Token Manager] GET ${endpoint} - ${status} - ${contentType}`);

    if (!response.ok) {
      const preview = await response.text();
      console.error(`[IS Token Manager] Error ${status}:`, preview.substring(0, 120));
      throw new Error(`Error ${status} al obtener token diario`);
    }
    
    // BLOQUEO WAF: Si devuelve HTML
    if (contentType.includes('text/html')) {
      console.error('[IS Token Manager] Bloqueo WAF - respuesta HTML');
      throw new Error('Bloqueo WAF detectado');
    }

    const bodyText = await response.text();
    
    // B2: Log sample de respuesta para diagnóstico
    console.log('[IS Token Manager] Body sample (primeros 200 chars):', bodyText.substring(0, 200));
    
    // CASO 1: text/plain - El token viene directo como string
    if (contentType.includes('text/plain') || bodyText.startsWith('eyJ')) {
      const token = bodyText.trim();
      console.log('[IS Token Manager] Token diario obtenido (text/plain)');
      return token;
    }
    
    // CASO 2: JSON - Parsear y buscar en múltiples rutas
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      console.error('[IS Token Manager] Body no es JSON:', bodyText.substring(0, 120));
      throw new Error('Respuesta no es JSON válido');
    }
    
    // B2: DETECTAR BLOQUEO/WAF - Si solo viene _event_transid es bloqueo
    if (data._event_transid && !data.token && !data.Token && !data.access_token) {
      console.error('[IS Token Manager] BLOQUEO DETECTADO: respuesta solo contiene _event_transid');
      console.error('[IS Token Manager] Esto indica WAF/bloqueo o endpoint incorrecto');
      console.error('[IS Token Manager] Response completo:', JSON.stringify(data).substring(0, 300));
      throw new Error('IS Token endpoint bloqueado o incorrecto - solo devuelve _event_transid');
    }
    
    // B3: Buscar token en múltiples ubicaciones posibles
    let dailyToken = 
      data.tokenDiario ||
      data.token ||
      data.Token ||
      data.access_token ||
      data.data?.token ||
      data.Table?.[0]?.TOKEN ||
      data.Table?.[0]?.token ||
      data.Table?.[0]?.Token;
    
    // Si la respuesta completa es string, intentar usarla
    if (!dailyToken && typeof data === 'string') {
      dailyToken = data;
    }
    
    if (!dailyToken) {
      const keys = Object.keys(data);
      console.error('[IS Token Manager] Token no encontrado. Keys disponibles:', keys);
      console.error('[IS Token Manager] Data completo (primeros 300 chars):', JSON.stringify(data).substring(0, 300));
      console.error('[IS Token Manager] Content-Type:', contentType);
      console.error('[IS Token Manager] Status:', status);
      
      // Si hay mensaje de error en response, mostrarlo
      if (data.message || data.error || data.msg) {
        console.error('[IS Token Manager] Mensaje API:', data.message || data.error || data.msg);
      }
      
      throw new Error('Token diario no encontrado en respuesta IS - verificar endpoint y credenciales');
    }
    
    // B3: VALIDACIÓN JWT ROBUSTA
    // JWT debe: empezar con "eyJ", tener 2 puntos (3 partes), longitud razonable
    if (typeof dailyToken !== 'string') {
      console.error('[IS Token Manager] Token no es string:', typeof dailyToken);
      throw new Error('Token diario no es string');
    }
    
    const tokenStr = dailyToken.trim();
    const parts = tokenStr.split('.');
    
    if (!tokenStr.startsWith('eyJ')) {
      console.error('[IS Token Manager] Token no empieza con eyJ:', tokenStr.substring(0, 20));
      throw new Error('Token diario no parece JWT - no empieza con eyJ');
    }
    
    if (parts.length !== 3) {
      console.error('[IS Token Manager] Token no tiene 3 partes:', parts.length, '- Sample:', tokenStr.substring(0, 50));
      throw new Error(`Token diario inválido - tiene ${parts.length} partes en lugar de 3`);
    }
    
    if (tokenStr.length < 50) {
      console.error('[IS Token Manager] Token muy corto:', tokenStr.length, 'chars');
      throw new Error('Token diario muy corto para ser JWT válido');
    }

    console.log('[IS Token Manager] Token diario obtenido y validado (JSON - formato JWT correcto)');
    return tokenStr;
    
  } catch (error: any) {
    console.error(`[IS Token Manager] Error obteniendo token diario (${env}):`, error.message);
    throw error;
  }
}

/**
 * Obtener token diario válido (con cache + single-flight)
 * IS-J: Evita llamadas duplicadas usando promise cache
 */
export async function getDailyToken(env: ISEnvironment): Promise<string> {
  const now = Date.now();
  const cached = tokenCache[env];

  // Si hay token en cache y no ha expirado, usarlo
  if (cached && cached.expiresAt > now) {
    console.log('[IS Token Manager] Usando token desde cache');
    return cached.token;
  }

  // SINGLE-FLIGHT: Si ya hay una llamada en progreso, esperar esa
  if (tokenFetchPromises[env]) {
    console.log('[IS Token Manager] Llamada a /tokens/diario ya en progreso, esperando...');
    return tokenFetchPromises[env]!;
  }

  // Iniciar nueva llamada y cachear la promise
  console.log('[IS Token Manager] Iniciando nueva llamada a /tokens/diario');
  const fetchPromise = (async () => {
    try {
      const dailyToken = await fetchDailyToken(env);
      
      // Guardar en cache con TTL
      tokenCache[env] = {
        token: dailyToken,
        expiresAt: now + (TOKEN_TTL_HOURS * 60 * 60 * 1000),
      };

      return dailyToken;
    } finally {
      // Limpiar promise cache al terminar (éxito o error)
      tokenFetchPromises[env] = null;
    }
  })();

  tokenFetchPromises[env] = fetchPromise;
  return fetchPromise;
}

/**
 * Invalidar cache de token (forzar renovación)
 */
export function invalidateToken(env: ISEnvironment): void {
  tokenCache[env] = null;
}

/**
 * Obtener token diario con retry en caso de bloqueo WAF
 */
export async function getDailyTokenWithRetry(env: ISEnvironment, maxRetries = 1): Promise<string> {
  try {
    return await getDailyToken(env);
  } catch (error: any) {
    if (maxRetries > 0 && error.message?.includes('WAF')) {
      console.warn('[IS Token Manager] Bloqueo WAF, invalidando cache y reintentando...');
      invalidateToken(env);
      return getDailyTokenWithRetry(env, maxRetries - 1);
    }
    throw error;
  }
}
