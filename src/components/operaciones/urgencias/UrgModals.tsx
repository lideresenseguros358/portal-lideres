'use client';

import { useState, useEffect } from 'react';
import {
  FaTimes,
  FaTimesCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBrain,
  FaStickyNote,
} from 'react-icons/fa';
import type { OpsCase } from '@/types/operaciones.types';

// ════════════════════════════════════════════
// NOTE REQUIRED MODAL (for closing / SLA breach)
// ════════════════════════════════════════════

interface NoteRequiredProps {
  caseData: OpsCase;
  open: boolean;
  targetStatus: string;
  onClose: () => void;
  onConfirm: (note: string) => void;
  saving: boolean;
}

export function NoteRequiredModal({ caseData, open, targetStatus, onClose, onConfirm, saving }: NoteRequiredProps) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) { setNote(''); setConfirmed(false); }
  }, [open]);

  if (!open) return null;

  const c = caseData;
  const isCerrar = targetStatus === 'cerrado';
  const canConfirm = note.trim().length >= 10 && (isCerrar ? confirmed : true);

  const headerBg = isCerrar ? 'bg-gray-700' : 'bg-green-600';
  const HeaderIcon = isCerrar ? FaTimesCircle : FaCheckCircle;
  const title = isCerrar ? 'Cerrar Urgencia' : 'Marcar como Resuelto';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`${headerBg} text-white px-5 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <HeaderIcon className="text-white" />
            <h3 className="text-sm font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Case summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{c.client_name || 'Sin nombre'}</p>
            <p className="text-[10px] text-gray-500">Ticket: {c.ticket} · Categoría: {c.category || 'N/A'}</p>
          </div>

          {/* Warning for SLA */}
          {c.sla_breached && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
              <div>
                <p className="text-xs font-bold text-red-800">SLA Vencido</p>
                <p className="text-[10px] text-red-700">Nota obligatoria requerida porque el SLA fue excedido.</p>
              </div>
            </div>
          )}

          {/* Note input */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1 flex items-center gap-1">
              <FaStickyNote className="text-[8px]" />
              Nota obligatoria <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isCerrar
                ? 'Describe el motivo de cierre y resolución final (mín. 10 caracteres)...'
                : 'Describe cómo se resolvió la urgencia (mín. 10 caracteres)...'
              }
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/30 resize-none"
            />
            {note.length > 0 && note.trim().length < 10 && (
              <p className="text-[10px] text-red-500 mt-1">Mínimo 10 caracteres ({note.trim().length}/10)</p>
            )}
          </div>

          {/* Double confirm for cerrar */}
          {isCerrar && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-[11px] text-gray-700">
                Confirmo que deseo cerrar esta urgencia. Esta acción se registrará en la bitácora.
              </span>
            </label>
          )}

          {/* What will happen */}
          <div className={`${isCerrar ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-100'} border rounded-lg p-3 text-[10px]`}>
            <p className={`font-bold ${isCerrar ? 'text-gray-700' : 'text-green-800'} mb-1`}>Se aplicará:</p>
            <ul className={`space-y-0.5 ${isCerrar ? 'text-gray-600' : 'text-green-700'}`}>
              <li>{isCerrar ? '🔒' : '✅'} Estado → {isCerrar ? 'Cerrado' : 'Resuelto'}</li>
              <li>📝 Nota guardada en bitácora</li>
              <li>🤖 Evaluación IA se disparará automáticamente</li>
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
            onClick={() => canConfirm && onConfirm(note.trim())}
            disabled={!canConfirm || saving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg cursor-pointer disabled:opacity-40 transition-colors ${
              isCerrar ? 'bg-gray-700 hover:bg-gray-800' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <HeaderIcon className="text-white" /> {saving ? 'Procesando...' : title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// RE-EVALUATE AI CONFIRMATION MODAL
// ════════════════════════════════════════════

interface ReEvalProps {
  caseData: OpsCase;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}

export function ReEvalModal({ caseData, open, onClose, onConfirm, saving }: ReEvalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaBrain className="text-white" />
            <h3 className="text-sm font-bold">Re-evaluar con IA</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{caseData.client_name || 'Sin nombre'}</p>
            <p className="text-[10px] text-gray-500">Ticket: {caseData.ticket}</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[10px]">
            <p className="font-bold text-blue-700 mb-1">¿Qué hace la re-evaluación?</p>
            <ul className="space-y-0.5 text-blue-600">
              <li>🤖 Ejecuta una nueva evaluación de efectividad con IA</li>
              <li>📊 Actualiza el score, sentimiento y recomendaciones</li>
              <li>📝 Se registra en bitácora como evaluación manual</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#010139] rounded-lg hover:bg-[#020270] cursor-pointer disabled:opacity-40 transition-colors"
          >
            <FaBrain className="text-white" /> {saving ? 'Evaluando...' : 'Re-evaluar'}
          </button>
        </div>
      </div>
    </div>
  );
}
