'use client';

import { useState, useEffect } from 'react';
import {
  FaTimes,
  FaEnvelope,
  FaPaperPlane,
  FaStickyNote,
  FaExclamationTriangle,
  FaEye,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import type { OpsMorosidadRow } from '@/types/operaciones.types';
import {
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  MERGE_VARS,
  mergePlaceholders,
  fmtCurrency,
} from './morosidad-helpers';

// ════════════════════════════════════════════
// BULK EMAIL MODAL
// ════════════════════════════════════════════

interface BulkEmailProps {
  open: boolean;
  onClose: () => void;
  selectedRows: OpsMorosidadRow[];
  onConfirm: (subject: string, bodyTemplate: string) => void;
  sending: boolean;
}

export function BulkEmailModal({ open, onClose, selectedRows, onConfirm, sending }: BulkEmailProps) {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(DEFAULT_SUBJECT);
      setBody(DEFAULT_BODY);
      setPreviewIdx(0);
      setShowPreview(false);
    }
  }, [open]);

  if (!open) return null;

  const withoutEmail = selectedRows.filter((r) => !r.client_email);
  const withEmail = selectedRows.filter((r) => r.client_email);
  const previewRow = withEmail[previewIdx] || selectedRows[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#010139] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FaEnvelope className="text-white" />
            <h3 className="text-sm font-bold">Envío Masivo de Morosidad</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-800 mb-1">Resumen de envío</p>
            <div className="flex gap-4 text-[11px]">
              <span className="text-blue-700">Total seleccionados: <strong>{selectedRows.length}</strong></span>
              <span className="text-green-700">Con correo: <strong>{withEmail.length}</strong></span>
              {withoutEmail.length > 0 && (
                <span className="text-red-600">Sin correo: <strong>{withoutEmail.length}</strong></span>
              )}
            </div>
          </div>

          {/* Warning for missing emails */}
          {withoutEmail.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <FaExclamationTriangle className="text-amber-500 mt-0.5 text-sm flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Clientes sin correo ({withoutEmail.length})</p>
                <p className="text-[10px] text-amber-700">
                  {withoutEmail.slice(0, 5).map((r) => r.client_name || r.policy_number).join(', ')}
                  {withoutEmail.length > 5 && ` y ${withoutEmail.length - 5} más`}
                </p>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/30"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Cuerpo del correo</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-[#010139]/30 resize-none font-mono"
            />
          </div>

          {/* Merge variables reference */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] font-bold text-gray-500 mb-1">Variables disponibles:</p>
            <div className="flex flex-wrap gap-1">
              {MERGE_VARS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBody((prev) => prev + v)}
                  className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-[#010139] cursor-pointer hover:bg-blue-50"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <FaEye className="text-gray-400 text-xs" />
                <span className="text-xs font-bold text-gray-700">Vista Previa</span>
              </div>
              {showPreview ? <FaChevronUp className="text-gray-400 text-[10px]" /> : <FaChevronDown className="text-gray-400 text-[10px]" />}
            </button>

            {showPreview && previewRow && (
              <div className="p-3 border-t border-gray-100 space-y-2">
                {/* Preview navigation */}
                {withEmail.length > 1 && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                      disabled={previewIdx === 0}
                      className="px-2 py-0.5 bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                    >
                      ← Ant
                    </button>
                    <span className="text-gray-500">{previewIdx + 1} / {withEmail.length}</span>
                    <button
                      onClick={() => setPreviewIdx((i) => Math.min(withEmail.length - 1, i + 1))}
                      disabled={previewIdx >= withEmail.length - 1}
                      className="px-2 py-0.5 bg-gray-100 rounded disabled:opacity-30 cursor-pointer"
                    >
                      Sig →
                    </button>
                    <span className="text-gray-400 ml-2">{previewRow.client_name} — {previewRow.client_email}</span>
                  </div>
                )}

                <div className="bg-gray-50 rounded p-2 text-[10px] text-gray-500 font-mono">
                  <strong>Asunto:</strong> {mergePlaceholders(subject, previewRow)}
                </div>
                <div className="bg-white border border-gray-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap">
                  {mergePlaceholders(body, previewRow)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <p className="text-[10px] text-gray-400">
            Se enviarán <strong>{withEmail.length}</strong> correos individuales vía Zepto
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(subject, body)}
              disabled={sending || withEmail.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#010139] rounded-lg hover:bg-[#020270] cursor-pointer disabled:opacity-40 transition-colors"
            >
              <FaPaperPlane className="text-[10px] text-white" />
              {sending ? 'Enviando...' : `Enviar ${withEmail.length} correos`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// NOTE MODAL
// ════════════════════════════════════════════

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  policyNumber: string;
  clientName: string;
  onConfirm: (note: string) => void;
  saving: boolean;
}

export function NoteModal({ open, onClose, policyNumber, clientName, onConfirm, saving }: NoteModalProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-amber-500 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaStickyNote className="text-white" />
            <h3 className="text-sm font-bold">Agregar Nota</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer">
            <FaTimes className="text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-gray-800">{clientName}</p>
            <p className="text-[10px] text-gray-500">Póliza: {policyNumber}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Nota (mín. 10 caracteres)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe la observación sobre morosidad..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-300 resize-none"
            />
            {note.length > 0 && note.trim().length < 10 && (
              <p className="text-[10px] text-red-500 mt-1">Mínimo 10 caracteres ({note.trim().length}/10)</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => note.trim().length >= 10 && onConfirm(note.trim())}
            disabled={note.trim().length < 10 || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <FaStickyNote className="text-white text-[10px]" /> {saving ? 'Guardando...' : 'Guardar Nota'}
          </button>
        </div>
      </div>
    </div>
  );
}
