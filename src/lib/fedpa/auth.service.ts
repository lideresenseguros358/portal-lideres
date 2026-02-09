/**
 * Servicio de Autenticación FEDPA — Token Manager robusto
 * 
 * FLUJO según documentación oficial EmisorPlan:
 * POST https://wscanales.segfedpa.com/EmisorPlan/api/generartoken
 * Body: { "usuario": "...", "clave": "...", "Amb": "DEV"|"PROD" }
 * 
 * Respuestas posibles:
 *   OK:        { success: true, registrado: true,  token: "eyJ..." }
 *   Ya existe: { success: true, registrado: false, msg: "Ya existe token registrado" }  ← NO devuelve token
 * 
 * Estrategia:
 * 1. SIEMPRE guardar token en fedpa_tokens (Supabase) cuando lo recibimos.
 * 2. Si "Ya existe" y tenemos token en DB → probar con GET /planes para verificar que sirve.
 * 3. Si "Ya existe" y NO tenemos token → NEEDS_FEDPA_TOKEN_RESET (error controlado, sin spam).
 */

import { createFedpaClient } from './http-client';
import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_PLAN_ENDPOINTS, TOKEN_TTL_MS } from './config';
import type { TokenRequest, TokenResponse } from './types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ============================================
// CACHE EN MEMORIA (fast path)
// ============================================

const tokenCache = new Map<string, { token: string; exp: number }>();

// ============================================
// PERSISTENCIA EN SUPABASE (fedpa_tokens)
// ============================================

async function guardarTokenEnDB(amb: string, token: string, source: string = 'generartoken'): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    
    await (supabase as any)
      .from('fedpa_tokens')
      .upsert({
        amb,
        token,
        created_at: now,
        expires_at: expiresAt,
        last_ok_at: now,
        source,
      }, { onConflict: 'amb' });
    
    console.log(`[FEDPA Auth] Token guardado en DB (amb=${amb}, source=${source}, ...${token.slice(-6)})`);
  } catch (err) {
    console.warn('[FEDPA Auth] No se pudo guardar token en DB:', (err as any)?.message);
    // Fallback: intentar system_config (tabla legacy)
    try {
      const supabase = getSupabaseAdmin();
      await (supabase as any)
        .from('system_config')
        .upsert({
          key: `fedpa_token_${amb}`,
          value: JSON.stringify({ token, created_at: Date.now() }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
    } catch { /* silenciar */ }
  }
}

async function obtenerTokenDeDB(amb: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Intentar fedpa_tokens primero
    const { data } = await (supabase as any)
      .from('fedpa_tokens')
      .select('token, expires_at, last_ok_at')
      .eq('amb', amb)
      .single();
    
    if (data?.token) {
      const expiresAt = new Date(data.expires_at).getTime();
      const age = Date.now() - new Date(data.last_ok_at || data.expires_at).getTime() + TOKEN_TTL_MS;
      if (expiresAt > Date.now()) {
        const minLeft = Math.round((expiresAt - Date.now()) / 60000);
        console.log(`[FEDPA Auth] Token de DB válido (amb=${amb}, ${minLeft}min restantes, ...${data.token.slice(-6)})`);
        return data.token;
      }
      // Token expirado pero lo tenemos — puede servir para probe
      console.log(`[FEDPA Auth] Token de DB expirado (amb=${amb}), intentando probe...`);
      return data.token; // Devolver para que el caller haga probe
    }
  } catch {
    // Tabla puede no existir aún
  }
  
  // Fallback: system_config (legacy)
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await (supabase as any)
      .from('system_config')
      .select('value')
      .eq('key', `fedpa_token_${amb}`)
      .single();
    
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (parsed.token) {
        console.log(`[FEDPA Auth] Token de system_config (legacy, amb=${amb})`);
        return parsed.token;
      }
    }
  } catch { /* silenciar */ }
  
  return null;
}

async function actualizarLastOk(amb: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await (supabase as any)
      .from('fedpa_tokens')
      .update({ last_ok_at: new Date().toISOString(), expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString() })
      .eq('amb', amb);
  } catch { /* silenciar */ }
}

// ============================================
// PROBE: Verificar si un token aún sirve
// ============================================

async function probeToken(token: string, env: FedpaEnvironment): Promise<boolean> {
  try {
    const client = createFedpaClient('emisorPlan', env);
    client.setToken(token);
    
    // GET /planes es barato y requiere token válido
    const response = await client.get(EMISOR_PLAN_ENDPOINTS.PLANES);
    
    if (response.success) {
      console.log(`[FEDPA Auth] ✅ Probe OK — token aún válido (amb=${env})`);
      return true;
    }
    
    console.log(`[FEDPA Auth] ❌ Probe falló — token inválido (amb=${env}, error: ${typeof response.error === 'string' ? response.error : 'unknown'})`);
    return false;
  } catch {
    return false;
  }
}

