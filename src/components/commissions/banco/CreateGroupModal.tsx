'use client';

import { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionCreateBankGroup } from '@/app/(app)/commissions/banco-actions';
import type { GroupTemplate } from '@/app/(app)/commissions/banco-actions';

interface CreateGroupModalProps {
  insurers: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: (groupId: string, insurerId: string, transferType: string) => void;
}

const GROUP_TEMPLATES: { value: GroupTemplate; label: string; requiresLifeFlag: boolean }[] = [
  { value: 'NORMAL', label: 'Normal', requiresLifeFlag: false },
  { value: 'ASSA_CODIGOS', label: 'Códigos ASSA', requiresLifeFlag: true },
];

export default function CreateGroupModal({ insurers, onClose, onSuccess }: CreateGroupModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', // Opcional - anotación
    template: 'NORMAL' as GroupTemplate,
    insurerId: '',
    isLifeInsurance: undefined as boolean | undefined,
    transferType: 'REPORTE' as 'REPORTE' | 'BONO' | 'OTRO' | 'PENDIENTE',
  });

  // Auto-seleccionar ASSA cuando se elige Códigos ASSA
  const assaInsurer = insurers.find(i => i.name.toUpperCase().includes('ASSA'));
  
  // Efecto para auto-seleccionar ASSA en Códigos ASSA
  useEffect(() => {
    if (formData.template === 'ASSA_CODIGOS' && assaInsurer) {
      setFormData(prev => ({ ...prev, insurerId: assaInsurer.id }));
    }
  }, [formData.template, assaInsurer]);

  const selectedTemplate = GROUP_TEMPLATES.find(t => t.value === formData.template);
  const requiresLifeFlag = selectedTemplate?.requiresLifeFlag || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ASEGURADORA OBLIGATORIA
    if (!formData.insurerId) {
      toast.error('Debes seleccionar una aseguradora');
      return;
    }

    if (requiresLifeFlag && formData.isLifeInsurance === undefined) {
      toast.error('Define si es VIDA o NO VIDA para este tipo de grupo');
      return;
    }

    // Usar aseguradora como nombre del grupo
    const insurerName = insurers.find(i => i.id === formData.insurerId)?.name || 'Grupo';
    const groupName = formData.name.trim() 
      ? `${insurerName} - ${formData.name.trim()}` 
      : insurerName;

    setLoading(true);

    try {
      console.log('[UI] Creando grupo con:', { groupName, template: formData.template, insurerId: formData.insurerId });
      
      const result = await actionCreateBankGroup(
        groupName,
        formData.template,
        formData.insurerId,
        requiresLifeFlag ? formData.isLifeInsurance : undefined
      );

      if (result.ok && result.data?.groupId) {
        toast.success('Grupo creado exitosamente');
        onSuccess(result.data.groupId, formData.insurerId, formData.transferType); // Pasar groupId, insurerId y transferType
      } else {
        toast.error('Error al crear grupo', { description: result.error });
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
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold">Crear Grupo Bancario</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre (Opcional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Anotación (Opcional)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Pagos Diciembre, Quincena 1..."
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
            />
            <p className="text-xs text-gray-500 mt-1">
              El nombre del grupo será la aseguradora. Esto es solo una nota adicional.
            </p>
          </div>

          {/* Plantilla */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Grupo *
            </label>
            <select
              value={formData.template}
              onChange={(e) => setFormData({ 
                ...formData, 
                template: e.target.value as GroupTemplate,
                isLifeInsurance: undefined, // Reset cuando cambia template
              })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
              required
            >
              {GROUP_TEMPLATES.map(template => (
                <option key={template.value} value={template.value}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Transferencia */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Transferencia *
            </label>
            <select
              value={formData.transferType}
              onChange={(e) => setFormData({ ...formData, transferType: e.target.value as any })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19]"
              required
            >
              <option value="REPORTE">REPORTE</option>
              <option value="BONO">BONO</option>
              <option value="OTRO">OTRO</option>
              <option value="PENDIENTE">PENDIENTE</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Este tipo se asignará a todas las transferencias del grupo
            </p>
          </div>

          {/* Aseguradora */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Aseguradora *
            </label>
            <select
              value={formData.insurerId}
              onChange={(e) => setFormData({ ...formData, insurerId: e.target.value })}
              disabled={formData.template === 'ASSA_CODIGOS'}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
            >
              <option value="">Seleccionar...</option>
              {insurers.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
            {formData.template === 'ASSA_CODIGOS' && (
              <p className="text-xs text-blue-600 mt-1">
                ✓ ASSA seleccionada automáticamente para Códigos ASSA
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Esta aseguradora se asignará a todas las transferencias del grupo
            </p>
          </div>

          {/* VIDA / NO VIDA (solo para ASSA) */}
          {requiresLifeFlag && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Clasificación ASSA *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="lifeInsurance"
                    checked={formData.isLifeInsurance === true}
                    onChange={() => setFormData({ ...formData, isLifeInsurance: true })}
                    className="w-4 h-4 text-[#8AAA19]"
                  />
                  <span className="text-sm font-medium">VIDA</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="lifeInsurance"
                    checked={formData.isLifeInsurance === false}
                    onChange={() => setFormData({ ...formData, isLifeInsurance: false })}
                    className="w-4 h-4 text-[#8AAA19]"
                  />
                  <span className="text-sm font-medium">NO VIDA</span>
                </label>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Códigos ASSA:</strong> Detecta automáticamente licencias de brokers en reportes.
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Normal:</strong> Agrupa transferencias de cualquier aseguradora.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
