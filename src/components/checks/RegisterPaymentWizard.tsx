'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaTimes, FaCheckCircle, FaExclamationTriangle, FaPlus, FaTrash, FaRecycle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionCreatePendingPayment, actionValidateReferences, actionGetInsurers } from '@/app/(app)/checks/actions';
import { actionFindOrphanAdvances, actionRecoverOrphanAdvance, type OrphanAdvance } from '@/app/(app)/checks/orphan-advances';
import { toUppercasePayload, createUppercaseHandler, createBankSafeHandler, sanitizePolicyNumber, generateEmisionWebPolicy, uppercaseInputClass } from '@/lib/utils/uppercase';
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
    banco_nombre: '',
    tipo_cuenta: '',
    broker_id: '',
    broker_cuenta: ''
  });

  // Step 1: Emisión Web
  const [isEmisionWeb, setIsEmisionWeb] = useState(false);

  // Step 2: Referencias
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'broker_deduct' | 'other_bank'>('bank_transfer');
  const [isDeductFromBroker, setIsDeductFromBroker] = useState(false);
  const [isOtherBank, setIsOtherBank] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [deductMode, setDeductMode] = useState<'full' | 'partial'>('full');
  const [partialDeductAmount, setPartialDeductAmount] = useState('');
  
  // Adelantos huérfanos - sistema de recuperación
  const [orphanAdvances, setOrphanAdvances] = useState<OrphanAdvance[]>([]);
  const [selectedOrphanAdvance, setSelectedOrphanAdvance] = useState<string | null>(null);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
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
  const [sameClient, setSameClient] = useState(true); // Nuevo: controla si es el mismo cliente
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

  // Cargar adelantos huérfanos cuando se selecciona un broker
  useEffect(() => {
    if (isDeductFromBroker && selectedBrokerId) {
      loadOrphanAdvances(selectedBrokerId);
    } else {
      setOrphanAdvances([]);
      setSelectedOrphanAdvance(null);
    }
  }, [selectedBrokerId, isDeductFromBroker]);

  const loadOrphanAdvances = async (brokerId: string) => {
    setLoadingOrphans(true);
    try {
      const result = await actionFindOrphanAdvances(brokerId);
      if (result.ok) {
        setOrphanAdvances(result.data || []);
        if (result.data && result.data.length > 0) {
          toast.info(`Se encontraron ${result.data.length} adelanto(s) huérfano(s) disponibles para recuperar`, {
            duration: 5000
          });
        }
      } else {
        console.error('Error loading orphan advances:', result.error);
      }
    } catch (error) {
      console.error('Error in loadOrphanAdvances:', error);
    } finally {
      setLoadingOrphans(false);
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
      
      // Si es descuento a corredor, validar broker seleccionado
      if (isDeductFromBroker) {
        if (!selectedBrokerId) {
          toast.error('Seleccione un corredor');
          return false;
        }

        // Si es descuento parcial, validar monto y referencias
        if (deductMode === 'partial') {
          const discount = parseFloat(partialDeductAmount) || 0;

          if (discount <= 0 || discount > amountToPay + 0.01) {
            toast.error('Monto de descuento inválido', {
              description: 'El descuento debe ser mayor a 0 y menor o igual al monto total'
            });
            return false;
          }

          const remaining = amountToPay - discount;
          if (remaining <= 0.01) {
            toast.error('El restante a conciliar por banco debe ser mayor a 0');
            return false;
          }

          // Continuar validando referencias para el resto bancario
          // (las validaciones de referencias siguen después de este bloque)
        } else {
          // Descuento 100% - no necesita referencias
          return true;
        }
      }
      
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
      
      // BLOQUEO CRÍTICO: Verificar si alguna referencia está bloqueada por pagos pendientes
      const blockedRef = references.find(r => (r as any).blocked === true);
      if (blockedRef) {
        const blockReason = (blockedRef as any).block_reason || 'Esta referencia ya está siendo usada por otros pagos pendientes';
        const pendingPayments = (blockedRef as any).pending_payments || [];
        const paymentsList = pendingPayments
          .map((p: any) => `  • ${p.client_name}: $${Number(p.amount_to_use).toFixed(2)}`)
          .join('\n');
        
        toast.error('🚫 No puedes continuar', {
          description: `La referencia ${blockedRef.reference_number} está bloqueada:\n\n${blockReason}\n\nPagos que la están usando:\n${paymentsList}\n\nDebes pagar o cancelar esos pagos primero.`,
          duration: 12000
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
      
      // Solo validar contra referencias si NO es descuento a corredor
      // Cuando es descuento a corredor, cada división crea su propio adelanto sin límite
      if (!isDeductFromBroker) {
        const totalBankRefs = references.reduce((sum, ref) => sum + (parseFloat(ref.amount) || 0), 0);
        
        // Las divisiones deben ser <= total de referencias (no necesariamente iguales)
        if (totalDivs > totalBankRefs + 0.01) {
          toast.error('Error en divisiones', {
            description: `Las divisiones ($${totalDivs.toFixed(2)}) exceden el total disponible ($${totalBankRefs.toFixed(2)})`
          });
          return false;
        }
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
        // Validar client_name cuando no es el mismo cliente
        if (!sameClient && !div.client_name) {
          toast.error(`División ${i + 1}: El nombre del cliente es requerido`);
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

  // Debounce timer refs and abort controllers
  const debounceTimers = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const validationControllers = useRef<{ [key: number]: AbortController }>({});

  const validateReference = useCallback(async (index: number) => {
    const ref = references[index];
    if (!ref || !ref.reference_number) return;

    // Cancelar validación anterior si existe
    if (validationControllers.current[index]) {
      validationControllers.current[index].abort();
    }

    const newRefs = [...references];
    if (!newRefs[index]) return;
    newRefs[index].validating = true;
    setReferences(newRefs);

    // Crear nuevo AbortController para esta validación
    const controller = new AbortController();
    validationControllers.current[index] = controller;

    // Timeout de 5 segundos
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const result = await actionValidateReferences([ref.reference_number]);
      
      // Limpiar timeout si la validación terminó antes
      clearTimeout(timeoutId);
      
      // Verificar si fue abortada
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok && result.data && result.data.length > 0) {
        const validation = result.data[0];
        const currentRefs = [...references];
        
        if (validation && currentRefs[index]) {
          currentRefs[index]!.exists_in_bank = validation.exists;
          
          if (validation.exists && validation.details) {
            const transferTotal = Number(validation.details.amount) || 0;
            const remaining = Number(validation.details.remaining_amount) || 0;
            const availableAfterPending = Number(validation.details.available_after_pending) || remaining;
            const pendingUsed = Number(validation.details.pending_used_amount) || 0;
            const status = validation.details.status || 'available';
            const blocked = validation.details.blocked || false;
            const blockReason = validation.details.block_reason;
            const pendingPayments = validation.details.pending_payments || [];
            const bankDate = validation.details.date;
            
            // Auto-llenar campos cuando concilia
            currentRefs[index]!.amount = transferTotal.toString();
            currentRefs[index]!.remaining_amount = remaining;
            currentRefs[index]!.status = blocked ? 'blocked_by_pending' : status;
            
            // Guardar info de bloqueo en el estado
            if (blocked) {
              (currentRefs[index] as any).blocked = true;
              (currentRefs[index] as any).block_reason = blockReason;
              (currentRefs[index] as any).pending_payments = pendingPayments;
            }
            
            // Auto-llenar fecha si está disponible
            if (bankDate) {
              currentRefs[index]!.date = bankDate;
            }
            
            // Validar disponibilidad considerando pagos pendientes
            if (!blocked && parseFloat(formData.amount_to_pay) > availableAfterPending) {
              if (pendingUsed > 0) {
                toast.warning(`Esta referencia tiene $${availableAfterPending.toFixed(2)} disponibles (descontando $${pendingUsed.toFixed(2)} de pagos pendientes). Necesitas $${parseFloat(formData.amount_to_pay).toFixed(2)}`);
              } else {
                toast.warning(`Esta referencia solo tiene $${remaining.toFixed(2)} disponibles. Necesitas $${parseFloat(formData.amount_to_pay).toFixed(2)}`);
              }
            }
          }
          
          currentRefs[index]!.validating = false;
          setReferences(currentRefs);

          // Notificaciones
          if (!validation.exists) {
            toast.warning('Referencia no encontrada en banco', {
              description: 'Ingrese monto y fecha manualmente'
            });
          } else if (validation.details?.blocked) {
            const pendingPayments = validation.details.pending_payments || [];
            const pendingUsed = Number(validation.details.pending_used_amount) || 0;
            const paymentsList = pendingPayments
              .map((p: any) => `• ${p.client_name}: $${Number(p.amount_to_use).toFixed(2)}`)
              .join('\n');
            
            toast.error('🚫 Referencia bloqueada por pagos pendientes', {
              description: `Reservado: $${pendingUsed.toFixed(2)}\n\nPagos pendientes:\n${paymentsList}\n\nNo puedes usar esta referencia hasta que se paguen o cancelen estos pagos.`,
              duration: 10000
            });
          } else if (validation.details?.status === 'exhausted') {
            toast.error('❌ Referencia agotada', {
              description: 'Esta referencia ya fue usada completamente y no tiene saldo disponible'
            });
          } else if (validation.details?.status === 'partial') {
            const remaining = Number(validation.details.remaining_amount) || 0;
            const availableAfterPending = Number(validation.details.available_after_pending) || remaining;
            const pendingUsed = Number(validation.details.pending_used_amount) || 0;
            
            if (pendingUsed > 0) {
              toast.warning('⚠️ Referencia parcialmente usada con pagos pendientes', {
                description: `Banco: $${remaining.toFixed(2)} | Reservado por pendientes: $${pendingUsed.toFixed(2)} | Disponible: $${availableAfterPending.toFixed(2)}`,
                duration: 7000
              });
            } else {
              toast.success('⚠️ Referencia parcialmente usada', {
                description: `Saldo disponible: $${remaining.toFixed(2)}`
              });
            }
          } else {
            const pendingUsed = Number(validation.details?.pending_used_amount) || 0;
            if (pendingUsed > 0) {
              const availableAfterPending = Number(validation.details.available_after_pending) || 0;
              toast.success('✅ Referencia válida con pagos pendientes', {
                description: `Reservado: $${pendingUsed.toFixed(2)} | Disponible: $${availableAfterPending.toFixed(2)}`
              });
            } else {
              toast.success('✅ Referencia válida');
            }
          }
        }
      } else {
        const currentRefs = [...references];
        if (currentRefs[index]) {
          currentRefs[index]!.validating = false;
          setReferences(currentRefs);
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // No mostrar error si fue abortado intencionalmente
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      
      const currentRefs = [...references];
      if (currentRefs[index]) {
        currentRefs[index]!.validating = false;
        currentRefs[index]!.exists_in_bank = false;
        setReferences(currentRefs);
      }
      
      toast.error('Error al validar referencia', {
        description: 'Intente nuevamente'
      });
    } finally {
      // Limpiar el controller
      delete validationControllers.current[index];
    }
  }, [references, formData.amount_to_pay]);

  const debouncedValidateReference = useCallback((index: number) => {
    // Cancelar validación en curso
    if (validationControllers.current[index]) {
      validationControllers.current[index].abort();
      delete validationControllers.current[index];
    }
    
    // Limpiar timer anterior
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }
    
    // Resetear estado de validating inmediatamente
    const newRefs = [...references];
    if (newRefs[index]) {
      newRefs[index]!.validating = false;
      setReferences(newRefs);
    }
    
    // Crear nuevo timer con 300ms de delay (reducido para mejor UX)
    debounceTimers.current[index] = setTimeout(() => {
      validateReference(index);
    }, 300);
  }, [validateReference, references]);

  // Cleanup timers and controllers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    const controllers = validationControllers.current;
    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
      Object.values(controllers).forEach((controller: AbortController) => controller.abort());
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
      let validReferences;
      let isDeductPayment = false;
      const totalAmount = parseFloat(formData.amount_to_pay) || 0;
      
      // Calcular monto de descuento y tipo
      const discountAmount = isDeductFromBroker && deductMode === 'partial'
        ? parseFloat(partialDeductAmount) || 0
        : isDeductFromBroker && deductMode === 'full'
        ? totalAmount
        : 0;

      const discountType = isDeductFromBroker && deductMode === 'partial'
        ? 'partial'
        : isDeductFromBroker
        ? 'full'
        : undefined;
      
      // Si es descuento a corredor FULL (100%), crear referencia sintética
      if (isDeductFromBroker && selectedBrokerId && deductMode === 'full') {
        const broker = brokers.find(b => b.id === selectedBrokerId);
        const brokerName = broker?.name || 'CORREDOR';
        
        validReferences = [{
          reference_number: `DESCUENTO-${Date.now()}`,
          date: new Date().toISOString().split('T')[0] as string,
          amount: totalAmount,
          amount_to_use: totalAmount
        }];
        
        isDeductPayment = true;
      } else {
        // Para descuento parcial o pago normal, calcular monto a cubrir con banco
        const amountToCoverByBank = isDeductFromBroker && deductMode === 'partial'
          ? totalAmount - discountAmount
          : totalAmount;
        const refsWithAmount = references
          .map((ref, index) => ({
            index,
            reference_number: ref.reference_number,
            date: (ref.date || new Date().toISOString().split('T')[0]) as string,
            amount: parseFloat(ref.amount) || 0,
          }))
          .filter(r => r.amount > 0);

        // Si no hay montos válidos, no cambiamos la lógica original y dejamos que el backend valide
        if (refsWithAmount.length === 0) {
          validReferences = references.map(ref => ({
            reference_number: ref.reference_number,
            date: (ref.date || new Date().toISOString().split('T')[0]) as string,
            amount: parseFloat(ref.amount),
            amount_to_use: parseFloat(ref.amount_to_use || ref.amount)
          }));
        } else {
          // Shuffle aleatorio de las referencias para decidir cuál dejar con excedente
          const shuffled = [...refsWithAmount];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i]!;
            shuffled[i] = shuffled[j]!;
            shuffled[j] = temp;
          }

          let remainingToAllocate = amountToCoverByBank;
          const allocationMap: { [idx: number]: { amount: number; amount_to_use: number } } = {};
          const allocationDetails: string[] = [];
          
          // Marcar como pago de descuento si es parcial
          if (isDeductFromBroker && deductMode === 'partial') {
            isDeductPayment = true;
          }

          for (const item of shuffled) {
            if (remainingToAllocate <= 0) {
              allocationMap[item.index] = {
                amount: item.amount,
                amount_to_use: 0,
              };
              continue;
            }

            if (item.amount <= remainingToAllocate + 0.0001) {
              // Consumir la referencia completa
              allocationMap[item.index] = {
                amount: item.amount,
                amount_to_use: item.amount,
              };
              remainingToAllocate -= item.amount;
              allocationDetails.push(`REF ${item.reference_number}: USADO COMPLETO $${item.amount.toFixed(2)}`);
            } else {
              // Solo usar lo necesario y dejar excedente en esta referencia
              const amountToUse = remainingToAllocate;
              const excess = item.amount - amountToUse;
              allocationMap[item.index] = {
                amount: item.amount,
                amount_to_use: amountToUse,
              };
              remainingToAllocate = 0;
              allocationDetails.push(
                `REF ${item.reference_number}: USADO $${amountToUse.toFixed(2)} (EXCEDENTE $${excess.toFixed(2)})`
              );
            }
          }

          // Construir validReferences respetando el orden original de "references"
          validReferences = references.map((ref, idx) => {
            const alloc = allocationMap[idx];
            const baseAmount = parseFloat(ref.amount) || 0;
            const amount = alloc ? alloc.amount : baseAmount;
            const amount_to_use = alloc ? alloc.amount_to_use : 0;

            return {
              reference_number: ref.reference_number,
              date: (ref.date || new Date().toISOString().split('T')[0]) as string,
              amount,
              amount_to_use,
            };
          });

          // Anexar detalle de uso de referencias a las notas del formulario para que viaje al backend
          if (allocationDetails.length > 0) {
            const allocationNote = `REFS: ${allocationDetails.join(' | ')}`;
            formData.notes = formData.notes
              ? `${formData.notes} | ${allocationNote}`
              : allocationNote;
          }
        }
      }
      
      // Preparar divisiones si están activas
      const validDivisions = divideSingle ? divisions.map((div, index) => {
        console.log(`[Division ${index + 1}] client_name en div:`, div.client_name);
        console.log(`[Division ${index + 1}] sameClient:`, sameClient);
        console.log(`[Division ${index + 1}] formData.client_name:`, formData.client_name);
        
        const divisionData = {
          purpose: div.purpose,
          policy_number: div.policy_number || undefined,
          insurer_name: div.insurer_name || undefined,
          amount: parseFloat(div.amount),
          // Campos de devolución
          return_type: div.return_type || undefined,
          // Si es mismo cliente, usar el del formulario principal, si no, usar el de la división
          client_name: sameClient ? formData.client_name : (div.client_name || undefined),
          broker_id: div.broker_id || undefined,
          bank_name: div.bank_name || undefined,
          account_type: div.account_type || undefined,
          account_number: div.account_number || undefined,
          // Campo de otros
          description: div.description || undefined
        };
        
        console.log(`[Division ${index + 1}] client_name final:`, divisionData.client_name);
        return divisionData;
      }) : undefined;
      
      console.log('[Divisions] validDivisions completo:', validDivisions);
      
      const payload = {
        ...formData,
        amount_to_pay: totalAmount,
        references: validReferences,
        divisions: validDivisions,
        advance_id: advancePrefill?.id ?? advanceId ?? undefined,
        is_broker_deduction: isDeductPayment,
        deduction_broker_id: isDeductPayment ? selectedBrokerId : undefined,
        discount_type: discountType as 'full' | 'partial' | undefined,
        discount_amount: discountAmount || undefined,
        orphan_advance_id: selectedOrphanAdvance || undefined, // ID del adelanto huérfano a recuperar
        is_other_bank: isOtherBank || undefined // Marcar como otro banco/depósito
      };

      const result = await actionCreatePendingPayment(payload);

      if (result.ok) {
        // Si se seleccionó un adelanto huérfano, recuperarlo y asociarlo a este pago
        const paymentId = result.data && result.data[0]?.id;
        if (selectedOrphanAdvance && paymentId) {
          console.log(`🔄 Recuperando adelanto huérfano ${selectedOrphanAdvance} para pago ${paymentId}`);
          
          const recoveryResult = await actionRecoverOrphanAdvance(
            selectedOrphanAdvance,
            paymentId,
            formData.client_name
          );
          
          if (recoveryResult.ok) {
            toast.success('✅ Pago creado y adelanto huérfano recuperado exitosamente', {
              description: recoveryResult.message,
              duration: 6000
            });
          } else {
            console.error('Error recuperando adelanto huérfano:', recoveryResult.error);
            toast.warning('Pago creado pero no se pudo recuperar el adelanto', {
              description: recoveryResult.error,
              duration: 6000
            });
          }
        } else {
          const message = result.message || '✅ Pago pendiente creado exitosamente';
          toast.success(message);
        }
        
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
    } finally {
      setLoading(false);
    }
  };

  const totalBankReferences = references.reduce((sum, ref) => {
    const amountToUse = parseFloat(String((ref as any).amount_to_use ?? ''));
    const amount = parseFloat(String((ref as any).amount ?? ''));
    const value = Number.isFinite(amountToUse) ? amountToUse : (Number.isFinite(amount) ? amount : 0);
    return sum + value;
  }, 0);
  const amountToPay = parseFloat(formData.amount_to_pay) || 0;
  const remainder = totalBankReferences - amountToPay;
  const stillNeeded = Math.max(amountToPay - totalBankReferences, 0);
  
  // Calcular monto restante para divisiones
  const totalDivisions = divisions.reduce((sum, div) => sum + (parseFloat(div.amount) || 0), 0);
  
  // Si es descuento a corredor, no hay límite de monto en divisiones (cada una crea su adelanto)
  // Solo mostramos el total de divisiones sin comparar contra referencias
  const divisionRemainder = isDeductFromBroker ? 0 : (totalBankReferences - totalDivisions);

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
                  onChange={createBankSafeHandler((e) => {
                    setFormData({ ...formData, client_name: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  })}
                  className={getInputClassName(`w-full px-4 py-2 border-2 rounded-lg focus:outline-none ${uppercaseInputClass}`, 'cliente')}
                  placeholder="NOMBRE DEL CLIENTE"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ Sin ñ, acentos ni caracteres especiales (requisito bancario)
                </p>
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
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Banco <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.banco_nombre}
                          onChange={createBankSafeHandler((e) => setFormData({ ...formData, banco_nombre: e.target.value }))}
                          className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
                          placeholder="BANCO GENERAL"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            onChange={createBankSafeHandler((e) => setFormData({ ...formData, cuenta_banco: e.target.value }))}
                            className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
                            placeholder="NUMERO DE CUENTA"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                        📝 <strong>Titular:</strong> {formData.client_name || '(ingrese cliente arriba)'}
                      </p>
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
                  {/* Aseguradora primero para mobile-first */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aseguradora <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.insurer_name}
                      onChange={(e) => {
                        setFormData({ ...formData, insurer_name: e.target.value });
                        if (isEmisionWeb) setIsEmisionWeb(false);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {insurers.map((ins) => (
                        <option key={ins.id} value={ins.name}>{ins.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Checkbox Emisión Web */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEmisionWeb}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsEmisionWeb(checked);
                          if (checked) {
                            setFormData({ ...formData, policy_number: generateEmisionWebPolicy() });
                          } else {
                            setFormData({ ...formData, policy_number: '' });
                          }
                        }}
                        className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">🌐 Emisión Web</span>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Autocompleta con "EMISION WEB" y la fecha de hoy
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Número de Póliza */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Póliza <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.policy_number}
                      onChange={(e) => {
                        const sanitized = sanitizePolicyNumber(e.target.value, formData.insurer_name);
                        setFormData({ ...formData, policy_number: sanitized });
                      }}
                      disabled={isEmisionWeb}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none ${uppercaseInputClass} ${
                        isEmisionWeb ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}
                      placeholder={
                        formData.insurer_name?.toUpperCase().includes('LA REGIONAL') || 
                        formData.insurer_name?.toUpperCase().includes('REGIONAL')
                          ? 'POL2024001 (sin guiones)'
                          : 'POL-2024-001'
                      }
                    />
                    {(formData.insurer_name?.toUpperCase().includes('LA REGIONAL') || 
                      formData.insurer_name?.toUpperCase().includes('REGIONAL')) && !isEmisionWeb && (
                      <p className="text-xs text-amber-600 mt-1 font-medium">
                        ⚠️ La Regional: No permite guiones (-)
                      </p>
                    )}
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
                  onWheel={(e) => e.currentTarget.blur()}
                  className={getInputClassName('w-full px-4 py-2 border-2 rounded-lg focus:outline-none', 'monto')}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={createBankSafeHandler((e) => setFormData({ ...formData, notes: e.target.value }))}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                  rows={2}
                  placeholder="INFORMACION ADICIONAL (OPCIONAL)"
                />
              </div>
            </div>
          )}

          {/* Step 2: Referencias */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Header del paso */}
              <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border-l-4 border-[#010139]">
                <h3 className="text-lg font-bold text-[#010139] mb-1">💳 Método de Pago</h3>
                <p className="text-sm text-gray-600">Indica cómo se realizará o registrará este pago</p>
              </div>

              {/* Selector de método de pago */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-3">¿Cómo deseas registrar este pago?</p>
                
                {/* Opción 1: Transferencia Bancaria */}
                <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-[#8AAA19] bg-[#8AAA19]/5' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => {
                      setPaymentMethod('bank_transfer');
                      setIsDeductFromBroker(false);
                      setIsOtherBank(false);
                    }}
                    className="mt-1 w-5 h-5 text-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#010139]">
                      🏦 Transferencia Bancaria
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Conciliar con referencia(s) bancaria(s). Ideal para pagos que ya están en el banco.
                    </p>
                  </div>
                </label>

                {/* Opción 2: Otro Banco/Depósitos */}
                <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'other_bank'
                    ? 'border-amber-500 bg-amber-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'other_bank'}
                    onChange={() => {
                      setPaymentMethod('other_bank');
                      setIsDeductFromBroker(false);
                      setIsOtherBank(true);
                      setMultipleRefs(false);
                      // Crear referencia temporal con fecha y monto
                      setReferences([{
                        reference_number: `TEMP-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        amount: formData.amount_to_pay || '',
                        amount_to_use: formData.amount_to_pay || '',
                        exists_in_bank: false,
                        validating: false,
                        status: null,
                        remaining_amount: 0
                      }]);
                    }}
                    className="mt-1 w-5 h-5 text-amber-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#010139]">
                      🏪 Otro Banco/Depósitos
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Para pagos de otro banco o depósitos donde aún no tienes el número de referencia. Registra la fecha y monto de la transferencia.
                    </p>
                  </div>
                </label>

                {/* Opción 3: Descuento a Corredor */}
                <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'broker_deduct'
                    ? 'border-[#8AAA19] bg-[#8AAA19]/5' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'broker_deduct'}
                    onChange={() => {
                      setPaymentMethod('broker_deduct');
                      setIsDeductFromBroker(true);
                      setIsOtherBank(false);
                      // Limpiar referencias cuando se activa descuento
                      setMultipleRefs(false);
                      setReferences([{
                        reference_number: '',
                        date: new Date().toISOString().split('T')[0],
                        amount: '',
                        amount_to_use: '',
                        exists_in_bank: false,
                        validating: false,
                        status: null,
                        remaining_amount: 0
                      }]);
                    }}
                    className="mt-1 w-5 h-5 text-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#010139]">
                      💰 Descuento a Corredor
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Se crea un adelanto automático que se descuenta de las comisiones del corredor (sin transferencia bancaria).
                    </p>
                  </div>
                </label>
              </div>

              {/* Info para Otro Banco con campos de fecha y monto */}
              {isOtherBank && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-amber-600 text-2xl">⚠️</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-1">Registro Temporal</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Este pago quedará marcado como "Pendiente de conciliar" hasta que actualices el número de referencia bancaria correcto. 
                        Registra la fecha y monto de la transferencia/depósito.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de Transferencia <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={references[0]?.date || ''}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[0]) {
                            newRefs[0].date = e.target.value;
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto Transferido <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={references[0]?.amount || ''}
                        onChange={(e) => {
                          const newRefs = [...references];
                          if (newRefs[0]) {
                            newRefs[0].amount = e.target.value;
                            newRefs[0].amount_to_use = e.target.value;
                            setReferences(newRefs);
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Opción de pagos múltiples (solo para transferencia bancaria) */}
              {!isDeductFromBroker && !isOtherBank && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="multipleRefs"
                    checked={multipleRefs}
                    onChange={(e) => setMultipleRefs(e.target.checked)}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                  />
                  <label htmlFor="multipleRefs" className="text-sm font-medium text-gray-700 cursor-pointer">
                    📊 Usar múltiples referencias bancarias (varias transferencias para cubrir este pago)
                  </label>
                </div>
              )}

              {/* Configuración de Descuento a Corredor */}
              {isDeductFromBroker && (
                <div className="bg-gradient-to-br from-[#8AAA19]/5 to-[#8AAA19]/10 border-2 border-[#8AAA19]/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#8AAA19] rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">1</span>
                    </div>
                    <h4 className="text-base font-bold text-[#010139]">Selecciona el Corredor</h4>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Corredor a descontar <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedBrokerId}
                      onChange={(e) => setSelectedBrokerId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-base bg-white"
                    >
                      <option value="">Seleccione un corredor...</option>
                      {brokers.map((broker) => (
                        <option key={broker.id} value={broker.id}>
                          {broker.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Adelantos Huérfanos Disponibles para Recuperar */}
                  {selectedBrokerId && orphanAdvances.length > 0 && (
                    <div className="mt-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                      <div className="flex items-start gap-3 mb-3">
                        <FaRecycle className="text-orange-600 text-xl mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-orange-900 mb-1">
                            🔄 Adelantos Huérfanos Disponibles ({orphanAdvances.length})
                          </h4>
                          <p className="text-xs text-orange-700 leading-relaxed">
                            Se encontraron adelantos que ya fueron descontados pero quedaron sin pago pendiente asociado (probablemente borrados por error). 
                            Puedes recuperar uno de estos adelantos para asociarlo a este nuevo pago.
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {orphanAdvances.map((advance) => (
                          <label
                            key={advance.id}
                            className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedOrphanAdvance === advance.id
                                ? 'border-[#8AAA19] bg-[#8AAA19]/10'
                                : 'border-orange-200 bg-white hover:border-orange-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="orphan_advance"
                              value={advance.id}
                              checked={selectedOrphanAdvance === advance.id}
                              onChange={() => setSelectedOrphanAdvance(advance.id)}
                              className="mt-1 w-4 h-4 text-[#8AAA19]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold text-[#010139]">
                                  ${advance.amount.toFixed(2)}
                                </p>
                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {new Date(advance.created_at).toLocaleDateString('es-PA')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 truncate">
                                {advance.reason || 'Sin descripción'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                                  ✓ Descontado: ${advance.total_paid.toFixed(2)}
                                </span>
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium">
                                  {advance.status}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      
                      {selectedOrphanAdvance && (
                        <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                          <p className="text-sm text-green-800 font-semibold">
                            ✅ Adelanto seleccionado será recuperado
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Este adelanto (que ya fue descontado) se asociará a este nuevo pago pendiente. 
                            NO se creará un nuevo adelanto, se recuperará el existente.
                          </p>
                        </div>
                      )}
                      
                      {!selectedOrphanAdvance && (
                        <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                          <p className="text-xs text-blue-700">
                            💡 <strong>Opcional:</strong> Si no seleccionas ninguno, se creará un nuevo adelanto normal. 
                            Selecciona uno solo si quieres recuperar un adelanto que quedó huérfano por error.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedBrokerId && loadingOrphans && (
                    <div className="mt-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg flex items-center justify-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-[#8AAA19] border-t-transparent rounded-full"></div>
                      <span className="text-sm text-gray-600">Buscando adelantos huérfanos...</span>
                    </div>
                  )}
                  
                  {selectedBrokerId && (
                    <>
                      <div className="border-t-2 border-[#8AAA19]/20 pt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-[#8AAA19] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">2</span>
                          </div>
                          <h4 className="text-base font-bold text-[#010139]">Tipo de Descuento</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Opción: Descuento 100% */}
                          <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            deductMode === 'full'
                              ? 'border-[#8AAA19] bg-white shadow-md'
                              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }`}>
                            <input
                              type="radio"
                              name="deduct_mode"
                              value="full"
                              checked={deductMode === 'full'}
                              onChange={() => setDeductMode('full')}
                              className="mt-0.5 w-5 h-5 text-[#8AAA19]"
                            />
                            <div>
                              <p className="text-sm font-bold text-[#010139]">100% Descuento</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Todo el monto se descuenta al corredor
                              </p>
                            </div>
                          </label>

                          {/* Opción: Descuento Parcial */}
                          <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            deductMode === 'partial'
                              ? 'border-[#8AAA19] bg-white shadow-md'
                              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          }`}>
                            <input
                              type="radio"
                              name="deduct_mode"
                              value="partial"
                              checked={deductMode === 'partial'}
                              onChange={() => setDeductMode('partial')}
                              className="mt-0.5 w-5 h-5 text-[#8AAA19]"
                            />
                            <div>
                              <p className="text-sm font-bold text-[#010139]">Descuento Parcial</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Parte se descuenta y parte se paga por banco
                              </p>
                            </div>
                          </label>
                        </div>

                        {deductMode === 'partial' && (
                          <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Monto a descontar al corredor <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={partialDeductAmount}
                                  onChange={(e) => setPartialDeductAmount(e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="flex items-end">
                                <div className="w-full p-3 bg-white border-2 border-gray-200 rounded-lg">
                                  <p className="text-xs text-gray-600">Restante a conciliar por banco:</p>
                                  <p className="text-lg font-bold text-[#010139]">
                                    ${Math.max(
                                      0,
                                      (parseFloat(formData.amount_to_pay || '0') || 0) -
                                        (parseFloat(partialDeductAmount || '0') || 0),
                                    ).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-blue-700">
                              💡 El monto que descontes al corredor se registrará como adelanto. El restante se conciliará con referencias bancarias.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
                        <p className="text-sm text-green-800">
                          ✅ Este pago se descontará de las comisiones de <strong>{brokers.find(b => b.id === selectedBrokerId)?.name}</strong>
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Se creará un adelanto por <strong>
                            ${deductMode === 'partial' 
                              ? (parseFloat(partialDeductAmount || '0') || 0).toFixed(2)
                              : amountToPay.toFixed(2)
                            }
                          </strong> que se descontará en la próxima quincena
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Sección de Referencias Bancarias */}
              {(!isDeductFromBroker || (isDeductFromBroker && deductMode === 'partial')) && (
                <>
                  <div className="bg-gradient-to-r from-blue-50 to-white p-4 rounded-lg border-l-4 border-blue-600">
                    <h3 className="text-lg font-bold text-[#010139] mb-1">
                      {isDeductFromBroker && deductMode === 'partial' ? '💰 Referencias para el Monto Restante' : '🏦 Referencias Bancarias'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {isDeductFromBroker && deductMode === 'partial' 
                        ? 'Ingresa la(s) referencia(s) bancaria(s) para cubrir el monto que NO se descuenta al corredor'
                        : 'Ingresa la(s) referencia(s) de transferencia(s) bancaria(s) que cubren este pago'}
                    </p>
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
                        {ref.status === 'blocked_by_pending' && (
                          <div className="bg-red-100 border-2 border-red-500 rounded-lg p-3 animate-pulse">
                            <p className="text-red-900 font-bold text-sm flex items-center gap-2">
                              🚫 REFERENCIA BLOQUEADA - No puedes continuar
                            </p>
                            <p className="text-red-700 text-xs mt-2 font-semibold">
                              {(ref as any).block_reason || 'Esta referencia ya está completamente reservada por otros pagos pendientes'}
                            </p>
                            {(ref as any).pending_payments && (ref as any).pending_payments.length > 0 && (
                              <div className="mt-3 bg-white/50 rounded p-2">
                                <p className="text-xs font-semibold text-red-800 mb-1">Pagos que la están usando:</p>
                                {(ref as any).pending_payments.map((p: any, i: number) => (
                                  <p key={i} className="text-xs text-red-700">
                                    • {p.client_name}: ${Number(p.amount_to_use).toFixed(2)}
                                  </p>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-red-600 mt-2 italic">
                              Debes pagar o cancelar esos pagos antes de usar esta referencia.
                            </p>
                          </div>
                        )}
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
                          onWheel={(e) => e.currentTarget.blur()}
                          disabled={ref.exists_in_bank}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${
                            ref.exists_in_bank ? 'bg-green-50 border-green-300 cursor-not-allowed' : 'bg-white border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        {!ref.exists_in_bank && ref.reference_number && !ref.validating && (
                          <div className="mt-2 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                            <p className="text-xs text-amber-800 flex items-start gap-2">
                              <span className="text-amber-600 flex-shrink-0">⚠️</span>
                              <span>
                                <strong>Referencia no encontrada en banco.</strong>
                                <br />
                                Ingrese el monto manualmente o verifique si el número de referencia es correcto.
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
                </>
              )}

              {(!isDeductFromBroker || (isDeductFromBroker && deductMode === 'partial')) && multipleRefs && (
                <button
                  onClick={addReference}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8AAA19] hover:text-[#8AAA19] transition font-medium flex items-center justify-center gap-2"
                >
                  <FaPlus />
                  Agregar Otra Referencia
                </button>
              )}

              {/* Resumen de montos */}
              {(!isDeductFromBroker || (isDeductFromBroker && deductMode === 'partial')) && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-base font-bold text-[#010139]">📊 Resumen de Conciliación</h4>
                  </div>
                  
                  {isDeductFromBroker && deductMode === 'partial' && (
                    <>
                      <div className="flex justify-between text-sm pb-2">
                        <span className="text-gray-600">Monto Total:</span>
                        <span className="font-semibold text-gray-900">${amountToPay.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Descuento a corredor:</span>
                        <span className="font-semibold text-[#8AAA19]">
                          -${(parseFloat(partialDeductAmount || '0') || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pb-3 border-b-2 border-gray-300">
                        <span className="text-gray-700 font-medium">A Conciliar con Banco:</span>
                        <span className="font-bold text-[#010139]">
                          ${Math.max(0, amountToPay - (parseFloat(partialDeductAmount || '0') || 0)).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {!isDeductFromBroker && (
                    <div className="flex justify-between pb-3 border-b-2 border-gray-300">
                      <span className="text-gray-700 font-medium">Monto a Pagar:</span>
                      <span className="font-bold text-[#010139] text-lg">${amountToPay.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-700">Total Cubierto con Referencias:</span>
                    <span className="font-bold text-blue-600">${totalBankReferences.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between pt-3 mt-2 border-t-2 ${
                    stillNeeded === 0 ? 'border-green-400 bg-green-50' : 'border-orange-400 bg-orange-50'
                  } -mx-5 -mb-5 px-5 py-4 rounded-b-xl`}>
                    <span className={`font-bold text-sm ${stillNeeded === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                      {stillNeeded === 0 ? '✅ ESTADO: COMPLETO' : '⚠️ FALTA CUBRIR:'}
                    </span>
                    <span className={`font-bold text-xl ${stillNeeded === 0 ? 'text-green-700' : 'text-orange-700'}`}>
                      {stillNeeded === 0 ? '✓' : `$${stillNeeded.toFixed(2)}`}
                    </span>
                  </div>
                  {remainder > 0 && (
                    <p className="text-xs text-amber-700 text-center font-medium pt-2">
                      💡 Hay un excedente de ${remainder.toFixed(2)} que quedará disponible en la referencia
                    </p>
                  )}
                </div>
              )}
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
                
                {/* Mensaje informativo para descuento a corredor con divisiones */}
                {divideSingle && isDeductFromBroker && (
                  <div className="ml-7 p-3 bg-[#8AAA19]/10 border-l-4 border-[#8AAA19] rounded-r-lg">
                    <p className="text-sm text-[#010139] font-semibold">
                      💰 Adelantos múltiples al corredor {brokers.find(b => b.id === selectedBrokerId)?.name}
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                      Cada división creará un adelanto independiente al mismo corredor. Los montos NO están limitados por referencias bancarias.
                    </p>
                  </div>
                )}
                
                {/* Checkbox: Mismo cliente */}
                {divideSingle && (
                  <div className="flex items-center gap-2 ml-7">
                    <input
                      type="checkbox"
                      id="sameClient"
                      checked={sameClient}
                      onChange={(e) => setSameClient(e.target.checked)}
                      className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                    />
                    <label htmlFor="sameClient" className="text-sm font-medium text-gray-700">
                      Mismo cliente
                    </label>
                  </div>
                )}
                
                {/* Ocultar info de disponible cuando es descuento a corredor */}
                {!isDeductFromBroker && (
                  <div className="ml-7 text-xs space-y-1">
                    <p className="text-gray-600">
                      Tienes <strong className="text-blue-600">${totalBankReferences.toFixed(2)}</strong> disponibles de las referencias. Puedes dividirlos en varios pagos.
                    </p>
                    <p className="text-gray-500 italic">
                      Tip: La primera división se llena automáticamente con los datos del Paso 1.
                    </p>
                    {!sameClient && divideSingle && (
                      <p className="text-amber-600 italic font-medium">
                        ⚠️ Al dividir entre diferentes clientes, ingresa el nombre en cada división.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {divideSingle ? (
                <div className="space-y-4">
                  {/* Indicador de monto disponible - Ocultar cuando es descuento a corredor */}
                  {!isDeductFromBroker && (
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
                  )}
                  
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
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                            placeholder="0.00"
                          />
                        </div>
                        
                        {/* Campo Nombre Cliente - Solo cuando no es el mismo cliente */}
                        {!sameClient && (
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nombre del Cliente
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                              type="text"
                              value={div.client_name || ''}
                              onChange={createUppercaseHandler((e) => {
                                const newDivs = [...divisions];
                                if (newDivs[index]) {
                                  newDivs[index]!.client_name = e.target.value;
                                }
                                setDivisions(newDivs);
                              })}
                              className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                              placeholder="Nombre del cliente para esta división"
                            />
                          </div>
                        )}
                        
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
                    {isDeductFromBroker ? (
                      // Vista para descuento a corredor: sin límite de monto
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">💰 Adelantos a crear:</span>
                          <span className="font-bold text-[#8AAA19] text-xl">{divisions.length}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-700 font-semibold">Total en Adelantos:</span>
                          <span className="font-bold text-lg text-blue-600">
                            ${totalDivisions.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-3 p-3 bg-[#8AAA19]/10 border-l-4 border-[#8AAA19] rounded-r">
                          <p className="text-xs text-[#010139] font-semibold">
                            ✅ Sin límite de monto
                          </p>
                          <p className="text-xs text-gray-700 mt-1">
                            Cada división creará un adelanto independiente al corredor {brokers.find(b => b.id === selectedBrokerId)?.name}.
                            No hay restricción de monto ya que no se valida contra referencias bancarias.
                          </p>
                        </div>
                      </>
                    ) : (
                      // Vista normal: validar contra referencias
                      <>
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
                      </>
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
