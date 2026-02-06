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
 * Extraer y validar un JWT token de la respuesta del endpoint de tokens IS
 */
function extractTokenFromResponse(bodyText: string, contentType: string, endpointLabel: string): string {
  // Limpiar comillas envolventes si la respuesta es un JSON string
  // IS devuelve: "eyJhbG..." (con comillas) cuando content-type es application/json
  let cleanBody = bodyText.trim();
  if (cleanBody.startsWith('"') && cleanBody.endsWith('"')) {
    cleanBody = cleanBody.slice(1, -1);
  }
  
  // CASO 1: El body (limpio) es directamente un JWT
  if (cleanBody.startsWith('eyJ')) {
    const token = cleanBody.trim();
    const parts = token.split('.');
    if (parts.length === 3 && token.length >= 50) {
      console.log(`[IS Token Manager] Token extraído directamente del body (${endpointLabel})`);
      return token;
    }
  }
  
  // CASO 2: JSON con estructura - parsear y buscar
  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    // Si no es JSON y no es JWT directo, error
    throw new Error(`Respuesta no es JSON ni JWT válido (${endpointLabel})`);
  }
  
  // Detectar bloqueo WAF
  if (data._event_transid && !data.token && !data.Token && !data.access_token) {
    const error = new Error('IS Token endpoint bloqueado o incorrecto');
    error.name = 'ISIntegrationError';
    throw error;
  }
  
  // Buscar token en múltiples ubicaciones
  let dailyToken = 
    data.tokenDiario ||
    data.token ||
    data.Token ||
    data.access_token ||
    data.data?.token ||
    data.Table?.[0]?.TOKEN ||
    data.Table?.[0]?.token ||
    data.Table?.[0]?.Token;
  
  // Si la respuesta parseada es string (JSON string: "eyJhbG...")
  if (!dailyToken && typeof data === 'string') {
    dailyToken = data;
  }
  
  if (!dailyToken) {
    const keys = typeof data === 'object' ? Object.keys(data) : [];
    console.error(`[IS Token Manager] Token no encontrado en ${endpointLabel}. Keys:`, keys);
    throw new Error(`Token no encontrado en respuesta de ${endpointLabel}`);
  }
  
  // Validar JWT
  if (typeof dailyToken !== 'string') {
    throw new Error('Token no es string');
  }
  
  const tokenStr = dailyToken.trim();
  const parts = tokenStr.split('.');
  
  if (!tokenStr.startsWith('eyJ') || parts.length !== 3 || tokenStr.length < 50) {
    console.error(`[IS Token Manager] Token inválido de ${endpointLabel}:`, tokenStr.substring(0, 30));
    throw new Error(`Token de ${endpointLabel} no es JWT válido`);
  }
  
  return tokenStr;
}

/**
 * Llamar a un endpoint de tokens IS
 */
async function callTokenEndpoint(url: string, primaryToken: string, label: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${primaryToken}`,
      'Accept': 'application/json',
    },
  });

  const status = response.status;
  const contentType = response.headers.get('content-type') || '';
  
  console.log(`[IS Token Manager] GET ${url} - ${status} - ${contentType}`);

  if (!response.ok) {
    const preview = await response.text();
    console.error(`[IS Token Manager] Error ${status} en ${label}:`, preview.substring(0, 120));
    throw new Error(`Error ${status} en ${label}`);
  }
  
  if (contentType.includes('text/html')) {
    throw new Error(`Bloqueo WAF en ${label}`);
  }

  const bodyText = await response.text();
  console.log(`[IS Token Manager] ${label} body (200 chars):`, bodyText.substring(0, 200));
  
  return extractTokenFromResponse(bodyText, contentType, label);
}

/**
 * Obtener token diario desde IS
 * 
 * SEGÚN DOCUMENTACIÓN IS:
 * - Paso 1: GET /api/tokens → GENERA el token diario (con Bearer primary token)
 * - Paso Opcional: GET /api/tokens/diario → RECUPERA el token diario ya generado
 * - Paso 2: Usar el token diario como Bearer en todos los endpoints
 * 
 * IMPORTANTE: /tokens GENERA, /tokens/diario solo RECUPERA.
 * Si solo llamamos /tokens/diario sin haber llamado /tokens primero,
 * puede devolver el token principal en vez del diario → 401 en endpoints.
 */
async function fetchDailyToken(env: ISEnvironment): Promise<string> {
  const primaryToken = getPrimaryToken(env);
  let baseUrl = getISBaseUrl(env);
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // Paso 1: GENERAR token diario con /tokens
  const generateUrl = `${baseUrl}/tokens`;
  // Paso Opcional: RECUPERAR token diario con /tokens/diario
  const retrieveUrl = `${baseUrl}/tokens/diario`;

  try {
    // PRIMERO: Intentar GENERAR el token diario (Paso 1 de la documentación)
    console.log('[IS Token Manager] Paso 1: Generando token diario con /tokens...');
    try {
      const token = await callTokenEndpoint(generateUrl, primaryToken, '/tokens');
      
      // Verificar que el token generado sea DIFERENTE al primary token
      if (token === primaryToken) {
        console.warn('[IS Token Manager] ⚠️ /tokens devolvió el mismo token principal, intentando /tokens/diario...');
      } else {
        console.log('[IS Token Manager] ✅ Token diario GENERADO exitosamente (diferente al principal)');
        return token;
      }
    } catch (genError: any) {
      console.warn(`[IS Token Manager] /tokens falló: ${genError.message}, intentando /tokens/diario...`);
    }
    
    // SEGUNDO: Si /tokens falla o devuelve el mismo token, intentar /tokens/diario
    console.log('[IS Token Manager] Intentando recuperar token con /tokens/diario...');
    const dailyToken = await callTokenEndpoint(retrieveUrl, primaryToken, '/tokens/diario');
    
    // Verificar que sea diferente al primary
    if (dailyToken === primaryToken) {
      console.warn('[IS Token Manager] ⚠️ /tokens/diario también devolvió el token principal');
      console.warn('[IS Token Manager] Esto puede significar que IS no genera tokens diarios diferentes');
      console.warn('[IS Token Manager] Usando el token tal cual (puede causar 401 en endpoints)');
    } else {
      console.log('[IS Token Manager] ✅ Token diario RECUPERADO exitosamente');
    }
    
    return dailyToken;
    
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
