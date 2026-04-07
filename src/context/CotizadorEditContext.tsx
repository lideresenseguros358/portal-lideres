'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface CotizadorInsurerSetting {
  id: string;
  slug: string;
  display_name: string;
  logo_key: string | null;
  tp_activo: boolean;
  cc_activo: boolean;
  created_at: string;
  updated_at: string;
}

interface CotizadorEditContextType {
  isMaster: boolean;
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  insurerSettings: CotizadorInsurerSetting[];
  loadingSettings: boolean;
  loadSettings: () => Promise<void>;
  toggleInsurerSetting: (slug: string, field: 'tp_activo' | 'cc_activo', value: boolean) => Promise<void>;
}

export const CotizadorEditContext = createContext<CotizadorEditContextType>({
  isMaster: false,
  editMode: false,
  setEditMode: () => {},
  insurerSettings: [],
  loadingSettings: false,
  loadSettings: async () => {},
  toggleInsurerSetting: async () => {},
});

export function useCotizadorEdit() {
  const context = useContext(CotizadorEditContext);
  if (!context) {
    throw new Error('useCotizadorEdit must be used within CotizadorEditProvider');
  }
  return context;
}

interface CotizadorEditProviderProps {
  children: React.ReactNode;
  isMaster: boolean;
}

export function CotizadorEditProvider({ children, isMaster }: CotizadorEditProviderProps) {
  const [editMode, setEditMode] = useState(false);
  const [insurerSettings, setInsurerSettings] = useState<CotizadorInsurerSetting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const res = await fetch('/api/cotizadores/insurer-settings');
      if (res.ok) {
        const data = await res.json();
        setInsurerSettings(data.settings || []);
      }
    } catch (err) {
      console.error('Failed to load insurer settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const toggleInsurerSetting = useCallback(
    async (slug: string, field: 'tp_activo' | 'cc_activo', value: boolean) => {
      if (!isMaster) return;

      try {
        const res = await fetch(`/api/cotizadores/insurer-settings?slug=${slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });

        if (res.ok) {
          const updatedSetting = await res.json();
          setInsurerSettings(prev =>
            prev.map(s => (s.slug === slug ? updatedSetting.setting : s))
          );
        }
      } catch (err) {
        console.error(`Failed to update insurer ${slug}:`, err);
      }
    },
    [isMaster]
  );

  // Load settings on mount if master
  useEffect(() => {
    if (isMaster) {
      loadSettings();
    }
  }, [isMaster, loadSettings]);

  return (
    <CotizadorEditContext.Provider
      value={{
        isMaster,
        editMode,
        setEditMode,
        insurerSettings,
        loadingSettings,
        loadSettings,
        toggleInsurerSetting,
      }}
    >
      {children}
    </CotizadorEditContext.Provider>
  );
}