// ============================================
// GENERAR TOKEN
// ============================================

/**
 * Generar nuevo token de autenticación.
 * Si FEDPA responde "Ya existe token registrado":
 *   - Busca token guardado en DB/cache
 *   - Si lo tiene, hace probe para verificar que sirve
 *   - Si NO lo tiene, devuelve NEEDS_FEDPA_TOKEN_RESET (sin spam)
 */
export async function generarToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string; needsReset?: boolean }> {
  const config = FEDPA_CONFIG[env];
  
  // VALIDACIÓN CRÍTICA: ENV VARS
  if (!config.usuario || !config.clave) {
    const missing = [];
    if (!config.usuario) missing.push('USUARIO_FEDPA');
    if (!config.clave) missing.push('CLAVE_FEDPA');
    const errorMsg = `Variables de entorno faltantes: ${missing.join(', ')}`;
    console.error('[FEDPA Auth] ERROR:', errorMsg);
    return { success: false, error: errorMsg };
  }
  
  const client = createFedpaClient('emisorPlan', env);
  const cacheKey = `fedpa_token_${env}`;
  
  const request: TokenRequest = {
    usuario: config.usuario,
    clave: config.clave,
    Amb: env,
  };
  
  console.log(`[FEDPA Auth] POST /generartoken (amb=${env}, usuario=${request.usuario})`);
  
  const response = await client.post<TokenResponse>(
    EMISOR_PLAN_ENDPOINTS.GENERAR_TOKEN,
    request
  );
  
  console.log('[FEDPA Auth] Respuesta generartoken:', {
    httpOk: response.success,
    registrado: response.data?.registrado,
    hasToken: !!(response.data?.token || response.data?.Token),
    msg: response.data?.msg,
  });
  
  if (!response.success) {
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error HTTP al generar token',
    };
  }
  
  // ── CASO 1: Token recibido (registrado: true + token presente) ──
  const token = response.data?.token || response.data?.Token
    || response.data?.access_token || response.data?.AccessToken
    || response.data?.jwt
    || (response.data?.data as any)?.token || (response.data?.data as any)?.Token
    || null;
  
  if (token && typeof token === 'string' && token.length > 10) {
    console.log(`[FEDPA Auth] ✅ Token generado (amb=${env}, ...${token.slice(-6)})`);
    tokenCache.set(cacheKey, { token, exp: Date.now() + TOKEN_TTL_MS });
    guardarTokenEnDB(env, token, 'generartoken').catch(() => {});
    return { success: true, token };
  }
  
  // ── CASO 2: "Ya existe token registrado" (sin token en respuesta) ──
  const msg = (response.data?.msg || response.data?.message || '').toLowerCase();
  const isYaExiste = msg.includes('ya existe') || response.data?.registrado === false;
  
  if (isYaExiste) {
    console.log(`[FEDPA Auth] ⚠️ "Ya existe token registrado" (amb=${env}). Buscando token guardado...`);
    
    // 2a. Cache memoria
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      console.log(`[FEDPA Auth] ✅ Token en cache memoria válido (amb=${env})`);
      return { success: true, token: cached.token };
    }
    
    // 2b. Base de datos (fedpa_tokens o system_config)
    const dbToken = await obtenerTokenDeDB(env);
    if (dbToken) {
      // Probe: verificar que el token aún funciona
      const isValid = await probeToken(dbToken, env);
      if (isValid) {
        tokenCache.set(cacheKey, { token: dbToken, exp: Date.now() + TOKEN_TTL_MS });
        actualizarLastOk(env).catch(() => {});
        return { success: true, token: dbToken };
      }
      console.warn(`[FEDPA Auth] Token de DB no pasó probe (amb=${env}). Token expirado en FEDPA.`);
    }
    
    // 2c. Cache memoria expirado (< 10 min) — intentar probe
    if (cached && cached.exp > Date.now() - 10 * 60 * 1000) {
      const isValid = await probeToken(cached.token, env);
      if (isValid) {
        tokenCache.set(cacheKey, { token: cached.token, exp: Date.now() + TOKEN_TTL_MS });
        actualizarLastOk(env).catch(() => {});
        return { success: true, token: cached.token };
      }
    }
    
    // 2d. NO tenemos token en ningún lado → NEEDS_FEDPA_TOKEN_RESET
    // NO reintentar, NO probar otro ambiente, NO spamear la API
    console.error(`[FEDPA Auth] ❌ NEEDS_FEDPA_TOKEN_RESET (amb=${env})`);
    console.error('[FEDPA Auth] FEDPA indica token existente pero no lo devuelve; no hay token local.');
    console.error('[FEDPA Auth] Requiere: esperar ~50 min para expiración, o reset manual del token en FEDPA.');
    return {
      success: false,
      needsReset: true,
      error: `FEDPA indica token existente pero no lo devuelve. No hay token local guardado. Espere ~50 min para que expire o solicite reset del token a FEDPA.`,
    };
  }
  
  // ── CASO 3: Respuesta inesperada ──
  console.error('[FEDPA Auth] Respuesta inesperada:', JSON.stringify(response.data).substring(0, 200));
  return {
    success: false,
    error: `Respuesta inesperada de FEDPA: ${response.data?.msg || 'Sin mensaje'}`,
  };
}

