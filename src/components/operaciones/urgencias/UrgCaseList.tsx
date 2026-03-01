'use client';

import {
  FaSearch,
  FaSync,
  FaClock,
  FaExclamationTriangle,
  FaUserTie,
  FaBolt,
  FaFire,
} from 'react-icons/fa';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { UrgCounts, UrgFilterKey } from './urg-helpers';
import { fmtRelative, calcBusinessHours, slaStatus, slaColor, hoursElapsed } from './urg-helpers';
import { OpsSkeletonRows, OpsEmptyState } from '../shared/ops-ui';

// ════════════════════════════════════════════
// BADGE COMPONENTS
// ════════════════════════════════════════════

function StatusBadge({ status }: { status: OpsCaseStatus }) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${colors.bg} ${colors.text}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function SlaBadge({ createdAt, slaBreached }: { createdAt: string; slaBreached: boolean }) {
  if (slaBreached) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
        <FaClock className="text-[8px]" /> SLA
      </span>
    );
  }
  const bh = calcBusinessHours(createdAt);
  const st = slaStatus(bh);
  if (st === 'ok') return null;
  const c = slaColor(st);
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <FaClock className="text-[8px]" /> {Math.round(bh)}h
    </span>
  );
}

function NoResponseBadge({ firstResponseAt }: { firstResponseAt: string | null }) {
  if (firstResponseAt) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
      <FaExclamationTriangle className="text-[8px]" /> Sin resp.
    </span>
  );
}

function NewBadge({ createdAt }: { createdAt: string }) {
  if (hoursElapsed(createdAt) >= 2) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">
      Nuevo
    </span>
  );
}

function SeverityDot({ severity }: { severity?: string }) {
  const c = severity === 'high' ? 'bg-red-500' : severity === 'medium' ? 'bg-amber-500' : 'bg-green-500';
  return <span className={`w-2 h-2 rounded-full ${c} flex-shrink-0`} title={severity || 'low'} />;
}


// ════════════════════════════════════════════
// MAIN CASE LIST
// ════════════════════════════════════════════

interface CaseListProps {
  cases: OpsCase[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  counts: UrgCounts;
  search: string;
  setSearch: (v: string) => void;
  activeFilter: UrgFilterKey;
  setActiveFilter: (f: UrgFilterKey) => void;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function UrgCaseList({
  cases, loading, selectedId, onSelect, onRefresh, counts,
  search, setSearch, activeFilter, setActiveFilter, hasMore, onLoadMore,
}: CaseListProps) {
  const filters: { key: UrgFilterKey; label: string; count?: number; color: string; activeColor: string }[] = [
    { key: 'all', label: 'Todos', count: counts.total_active, color: 'bg-gray-100 text-gray-600', activeColor: 'bg-[#010139] text-white' },
    { key: 'sla_breached', label: 'SLA', count: counts.sla_breached, color: 'bg-red-50 text-red-600', activeColor: 'bg-red-600 text-white' },
    { key: 'no_first_response', label: 'Sin resp.', count: counts.no_first_response, color: 'bg-orange-50 text-orange-600', activeColor: 'bg-orange-500 text-white' },
    { key: 'assigned_to_me', label: 'Míos', color: 'bg-blue-50 text-blue-600', activeColor: 'bg-blue-600 text-white' },
    { key: 'today', label: 'Hoy', color: 'bg-purple-50 text-purple-600', activeColor: 'bg-purple-600 text-white' },
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120 && hasMore && !loading) {
      onLoadMore();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#010139] tracking-tight flex items-center gap-1.5">
            <FaFire className="text-red-400 text-[10px]" /> Urgencias
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 tabular-nums">{counts.total_active || 0} activas</span>
            <button onClick={onRefresh} className="text-gray-300 hover:text-[#010139] transition-colors duration-150 cursor-pointer">
              <FaSync className={`text-[10px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[10px] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente, ticket, categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#010139]/30 focus:ring-1 focus:ring-[#010139]/10 transition-all duration-150 placeholder:text-gray-300"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key === activeFilter ? 'all' : f.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-full cursor-pointer transition-all duration-150 ${
                activeFilter === f.key ? f.activeColor : f.color + ' hover:opacity-80'
              }`}
            >
              {f.label}
              {f.count !== undefined && <span className="text-[9px] opacity-70">({f.count})</span>}
            </button>
          ))}
          {/* Status dropdown */}
          <select
            value={(['pendiente', 'en_atencion', 'resuelto', 'cerrado'] as string[]).includes(activeFilter) ? activeFilter : ''}
            onChange={(e) => setActiveFilter((e.target.value || 'all') as UrgFilterKey)}
            className="appearance-none px-2.5 py-1 text-[10px] font-medium rounded-full border border-gray-200 bg-white text-gray-500 cursor-pointer outline-none hover:border-gray-300 transition-colors duration-150"
          >
            <option value="">Estado...</option>
            <option value="pendiente">Pendiente ({counts.pendiente || 0})</option>
            <option value="en_atencion">En Atención ({counts.en_atencion || 0})</option>
            <option value="resuelto">Resuelto ({counts.resuelto || 0})</option>
            <option value="cerrado">Cerrado ({counts.cerrado || 0})</option>
          </select>
        </div>
      </div>

