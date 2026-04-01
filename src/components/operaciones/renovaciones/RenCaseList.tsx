'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FaSearch,
  FaSync,
  FaClock,
  FaExclamationTriangle,
  FaUserTie,
  FaCalendarAlt,
  FaInbox,
  FaThumbtack,
} from 'react-icons/fa';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS, RENEWAL_STATUSES } from '@/types/operaciones.types';
import type { Counts, FilterKey } from './ren-helpers';
import { fmtRelative, fmtDate, hoursElapsed } from './ren-helpers';
import { OpsSkeletonRows, OpsEmptyState } from '../shared/ops-ui';
import {
  CaseActionsRow, CaseDotsMenu,
  CaseDeleteModal, CaseAssignModal,
  type MasterUser,
} from '../shared/CaseActions';

const STORAGE_KEY = 'pins:renovaciones';

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

function SlaBadge({ breached }: { breached: boolean }) {
  if (!breached) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
      <FaClock className="text-[8px]" /> SLA
    </span>
  );
}

function NoResponseBadge({ firstResponseAt, createdAt }: { firstResponseAt: string | null; createdAt: string }) {
  if (firstResponseAt) return null;
  if (hoursElapsed(createdAt) < 48) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
      <FaExclamationTriangle className="text-[8px]" /> Sin resp.
    </span>
  );
}

