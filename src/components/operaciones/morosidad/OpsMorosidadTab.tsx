'use client';

import { useState } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaMoneyBillWave,
  FaEnvelope,
  FaCheckCircle,
  FaBan,
  FaExclamationCircle,
} from 'react-icons/fa';
import type { MorosidadStatus } from '@/types/operaciones.types';

function StatusBadge({ status }: { status: MorosidadStatus }) {
  const m: Record<MorosidadStatus, { bg: string; text: string }> = {
    AL_DIA: { bg: 'bg-green-100', text: 'text-green-800' },
    ATRASADO: { bg: 'bg-red-100', text: 'text-red-800' },
    PAGO_RECIBIDO: { bg: 'bg-blue-100', text: 'text-blue-800' },
    CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-800' },
  };
  const s = m[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{status.replace('_', ' ')}</span>;
}

export default function OpsMorosidadTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Al Día', count: 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'Atrasados', count: 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
          { label: 'Pago Recibido', count: 0, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Cancelados', count: 0, bg: 'bg-gray-50', border: 'border-gray-200', color: 'text-gray-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 sm:p-3`}>
            <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
            <p className="text-lg sm:text-xl font-bold text-[#010139]">{c.count}</p>
          </div>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, póliza..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0">
            <FaFilter className="text-sm" />
          </button>
          {selectedClients.length > 0 && (
            <button className="bg-[#010139] text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              <FaEnvelope className="text-white text-xs" />
              Enviar correo ({selectedClients.length})
            </button>
          )}
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Refrescar">
            <FaSync className="text-sm" />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Estado</option>
              <option value="AL_DIA">Al Día</option>
              <option value="ATRASADO">Atrasado</option>
              <option value="PAGO_RECIBIDO">Pago Recibido</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
        )}
      </div>

      {/* Morosidad alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
        <FaExclamationCircle className="text-amber-500 text-sm flex-shrink-0" />
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Alerta automática:</span> Clientes con 30+ días de atraso generan notificación interna.
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="py-12 text-center">
          <FaMoneyBillWave className="text-3xl text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No hay registros de morosidad</p>
          <p className="text-xs text-gray-400 mt-1">Datos de pagos pendientes, recurrencias y transferencias aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}
