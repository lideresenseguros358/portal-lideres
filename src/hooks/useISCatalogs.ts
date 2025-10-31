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
        setLoading(true);
        const response = await fetch('/api/is/catalogs?type=marcas&env=development');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Convertir COD_MARCA de decimal a entero
            const marcasData = result.data.map((m: any) => ({
              COD_MARCA: Math.floor(parseFloat(m.COD_MARCA)),
              TXT_MARCA: m.TXT_MARCA,
            }));
            setMarcas(marcasData);
          }
        }
      } catch (error) {
        console.error('Error cargando marcas:', error);
      } finally {
        setLoading(false);
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
        setLoading(true);
        const response = await fetch(`/api/is/catalogs?type=modelos&marca=${selectedMarca}&env=development`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Convertir COD_MODELO de decimal a entero si viene con decimales
            const modelosData = result.data.map((m: any) => ({
              COD_MODELO: Math.floor(parseFloat(m.COD_MODELO || m.vcodmodelo)),
              TXT_MODELO: m.TXT_MODELO || m.vdescripcion,
            }));
            setModelos(modelosData);
          }
        }
      } catch (error) {
        console.error('Error cargando modelos:', error);
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
