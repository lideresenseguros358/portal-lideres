'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaBullseye } from 'react-icons/fa';

interface MetaPersonalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (meta: number) => Promise<void>;
  brokerName: string;
  currentMeta: number;
}

export default function MetaPersonalModal({
  isOpen,
  onClose,
  onSave,
  brokerName,
  currentMeta,
}: MetaPersonalModalProps) {
  const [meta, setMeta] = useState(currentMeta);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMeta(currentMeta);
    }
  }, [isOpen, currentMeta]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(meta);
      onClose();
    } catch (error) {
      console.error('Error saving meta:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">
              <FaBullseye className="inline mr-2" />
              Meta Personal Anual
            </h2>
            <p className="text-white/90 text-sm mt-1">{brokerName}</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition" disabled={saving} type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              Meta Anual (USD)
            </label>
            <input
              type="number"
              value={meta === 0 ? '' : meta}
              onChange={(e) => setMeta(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              min="0"
              step="1000"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono text-xl text-center"
              placeholder="0.00"
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Esta es la meta anual personal del corredor (independiente de concursos)
            </p>
          </div>

          {meta > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                🎯 Meta Establecida:
              </p>
              <p className="text-2xl font-bold text-blue-900 font-mono text-center">
                ${meta.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600 mt-2 text-center">
                Promedio mensual requerido: ${(meta / 12).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="standard-modal-button-primary"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <FaSave />
                  <span>Guardar Meta</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