function AplazadoVencidoBadge({ aplazadoUntil }: { aplazadoUntil: string | null }) {
  if (!aplazadoUntil) return null;
  if (new Date(aplazadoUntil) >= new Date()) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600">
      <FaClock className="text-[8px]" /> Vencido
    </span>
  );
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
  counts: Counts;
  search: string;
  setSearch: (v: string) => void;
  activeFilter: FilterKey;
  setActiveFilter: (f: FilterKey) => void;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function RenCaseList({
  cases, loading, selectedId, onSelect, onRefresh, counts,
  search, setSearch, activeFilter, setActiveFilter, hasMore, onLoadMore,
}: CaseListProps) {
  // ── PIN state ──────────────────────────────
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPinnedIds(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Assign master modal ────────────────────
  const [assignCaseId, setAssignCaseId] = useState<string | null>(null);
  const [masters, setMasters] = useState<MasterUser[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const openAssign = useCallback((caseId: string) => {
    setAssignCaseId(caseId);
    if (masters.length === 0) {
      fetch('/api/chats/masters')
        .then(r => r.json())
        .then(d => { if (d.data) setMasters(d.data); })
        .catch(() => {});
    }
  }, [masters.length]);

  const doAssign = useCallback(async (masterId: string | null) => {
    if (!assignCaseId) return;
    setAssignLoading(true);
    try {
      await fetch('/api/operaciones/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reassign', case_id: assignCaseId, master_id: masterId }),
      });
      onRefresh();
    } finally {
      setAssignLoading(false);
      setAssignCaseId(null);
    }
  }, [assignCaseId, onRefresh]);

  // ── Delete modal ───────────────────────────
  const [deleteCaseId, setDeleteCaseId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const doDelete = useCallback(async () => {
    if (!deleteCaseId) return;
    setDeleteLoading(true);
    try {
      await fetch('/api/operaciones/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', case_id: deleteCaseId }),
      });
      onRefresh();
    } finally {
      setDeleteLoading(false);
      setDeleteCaseId(null);
    }
  }, [deleteCaseId, onRefresh]);

  // ── Sorted list: pinned first ──────────────
  const sortedCases = [
    ...pinnedIds.map(id => cases.find(c => c.id === id)).filter(Boolean) as OpsCase[],
    ...cases.filter(c => !pinnedIds.includes(c.id)),
  ];

  const hasPinned = pinnedIds.some(id => cases.some(c => c.id === id));
  const activeCase = deleteCaseId ? cases.find(c => c.id === deleteCaseId) : null;
  const assignCase = assignCaseId ? cases.find(c => c.id === assignCaseId) : null;

  const filters: { key: FilterKey; label: string; count?: number; color: string; activeColor: string }[] = [
    { key: 'all', label: 'Todos', count: counts.total_active, color: 'bg-gray-100 text-gray-600', activeColor: 'bg-[#010139] text-white' },
    { key: 'sla_breached', label: 'SLA', count: counts.sla_breached, color: 'bg-red-50 text-red-600', activeColor: 'bg-red-600 text-white' },
    { key: 'aplazado', label: 'Aplazados', count: counts.aplazado, color: 'bg-amber-50 text-amber-600', activeColor: 'bg-amber-500 text-white' },
    { key: 'no_first_response', label: 'Sin resp.', count: counts.no_first_response, color: 'bg-orange-50 text-orange-600', activeColor: 'bg-orange-500 text-white' },
    { key: 'assigned_to_me', label: 'Míos', color: 'bg-blue-50 text-blue-600', activeColor: 'bg-blue-600 text-white' },
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120 && hasMore && !loading) {
      onLoadMore();
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white">
        {/* Top bar */}
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 border-b border-gray-100 space-y-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-[#010139] tracking-tight">Renovaciones</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs text-gray-400 tabular-nums">{counts.total_active || 0} activas</span>
              <button onClick={onRefresh} className="p-1 rounded-md text-gray-300 hover:text-[#010139] hover:bg-gray-50 transition-colors duration-150 cursor-pointer">
                <FaSync className={`text-xs ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-2 border-gray-200 rounded-lg focus-within:border-[#8AAA19] focus-within:ring-2 focus-within:ring-[#8AAA19]/20 bg-white px-3 py-2">
            <div className="flex-shrink-0 text-gray-400"><FaSearch size={14} /></div>
            <input type="text" placeholder="Buscar cliente, póliza, ticket..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm bg-transparent p-0" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
            {filters.map((f) => (
              <button key={f.key} onClick={() => setActiveFilter(f.key === activeFilter ? 'all' : f.key)}
                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-full cursor-pointer transition-all duration-150 flex-shrink-0 ${
                  activeFilter === f.key ? f.activeColor : f.color + ' hover:opacity-80'
                }`}>
                {f.label}
                {f.count !== undefined && <span className="opacity-70">({f.count})</span>}
              </button>
            ))}
            <select value={RENEWAL_STATUSES.includes(activeFilter as OpsCaseStatus) ? activeFilter : ''}
              onChange={(e) => setActiveFilter((e.target.value || 'all') as FilterKey)}
              className="appearance-none px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-full border border-gray-200 bg-white text-gray-500 cursor-pointer outline-none hover:border-gray-300 transition-colors duration-150 flex-shrink-0">
              <option value="">Estado</option>
              {RENEWAL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]} {counts[s] !== undefined ? `(${counts[s]})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {loading && cases.length === 0 ? (
            <OpsSkeletonRows count={8} />
          ) : cases.length === 0 ? (
            <OpsEmptyState icon={<FaInbox className="text-gray-300 text-lg" />}
              title="No hay renovaciones pendientes"
              subtitle="No se encontraron casos con estos filtros"
              action={search ? { label: 'Limpiar búsqueda', onClick: () => setSearch('') } : undefined} />
          ) : (
            <>
              {sortedCases.map((c, idx) => {
                const isSelected = selectedId === c.id;
                const isClosed = c.status === 'cerrado_renovado' || c.status === 'cerrado_cancelado';
                const isPinned = pinnedIds.includes(c.id);
                const prevWasPinned = idx > 0 && pinnedIds.includes(sortedCases[idx - 1]?.id ?? '');
                const showDivider = hasPinned && !isPinned && prevWasPinned;
                return (
                  <div key={c.id}>
                    {showDivider && (
                      <div className="flex items-center gap-2 px-4 py-1 bg-gray-50 border-b border-gray-100">
                        <span className="text-[9px] text-gray-400 font-semibold tracking-widest uppercase">Resto</span>
                      </div>
                    )}
                    <CaseActionsRow
                      isPinned={isPinned}
                      onPin={() => togglePin(c.id)}
                      onAssignMaster={() => openAssign(c.id)}
                      onDelete={() => setDeleteCaseId(c.id)}
                      onCardClick={() => onSelect(c.id)}
                    >
                      <div className={`group px-4 py-3 transition-all duration-150 border-b border-gray-50 ${
                        isSelected
                          ? 'bg-[#010139]/[0.03] border-l-[3px] border-l-[#010139]'
                          : 'hover:bg-gray-50/80'
                      } ${!isSelected && c.sla_breached ? 'border-l-[3px] border-l-red-400' : ''}
                      ${isPinned && !isSelected ? 'bg-blue-50/30' : ''}`}>
                        {/* Row 1 */}
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            {isPinned && <FaThumbtack className="text-blue-400 text-[9px] flex-shrink-0 -rotate-45" />}
                            <span className={`text-[13px] font-semibold truncate ${isClosed ? 'text-gray-400' : 'text-[#010139]'}`}>
                              {c.client_name || 'Sin nombre'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <span className="text-[10px] text-gray-300 tabular-nums">{fmtRelative(c.updated_at)}</span>
                            <CaseDotsMenu
                              isPinned={isPinned}
                              onPin={() => togglePin(c.id)}
                              onAssignMaster={() => openAssign(c.id)}
                              onDelete={() => setDeleteCaseId(c.id)}
                            />
                          </div>
                        </div>

                        {/* Row 2 */}
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-400">
                          <span className="font-mono">{c.policy_number || '—'}</span>
                          {c.ramo && <><span>·</span><span>{c.ramo}</span></>}
                          <span>·</span>
                          <span>{c.ticket}</span>
                          {c.renewal_date && (
                            <><span>·</span><span className="flex items-center gap-0.5"><FaCalendarAlt className="text-[7px]" /> {fmtDate(c.renewal_date)}</span></>
                          )}
                        </div>

                        {/* Row 3 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={c.status} />
                          <SlaBadge breached={c.sla_breached} />
                          <NoResponseBadge firstResponseAt={c.first_response_at} createdAt={c.created_at} />
                          <AplazadoVencidoBadge aplazadoUntil={c.aplazado_until} />
                          {c.assigned_master_id && (
                            <span className="inline-flex items-center px-1 py-0.5 text-[9px] text-gray-400">
                              <FaUserTie className="text-[8px]" />
                            </span>
                          )}
                        </div>
                      </div>
                    </CaseActionsRow>
                  </div>
                );
              })}
              {loading && <div className="flex justify-center py-4"><FaSync className="animate-spin text-gray-200 text-xs" /></div>}
              {hasMore && !loading && (
                <button onClick={onLoadMore} className="w-full py-3 text-[10px] text-gray-400 hover:text-[#010139] font-medium cursor-pointer transition-colors duration-150">
                  Cargar más...
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {deleteCaseId && (
        <CaseDeleteModal
          name={activeCase?.client_name || ''}
          loading={deleteLoading}
          onConfirm={doDelete}
          onCancel={() => setDeleteCaseId(null)}
        />
      )}

      {assignCaseId && (
        <CaseAssignModal
          masters={masters}
          currentMasterId={assignCase?.assigned_master_id}
          loading={assignLoading}
          onAssign={doAssign}
          onCancel={() => setAssignCaseId(null)}
        />
      )}
    </>
  );
}
