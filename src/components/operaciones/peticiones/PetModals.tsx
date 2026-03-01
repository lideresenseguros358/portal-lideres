'use client';

import { useState, useEffect } from 'react';
import {
  FaTimes,
  FaTimesCircle,
  FaExclamationTriangle,
  FaRocket,
  FaCheckCircle,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaIdCard,
} from 'react-icons/fa';
import type { OpsCase } from '@/types/operaciones.types';
import { RAMO_LABELS } from './pet-helpers';

// ════════════════════════════════════════════
// LOST REASON MODAL
// ════════════════════════════════════════════

interface LostProps {
  caseData: OpsCase;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  saving: boolean;
}

export function LostReasonModal({ caseData, open, onClose, onConfirm, saving }: LostProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setConfirmed(false); }
  }, [open]);

  if (!open) return null;

  const c = caseData;
  const canConfirm = reason.trim().length >= 5 && confirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTimesCircle className="text-white" />
            <h3 className="text-sm font-bold">Marcar como Perdido</h3>
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
              <p className="text-xs font-bold text-red-800">Caso perdido</p>
              <p className="text-[10px] text-red-700">Esta petición se cerrará como perdida y se registrará el motivo.</p>
            </div>
          </div>

          {/* Case summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{c.client_name}</p>
            <p className="text-[10px] text-gray-500">Ticket: {c.ticket} · Ramo: {RAMO_LABELS[(c.ramo || '').toLowerCase()] || c.ramo || '—'}</p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo (mín. 5 caracteres)..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-300 resize-none"
            />
            {reason.length > 0 && reason.length < 5 && (
              <p className="text-[10px] text-red-500 mt-1">Mínimo 5 caracteres ({reason.length}/5)</p>
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
              Confirmo que deseo marcar esta petición como perdida. Se registrará en la bitácora.
            </span>
          </label>
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
            <FaTimesCircle className="text-white" /> {saving ? 'Procesando...' : 'Confirmar Perdido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// CONVERT TO EMISSION MODAL
// ════════════════════════════════════════════

interface ConvertProps {
  caseData: OpsCase;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}

export function ConvertToEmissionModal({ caseData, open, onClose, onConfirm, saving }: ConvertProps) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  if (!open) return null;

  const c = caseData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#010139] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaRocket className="text-white" />
            <h3 className="text-sm font-bold">Convertir a Emisión</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Case summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-[#010139]">{c.client_name}</p>
            <p className="text-[10px] text-gray-500">Ticket: {c.ticket}</p>
            <p className="text-[10px] text-gray-500">Ramo: {RAMO_LABELS[(c.ramo || '').toLowerCase()] || c.ramo || '—'}</p>
          </div>

          {/* Client data preview */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Datos del cliente</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <FaUser className="text-[9px] text-gray-400" />
                {c.client_name || '—'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <FaEnvelope className="text-[9px] text-gray-400" />
                {c.client_email || '—'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <FaPhone className="text-[9px] text-gray-400" />
                {c.client_phone || '—'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <FaIdCard className="text-[9px] text-gray-400" />
                {c.cedula || '—'}
              </div>
            </div>
          </div>

          {/* What will happen */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-[10px]">
            <p className="font-bold text-green-800 mb-1">Se aplicará:</p>
            <ul className="space-y-0.5 text-green-700">
              <li>✅ Petición se cerrará como "cerrado"</li>
              <li>✅ Se abrirá el wizard de nuevo cliente / emisión</li>
              <li>✅ Corredor asignado: portal@lideresenseguros.com</li>
              <li>✅ Se registrará conversión en bitácora y métricas</li>
            </ul>
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[11px] text-gray-700">
              Confirmo que deseo convertir esta petición a emisión. Se cerrarán las gestiones de este caso.
            </span>
          </label>
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
            onClick={() => confirmed && onConfirm()}
            disabled={!confirmed || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#010139] rounded-lg hover:bg-[#020270] cursor-pointer disabled:opacity-40 transition-colors"
          >
            <FaRocket className="text-white" /> {saving ? 'Procesando...' : 'Convertir a Emisión'}
          </button>
        </div>
      </div>
    </div>
  );
}
