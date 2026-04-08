/**
 * Sistema de Token Diario para Internacional de Seguros (IS)
 *
 * IS genera un token diario por usuario. Flujo correcto:
 *   1. GET  /tokens/diario   → Recupera el token del día si ya fue generado (99% de casos)
 *   2. POST /tokens          → Genera el token del día (primera llamada del día)
 *
 * Capas de caché (de más rápida a más lenta):
 *   L1: Memoria  (in-process, ~0ms)
 *   L2: Supabase (cross-instancias serverless, ~50ms)
 *   L3: IS API   (fuente de verdad, ~300ms)
 */

import { ISEnvironment, getISBaseUrl, CACHE_TTL } from './config';

interface TokenCache {
  token: string;
  expiresAt: number; // timestamp ms
}

// L1: caché en memoria por instancia
const tokenCache: Record<ISEnvironment, TokenCache | null> = {
  development: null,
  production: null,
};

// Single-flight: evita llamadas duplicadas concurrentes al mismo endpoint
const tokenFetchPromises: Record<ISEnvironment, Promise<string> | null> = {
  development: null,
  production: null,
};

const TOKEN_TTL_HOURS = 23; // fallback si no podemos leer el exp del JWT

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae la fecha de expiración real del JWT (campo `exp`).
 * Retorna null si no se puede leer.
 */
function getJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const exp = typeof payload.exp === 'string' ? parseInt(payload.exp, 10) : payload.exp;
    return typeof exp === 'number' && !isNaN(exp) ? exp * 1000 : null; // → ms
  } catch {
    return null;
  }
}

function getPrimaryToken(env: ISEnvironment): string {
  const token = env === 'production'
    ? process.env.KEY_PRODUCCION_IS
    : process.env.KEY_DESARROLLO_IS;
  if (!token) {
    throw new Error(`Variable de entorno no configurada: ${env === 'production' ? 'KEY_PRODUCCION_IS' : 'KEY_DESARROLLO_IS'}`);
  }
  return token;
}

function extractTokenFromResponse(bodyText: string, contentType: string, label: string): string {
  let clean = bodyText.trim();
  if (clean.startsWith('"') && clean.endsWith('"')) clean = clean.slice(1, -1);

  if (clean.startsWith('eyJ')) {
    const parts = clean.split('.');
    if (parts.length === 3 && clean.length >= 50) {
      console.log(`[IS Token Manager] Token extraído del body (${label})`);
      return clean;
    }
  }

  let data: any;
  try { data = JSON.parse(bodyText); } catch {
    throw new Error(`Respuesta no es JSON ni JWT válido (${label})`);
  }

  if (data._event_transid && !data.token && !data.Token && !data.access_token) {
    const err = new Error('IS Token endpoint bloqueado por WAF');
    err.name = 'ISIntegrationError';
    throw err;
  }

  let t =
    data.tokenDiario || data.token || data.Token || data.access_token ||
    data.data?.token || data.Table?.[0]?.TOKEN || data.Table?.[0]?.token ||
    data.Table?.[0]?.Token || (typeof data === 'string' ? data : null);

  if (!t) throw new Error(`Token no encontrado en respuesta de ${label}`);
  if (typeof t !== 'string') throw new Error('Token no es string');
  t = t.trim();
  if (!t.startsWith('eyJ') || t.split('.').length !== 3 || t.length < 50) {
    throw new Error(`Token de ${label} no es JWT válido`);
  }
  return t;
}

