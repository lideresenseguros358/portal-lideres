'use client';

import { useState, useEffect } from 'react';
import {
  FaTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaExclamationTriangle,
} from 'react-icons/fa';
import type { OpsCase } from '@/types/operaciones.types';
import { fmtDate, addOneYear } from './ren-helpers';

// ════════════════════════════════════════════
// CONFIRM RENEWAL MODAL
// ════════════════════════════════════════════

interface ConfirmRenewalProps {
  caseData: OpsCase;
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { new_start_date: string; new_end_date: string }) => void;
  saving: boolean;
}

export function ConfirmRenewalModal({ caseData, open, onClose, onConfirm, saving }: ConfirmRenewalProps) {
  const c = caseData;
  const defaultStart = c.renewal_date || new Date().toISOString().slice(0, 10);
  const defaultEnd = addOneYear(defaultStart);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  useEffect(() => {
    if (open) {
      const s = c.renewal_date || new Date().toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(addOneYear(s));
    }
  }, [open, c.renewal_date]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({ new_start_date: startDate, new_end_date: endDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaCheckCircle className="text-white" />
            <h3 className="text-sm font-bold">Confirmar Renovación</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Case summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{c.client_name}</p>
            <p className="text-[10px] text-gray-500">Póliza: {c.policy_number || '—'} · {c.insurer_name || ''}</p>
            <p className="text-[10px] text-gray-500">Ticket: {c.ticket}</p>
          </div>

          {/* Current dates */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-amber-700 mb-1">Vigencia Actual</p>
            <p className="text-xs text-amber-800">Vence: {fmtDate(c.renewal_date)}</p>
          </div>

          {/* New dates */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <FaCalendarAlt className="text-[8px]" /> Nuevas Fechas de Vigencia
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(addOneYear(e.target.value));
                  }}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-green-300"
                />
              </div>
            </div>
          </div>

          {/* Diff preview */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-[10px]">
            <p className="font-bold text-green-800 mb-1">Cambios a aplicar:</p>
            <ul className="space-y-0.5 text-green-700">
              <li>✅ Estado → Cerrado Renovado</li>
              <li>✅ Nueva vigencia: {fmtDate(startDate)} → {fmtDate(endDate)}</li>
              {c.policy_id && <li>✅ Póliza se actualizará a "vigente"</li>}
              <li>✅ Se registrará en bitácora</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <FaCheckCircle className="text-white" /> {saving ? 'Guardando...' : 'Confirmar Renovación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// CANCEL MODAL
// ════════════════════════════════════════════

interface CancelProps {
  caseData: OpsCase;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  saving: boolean;
}

export function CancelModal({ caseData, open, onClose, onConfirm, saving }: CancelProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setConfirmed(false); }
  }, [open]);

  if (!open) return null;

  const c = caseData;
  const canConfirm = reason.trim().length >= 10 && confirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTimesCircle className="text-white" />
            <h3 className="text-sm font-bold">Cancelar Póliza</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
            <div>
              <p className="text-xs font-bold text-red-800">Acción irreversible</p>
              <p className="text-[10px] text-red-700">Esta acción marcará el caso como cancelado y la póliza como inactiva.</p>
            </div>
          </div>

          {/* Case summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{c.client_name}</p>
            <p className="text-[10px] text-gray-500">Póliza: {c.policy_number || '—'} · {c.insurer_name || ''}</p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">
              Motivo de cancelación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de cancelación (mín. 10 caracteres)..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-300 resize-none"
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-[10px] text-red-500 mt-1">Mínimo 10 caracteres ({reason.length}/10)</p>
            )}
          </div>

          {/* Double confirm */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[11px] text-gray-700">
              Confirmo que deseo cancelar esta póliza. Entiendo que esta acción es irreversible y se registrará en la bitácora.
            </span>
          </label>

          {/* What will happen */}
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-[10px]">
            <p className="font-bold text-red-800 mb-1">Se aplicará:</p>
            <ul className="space-y-0.5 text-red-700">
              <li>❌ Estado → Cerrado Cancelado</li>
              {c.policy_id && <li>❌ Póliza se marcará como "inactivo"</li>}
              <li>❌ Se registrará motivo y usuario en bitácora</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors"
          >
            Volver
          </button>
          <button
            onClick={() => canConfirm && onConfirm(reason.trim())}
            disabled={!canConfirm || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <FaTimesCircle className="text-white" /> {saving ? 'Procesando...' : 'Confirmar Cancelación'}
          </button>
        </div>
      </div>
    </div>
  );
}
