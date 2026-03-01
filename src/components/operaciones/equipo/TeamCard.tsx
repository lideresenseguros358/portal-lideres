'use client';

import { FaUser, FaClock, FaExclamationTriangle, FaFolderOpen, FaCheckCircle } from 'react-icons/fa';
import type { MasterCard } from './team-helpers';
import { fmtHours, getInitials } from './team-helpers';

interface Props {
  card: MasterCard;
  onClick: () => void;
}

export default function TeamCard({ card, onClick }: Props) {
  const hasSlaAlert = card.sla_breached > 0;
  const hasUnproductive = card.unproductive_days_30d > 0;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150 p-4 text-left cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#010139] flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
          {getInitials(card.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#010139] truncate group-hover:text-[#010139]/80 transition-colors">
            {card.full_name}
          </p>
          <p className="text-[10px] text-gray-400 truncate">{card.email}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        <div className="bg-gray-50/80 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <FaFolderOpen className="text-gray-400 text-[10px] flex-shrink-0" />
          <div>
            <p className="text-[9px] text-gray-400 leading-none uppercase tracking-wider">Abiertos</p>
            <p className="text-sm font-bold text-[#010139] tabular-nums">{card.open_cases}</p>
          </div>
        </div>
        <div className={`rounded-lg px-2.5 py-2 flex items-center gap-2 ${hasSlaAlert ? 'bg-red-50/60' : 'bg-gray-50/80'}`}>
          <FaExclamationTriangle className={`text-[10px] flex-shrink-0 ${hasSlaAlert ? 'text-red-400' : 'text-gray-300'}`} />
          <div>
            <p className="text-[9px] text-gray-400 leading-none uppercase tracking-wider">SLA</p>
            <p className={`text-sm font-bold tabular-nums ${hasSlaAlert ? 'text-red-600' : 'text-[#010139]'}`}>{card.sla_breached}</p>
          </div>
        </div>
        <div className="bg-gray-50/80 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <FaClock className="text-gray-400 text-[10px] flex-shrink-0" />
          <div>
            <p className="text-[9px] text-gray-400 leading-none uppercase tracking-wider">Horas hoy</p>
            <p className="text-sm font-bold text-[#010139] tabular-nums">{fmtHours(card.hours_today)}</p>
          </div>
        </div>
        <div className="bg-gray-50/80 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <FaCheckCircle className="text-gray-400 text-[10px] flex-shrink-0" />
          <div>
            <p className="text-[9px] text-gray-400 leading-none uppercase tracking-wider">Casos hoy</p>
            <p className="text-sm font-bold text-[#010139] tabular-nums">{card.cases_today}</p>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {hasUnproductive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {card.unproductive_days_30d}d improd.
          </span>
        )}
        {hasSlaAlert && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            SLA crítico
          </span>
        )}
        {!hasUnproductive && !hasSlaAlert && card.open_cases === 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400">
            Sin alertas
          </span>
        )}
      </div>
    </button>
  );
}
