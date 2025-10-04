'use client';

import { useState, useEffect } from 'react';
import { FaPalette, FaClock, FaBell, FaShieldAlt, FaPercent, FaSave, FaImage } from 'react-icons/fa';
import { toast } from 'sonner';
import { uppercaseInputClass } from '@/lib/utils/uppercase';

interface GeneralTabProps {
  userId: string;
}

interface BrandingSettings {
  logo_url: string | null;
  logo_alt_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
}

interface NotificationToggles {
  commissions_close: boolean;
  cases_always_on: boolean;
}

export default function GeneralTab({ userId }: GeneralTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Branding
  const [branding, setBranding] = useState<BrandingSettings>({
    logo_url: null,
    logo_alt_url: null,
    favicon_url: null,
    primary_color: '#010139',
    accent_color: '#8AAA19',
  });
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationToggles>({
    commissions_close: true,
    cases_always_on: true,
  });
  
  // Commission percentages
  const [commissionPercentages, setCommissionPercentages] = useState<string[]>([
    '0.50', '0.60', '0.70', '0.80', '0.82', '0.94', '1.00'
  ]);
  const [newPercentage, setNewPercentage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/config/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.branding) setBranding(data.branding);
        if (data.notifications) setNotifications(data.notifications);
        if (data.commission_percentages) setCommissionPercentages(data.commission_percentages);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding,
          notifications,
          commission_percentages: commissionPercentages,
        }),
      });

      if (response.ok) {
        toast.success('Configuración guardada exitosamente');
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      toast.error('Error inesperado al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPercentage = () => {
    const value = parseFloat(newPercentage);
    if (isNaN(value) || value <= 0 || value > 1) {
      toast.error('Ingresa un porcentaje válido entre 0 y 1');
      return;
    }
    
    const formatted = value.toFixed(2);
    if (commissionPercentages.includes(formatted)) {
      toast.error('Este porcentaje ya existe');
      return;
    }
    
    setCommissionPercentages([...commissionPercentages, formatted].sort());
    setNewPercentage('');
    toast.success('Porcentaje agregado');
  };

  const handleRemovePercentage = (percentage: string) => {
    setCommissionPercentages(commissionPercentages.filter(p => p !== percentage));
    toast.success('Porcentaje eliminado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branding Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaPalette className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">BRANDING</h2>
            <p className="text-xs sm:text-sm text-gray-600">LOGOTIPOS, FAVICON Y COLORES CORPORATIVOS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Principal */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaImage className="inline mr-2" />
              Logo Principal
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-16 mx-auto mb-2" />
              ) : (
                <div className="h-16 flex items-center justify-center text-gray-400">
                  Sin logo
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="mt-2 inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm cursor-pointer transition-colors"
              >
                Subir logo
              </label>
              <p className="text-xs text-gray-500 mt-2">Altura fija, ancho automático</p>
            </div>
          </div>

          {/* Logo Alterno */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <FaImage className="inline mr-2" />
              Logo Alterno
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
              {branding.logo_alt_url ? (
                <img src={branding.logo_alt_url} alt="Logo alterno" className="h-16 mx-auto mb-2" />
              ) : (
                <div className="h-16 flex items-center justify-center text-gray-400">
                  Sin logo alterno
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="logo-alt-upload"
              />
              <label
                htmlFor="logo-alt-upload"
                className="mt-2 inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm cursor-pointer transition-colors"
              >
                Subir logo alterno
              </label>
            </div>
          </div>

          {/* Colores */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color Primario
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="h-12 w-12 rounded-lg border-2 border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm"
                placeholder="#010139"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Color Acento
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={branding.accent_color}
                onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                className="h-12 w-12 rounded-lg border-2 border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={branding.accent_color}
                onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm"
                placeholder="#8AAA19"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tipografía:</strong> Arial (estándar del sistema)
          </p>
        </div>
      </div>

      {/* Time & Email Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaClock className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">ZONA HORARIA Y CORREOS</h2>
            <p className="text-xs sm:text-sm text-gray-600">CONFIGURACIÓN DE TIEMPO Y ENVÍOS AUTOMÁTICOS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">Zona Horaria</p>
            <p className="text-lg font-bold text-[#010139]">🕐 Panamá (GMT-5)</p>
            <p className="text-xs text-gray-500 mt-1">Solo lectura</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">Hora de Correo Diario</p>
            <p className="text-lg font-bold text-[#010139]">📧 7:00 AM</p>
            <p className="text-xs text-gray-500 mt-1">Fija, no editable</p>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaBell className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">NOTIFICACIONES</h2>
            <p className="text-xs sm:text-sm text-gray-600">CONFIGURACIÓN GLOBAL DE NOTIFICACIONES</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">COMISIONES AL CERRAR QUINCENA</p>
              <p className="text-xs sm:text-sm text-gray-600">NOTIFICAR BROKERS CUANDO SE CIERRE UNA QUINCENA</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, commissions_close: !notifications.commissions_close })}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                notifications.commissions_close ? 'bg-[#8AAA19]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  notifications.commissions_close ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">CASOS SIEMPRE NOTIFICADOS</p>
              <p className="text-xs sm:text-sm text-gray-600">NOTIFICAR TODOS LOS CAMBIOS DE ESTADO EN CASOS</p>
            </div>
            <div className="relative inline-flex h-8 w-14 items-center rounded-full bg-[#8AAA19] opacity-50 cursor-not-allowed">
              <span className="inline-block h-6 w-6 transform rounded-full bg-white translate-x-7" />
            </div>
          </div>
        </div>
      </div>

      {/* Roles & Permissions (Read Only) */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaShieldAlt className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">ROLES Y PERMISOS</h2>
            <p className="text-xs sm:text-sm text-gray-600">MATRIZ DE PERMISOS (SOLO REFERENCIA VISUAL)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Función</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Master</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Broker</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['Comisiones', '✅ Total', '📊 Solo lectura'],
                ['Adelantos', '✅ Gestión completa', '📝 Solo solicitar'],
                ['Trámites', '✅ Administrar todos', '✅ Sus trámites'],
                ['Configuración', '✅ Total', '❌ Sin acceso'],
                ['Dashboard', '✅ Vista completa', '✅ Vista personal'],
              ].map(([func, master, broker]) => (
                <tr key={func} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{func}</td>
                  <td className="px-4 py-3 text-sm text-center">{master}</td>
                  <td className="px-4 py-3 text-sm text-center">{broker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission Percentages */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaPercent className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">PORCENTAJES DE COMISIÓN PERMITIDOS</h2>
            <p className="text-xs sm:text-sm text-gray-600">LISTA GLOBAL DE PORCENTAJES DISPONIBLES</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {commissionPercentages.map((percentage) => (
            <div
              key={percentage}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#010139] text-white rounded-lg font-mono text-sm"
            >
              <span>{percentage}</span>
              <button
                onClick={() => handleRemovePercentage(percentage)}
                className="ml-2 text-red-300 hover:text-red-100 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={newPercentage}
            onChange={(e) => setNewPercentage(e.target.value)}
            placeholder="0.00"
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg font-mono focus:border-[#8AAA19] focus:outline-none"
          />
          <button
            onClick={handleAddPercentage}
            className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors"
          >
            Agregar
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Nota:</strong> Al cambiar el porcentaje default de un broker, se puede aplicar a todas sus pólizas existentes.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="sticky bottom-4 bg-white rounded-2xl shadow-2xl p-4 border-2 border-[#8AAA19]">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <FaSave />
              <span>Guardar Configuración</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
