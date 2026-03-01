'use client';

import { useState } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaExclamationTriangle,
  FaEye,
  FaClock,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import type { OpsCaseStatus } from '@/types/operaciones.types';

function StatusBadge({ status }: { status: OpsCaseStatus }) {
  const m: Partial<Record<OpsCaseStatus, { bg: string; text: string }>> = {
    pendiente: { bg: 'bg-red-100', text: 'text-red-800' },
    en_atencion: { bg: 'bg-blue-100', text: 'text-blue-800' },
    resuelto: { bg: 'bg-green-100', text: 'text-green-800' },
    cerrado: { bg: 'bg-purple-100', text: 'text-purple-800' },
  };
  const s = m[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{status.replace('_', ' ')}</span>;
}

function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' }) {
  const m = {
    low: { bg: 'bg-green-100', text: 'text-green-800', label: 'BAJA' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'MEDIA' },
    high: { bg: 'bg-red-100', text: 'text-red-800', label: 'ALTA' },
  };
  const s = m[severity];
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{s.label}</span>;
}

export default function OpsUrgenciasTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Abiertas', count: 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
          { label: 'En Atención', count: 0, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Resueltas', count: 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'SLA Vencido', count: 0, bg: 'bg-orange-50', border: 'border-orange-200', color: 'text-orange-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 sm:p-3`}>
            <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
            <p className="text-lg sm:text-xl font-bold text-[#010139]">{c.count}</p>
          </div>
        ))}
      </div>

      {/* SLA Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
        <FaClock className="text-blue-500 text-sm flex-shrink-0" />
        <p className="text-xs text-blue-700">
          <span className="font-semibold">SLA:</span> 24 horas hábiles (L-V) desde que la IA marca el chat como urgente.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, categoría..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0">
            <FaFilter className="text-sm" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Refrescar">
            <FaSync className="text-sm" />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Estado</option>
              <option value="ABIERTO">Abierto</option>
              <option value="EN_ATENCION">En Atención</option>
              <option value="RESUELTO">Resuelto</option>
              <option value="ESCALADO">Escalado</option>
            </select>
          </div>
        )}
      </div>

      {/* Urgencies List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="py-12 text-center">
          <FaExclamationTriangle className="text-3xl text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No hay urgencias activas</p>
          <p className="text-xs text-gray-400 mt-1">Las urgencias detectadas por la IA aparecerán aquí con deep link al chat</p>
        </div>
      </div>
    </div>
  );
}
