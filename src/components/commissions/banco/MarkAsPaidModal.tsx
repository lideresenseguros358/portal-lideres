'use client';

import { useState } from 'react';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';

interface MarkAsPaidModalProps {
  transferCount: number;
  totalAmount: number;
  onClose: () => void;
  onConfirm: (paymentDate: string, notes: string) => void;
}

export default function MarkAsPaidModal({ 
  transferCount, 
  totalAmount, 
  onClose, 
  onConfirm 
}: MarkAsPaidModalProps) {
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!paymentDate?.trim()) {
      alert('La fecha de pago es obligatoria');
      return;
    }
    onConfirm(paymentDate, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaCheckCircle className="text-[#8AAA19] flex-shrink-0" size={24} />
            <h3 className="text-lg font-bold">Marcar como Pagado</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-900">
              <strong>{transferCount}</strong> transferencia{transferCount !== 1 ? 's' : ''} será{transferCount !== 1 ? 'n' : ''} marcada{transferCount !== 1 ? 's' : ''} como <strong>PAGADA</strong>
            </p>
            <p className="text-lg font-bold text-blue-900 mt-2 font-mono">
              Total: ${totalAmount.toFixed(2)}
            </p>
          </div>

          {/* Fecha de Pago */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Fecha de Pago <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none"
              required
            />
            <p className="text-xs text-gray-500">
              Se agregará automáticamente a las notas internas
            </p>
          </div>

          {/* Notas Adicionales (Opcional) */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Notas Adicionales <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Transferencia realizada desde cuenta principal..."
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none resize-none"
              rows={3}
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
            <p className="text-xs text-amber-900">
              ⚠️ Las transferencias marcadas como <strong>PAGADO</strong> no podrán ser editadas ni eliminadas
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-semibold text-sm shadow-md"
          >
            <FaCheckCircle className="inline mr-2" />
            Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
