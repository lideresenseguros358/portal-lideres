'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionUpdatePendingPayment, actionGetInsurers } from '@/app/(app)/checks/actions';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { supabaseClient } from '@/lib/supabase/client';

interface EditPaymentModalProps {
  payment: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPaymentModal({ payment, onClose, onSuccess }: EditPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);

  // Parse metadata from notes
  const parseMetadata = () => {
    try {
      if (typeof payment.notes === 'string') {
        const parsed = JSON.parse(payment.notes);
        return parsed;
      }
    } catch {
      return {};
    }
    return {};
  };

  const metadata = parseMetadata();

  const [formData, setFormData] = useState({
    client_name: payment.client_name || '',
    purpose: payment.purpose as 'poliza' | 'devolucion' | 'otro',
    policy_number: payment.policy_number || '',
    insurer_name: payment.insurer_name || '',
    amount_to_pay: payment.amount_to_pay?.toString() || '',
    notes: metadata.notes || '',
    devolucion_tipo: (metadata.devolucion_tipo || 'cliente') as 'cliente' | 'corredor',
    cuenta_banco: metadata.cuenta_banco || '',
    banco_nombre: metadata.banco_nombre || '',
    tipo_cuenta: metadata.tipo_cuenta || '',
    broker_id: metadata.broker_id || '',
    broker_cuenta: metadata.broker_cuenta || '',
  });

  useEffect(() => {
    loadInsurers();
    loadBrokers();
  }, []);

  const loadInsurers = async () => {
    const result = await actionGetInsurers();
    if (result.ok) {
      setInsurers(result.data || []);
    }
  };

  const loadBrokers = async () => {
    const client = supabaseClient();
    const { data, error } = await client
      .from('brokers')
      .select('id, name, bank_account_no')
      .eq('active', true)
      .order('name');

    if (!error && data) {
      setBrokers(data);
    }
  };

  const handleSave = async () => {
    // Validaciones básicas
    if (!formData.client_name.trim()) {
      toast.error('El nombre del cliente es requerido');
      return;
    }

    if (!formData.amount_to_pay || parseFloat(formData.amount_to_pay) <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (formData.purpose === 'poliza') {
      if (!formData.policy_number.trim()) {
        toast.error('El número de póliza es requerido');
        return;
      }
      if (!formData.insurer_name) {
        toast.error('La aseguradora es requerida');
        return;
      }
    }

    if (formData.purpose === 'devolucion') {
      if (formData.devolucion_tipo === 'cliente') {
        if (!formData.banco_nombre.trim()) {
          toast.error('El banco es requerido');
          return;
        }
        if (!formData.tipo_cuenta) {
          toast.error('El tipo de cuenta es requerido');
          return;
        }
        if (!formData.cuenta_banco.trim()) {
          toast.error('El número de cuenta es requerido');
          return;
        }
      } else if (formData.devolucion_tipo === 'corredor') {
        if (!formData.broker_id) {
          toast.error('El corredor es requerido');
          return;
        }
      }
    }

    setLoading(true);

    try {
      const result = await actionUpdatePendingPayment(payment.id, {
        ...formData,
        amount_to_pay: parseFloat(formData.amount_to_pay),
      });

      if (result.ok) {
        toast.success('✅ Pago actualizado exitosamente');
        onSuccess();
      } else {
        toast.error(result.error || 'Error al actualizar');
      }
    } catch (error: any) {
      toast.error('Error inesperado: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">✏️ Editar Pago Pendiente</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <FaTimes size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.client_name}
              onChange={createUppercaseHandler((e) => setFormData({ ...formData, client_name: e.target.value }))}
              className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
            />
          </div>

          {/* Propósito */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Propósito <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value as 'poliza' | 'devolucion' | 'otro' })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="poliza">Póliza</option>
              <option value="devolucion">Devolución</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Campos condicionales para PÓLIZA */}
          {formData.purpose === 'poliza' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Póliza <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.policy_number}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aseguradora <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.insurer_name}
                  onChange={(e) => setFormData({ ...formData, insurer_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {insurers.map((ins) => (
                    <option key={ins.id} value={ins.name}>{ins.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Campos condicionales para DEVOLUCIÓN */}
          {formData.purpose === 'devolucion' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Devolución <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="devolucion_tipo"
                      value="cliente"
                      checked={formData.devolucion_tipo === 'cliente'}
                      onChange={() => setFormData({ ...formData, devolucion_tipo: 'cliente' })}
                      className="w-4 h-4 text-[#8AAA19]"
                    />
                    <span>Cliente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="devolucion_tipo"
                      value="corredor"
                      checked={formData.devolucion_tipo === 'corredor'}
                      onChange={() => setFormData({ ...formData, devolucion_tipo: 'corredor' })}
                      className="w-4 h-4 text-[#8AAA19]"
                    />
                    <span>Corredor</span>
                  </label>
                </div>
              </div>

              {formData.devolucion_tipo === 'cliente' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Banco <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.banco_nombre}
                      onChange={createUppercaseHandler((e) => setFormData({ ...formData, banco_nombre: e.target.value }))}
                      className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
                      placeholder="Ej: BANCO GENERAL"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Cuenta <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.tipo_cuenta}
                      onChange={(e) => setFormData({ ...formData, tipo_cuenta: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="CORRIENTE">Corriente</option>
                      <option value="AHORRO">Ahorro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Cuenta <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cuenta_banco}
                      onChange={createUppercaseHandler((e) => setFormData({ ...formData, cuenta_banco: e.target.value }))}
                      className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
                      placeholder="Número de cuenta del cliente"
                    />
                  </div>
                </>
              )}

              {formData.devolucion_tipo === 'corredor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corredor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.broker_id}
                    onChange={(e) => {
                      const selectedBroker = brokers.find((b) => b.id === e.target.value);
                      setFormData({
                        ...formData,
                        broker_id: e.target.value,
                        broker_cuenta: selectedBroker?.bank_account_no || ''
                      });
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  >
                    <option value="">Seleccionar corredor...</option>
                    {brokers.map((broker) => (
                      <option key={broker.id} value={broker.id}>{broker.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto a Pagar <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_to_pay}
              onChange={(e) => setFormData({ ...formData, amount_to_pay: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              placeholder="0.00"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={formData.notes}
              onChange={createUppercaseHandler((e) => setFormData({ ...formData, notes: e.target.value }))}
              className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
              rows={2}
              placeholder="Información adicional (opcional)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FaSave />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