// ============================================
// OBTENER TOKEN (CON CACHE → DB → GENERAR)
// ============================================

/**
 * Obtener token válido. Orden:
 * 1. Cache memoria (si no expirado)
 * 2. DB fedpa_tokens (si no expirado)
 * 3. POST /generartoken
 */
export async function obtenerToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string; needsReset?: boolean }> {
  const cacheKey = `fedpa_token_${env}`;
  const now = Date.now();
  
  // 1. Cache memoria (renovar 5 min antes de expirar)
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp > now + 5 * 60 * 1000) {
    const minLeft = Math.round((cached.exp - now) / 60000);
    console.log(`[FEDPA Auth] Token desde cache (amb=${env}, ${minLeft}min restantes)`);
    return { success: true, token: cached.token };
  }
  
  // 2. DB (sobrevive reinicios)
  const dbToken = await obtenerTokenDeDB(env);
  if (dbToken) {
    // Verificar si parece válido (no expirado según DB)
    tokenCache.set(cacheKey, { token: dbToken, exp: now + TOKEN_TTL_MS });
    return { success: true, token: dbToken };
  }
  
  // 3. Generar nuevo
  console.log(`[FEDPA Auth] Sin token en cache/DB. Generando nuevo (amb=${env})...`);
  const result = await generarToken(env);
  
  // Si generación falla pero teníamos token reciente en cache (expiró hace < 5 min), usarlo
  if (!result.success && cached && cached.exp > now - 5 * 60 * 1000) {
    console.warn(`[FEDPA Auth] Generación falló, usando token reciente de cache (expiró hace ${Math.round((now - cached.exp) / 60000)}min)`);
    return { success: true, token: cached.token };
  }
  
  return result;
}

// ============================================
// RENOVAR TOKEN
// ============================================

/**
 * Forzar renovación de token (limpia cache + regenera)
 */
export async function renovarToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string; needsReset?: boolean }> {
  console.log(`[FEDPA Auth] Renovando token (amb=${env})...`);
  tokenCache.delete(`fedpa_token_${env}`);
  return generarToken(env);
}

// ============================================
// SEED MANUAL DE TOKEN
// ============================================

/**
 * Guardar un token manualmente (para cuando FEDPA no lo devuelve
 * pero el admin lo tiene de otra fuente, ej. Postman)
 */
export async function seedToken(
  env: FedpaEnvironment,
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || token.length < 10) {
    return { success: false, error: 'Token inválido (muy corto)' };
  }
  
  const cacheKey = `fedpa_token_${env}`;
  tokenCache.set(cacheKey, { token, exp: Date.now() + TOKEN_TTL_MS });
  await guardarTokenEnDB(env, token, 'manual_seed');
  
  console.log(`[FEDPA Auth] ✅ Token seeded manualmente (amb=${env}, ...${token.slice(-6)})`);
  return { success: true };
}

// ============================================
// VALIDAR TOKEN
// ============================================

export function validarToken(token: string): boolean {
  if (!token || token.trim().length === 0) return false;
  // JWT básico: 3 partes separadas por punto
  return token.split('.').length === 3;
}

// ============================================
// LIMPIAR CACHE
// ============================================

export function limpiarCacheTokens(): void {
  tokenCache.clear();
  console.log('[FEDPA Auth] Cache de tokens limpiado');
}

// ============================================
// OBTENER CLIENTE AUTENTICADO
// ============================================

/**
 * Crear cliente HTTP con token automático
 */
export async function obtenerClienteAutenticado(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; client?: any; token?: string; error?: string; needsReset?: boolean }> {
  const tokenResult = await obtenerToken(env);
  
  if (!tokenResult.success || !tokenResult.token) {
    return {
      success: false,
      error: tokenResult.error || 'No se pudo obtener token',
      needsReset: tokenResult.needsReset,
    };
  }
  
  const client = createFedpaClient('emisorPlan', env);
  client.setToken(tokenResult.token);
  
  return {
    success: true,
    client,
    token: tokenResult.token,
  };
}
