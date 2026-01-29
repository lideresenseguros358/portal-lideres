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
 * Obtener token diario desde IS (renovación)
 * Parser FLEXIBLE: text/plain, JSON con múltiples estructuras, Table
 */
async function fetchDailyToken(env: ISEnvironment): Promise<string> {
  const primaryToken = getPrimaryToken(env);
  const baseUrl = getISBaseUrl(env);
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
    
    // Buscar token en múltiples ubicaciones posibles
    const dailyToken = 
      data.tokenDiario ||
      data.token ||
      data.Token ||
      data.access_token ||
      data.data?.token ||
      data.Table?.[0]?.TOKEN ||
      data.Table?.[0]?.token ||
      data.Table?.[0]?.Token;
    
    if (!dailyToken) {
      const keys = Object.keys(data);
      console.error('[IS Token Manager] Token no encontrado. Estructura:', keys);
      console.error('[IS Token Manager] Primeros 120 chars:', JSON.stringify(data).substring(0, 120));
      throw new Error('Token diario no encontrado en respuesta');
    }

    console.log('[IS Token Manager] Token diario obtenido (JSON)');
    return dailyToken;
    
  } catch (error: any) {
    console.error(`[IS Token Manager] Error obteniendo token diario (${env}):`, error.message);
    throw error;
  }
}

/**
 * Obtener token diario válido (con cache)
 */
export async function getDailyToken(env: ISEnvironment): Promise<string> {
  const now = Date.now();
  const cached = tokenCache[env];

  // Si hay token en cache y no ha expirado, usarlo
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  // Obtener nuevo token diario
  const dailyToken = await fetchDailyToken(env);
  
  // Guardar en cache con TTL
  tokenCache[env] = {
    token: dailyToken,
    expiresAt: now + (TOKEN_TTL_HOURS * 60 * 60 * 1000),
  };

  return dailyToken;
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
