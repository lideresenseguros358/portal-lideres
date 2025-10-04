'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaDollarSign, FaFileInvoice } from 'react-icons/fa';

interface MonthInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bruto: number, numPolizas: number, canceladas: number) => Promise<void>;
  brokerName: string;
  monthName: string;
  initialBruto?: number;
  initialNumPolizas?: number;
  initialCanceladas?: number;
}

export default function MonthInputModal({
  isOpen,
  onClose,
  onSave,
  brokerName,
  monthName,
  initialBruto = 0,
  initialNumPolizas = 0,
  initialCanceladas = 0,
}: MonthInputModalProps) {
  const [bruto, setBruto] = useState(initialBruto);
  const [numPolizas, setNumPolizas] = useState(initialNumPolizas);
  const [canceladas, setCanceladas] = useState(initialCanceladas);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBruto(initialBruto);
      setNumPolizas(initialNumPolizas);
      setCanceladas(initialCanceladas);
      setError('');
    }
  }, [isOpen, initialBruto, initialNumPolizas, initialCanceladas]);

  const handleSave = async () => {
    // Validar que canceladas no sea mayor que bruto
    if (canceladas > bruto) {
      setError('Las canceladas no pueden ser mayores que la cifra bruta');
      return;
    }
    
    setError('');
    setSaving(true);
    try {
      await onSave(bruto, numPolizas, canceladas);
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

          {/* Campo: Canceladas */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              <FaDollarSign className="inline mr-2 text-red-600" />
              Canceladas del Mes (USD)
            </label>
            <input
              type="number"
              value={canceladas}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setCanceladas(value);
                if (value > bruto) {
                  setError('Las canceladas no pueden ser mayores que la cifra bruta');
                } else {
                  setError('');
                }
              }}
              min="0"
              step="0.01"
              max={bruto}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none font-mono text-lg ${
                error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
              }`}
              placeholder="0.00"
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Monto de pólizas canceladas en este mes
            </p>
            {error && (
              <p className="text-xs text-red-600 mt-1 font-semibold">
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* Resumen */}
          {(bruto > 0 || numPolizas > 0 || canceladas > 0) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">
                📊 Resumen del Mes:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Cifra Bruta:</span>
                  <span className="font-mono font-bold text-gray-900">${bruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-700">Canceladas:</span>
                  <span className="font-mono font-bold text-red-600">-${canceladas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-gray-300 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8AAA19] font-semibold">Neto:</span>
                  <span className="font-mono font-bold text-[#8AAA19] text-lg">${(bruto - canceladas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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
