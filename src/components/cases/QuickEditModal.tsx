'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaEdit, FaUpload, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { CASE_STATUSES } from '@/lib/constants/cases';
import { actionUpdateCase, actionGetCase } from '@/app/(app)/cases/actions';

interface QuickEditModalProps {
  caseId: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenFullWizard?: (caseData: any) => void;
}

export default function QuickEditModal({ 
  caseId, 
  onClose, 
  onSuccess,
  onOpenFullWizard 
}: QuickEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    notes: '',
    status: '',
    postponed_until: '',
  });

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const loadCaseData = async () => {
    setLoading(true);
    const result = await actionGetCase(caseId);
    
    if (result.ok && result.data) {
      setCaseData(result.data);
      setFormData({
        notes: result.data.notes || '',
        status: result.data.status || '',
        postponed_until: result.data.postponed_until || '',
      });
    } else {
      toast.error('Error al cargar datos del caso');
      onClose();
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const result = await actionUpdateCase(caseId, {
      notes: formData.notes,
      status: formData.status as any,
      postponed_until: formData.postponed_until || null,
    });

    if (result.ok) {
      toast.success('Caso actualizado correctamente');
      onSuccess();
      onClose();
    } else {
      toast.error(result.error || 'Error al actualizar caso');
    }

    setSaving(false);
  };

  const handleOpenFullEdit = () => {
    if (onOpenFullWizard && caseData) {
      onOpenFullWizard(caseData);
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border-2 border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaEdit className="text-white text-2xl" />
            <div>
              <h2 className="text-2xl font-bold text-white">Edición Rápida</h2>
              <p className="text-sm text-gray-300">Caso: {caseData?.client_name || 'Sin nombre'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <FaTimes className="text-white text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Estado del Caso <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              {Object.entries(CASE_STATUSES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Postponed Until */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Fecha Límite / Aplazar Hasta
            </label>
            <input
              type="date"
              value={formData.postponed_until}
              onChange={(e) => setFormData({ ...formData, postponed_until: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fecha en que debe finalizar el trámite
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notas / Comentarios
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Agrega notas, comentarios o detalles importantes del caso..."
              rows={5}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none"
            />
          </div>

          {/* Documents Section */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-[#010139] mb-2 flex items-center gap-2">
              <FaUpload />
              Documentos del Caso
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Los documentos del checklist se gestionan desde el detalle completo del caso
            </p>
            <button
              onClick={handleOpenFullEdit}
              className="w-full px-4 py-2 bg-[#010139] hover:bg-[#020270] text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <FaEdit className="text-white" />
              Editar Más Información (Wizard Completo)
            </button>
          </div>

          {/* Case Info Summary */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-700 mb-2">Información del Caso</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Gestión:</span>
                <p className="font-semibold">{caseData?.management_type || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-600">Aseguradora:</span>
                <p className="font-semibold">{caseData?.insurer?.name || 'N/A'}</p>
              </div>
              {caseData?.policy_number && (
                <div>
                  <span className="text-gray-600">Póliza:</span>
                  <p className="font-semibold">{caseData.policy_number}</p>
                </div>
              )}
              {caseData?.premium && (
                <div>
                  <span className="text-gray-600">Prima:</span>
                  <p className="font-semibold">${caseData.premium.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 border-t flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.status}
            className="flex-1 px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <FaSave className="text-white" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
