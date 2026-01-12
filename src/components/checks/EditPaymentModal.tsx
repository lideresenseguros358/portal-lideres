'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaPlus, FaTrash, FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionUpdatePendingPaymentFull, actionGetInsurers, actionGetBankTransfers, actionValidateReferences } from '@/app/(app)/checks/actions';
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingDeductionChange, setPendingDeductionChange] = useState<boolean | null>(null);

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

  // Descuento a corredor (detectado desde metadata de pagos creados como descuento automático)
  const initialBrokerDeduction = metadata.is_auto_advance === true || metadata.source === 'broker_deduction';
  const [isBrokerDeduction, setIsBrokerDeduction] = useState<boolean>(initialBrokerDeduction);
  const [deductionBrokerId, setDeductionBrokerId] = useState<string>(
    (metadata.broker_id as string) || formData.broker_id || ''
  );
  
  // Método de pago: 'bank_transfer' o 'broker_deduction'
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'broker_deduction'>(
    initialBrokerDeduction ? 'broker_deduction' : 'bank_transfer'
  );

  // Referencias bancarias con validación
  const [references, setReferences] = useState<Array<{
    reference_number: string;
    date: string;
    amount: string;
    amount_to_use: string;
    exists_in_bank?: boolean;
    validating?: boolean;
    status?: string | null;
    remaining_amount?: number;
  }>>([]);

  // Divisiones (si el pago original tenía divisiones)
  const [hasDivisions, setHasDivisions] = useState(false);
  const [divisions, setDivisions] = useState<Array<{
    purpose: 'poliza' | 'devolucion' | 'otro';
    policy_number: string;
    insurer_name: string;
    amount: string;
    return_type?: string;
    client_name?: string;
    bank_name?: string;
    account_number?: string;
    account_type?: string;
    broker_id?: string;
    description?: string;
  }>>([]);

  const [availableReferences, setAvailableReferences] = useState<any[]>([]);

  useEffect(() => {
    loadInsurers();
    loadBrokers();
    loadPaymentReferences();
    loadAvailableReferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPaymentReferences = async () => {
    const client = supabaseClient();
    const { data, error } = await client
      .from('payment_references')
      .select('*')
      .eq('payment_id', payment.id);
    
    if (!error && data && data.length > 0) {
      setReferences(data.map(ref => ({
        reference_number: ref.reference_number || '',
        date: (ref.date || new Date().toISOString().split('T')[0]) as string,
        amount: ref.amount?.toString() || '',
        amount_to_use: ref.amount_to_use?.toString() || ref.amount?.toString() || ''
      })));
    } else {
      // Si no hay referencias, inicializar con una vacía
      setReferences([{
        reference_number: '',
        date: new Date().toISOString().split('T')[0] as string,
        amount: '',
        amount_to_use: ''
      }]);
    }
  };

  const loadAvailableReferences = async () => {
    const result = await actionGetBankTransfers();
    if (result.ok && result.data) {
      setAvailableReferences(result.data);
    }
  };

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

  // Validación de referencias con debounce
  const validateReference = async (index: number, refNumber: string) => {
    if (!refNumber || refNumber.trim() === '') {
      return;
    }

    // Marcar como validando
    setReferences(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], validating: true };
      }
      return updated;
    });

    // Debounce: esperar 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const result = await actionValidateReferences([refNumber]);
      
      if (result.ok && result.data && result.data.length > 0) {
        const validated = result.data[0];
        const details = validated?.details || {};
        
        setReferences(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              validating: false,
              exists_in_bank: validated?.exists || false,
              status: details.status || null,
              remaining_amount: details.remaining_amount || 0,
              amount: validated?.exists && details.amount ? details.amount.toString() : updated[index].amount
            };
          }
          return updated;
        });
      } else {
        // No encontrada
        setReferences(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              validating: false,
              exists_in_bank: false,
              status: 'not_found'
            };
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error validating reference:', error);
      setReferences(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], validating: false };
        }
        return updated;
      });
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

    // Validar referencias
    const validReferences = references.filter(ref => ref.reference_number.trim());

    // Si NO es descuento a corredor, requerimos referencias bancarias
    if (!isBrokerDeduction) {
      if (validReferences.length === 0) {
        toast.error('Debe agregar al menos una referencia bancaria');
        return;
      }

      for (const ref of validReferences) {
        if (!ref.amount || parseFloat(ref.amount) <= 0) {
          toast.error(`La referencia ${ref.reference_number} debe tener un monto válido`);
          return;
        }
      }
    }

    if (formData.purpose === 'poliza' && !hasDivisions) {
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

    // Validar selección de corredor cuando se marca como descuento a corredor
    if (isBrokerDeduction) {
      if (!deductionBrokerId) {
        toast.error('Debe seleccionar el corredor al que se le descontará este pago');
        return;
      }
    }

    // Validar divisiones si están activadas
    if (hasDivisions) {
      const validDivisions = divisions.filter(div => parseFloat(div.amount || '0') > 0);
      if (validDivisions.length === 0) {
        toast.error('Debe agregar al menos una división');
        return;
      }

      const totalDivisions = validDivisions.reduce((sum, div) => sum + parseFloat(div.amount || '0'), 0);
      const totalPayment = parseFloat(formData.amount_to_pay);
      if (Math.abs(totalDivisions - totalPayment) > 0.01) {
        toast.error(`La suma de divisiones ($${totalDivisions.toFixed(2)}) debe ser igual al monto total ($${totalPayment.toFixed(2)})`);
        return;
      }

      for (const div of validDivisions) {
        if (div.purpose === 'poliza' && !div.policy_number) {
          toast.error('Todas las divisiones de póliza deben tener número de póliza');
          return;
        }
      }
    }

    setLoading(true);

    try {
      const result = await actionUpdatePendingPaymentFull(payment.id, {
        ...formData,
        amount_to_pay: parseFloat(formData.amount_to_pay),
        references: validReferences.map(ref => ({
          reference_number: ref.reference_number,
          date: ref.date,
          amount: parseFloat(ref.amount),
          amount_to_use: parseFloat(ref.amount_to_use || ref.amount)
        })),
        divisions: hasDivisions ? divisions.filter(div => parseFloat(div.amount || '0') > 0) : undefined,
        is_broker_deduction: isBrokerDeduction,
        deduction_broker_id: isBrokerDeduction ? deductionBrokerId : undefined,
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

  const addReference = () => {
    setReferences([...references, {
      reference_number: '',
      date: new Date().toISOString().split('T')[0] as string,
      amount: '',
      amount_to_use: ''
    }]);
  };

  const removeReference = (index: number) => {
    if (references.length > 1) {
      setReferences(references.filter((_, i) => i !== index));
    }
  };

  const addDivision = () => {
    setDivisions([...divisions, {
      purpose: 'poliza',
      policy_number: '',
      insurer_name: '',
      amount: ''
    }]);
  };

  const removeDivision = (index: number) => {
    setDivisions(divisions.filter((_, i) => i !== index));
  };

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">✏️ Editar Pago Pendiente</h2>
            <p className="standard-modal-subtitle">Actualiza la información del pago</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <div className="space-y-6">
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

          {/* Método de Pago */}
          <div className="border-2 border-[#010139]/20 rounded-lg p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-white">
            <h3 className="font-bold text-base sm:text-lg text-[#010139] mb-3 sm:mb-4 flex items-center gap-2">
              💳 Método de Pago
            </h3>
            
            <div className="space-y-3 sm:space-y-4">
              {/* Radio buttons para seleccionar método */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <label 
                  className={`relative flex items-start gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    paymentMethod === 'bank_transfer' 
                      ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-md' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value="bank_transfer"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => {
                      // Si cambia de descuento a corredor a transferencia bancaria
                      if (isBrokerDeduction && metadata.advance_id) {
                        setPendingDeductionChange(false);
                        setShowConfirmModal(true);
                      } else {
                        setPaymentMethod('bank_transfer');
                        setIsBrokerDeduction(false);
                      }
                    }}
                    className="mt-1 w-4 h-4 sm:w-5 sm:h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm sm:text-base text-[#010139] flex items-center gap-2">
                      🏦 Transferencia Bancaria
                      {paymentMethod === 'bank_transfer' && (
                        <span className="text-xs bg-[#8AAA19] text-white px-2 py-0.5 rounded-full">Activo</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Usar referencias bancarias para este pago
                    </p>
                  </div>
                </label>

                <label 
                  className={`relative flex items-start gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    paymentMethod === 'broker_deduction' 
                      ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-md' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value="broker_deduction"
                    checked={paymentMethod === 'broker_deduction'}
                    onChange={() => {
                      setPaymentMethod('broker_deduction');
                      setIsBrokerDeduction(true);
                    }}
                    className="mt-1 w-4 h-4 sm:w-5 sm:h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm sm:text-base text-[#010139] flex items-center gap-2">
                      💰 Descuento a Corredor
                      {paymentMethod === 'broker_deduction' && (
                        <span className="text-xs bg-[#8AAA19] text-white px-2 py-0.5 rounded-full">Activo</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Descontar del adelanto del corredor
                    </p>
                  </div>
                </label>
              </div>

              {/* Contenido condicional según método */}
              {paymentMethod === 'broker_deduction' && (
                <div className="space-y-3 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corredor a descontar <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={deductionBrokerId}
                    onChange={(e) => setDeductionBrokerId(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                  >
                    <option value="">Seleccionar corredor...</option>
                    {brokers.map((broker) => (
                      <option key={broker.id} value={broker.id}>{broker.name}</option>
                    ))}
                  </select>
                  
                  {deductionBrokerId && (
                    <>
                      <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded-r">
                        <p className="text-xs sm:text-sm text-green-800">
                          ✅ Este pago se descontará de las comisiones del corredor por
                          <span className="font-bold"> ${parseFloat(formData.amount_to_pay || '0').toFixed(2)}</span>
                        </p>
                      </div>
                      
                      <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r">
                        <p className="text-xs sm:text-sm text-blue-800 font-semibold">
                          🔄 Sincronización automática
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          El adelanto se actualizará automáticamente si cambias el monto
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Referencias Bancarias - Solo visible si método es transferencia */}
          {paymentMethod === 'bank_transfer' && (
            <div className="border-2 border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                <h3 className="font-semibold text-sm sm:text-base text-gray-700">🏦 Referencias Bancarias</h3>
                <button
                  type="button"
                  onClick={addReference}
                  className="px-3 py-2 bg-[#8AAA19] text-white rounded-lg text-xs sm:text-sm hover:bg-[#7a9916] transition flex items-center justify-center gap-1 w-full sm:w-auto"
                >
                  <FaPlus className="text-white" /> <span className="text-white">Agregar Referencia</span>
                </button>
              </div>
              
              {/* Labels para desktop */}
              <div className="hidden md:grid md:grid-cols-12 gap-2 mb-2 text-xs font-semibold text-gray-600">
                <div className="col-span-4">Referencia</div>
                <div className="col-span-3">Fecha</div>
                <div className="col-span-2">Monto</div>
                <div className="col-span-2">A Usar</div>
                <div className="col-span-1"></div>
              </div>
              
              {references.map((ref, index) => (
                <div key={index} className="mb-3 sm:mb-2">
                  {/* Layout mobile - vertical */}
                  <div className="md:hidden space-y-2 p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                      <input
                        type="text"
                        placeholder="# Referencia"
                        value={ref.reference_number}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].reference_number = e.target.value;
                            setReferences(newRefs);
                            validateReference(index, e.target.value);
                          }
                        }}
                        list="available-references"
                        className="w-full px-3 py-2 pr-8 border rounded text-sm"
                      />
                      <div className="absolute right-2 top-8">
                        {ref.validating && <FaSpinner className="text-blue-500 animate-spin" size={16} />}
                        {!ref.validating && ref.exists_in_bank && <FaCheckCircle className="text-green-600" size={16} />}
                        {!ref.validating && ref.exists_in_bank === false && ref.reference_number && <FaExclamationTriangle className="text-red-600" size={16} />}
                      </div>
                      {!ref.validating && ref.exists_in_bank && ref.remaining_amount !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">Disponible: ${ref.remaining_amount.toFixed(2)}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={ref.date}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].date = e.target.value;
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={ref.amount}
                          onChange={(e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              newRefs[index].amount = e.target.value;
                              if (!newRefs[index].amount_to_use) {
                                newRefs[index].amount_to_use = e.target.value;
                              }
                              setReferences(newRefs);
                            }
                          }}
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">A Usar</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={ref.amount_to_use}
                          onChange={(e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              newRefs[index].amount_to_use = e.target.value;
                              setReferences(newRefs);
                            }
                          }}
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                    </div>
                    
                    {references.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReference(index)}
                        className="w-full px-3 py-2 text-red-500 hover:bg-red-50 rounded transition flex items-center justify-center gap-1 text-sm"
                      >
                        <FaTrash /> Eliminar
                      </button>
                    )}
                  </div>
                  
                  {/* Layout desktop - horizontal */}
                  <div className="hidden md:grid md:grid-cols-12 gap-2">
                    <div className="col-span-4 relative">
                      <input
                        type="text"
                        placeholder="# Referencia"
                        value={ref.reference_number}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].reference_number = e.target.value;
                            setReferences(newRefs);
                            validateReference(index, e.target.value);
                          }
                        }}
                        list="available-references"
                        className="w-full px-3 py-2 pr-8 border rounded text-sm"
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        {ref.validating && <FaSpinner className="text-blue-500 animate-spin" size={16} />}
                        {!ref.validating && ref.exists_in_bank && <FaCheckCircle className="text-green-600" size={16} />}
                        {!ref.validating && ref.exists_in_bank === false && ref.reference_number && <FaExclamationTriangle className="text-red-600" size={16} />}
                      </div>
                      {!ref.validating && ref.exists_in_bank && ref.remaining_amount !== undefined && (
                        <p className="text-xs text-gray-600 mt-1">Disponible: ${ref.remaining_amount.toFixed(2)}</p>
                      )}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="date"
                        value={ref.date}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].date = e.target.value;
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Monto"
                        value={ref.amount}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].amount = e.target.value;
                            if (!newRefs[index].amount_to_use) {
                              newRefs[index].amount_to_use = e.target.value;
                            }
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="A usar"
                        value={ref.amount_to_use}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[index]) {
                            newRefs[index].amount_to_use = e.target.value;
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {references.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeReference(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <datalist id="available-references">
                {availableReferences.map((ref) => (
                  <option key={ref.id} value={ref.reference_number} />
                ))}
              </datalist>
            </div>
          )}

          {/* Divisiones (opcional) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDivisions}
                onChange={(e) => {
                  setHasDivisions(e.target.checked);
                  if (e.target.checked && divisions.length === 0) {
                    setDivisions([{
                      purpose: formData.purpose,
                      policy_number: formData.policy_number,
                      insurer_name: formData.insurer_name,
                      amount: formData.amount_to_pay
                    }]);
                  }
                }}
                className="w-4 h-4 text-[#8AAA19]"
              />
              <span className="text-sm font-medium text-gray-700">Dividir este pago en múltiples conceptos</span>
            </label>
          </div>

          {hasDivisions && (
            <div className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Divisiones del Pago</h3>
                <button
                  type="button"
                  onClick={addDivision}
                  className="px-3 py-1 bg-[#8AAA19] text-white rounded-lg text-sm hover:bg-[#7a9916] transition flex items-center gap-1"
                >
                  <FaPlus /> Agregar
                </button>
              </div>
              {divisions.map((div, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Propósito</label>
                      <select
                        value={div.purpose}
                        onChange={(e) => {
                          const newDivs = [...divisions];
                          if (newDivs[index]) {
                            newDivs[index].purpose = e.target.value as any;
                            setDivisions(newDivs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      >
                        <option value="poliza">Póliza</option>
                        <option value="devolucion">Devolución</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
                      <input
                        type="number"
                        step="0.01"
                        value={div.amount}
                        onChange={(e) => {
                          const newDivs = [...divisions];
                          if (newDivs[index]) {
                            newDivs[index].amount = e.target.value;
                            setDivisions(newDivs);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                    {div.purpose === 'poliza' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Póliza</label>
                          <input
                            type="text"
                            value={div.policy_number}
                            onChange={(e) => {
                              const newDivs = [...divisions];
                              if (newDivs[index]) {
                                newDivs[index].policy_number = e.target.value;
                                setDivisions(newDivs);
                              }
                            }}
                            className="w-full px-3 py-2 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
                          <select
                            value={div.insurer_name}
                            onChange={(e) => {
                              const newDivs = [...divisions];
                              if (newDivs[index]) {
                                newDivs[index].insurer_name = e.target.value;
                                setDivisions(newDivs);
                              }
                            }}
                            className="w-full px-3 py-2 border rounded text-sm"
                          >
                            <option value="">Seleccionar...</option>
                            {insurers.map((ins) => (
                              <option key={ins.id} value={ins.name}>{ins.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDivision(index)}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <FaTrash /> Eliminar división
                  </button>
                </div>
              ))}
              <div className="text-sm text-gray-600">
                <strong>Total divisiones:</strong> ${divisions.reduce((sum, div) => sum + parseFloat(div.amount || '0'), 0).toFixed(2)} / ${formData.amount_to_pay}
              </div>
            </div>
          )}

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
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="standard-modal-button-secondary w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="standard-modal-button-primary w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <FaSave className="text-white" />
                  <span className="text-white">Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <FaExclamationTriangle className="text-amber-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  ⚠️ Confirmar Cambio de Método de Pago
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Este pago está actualmente configurado como <strong>descuento a corredor</strong> y tiene un adelanto asociado.
                </p>
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r mb-3">
                  <p className="text-sm text-red-800 font-semibold">
                    🗑️ Al cambiar a transferencia bancaria:
                  </p>
                  <ul className="text-xs text-red-700 mt-2 space-y-1 ml-4 list-disc">
                    <li>El adelanto asociado será <strong>cancelado automáticamente</strong></li>
                    <li>El pago usará referencias bancarias en su lugar</li>
                    <li>Esta acción no se puede deshacer</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  ¿Estás seguro de que deseas continuar?
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingDeductionChange(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('bank_transfer');
                  setIsBrokerDeduction(false);
                  setShowConfirmModal(false);
                  setPendingDeductionChange(null);
                  toast.info('El adelanto será cancelado al guardar los cambios');
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
              >
                <FaExclamationTriangle className="text-white" />
                <span className="text-white">Sí, Cambiar Método</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
