'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { MasterUser, UrgCounts, UrgFilterKey } from './urg-helpers';
import { NOTE_REQUIRED_TRANSITIONS, buildChatDeepLink, fmtRelative } from './urg-helpers';
import UrgCaseList from './UrgCaseList';
import UrgCaseDetail from './UrgCaseDetail';
import { NoteRequiredModal, ReEvalModal } from './UrgModals';
import UrgHistoryDrawer from './UrgHistoryDrawer';
import { useOpsKeyboard, OpsSkeletonRows, OpsEmptyState } from '../shared/ops-ui';
import { FaFilter, FaCheck } from 'react-icons/fa';

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
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'inbox' | 'closed'>('inbox');

  // ── Closed tab state ──
  type ClosedRange = 'day' | 'week' | 'month' | 'year';
  const [closedCases, setClosedCases] = useState<OpsCase[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedTotal, setClosedTotal] = useState(0);
  const [closedPage, setClosedPage] = useState(1);
  const [closedRange, setClosedRange] = useState<ClosedRange>('month');
  const [closedFilterOpen, setClosedFilterOpen] = useState(false);
  const closedFilterRef = useRef<HTMLDivElement>(null);

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

  // ── Fetch closed cases ──
  const getClosedSince = useCallback((range: ClosedRange) => {
    const now = new Date();
    switch (range) {
      case 'day': now.setDate(now.getDate() - 1); break;
      case 'week': now.setDate(now.getDate() - 7); break;
      case 'month': now.setMonth(now.getMonth() - 1); break;
      case 'year': now.setFullYear(now.getFullYear() - 1); break;
    }
    return now.toISOString();
  }, []);

  const fetchClosedCases = useCallback(async (p: number, append = false) => {
    setClosedLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE), closed: 'true', closed_since: getClosedSince(closedRange) });
      const res = await fetch(`/api/operaciones/urgencies?${params}`);
      const json = await res.json();
      if (append) {
        setClosedCases((prev) => [...prev, ...(json.data || [])]);
      } else {
        setClosedCases(json.data || []);
      }
      setClosedTotal(json.total || 0);
    } catch { /* ignore */ }
    setClosedLoading(false);
  }, [closedRange, getClosedSince]);

  useEffect(() => {
    if (activeTab === 'closed') {
      setClosedPage(1);
      fetchClosedCases(1);
    }
  }, [activeTab, fetchClosedCases]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (closedFilterRef.current && !closedFilterRef.current.contains(e.target as Node)) setClosedFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

  const handleSendEmail = async (body: string, template: string) => {
    if (!selectedCase || !selectedCase.client_email) {
      addToast('No hay email del cliente para enviar', 'error');
      return;
    }
    try {
      const res = await fetch('/api/operaciones/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          to_email: selectedCase.client_email,
          subject: `[${selectedCase.ticket}] Urgencia — ${selectedCase.client_name || 'Cliente'}`,
          body_html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
          body_text: body,
          case_id: selectedCase.id,
          user_id: null,
        }),
      });
      const json = await res.json();
      if (json.email_sent) {
        addToast('Correo enviado exitosamente');
        // Mark first response if not yet responded
        if (!selectedCase.first_response_at) {
          handleRefreshList();
        }
      } else {
        addToast(json.email_error || 'Error al enviar correo', 'error');
      }
    } catch {
      addToast('Error de conexión al enviar correo', 'error');
    }
  };

  const handleSendPaymentLink = async (paymentLinkUrl: string, tramite: string) => {
    if (!selectedCase || !selectedCase.client_email) {
      addToast('No hay email del cliente para enviar', 'error');
      return;
    }
    const c = selectedCase;
    try {
      const res = await fetch('/api/operaciones/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_payment_link',
          to_email: c.client_email,
          client_name: c.client_name || 'Cliente',
          policy_number: c.policy_number,
          insurer_name: c.insurer_name,
          ticket: c.ticket,
          case_type: 'urgencia',
          payment_link: paymentLinkUrl,
          tramite: tramite || undefined,
          case_id: c.id,
          user_id: null,
        }),
      });
      const json = await res.json();
      if (json.email_sent) {
        // Record in ops_case_messages so it shows in the message history
        try {
          await fetch('/api/operaciones/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record_outbound',
              case_id: c.id,
              subject: json.subject || `[${c.ticket}] Enlace de pago — ${tramite || 'Urgencia'}`,
              body_text: `Enlace de pago enviado: ${paymentLinkUrl}`,
              to_emails: c.client_email ? [c.client_email] : [],
              from_email: 'portal@lideresenseguros.com',
              skip_send: true,
              metadata_extra: { template: 'payment_link', payment_link: paymentLinkUrl, tramite: tramite || null },
            }),
          });
        } catch { /* non-fatal */ }
        addToast('Enlace de pago enviado exitosamente');
      } else {
        addToast(json.email_error || 'Error al enviar enlace', 'error');
      }
    } catch {
      addToast('Error de conexión al enviar enlace', 'error');
    }
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
    <div className="flex flex-col min-h-[600px] h-[calc(100dvh-140px)] md:h-[calc(100dvh-160px)] gap-3">
      {/* Tab switcher */}
      <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100 flex-shrink-0 w-fit">
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
          onClick={() => setActiveTab('closed')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md cursor-pointer transition-all duration-150 ${
            activeTab === 'closed'
              ? 'bg-gray-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Cerrados
        </button>
      </div>

      {activeTab === 'closed' ? (
        <div className="flex flex-col flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600">Casos cerrados <span className="text-gray-400 font-normal">({closedTotal})</span></p>
            <div className="relative" ref={closedFilterRef}>
              <button
                onClick={() => setClosedFilterOpen(!closedFilterOpen)}
                className={`p-2 rounded-lg border cursor-pointer transition-colors duration-100 ${
                  closedFilterOpen ? 'bg-[#010139] text-white border-[#010139]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <FaFilter className="text-[10px]" />
              </button>
              {closedFilterOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px] py-1">
                  {([['day', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes'], ['year', 'Este año']] as [ClosedRange, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setClosedRange(val); setClosedFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors duration-100 ${
                        closedRange === val ? 'bg-gray-50 text-[#010139] font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                      {closedRange === val && <FaCheck className="text-[8px] text-[#010139]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {closedLoading && !closedCases.length ? (
              <div className="p-4"><OpsSkeletonRows count={6} /></div>
            ) : !closedCases.length ? (
              <OpsEmptyState title="No hay casos cerrados en este periodo" />
            ) : (
              <div className="divide-y divide-gray-50">
                {closedCases.map((c) => {
                  const colors = STATUS_COLORS[c.status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors duration-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-800 truncate">{c.client_name || 'Sin nombre'}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${colors.bg} ${colors.text}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="font-mono">{c.ticket}</span>
                          {c.policy_number && <span>· {c.policy_number}</span>}
                          {c.insurer_name && <span>· {c.insurer_name}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtRelative(c.closed_at || c.updated_at)}</span>
                    </div>
                  );
                })}
                {closedCases.length < closedTotal && (
                  <button
                    onClick={() => { const p = closedPage + 1; setClosedPage(p); fetchClosedCases(p, true); }}
                    className="w-full py-3 text-xs text-[#010139] font-semibold hover:bg-gray-50 cursor-pointer transition-colors duration-100"
                  >
                    Cargar más
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="flex flex-1 border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm min-h-0">
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

      {/* Right panel — fullscreen overlay on mobile, side panel on desktop */}
      <div className={
        selectedId
          ? 'fixed inset-0 z-[1000] h-dvh flex flex-col lg:relative lg:inset-auto lg:z-auto lg:h-auto lg:flex-1'
          : 'hidden lg:flex lg:flex-1 lg:flex-col'
      }>
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
          onSendEmail={handleSendEmail}
          onSendPaymentLink={handleSendPaymentLink}
          masters={masters}
        />
      </div>

      </div>
      )}

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
