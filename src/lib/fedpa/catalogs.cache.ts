/**
 * Sistema de caché para catálogos FEDPA
 * Almacena en localStorage con TTL de 24 horas
 */

import type { FedpaCatalogs } from './catalogs.types';

const CACHE_KEY = 'fedpa_catalogs';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

interface CachedData {
  data: FedpaCatalogs;
  timestamp: number;
}

/**
 * Guardar catálogos en caché
 */
export function saveCatalogsToCache(catalogs: FedpaCatalogs): void {
  try {
    const cached: CachedData = {
      data: catalogs,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    console.log('[FEDPA Cache] Catálogos guardados en caché');
  } catch (error) {
    console.error('[FEDPA Cache] Error guardando caché:', error);
  }
}

/**
 * Obtener catálogos de caché
 * Retorna null si no existe o está expirado
 */
export function getCatalogsFromCache(): FedpaCatalogs | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      console.log('[FEDPA Cache] No hay caché disponible');
      return null;
    }

    const parsed: CachedData = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_TTL) {
      console.log('[FEDPA Cache] Caché expirado (edad: ' + Math.round(age / 1000 / 60) + ' minutos)');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    console.log('[FEDPA Cache] Catálogos recuperados de caché');
    return parsed.data;
  } catch (error) {
    console.error('[FEDPA Cache] Error leyendo caché:', error);
    return null;
  }
}

/**
 * Limpiar caché de catálogos
 */
export function clearCatalogsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[FEDPA Cache] Caché limpiado');
  } catch (error) {
    console.error('[FEDPA Cache] Error limpiando caché:', error);
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
