/**
 * Hook para cargar catálogos de INTERNACIONAL
 */

import { useState, useEffect } from 'react';

export interface Marca {
  COD_MARCA: number;
  TXT_MARCA: string;
}

export interface Modelo {
  COD_MODELO: number;
  TXT_MODELO: string;
}

export function useISCatalogs() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [selectedMarca, setSelectedMarca] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar marcas al montar
  useEffect(() => {
    const loadMarcas = async () => {
      try {
        console.log('[useISCatalogs] Iniciando carga de marcas...');
        setLoading(true);
        const response = await fetch('/api/is/catalogs?type=marcas&env=development');
        console.log('[useISCatalogs] Response status:', response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log('[useISCatalogs] Result recibido:', result.success);
          
          if (result.success && Array.isArray(result.data)) {
            console.log('[useISCatalogs] Marcas encontradas:', result.data.length);
            
            // Mapear campos de BD local: vcodmarca -> COD_MARCA, vdescripcion -> TXT_MARCA
            const marcasData = result.data.map((m: any) => ({
              COD_MARCA: parseInt(m.vcodmarca),
              TXT_MARCA: m.vdescripcion,
            }));
            
            console.log('[useISCatalogs] Total marcas cargadas:', marcasData.length);
            setMarcas(marcasData);
          } else {
            console.warn('[useISCatalogs] Result no exitoso o data no es array:', result);
          }
        } else {
          console.error('[useISCatalogs] Response no OK:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('[useISCatalogs] Error body:', errorText);
        }
      } catch (error) {
        console.error('[useISCatalogs] Error cargando marcas:', error);
      } finally {
        setLoading(false);
        console.log('[useISCatalogs] Carga de marcas finalizada');
      }
    };

    loadMarcas();
  }, []);

  // Cargar modelos cuando cambia la marca seleccionada
  useEffect(() => {
    if (!selectedMarca) {
      setModelos([]);
      return;
    }

    const loadModelos = async () => {
      try {
        console.log('[useISCatalogs] Cargando modelos para marca:', selectedMarca);
        setLoading(true);
        const response = await fetch(`/api/is/catalogs?type=modelos&marca=${selectedMarca}&env=development`);
        
        if (response.ok) {
          const result = await response.json();
          console.log('[useISCatalogs] Modelos - result.success:', result.success);
          
          if (result.success && Array.isArray(result.data)) {
            console.log('[useISCatalogs] Modelos encontrados:', result.data.length);
            
            // Mapear campos de BD local: vcodmodelo -> COD_MODELO, vdescripcion -> TXT_MODELO
            const modelosData = result.data.map((m: any) => ({
              COD_MODELO: parseInt(m.vcodmodelo),
              TXT_MODELO: m.vdescripcion,
            }));
            
            console.log('[useISCatalogs] Total modelos cargados:', modelosData.length);
            setModelos(modelosData);
          } else {
            console.warn('[useISCatalogs] Result modelos no exitoso o data no es array');
          }
        }
      } catch (error) {
        console.error('[useISCatalogs] Error cargando modelos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModelos();
  }, [selectedMarca]);

  return {
    marcas,
    modelos,
    selectedMarca,
    setSelectedMarca,
    loading,
  };
}
