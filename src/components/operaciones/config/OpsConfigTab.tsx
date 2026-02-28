'use client';

import { useState } from 'react';
import {
  FaCog,
  FaSave,
  FaSync,
  FaToggleOn,
  FaToggleOff,
  FaClock,
  FaCalendarAlt,
  FaEnvelope,
  FaExclamationTriangle,
  FaUsers,
} from 'react-icons/fa';

interface ConfigItem {
  key: string;
  label: string;
  description: string;
  type: 'toggle' | 'number' | 'text' | 'json';
  icon: typeof FaCog;
  value: any;
}

const DEFAULT_CONFIG: ConfigItem[] = [
  { key: 'auto_assign_enabled', label: 'Autoasignación', description: 'Activar/desactivar autoasignación de renovaciones', type: 'toggle', icon: FaUsers, value: false },
  { key: 'sla_urgency_hours', label: 'SLA Urgencias (horas)', description: 'Horas hábiles para atender urgencias', type: 'number', icon: FaClock, value: 24 },
  { key: 'sla_renewal_first_response_hours', label: 'SLA Primera Respuesta (horas)', description: 'Horas para primera respuesta en renovaciones', type: 'number', icon: FaClock, value: 48 },
  { key: 'renewal_advance_days', label: 'Días Anticipación Renovación', description: 'Días antes del vencimiento para mostrar renovación', type: 'number', icon: FaCalendarAlt, value: 30 },
  { key: 'inactivity_timeout_hours', label: 'Timeout Inactividad (horas)', description: 'Horas sin actividad productiva para cerrar sesión', type: 'number', icon: FaClock, value: 2 },
  { key: 'morosidad_alert_days', label: 'Alerta Morosidad (días)', description: 'Días de atraso para generar alerta', type: 'number', icon: FaExclamationTriangle, value: 30 },
  { key: 'retention_years', label: 'Retención Logs (años)', description: 'Años de retención de logs de auditoría', type: 'number', icon: FaCog, value: 3 },
];

export default function OpsConfigTab() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [templateTab, setTemplateTab] = useState<'renovacion' | 'pago' | 'caratula'>('renovacion');

  return (
    <div className="space-y-4">
      {/* General Config */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#010139] flex items-center gap-2">
            <FaCog className="text-gray-400" /> Configuración General
          </h3>
          <button
            className="bg-[#010139] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            disabled={saving}
          >
            <FaSave className="text-white text-xs" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        <div className="space-y-3">
          {config.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon className="text-gray-400 text-sm flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#010139]">{item.label}</p>
                  <p className="text-[10px] text-gray-500">{item.description}</p>
                </div>
                {item.type === 'toggle' ? (
                  <button className="text-2xl cursor-pointer">
                    {item.value ? (
                      <FaToggleOn className="text-[#8AAA19]" />
                    ) : (
                      <FaToggleOff className="text-gray-300" />
                    )}
                  </button>
                ) : item.type === 'number' ? (
                  <input
                    type="number"
                    value={item.value}
                    readOnly
                    className="w-20 text-sm text-center border border-gray-300 rounded-lg px-2 py-1"
                  />
                ) : (
                  <input
                    type="text"
                    value={item.value}
                    readOnly
                    className="w-40 text-sm border border-gray-300 rounded-lg px-2 py-1"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Work Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[#010139] flex items-center gap-2 mb-4">
          <FaCalendarAlt className="text-gray-400" /> Horario Laboral
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 font-semibold mb-1">Inicio</label>
            <input type="time" defaultValue="09:00" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" readOnly />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-semibold mb-1">Fin</label>
            <input type="time" defaultValue="17:00" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" readOnly />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-semibold mb-1">Zona Horaria</label>
            <input type="text" defaultValue="America/Panama" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" readOnly />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[10px] text-gray-500 font-semibold mb-1">Días Laborales</label>
          <div className="flex gap-1.5 flex-wrap">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
              <span
                key={d}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  i < 5 ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[#010139] flex items-center gap-2 mb-4">
          <FaEnvelope className="text-gray-400" /> Plantillas de Correo
        </h3>
        <div className="flex gap-1.5 mb-3">
          {([
            { key: 'renovacion' as const, label: 'Consulta Renovación' },
            { key: 'pago' as const, label: 'Link de Pago' },
            { key: 'caratula' as const, label: 'Carátula Renovada' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTemplateTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                templateTab === t.key
                  ? 'bg-[#010139] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
          <p className="text-xs text-gray-400 italic">
            {templateTab === 'renovacion' && 'Plantilla de consulta de renovación con botón "Aceptar Renovar". Editable antes de enviar.'}
            {templateTab === 'pago' && 'Plantilla de link de pago con botón + link crudo. Master pega link PagueloFacil.'}
            {templateTab === 'caratula' && 'Plantilla para envío de carátula renovada con adjunto PDF.'}
          </p>
        </div>
      </div>

      {/* Escalation Rules */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[#010139] flex items-center gap-2 mb-4">
          <FaExclamationTriangle className="text-gray-400" /> Reglas de Escalamiento
        </h3>
        <div className="py-6 text-center">
          <FaExclamationTriangle className="text-2xl text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Reglas de escalamiento configurables aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}
