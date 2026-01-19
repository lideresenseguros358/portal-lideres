'use client';

import { useState, useEffect } from 'react';
import { FaUmbrellaBeach, FaSave, FaTimes, FaUserShield, FaExchangeAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetVacationConfig, actionUpdateVacationConfig } from '@/app/(app)/config/catalog-actions';
import type { VacationConfig } from '@/lib/ticketing/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function VacationTab() {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<VacationConfig[]>([]);
  const [editing, setEditing] = useState<VacationConfig | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const result = await actionGetVacationConfig();
    
    if (result.ok) {
      setConfigs(result.data || []);
    } else {
      toast.error(result.error || 'Error al cargar configuración');
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-6 border-l-4 border-[#010139] shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <FaUmbrellaBeach className="text-2xl text-[#010139]" />
          <h2 className="text-2xl font-bold text-[#010139]">
            Configuración de Vacaciones
          </h2>
        </div>
        <p className="text-gray-600">
          Gestiona las vacaciones de los masters y define respaldos automáticos para asignación de casos.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">ℹ️ Cómo Funciona el Sistema de Respaldo</h3>
        <ul className="text-sm text-blue-700 space-y-1 ml-4">
          <li>• Cuando un master está de vacaciones, los nuevos casos se asignan automáticamente al respaldo</li>
          <li>• El respaldo debe ser otro master del sistema</li>
          <li>• Los casos existentes se mantienen con el master original</li>
          <li>• Al regresar de vacaciones, el master puede recuperar los casos o dejarlos con el respaldo</li>
          <li>• Las fechas de inicio y fin son opcionales pero recomendadas para mejor tracking</li>
        </ul>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando configuración...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {configs.map((config) => (
            <VacationCard
              key={config.id}
              config={config}
              onEdit={() => setEditing(config)}
              onReload={loadConfigs}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <VacationEditModal
          config={editing}
          allConfigs={configs}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            loadConfigs();
          }}
        />
      )}
    </div>
  );
}

// =====================================================
// VACATION CARD
// =====================================================

