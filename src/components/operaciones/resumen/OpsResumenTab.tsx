'use client';

import {
  FaSync,
  FaExclamationTriangle,
  FaInbox,
  FaMoneyBillWave,
  FaUsers,
  FaClock,
  FaCheckCircle,
} from 'react-icons/fa';

export default function OpsResumenTab() {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Renovaciones Pendientes', value: '—', icon: FaSync, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Peticiones Abiertas', value: '—', icon: FaInbox, bg: 'bg-purple-50', border: 'border-purple-200', color: 'text-purple-600' },
          { label: 'Urgencias Activas', value: '—', icon: FaExclamationTriangle, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
          { label: 'Morosidad', value: '—', icon: FaMoneyBillWave, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-600' },
          { label: 'Equipo Activo', value: '—', icon: FaUsers, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'SLA Vencidos', value: '—', icon: FaClock, bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-600' },
          { label: 'Cerrados Hoy', value: '—', icon: FaCheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-600' },
          { label: 'Horas Equipo Hoy', value: '—', icon: FaClock, bg: 'bg-indigo-50', border: 'border-indigo-200', color: 'text-indigo-600' },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-3 sm:p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`text-sm ${c.color}`} />
                <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[#010139]">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[#010139] mb-3">Renovaciones Próximas</h3>
          <div className="py-8 text-center">
            <FaSync className="text-2xl text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Datos de renovaciones próximas aparecerán aquí</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[#010139] mb-3">Urgencias Recientes</h3>
          <div className="py-8 text-center">
            <FaExclamationTriangle className="text-2xl text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Urgencias activas aparecerán aquí</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[#010139] mb-3">Actividad del Equipo Hoy</h3>
        <div className="py-8 text-center">
          <FaUsers className="text-2xl text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Métricas del equipo aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}
