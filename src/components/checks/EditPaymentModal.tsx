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

          {/* Descuento a corredor */}
          <div className="border-2 border-[#8AAA19]/40 rounded-lg p-4 bg-[#f9fbea] space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="edit-broker-deduction"
                checked={isBrokerDeduction}
                onChange={(e) => setIsBrokerDeduction(e.target.checked)}
                className="mt-1 w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
              />
              <div className="flex-1">
                <label htmlFor="edit-broker-deduction" className="font-semibold text-sm text-[#010139]">
                  💰 Descontar este pago al corredor (adelanto en comisiones)
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  Si está activo, el monto completo se convierte en un adelanto al corredor seleccionado.
                  Puedes convertir este pago entre referencia bancaria y descuento a corredor.
                </p>
              </div>
            </div>

            {isBrokerDeduction && (
              <div className="mt-3 space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corredor a descontar <span className="text-red-500">*</span>
                </label>
                <select
                  value={deductionBrokerId}
                  onChange={(e) => setDeductionBrokerId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                >
                  <option value="">Seleccionar corredor...</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>{broker.name}</option>
                  ))}
                </select>
                {deductionBrokerId && (
                  <>
                    <p className="text-xs text-green-700 mt-1">
                      Este pago se descontará de las comisiones del corredor seleccionado por
                      <span className="font-semibold"> ${parseFloat(formData.amount_to_pay || '0').toFixed(2)}</span>.
                    </p>
                    <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded-r">
                      <p className="text-xs text-blue-800 font-semibold">
                        🔄 Sincronización automática activada
                      </p>
                      <p className="text-[11px] text-blue-700 mt-1">
                        Si cambias el monto del pago, el adelanto ligado se actualizará automáticamente al mismo valor.
                      </p>
                    </div>
                  </>
                )}
                <p className="text-[11px] text-amber-700 mt-2">
                  💡 <strong>Conversión:</strong> Al activar/desactivar esta opción:
                  <br/>• Activar: crea un adelanto automático
                  <br/>• Desactivar: cancela el adelanto ligado
                  <br/>• Mantener activo + editar monto: sincroniza adelanto
                </p>
              </div>
            )}
          </div>

          {/* Referencias Bancarias */}
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Referencias Bancarias</h3>
              <button
                type="button"
                onClick={addReference}
                className="px-3 py-1 bg-[#8AAA19] text-white rounded-lg text-sm hover:bg-[#7a9916] transition flex items-center gap-1"
              >
                <FaPlus /> Agregar
              </button>
            </div>
            {references.map((ref, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
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
                        // Validar referencia con debounce
                        validateReference(index, e.target.value);
                      }
                    }}
                    list="available-references"
                    className="w-full px-3 py-2 pr-8 border rounded text-sm"
                  />
                  {/* Iconos de validación */}
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {ref.validating && (
                      <FaSpinner className="text-blue-500 animate-spin" size={16} />
                    )}
                    {!ref.validating && ref.exists_in_bank && (
                      <FaCheckCircle className="text-green-600" size={16} title="Referencia válida" />
                    )}
                    {!ref.validating && ref.exists_in_bank === false && ref.reference_number && (
                      <FaExclamationTriangle className="text-red-600" size={16} title="Referencia no encontrada" />
                    )}
                    {!ref.validating && ref.status === 'exhausted' && (
                      <FaExclamationTriangle className="text-orange-600" size={16} title="Referencia agotada" />
                    )}
                  </div>
                  {/* Info adicional de validación */}
                  {!ref.validating && ref.exists_in_bank && ref.remaining_amount !== undefined && (
                    <p className="text-xs text-gray-600 mt-1">
                      Disponible: ${ref.remaining_amount.toFixed(2)}
                    </p>
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
            ))}
            <datalist id="available-references">
              {availableReferences.map((ref) => (
                <option key={ref.id} value={ref.reference_number} />
              ))}
            </datalist>
          </div>

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
