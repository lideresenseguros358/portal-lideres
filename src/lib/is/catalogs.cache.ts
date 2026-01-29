/**
 * Sistema de caché para catálogos IS
 * Almacena en localStorage con TTL de 24 horas
 */

import type { ISCatalogs } from './catalogs.types';

const CACHE_KEY = 'is_catalogs';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

interface CachedData {
  data: ISCatalogs;
  timestamp: number;
}

/**
 * Guardar catálogos en caché
 */
export function saveCatalogsToCache(catalogs: ISCatalogs): void {
  try {
    const cached: CachedData = {
      data: catalogs,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    console.log('[IS Cache] Catálogos guardados en caché');
  } catch (error) {
    console.error('[IS Cache] Error guardando caché:', error);
  }
}

/**
 * Obtener catálogos de caché
 * Retorna null si no existe o está expirado
 */
export function getCatalogsFromCache(): ISCatalogs | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      console.log('[IS Cache] No hay caché disponible');
      return null;
    }

    const parsed: CachedData = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_TTL) {
      console.log('[IS Cache] Caché expirado (edad: ' + Math.round(age / 1000 / 60) + ' minutos)');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    console.log('[IS Cache] Catálogos recuperados de caché');
    return parsed.data;
  } catch (error) {
    console.error('[IS Cache] Error leyendo caché:', error);
    return null;
  }
}

/**
 * Limpiar caché de catálogos
 */
export function clearCatalogsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[IS Cache] Caché limpiado');
  } catch (error) {
    console.error('[IS Cache] Error limpiando caché:', error);
  }
}

/**
 * Verificar si el caché es válido
 */
export function isCacheValid(): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const parsed: CachedData = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    return age <= CACHE_TTL;
  } catch {
    return false;
  }
}

/**
 * Obtener edad del caché en minutos
 */
export function getCacheAge(): number | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedData = JSON.parse(cached);
    const ageMs = Date.now() - parsed.timestamp;
    return Math.round(ageMs / 1000 / 60);
  } catch {
    return null;
  }
}
