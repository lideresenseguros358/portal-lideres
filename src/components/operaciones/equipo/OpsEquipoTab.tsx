'use client';

import { useState } from 'react';
import {
  FaUsers,
  FaUser,
  FaClock,
  FaChartLine,
  FaSync,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
} from 'react-icons/fa';

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

export default function OpsEquipoTab() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>('day');

  return (
    <div className="space-y-4">
      {/* Period Filter */}
      <div className="flex gap-2">
        {(['day', 'week', 'month', 'year'] as PeriodFilter[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              period === p
                ? 'bg-[#010139] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
          </button>
        ))}
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Placeholder card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <FaUser className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-[#010139]">—</p>
          <p className="text-xs text-gray-400 mt-1">Sin datos de equipo</p>
        </div>
      </div>

      {/* Detail info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
        <FaChartLine className="text-blue-500 text-sm flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Haz click en una card de usuario para ver métricas detalladas, tendencias y casos pendientes.
        </p>
      </div>

      {/* Metrics detail placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[300px]">
        <h3 className="text-sm font-bold text-[#010139] mb-4">Métricas del Equipo</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Horas Trabajadas', value: '—', icon: FaClock },
            { label: 'Renovaciones', value: '—', icon: FaSync },
            { label: 'Emisiones', value: '—', icon: FaCheckCircle },
            { label: 'Conversión', value: '—', icon: FaChartLine },
            { label: 'Sin Atender (48h)', value: '—', icon: FaTimesCircle },
            { label: 'Urgencias', value: '—', icon: FaExclamationTriangle },
            { label: 'Efectividad Urg.', value: '—', icon: FaCheckCircle },
            { label: 'Días Improductivos', value: '—', icon: FaClock },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <Icon className="text-gray-400 text-sm mx-auto mb-1" />
                <p className="text-[10px] text-gray-500 font-medium">{m.label}</p>
                <p className="text-lg font-bold text-[#010139]">{m.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mandatory Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <FaExclamationTriangle className="text-amber-500 text-sm flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-amber-700 font-semibold">Notas obligatorias requeridas:</p>
          <ul className="text-xs text-amber-600 mt-1 space-y-0.5">
            <li>- Casos no atendidos en 48h</li>
            <li>- SLA vencido</li>
            <li>- Casos pendientes al cierre del día</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
