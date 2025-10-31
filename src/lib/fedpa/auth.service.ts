/**
 * Servicio de Autenticación FEDPA
 * Gestión de tokens (EmisorPlan 2024)
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
// GENERAR TOKEN
// ============================================

/**
 * Generar nuevo token de autenticación
 */
export async function generarToken(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; token?: string; error?: string }> {
  const config = FEDPA_CONFIG[env];
  
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
  
  if (!response.success || !response.data?.token) {
    console.error('[FEDPA Auth] Error:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'No se pudo generar el token';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  const token = response.data.token;
  const exp = Date.now() + TOKEN_TTL_MS;
  
  // Guardar en cache memoria
  const cacheKey = `fedpa_token_${env}`;
  tokenCache.set(cacheKey, { token, exp });
  
  // TODO: Guardar en BD cuando se cree tabla fedpa_tokens
  // try {
  //   const supabase = getSupabaseAdmin();
  //   await supabase
  //     .from('fedpa_tokens')
  //     .upsert({
  //       session_id: cacheKey,
  //       token,
  //       exp,
  //       amb: env,
  //       created_at: new Date().toISOString(),
  //     });
  // } catch (dbError) {
  //   console.warn('[FEDPA Auth] No se pudo guardar token en BD:', dbError);
  // }
  
  console.log('[FEDPA Auth] Token generado exitosamente');
  
  return {
    success: true,
    token,
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
  
  // 1. Verificar cache memoria
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.exp > Date.now() + 5 * 60 * 1000) { // Renovar 5 min antes
    console.log('[FEDPA Auth] Usando token desde cache');
    return {
      success: true,
      token: cached.token,
    };
  }
  
  // 2. TODO: Verificar BD cuando se cree tabla fedpa_tokens
  // try {
  //   const supabase = getSupabaseAdmin();
  //   const { data } = await supabase
  //     .from('fedpa_tokens')
  //     .select('*')
  //     .eq('session_id', cacheKey)
  //     .eq('amb', env)
  //     .single();
  //   
  //   if (data && data.exp > Date.now() + 5 * 60 * 1000) {
  //     console.log('[FEDPA Auth] Usando token desde BD');
  //     // Actualizar cache memoria
  //     tokenCache.set(cacheKey, { token: data.token, exp: data.exp });
  //     return {
  //       success: true,
  //       token: data.token,
  //     };
  //   }
  // } catch (dbError) {
  //   console.warn('[FEDPA Auth] Error consultando BD:', dbError);
  // }
  
  // 3. Generar nuevo token
  console.log('[FEDPA Auth] Generando nuevo token...');
  return generarToken(env);
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
