'use client';

import { useState } from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ApproveModalProps {
  request: any;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_PERCENTS = [0.50, 0.60, 0.70, 0.80, 0.82, 0.94, 1.00];

export default function ApproveModal({ request, onClose, onSuccess }: ApproveModalProps) {
  const [role, setRole] = useState('broker');
  const [commissionPercent, setCommissionPercent] = useState('0.82');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔵 ApproveModal: Iniciando proceso de aprobación');
    console.log('🔵 Request ID:', request.id);
    console.log('🔵 Role:', role);
    console.log('🔵 Commission:', commissionPercent);

    // Validar rol
    const normalizedRole = role.toLowerCase().trim();
    if (!['master', 'broker'].includes(normalizedRole)) {
      toast.error('Rol inválido. Debe ser "master" o "broker"');
      return;
    }

    // Validar porcentaje
    const percent = parseFloat(commissionPercent);
    if (!ALLOWED_PERCENTS.includes(percent)) {
      toast.error('Porcentaje de comisión inválido');
      return;
    }

    setLoading(true);

    try {
      console.log('🔵 Enviando PATCH request...');
      const res = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          role: normalizedRole,
          commission_percent: percent
        })
      });

      console.log('🔵 Response status:', res.status);
      const data = await res.json();
      console.log('🔵 Response data:', data);

      if (data.success) {
        toast.success('Usuario aprobado y creado exitosamente');
        onSuccess();
      } else {
        console.error('❌ Error en respuesta:', data.error);
        toast.error(data.error || 'Error al aprobar solicitud');
      }
    } catch (error) {
      console.error('❌ Error completo:', error);
      toast.error('Error al aprobar solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaCheckCircle className="inline mr-2" />
              Aprobar Solicitud
            </h2>
            <p className="standard-modal-subtitle">Crear usuario y asignar permisos</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          {/* Datos del Solicitante */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-blue-600">👤</span>
            Información Personal
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Nombre:</span>
              <span className="font-semibold text-gray-800">{request.nombre_completo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-gray-800">{request.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cédula:</span>
              <span className="font-semibold text-gray-800">{request.cedula}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Teléfono:</span>
              <span className="font-semibold text-gray-800">{request.telefono}</span>
            </div>
            {request.licencia && (
              <div className="flex justify-between">
                <span className="text-gray-600">Licencia:</span>
                <span className="font-semibold text-gray-800">{request.licencia}</span>
              </div>
            )}
          </div>
          </div>

          {/* Datos Bancarios ACH */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span className="text-blue-600">🏦</span>
              Datos Bancarios para Comisiones (ACH)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Banco (Código Ruta):</span>
                <span className="font-semibold text-blue-900">{request.bank_route || 'No especificado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Tipo de Cuenta:</span>
                <span className="font-semibold text-blue-900">
                  {request.tipo_cuenta === '03' ? 'Corriente (03)' : request.tipo_cuenta === '04' ? 'Ahorro (04)' : request.tipo_cuenta || 'No especificado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Número de Cuenta:</span>
                <span className="font-semibold text-blue-900 font-mono">{request.bank_account_no || 'No especificado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Titular:</span>
                <span className="font-semibold text-blue-900">{request.nombre_completo_titular || 'No especificado'}</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3">
              ℹ️ Esta información se usará para el pago de comisiones vía ACH Banco General
            </p>
          </div>

          {/* Formulario */}
          <form id="approve-form" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Rol */}
            <div>
              <label className="block text-sm font-semibold text-[#010139] mb-2">
                Rol *
              </label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19] h-12">
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Se guardará en minúsculas: master | broker
              </p>
            </div>

            {/* % Comisión */}
            <div>
              <label className="block text-sm font-semibold text-[#010139] mb-2">
                % Comisión Default *
              </label>
              <Select value={commissionPercent} onValueChange={setCommissionPercent}>
                <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19] h-12">
                  <SelectValue placeholder="Seleccione porcentaje" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_PERCENTS.map(percent => (
                    <SelectItem key={percent} value={percent.toString()}>
                      {(percent * 100).toFixed(0)}% ({percent.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Opciones globales definidas en Configuración
              </p>
            </div>

            {/* Tipo de Broker */}
            {request.additional_fields && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Tipo:</strong> {(request.additional_fields as any).broker_type === 'agente' ? '🎫 Agente' : '📋 Corredor'}
                  {(request.additional_fields as any).assa_code && ` | Código ASSA: ${(request.additional_fields as any).assa_code}`}
                </p>
              </div>
            )}

            {/* Advertencia */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Importante:</strong> Al aprobar se creará el usuario en auth.users y automáticamente se completarán los perfiles y registro de broker.
              </p>
            </div>
          </div>

          </form>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="approve-form"
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                'Confirmar Aprobación'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
