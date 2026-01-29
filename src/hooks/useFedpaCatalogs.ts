/**
 * Hook para usar catálogos FEDPA
 * Implementa caché automático y revalidación
 */

import { useState, useEffect, useCallback } from 'react';
import type { FedpaCatalogs, FedpaLimite, FedpaPlan, FedpaBeneficio, FedpaUso } from '@/lib/fedpa/catalogs.types';
import { getCatalogsFromCache, saveCatalogsToCache, isCacheValid } from '@/lib/fedpa/catalogs.cache';

interface UseFedpaCatalogsReturn {
  catalogs: FedpaCatalogs | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  
  // Helpers
  getLimitesPorCobertura: (codCobertura: number) => FedpaLimite[];
  getPlanesPorUso: (uso: string) => FedpaPlan[];
  getBeneficiosPlan: (planId: number) => string[];
  getPlan: (planId: number) => FedpaPlan | null;
  getUso: (codigo: string) => FedpaUso | null;
}

export function useFedpaCatalogs(env: 'DEV' | 'PROD' = 'PROD'): UseFedpaCatalogsReturn {
  const [catalogs, setCatalogs] = useState<FedpaCatalogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogs = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      // Intentar cargar de caché primero
      if (!force && typeof window !== 'undefined') {
        const cached = getCatalogsFromCache();
        if (cached) {
          console.log('[useFedpaCatalogs] Usando catálogos desde caché');
          setCatalogs(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch desde API
      console.log('[useFedpaCatalogs] Obteniendo catálogos desde API...');
      const response = await fetch(`/api/fedpa/catalogos?env=${env}`);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo catálogos');
      }

      const catalogsData = result.data as FedpaCatalogs;
      setCatalogs(catalogsData);

      // Guardar en caché
      if (typeof window !== 'undefined') {
        saveCatalogsToCache(catalogsData);
      }

      console.log('[useFedpaCatalogs] Catálogos cargados exitosamente');
      setLoading(false);

    } catch (err) {
      console.error('[useFedpaCatalogs] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  }, [env]);

  // Cargar catálogos al montar
  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  // Helpers
  const getLimitesPorCobertura = useCallback((codCobertura: number): FedpaLimite[] => {
    if (!catalogs) return [];
    return catalogs.limites.filter(l => l.CODCOBERTURA === codCobertura);
  }, [catalogs]);

  const getPlanesPorUso = useCallback((uso: string): FedpaPlan[] => {
    if (!catalogs) return [];
    return catalogs.planes.filter(p => p.USO === uso);
  }, [catalogs]);

  const getBeneficiosPlan = useCallback((planId: number): string[] => {
    if (!catalogs) return [];
    return catalogs.beneficios
      .filter(b => b.PLAN === planId)
      .map(b => b.BENEFICIOS);
  }, [catalogs]);

  const getPlan = useCallback((planId: number): FedpaPlan | null => {
    if (!catalogs) return null;
    return catalogs.planes.find(p => p.PLAN === planId) || null;
  }, [catalogs]);

  const getUso = useCallback((codigo: string): FedpaUso | null => {
    if (!catalogs) return null;
    return catalogs.usos.find(u => u.USO === codigo) || null;
  }, [catalogs]);

  const refresh = useCallback(async () => {
    await fetchCatalogs(true);
  }, [fetchCatalogs]);

  return {
    catalogs,
    loading,
    error,
    refresh,
    getLimitesPorCobertura,
    getPlanesPorUso,
    getBeneficiosPlan,
    getPlan,
    getUso
  };
}
