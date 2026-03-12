'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { OpsCase, OpsCaseStatus } from '@/types/operaciones.types';
import type { Counts, FilterKey, MasterUser } from './ren-helpers';
import RenCaseList from './RenCaseList';
import RenCaseDetail from './RenCaseDetail';
import { ConfirmRenewalModal, CancelModal, type RenewalConfirmData } from './RenModals';
import { createPaymentOnEmission } from '@/lib/adm-cot/create-payment-on-emission';
import RenHistoryDrawer from './RenHistoryDrawer';
import UnclassifiedMessages from './UnclassifiedMessages';
import { useOpsKeyboard } from '../shared/ops-ui';

// ════════════════════════════════════════════
// METRICS HEADER BAR
// ════════════════════════════════════════════

function MetricsBar({ counts }: { counts: Counts }) {
  const metrics = [
    { label: 'Activas', value: counts.total_active || 0, color: 'text-[#010139]', dot: 'bg-[#010139]' },
    { label: 'Pendientes', value: counts.pendiente || 0, color: 'text-amber-600', dot: 'bg-amber-400' },
    { label: 'Revisión', value: counts.en_revision || 0, color: 'text-blue-600', dot: 'bg-blue-400' },
    { label: 'Aplazadas', value: counts.aplazado || 0, color: 'text-purple-600', dot: 'bg-purple-400' },
    { label: 'SLA', value: counts.sla_breached || 0, color: 'text-red-600', dot: 'bg-red-400' },
    { label: 'Sin resp.', value: counts.no_first_response || 0, color: 'text-orange-600', dot: 'bg-orange-400' },
    { label: 'Renovadas', value: counts.cerrado_renovado || 0, color: 'text-green-600', dot: 'bg-green-400' },
    { label: 'Canceladas', value: counts.cerrado_cancelado || 0, color: 'text-red-600', dot: 'bg-red-400' },
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

export default function RenovacionesInbox() {
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
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
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
      case 'aplazado':
        params.set('aplazado', 'true');
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
      const res = await fetch(`/api/operaciones/renewals?${buildParams(p)}`);
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
      const res = await fetch('/api/operaciones/renewals?view=masters');
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
      const res = await fetch('/api/operaciones/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setToast({ message: successMsg, type: 'success' });
      refresh();
    } catch (err: any) {
      setToast({ message: `Error: ${err.message}`, type: 'error' });
    }
    setModalSaving(false);
  };

  const handleStatusChange = (status: OpsCaseStatus) => {
    if (!selectedCase) return;
    if (status === 'aplazado') {
      const until = prompt('Aplazar hasta (YYYY-MM-DD):');
      if (!until) return;
      apiAction({ action: 'update_status', id: selectedCase.id, status, aplazado_until: until }, 'Estado actualizado a Aplazado');
      return;
    }
    apiAction({ action: 'update_status', id: selectedCase.id, status }, `Estado actualizado a ${status}`);
  };

  const handleConfirmRenewal = (data: RenewalConfirmData) => {
    if (!selectedCase) return;
    apiAction(
      { action: 'confirm_renewal', id: selectedCase.id, policy_id: selectedCase.policy_id, new_start_date: data.new_start_date, new_end_date: data.new_end_date },
      'Renovación confirmada exitosamente'
    ).then(() => {
      setShowRenewalModal(false);
      // Create pending payment + recurrence in ADM COT (fire-and-forget)
      if (data.payment && selectedCase) {
        createPaymentOnEmission({
          insurer: selectedCase.insurer_name || '',
          policyNumber: selectedCase.policy_number || '',
          insuredName: selectedCase.client_name || '',
          cedula: selectedCase.cedula || undefined,
          totalPremium: data.payment.totalPremium,
          installments: data.payment.installments,
          ramo: selectedCase.ramo || 'AUTO',
        });
      }
    });
  };

  const handleCancel = (reason: string) => {
    if (!selectedCase) return;
    apiAction(
      { action: 'cancel', id: selectedCase.id, policy_id: selectedCase.policy_id, cancellation_reason: reason },
      'Cancelación confirmada'
    ).then(() => setShowCancelModal(false));
  };

  const handleReassign = (masterId: string) => {
    if (!selectedCase) return;
    apiAction({ action: 'reassign', case_id: selectedCase.id, master_id: masterId }, 'Caso reasignado');
  };

  const handleSendEmail = async (body: string, template: string, attachments?: File[]) => {
    if (!selectedCase) return;
    const c = selectedCase;
    const subject = `[${c.ticket}] Renovación póliza ${c.policy_number || ''} — ${c.insurer_name || ''}`;
    const assignedMaster = masters.find((m) => m.id === c.assigned_master_id);

    // 1. Record outbound message + send via Zepto (with attachments if any)
    try {
      if (attachments && attachments.length > 0) {
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
      console.error('[RenovacionesInbox] record_outbound failed:', err);
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
      console.error('[RenovacionesInbox] log email_sent failed:', err);
    }

    // 3. If status is pendiente, auto-transition to en_revision (first response)
    if (c.status === 'pendiente') {
      await apiAction(
        { action: 'update_status', id: c.id, status: 'en_revision' },
        'Correo enviado — caso pasó a En Revisión'
      );
    } else {
      setToast({ message: 'Correo enviado', type: 'success' });
      refresh();
    }
  };

  const handleSendPaymentLink = async (paymentLinkUrl: string) => {
    if (!selectedCase || !selectedCase.client_email) {
      setToast({ message: 'No hay email del cliente para enviar', type: 'error' });
      return;
    }
    try {
      const res = await fetch('/api/operaciones/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_payment_link',
          to_email: selectedCase.client_email,
          client_name: selectedCase.client_name || 'Cliente',
          policy_number: selectedCase.policy_number,
          insurer_name: selectedCase.insurer_name,
          ticket: selectedCase.ticket,
          case_type: 'renovacion',
          payment_link: paymentLinkUrl,
          case_id: selectedCase.id,
          user_id: null,
        }),
      });
      const json = await res.json();
      if (json.email_sent) {
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
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-160px)] gap-3">
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
          <RenCaseList
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
          <RenCaseDetail
            caseData={selectedCase}
            loading={detailLoading}
            onBack={() => setSelectedId(null)}
            onRefresh={refresh}
            onStatusChange={handleStatusChange}
            onConfirmRenewal={() => setShowRenewalModal(true)}
            onCancel={() => setShowCancelModal(true)}
            onReassign={handleReassign}
            onShowHistory={() => setShowHistory(true)}
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
          <ConfirmRenewalModal
            caseData={selectedCase}
            open={showRenewalModal}
            onClose={() => setShowRenewalModal(false)}
            onConfirm={handleConfirmRenewal}
            saving={modalSaving}
          />
          <CancelModal
            caseData={selectedCase}
            open={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            onConfirm={handleCancel}
            saving={modalSaving}
          />
        </>
      )}

      {/* ── History Drawer ── */}
      <RenHistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        caseId={selectedId}
      />

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
