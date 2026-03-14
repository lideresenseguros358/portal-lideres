'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/operaciones.types';
import type { Counts, FilterKey, MasterUser } from './pet-helpers';
import { fmtRelative } from './pet-helpers';
import PetCaseList from './PetCaseList';
import PetCaseDetail from './PetCaseDetail';
import { LostReasonModal, ConvertToEmissionModal } from './PetModals';
import PetHistoryDrawer from './PetHistoryDrawer';
import PetQuoteDetailModal from './PetQuoteDetailModal';
import UnclassifiedMessages from '../renovaciones/UnclassifiedMessages';
import { useOpsKeyboard, OpsSkeletonRows, OpsEmptyState } from '../shared/ops-ui';
import { FaFilter, FaCheck } from 'react-icons/fa';
import dynamic from 'next/dynamic';

const ClientPolicyWizard = dynamic(() => import('@/components/db/ClientPolicyWizard'), { ssr: false });

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
    <div className="grid grid-cols-4 md:grid-cols-8 gap-1 md:gap-1.5">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col items-center py-1.5 px-1 rounded-lg bg-gray-50/80 min-w-0">
          <span className={`text-xs sm:text-sm md:text-base font-bold tabular-nums ${m.color}`}>{m.value}</span>
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-medium leading-tight text-center truncate w-full">{m.label}</span>
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
  const [activeTab, setActiveTab] = useState<'inbox' | 'unclassified' | 'closed'>('inbox');

  // ── Closed tab state ──
  type ClosedRange = 'day' | 'week' | 'month' | 'year';
  const [closedCases, setClosedCases] = useState<OpsCase[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedTotal, setClosedTotal] = useState(0);
  const [closedPage, setClosedPage] = useState(1);
  const [closedRange, setClosedRange] = useState<ClosedRange>('month');
  const [closedFilterOpen, setClosedFilterOpen] = useState(false);
  const closedFilterRef = useRef<HTMLDivElement>(null);

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
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // ── New Client Wizard (after convert-to-emission) ──
  const [showNewClientWizard, setShowNewClientWizard] = useState(false);
  const [wizardPrefill, setWizardPrefill] = useState<any>(null);

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
      const res = await fetch(`/api/operaciones/petitions?${params}`);
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
      if (result?.converted && result.caseData) {
        const cd = result.caseData;
        const ramoMap: Record<string, string> = { vida: 'VIDA', incendio: 'INCENDIO', hogar: 'HOGAR', auto: 'AUTO' };
        setWizardPrefill({
          client_name: cd.client_name || '',
          email: cd.client_email || '',
          phone: cd.client_phone || '',
          cedula: cd.cedula || '',
          ramo: ramoMap[(cd.ramo || '').toLowerCase()] || '',
          broker_email: 'portal@lideresenseguros.com',
          notas: `Convertido desde Petición ${cd.ticket || ''}`,
        });
        setShowNewClientWizard(true);
      }
    });
  };

  const handleReassign = (masterId: string) => {
    if (!selectedCase) return;
    apiAction({ action: 'reassign', case_id: selectedCase.id, master_id: masterId }, 'Caso reasignado');
  };

  const handleSendEmail = async (body: string, template: string, attachments?: File[]) => {
    if (!selectedCase) return;
    const c = selectedCase;
    const ramoKey = (c.ramo || '').toLowerCase();
    const ramoLabel = ({ vida: 'Vida', incendio: 'Incendio', hogar: 'Hogar' } as Record<string, string>)[ramoKey] || c.ramo || '';
    const subject = `[${c.ticket}] Cotización ${ramoLabel} — ${c.client_name || ''}`;
    const assignedMaster = masters.find((m) => m.id === c.assigned_master_id);

    // 1. Record outbound message + send via Zepto (with attachments if any)
    try {
      if (attachments && attachments.length > 0) {
        // Use FormData to send files
        const fd = new FormData();
        fd.append('action', 'record_outbound');
        fd.append('case_id', c.id);
        fd.append('subject', subject);
        fd.append('body_text', body);
        fd.append('to_emails', JSON.stringify(c.client_email ? [c.client_email] : []));
        fd.append('from_email', 'portal@lideresenseguros.com');
        if (assignedMaster) {
          fd.append('master_name', assignedMaster.full_name);
          fd.append('master_email', assignedMaster.email);
        }
        for (const file of attachments) {
          fd.append('file', file, file.name);
        }
        await fetch('/api/operaciones/messages', { method: 'POST', body: fd });
      } else {
        await fetch('/api/operaciones/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record_outbound',
            case_id: c.id,
            subject,
            body_text: body,
            to_emails: c.client_email ? [c.client_email] : [],
            from_email: 'portal@lideresenseguros.com',
            master_name: assignedMaster?.full_name || null,
            master_email: assignedMaster?.email || null,
          }),
        });
      }
    } catch (err) {
      console.error('[PeticionesInbox] record_outbound failed:', err);
    }

    // 2. Log email_sent activity
    try {
      await fetch('/api/operaciones/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_activity',
          action_type: 'email_sent',
          entity_type: 'case',
          entity_id: c.id,
          metadata: { ticket: c.ticket, template, to: c.client_email, subject },
        }),
      });
    } catch (err) {
      console.error('[PeticionesInbox] log email_sent failed:', err);
    }

    // 3. If status is pendiente, auto-transition to en_gestion (first response)
    if (c.status === 'pendiente') {
      await apiAction(
        { action: 'update_status', id: c.id, status: 'en_gestion' },
        'Correo enviado — caso pasó a En Gestión'
      );
    } else {
      setToast({ message: 'Correo registrado en bitácora', type: 'success' });
      refresh();
    }
  };

  const handleSendPaymentLink = async (paymentLinkUrl: string, tramite: string) => {
    if (!selectedCase || !selectedCase.client_email) {
      setToast({ message: 'No hay email del cliente para enviar', type: 'error' });
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
          case_type: 'peticion',
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
              subject: json.subject || `[${c.ticket}] Enlace de pago — ${tramite || 'Petición'}`,
              body_text: `Enlace de pago enviado: ${paymentLinkUrl}`,
              to_emails: c.client_email ? [c.client_email] : [],
              from_email: 'portal@lideresenseguros.com',
              skip_send: true,
              metadata_extra: { template: 'payment_link', payment_link: paymentLinkUrl, tramite: tramite || null },
            }),
          });
        } catch { /* non-fatal */ }
        setToast({ message: 'Enlace de pago enviado exitosamente', type: 'success' });
        refresh();
      } else {
        setToast({ message: json.email_error || 'Error al enviar enlace', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Error al enviar enlace de pago', type: 'error' });
    }
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
    <div className="flex flex-col min-h-[600px] h-[calc(100dvh-140px)] md:h-[calc(100dvh-160px)] gap-3">
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
        </div>
        <MetricsBar counts={counts} />
      </div>

      {/* Inbox, Unclassified, or Closed */}
      {activeTab === 'unclassified' ? (
        <UnclassifiedMessages />
      ) : activeTab === 'closed' ? (
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
            onSendPaymentLink={handleSendPaymentLink}
            onViewQuote={() => setShowQuoteModal(true)}
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

      {/* ── Quote Detail Modal ── */}
      {selectedCase && (
        <PetQuoteDetailModal
          open={showQuoteModal}
          onClose={() => setShowQuoteModal(false)}
          caseId={selectedCase.id}
          ramo={selectedCase.ramo}
          clientName={selectedCase.client_name}
          onSaved={() => {
            setToast({ message: 'Datos de solicitud actualizados', type: 'success' });
            refresh();
          }}
        />
      )}

      {/* ── New Client Wizard (after convert-to-emission) ── */}
      {showNewClientWizard && (
        <ClientPolicyWizard
          onClose={() => { setShowNewClientWizard(false); setWizardPrefill(null); }}
          onSuccess={() => {
            setShowNewClientWizard(false);
            setWizardPrefill(null);
            setToast({ message: 'Cliente registrado exitosamente desde petición', type: 'success' });
            refresh();
          }}
          role="master"
          userEmail="portal@lideresenseguros.com"
          prefillData={wizardPrefill}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
