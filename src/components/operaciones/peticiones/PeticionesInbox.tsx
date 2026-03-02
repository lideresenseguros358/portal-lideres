'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import type { Counts, FilterKey, MasterUser } from './pet-helpers';
import PetCaseList from './PetCaseList';
import PetCaseDetail from './PetCaseDetail';
import { LostReasonModal, ConvertToEmissionModal } from './PetModals';
import PetHistoryDrawer from './PetHistoryDrawer';
import UnclassifiedMessages from '../renovaciones/UnclassifiedMessages';
import { useOpsKeyboard } from '../shared/ops-ui';

// ════════════════════════════════════════════
// METRICS HEADER BAR
// ════════════════════════════════════════════

function MetricsBar({ counts }: { counts: Counts }) {
  const metrics = [
    { label: 'Activas', value: counts.total_active || 0, color: 'text-[#010139]' },
    { label: 'Pendientes', value: counts.pendiente || 0, color: 'text-amber-600' },
    { label: 'Gestión', value: counts.en_gestion || 0, color: 'text-blue-600' },
    { label: 'Enviados', value: counts.enviado || 0, color: 'text-teal-600' },
    { label: 'SLA', value: counts.sla_breached || 0, color: 'text-red-600' },
    { label: 'Sin resp.', value: counts.no_first_response || 0, color: 'text-orange-600' },
    { label: 'Cerrados', value: counts.cerrado || 0, color: 'text-green-600' },
    { label: 'Perdidos', value: counts.perdido || 0, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-1.5">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col items-center py-1.5 px-1 rounded-lg bg-gray-50/80">
          <span className={`text-sm sm:text-base font-bold tabular-nums ${m.color}`}>{m.value}</span>
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-medium leading-tight text-center">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[100] px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium ops-toast-enter ${
      type === 'success' ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'
    }`}>
      {message}
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════

const PAGE_SIZE = 20;

export default function PeticionesInbox() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'inbox' | 'unclassified'>('inbox');

  // ── Data state ──
  const [cases, setCases] = useState<OpsCase[]>([]);
  const [counts, setCounts] = useState<Counts>({ total_active: 0, sla_breached: 0, no_first_response: 0 });
  const [masters, setMasters] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ── UI state ──
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Modals ──
  const [showLostModal, setShowLostModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Debounce search
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Build query params ──
  const buildParams = useCallback((p: number) => {
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set('search', debouncedSearch);

    switch (activeFilter) {
      case 'sla_breached':
        params.set('sla_breached', 'true');
        break;
      case 'no_first_response':
        params.set('no_first_response', 'true');
        break;
      case 'assigned_to_me':
        params.set('assigned_to', 'me');
        break;
      case 'all':
        break;
      default:
        // Specific status
        params.set('status', activeFilter);
        break;
    }
    return params.toString();
  }, [debouncedSearch, activeFilter]);

  // ── Fetch cases ──
  const fetchCases = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operaciones/petitions?${buildParams(p)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (append) {
        setCases((prev) => [...prev, ...(json.data || [])]);
      } else {
        setCases(json.data || []);
      }
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts as Counts);
    } catch (err: any) {
      setToast({ message: `Error cargando casos: ${err.message}`, type: 'error' });
    }
    setLoading(false);
  }, [buildParams]);

  // ── Fetch masters ──
  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch('/api/operaciones/petitions?view=masters');
      const json = await res.json();
      setMasters(json.data || []);
    } catch { /* ignore */ }
  }, []);

  // ── Initial + filter/search change ──
  useEffect(() => {
    setPage(1);
    setSelectedId(null);
    fetchCases(1);
  }, [fetchCases]);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  // ── Handlers ──
  const refresh = () => {
    setPage(1);
    fetchCases(1);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCases(nextPage, true);
  };

  const selectedCase = cases.find((c) => c.id === selectedId) || null;

  // ── API action helper ──
  const apiAction = async (body: Record<string, any>, successMsg: string) => {
    setModalSaving(true);
    try {
      const res = await fetch('/api/operaciones/petitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setToast({ message: successMsg, type: 'success' });
      refresh();
      return json;
    } catch (err: any) {
      setToast({ message: `Error: ${err.message}`, type: 'error' });
      return null;
    } finally {
      setModalSaving(false);
    }
  };

  const handleStatusChange = (status: OpsCaseStatus) => {
    if (!selectedCase) return;
    apiAction({ action: 'update_status', id: selectedCase.id, status }, `Estado actualizado a ${status}`);
  };

  const handleMarkLost = (reason: string) => {
    if (!selectedCase) return;
    apiAction(
      { action: 'mark_lost', id: selectedCase.id, reason },
      'Petición marcada como perdida'
    ).then(() => setShowLostModal(false));
  };

  const handleConvertToEmission = () => {
    if (!selectedCase) return;
    apiAction(
      { action: 'convert_to_emission', id: selectedCase.id },
      'Petición convertida a emisión exitosamente'
    ).then((result) => {
      setShowConvertModal(false);
      if (result?.converted) {
        // TODO: Open new client wizard with result.caseData
        console.log('[PeticionesInbox] Converted — caseData:', result.caseData);
      }
    });
  };

  const handleReassign = (masterId: string) => {
    if (!selectedCase) return;
    apiAction({ action: 'reassign', case_id: selectedCase.id, master_id: masterId }, 'Caso reasignado');
  };

  const handleSendEmail = (body: string, template: string) => {
    if (!selectedCase) return;
    apiAction(
      { action: 'update_status', id: selectedCase.id, status: selectedCase.status },
      'Correo registrado en bitácora'
    );
  };

  const hasMore = cases.length < total;

  // ── Keyboard shortcuts ──
  const shortcuts = useMemo(() => ({
    Escape: () => { setSelectedId(null); },
    ArrowDown: () => {
      if (!cases.length) return;
      const idx = cases.findIndex((c) => c.id === selectedId);
      const next = cases[idx + 1];
      if (idx < cases.length - 1 && next) setSelectedId(next.id);
    },
    ArrowUp: () => {
      if (!cases.length) return;
      const idx = cases.findIndex((c) => c.id === selectedId);
      const prev = cases[idx - 1];
      if (idx > 0 && prev) setSelectedId(prev.id);
    },
  }), [cases, selectedId]);
  useOpsKeyboard(shortcuts);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-3">
      {/* Tab switcher + Metrics */}
      <div className="flex flex-col gap-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md cursor-pointer transition-all duration-150 ${
                activeTab === 'inbox'
                  ? 'bg-[#010139] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Bandeja
            </button>
            <button
              onClick={() => setActiveTab('unclassified')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md cursor-pointer transition-all duration-150 ${
                activeTab === 'unclassified'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              No Clasificados
            </button>
          </div>
        </div>
        <MetricsBar counts={counts} />
      </div>

      {/* Inbox or Unclassified */}
      {activeTab === 'unclassified' ? (
        <UnclassifiedMessages />
      ) : (
      <div className="flex flex-1 gap-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
        {/* Left panel */}
        <div className={`${selectedId ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[30%] border-r border-gray-200 min-h-0`}>
          <PetCaseList
            cases={cases}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={refresh}
            counts={counts}
            search={search}
            setSearch={setSearch}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>

        {/* Right panel */}
        <div className={`${selectedId ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-h-0`}>
          <PetCaseDetail
            caseData={selectedCase}
            loading={detailLoading}
            onBack={() => setSelectedId(null)}
            onRefresh={refresh}
            onStatusChange={handleStatusChange}
            onMarkLost={() => setShowLostModal(true)}
            onConvertToEmission={() => setShowConvertModal(true)}
            onReassign={handleReassign}
            onShowHistory={() => setShowHistory(true)}
            onSendEmail={handleSendEmail}
            masters={masters}
          />
        </div>
      </div>

      )}

      {/* ── Modals ── */}
      {selectedCase && (
        <>
          <LostReasonModal
            caseData={selectedCase}
            open={showLostModal}
            onClose={() => setShowLostModal(false)}
            onConfirm={handleMarkLost}
            saving={modalSaving}
          />
          <ConvertToEmissionModal
            caseData={selectedCase}
            open={showConvertModal}
            onClose={() => setShowConvertModal(false)}
            onConfirm={handleConvertToEmission}
            saving={modalSaving}
          />
        </>
      )}

      {/* ── History Drawer ── */}
      <PetHistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        caseId={selectedId}
      />

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
