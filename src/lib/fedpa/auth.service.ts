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
  
  // VALIDACIÓN CRÍTICA: ENV VARS
  if (!config.usuario || !config.clave) {
    const missing = [];
    if (!config.usuario) missing.push('USUARIO_FEDPA');
    if (!config.clave) missing.push('CLAVE_FEDPA');
    const errorMsg = `Variables de entorno faltantes: ${missing.join(', ')}`;
    console.error('[FEDPA Auth] ERROR:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
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
  
  // A1: Log detallado para diagnosticar respuesta
  console.log('[FEDPA Auth] Respuesta completa:', {
    success: response.success,
    statusCode: response.statusCode,
    hasData: !!response.data,
    dataKeys: response.data ? Object.keys(response.data) : [],
    dataType: response.data ? typeof response.data : 'undefined',
    dataSample: response.data ? JSON.stringify(response.data).substring(0, 200) : null,
    error: response.error,
  });
  
  if (!response.success) {
    console.error('[FEDPA Auth] Error generando token:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'No se pudo generar el token';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  // A1: PARSEO ROBUSTO según manual FEDPA
  let token: string | null = null;
  
  if (response.data) {
    // Según doc FEDPA: response = { "success": true, "registrado": true, "token": "eyJ..." }
    // Intentar múltiples formatos posibles
    token = response.data.token || 
            response.data.Token || 
            response.data.access_token || 
            response.data.AccessToken ||
            response.data.jwt ||
            null;
    
    // Si viene anidado en data.data
    if (!token && response.data.data) {
      token = response.data.data.token || response.data.data.Token || null;
    }
    
    // Si la respuesta completa es string (token directo)
    if (!token && typeof response.data === 'string') {
      token = response.data;
    }
  }
  
  if (!token) {
    // FEDPA P2: MANEJO ROBUSTO - "Ya existe token registrado" es VÁLIDO
    // Cuando FEDPA responde success:true pero sin token:
    // - Puede significar que ya hay token vigente en backend FEDPA
    // - O que debemos reutilizar token de cache
    
    const msgLower = response.data?.msg?.toLowerCase() || '';
    const isTokenExistsMessage = msgLower.includes('ya existe') || msgLower.includes('token registrado');
    
    if (response.data?.success && isTokenExistsMessage) {
      console.log('[FEDPA Auth] ⚠️ API indica token ya existe pero no lo devuelve');
      
      // Intentar usar token de cache si existe
      const cacheKey = `fedpa_token_${env}`;
      const cached = tokenCache.get(cacheKey);
      
      if (cached && cached.exp > Date.now()) {
        console.log('[FEDPA Auth] ✓ Usando token de cache (válido por', Math.round((cached.exp - Date.now()) / 1000 / 60), 'min)');
        return {
          success: true,
          token: cached.token,
        };
      }
      
      // Si no hay cache válido, esto es un ERROR
      // La API debe devolver el token o permitir generar uno nuevo
      const errorMsg = 'FEDPA dice que ya existe token pero no lo devuelve y no hay cache válido';
      console.error('[FEDPA Auth] ❌ ERROR:', errorMsg);
      console.error('[FEDPA Auth] Solución: Implementar endpoint de invalidar/renovar token en FEDPA');
      console.error('[FEDPA Auth] Workaround: Esperar a que token expire en backend FEDPA');
      
      return {
        success: false,
        error: errorMsg,
      };
    }
    
    // Solo ahora es realmente un error
    const errorMsg = 'Token no encontrado en respuesta FEDPA';
    console.error('[FEDPA Auth] ERROR:', errorMsg);
    console.error('[FEDPA Auth] Response keys:', response.data ? Object.keys(response.data) : 'no data');
    console.error('[FEDPA Auth] Response sample (primeros 200 chars):', 
      response.data ? JSON.stringify(response.data).substring(0, 200) : 'null'
    );
    
    if (response.data && 'msg' in response.data) {
      console.error('[FEDPA Auth] Mensaje de API:', response.data.msg);
    }
    
    return {
      success: false,
      error: `${errorMsg}. ${response.data && 'msg' in response.data ? 'API dice: ' + response.data.msg : 'Revisar credenciales.'}`,
    };
  }
  
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
