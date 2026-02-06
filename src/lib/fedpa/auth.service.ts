/**
 * Servicio de Autenticación FEDPA
 * Gestión de tokens (EmisorPlan 2024)
 * 
 * FLUJO según documentación oficial:
 * POST https://wscanales.segfedpa.com/EmisorPlan/api/generartoken
 * Body: { "usuario": "SLIDERES", "clave": "lider836", "Amb": "DEV" }
 * Response OK: { "success": true, "registrado": true, "token": "eyJ..." }
 * Response Ya existe: { "success": true, "registrado": false, "msg": "Ya existe token registrado" }
 */

import { createFedpaClient } from './http-client';
import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_PLAN_ENDPOINTS, TOKEN_TTL_MS } from './config';
import type { TokenRequest, TokenResponse } from './types';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ============================================
// CACHE EN MEMORIA
// ============================================

const tokenCache = new Map<string, { token: string; exp: number }>();

// ============================================
// PERSISTENCIA EN BD (sobrevive reinicios)
// ============================================

async function guardarTokenEnBD(env: string, token: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await (supabase as any)
      .from('system_config')
      .upsert({
        key: `fedpa_token_${env}`,
        value: JSON.stringify({ token, created_at: Date.now() }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    console.log('[FEDPA Auth] Token guardado en BD');
  } catch (err) {
    console.warn('[FEDPA Auth] No se pudo guardar token en BD (tabla system_config puede no existir):', (err as any)?.message);
  }
}

async function obtenerTokenDeBD(env: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await (supabase as any)
      .from('system_config')
      .select('value, updated_at')
      .eq('key', `fedpa_token_${env}`)
      .single();
    
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      const age = Date.now() - (parsed.created_at || 0);
      // Token válido si tiene menos de 50 minutos
      if (age < TOKEN_TTL_MS && parsed.token) {
        console.log('[FEDPA Auth] Token recuperado de BD (edad:', Math.round(age / 1000 / 60), 'min)');
        return parsed.token;
      }
    }
  } catch (err) {
    // Tabla puede no existir - no es error crítico
  }
  return null;
}

// ============================================
// GENERAR TOKEN
// ============================================

/**
 * Generar nuevo token de autenticación
 */
