'use client';

import { useEffect, useState } from 'react';
import {
  FaTimes,
  FaHistory,
  FaSync,
  FaArrowRight,
  FaUser,
} from 'react-icons/fa';
import type { OpsCaseHistory } from '@/types/operaciones.types';
import { STATUS_LABELS } from '@/types/operaciones.types';
import { fmtDateTime } from './urg-helpers';

// ════════════════════════════════════════════
// HISTORY DRAWER (Urgencias)
// ════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string | null;
}

export default function UrgHistoryDrawer({ open, onClose, caseId }: Props) {
  const [entries, setEntries] = useState<OpsCaseHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !caseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/operaciones/urgencies?view=history&case_id=${caseId}`);
        const json = await res.json();
        if (!cancelled) setEntries(json.data || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, caseId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full animate-in slide-in-from-right">
        {/* Header */}
        <div className="bg-[#010139] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FaHistory className="text-white" />
            <h3 className="text-sm font-bold">Bitácora del Caso</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FaSync className="text-xl text-gray-300 animate-spin mb-3" />
              <p className="text-xs text-gray-400">Cargando historial...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FaHistory className="text-3xl text-gray-300 mb-3" />
              <p className="text-xs text-gray-500">Sin historial aún</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {entries.map((entry) => {
                  const before = (entry.before_state || {}) as Record<string, any>;
                  const after = (entry.after_state || {}) as Record<string, any>;
                  return (
                    <div key={entry.id} className="relative pl-8">
                      {/* Dot */}
                      <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-[#010139]" />

                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-1">
                        {/* Action title */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800 capitalize">
                            {entry.change_type?.replace(/_/g, ' ') || 'Cambio'}
                          </span>
                          <span className="text-[10px] text-gray-400">{fmtDateTime(entry.created_at)}</span>
                        </div>

                        {/* Status change */}
                        {before.status && after.status && before.status !== after.status && (
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-500">{STATUS_LABELS[before.status as keyof typeof STATUS_LABELS] || before.status}</span>
                            <FaArrowRight className="text-[8px] text-gray-400" />
                            <span className="font-bold text-[#010139]">{STATUS_LABELS[after.status as keyof typeof STATUS_LABELS] || after.status}</span>
                          </div>
                        )}

                        {/* User */}
                        {entry.changed_by && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <FaUser className="text-[8px]" />
                            <span>{entry.changed_by}</span>
                          </div>
                        )}

                        {/* Before/After snapshot */}
                        {Object.keys(after).length > 0 && (
                          <div className="mt-1 p-2 bg-white rounded border border-gray-100">
                            <p className="text-[9px] font-bold text-gray-500 mb-0.5">Cambios:</p>
                            <div className="text-[10px] text-gray-600 space-y-0.5">
                              {Object.entries(after).map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-gray-400">{k}:</span>{' '}
                                  {before[k] !== undefined && before[k] !== v && (
                                    <><span className="line-through text-red-400">{String(before[k])}</span> → </>
                                  )}
                                  <span className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
