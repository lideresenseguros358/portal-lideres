'use client';

import { useState } from 'react';
import {
  FaSearch,
  FaSync,
  FaFilter,
  FaClipboardList,
  FaFileExcel,
  FaFilePdf,
  FaCalendarAlt,
} from 'react-icons/fa';

export default function OpsLogsTab() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
        <FaClipboardList className="text-blue-500 text-sm flex-shrink-0" />
        <p className="text-xs text-blue-700">
          <span className="font-semibold">Retención:</span> 3 años. Los logs incluyen before/after diff en cambios críticos.
        </p>
      </div>

      {/* Search + Filters + Export */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por usuario, entidad, evento..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0">
            <FaFilter className="text-sm" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Exportar PDF">
            <FaFilePdf className="text-sm text-red-500" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Exportar Excel">
            <FaFileExcel className="text-sm text-green-600" />
          </button>
          <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0" title="Refrescar">
            <FaSync className="text-sm" />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="w-full text-sm sm:text-xs border border-gray-300 rounded-lg px-2 py-2 sm:py-1.5">
              <option value="">Tipo Entidad</option>
              <option value="renewal">Renovación</option>
              <option value="petition">Petición</option>
              <option value="urgency">Urgencia</option>
              <option value="morosidad">Morosidad</option>
              <option value="email">Email</option>
              <option value="policy">Póliza</option>
              <option value="session">Sesión</option>
            </select>
            <div className="relative">
              <FaCalendarAlt className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-7 pr-2 py-2 sm:py-1.5 text-sm sm:text-xs border border-gray-300 rounded-lg" placeholder="Desde" />
            </div>
            <div className="relative">
              <FaCalendarAlt className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full pl-7 pr-2 py-2 sm:py-1.5 text-sm sm:text-xs border border-gray-300 rounded-lg" placeholder="Hasta" />
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Usuario</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Evento</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Entidad</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <FaClipboardList className="text-3xl text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No hay logs registrados</p>
                  <p className="text-xs text-gray-400 mt-1">Los eventos de auditoría aparecerán aquí</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