export async function generarToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string }> {
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
  
  const request: TokenRequest = {
    usuario: config.usuario,
    clave: config.clave,
    Amb: env,
  };
  
  console.log('[FEDPA Auth] Generando token...', { usuario: request.usuario, amb: request.Amb });
  
  const response = await client.post<TokenResponse>(
    EMISOR_PLAN_ENDPOINTS.GENERAR_TOKEN,
    request
  );
  
  console.log('[FEDPA Auth] Respuesta:', {
    httpSuccess: response.success,
    dataKeys: response.data ? Object.keys(response.data) : [],
    registrado: response.data?.registrado,
    hasToken: !!response.data?.token,
    msg: response.data?.msg,
  });
  
  if (!response.success) {
    console.error('[FEDPA Auth] Error HTTP:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'No se pudo generar el token',
    };
  }
  
  // CASO 1: Token generado exitosamente (registrado: true + token presente)
  const token = response.data?.token || response.data?.Token || null;
  
  if (token) {
    console.log('[FEDPA Auth] ✅ Token generado exitosamente');
    const cacheKey = `fedpa_token_${env}`;
    tokenCache.set(cacheKey, { token, exp: Date.now() + TOKEN_TTL_MS });
    // Persistir en BD para sobrevivir reinicios
    guardarTokenEnBD(env, token).catch(() => {});
    return { success: true, token };
  }
  
  // CASO 2: "Ya existe token registrado" (registrado: false, sin token)
  // La API FEDPA no devuelve el token existente - debemos usar el guardado
  const msg = response.data?.msg || '';
  if (msg.toLowerCase().includes('ya existe') || response.data?.registrado === false) {
    console.log('[FEDPA Auth] ⚠️ API dice: Ya existe token. Buscando token guardado...');
    
    // Intentar cache memoria
    const cacheKey = `fedpa_token_${env}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      console.log('[FEDPA Auth] ✅ Usando token de cache memoria');
      return { success: true, token: cached.token };
    }
    
    // Intentar BD (sobrevive reinicios del servidor)
    const bdToken = await obtenerTokenDeBD(env);
    if (bdToken) {
      console.log('[FEDPA Auth] ✅ Usando token de BD');
      tokenCache.set(cacheKey, { token: bdToken, exp: Date.now() + TOKEN_TTL_MS });
      return { success: true, token: bdToken };
    }
    
    // No tenemos token guardado - intentar decodificar JWT del token principal
    // para ver si podemos usarlo directamente
    console.warn('[FEDPA Auth] ⚠️ No hay token guardado. Esperando 2s y reintentando...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reintentar una vez más
    const retryResponse = await client.post<TokenResponse>(
      EMISOR_PLAN_ENDPOINTS.GENERAR_TOKEN,
      request
    );
    
    const retryToken = retryResponse.data?.token || retryResponse.data?.Token || null;
    if (retryToken) {
      console.log('[FEDPA Auth] ✅ Token obtenido en reintento');
      tokenCache.set(cacheKey, { token: retryToken, exp: Date.now() + TOKEN_TTL_MS });
      guardarTokenEnBD(env, retryToken).catch(() => {});
      return { success: true, token: retryToken };
    }
    
    // Último recurso: la API sigue diciendo "ya existe" y no tenemos el token
    // Esto pasa cuando el servidor se reinicia y el token anterior se pierde
    // Necesitamos esperar a que el token de FEDPA expire (generalmente ~50 min)
    console.error('[FEDPA Auth] ❌ Token existe en FEDPA pero no lo tenemos guardado.');
    console.error('[FEDPA Auth] El token de FEDPA expirará automáticamente. Reintentar en unos minutos.');
    return {
      success: false,
      error: 'Token FEDPA existe pero no está disponible localmente. Espere unos minutos e intente de nuevo.',
    };
  }
  
  // CASO 3: Error desconocido
  console.error('[FEDPA Auth] Respuesta inesperada:', JSON.stringify(response.data).substring(0, 200));
  return {
    success: false,
    error: `Respuesta inesperada de FEDPA: ${response.data?.msg || 'Sin mensaje'}`,
  };
}

// ============================================
// OBTENER TOKEN (CON CACHE)
// ============================================

/**
 * Obtener token válido (desde cache o generando nuevo)
 */
export async function obtenerToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string }> {
  const cacheKey = `fedpa_token_${env}`;
  const now = Date.now();
  
  // 1. Verificar cache memoria
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp > now + 5 * 60 * 1000) { // Renovar 5 min antes
    console.log('[FEDPA Auth] Usando token desde cache (válido por', Math.round((cached.exp - now) / 1000 / 60), 'min)');
    return {
      success: true,
      token: cached.token,
    };
  }
  
  // Cache expiró o no existe
  if (cached) {
    console.log('[FEDPA Auth] Token en cache expirado, regenerando...');
  }
  
  // 2. Verificar BD (sobrevive reinicios del servidor)
  const bdToken = await obtenerTokenDeBD(env);
  if (bdToken) {
    console.log('[FEDPA Auth] Usando token desde BD');
    tokenCache.set(cacheKey, { token: bdToken, exp: Date.now() + TOKEN_TTL_MS });
    return { success: true, token: bdToken };
  }
  
  // 3. Generar nuevo token
  console.log('[FEDPA Auth] Generando nuevo token...');
  const result = await generarToken(env);
  
  // Si falla y teníamos token anterior válido (expiró hace poco), usarlo temporalmente
  if (!result.success && cached && cached.exp > now - 5 * 60 * 1000) {
    console.warn('[FEDPA Auth] Generación falló pero token anterior aún utilizable (expiró hace', Math.round((now - cached.exp) / 1000 / 60), 'min)');
    return {
      success: true,
      token: cached.token,
    };
  }
  
  return result;
}

// ============================================
// RENOVAR TOKEN
// ============================================

/**
 * Forzar renovación de token
 */
export async function renovarToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string }> {
  console.log('[FEDPA Auth] Renovando token...');
  
  // Limpiar cache
  const cacheKey = `fedpa_token_${env}`;
  tokenCache.delete(cacheKey);
  
  // Generar nuevo
  return generarToken(env);
}

// ============================================
// VALIDAR TOKEN
// ============================================

/**
 * Verificar si token es válido
 */
export function validarToken(token: string): boolean {
  if (!token || token.trim().length === 0) {
    return false;
  }
  
  // Verificar formato JWT básico (3 partes separadas por punto)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  return true;
}

// ============================================
// LIMPIAR CACHE
// ============================================

/**
 * Limpiar cache de tokens (útil para testing)
 */
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
): Promise<{ success: boolean; client?: any; error?: string }> {
  const tokenResult = await obtenerToken(env);
  
  if (!tokenResult.success || !tokenResult.token) {
    return {
      success: false,
      error: tokenResult.error || 'No se pudo obtener token',
    };
  }
  
  const client = createFedpaClient('emisorPlan', env);
  client.setToken(tokenResult.token);
  
  return {
    success: true,
    client,
  };
}