      {/* Summary micro bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-gray-50 bg-gray-50/50 text-[10px] flex-shrink-0">
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Pend <strong className="text-gray-600">{counts.pendiente || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Atenc <strong className="text-gray-600">{counts.en_atencion || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> SLA <strong className="text-gray-600">{counts.sla_breached || 0}</strong>
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {loading && cases.length === 0 ? (
          <OpsSkeletonRows count={8} />
        ) : cases.length === 0 ? (
          <OpsEmptyState
            icon={<FaBolt className="text-gray-300 text-lg" />}
            title="No hay urgencias activas"
            subtitle="No se encontraron casos con estos filtros"
            action={search ? { label: 'Limpiar búsqueda', onClick: () => setSearch('') } : undefined}
          />
        ) : (
          <>
            {cases.map((c) => {
              const isSelected = selectedId === c.id;
              const isClosed = c.status === 'cerrado';
              const sevBorder = c.severity === 'high' ? 'border-l-red-400' : c.severity === 'medium' ? 'border-l-amber-300' : '';
              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`group px-4 py-3 cursor-pointer transition-all duration-150 border-b border-gray-50 ${
                    isSelected
                      ? 'bg-red-50/30 border-l-[3px] border-l-red-500'
                      : `hover:bg-gray-50/80 ${sevBorder ? `border-l-[3px] ${sevBorder}` : ''}`
                  } ${!isSelected && c.sla_breached && !sevBorder ? 'border-l-[3px] border-l-red-400' : ''}`}
                >
                  {/* Row 1: name + severity dot + time */}
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SeverityDot severity={c.severity ?? undefined} />
                      <span className={`text-[13px] font-semibold truncate ${isClosed ? 'text-gray-400' : 'text-[#010139]'}`}>
                        {c.client_name || 'Sin nombre'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-300 flex-shrink-0 ml-2 tabular-nums">
                      {fmtRelative(c.created_at)}
                    </span>
                  </div>

                  {/* Row 2: subline — ticket · category */}
                  <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-400">
                    <span className="font-mono">{c.ticket}</span>
                    {c.category && (
                      <><span>·</span><span className="truncate">{c.category}</span></>
                    )}
                  </div>

                  {/* Row 3: badges (compact) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={c.status} />
                    <SlaBadge createdAt={c.created_at} slaBreached={c.sla_breached} />
                    <NoResponseBadge firstResponseAt={c.first_response_at} />
                    <NewBadge createdAt={c.created_at} />
                    {c.assigned_master_id && (
                      <span className="inline-flex items-center px-1 py-0.5 text-[9px] text-gray-400">
                        <FaUserTie className="text-[8px]" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-center py-4">
                <FaSync className="animate-spin text-gray-200 text-xs" />
              </div>
            )}
            {hasMore && !loading && (
              <button
                onClick={onLoadMore}
                className="w-full py-3 text-[10px] text-gray-400 hover:text-[#010139] font-medium cursor-pointer transition-colors duration-150"
              >
                Cargar más...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
