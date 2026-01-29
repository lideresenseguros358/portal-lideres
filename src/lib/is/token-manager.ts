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
 */
async function fetchDailyToken(env: ISEnvironment): Promise<string> {
  const primaryToken = getPrimaryToken(env);
  const baseUrl = getISBaseUrl(env);
  // baseUrl ya incluye /api, entonces solo agregamos /tokens
  const endpoint = `${baseUrl}/tokens`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${primaryToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status} al obtener token diario`);
    }

    const contentType = response.headers.get('content-type');
    
    // Si devuelve HTML, es bloqueo WAF
    if (contentType?.includes('text/html')) {
      throw new Error('Bloqueo WAF detectado - respuesta HTML en lugar de JSON');
    }

    const data = await response.json();
    
    // Log completo de la respuesta para debugging
    console.log('[IS Token Manager] Respuesta completa de /tokens:', JSON.stringify(data));
    
    // La respuesta puede variar, ajustar según estructura real
    const dailyToken = data.token || data.Token || data.access_token || data.data?.token;
    
    if (!dailyToken) {
      console.error('[IS Token Manager] Estructura de respuesta:', Object.keys(data));
      throw new Error('Token diario no encontrado en respuesta');
    }

    console.log('[IS Token Manager] Token diario obtenido exitosamente');
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
