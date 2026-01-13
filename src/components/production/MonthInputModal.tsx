'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaDollarSign, FaFileInvoice, FaPercentage } from 'react-icons/fa';

interface MonthInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bruto: number, numPolizas: number, persistencia: number | null) => Promise<void>;
  brokerName: string;
  monthName: string;
  initialBruto?: number;
  initialNumPolizas?: number;
  initialPersistencia?: number | null;
}

export default function MonthInputModal({
  isOpen,
  onClose,
  onSave,
  brokerName,
  monthName,
  initialBruto = 0,
  initialNumPolizas = 0,
  initialPersistencia = null,
}: MonthInputModalProps) {
  const [bruto, setBruto] = useState(initialBruto);
  const [numPolizas, setNumPolizas] = useState(initialNumPolizas);
  const [persistencia, setPersistencia] = useState<number | null>(initialPersistencia);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBruto(initialBruto);
      setNumPolizas(initialNumPolizas);
      setPersistencia(initialPersistencia);
      setError('');
    }
  }, [isOpen, initialBruto, initialNumPolizas, initialPersistencia]);

  const handleSave = async () => {
    // Validar que persistencia esté entre 0 y 100 si está definida
    if (persistencia !== null && (persistencia < 0 || persistencia > 100)) {
      setError('La persistencia debe estar entre 0% y 100%');
      return;
    }
    
    setError('');
    setSaving(true);
    try {
      await onSave(bruto, numPolizas, persistencia);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      setError('Error al guardar. Intenta nuevamente.');
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
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaDollarSign className="inline mr-2" />
              Ingresar Cifras del Mes
            </h2>
            <p className="standard-modal-subtitle">
              {brokerName} - {monthName}
            </p>
          </div>
          <button onClick={onClose} className="standard-modal-close" disabled={saving} type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <div className="space-y-6">
          {/* Campo: Cifra Bruta */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              <FaDollarSign className="inline mr-2 text-[#8AAA19]" />
              Cifra Bruta del Mes (USD)
            </label>
            <input
              type="number"
              value={bruto === 0 ? '' : bruto}
              onChange={(e) => setBruto(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              min="0"
              step="0.01"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono text-lg"
              placeholder="0.00"
              autoFocus
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresa el monto total vendido en este mes
            </p>
          </div>

          {/* Campo: Número de Pólizas */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              <FaFileInvoice className="inline mr-2 text-[#010139]" />
              Número de Pólizas Vendidas
            </label>
            <input
              type="number"
              value={numPolizas === 0 ? '' : numPolizas}
              onChange={(e) => setNumPolizas(e.target.value === '' ? 0 : parseInt(e.target.value))}
              min="0"
              step="1"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono text-lg"
              placeholder="0"
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Cantidad de pólizas vendidas en este mes
            </p>
          </div>

          {/* Campo: Persistencia */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              <FaPercentage className="inline mr-2 text-blue-600" />
              Persistencia (%)
            </label>
            <input
              type="number"
              value={persistencia === null ? '' : persistencia}
              onChange={(e) => {
                const value = e.target.value === '' ? null : parseFloat(e.target.value);
                setPersistencia(value);
                if (value !== null && (value < 0 || value > 100)) {
                  setError('La persistencia debe estar entre 0% y 100%');
                } else {
                  setError('');
                }
              }}
              min="0"
              max="100"
              step="0.01"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none font-mono text-lg ${
                error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
              }`}
              placeholder="Ej: 85.5"
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Porcentaje de retención de clientes/pólizas (0-100)
            </p>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600 font-semibold">
                ⚠️ {error}
              </p>
            </div>
          )}

          {/* Resumen */}
          {(bruto > 0 || numPolizas > 0 || persistencia !== null) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">
                📊 Resumen del Mes:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Cifra Bruta:</span>
                  <span className="font-mono font-bold text-gray-900">${bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-gray-700">Pólizas:</span>
                  <span className="font-mono font-bold text-gray-900">{numPolizas}</span>
                </div>
                {numPolizas > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs">Promedio/póliza:</span>
                    <span className="font-mono text-gray-700 text-xs">${(bruto / numPolizas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {persistencia !== null && (
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-200">
                    <span className="text-blue-700 font-semibold">Persistencia:</span>
                    <span className={`font-mono font-bold text-lg ${
                      persistencia < 80 ? 'text-red-600' :
                      persistencia < 85 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>{persistencia.toFixed(2)}%</span>
                  </div>
                )}
              </div>
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
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
