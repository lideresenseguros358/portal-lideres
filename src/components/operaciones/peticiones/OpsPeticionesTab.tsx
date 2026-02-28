'use client';

import { useState } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaInbox,
  FaEye,
  FaFileAlt,
} from 'react-icons/fa';
import type { PetitionStatus } from '@/types/operaciones.types';

function StatusBadge({ status }: { status: PetitionStatus }) {
  const m: Record<PetitionStatus, { bg: string; text: string }> = {
    PENDIENTE: { bg: 'bg-amber-100', text: 'text-amber-800' },
    EN_GESTION: { bg: 'bg-blue-100', text: 'text-blue-800' },
    ENVIADO: { bg: 'bg-purple-100', text: 'text-purple-800' },
    CERRADO: { bg: 'bg-green-100', text: 'text-green-800' },
    PERDIDO: { bg: 'bg-red-100', text: 'text-red-800' },
  };
  const s = m[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{status.replace('_', ' ')}</span>;
}

export default function OpsPeticionesTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ramoFilter, setRamoFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPetition, setSelectedPetition] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: 'Pendientes', count: 0, bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-600' },
          { label: 'En Gestión', count: 0, bg: 'bg-blue-50', border: 'border-blue-200', color: 'text-blue-600' },
          { label: 'Enviados', count: 0, bg: 'bg-purple-50', border: 'border-purple-200', color: 'text-purple-600' },
          { label: 'Cerrados', count: 0, bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-600' },
          { label: 'Perdidos', count: 0, bg: 'bg-red-50', border: 'border-red-200', color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-2.5 sm:p-3`}>
            <p className={`text-[10px] ${c.color} font-semibold uppercase`}>{c.label}</p>
            <p className="text-lg sm:text-xl font-bold text-[#010139]">{c.count}</p>
          </div>
        ))}
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
              placeholder="Buscar por cliente, ramo..."
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
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_GESTION">En Gestión</option>
              <option value="ENVIADO">Enviado</option>
              <option value="CERRADO">Cerrado</option>
              <option value="PERDIDO">Perdido</option>
            </select>
            <select value={ramoFilter} onChange={e => setRamoFilter(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Ramo</option>
              <option value="VIDA">Vida</option>
              <option value="INCENDIO">Incendio</option>
              <option value="HOGAR">Hogar</option>
            </select>
          </div>
        )}
      </div>

      {/* Inbox-style List + Detail Panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* List */}
        <div className={`${selectedPetition ? 'hidden lg:block' : ''} lg:w-1/3 space-y-2`}>
          <div className="py-12 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
            <FaInbox className="text-3xl text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No hay peticiones</p>
            <p className="text-xs text-gray-400 mt-1">Las solicitudes de Vida, Incendio y Hogar aparecerán aquí</p>
          </div>
        </div>

        {/* Detail Panel */}
        <div className={`${selectedPetition ? '' : 'hidden lg:block'} flex-1`}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px] flex items-center justify-center">
            <div className="text-center">
              <FaEye className="text-3xl text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Selecciona una petición</p>
              <p className="text-xs text-gray-400 mt-1">El detalle y el hilo de correos aparecerán aquí</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