async function callTokenEndpoint(
  url: string,
  primaryToken: string,
  label: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<string> {
  const isPost = method === 'POST';
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${primaryToken}`,
      Accept: 'application/json',
      ...(isPost ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(isPost ? { body: '{}' } : {}),
  });

  const status = response.status;
  const ct = response.headers.get('content-type') || '';
  console.log(`[IS Token Manager] ${method} ${url} - ${status} - ${ct}`);

  if (!response.ok) {
    const preview = await response.text();
    console.error(`[IS Token Manager] Error ${status} en ${label}:`, preview.substring(0, 120));
    throw new Error(`Error ${status} en ${label}`);
  }
  if (ct.includes('text/html')) throw new Error(`Bloqueo WAF en ${label}`);

  const bodyText = await response.text();
  console.log(`[IS Token Manager] ${label} body (200 chars):`, bodyText.substring(0, 200));
  return extractTokenFromResponse(bodyText, ct, label);
}

// ─── Supabase caché L2 (fire-and-forget en escritura) ─────────────────────────

async function readTokenFromSupabase(env: ISEnvironment): Promise<string | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('is_daily_tokens')
      .select('token, expires_at')
      .eq('environment', env)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    const expiresAt = new Date(data.expires_at).getTime();
    const minValid = Date.now() + 5 * 60 * 1000; // al menos 5 min de vida

    if (expiresAt <= minValid) {
      // Expiró según nuestro registro → no usarlo
      return null;
    }

    // Verificar también el exp real del JWT (IS puede devolver tokens con vida más corta)
    const jwtExp = getJwtExpiry(data.token);
    if (jwtExp && jwtExp <= minValid) {
      console.warn(`[IS Token Manager] Token en Supabase tiene JWT expirado (exp: ${new Date(jwtExp).toISOString()}), descartando`);
      return null;
    }

    // Rellenar L1 también
    tokenCache[env] = { token: data.token, expiresAt };
    console.log('[IS Token Manager] ✅ Token recuperado desde Supabase (L2)');
    return data.token;
  } catch {
    // Supabase no disponible — continuar sin él
    return null;
  }
}

function saveTokenToSupabase(env: ISEnvironment, token: string, expiresAt: number): void {
  // Fire-and-forget: no bloquea el flujo principal
  (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const sb = getSupabaseAdmin();
      await sb.from('is_daily_tokens').upsert(
        {
          environment: env,
          token,
          expires_at: new Date(expiresAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'environment' },
      );
      console.log('[IS Token Manager] Token persistido en Supabase (L2)');
    } catch (e: any) {
      console.warn('[IS Token Manager] No se pudo persistir token en Supabase:', e?.message);
    }
  })();
}

// ─── Lógica de obtención desde IS (L3) ─────────────────────────────────────

/**
 * Obtener token diario desde IS.
 *
 * Orden correcto:
 *   1. GET /tokens/diario  → recupera el del día (ya generado, funciona el 99% del tiempo)
 *   2. POST /tokens        → genera uno nuevo (primera llamada del día o si /diario falla)
 *
 * Antes el orden era al revés: POST primero → siempre 401 después de la 1ª generación,
 * generando 2 round-trips fallidos innecesarios antes de llegar a /tokens/diario.
 */
async function fetchTokenFromIS(env: ISEnvironment): Promise<string> {
  const primaryToken = getPrimaryToken(env);
  const baseUrl = getISBaseUrl(env).replace(/\/+$/, '');
  const retrieveUrl = `${baseUrl}/tokens/diario`;
  const generateUrl = `${baseUrl}/tokens`;

  // ── Paso 1: Recuperar el token del día ya generado ──────────────────────────
  try {
    console.log('[IS Token Manager] Paso 1: Recuperando token con GET /tokens/diario...');
    const token = await callTokenEndpoint(retrieveUrl, primaryToken, '/tokens/diario', 'GET');
    if (token && token !== primaryToken) {
      // Verificar que el token no esté expirado (IS a veces devuelve tokens viejos)
      const exp = getJwtExpiry(token);
      const minValid = Date.now() + 5 * 60 * 1000; // debe tener al menos 5 min de vida
      if (exp && exp > minValid) {
        console.log(`[IS Token Manager] ✅ Token diario RECUPERADO vía GET /tokens/diario (exp: ${new Date(exp).toISOString()})`);
        return token;
      }
      console.warn(`[IS Token Manager] /tokens/diario devolvió token EXPIRADO o a punto de expirar (exp: ${exp ? new Date(exp).toISOString() : 'desconocido'}). Generando nuevo...`);
    } else {
      console.warn('[IS Token Manager] /tokens/diario devolvió el token principal, intentando generar...');
    }
  } catch (e: any) {
    console.warn(`[IS Token Manager] GET /tokens/diario falló: ${e.message}. Intentando generar...`);
  }

  // ── Paso 2: Generar token nuevo (primera llamada del día) ───────────────────
  console.log('[IS Token Manager] Paso 2: Generando token con POST /tokens...');
  const token = await callTokenEndpoint(generateUrl, primaryToken, '/tokens (POST)', 'POST');
  if (token !== primaryToken) {
    console.log('[IS Token Manager] ✅ Token diario GENERADO vía POST /tokens');
    return token;
  }

  throw new Error('IS devolvió el token principal en ambos endpoints; token diario no disponible');
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Obtener token diario válido.
 * Capas: L1 memoria → L2 Supabase → L3 IS API
 * Single-flight para evitar llamadas concurrentes duplicadas.
 */
export async function getDailyToken(env: ISEnvironment): Promise<string> {
  const now = Date.now();

  // L1: memoria
  const cached = tokenCache[env];
  if (cached && cached.expiresAt > now) {
    console.log('[IS Token Manager] Usando token desde cache');
    return cached.token;
  }

  // Single-flight
  if (tokenFetchPromises[env]) {
    console.log('[IS Token Manager] Llamada a /tokens/diario ya en progreso, esperando...');
    return tokenFetchPromises[env]!;
  }

  console.log('[IS Token Manager] Iniciando nueva llamada a /tokens/diario');
  const fetchPromise = (async () => {
    try {
      // L2: Supabase
      const sbToken = await readTokenFromSupabase(env);
      if (sbToken) return sbToken;

      // L3: IS API
      const token = await fetchTokenFromIS(env);

      // Usar el exp real del JWT; si no disponible, fallback a TOKEN_TTL_HOURS
      const jwtExp = getJwtExpiry(token);
      const expiresAt = (jwtExp && jwtExp > now) ? jwtExp : now + TOKEN_TTL_HOURS * 60 * 60 * 1000;
      console.log(`[IS Token Manager] TTL token: hasta ${new Date(expiresAt).toISOString()}`);

      // Guardar en L1
      tokenCache[env] = { token, expiresAt };
      // Guardar en L2 (async, no bloquea)
      saveTokenToSupabase(env, token, expiresAt);

      return token;
    } finally {
      tokenFetchPromises[env] = null;
    }
  })();

  tokenFetchPromises[env] = fetchPromise;
  return fetchPromise;
}

/**
 * Invalidar caché de token (fuerza renovación en la próxima llamada).
 * Limpia L1 (memoria) Y L2 (Supabase) para que la siguiente llamada
 * vaya directo a IS API y no reutilice un token ya rechazado.
 */
export async function invalidateToken(env: ISEnvironment): Promise<void> {
  tokenCache[env] = null;
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const sb = getSupabaseAdmin();
    await sb.from('is_daily_tokens').delete().eq('environment', env);
    console.log('[IS Token Manager] Cache L2 invalidado (Supabase)');
  } catch (e: any) {
    console.warn('[IS Token Manager] No se pudo invalidar cache L2:', e?.message);
  }
}

/**
 * getDailyToken con retry en caso de bloqueo WAF
 */
export async function getDailyTokenWithRetry(env: ISEnvironment, maxRetries = 1): Promise<string> {
  try {
    return await getDailyToken(env);
  } catch (error: any) {
    if (maxRetries > 0 && error.message?.includes('WAF')) {
      console.warn('[IS Token Manager] Bloqueo WAF, invalidando cache y reintentando...');
      await invalidateToken(env);
      return getDailyTokenWithRetry(env, maxRetries - 1);
    }
    throw error;
  }
}
