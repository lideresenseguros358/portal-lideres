'use client';

import { useState } from 'react';
import { FaTimes, FaClock, FaCalendarAlt } from 'react-icons/fa';
import { toast } from 'sonner';

interface AplazadoModalProps {
  caseId: string;
  currentStatus: string;
  onClose: () => void;
  onConfirm: (caseId: string, months: number, reason: string) => Promise<void>;
}

export default function AplazadoModal({ caseId, currentStatus, onClose, onConfirm }: AplazadoModalProps) {
  const [months, setMonths] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.warning('Debes proporcionar un motivo de aplazamiento');
      return;
    }

    if (months < 1 || months > 6) {
      toast.error('Selecciona entre 1 y 6 meses');
      return;
    }

    try {
      setLoading(true);
      await onConfirm(caseId, months, reason);
      toast.success(`Caso aplazado por ${months} mes(es)`);
      onClose();
    } catch (error) {
      console.error('Error al aplazar caso:', error);
      toast.error('Error al aplazar el caso');
    } finally {
      setLoading(false);
    }
  };

  const calculateNotifyDate = () => {
    const notifyDate = new Date();
    notifyDate.setMonth(notifyDate.getMonth() + months);
    notifyDate.setDate(notifyDate.getDate() - 7); // Notificar 7 días antes
    return notifyDate.toLocaleDateString('es-PA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const calculateResumeDate = () => {
    const resumeDate = new Date();
    resumeDate.setMonth(resumeDate.getMonth() + months);
    return resumeDate.toLocaleDateString('es-PA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-4 sm:my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FaClock className="text-2xl" />
            <h3 className="text-lg font-bold">Aplazar Caso</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Info */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800">
                <strong>Aplazamiento temporal:</strong> El caso se marcará como cerrado temporalmente y se reactivará automáticamente en la fecha seleccionada.
              </p>
            </div>

            {/* Selector de meses */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Aplazar por: <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                      months === m
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {m} {m === 1 ? 'mes' : 'meses'}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas calculadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FaCalendarAlt className="text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Notificación</span>
                </div>
                <p className="text-sm text-gray-600">
                  Se te notificará 7 días antes:
                </p>
                <p className="text-base font-bold text-[#010139] mt-1">
                  {calculateNotifyDate()}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FaCalendarAlt className="text-green-600" />
                  <span className="text-sm font-semibold text-gray-700">Reanudación</span>
                </div>
                <p className="text-sm text-gray-600">
                  El caso se reactivará el:
                </p>
                <p className="text-base font-bold text-[#010139] mt-1">
                  {calculateResumeDate()}
                </p>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo del aplazamiento: <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Cliente solicitó espera por trámites internos..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none resize-none"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {reason.length}/500 caracteres
              </p>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-800">
                <strong>Importante:</strong> Durante el aplazamiento, el caso no aparecerá en la lista principal hasta su fecha de reanudación. Podrás verlo en el filtro "Casos aplazados".
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Aplazando...
              </>
            ) : (
              <>
                <FaClock className="text-white" />
                Confirmar Aplazamiento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
