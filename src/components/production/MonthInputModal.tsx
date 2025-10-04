'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaDollarSign, FaFileInvoice } from 'react-icons/fa';

interface MonthInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bruto: number, numPolizas: number) => Promise<void>;
  brokerName: string;
  monthName: string;
  initialBruto?: number;
  initialNumPolizas?: number;
}

export default function MonthInputModal({
  isOpen,
  onClose,
  onSave,
  brokerName,
  monthName,
  initialBruto = 0,
  initialNumPolizas = 0,
}: MonthInputModalProps) {
  const [bruto, setBruto] = useState(initialBruto);
  const [numPolizas, setNumPolizas] = useState(initialNumPolizas);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBruto(initialBruto);
      setNumPolizas(initialNumPolizas);
    }
  }, [isOpen, initialBruto, initialNumPolizas]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(bruto, numPolizas);
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020252] text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Ingresar Cifras del Mes</h3>
              <p className="text-sm text-gray-300 mt-1">
                {brokerName} - {monthName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
              disabled={saving}
            >
              <FaTimes className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Campo: Cifra Bruta */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              <FaDollarSign className="inline mr-2 text-[#8AAA19]" />
              Cifra Bruta del Mes (USD)
            </label>
            <input
              type="number"
              value={bruto}
              onChange={(e) => setBruto(parseFloat(e.target.value) || 0)}
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
              value={numPolizas}
              onChange={(e) => setNumPolizas(parseInt(e.target.value) || 0)}
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

          {/* Resumen */}
          {(bruto > 0 || numPolizas > 0) && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                📊 Resumen:
              </p>
              <div className="space-y-1 text-sm text-green-700">
                <p>
                  • Cifra Bruta: <span className="font-mono font-bold">${bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </p>
                <p>
                  • Pólizas: <span className="font-mono font-bold">{numPolizas}</span>
                </p>
                {numPolizas > 0 && (
                  <p>
                    • Promedio por póliza: <span className="font-mono font-bold">${(bruto / numPolizas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
  );
}
