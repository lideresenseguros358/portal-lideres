'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaPlus, FaTrash } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionCreatePendingPayment, actionValidateReferences, actionGetInsurers } from '@/app/(app)/checks/actions';
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { supabaseClient } from '@/lib/supabase/client';

interface AdvancePrefill {
  id: string;
  amount: number;
  status?: string | null;
  broker_id: string;
  broker_name: string;
}

interface WizardProps {
  onClose: () => void;
  onSuccess: () => void;
  advanceId?: string | null;
  advancePrefill?: AdvancePrefill | null;
  advanceLoading?: boolean;
}

export default function RegisterPaymentWizardNew({
  onClose,
  onSuccess,
  advanceId,
  advancePrefill = null,
  advanceLoading = false,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  
  // Step 1: Información básica
  const [formData, setFormData] = useState({
    client_name: '',
    purpose: 'poliza' as 'poliza' | 'devolucion' | 'otro',
    policy_number: '',
    insurer_name: '',
    amount_to_pay: '',
    notes: '',
    devolucion_tipo: 'cliente' as 'cliente' | 'corredor',
    cuenta_banco: '',
    broker_id: '',
    broker_cuenta: ''
  });

  // Step 2: Referencias
  const [multipleRefs, setMultipleRefs] = useState(false);
  const [references, setReferences] = useState([{
    reference_number: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    amount_to_use: '',
    exists_in_bank: false,
    validating: false,
    status: null as string | null,
    remaining_amount: 0
  }]);

  // Step 3: División (opcional)
  const [divideSingle, setDivideSingle] = useState(false);
  const [divisions, setDivisions] = useState([{
    purpose: 'poliza' as 'poliza' | 'devolucion' | 'otro',
    policy_number: '',
    insurer_name: '',
    amount: ''
  }]);

  useEffect(() => {
    loadInsurers();
    loadBrokers();
  }, []);

  // Prefill when advance data arrives
  useEffect(() => {
    if (advancePrefill) {
      setFormData(prev => ({
        ...prev,
        client_name: advancePrefill.broker_name,
        purpose: 'devolucion',
        devolucion_tipo: 'corredor',
        broker_id: advancePrefill.broker_id,
        amount_to_pay: advancePrefill.amount.toString(),
      }));

      // Reset references list to one empty entry
      setReferences([{
        reference_number: '',
        date: new Date().toISOString().split('T')[0],
        amount: advancePrefill.amount.toFixed(2),
        amount_to_use: advancePrefill.amount.toFixed(2),
        exists_in_bank: false,
        validating: false,
        status: null,
        remaining_amount: 0
      }]);
    }
  }, [advancePrefill]);

  const loadInsurers = async () => {
    const result = await actionGetInsurers();
    if (result.ok) {
      setInsurers(result.data || []);
    }
  };

  const loadBrokers = async () => {
    try {
      const { data, error } = await supabaseClient()
        .from('brokers')
        .select('id, name, bank_account_number')
        .eq('active', true)
        .order('name');
      
      if (error) {
        console.error('Error loading brokers:', error);
        toast.error('Error al cargar corredores');
        return;
      }
      
      if (data) {
        console.log('Brokers loaded:', data.length);
        setBrokers(data);
      }
    } catch (error) {
      console.error('Error in loadBrokers:', error);
      toast.error('Error al cargar corredores');
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.client_name || !formData.amount_to_pay) {
        toast.error('Complete los campos obligatorios');
        return false;
      }
      if (formData.purpose === 'poliza' && (!formData.policy_number || !formData.insurer_name)) {
        toast.error('Para pólizas, especifique número y aseguradora');
        return false;
      }
    } else if (step === 2) {
      const amountToPay = parseFloat(formData.amount_to_pay);
      
      // Verificar que todas las referencias tengan número
      if (references.some(r => !r.reference_number)) {
        toast.error('Complete todas las referencias');
        return false;
      }
      
      // Verificar que ninguna referencia esté agotada
      const exhaustedRef = references.find(r => r.status === 'exhausted');
      if (exhaustedRef) {
        toast.error('❌ Referencia agotada detectada', {
          description: `La referencia ${exhaustedRef.reference_number} no tiene saldo disponible. Elimínela o use otra.`
        });
        return false;
      }
      
      // Verificar que el monto a usar no exceda el saldo disponible
      const overLimitRef = references.find(r => {
        if (!r.exists_in_bank) return false;
        const amountToUse = parseFloat(r.amount_to_use) || 0;
        return amountToUse > r.remaining_amount + 0.01; // tolerance for float precision
      });
      
      if (overLimitRef) {
        toast.error('Monto excede saldo disponible', {
          description: `La referencia ${overLimitRef.reference_number} solo tiene $${overLimitRef.remaining_amount.toFixed(2)} disponibles.`
        });
        return false;
      }
      
      // Calcular total usando amount_to_use
      const totalToUse = references.reduce((sum, ref) => sum + (parseFloat(ref.amount_to_use) || 0), 0);
      
      if (totalToUse < amountToPay - 0.01) { // tolerance for float precision
        toast.error('Referencias insuficientes', {
          description: `Total disponible: $${totalToUse.toFixed(2)} - Necesario: $${amountToPay.toFixed(2)}`
        });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const validateReference = async (index: number) => {
    const ref = references[index];
    if (!ref || !ref.reference_number) return;

    const newRefs = [...references];
    if (!newRefs[index]) return;
    newRefs[index].validating = true;
    setReferences(newRefs);

    const result = await actionValidateReferences([ref.reference_number]);
    if (result.ok && result.data && result.data.length > 0) {
      const validation = result.data[0];
      if (validation && newRefs[index]) {
        newRefs[index]!.exists_in_bank = validation.exists;
        if (validation.details) {
          const remaining = Number(validation.details.remaining_amount) || 0;
          const status = validation.details.status || 'available';
          
          newRefs[index]!.amount = validation.details.amount?.toString() || '';
          newRefs[index]!.remaining_amount = remaining;
          newRefs[index]!.status = status;
          
          // Set amount_to_use to remaining (max available)
          newRefs[index]!.amount_to_use = remaining.toFixed(2);
        }
      }
      if (newRefs[index]) {
        newRefs[index]!.validating = false;
      }
      setReferences(newRefs);

      if (validation) {
        if (!validation.exists) {
          toast.warning('Referencia no encontrada en banco', {
            description: 'Se guardará como preliminar'
          });
        } else if (validation.details?.status === 'exhausted') {
          toast.error('❌ Referencia agotada', {
            description: 'Esta referencia ya fue usada completamente y no tiene saldo disponible'
          });
        } else if (validation.details?.status === 'partial') {
          const remaining = Number(validation.details.remaining_amount) || 0;
          toast.success('⚠️ Referencia parcialmente usada', {
            description: `Saldo disponible: $${remaining.toFixed(2)}`
          });
        } else {
          toast.success('✅ Referencia válida');
        }
      }
    } else {
      if (newRefs[index]) {
        newRefs[index]!.validating = false;
      }
      setReferences(newRefs);
    }
  };

  const addReference = () => {
    setReferences([...references, {
      reference_number: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      amount_to_use: '',
      exists_in_bank: false,
      validating: false,
      status: null,
      remaining_amount: 0
    }]);
  };

  const removeReference = (index: number) => {
    if (references.length > 1) {
      setReferences(references.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      console.log('Creando pago pendiente...');
      const validReferences = references.map(ref => ({
        reference_number: ref.reference_number,
        date: (ref.date || new Date().toISOString().split('T')[0]) as string,
        amount: parseFloat(ref.amount),
        amount_to_use: parseFloat(ref.amount_to_use || ref.amount)
      }));
      
      const payload = {
        ...formData,
        amount_to_pay: parseFloat(formData.amount_to_pay),
        references: validReferences,
        advance_id: advancePrefill?.id ?? advanceId ?? undefined
      };

      console.log('Payload:', payload);
      const result = await actionCreatePendingPayment(payload);
      console.log('Resultado:', result);

      if (result.ok) {
        toast.success('Pago pendiente creado exitosamente');
        // Refresh automático
        onSuccess();
        // Cerrar wizard
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        console.error('Error al crear:', result.error);
        toast.error('Error al crear pago', { description: result.error });
      }
    } catch (error: any) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const totalReferences = references.reduce((sum, ref) => sum + (parseFloat(ref.amount_to_use) || 0), 0);
  const amountToPay = parseFloat(formData.amount_to_pay) || 0;
  const remainder = totalReferences - amountToPay;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Nuevo Pago Pendiente</h2>
            <p className="text-white/80 text-sm mt-1">Paso {step} de 4</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s ? 'bg-[#8AAA19] text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step > s ? <FaCheckCircle /> : s}
                </div>
                {s < 4 && (
                  <div className={`h-1 flex-1 mx-2 ${step > s ? 'bg-[#8AAA19]' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600 px-2">
            <span>Info Básica</span>
            <span>Referencias</span>
            <span>División</span>
            <span>Confirmar</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Info Básica */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, client_name: e.target.value }))}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pago <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value as any })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="poliza">Póliza</option>
                  <option value="devolucion">Devolución</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {formData.purpose === 'devolucion' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Devolución a <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="devolucion_tipo"
                          value="cliente"
                          checked={formData.devolucion_tipo === 'cliente'}
                          onChange={(e) => setFormData({ ...formData, devolucion_tipo: 'cliente' })}
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
                          onChange={(e) => setFormData({ ...formData, devolucion_tipo: 'corredor' })}
                          className="w-4 h-4 text-[#8AAA19]"
                        />
                        <span>Corredor</span>
                      </label>
                    </div>
                  </div>

                  {formData.devolucion_tipo === 'cliente' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cuenta de Banco <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.cuenta_banco}
                        onChange={createUppercaseHandler((e) => setFormData({ ...formData, cuenta_banco: e.target.value }))}
                        className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
                        placeholder="Número de cuenta del cliente"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Nombre del titular: {formData.client_name || '(ingrese cliente arriba)'}
                      </p>
                    </div>
                  )}

                  {formData.devolucion_tipo === 'corredor' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Corredor <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.broker_id}
                        onChange={(e) => {
                          const selectedBroker = brokers.find(b => b.id === e.target.value);
                          setFormData({ 
                            ...formData, 
                            broker_id: e.target.value,
                            broker_cuenta: selectedBroker?.bank_account_number || ''
                          });
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                      >
                        <option value="">Seleccionar corredor...</option>
                        {brokers.map((broker) => (
                          <option key={broker.id} value={broker.id}>{broker.name}</option>
                        ))}
                      </select>
                      {formData.broker_cuenta && (
                        <p className="text-xs text-gray-500 mt-1">
                          Cuenta: {formData.broker_cuenta}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

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
                      placeholder="POL-2024-001"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a Pagar <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_to_pay}
                  onChange={(e) => setFormData({ ...formData, amount_to_pay: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  placeholder="0.00"
                />
              </div>

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
          )}

          {/* Step 2: Referencias */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="multipleRefs"
                  checked={multipleRefs}
                  onChange={(e) => setMultipleRefs(e.target.checked)}
                  className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                />
                <label htmlFor="multipleRefs" className="text-sm font-medium text-gray-700">
                  Pagos Múltiples (varias transferencias para este pago)
                </label>
              </div>

              {references.map((ref, index) => (
                <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700">Referencia {index + 1}</h4>
                    {index > 0 && (
                      <button
                        onClick={() => removeReference(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Número de Referencia - Full width */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Referencia
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ref.reference_number}
                          onChange={createUppercaseHandler((e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              newRefs[index]!.reference_number = e.target.value;
                            }
                            setReferences(newRefs);
                          })}
                          onBlur={() => validateReference(index)}
                          className={`flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                          placeholder="1132498389"
                        />
                        {ref.validating && (
                          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <div className="animate-spin w-5 h-5 border-2 border-[#8AAA19] border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        {!ref.validating && ref.reference_number && (
                          ref.exists_in_bank ? (
                            <FaCheckCircle className="text-green-600 text-2xl flex-shrink-0" />
                          ) : (
                            <FaExclamationTriangle className="text-red-600 text-2xl flex-shrink-0" />
                          )
                        )}
                      </div>
                    </div>

                    {/* Status display */}
                    {ref.exists_in_bank && ref.status && (
                      <div>
                        {ref.status === 'exhausted' && (
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                            <p className="text-red-800 font-semibold text-sm">
                              ❌ Referencia agotada - No se puede usar
                            </p>
                            <p className="text-red-600 text-xs mt-1">
                              Esta referencia ya fue utilizada completamente (Saldo: $0.00)
                            </p>
                          </div>
                        )}
                        {ref.status === 'partial' && (
                          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                            <p className="text-amber-800 font-semibold text-sm">
                              ⚠️ Referencia parcialmente usada
                            </p>
                            <p className="text-amber-600 text-xs mt-1">
                              Monto total: ${parseFloat(ref.amount || '0').toFixed(2)} | Saldo disponible: ${ref.remaining_amount.toFixed(2)}
                            </p>
                          </div>
                        )}
                        {ref.status === 'available' && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                            <p className="text-green-800 font-semibold text-sm">
                              ✅ Referencia disponible
                            </p>
                            <p className="text-green-600 text-xs mt-1">
                              Saldo completo disponible: ${ref.remaining_amount.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fecha y Monto - Responsive Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                          type="date"
                          value={ref.date}
                          onChange={(e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              newRefs[index]!.date = e.target.value;
                            }
                            setReferences(newRefs);
                          }}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monto a Usar
                          {ref.exists_in_bank && ref.remaining_amount > 0 && (
                            <span className="text-xs text-gray-500 ml-2">
                              (máx: ${ref.remaining_amount.toFixed(2)})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ref.amount_to_use}
                          max={ref.exists_in_bank ? ref.remaining_amount : undefined}
                          onChange={(e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              const inputValue = parseFloat(e.target.value) || 0;
                              // Limit to remaining amount if exists in bank
                              if (ref.exists_in_bank && inputValue > ref.remaining_amount) {
                                newRefs[index]!.amount_to_use = ref.remaining_amount.toFixed(2);
                                toast.warning('Monto limitado al saldo disponible');
                              } else {
                                newRefs[index]!.amount_to_use = e.target.value;
                              }
                              // Also update amount if not in bank
                              if (!ref.exists_in_bank) {
                                newRefs[index]!.amount = e.target.value;
                              }
                            }
                            setReferences(newRefs);
                          }}
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          placeholder="0.00"
                          disabled={ref.status === 'exhausted'}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {multipleRefs && (
                <button
                  onClick={addReference}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8AAA19] hover:text-[#8AAA19] transition font-medium flex items-center justify-center gap-2"
                >
                  <FaPlus />
                  Agregar Otra Referencia
                </button>
              )}

              {/* Resumen de montos */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Referencias:</span>
                  <span className="font-bold">${totalReferences.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Monto a Pagar:</span>
                  <span className="font-bold">${amountToPay.toFixed(2)}</span>
                </div>
                {remainder > 0 && (
                  <div className="flex justify-between text-amber-600 pt-2 border-t">
                    <span className="font-semibold">Remanente:</span>
                    <span className="font-bold">${remainder.toFixed(2)}</span>
                  </div>
                )}
                {remainder < 0 && (
                  <div className="flex justify-between text-red-600 pt-2 border-t">
                    <span className="font-semibold">⚠️ Falta:</span>
                    <span className="font-bold">${Math.abs(remainder).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: División */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-4">
                <input
                  type="checkbox"
                  id="divideSingle"
                  checked={divideSingle}
                  onChange={(e) => setDivideSingle(e.target.checked)}
                  className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                />
                <label htmlFor="divideSingle" className="text-sm font-medium text-gray-700">
                  Dividir una sola transferencia en múltiples pagos (ej: una ref para varias pólizas)
                </label>
              </div>

              {divideSingle ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Divide el monto de una referencia en diferentes propósitos o pólizas
                  </p>
                  
                  {divisions.map((div, index) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-700">División {index + 1}</h4>
                        {index > 0 && (
                          <button
                            onClick={() => setDivisions(divisions.filter((_, i) => i !== index))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Propósito</label>
                          <select
                            value={div.purpose}
                            onChange={(e) => {
                              const newDivs = [...divisions];
                              if (newDivs[index]) {
                                newDivs[index]!.purpose = e.target.value as any;
                              }
                              setDivisions(newDivs);
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          >
                            <option value="poliza">Póliza</option>
                            <option value="devolucion">Devolución</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                          <input
                            type="number"
                            step="0.01"
                            value={div.amount}
                            onChange={(e) => {
                              const newDivs = [...divisions];
                              if (newDivs[index]) {
                                newDivs[index]!.amount = e.target.value;
                              }
                              setDivisions(newDivs);
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                            placeholder="0.00"
                          />
                        </div>
                        
                        {div.purpose === 'poliza' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Número Póliza</label>
                              <input
                                type="text"
                                value={div.policy_number || ''}
                                onChange={(e) => {
                                  const newDivs = [...divisions];
                                  if (newDivs[index]) {
                                    newDivs[index]!.policy_number = e.target.value;
                                  }
                                  setDivisions(newDivs);
                                }}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Aseguradora</label>
                              <select
                                value={div.insurer_name || ''}
                                onChange={(e) => {
                                  const newDivs = [...divisions];
                                  if (newDivs[index]) {
                                    newDivs[index]!.insurer_name = e.target.value;
                                  }
                                  setDivisions(newDivs);
                                }}
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
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => setDivisions([...divisions, { purpose: 'poliza', policy_number: '', insurer_name: '', amount: '' }])}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8AAA19] hover:text-[#8AAA19] transition font-medium flex items-center justify-center gap-2"
                  >
                    <FaPlus />
                    Agregar División
                  </button>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Divisiones:</span>
                      <span className="font-bold">
                        ${divisions.reduce((sum, div) => sum + (parseFloat(div.amount) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-700">Monto a Pagar:</span>
                      <span className="font-bold">${amountToPay.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No se dividirá la transferencia</p>
                  <p className="text-sm mt-2">Activa la opción arriba si necesitas dividir una referencia en múltiples pagos</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmación */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center mb-6">
                <FaCheckCircle className="text-[#8AAA19] text-6xl mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-[#010139]">Revisar y Confirmar</h3>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Cliente</h4>
                  <p className="text-lg font-bold text-[#010139]">{formData.client_name}</p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Tipo de Pago</h4>
                  <p className="font-medium">{formData.purpose === 'poliza' ? 'Póliza' : formData.purpose === 'devolucion' ? 'Devolución' : 'Otro'}</p>
                  {formData.policy_number && formData.insurer_name && (
                    <p className="text-sm text-gray-600">Póliza: {formData.policy_number} - {formData.insurer_name}</p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-gray-600 mb-1">Monto a Pagar</h4>
                  <p className="text-2xl font-bold text-[#8AAA19]">${amountToPay.toFixed(2)}</p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-gray-600 mb-2">Referencias ({references.length})</h4>
                  {references.map((ref, idx) => (
                    <div key={idx} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {ref.exists_in_bank ? (
                            <FaCheckCircle className="text-green-600" />
                          ) : (
                            <FaExclamationTriangle className="text-red-600" />
                          )}
                          <span className="font-mono text-sm">{ref.reference_number}</span>
                        </div>
                        <span className="font-semibold">${parseFloat(ref.amount_to_use || '0').toFixed(2)}</span>
                      </div>
                      {ref.status === 'partial' && (
                        <p className="text-xs text-amber-600 ml-6 mt-1">
                          Parcial: ${parseFloat(ref.amount_to_use || '0').toFixed(2)} de ${parseFloat(ref.amount || '0').toFixed(2)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {!references.every(r => r.exists_in_bank) && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <div className="flex gap-2">
                      <FaExclamationTriangle className="text-red-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-800">Algunas referencias no existen en banco</p>
                        <p className="text-sm text-red-700 mt-1">
                          El pago se guardará, pero no podrás marcarlo como pagado hasta actualizar el historial del banco.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between rounded-b-2xl">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Pago Pendiente'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
