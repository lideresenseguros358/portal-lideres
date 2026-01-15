'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionIncludeTransferInCurrentFortnight } from '@/app/(app)/commissions/banco-actions';

interface IncludeTransferModalProps {
  transfer: any;
  currentCutoffId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IncludeTransferModal({ transfer, currentCutoffId, onClose, onSuccess }: IncludeTransferModalProps) {
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    transferType: transfer.transfer_type || 'PENDIENTE',
    insurerId: transfer.insurer_assigned_id || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInsurers();
  }, []);

  const loadInsurers = async () => {
    try {
      const response = await fetch('/api/insurers');
      if (response.ok) {
        const data = await response.json();
        // El endpoint retorna { success, insurers }
        const insurersList = data.insurers || [];
        // Filtrar por is_active (booleano), no status
        setInsurers(insurersList.filter((i: any) => i.is_active === true));
      }
    } catch (error) {
      console.error('Error cargando aseguradoras:', error);
      toast.error('Error al cargar aseguradoras');
    }
  };

  const handleInclude = async () => {
    if (!formData.transferType) {
      toast.error('Selecciona un tipo de transferencia');
      return;
    }

    if (!formData.insurerId) {
      toast.error('Selecciona una aseguradora');
      return;
    }

    setLoading(true);

    try {
      const result = await actionIncludeTransferInCurrentFortnight(
        transfer.id,
        currentCutoffId,
        formData.transferType as any,
        formData.insurerId
      );

      if (result.ok) {
        toast.success('Transferencia incluida exitosamente', {
          description: 'Se agregó al grupo "Transferencias de otras quincenas"'
        });
        onSuccess();
      } else {
        toast.error('Error al incluir transferencia', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <FaCheckCircle size={24} />
            <div>
              <h2 className="text-xl font-bold">Incluir Transferencia en Quincena Actual</h2>
              <p className="text-sm text-gray-200 mt-1">Confirma tipo y aseguradora para incluir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Información de la transferencia */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3">📋 Datos de la Transferencia</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-blue-700 font-semibold">Fecha:</p>
                <p className="text-blue-900">{new Date(transfer.date).toLocaleDateString('es-PA')}</p>
              </div>
              <div>
                <p className="text-blue-700 font-semibold">Referencia:</p>
                <p className="text-blue-900 font-mono">{transfer.reference_number}</p>
              </div>
              <div className="col-span-2">
                <p className="text-blue-700 font-semibold">Descripción:</p>
                <p className="text-blue-900">{transfer.description_raw}</p>
              </div>
              <div>
                <p className="text-blue-700 font-semibold">Monto:</p>
                <p className="text-blue-900 font-mono text-lg font-bold">${transfer.amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-blue-700 font-semibold">Corte Origen:</p>
                <p className="text-blue-900 text-xs">
                  {transfer.bank_cutoffs
                    ? `${new Date(transfer.bank_cutoffs.start_date).toLocaleDateString('es-PA')} - ${new Date(transfer.bank_cutoffs.end_date).toLocaleDateString('es-PA')}`
                    : 'Sin corte'}
                </p>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="space-y-4">
            {/* Tipo de Transferencia */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de Transferencia <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.transferType}
                onChange={(e) => setFormData({ ...formData, transferType: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="REPORTE">REPORTE</option>
                <option value="BONO">BONO</option>
                <option value="OTRO">OTRO</option>
                <option value="PENDIENTE">PENDIENTE</option>
              </select>
            </div>

            {/* Aseguradora */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Aseguradora <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.insurerId}
                onChange={(e) => setFormData({ ...formData, insurerId: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="">Seleccionar aseguradora...</option>
                {insurers.map(ins => (
                  <option key={ins.id} value={ins.id}>{ins.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info adicional */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Importante:</strong> Al incluir esta transferencia:
            </p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 ml-4 list-disc">
              <li>Se agregará al grupo "Transferencias de otras quincenas" en el corte actual</li>
              <li>En el corte original se moverá a "Pagados en otras quincenas"</li>
              <li>Se registrará la quincena de pago al cerrar la quincena actual</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl border-t-2 border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleInclude}
            disabled={loading || !formData.transferType || !formData.insurerId}
            className="px-6 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:from-[#010139] hover:to-[#020270] transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Incluyendo...' : 'Incluir en Quincena Actual'}
          </button>
        </div>
      </div>
    </div>
  );
}
