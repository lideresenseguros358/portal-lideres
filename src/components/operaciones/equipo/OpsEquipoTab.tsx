'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaUsers, FaChartLine, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import TeamCard from './TeamCard';
import TeamUserModal from './TeamUserModal';
import type { MasterCard } from './team-helpers';

export default function OpsEquipoTab() {
  const [cards, setCards] = useState<MasterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<MasterCard | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/operaciones/team?view=cards');
      const json = await res.json();
      setCards(json.cards || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  // Aggregate totals for summary bar
  const totalOpen = cards.reduce((s, c) => s + c.open_cases, 0);
  const totalSla = cards.reduce((s, c) => s + c.sla_breached, 0);
  const totalCasesToday = cards.reduce((s, c) => s + c.cases_today, 0);
  const totalUnprod = cards.reduce((s, c) => s + c.unproductive_days_30d, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#010139] tracking-tight">Equipo</h2>
          <span className="text-[10px] text-gray-400">Solo lectura</span>
        </div>
        <button
          onClick={fetchCards}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-150 disabled:opacity-50 cursor-pointer"
        >
          <FaSync className={`text-[10px] ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-1">Masters Activos</p>
          <p className="text-xl font-bold text-[#010139] tabular-nums">{cards.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-1">Casos Abiertos</p>
          <p className="text-xl font-bold text-[#010139] tabular-nums">{totalOpen}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${totalSla > 0 ? 'bg-white border-red-100' : 'bg-white border-gray-200'}`}>
          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-1">SLA Vencidos</p>
          <p className={`text-xl font-bold tabular-nums ${totalSla > 0 ? 'text-red-600' : 'text-[#010139]'}`}>{totalSla}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider mb-1">Casos Hoy</p>
          <p className="text-xl font-bold text-[#010139] tabular-nums">{totalCasesToday}</p>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-44" style={{ animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-50 rounded w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-12 bg-gray-50 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <FaUsers className="text-gray-300 text-lg" />
          </div>
          <p className="text-sm font-medium text-gray-500">Sin masters registrados</p>
          <p className="text-xs text-gray-400 mt-1.5">
            Asegúrate de que existan usuarios con rol &quot;master&quot; en el sistema.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map(c => (
            <TeamCard key={c.id} card={c} onClick={() => setSelectedCard(c)} />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 flex items-center gap-2.5">
        <FaChartLine className="text-gray-400 text-xs flex-shrink-0" />
        <p className="text-xs text-gray-500">
          Haz click en una card para ver métricas detalladas por periodo: productividad, SLA, conversión, urgencias e historial.
        </p>
      </div>

      {/* Alerts */}
      {totalUnprod > 0 && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
          <FaExclamationTriangle className="text-amber-400 text-xs flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-600 font-medium">
              {totalUnprod} día(s) improductivo(s) detectados en los últimos 30 días
            </p>
            <p className="text-[10px] text-amber-500 mt-0.5">
              Revisa el detalle de cada master para identificar patrones.
            </p>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedCard && (
        <TeamUserModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
