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

async function guardarTokenEnDB(amb: string, token: string, source: string = 'generartoken'): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    
    const { error } = await (supabase as any)
      .from('fedpa_tokens')
      .upsert({
        amb,
        token,
        created_at: now,
        expires_at: expiresAt,
        last_ok_at: now,
        source,
      }, { onConflict: 'amb' });
    
    if (error) {
      console.error(`[FEDPA Auth] ERROR guardando token en DB (amb=${amb}):`, error.message || error);
      return false;
    }
    
    console.log(`[FEDPA Auth] ✅ Token GUARDADO en DB (amb=${amb}, source=${source}, ...${token.slice(-6)})`);
    return true;
  } catch (err) {
    console.error('[FEDPA Auth] EXCEPCIÓN guardando token en DB:', (err as any)?.message);
    return false;
  }
}

async function obtenerTokenDeDB(amb: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await (supabase as any)
      .from('fedpa_tokens')
      .select('token, expires_at, last_ok_at')
      .eq('amb', amb)
      .single();
    
    if (error) {
      console.warn(`[FEDPA Auth] DB read error (amb=${amb}):`, error.message || error.code);
      return null;
    }
    
    if (data?.token) {
      const expiresAt = new Date(data.expires_at).getTime();
      if (expiresAt > Date.now()) {
        const minLeft = Math.round((expiresAt - Date.now()) / 60000);
        console.log(`[FEDPA Auth] Token de DB válido (amb=${amb}, ${minLeft}min restantes, ...${data.token.slice(-6)})`);
        return data.token;
      }
      console.log(`[FEDPA Auth] Token de DB expirado (amb=${amb}), intentando probe...`);
      return data.token;
    }
  } catch (err) {
    console.error(`[FEDPA Auth] Excepción leyendo token de DB (amb=${amb}):`, (err as any)?.message);
  }
  
  console.log(`[FEDPA Auth] No hay token en DB para amb=${amb}`);
  return null;
}

async function limpiarTokenDeDB(amb: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await (supabase as any)
      .from('fedpa_tokens')
      .delete()
      .eq('amb', amb);
    if (error) {
      console.warn(`[FEDPA Auth] Error limpiando token de DB (amb=${amb}):`, error.message);
    } else {
      console.log(`[FEDPA Auth] Token eliminado de DB (amb=${amb})`);
    }
  } catch (err) {
    console.warn(`[FEDPA Auth] Excepción limpiando token de DB:`, (err as any)?.message);
  }
}

async function actualizarLastOk(amb: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await (supabase as any)
      .from('fedpa_tokens')
      .update({ last_ok_at: new Date().toISOString(), expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString() })
      .eq('amb', amb);
    if (error) {
      console.warn(`[FEDPA Auth] Error actualizando last_ok (amb=${amb}):`, error.message);
    }
  } catch (err) {
    console.warn(`[FEDPA Auth] Excepción actualizando last_ok:`, (err as any)?.message);
  }
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
    // CRITICAL: await DB save — do NOT fire-and-forget
    const saved = await guardarTokenEnDB(env, token, 'generartoken');
    if (!saved) {
      console.error(`[FEDPA Auth] ⚠️ Token generado pero NO se guardó en DB (amb=${env}). Si el server reinicia, se perderá.`);
    }
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
      console.warn(`[FEDPA Auth] Token de DB no pasó probe (amb=${env}). Limpiando token expirado de DB...`);
      // Limpiar token expirado de DB para que no bloquee futuras generaciones
      await limpiarTokenDeDB(env);
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
    
    // 2d. Intentar extraer token de CUALQUIER campo string largo en la respuesta
    const rawData = response.data as any;
    if (rawData && typeof rawData === 'object') {
      for (const key of Object.keys(rawData)) {
        const val = rawData[key];
        if (typeof val === 'string' && val.length > 50 && val.includes('.')) {
          // Parece un JWT
          console.log(`[FEDPA Auth] 🔍 Posible token encontrado en campo "${key}" (${val.length} chars)`);
          tokenCache.set(cacheKey, { token: val, exp: Date.now() + TOKEN_TTL_MS });
          await guardarTokenEnDB(env, val, 'extracted_from_response');
          return { success: true, token: val };
        }
      }
      // Log completo para debugging
      console.warn('[FEDPA Auth] Respuesta completa (sin token encontrado):', JSON.stringify(rawData).substring(0, 500));
    }
    
    // 2e. NO tenemos token en ningún lado → NEEDS_FEDPA_TOKEN_RESET
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
  
  // 4. Si needsReset, reintentar con esperas progresivas (el token FEDPA expira en ~50 min)
  // Intentar 3 veces con esperas de 15s cada una (total ~45s)
  if (result.needsReset) {
    const RETRY_DELAYS = [15_000, 15_000, 15_000]; // 3 reintentos de 15s
    
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      const delay = RETRY_DELAYS[i] ?? 15_000;
      console.log(`[FEDPA Auth] ⏳ Token bloqueado. Reintento ${i + 1}/${RETRY_DELAYS.length} en ${delay / 1000}s (amb=${env})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Revisar DB primero (otro proceso pudo haber guardado el token)
      const dbTokenRetry = await obtenerTokenDeDB(env);
      if (dbTokenRetry) {
        const isValid = await probeToken(dbTokenRetry, env);
        if (isValid) {
          tokenCache.set(cacheKey, { token: dbTokenRetry, exp: Date.now() + TOKEN_TTL_MS });
          actualizarLastOk(env).catch(() => {});
          console.log(`[FEDPA Auth] ✅ Token recuperado de DB en reintento ${i + 1} (amb=${env})`);
          return { success: true, token: dbTokenRetry };
        }
        // Token de DB no sirve, limpiarlo
        await limpiarTokenDeDB(env);
      }
      
      // Intentar generar nuevo
      const retryResult = await generarToken(env);
      if (retryResult.success) {
        console.log(`[FEDPA Auth] ✅ Retry ${i + 1} exitoso (amb=${env})`);
        return retryResult;
      }
      
      // Si ya no es needsReset (otro error), no seguir reintentando
      if (!retryResult.needsReset) {
        return retryResult;
      }
    }
    
    // Todos los reintentos fallaron
    console.error(`[FEDPA Auth] ❌ Todos los reintentos fallaron (amb=${env}). Token FEDPA bloqueado.`);
    return {
      success: false,
      needsReset: true,
      error: `Token FEDPA bloqueado después de ${RETRY_DELAYS.length} reintentos. El token existente en FEDPA no ha expirado aún (~50 min TTL). Espere o use la función de seed manual.`,
    };
  }
  
  return result;
}

// ============================================
// FAST TOKEN CHECK (no generation, no retries)
// ============================================

/**
 * Quick check if a token is available in cache or DB.
 * Does NOT generate a new token, does NOT retry.
 * Returns in <100ms typically.
 */
export async function checkTokenDisponible(
  env: FedpaEnvironment = 'PROD'
): Promise<{ hasToken: boolean; token?: string }> {
  const cacheKey = `fedpa_token_${env}`;
  const now = Date.now();

  // 1. Memory cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp > now + 60_000) {
    return { hasToken: true, token: cached.token };
  }

  // 2. DB
  try {
    const dbToken = await obtenerTokenDeDB(env);
    if (dbToken) {
      tokenCache.set(cacheKey, { token: dbToken, exp: now + TOKEN_TTL_MS });
      return { hasToken: true, token: dbToken };
    }
  } catch { /* ignore */ }

  return { hasToken: false };
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