function VacationCard({
  config,
  onEdit,
  onReload,
}: {
  config: VacationConfig;
  onEdit: () => void;
  onReload: () => void;
}) {
  const handleQuickToggle = async () => {
    const result = await actionUpdateVacationConfig(config.master_email, {
      is_on_vacation: !config.is_on_vacation,
    });

    if (result.ok) {
      toast.success(config.is_on_vacation ? 'Vacaciones desactivadas' : 'Vacaciones activadas');
      onReload();
    } else {
      toast.error(result.error || 'Error al actualizar');
    }
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all ${
        config.is_on_vacation
          ? 'border-orange-400 shadow-orange-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Header */}
      <div
        className={`p-4 ${
          config.is_on_vacation
            ? 'bg-gradient-to-r from-orange-100 to-orange-50'
            : 'bg-gradient-to-r from-gray-50 to-white'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {config.is_on_vacation ? (
              <FaUmbrellaBeach className="text-2xl text-orange-600" />
            ) : (
              <FaUserShield className="text-2xl text-[#010139]" />
            )}
            <div>
              <h3 className="font-bold text-lg text-[#010139]">{config.master_name}</h3>
              <p className="text-sm text-gray-600">{config.master_email}</p>
            </div>
          </div>
          <button
            onClick={handleQuickToggle}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              config.is_on_vacation
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {config.is_on_vacation ? '🏖️ De vacaciones' : '✅ Activo'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Vacation Dates */}
        {config.is_on_vacation && (config.vacation_start || config.vacation_end) && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs font-bold text-orange-800 mb-1">Período de vacaciones:</p>
            <p className="text-sm text-orange-900">
              {config.vacation_start && (
                <span>
                  Desde: {format(new Date(config.vacation_start), 'PPP', { locale: es })}
                </span>
              )}
              {config.vacation_start && config.vacation_end && <span className="mx-2">→</span>}
              {config.vacation_end && (
                <span>
                  Hasta: {format(new Date(config.vacation_end), 'PPP', { locale: es })}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Backup Info */}
        <div className="flex items-start gap-2">
          <FaExchangeAlt className="text-gray-400 mt-1" />
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-600 mb-1">Respaldo asignado:</p>
            {config.backup_email ? (
              <p className="text-sm text-gray-900">{config.backup_email}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin respaldo configurado</p>
            )}
          </div>
        </div>

        {/* Auto Reassign */}
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.auto_reassign}
            disabled
            className="rounded"
          />
          <span className="text-gray-600">
            Reasignación automática de nuevos casos
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 flex justify-end">
        <button
          onClick={onEdit}
          className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors text-sm"
        >
          Configurar
        </button>
      </div>
    </div>
  );
}

// =====================================================
// EDIT MODAL
// =====================================================

function VacationEditModal({
  config,
  allConfigs,
  onClose,
  onSave,
}: {
  config: VacationConfig;
  allConfigs: VacationConfig[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    is_on_vacation: config.is_on_vacation,
    vacation_start: config.vacation_start || '',
    vacation_end: config.vacation_end || '',
    backup_email: config.backup_email || '',
    auto_reassign: config.auto_reassign,
  });

  const [saving, setSaving] = useState(false);

  // Opciones de backup (otros masters excepto el actual)
  const backupOptions = allConfigs.filter((c) => c.master_email !== config.master_email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Validaciones
    if (formData.is_on_vacation && !formData.backup_email) {
      toast.error('Debes seleccionar un respaldo si estás de vacaciones');
      setSaving(false);
      return;
    }

    if (formData.vacation_start && formData.vacation_end) {
      const start = new Date(formData.vacation_start);
      const end = new Date(formData.vacation_end);
      if (end < start) {
        toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
        setSaving(false);
        return;
      }
    }

    const result = await actionUpdateVacationConfig(config.master_email, formData);

    if (result.ok) {
      toast.success('Configuración actualizada correctamente');
      onSave();
    } else {
      toast.error(result.error || 'Error al guardar');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl my-8">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <h3 className="text-xl font-bold">Configurar Vacaciones</h3>
          <p className="text-sm text-blue-100 mt-1">{config.master_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Estado de Vacaciones */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_on_vacation}
                onChange={(e) => setFormData({ ...formData, is_on_vacation: e.target.checked })}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-bold text-gray-900">Marcar como "De vacaciones"</span>
                <p className="text-xs text-gray-600 mt-1">
                  Los nuevos casos se asignarán automáticamente al respaldo
                </p>
              </div>
            </label>
          </div>

          {/* Fechas (opcional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Fecha inicio (opcional)
              </label>
              <input
                type="date"
                value={formData.vacation_start}
                onChange={(e) => setFormData({ ...formData, vacation_start: e.target.value })}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Fecha fin (opcional)
              </label>
              <input
                type="date"
                value={formData.vacation_end}
                onChange={(e) => setFormData({ ...formData, vacation_end: e.target.value })}
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Respaldo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Master de respaldo <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.backup_email}
              onChange={(e) => setFormData({ ...formData, backup_email: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none"
              required={formData.is_on_vacation}
            >
              <option value="">Seleccionar respaldo...</option>
              {backupOptions.map((option) => (
                <option key={option.id} value={option.master_email}>
                  {option.master_name} ({option.master_email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Este master recibirá los nuevos casos durante las vacaciones
            </p>
          </div>

          {/* Auto Reassign */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.auto_reassign}
                onChange={(e) => setFormData({ ...formData, auto_reassign: e.target.checked })}
                className="w-5 h-5 rounded mt-0.5"
              />
              <div>
                <span className="font-bold text-blue-900 text-sm">Reasignación automática</span>
                <p className="text-xs text-blue-700 mt-1">
                  Si está activo, los nuevos casos se asignarán automáticamente al respaldo.
                  Si está desactivado, requerirá asignación manual.
                </p>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <FaTimes className="inline mr-2" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors disabled:opacity-50"
            >
              <FaSave className="inline mr-2 text-white" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
