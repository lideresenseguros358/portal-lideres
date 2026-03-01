'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import type { MasterUser, UrgCounts, UrgFilterKey } from './urg-helpers';
import { NOTE_REQUIRED_TRANSITIONS, buildChatDeepLink } from './urg-helpers';
import UrgCaseList from './UrgCaseList';
import UrgCaseDetail from './UrgCaseDetail';
import { NoteRequiredModal, ReEvalModal } from './UrgModals';
import UrgHistoryDrawer from './UrgHistoryDrawer';
import { useOpsKeyboard } from '../shared/ops-ui';

// ════════════════════════════════════════════
// Toast
// ════════════════════════════════════════════

interface Toast { id: number; msg: string; type: 'success' | 'error' }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium ops-toast-enter ${
            t.type === 'success' ? 'bg-gray-800 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ════════════════════════════════════════════

const PAGE_SIZE = 20;

const emptyCounts: UrgCounts = {
  total_active: 0, sla_breached: 0, no_first_response: 0,
  pendiente: 0, en_atencion: 0, resuelto: 0, cerrado: 0,
};

export default function UrgenciasInbox() {
  // ── List state ──
  const [cases, setCases] = useState<OpsCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<UrgCounts>(emptyCounts);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<UrgFilterKey>('all');

  // ── Detail state ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<OpsCase | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Masters ──
  const [masters, setMasters] = useState<MasterUser[]>([]);

  // ── Modals ──
  const [noteModal, setNoteModal] = useState<{ open: boolean; targetStatus: string }>({ open: false, targetStatus: '' });
  const [reEvalModal, setReEvalModal] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // ── History drawer ──
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Toasts ──
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const addToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Debounced search ──
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearch = useRef(search);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      debouncedSearch.current = search;
      setPage(1);
      fetchCases(1, search, activeFilter);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ═══════════════════════════════════════════
  // FETCHERS
  // ═══════════════════════════════════════════

  const fetchCases = useCallback(async (p: number, s?: string, filter?: UrgFilterKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      const q = s ?? debouncedSearch.current;
      const f = filter ?? activeFilter;

      if (q) params.set('search', q);

      // Map filter to API params
      if (f === 'sla_breached') params.set('sla_breached', 'true');
      else if (f === 'no_first_response') params.set('no_first_response', 'true');
      else if (f === 'assigned_to_me') params.set('assigned_to', 'me');
      else if (f === 'today') params.set('today', 'true');
      else if (['pendiente', 'en_atencion', 'resuelto', 'cerrado'].includes(f)) params.set('status', f);

      const res = await fetch(`/api/operaciones/urgencies?${params}`);
      const json = await res.json();

      if (p === 1) {
        setCases(json.data || []);
      } else {
        setCases((prev) => [...prev, ...(json.data || [])]);
      }
      setTotal(json.total || 0);
      setCounts(json.counts || emptyCounts);
    } catch (err) {
      console.error('[UrgenciasInbox] fetchCases error:', err);
    }
    setLoading(false);
  }, [activeFilter]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/operaciones/urgencies?search=&page=1&limit=1`);
      // Actually, just find from current list first
      const found = cases.find((c) => c.id === id);
      if (found) {
        setSelectedCase(found);
      } else {
        // Fallback: fetch single by searching the id
        const r2 = await fetch(`/api/operaciones/urgencies?page=1&limit=1&search=${id}`);
        const j2 = await r2.json();
        setSelectedCase(j2.data?.[0] || null);
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  }, [cases]);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch('/api/operaciones/urgencies?view=masters');
      const json = await res.json();
      setMasters(json.data || []);
    } catch { /* ignore */ }
  }, []);

  // ── Initial load ──
  useEffect(() => {
    fetchCases(1);
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh every 30s ──
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCases(1, debouncedSearch.current, activeFilter);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCases, activeFilter]);

  // ── Re-fetch when filter changes ──
  useEffect(() => {
    setPage(1);
    fetchCases(1, debouncedSearch.current, activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // ── Update selectedCase when cases list refreshes ──
  useEffect(() => {
    if (selectedId) {
      const updated = cases.find((c) => c.id === selectedId);
      if (updated) setSelectedCase(updated);
    }
  }, [cases, selectedId]);

  // ═══════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const found = cases.find((c) => c.id === id);
    setSelectedCase(found || null);
    if (!found) fetchDetail(id);
  };

  const handleRefreshList = () => {
    setPage(1);
    fetchCases(1, debouncedSearch.current, activeFilter);
  };

  const handleRefreshDetail = () => {
    if (selectedId) fetchDetail(selectedId);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCases(nextPage, debouncedSearch.current, activeFilter);
  };

  const handleStatusChange = async (newStatus: OpsCaseStatus, note?: string) => {
    if (!selectedCase) return;

    // If note is required (closing, or SLA breached) and not provided, show modal
    const needsNote = NOTE_REQUIRED_TRANSITIONS.includes(newStatus) || selectedCase.sla_breached;
    if (needsNote && !note) {
      setNoteModal({ open: true, targetStatus: newStatus });
      return;
    }

    // For 'resuelto', always ask for a note too
    if (newStatus === 'resuelto' && !note) {
      setNoteModal({ open: true, targetStatus: newStatus });
      return;
    }

    try {
      const res = await fetch('/api/operaciones/urgencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id: selectedCase.id, status: newStatus, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        addToast(json.error || 'Error al cambiar estado', 'error');
        return;
      }
      addToast(`Estado cambiado a ${STATUS_LABEL_MAP[newStatus] || newStatus}`);
      handleRefreshList();
    } catch {
      addToast('Error de conexión', 'error');
    }
  };

  const handleNoteModalConfirm = async (note: string) => {
    setModalSaving(true);
    await handleStatusChange(noteModal.targetStatus as OpsCaseStatus, note);
    setModalSaving(false);
    setNoteModal({ open: false, targetStatus: '' });
  };

  const handleReassign = async (masterId: string) => {
    if (!selectedCase) return;
    try {
      const res = await fetch('/api/operaciones/urgencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reassign', case_id: selectedCase.id, master_id: masterId }),
      });
      if (!res.ok) { addToast('Error al reasignar', 'error'); return; }
      addToast('Caso reasignado');
      handleRefreshList();
    } catch {
      addToast('Error de conexión', 'error');
    }
  };

  const handleAddNote = async (note: string, noteType: string) => {
    if (!selectedCase) return;
    try {
      const res = await fetch('/api/operaciones/urgencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', case_id: selectedCase.id, note, note_type: noteType }),
      });
      const json = await res.json();
      if (!res.ok) { addToast(json.error || 'Error al agregar nota', 'error'); return; }
      addToast('Nota agregada');
    } catch {
      addToast('Error de conexión', 'error');
    }
  };

  const handleReEvaluate = async () => {
    if (!selectedCase) return;
    setReEvalModal(true);
  };

  const handleReEvalConfirm = async () => {
    if (!selectedCase) return;
    setModalSaving(true);
    try {
      const res = await fetch('/api/operaciones/urgencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 're_evaluate', case_id: selectedCase.id }),
      });
      const json = await res.json();
      if (json.success) {
        addToast('Re-evaluación IA completada');
      } else {
        addToast(json.error || 'Error en re-evaluación', 'error');
      }
    } catch {
      addToast('Error de conexión', 'error');
    }
    setModalSaving(false);
    setReEvalModal(false);
    handleRefreshDetail();
  };

  const handleOpenChat = async () => {
    if (!selectedCase) return;
    const link = buildChatDeepLink(selectedCase.chat_thread_id);
    if (!link) { addToast('No hay chat vinculado a este caso', 'error'); return; }

    // Log the action
    fetch('/api/operaciones/urgencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_chat_open',
        case_id: selectedCase.id,
        chat_thread_id: selectedCase.chat_thread_id,
      }),
    }).catch(() => {});

    // Open in new tab
    window.open(link, '_blank');
  };

  const handleBack = () => {
    setSelectedId(null);
    setSelectedCase(null);
  };

  const hasMore = cases.length < total;

  // ── Keyboard shortcuts ──
  const shortcuts = useMemo(() => ({
    Escape: () => { setSelectedId(null); setSelectedCase(null); },
    ArrowDown: () => {
      if (!cases.length) return;
      const idx = cases.findIndex((c) => c.id === selectedId);
      const next = cases[idx + 1];
      if (idx < cases.length - 1 && next) handleSelect(next.id);
    },
    ArrowUp: () => {
      if (!cases.length) return;
      const idx = cases.findIndex((c) => c.id === selectedId);
      const prev = cases[idx - 1];
      if (idx > 0 && prev) handleSelect(prev.id);
    },
  }), [cases, selectedId]);
  useOpsKeyboard(shortcuts);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-120px)] border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Left panel — list */}
      <div className={`w-full lg:w-[360px] xl:w-[400px] border-r border-gray-200 flex-shrink-0 ${
        selectedId ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
      }`}>
        <UrgCaseList
          cases={cases}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onRefresh={handleRefreshList}
          counts={counts}
          search={search}
          setSearch={setSearch}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
        />
      </div>

      {/* Right panel — detail */}
      <div className={`flex-1 min-w-0 ${
        selectedId ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
      }`}>
        <UrgCaseDetail
          caseData={selectedCase}
          loading={detailLoading}
          onBack={handleBack}
          onRefresh={handleRefreshDetail}
          onStatusChange={handleStatusChange}
          onReassign={handleReassign}
          onShowHistory={() => setHistoryOpen(true)}
          onAddNote={handleAddNote}
          onReEvaluate={handleReEvaluate}
          onOpenChat={handleOpenChat}
          masters={masters}
        />
      </div>

      {/* ── Modals ── */}
      {selectedCase && (
        <>
          <NoteRequiredModal
            caseData={selectedCase}
            open={noteModal.open}
            targetStatus={noteModal.targetStatus}
            onClose={() => setNoteModal({ open: false, targetStatus: '' })}
            onConfirm={handleNoteModalConfirm}
            saving={modalSaving}
          />
          <ReEvalModal
            caseData={selectedCase}
            open={reEvalModal}
            onClose={() => setReEvalModal(false)}
            onConfirm={handleReEvalConfirm}
            saving={modalSaving}
          />
        </>
      )}

      {/* ── History Drawer ── */}
      <UrgHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        caseId={selectedId}
      />

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

// Quick label lookup
const STATUS_LABEL_MAP: Record<string, string> = {
  pendiente: 'Pendiente',
  en_atencion: 'En Atención',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};
