'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
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
    amount: '',
    // Campos para devolución
    return_type: '' as 'client' | 'broker' | '',
    client_name: '',
    broker_id: '',
    bank_name: '',
    account_type: '',
    account_number: '',
    // Campo para otros
    description: ''
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
        .select('id, name, bank_account_no')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Error loading brokers:', error);
        toast.error('Error al cargar corredores');
        return;
      }

      if (data) {
        const normalized = data.map((broker: any) => ({
          id: broker.id,
          name: broker.name ?? 'Sin nombre',
          account_number: broker.bank_account_no ?? '',
        }));
        setBrokers(normalized);
      }
    } catch (error) {
      console.error('Error in loadBrokers:', error);
      toast.error('Error al cargar corredores');
    }
  };

  const hasFieldError = (fieldName: string) => {
    return validationErrors.some(error => error.toLowerCase().includes(fieldName.toLowerCase()));
  };

  const getInputClassName = (baseClass: string, fieldName: string) => {
    const hasError = hasFieldError(fieldName);
    return `${baseClass} ${hasError ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-[#8AAA19]'}`;
  };

  const validateStep = () => {
    const errors: string[] = [];
    
    if (step === 1) {
      if (!formData.client_name) errors.push('• Nombre del cliente');
      if (!formData.amount_to_pay) errors.push('• Monto a pagar');
      
      if (formData.purpose === 'poliza') {
        if (!formData.policy_number) errors.push('• Número de póliza');
        if (!formData.insurer_name) errors.push('• Aseguradora');
      }
      
      if (formData.purpose === 'devolucion') {
        if (formData.devolucion_tipo === 'cliente' && !formData.cuenta_banco) {
          errors.push('• Cuenta de banco del cliente');
        }
        if (formData.devolucion_tipo === 'corredor' && !formData.broker_id) {
          errors.push('• Seleccionar corredor');
        }
      }
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error('Complete los campos requeridos');
        return false;
      }
      setValidationErrors([]);
      return true;
    } else if (step === 2) {
      const amountToPay = parseFloat(formData.amount_to_pay);
      
      // Verificar que todas las referencias tengan número
      if (references.some(r => !r.reference_number)) {
        toast.error('Complete todas las referencias');
        return false;
      }
      
      // Verificar que todas las referencias tengan monto y fecha
      const incompleteRef = references.find(r => !r.amount || !r.date);
      if (incompleteRef) {
        toast.error('Complete monto y fecha de todas las referencias', {
          description: `La referencia ${incompleteRef.reference_number} necesita monto y fecha.`
        });
        return false;
      }
      
      // NOTA: Ya NO bloqueamos si la referencia no está conciliada
      // El bloqueo se hace al marcar como pagado, no al registrar
      
      // Solo advertir si alguna referencia está agotada (pero dejar continuar)
      const exhaustedRef = references.find(r => r.status === 'exhausted');
      if (exhaustedRef) {
        toast.warning('⚠️ Referencia agotada detectada', {
          description: `La referencia ${exhaustedRef.reference_number} no tiene saldo. El pago se guardará pero no podrá marcarse como pagado hasta actualizar historial banco.`
        });
      }
      
      // Advertir si el monto excede saldo disponible (pero dejar continuar)
      const overLimitRef = references.find(r => {
        if (!r.exists_in_bank) return false;
        const amountToUse = parseFloat(r.amount_to_use) || 0;
        return amountToUse > r.remaining_amount + 0.01;
      });
      
      if (overLimitRef) {
        toast.warning('⚠️ Monto excede saldo disponible', {
          description: `La referencia ${overLimitRef.reference_number} solo tiene $${overLimitRef.remaining_amount.toFixed(2)} disponibles. El pago se guardará pero verificará saldo al marcarlo como pagado.`
        });
      }
      
      // Calcular total usando amount_to_use
      const totalToUse = references.reduce((sum, ref) => sum + (parseFloat(ref.amount_to_use) || 0), 0);
      
      // Solo advertir si es insuficiente (pero dejar continuar)
      if (totalToUse < amountToPay - 0.01) {
        toast.warning('⚠️ Referencias insuficientes', {
          description: `Total referencias: $${totalToUse.toFixed(2)} - Necesario: $${amountToPay.toFixed(2)}. El pago se guardará y podrá ajustarse después.`
        });
      }
    }
    
    // Validar step 3: Divisiones (si están activas)
    if (step === 3 && divideSingle) {
      const totalDivs = divisions.reduce((sum, div) => sum + (parseFloat(div.amount) || 0), 0);
      const totalBankRefs = references.reduce((sum, ref) => sum + (parseFloat(ref.amount) || 0), 0);
      
      // Las divisiones deben ser <= total de referencias (no necesariamente iguales)
      if (totalDivs > totalBankRefs + 0.01) {
        toast.error('Error en divisiones', {
          description: `Las divisiones ($${totalDivs.toFixed(2)}) exceden el total disponible ($${totalBankRefs.toFixed(2)})`
        });
        return false;
      }
      
      if (totalDivs === 0) {
        toast.error('Debes agregar al menos una división con monto mayor a 0');
        return false;
      }
      
      // Validar que cada división tenga los campos necesarios
      for (let i = 0; i < divisions.length; i++) {
        const div = divisions[i];
        if (!div) continue;
        
        if (!div.amount || parseFloat(div.amount) <= 0) {
          toast.error(`División ${i + 1}: El monto es requerido`);
          return false;
        }
        if (div.purpose === 'poliza' && !div.policy_number) {
          toast.error(`División ${i + 1}: El número de póliza es requerido`);
          return false;
        }
        // Validar devolución
        if (div.purpose === 'devolucion') {
          if (!div.return_type || (div.return_type !== 'client' && div.return_type !== 'broker')) {
            toast.error(`División ${i + 1}: Debes seleccionar tipo de devolución (Cliente o Corredor)`);
            return false;
          }
          if (div.return_type === 'client' && !div.client_name) {
            toast.error(`División ${i + 1}: El nombre del cliente es requerido`);
            return false;
          }
          if (div.return_type === 'broker' && !div.broker_id) {
            toast.error(`División ${i + 1}: Debes seleccionar un corredor`);
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  // Debounce timer refs
  const debounceTimers = useRef<{ [key: number]: NodeJS.Timeout }>({});

  const validateReference = useCallback(async (index: number) => {
    const ref = references[index];
    if (!ref || !ref.reference_number) return;

    const newRefs = [...references];
    if (!newRefs[index]) return;
    newRefs[index].validating = true;
    setReferences(newRefs);

    try {
      const result = await actionValidateReferences([ref.reference_number]);
      if (result.ok && result.data && result.data.length > 0) {
        const validation = result.data[0];
        if (validation && newRefs[index]) {
          newRefs[index]!.exists_in_bank = validation.exists;
          
          if (validation.exists && validation.details) {
            const transferTotal = Number(validation.details.amount) || 0;
            const remaining = Number(validation.details.remaining_amount) || 0;
            const status = validation.details.status || 'available';
            const bankDate = validation.details.date;
            
            const amountToPay = parseFloat(formData.amount_to_pay) || 0;
            
            // Auto-llenar campos cuando concilia
            // amount muestra el TOTAL de la transferencia desde banco
            // amount_to_use será igual al amount_to_pay (se calcula después)
            newRefs[index]!.amount = transferTotal.toString();
            newRefs[index]!.remaining_amount = remaining;
            newRefs[index]!.status = status;
            newRefs[index]!.amount_to_use = amountToPay.toFixed(2); // Siempre el amount_to_pay
            
            // Auto-llenar fecha si está disponible
            if (bankDate) {
              newRefs[index]!.date = bankDate;
            }
            
            // Validar disponibilidad solo si es necesario
            if (amountToPay > remaining) {
              toast.warning(`Esta referencia solo tiene $${remaining.toFixed(2)} disponibles. Necesitas $${amountToPay.toFixed(2)}`);
            }
          }
        }
        if (newRefs[index]) {
          newRefs[index]!.validating = false;
        }
        setReferences(newRefs);

        if (validation) {
          if (!validation.exists) {
            toast.warning('Referencia no encontrada en banco', {
              description: 'Ingrese monto y fecha manualmente'
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
    } catch (error) {
      if (newRefs[index]) {
        newRefs[index]!.validating = false;
      }
      setReferences(newRefs);
    }
  }, [references, formData.amount_to_pay]);

  const debouncedValidateReference = useCallback((index: number) => {
    // Limpiar timer anterior
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }
    
    // Crear nuevo timer con 200ms de delay (más rápido para mejor UX)
    debounceTimers.current[index] = setTimeout(() => {
      validateReference(index);
    }, 200);
  }, [validateReference]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, []);

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
      const validReferences = references.map(ref => ({
        reference_number: ref.reference_number,
        date: (ref.date || new Date().toISOString().split('T')[0]) as string,
        amount: parseFloat(ref.amount),
        amount_to_use: parseFloat(ref.amount_to_use || ref.amount)
      }));
      
      // Preparar divisiones si están activas
      const validDivisions = divideSingle ? divisions.map(div => ({
        purpose: div.purpose,
        policy_number: div.policy_number || undefined,
        insurer_name: div.insurer_name || undefined,
        amount: parseFloat(div.amount),
        // Campos de devolución
        return_type: div.return_type || undefined,
        client_name: div.client_name || undefined,
        broker_id: div.broker_id || undefined,
        bank_name: div.bank_name || undefined,
        account_type: div.account_type || undefined,
        account_number: div.account_number || undefined,
        // Campo de otros
        description: div.description || undefined
      })) : undefined;
      
      const payload = {
        ...formData,
        amount_to_pay: parseFloat(formData.amount_to_pay),
        references: validReferences,
        divisions: validDivisions,
        advance_id: advancePrefill?.id ?? advanceId ?? undefined
      };

      const result = await actionCreatePendingPayment(payload);

      if (result.ok) {
        const message = result.message || '✅ Pago pendiente creado exitosamente';
        toast.success(message);
        // onSuccess cierra el wizard Y actualiza la lista
        onSuccess();
      } else {
        console.error('Error al crear:', result.error);
        toast.error('Error al crear pago', { description: result.error });
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error inesperado:', error);
      toast.error('Error inesperado', { description: error.message });
      setLoading(false);
    }
  };

  const totalBankReferences = references.reduce((sum, ref) => sum + (parseFloat(ref.amount) || 0), 0);
  const amountToPay = parseFloat(formData.amount_to_pay) || 0;
  const remainder = totalBankReferences - amountToPay;
  const stillNeeded = Math.max(amountToPay - totalBankReferences, 0);
  
  // Calcular monto restante para divisiones
  const totalDivisions = divisions.reduce((sum, div) => sum + (parseFloat(div.amount) || 0), 0);
  const divisionRemainder = totalBankReferences - totalDivisions;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      onClick={(e) => {
        // Cerrar solo si se hace click en el backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
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
              {/* Lista de errores de validación */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <FaExclamationTriangle className="text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-800 mb-2">Campos requeridos:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {validationErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={createUppercaseHandler((e) => {
                    setFormData({ ...formData, client_name: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  })}
                  className={getInputClassName(`w-full px-4 py-2 border-2 rounded-lg focus:outline-none ${uppercaseInputClass}`, 'cliente')}
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
                          const selectedBroker = brokers.find((b) => b.id === e.target.value);
                          setFormData({
                            ...formData,
                            broker_id: e.target.value,
                            broker_cuenta: selectedBroker?.account_number || ''
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
                  onChange={(e) => {
                    setFormData({ ...formData, amount_to_pay: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  className={getInputClassName('w-full px-4 py-2 border-2 rounded-lg focus:outline-none', 'monto')}
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
                              // Resetear estado de validación
                              newRefs[index]!.exists_in_bank = false;
                              newRefs[index]!.status = null;
                            }
                            setReferences(newRefs);
                            // Validar con debounce mientras escribe
                            if (e.target.value.trim()) {
                              debouncedValidateReference(index);
                            }
                          })}
                          onBlur={() => {
                            // Validar inmediatamente al salir del campo
                            if (ref.reference_number.trim()) {
                              validateReference(index);
                            }
                          }}
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

                    {/* Fecha y Monto Total */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha
                          {ref.exists_in_bank && (
                            <span className="text-xs text-green-600 ml-2">✓ Auto-llenado</span>
                          )}
                        </label>
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
                          className={`w-full min-w-0 px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none appearance-none ${
                            ref.exists_in_bank ? 'bg-green-50 border-green-300' : 'bg-white border-gray-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Monto Total del Banco
                          {ref.exists_in_bank && (
                            <span className="text-xs text-green-600 ml-2">✓ De banco</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={ref.amount}
                          onChange={(e) => {
                            const newRefs = [...references];
                            if (newRefs[index]) {
                              newRefs[index]!.amount = e.target.value;
                            }
                            setReferences(newRefs);
                          }}
                          disabled={ref.exists_in_bank}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${
                            ref.exists_in_bank ? 'bg-green-50 border-green-300 cursor-not-allowed' : 'bg-white border-gray-300'
                          }`}
                          placeholder="0.00"
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
                  <span className="text-gray-700">Monto a Pagar:</span>
                  <span className="font-bold text-[#010139]">${amountToPay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Cubierto:</span>
                  <span className="font-bold text-blue-600">${totalBankReferences.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between pt-2 border-t ${
                  stillNeeded === 0 ? 'text-green-600' : 'text-orange-600'
                }`}>
                  <span className="font-semibold">
                    {stillNeeded === 0 ? '✅ Estado:' : '⚠️ Falta cubrir:'}
                  </span>
                  <span className="font-bold text-lg">
                    {stillNeeded === 0 ? 'Completo' : `$${stillNeeded.toFixed(2)}`}
                  </span>
                </div>
                {remainder > 0 && (
                  <p className="text-xs text-amber-600 text-center pt-1">
                    Hay un excedente de ${remainder.toFixed(2)} que quedará disponible
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: División */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-blue-50 rounded-lg mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="divideSingle"
                    checked={divideSingle}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setDivideSingle(isChecked);
                      
                      // Pre-llenar primera división con datos del Paso 1
                      if (isChecked) {
                        const firstDivision = {
                          purpose: formData.purpose as 'poliza' | 'devolucion' | 'otro',
                          policy_number: formData.policy_number || '',
                          insurer_name: formData.insurer_name || '',
                          amount: formData.amount_to_pay || '',
                          return_type: (formData.devolucion_tipo === 'cliente' ? 'client' as const : formData.devolucion_tipo === 'corredor' ? 'broker' as const : '' as const),
                          client_name: formData.client_name || '',
                          broker_id: formData.broker_id || '',
                          bank_name: formData.cuenta_banco || '',
                          account_type: '',
                          account_number: formData.broker_cuenta || '',
                          description: formData.notes || ''
                        };
                        setDivisions([firstDivision]);
                      }
                    }}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                  />
                  <label htmlFor="divideSingle" className="text-sm font-medium text-gray-700">
                    Dividir una sola transferencia en múltiples pagos (ej: una ref para varias pólizas)
                  </label>
                </div>
                <div className="ml-7 text-xs space-y-1">
                  <p className="text-gray-600">
                    Tienes <strong className="text-blue-600">${totalBankReferences.toFixed(2)}</strong> disponibles de las referencias. Puedes dividirlos en varios pagos.
                  </p>
                  <p className="text-gray-500 italic">
                    Tip: La primera división se llena automáticamente con los datos del Paso 1.
                  </p>
                </div>
              </div>

              {divideSingle ? (
                <div className="space-y-4">
                  {/* Indicador de monto disponible */}
                  <div className={`p-3 rounded-lg border-2 ${
                    divisionRemainder === 0 ? 'bg-green-50 border-green-300' :
                    divisionRemainder > 0 ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Disponible para dividir:</span>
                      <span className={`text-2xl font-bold ${
                        divisionRemainder === 0 ? 'text-green-600' :
                        divisionRemainder > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        ${divisionRemainder.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {divisions.map((div, index) => (
                    <div key={index} className={`border-2 rounded-lg p-4 space-y-3 ${
                      index === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-700">
                          División {index + 1}
                          {index === 0 && <span className="text-xs text-blue-600 ml-2">(del Paso 1)</span>}
                        </h4>
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
                        
                        {div.purpose === 'devolucion' && (
                          <>
                            <div className="col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Devolución</label>
                              <select
                                value={div.return_type || ''}
                                onChange={(e) => {
                                  const newDivs = [...divisions];
                                  if (newDivs[index]) {
                                    newDivs[index]!.return_type = e.target.value as 'client' | 'broker' | '';
                                  }
                                  setDivisions(newDivs);
                                }}
                                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                              >
                                <option value="">Seleccionar...</option>
                                <option value="client">Cliente</option>
                                <option value="broker">Corredor</option>
                              </select>
                            </div>
                            
                            {div.return_type === 'client' && (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
                                  <input
                                    type="text"
                                    value={div.client_name || ''}
                                    onChange={(e) => {
                                      const newDivs = [...divisions];
                                      if (newDivs[index]) {
                                        newDivs[index]!.client_name = e.target.value;
                                      }
                                      setDivisions(newDivs);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                    placeholder="Nombre completo"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                                  <input
                                    type="text"
                                    value={div.bank_name || ''}
                                    onChange={(e) => {
                                      const newDivs = [...divisions];
                                      if (newDivs[index]) {
                                        newDivs[index]!.bank_name = e.target.value;
                                      }
                                      setDivisions(newDivs);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                    placeholder="Nombre del banco"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
                                  <input
                                    type="text"
                                    value={div.account_type || ''}
                                    onChange={(e) => {
                                      const newDivs = [...divisions];
                                      if (newDivs[index]) {
                                        newDivs[index]!.account_type = e.target.value;
                                      }
                                      setDivisions(newDivs);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                    placeholder="Ahorro / Corriente"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
                                  <input
                                    type="text"
                                    value={div.account_number || ''}
                                    onChange={(e) => {
                                      const newDivs = [...divisions];
                                      if (newDivs[index]) {
                                        newDivs[index]!.account_number = e.target.value;
                                      }
                                      setDivisions(newDivs);
                                    }}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                    placeholder="Número de cuenta"
                                  />
                                </div>
                              </>
                            )}
                            
                            {div.return_type === 'broker' && (
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Corredor</label>
                                <select
                                  value={div.broker_id || ''}
                                  onChange={(e) => {
                                    const newDivs = [...divisions];
                                    if (newDivs[index]) {
                                      newDivs[index]!.broker_id = e.target.value;
                                    }
                                    setDivisions(newDivs);
                                  }}
                                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                >
                                  <option value="">Seleccionar corredor...</option>
                                  {brokers.map((broker) => (
                                    <option key={broker.id} value={broker.id}>{broker.name}</option>
                                  ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                  Los datos bancarios del corredor se tomarán automáticamente del registro
                                </p>
                              </div>
                            )}
                          </>
                        )}
                        
                        {div.purpose === 'otro' && (
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <textarea
                              value={div.description || ''}
                              onChange={(e) => {
                                const newDivs = [...divisions];
                                if (newDivs[index]) {
                                  newDivs[index]!.description = e.target.value;
                                }
                                setDivisions(newDivs);
                              }}
                              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                              rows={2}
                              placeholder="Describe el concepto del pago..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => setDivisions([...divisions, { 
                      purpose: 'poliza', 
                      policy_number: '', 
                      insurer_name: '', 
                      amount: '',
                      return_type: '',
                      client_name: '',
                      broker_id: '',
                      bank_name: '',
                      account_type: '',
                      account_number: '',
                      description: ''
                    }])}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8AAA19] hover:text-[#8AAA19] transition font-medium flex items-center justify-center gap-2"
                  >
                    <FaPlus />
                    Agregar División
                  </button>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Referencias:</span>
                      <span className="font-bold text-blue-600">${totalBankReferences.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Divisiones:</span>
                      <span className="font-bold">${totalDivisions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-semibold">Monto Restante:</span>
                      <span className={`font-bold text-lg ${
                        divisionRemainder === 0 ? 'text-green-600' : 
                        divisionRemainder > 0 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        ${divisionRemainder.toFixed(2)}
                      </span>
                    </div>
                    {divisionRemainder > 0 && (
                      <p className="text-sm text-blue-600 text-center">
                        ℹ️ Quedan ${divisionRemainder.toFixed(2)} sin asignar (opcional)
                      </p>
                    )}
                    {divisionRemainder < 0 && (
                      <p className="text-sm text-red-600 text-center">
                        ❌ Has excedido el monto disponible en ${Math.abs(divisionRemainder).toFixed(2)}
                      </p>
                    )}
                    {divisionRemainder === 0 && (
                      <p className="text-sm text-green-600 text-center">
                        ✅ Has asignado todo el monto disponible
                      </p>
                    )}
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

                {divideSingle && divisions.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-gray-600 mb-2">Divisiones Realizadas ({divisions.length})</h4>
                    <div className="space-y-2">
                      {divisions.map((div, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border-2 border-blue-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[#010139]">
                              {div.purpose === 'poliza' ? '📄 Póliza' : div.purpose === 'devolucion' ? '💰 Devolución' : '📌 Otro'}
                            </span>
                            <span className="text-lg font-bold text-[#8AAA19]">${parseFloat(div.amount || '0').toFixed(2)}</span>
                          </div>
                          {div.purpose === 'poliza' && (
                            <p className="text-sm text-gray-600">
                              Póliza: {div.policy_number} - {div.insurer_name}
                            </p>
                          )}
                          {div.purpose === 'devolucion' && (
                            <p className="text-sm text-gray-600">
                              {div.return_type === 'client' ? `Cliente: ${div.client_name}` : `Corredor: ${brokers.find(b => b.id === div.broker_id)?.name || 'N/A'}`}
                              {div.return_type === 'client' && div.bank_name && ` - ${div.bank_name}`}
                            </p>
                          )}
                          {div.purpose === 'otro' && (
                            <p className="text-sm text-gray-600">{div.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total Divisiones:</span>
                      <span className="text-xl font-bold text-blue-600">${totalDivisions.toFixed(2)}</span>
                    </div>
                  </div>
                )}

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
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                    <div className="flex gap-2">
                      <FaExclamationTriangle className="text-amber-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-900">⚠️ Referencias sin conciliar</p>
                        <p className="text-sm text-amber-800 mt-1">
                          El pago se guardará correctamente. No podrás marcarlo como pagado hasta que se importe el historial del banco con estas referencias.
                        </p>
                        <p className="text-xs text-amber-700 mt-2 italic">
                          ✨ La conciliación es automática: al importar historial banco, los pagos pendientes se actualizan y habilitan para marcar como pagados.
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
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              step > 1 ? setStep(step - 1) : onClose();
            }}
            disabled={loading}
            className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium touch-manipulation disabled:opacity-50"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }}
              disabled={loading}
              className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium touch-manipulation disabled:opacity-50"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading) {
                  handleSubmit();
                }
              }}
              disabled={loading}
              className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
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
