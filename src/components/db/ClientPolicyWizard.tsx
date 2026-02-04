'use client';

import { useState, useEffect, useRef } from 'react';
import { FaTimes, FaCheckCircle, FaUser, FaFileAlt, FaUserTie } from 'react-icons/fa';
import { supabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POLICY_TYPES, checkSpecialOverride } from '@/lib/constants/policy-types';
import { getTodayLocalDate, addOneYearToDate } from '@/lib/utils/dates';
import NationalIdInput from '@/components/ui/NationalIdInput';
import PolicyNumberInput from '@/components/ui/PolicyNumberInput';
import { normalizeToUpperCase } from '@/lib/utils/normalize-text';

interface WizardProps {
  onClose: () => void;
  onSuccess: () => void;
  role: string;
  userEmail: string;
}

interface FormData {
  // Cliente
  client_name: string;
  national_id: string;
  email: string;
  phone: string;
  birth_date: string;
  // Póliza
  policy_number: string;
  insurer_id: string;
  ramo: string;
  start_date: string;
  renewal_date: string;
  status: string;
  notas: string; // Notas adicionales sobre la póliza
  // Broker y %
  broker_email: string;
  percent_override: string;
}

export default function ClientPolicyWizard({ onClose, onSuccess, role, userEmail }: WizardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState<any>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [userBrokerId, setUserBrokerId] = useState<string | null>(null);
  const [specialOverride, setSpecialOverride] = useState<{ hasSpecialOverride: boolean; overrideValue: number | null; condition?: string }>({ hasSpecialOverride: false, overrideValue: null });
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [documentType, setDocumentType] = useState<'cedula' | 'pasaporte' | 'ruc'>('cedula');
  const [duplicatePolicyError, setDuplicatePolicyError] = useState<{
    policyNumber: string;
    brokerName: string;
    isSameBroker: boolean;
    isPreliminary?: boolean;
    isUnidentified?: boolean;
    clientName?: string;
  } | null>(null);
  const [existingClientData, setExistingClientData] = useState<any>(null);
  const [existingClientWarning, setExistingClientWarning] = useState<{clientName: string; brokerName: string; isOtherBroker: boolean} | null>(null);
  const [searchingClient, setSearchingClient] = useState(false);
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  const today = getTodayLocalDate();
  
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    national_id: '',
    email: '',
    phone: '',
    birth_date: '',
    policy_number: '',
    insurer_id: '',
    ramo: '',
    start_date: today || '',
    renewal_date: '',
    status: 'ACTIVA',
    notas: '',
    broker_email: role === 'broker' ? userEmail : '',
    percent_override: '',
  });

  // Scroll to top cuando cambia el step
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [step]);

  useEffect(() => {
    // OPTIMIZACIÓN: Cargar todo en paralelo
    const loadData = async () => {
      const promises = [];
      
      // Cargar aseguradoras (siempre)
      promises.push(loadInsurers());
      
      // Cargar brokers (solo master)
      if (role === 'master') {
        promises.push(loadBrokers());
      }
      
      // Obtener broker_id y percent_default si es broker
      if (role === 'broker') {
        const brokerPromise = (async () => {
          const { data: { user } } = await supabaseClient().auth.getUser();
          if (user) {
            const { data: broker } = await supabaseClient()
              .from('brokers')
              .select('id, percent_default')
              .eq('p_id', user.id)
              .single();
            
            if (broker) {
              setUserBrokerId(broker.id);
              // Establecer el porcentaje default del broker
              setFormData(prev => ({
                ...prev,
                percent_override: broker.percent_default?.toString() || ''
              }));
            }
          }
        })();
        promises.push(brokerPromise);
      }
      
      // Ejecutar todas las queries en paralelo
      await Promise.all(promises);
    };
    
    loadData();
  }, [role]);

  useEffect(() => {
    if (formData.start_date && !formData.renewal_date) {
      const calculatedRenewalDate = addOneYearToDate(formData.start_date);
      setFormData(prev => ({ ...prev, renewal_date: calculatedRenewalDate }));
    }
  }, [formData.start_date, formData.renewal_date]);

  // Buscar cliente existente por cédula - MEJORADO con detección de broker
  useEffect(() => {
    console.log('[useEffect-searchClient] 🔍 EJECUTANDO con national_id:', formData.national_id);
    
    if (!formData.national_id || formData.national_id.trim() === '' || formData.national_id.length < 5) {
      console.log('[useEffect-searchClient] Cédula vacía o muy corta - cancelando');
      setExistingClientData(null);
      setExistingClientWarning(null);
      return;
    }

    console.log('[useEffect-searchClient] Iniciando timer de búsqueda...');
    const timer = setTimeout(async () => {
      console.log('[useEffect-searchClient] Timer completado - buscando cliente en BD...');
      setSearchingClient(true);
      try {
        // Usar RPC para bypass RLS y ver clientes de otros brokers
        const { data: clientData, error: clientError } = await (supabaseClient() as any)
          .rpc('rpc_search_client_by_national_id', {
            p_national_id: formData.national_id.toUpperCase()
          });

        console.log('[useEffect-searchClient] 🔍 RESULTADO RPC:', { data: clientData, error: clientError });

        // RPC devuelve array, tomar el primer elemento
        const client = (clientData as any)?.[0] || null;

        if (client) {
          setExistingClientData(client as any);
          
          // Obtener información del broker asignado (ya viene en el RPC)
          const brokerName = client.broker_name || 'Desconocido';
          const brokerEmail = client.broker_email || '';
          
          // Determinar si es el mismo broker o no
          const isCurrentUserBroker = role === 'broker' ? brokerEmail === userEmail : false;
          const isOtherBroker = !isCurrentUserBroker && role === 'broker';
          
          // Autocompletar campos
          setFormData(prev => ({
            ...prev,
            client_name: client.name || prev.client_name,
            email: client.email || prev.email || '',
            phone: client.phone || prev.phone || '',
            birth_date: client.birth_date || prev.birth_date || '',
          }));
          
          // Mostrar advertencia amarilla solo para brokers cuando es otro broker
          if (isOtherBroker) {
            setExistingClientWarning({
              clientName: client.name,
              brokerName,
              isOtherBroker: true
            });
            toast.warning(`Cliente ya registrado con otro corredor`, {
              description: `${client.name} pertenece a ${brokerName}. Puedes continuar: la póliza se agregará a tu cartera personal.`,
              duration: 6000
            });
          } else {
            setExistingClientWarning(null);
            toast.info(`Cliente encontrado: ${client.name}`, {
              description: 'Datos autocompletados. Puedes actualizar información al guardar.'
            });
          }
        } else {
          setExistingClientData(null);
          setExistingClientWarning(null);
        }
      } catch (error) {
        console.error('[searchClient] Error:', error);
        setExistingClientData(null);
        setExistingClientWarning(null);
      } finally {
        setSearchingClient(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [formData.national_id, role, userEmail]);

  // Validar número de póliza en tiempo real (con debounce)
  useEffect(() => {
    console.log('[useEffect-validatePolicy] Ejecutando con:', {
      policy_number: formData.policy_number,
      insurer_id: formData.insurer_id,
      role,
      userEmail,
      broker_email: formData.broker_email
    });

    if (!formData.policy_number || formData.policy_number.trim() === '') {
      console.log('[useEffect-validatePolicy] Número de póliza vacío - limpiando error');
      setDuplicatePolicyError(null);
      return;
    }

    // Guard: No validar si no hay aseguradora seleccionada
    if (!formData.insurer_id) {
      console.log('[useEffect-validatePolicy] No hay aseguradora - no validando');
      setDuplicatePolicyError(null);
      return;
    }

    console.log('[useEffect-validatePolicy] Iniciando timer de validación...');
    const timer = setTimeout(() => {
      console.log('[useEffect-validatePolicy] Timer completado - ejecutando validatePolicyNumber');
      validatePolicyNumber(formData.policy_number);
    }, 800); // Esperar 800ms después de que el usuario deja de escribir

    return () => clearTimeout(timer);
  }, [formData.policy_number, formData.insurer_id, role, userEmail, formData.broker_email]);
  
  // Verificar condición especial ASSA + VIDA
  useEffect(() => {
    if (formData.insurer_id && formData.ramo && insurers.length > 0) {
      const selectedInsurer = insurers.find(i => i.id === formData.insurer_id);
      const override = checkSpecialOverride(selectedInsurer?.name, formData.ramo);
      
      setSpecialOverride(override);
      
      // Si hay condición especial, aplicar automáticamente el override
      if (override.hasSpecialOverride && override.overrideValue !== null) {
        setFormData(prev => ({
          ...prev,
          percent_override: String(override.overrideValue)
        }));
      }
    }
  }, [formData.insurer_id, formData.ramo, insurers]);

  const loadInsurers = async () => {
    const { data } = await supabaseClient()
      .from('insurers')
      .select('id, name')
      .eq('active', true)
      .order('name');
    setInsurers(data || []);
  };

  const loadBrokers = async () => {
    console.log('[loadBrokers] Cargando brokers...');
    const { data: brokersData, error } = await supabaseClient()
      .from('brokers')
      .select(`
        id,
        name,
        p_id,
        percent_default,
        profiles!brokers_p_id_fkey(id, full_name, email)
      `)
      .eq('active', true)
      .order('name');

    if (error) {
      console.error('[loadBrokers] Error:', error);
    } else {
      console.log('[loadBrokers] Brokers cargados:', brokersData?.length || 0, brokersData);
    }

    setBrokers(brokersData || []);
  };

  // Debounce timer para búsqueda de clientes
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const searchClients = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setExistingClients([]);
      setShowClientSuggestions(false);
      return;
    }

    // OPTIMIZACIÓN: Debounce para evitar queries excesivas mientras el usuario escribe
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(async () => {
      let query = supabaseClient()
        .from('clients')
        .select('id, name, national_id, email, phone, birth_date, broker_id')
        .ilike('name', `%${searchTerm}%`);
      
      // Si es broker, solo mostrar sus clientes
      if (role === 'broker' && userBrokerId) {
        query = query.eq('broker_id', userBrokerId);
      }
      
      const { data } = await query.limit(5);

      setExistingClients(data || []);
      setShowClientSuggestions(true);
    }, 400); // Esperar 400ms después de que el usuario deja de escribir

    setSearchDebounceTimer(timer);
  };

  // Buscar cliente por cédula - Llamada manualmente desde onBlur del input
  const searchClientByNationalId = async (nationalId: string) => {
    if (!nationalId || nationalId.length < 5) {
      setExistingClientWarning(null);
      setExistingClientData(null);
      return;
    }

    console.log('[searchClientByNationalId] Buscando:', nationalId, 'Role:', role, 'UserEmail:', userEmail);
    setSearchingClient(true);
    
    try {
      const { data: clientData } = await supabaseClient()
        .from('clients')
        .select('id, name, national_id, email, phone, birth_date, broker_id, brokers(name, p_id, profiles(email))')
        .eq('national_id', nationalId.toUpperCase())
        .single();

      console.log('[searchClientByNationalId] Resultado:', clientData);

      if (clientData) {
        const brokerName = (clientData as any).brokers?.name || 'Desconocido';
        const brokerEmail = (clientData as any).brokers?.profiles?.email || '';
        
        console.log('[searchClientByNationalId] Broker del cliente:', { brokerName, brokerEmail });
        console.log('[searchClientByNationalId] Usuario actual:', userEmail);
        
        const isCurrentUserBroker = role === 'broker' ? brokerEmail === userEmail : false;
        const isOtherBroker = !isCurrentUserBroker && role === 'broker';

        console.log('[searchClientByNationalId] isCurrentUserBroker:', isCurrentUserBroker, 'isOtherBroker:', isOtherBroker);

        // Guardar datos del cliente para autocompletar
        setExistingClientData(clientData);
        
        // Si es otro broker, mostrar advertencia amarilla
        if (isOtherBroker) {
          console.log('[searchClientByNationalId] ⚠️ MOSTRANDO ADVERTENCIA - Cliente de otro broker');
          setExistingClientWarning({
            clientName: clientData.name,
            brokerName,
            isOtherBroker: true
          });
          toast.warning(`Cliente existente: ${clientData.name}`, {
            description: `Este cliente está asignado a: ${brokerName}. Puedes agregar una póliza nueva.`,
            duration: 5000
          });
        } else {
          console.log('[searchClientByNationalId] ✓ Cliente propio o Master - Sin advertencia');
          setExistingClientWarning(null);
          toast.info(`Cliente encontrado: ${clientData.name}`, {
            description: 'Datos autocompletados. Puedes actualizar información al guardar.'
          });
        }

        // Auto-completar campos
        setFormData(prev => ({
          ...prev,
          client_name: clientData.name || prev.client_name,
          email: clientData.email || prev.email,
          phone: clientData.phone || prev.phone,
          birth_date: clientData.birth_date || prev.birth_date,
        }));
      } else {
        console.log('[searchClientByNationalId] Cliente no encontrado');
        setExistingClientData(null);
        setExistingClientWarning(null);
      }
    } catch (error) {
      console.error('[searchClientByNationalId] Error:', error);
      setExistingClientData(null);
      setExistingClientWarning(null);
    } finally {
      setSearchingClient(false);
    }
  };

  const selectExistingClient = async (client: any) => {
    setSelectedExistingClient(client);
    
    let brokerEmail = formData.broker_email;
    
    // Auto-completar broker del cliente existente (solo para Master)
    if (client.broker_id && role === 'master') {
      try {
        // OPTIMIZACIÓN: 1 query con join en lugar de 2 queries secuenciales
        const { data: brokerData } = await supabaseClient()
          .from('brokers')
          .select('p_id, profile:profiles!p_id(email)')
          .eq('id', client.broker_id)
          .single();
        
        if (brokerData?.profile?.email) {
          brokerEmail = brokerData.profile.email;
          console.log('[ClientPolicyWizard] Broker auto-completado:', brokerEmail);
        }
      } catch (error) {
        console.error('[ClientPolicyWizard] Error al obtener broker del cliente:', error);
      }
    }
    
    setFormData({
      ...formData,
      client_name: client.name,
      national_id: client.national_id || '',
      email: client.email || '',
      phone: client.phone || '',
      birth_date: (client as any).birth_date || '',
      broker_email: brokerEmail,
    });
    setShowClientSuggestions(false);
    
    // Mensaje diferente según si se autocompletó el broker o no
    if (role === 'master' && brokerEmail && brokerEmail !== formData.broker_email) {
      toast.success(`Cliente "${client.name}" seleccionado`, {
        description: 'El corredor asignado al cliente se autocompletó en el Paso 3'
      });
    } else {
      toast.success(`Cliente existente "${client.name}" seleccionado`);
    }
  };

  const validatePolicyNumber = async (policyNumber: string): Promise<boolean> => {
    if (!policyNumber || policyNumber.trim() === '') {
      setDuplicatePolicyError(null);
      return true;
    }

    setCheckingPolicy(true);
    
    try {
      console.log('[validatePolicyNumber] ========== INICIO VALIDACIÓN ==========');
      console.log('[validatePolicyNumber] Póliza a buscar:', policyNumber);
      console.log('[validatePolicyNumber] Póliza UPPERCASE:', policyNumber.toUpperCase());
      
      // 1. Buscar en policies (pólizas identificadas en BD) - Usar RPC para bypass RLS
      console.log('[validatePolicyNumber] Buscando en tabla policies...');
      const { data: policyData, error: policyError } = await (supabaseClient() as any)
        .rpc('rpc_validate_policy_number', {
          p_policy_number: policyNumber.toUpperCase()
        });

      console.log('[validatePolicyNumber] Resultado RPC policies:', { data: policyData, error: policyError });
      
      // RPC devuelve array, tomar el primer elemento
      const policy = (policyData as any)?.[0] || null;
      
      if (policyError) {
        console.error('[validatePolicyNumber] ERROR EN QUERY POLICIES:');
        console.error('[validatePolicyNumber] Error code:', policyError.code);
        console.error('[validatePolicyNumber] Error message:', policyError.message);
        console.error('[validatePolicyNumber] Error details:', policyError.details);
        console.error('[validatePolicyNumber] Error hint:', policyError.hint);
        
        // PGRST116 = No rows found - esto es NORMAL cuando no existe
        if (policyError.code !== 'PGRST116') {
          // Error real de BD - mejor fallar seguro
          console.error('[validatePolicyNumber] Error real de BD - permitiendo continuar por seguridad');
        } else {
          console.log('[validatePolicyNumber] PGRST116 = No encontrado (normal) - continuando...');
        }
      }

      if (policy) {
        console.log('[validatePolicyNumber] PÓLIZA DUPLICADA ENCONTRADA EN BD');
        console.log('[validatePolicyNumber] Datos completos:', policy);
        const brokerName = policy.broker_name || 'Desconocido';
        const brokerEmail = policy.broker_email || '';
        const clientName = policy.client_name || 'Cliente';
        const isClientActive = policy.client_active ?? true;
        
        // Determinar si es el mismo broker
        let isSameBroker = false;
        if (role === 'broker') {
          isSameBroker = brokerEmail === userEmail;
        } else {
          // Para master, comparar con el broker seleccionado si ya hay uno
          if (formData.broker_email) {
            isSameBroker = brokerEmail === formData.broker_email;
          }
        }
        
        setDuplicatePolicyError({
          policyNumber,
          brokerName,
          isSameBroker,
          isPreliminary: !isClientActive,
          clientName,
          isUnidentified: false,
        });
        setCheckingPolicy(false);
        return false; // Ya existe en policies
      }

      // 2. Buscar en comm_items (ajustes sin identificar) - Usar RPC para bypass RLS
      console.log('[validatePolicyNumber] Buscando en tabla comm_items...');
      const { data: commItemData, error: commError } = await (supabaseClient() as any)
        .rpc('rpc_validate_policy_in_comm_items', {
          p_policy_number: policyNumber.toUpperCase()
        });

      console.log('[validatePolicyNumber] Resultado RPC comm_items:', { data: commItemData, error: commError });
      
      // RPC devuelve array, tomar el primer elemento
      const commItem = (commItemData as any)?.[0] || null;
      
      if (commError) {
        console.error('[validatePolicyNumber] ERROR EN QUERY COMM_ITEMS:');
        console.error('[validatePolicyNumber] Error code:', commError.code);
        console.error('[validatePolicyNumber] Error message:', commError.message);
        
        // PGRST116 = No rows found - esto es NORMAL
        if (commError.code !== 'PGRST116') {
          console.error('[validatePolicyNumber] Error real de BD en comm_items');
        } else {
          console.log('[validatePolicyNumber] PGRST116 = No encontrado en comm_items (normal)');
        }
      }

      if (commItem) {
        console.log('[validatePolicyNumber] ❌ PÓLIZA DUPLICADA ENCONTRADA EN COMISIONES');
        console.log('[validatePolicyNumber] Datos completos:', commItem);
        const brokerName = commItem.broker_name || 'Desconocido';
        const brokerEmail = commItem.broker_email || '';
        const insuredName = commItem.insured_name || 'Asegurado';
        
        // Determinar si es el mismo broker
        let isSameBroker = false;
        if (role === 'broker') {
          isSameBroker = brokerEmail === userEmail;
        } else {
          if (formData.broker_email) {
            isSameBroker = brokerEmail === formData.broker_email;
          }
        }
        
        setDuplicatePolicyError({
          policyNumber,
          brokerName,
          isSameBroker,
          isUnidentified: true,
          clientName: insuredName,
          isPreliminary: false,
        });
        setCheckingPolicy(false);
        return false; // Ya existe en comisiones sin identificar
      }

      // 3. No existe en ninguna parte - OK para registrar
      console.log('[validatePolicyNumber] ✅ PÓLIZA DISPONIBLE PARA REGISTRO');
      console.log('[validatePolicyNumber] ========== FIN VALIDACIÓN ==========');
      setDuplicatePolicyError(null);
      setCheckingPolicy(false);
      return true;
    } catch (error: any) {
      console.error('[validatePolicyNumber] ❌ ERROR EN VALIDACIÓN:', error);
      console.error('[validatePolicyNumber] Error message:', error.message);
      console.error('[validatePolicyNumber] Error details:', error);
      setDuplicatePolicyError(null);
      setCheckingPolicy(false);
      return true; // En caso de error, permitir continuar
    }
  };

  const validateStep = async () => {
    const errors: Record<string, boolean> = {};
    let errorMessages: string[] = [];
    
    if (step === 1) {
      if (!formData.client_name.trim()) {
        errors.client_name = true;
        errorMessages.push('Nombre del cliente');
      }
      if (!formData.national_id.trim()) {
        errors.national_id = true;
        errorMessages.push('Cédula/Pasaporte/RUC');
      }
      if (!formData.email.trim()) {
        errors.email = true;
        errorMessages.push('Email');
      }
      if (!formData.phone.trim()) {
        errors.phone = true;
        errorMessages.push('Teléfono');
      }
      
      // Fecha de nacimiento solo es obligatoria si NO es RUC (empresas)
      if (documentType !== 'ruc' && !formData.birth_date.trim()) {
        errors.birth_date = true;
        errorMessages.push('Fecha de nacimiento');
      }
    } else if (step === 2) {
      if (!formData.policy_number.trim()) {
        errors.policy_number = true;
        errorMessages.push('Número de póliza');
      }
      if (!formData.insurer_id) {
        errors.insurer_id = true;
        errorMessages.push('Aseguradora');
      }
      // Select component returns value directly, no need for .trim()
      if (!formData.ramo) {
        errors.ramo = true;
        errorMessages.push('Tipo de póliza');
      }
      if (!formData.start_date) {
        errors.start_date = true;
        errorMessages.push('Fecha de inicio');
      }
      if (!formData.renewal_date) {
        errors.renewal_date = true;
        errorMessages.push('Fecha de renovación');
      }
      
      // Si hay errores de campos vacíos, mostrarlos primero
      if (errorMessages.length > 0) {
        setValidationErrors(errors);
        toast.error('Campos requeridos faltantes', {
          description: errorMessages.join(', ')
        });
        return false;
      }
      
      // Validar que el número de póliza no exista
      const isValid = await validatePolicyNumber(formData.policy_number);
      if (!isValid) {
        errors.policy_number = true;
        setValidationErrors(errors);
        toast.error('Número de póliza duplicado', {
          description: `La póliza "${formData.policy_number}" ya existe en el sistema. Por favor ingrese un número diferente.`,
          duration: 6000
        });
        return false;
      }
    } else if (step === 3) {
      // Validar corredor solo para master
      if (role === 'master' && !formData.broker_email) {
        errors.broker_email = true;
        errorMessages.push('Corredor');
      }
      // Validar porcentaje para ambos roles (master y broker)
      if (!formData.percent_override || formData.percent_override.trim() === '') {
        errors.percent_override = true;
        errorMessages.push('Porcentaje de comisión');
      }
    }
    
    if (errorMessages.length > 0) {
      setValidationErrors(errors);
      toast.error('Campos requeridos faltantes', {
        description: errorMessages.join(', ')
      });
      return false;
    }
    
    setValidationErrors({});
    return true;
  };

  const handleNext = async () => {
    if (await validateStep()) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async () => {
    console.log('[ClientPolicyWizard] Iniciando handleSubmit...');
    console.log('[ClientPolicyWizard] FormData:', formData);
    console.log('[ClientPolicyWizard] Selected existing client:', selectedExistingClient);
    
    setLoading(true);
    try {
      // Si es un cliente existente, solo crear la póliza
      if (selectedExistingClient) {
        // Obtener broker_id (p_id del broker seleccionado)
        let broker_id: string | undefined;
        
        if (role === 'master') {
          const broker = brokers.find((b: any) => b.profiles?.email === formData.broker_email);
          broker_id = broker?.p_id;
          if (!broker_id) {
            throw new Error('No se encontró el corredor seleccionado');
          }
        } else {
          const { data: userData } = await supabaseClient().auth.getUser();
          broker_id = userData.user?.id;
          if (!broker_id) {
            throw new Error('No se pudo obtener el ID del usuario');
          }
        }

        // Normalizar fechas a formato YYYY-MM-DD estricto (sin hora, sin timezone)
        const normalizedStartDate = formData.start_date?.trim() || null;
        const normalizedRenewalDate = formData.renewal_date?.trim() || null;
        
        const policyPayload = {
          policy_number: normalizeToUpperCase(formData.policy_number),
          insurer_id: formData.insurer_id,
          ramo: formData.ramo ? normalizeToUpperCase(formData.ramo) : null,
          start_date: normalizedStartDate,
          renewal_date: normalizedRenewalDate,
          status: 'ACTIVA' as 'ACTIVA' | 'VENCIDA' | 'CANCELADA', // Siempre ACTIVA para nuevos registros
          notas: formData.notas || null,
          client_id: selectedExistingClient.id,
          broker_id: broker_id,
        };
        
        console.log('[FECHA DEBUG] Fechas normalizadas para póliza:', {
          start_date_input: formData.start_date,
          start_date_normalized: normalizedStartDate,
          renewal_date_input: formData.renewal_date,
          renewal_date_normalized: normalizedRenewalDate
        });

        console.log('[ClientPolicyWizard] Creando póliza para cliente existente:', policyPayload);
        
        const { error } = await supabaseClient()
          .from('policies')
          .insert([policyPayload]);

        if (error) {
          console.error('[ClientPolicyWizard] Error creando póliza:', error);
          throw error;
        }
        
        console.log('[ClientPolicyWizard] Póliza creada exitosamente');
        toast.success('Nueva póliza agregada al cliente existente');
      } else {
        // Crear nuevo cliente con póliza usando la API
        // Obtener broker_id (p_id del broker seleccionado)
        let broker_id: string | undefined;
        
        if (role === 'master') {
          const broker = brokers.find((b: any) => b.profiles?.email === formData.broker_email);
          broker_id = broker?.p_id;
          if (!broker_id) {
            throw new Error('No se encontró el corredor seleccionado');
          }
        } else {
          const { data: userData } = await supabaseClient().auth.getUser();
          broker_id = userData.user?.id;
          if (!broker_id) {
            throw new Error('No se pudo obtener el ID del usuario');
          }
        }

        // Normalizar TODAS las fechas a formato YYYY-MM-DD estricto (sin hora, sin timezone)
        const normalizedBirthDate = formData.birth_date?.trim() || null;
        const normalizedStartDate = formData.start_date?.trim() || null;
        const normalizedRenewalDate = formData.renewal_date?.trim() || null;
        
        console.log('[FECHA DEBUG] Fechas normalizadas para cliente y póliza:', {
          birth_date_input: formData.birth_date,
          birth_date_normalized: normalizedBirthDate,
          start_date_input: formData.start_date,
          start_date_normalized: normalizedStartDate,
          renewal_date_input: formData.renewal_date,
          renewal_date_normalized: normalizedRenewalDate
        });
        
        const clientData = {
          name: normalizeToUpperCase(formData.client_name),
          national_id: formData.national_id ? formData.national_id.toUpperCase() : null,
          email: formData.email || null,
          phone: formData.phone || null,
          birth_date: normalizedBirthDate,
          active: true,
          broker_id: broker_id,
        };

        const policyData = {
          policy_number: normalizeToUpperCase(formData.policy_number),
          insurer_id: formData.insurer_id,
          ramo: formData.ramo ? normalizeToUpperCase(formData.ramo) : null,
          start_date: normalizedStartDate,
          renewal_date: normalizedRenewalDate,
          status: 'ACTIVA' as 'ACTIVA' | 'VENCIDA' | 'CANCELADA', // Siempre ACTIVA para nuevos registros
          notas: formData.notas || null,
        };

        console.log('[ClientPolicyWizard] Creando nuevo cliente y póliza...');
        console.log('[ClientPolicyWizard] clientData:', clientData);
        console.log('[ClientPolicyWizard] policyData:', policyData);
        
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientData, policyData }),
        });

        console.log('[ClientPolicyWizard] Response status:', response.status);
        const result = await response.json();
        console.log('[ClientPolicyWizard] Response data:', result);

        if (!response.ok) {
          console.error('[ClientPolicyWizard] Error en respuesta:', result);
          
          // Manejar error de cliente duplicado
          if (result.error?.includes('duplicate') || result.error?.includes('unique constraint')) {
            throw new Error(`Ya existe un cliente con la cédula "${formData.national_id}". Si deseas actualizar sus datos, búscalo en la base de datos.`);
          }
          
          // Manejar error de póliza duplicada
          if (result.error?.includes('policies_policy_number_key')) {
            throw new Error(`El número de póliza "${formData.policy_number}" ya existe en el sistema. Por favor use un número diferente.`);
          }
          
          throw new Error(result.error || 'Error al crear cliente');
        }

        console.log('[ClientPolicyWizard] Cliente creado exitosamente');
        toast.success('Cliente y póliza creados exitosamente');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[ClientPolicyWizard] Error catch:', error);
      
      // Mostrar mensaje de error claro
      const errorMessage = error.message || 'Error desconocido al crear cliente y póliza';
      toast.error('Error al crear cliente y póliza', { 
        description: errorMessage,
        duration: 6000 // Más tiempo para leer el mensaje
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Nuevo Cliente y Póliza</h2>
            <p className="text-white/80 text-sm mt-1">Paso {step} de 4</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-base font-bold transition-all ${
                  step >= s ? 'bg-[#010139] text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step > s ? <FaCheckCircle className="text-[10px] sm:text-base" /> : s}
                </div>
                {s < 4 && (
                  <div className={`h-0.5 sm:h-1 flex-1 mx-1 sm:mx-2 ${step > s ? 'bg-[#010139]' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="hidden sm:flex justify-between mt-2 text-xs sm:text-sm text-gray-600 px-1">
            <span className="text-center">Cliente</span>
            <span className="text-center">Póliza</span>
            <span className="text-center">Asignación</span>
            <span className="text-center">Confirmar</span>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-2 sm:mb-4">
                <FaUser size={20} className="sm:w-6 sm:h-6" />
                <h3 className="text-lg sm:text-xl font-bold">Datos del Cliente</h3>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-2 sm:p-3 rounded mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm text-blue-800">
                  <span className="text-red-500 font-bold">*</span> Todos los campos son obligatorios excepto Notas.
                </p>
              </div>
              
              <div className="relative">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={createUppercaseHandler((e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, client_name: value });
                    searchClients(value);
                    if (validationErrors.client_name && value.trim()) {
                      setValidationErrors(prev => ({ ...prev, client_name: false }));
                    }
                  })}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  className={`w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition ${uppercaseInputClass} ${
                    validationErrors.client_name ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Juan Pérez"
                />
                {validationErrors.client_name && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                )}
                {showClientSuggestions && existingClients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-2 bg-blue-50 text-xs text-blue-700 border-b">
                      📋 Clientes existentes - Click para usar datos existentes
                    </div>
                    {existingClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => selectExistingClient(client)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0 transition"
                      >
                        <div className="font-semibold text-sm">{client.name}</div>
                        <div className="text-xs text-gray-600">
                          {client.national_id && `Cédula: ${client.national_id}`}
                          {client.email && ` • ${client.email}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedExistingClient && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <FaCheckCircle /> Cliente existente seleccionado - Solo se creará la nueva póliza
                  </div>
                )}
              </div>

              <NationalIdInput
                value={formData.national_id}
                onChange={(value) => {
                  setFormData({ ...formData, national_id: value });
                  if (validationErrors.national_id && value.trim()) {
                    setValidationErrors(prev => ({ ...prev, national_id: false }));
                  }
                  // Limpiar advertencias al cambiar
                  if (value !== existingClientData?.national_id) {
                    setExistingClientWarning(null);
                    setExistingClientData(null);
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value.length >= 5) {
                    searchClientByNationalId(value);
                  }
                }}
                helperText={searchingClient ? (
                  <span className="text-blue-600 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Buscando cliente en base de datos...
                  </span>
                ) : existingClientData ? (
                  <span className="text-green-700 font-medium">
                    ✅ Cliente encontrado: {existingClientData.name}. Puedes actualizar cualquier información al guardar.
                  </span>
                ) : null}
                onDocumentTypeChange={(type) => {
                  setDocumentType(type);
                }}
                label="Documento de Identidad"
                required
                hasError={validationErrors.national_id}
              />
              {validationErrors.national_id && (
                <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
              )}
              
              {/* ADVERTENCIA AMARILLA: Cliente existe con otro broker */}
              {existingClientWarning && existingClientWarning.isOtherBroker && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-lg shadow-sm animate-fadeIn mt-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-yellow-800 mb-1">⚠️ Cliente Existente</h4>
                      <p className="text-sm text-yellow-700 mb-2">
                        El cliente <strong>{existingClientWarning.clientName}</strong> con esta cédula ya existe en la base de datos.
                      </p>
                      <div className="bg-yellow-100 border border-yellow-300 rounded px-3 py-2 mb-3">
                        <p className="text-xs text-yellow-800 mb-1">📋 <strong>Cliente actualmente asignado a:</strong></p>
                        <p className="text-sm font-semibold text-yellow-900">👤 {existingClientWarning.brokerName}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-300 rounded px-3 py-2">
                        <p className="text-xs text-blue-900 leading-relaxed">
                          ℹ️ <strong>Puedes continuar:</strong> La póliza que registres quedará en tu cartera personal. 
                          Este cliente puede tener otras pólizas con diferentes corredores. 
                          Cada póliza pertenece al corredor que la registró. 
                          Si necesitas consolidar todas las pólizas bajo un solo corredor, contacta con un administrativo.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (validationErrors.email && e.target.value.trim()) {
                        setValidationErrors(prev => ({ ...prev, email: false }));
                      }
                    }}
                    className={`w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition ${
                      validationErrors.email ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    placeholder="cliente@email.com"
                  />
                  {validationErrors.email && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (validationErrors.phone && e.target.value.trim()) {
                        setValidationErrors(prev => ({ ...prev, phone: false }));
                      }
                    }}
                    className={`w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition ${
                      validationErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    placeholder="6000-0000"
                  />
                  {validationErrors.phone && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </div>
              </div>

              {documentType !== 'ruc' && (
                <div className="w-full max-w-full overflow-hidden">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.birth_date}
                    onChange={(e) => {
                      setFormData({ ...formData, birth_date: e.target.value });
                      if (validationErrors.birth_date && e.target.value) {
                        setValidationErrors(prev => ({ ...prev, birth_date: false }));
                      }
                    }}
                    className={`w-full max-w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition ${
                      validationErrors.birth_date ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    style={{ WebkitAppearance: 'none' }}
                  />
                  {validationErrors.birth_date && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Póliza */}
          {step === 2 && (
            <div className="space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-2 sm:mb-4">
                <FaFileAlt size={20} className="sm:w-6 sm:h-6" />
                <h3 className="text-lg sm:text-xl font-bold">Datos de la Póliza</h3>
              </div>

              {/* BANNER DE ALERTA: Póliza duplicada */}
              {duplicatePolicyError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-800 mb-2">🚫 Póliza Duplicada - No se puede registrar</h4>
                      <p className="text-sm text-red-700 mb-3">
                        El número de póliza <strong className="font-mono bg-red-100 px-2 py-0.5 rounded">{duplicatePolicyError.policyNumber}</strong> ya existe en el sistema.
                      </p>

                      {/* Caso 1: Póliza sin identificar en comisiones */}
                      {duplicatePolicyError.isUnidentified && (
                        <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-3">
                          <p className="text-xs text-orange-800 font-semibold mb-2">📋 Estado: <span className="text-orange-900">SIN IDENTIFICAR</span></p>
                          <p className="text-xs text-orange-700 mb-2">
                            Esta póliza existe en el sistema de comisiones pero aún no ha sido identificada con un cliente.
                          </p>
                          <div className="bg-orange-50 rounded p-2 mb-2">
                            <p className="text-xs text-orange-800">👤 <strong>Asegurado:</strong> {duplicatePolicyError.clientName}</p>
                            <p className="text-xs text-orange-800">👨‍💼 <strong>Corredor:</strong> {duplicatePolicyError.brokerName}</p>
                          </div>
                          {duplicatePolicyError.isSameBroker ? (
                            <div className="bg-blue-50 border border-blue-300 rounded p-2 mt-2">
                              <p className="text-xs text-blue-800">
                                � <strong>Esta póliza está en tu cartera.</strong> Para registrarla en la base de datos:
                              </p>
                              <ul className="text-xs text-blue-700 mt-2 ml-4 space-y-1">
                                <li>• Ve a <strong>Comisiones → Ajustes → Sin Identificar</strong></li>
                                <li>• Busca esta póliza y haz clic en "Identificar"</li>
                                <li>• El sistema la vinculará automáticamente al cliente</li>
                              </ul>
                            </div>
                          ) : (
                            <div className="bg-red-100 border border-red-300 rounded p-2 mt-2">
                              <p className="text-xs text-red-800">
                                ⚠️ <strong>Esta póliza pertenece a otro corredor.</strong> No puedes registrarla.
                              </p>
                              <p className="text-xs text-red-700 mt-2">
                                📞 Si crees que esto es un error o el cliente cambió de corredor, <strong>contacta con un administrativo</strong>.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Caso 2: Póliza preliminar (cliente inactivo) */}
                      {!duplicatePolicyError.isUnidentified && duplicatePolicyError.isPreliminary && (
                        <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-3">
                          <p className="text-xs text-amber-800 font-semibold mb-2">📋 Estado: <span className="text-amber-900">PRELIMINAR</span></p>
                          <p className="text-xs text-amber-700 mb-2">
                            Esta póliza ya está registrada pero el cliente está marcado como preliminar (faltan datos completos).
                          </p>
                          <div className="bg-amber-50 rounded p-2 mb-2">
                            <p className="text-xs text-amber-800">👤 <strong>Cliente:</strong> {duplicatePolicyError.clientName}</p>
                            <p className="text-xs text-amber-800">👨‍💼 <strong>Corredor:</strong> {duplicatePolicyError.brokerName}</p>
                          </div>
                          {duplicatePolicyError.isSameBroker ? (
                            <div className="bg-blue-50 border border-blue-300 rounded p-2 mt-2">
                              <p className="text-xs text-blue-800">
                                💡 <strong>Esta póliza está en tu cartera.</strong> Para completar el registro:
                              </p>
                              <ul className="text-xs text-blue-700 mt-2 ml-4 space-y-1">
                                <li>• Ve a <strong>Base de Datos → Preliminares</strong></li>
                                <li>• Busca al cliente <strong>{duplicatePolicyError.clientName}</strong></li>
                                <li>• Completa los datos faltantes (cédula, email, teléfono, fecha de nacimiento)</li>
                                <li>• El cliente pasará automáticamente a la base de datos principal</li>
                              </ul>
                            </div>
                          ) : (
                            <div className="bg-red-100 border border-red-300 rounded p-2 mt-2">
                              <p className="text-xs text-red-800">
                                ⚠️ <strong>Esta póliza pertenece a otro corredor.</strong> No puedes registrarla.
                              </p>
                              <p className="text-xs text-red-700 mt-2">
                                📞 Si crees que esto es un error o el cliente cambió de corredor, <strong>contacta con un administrativo</strong>.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Caso 3: Póliza identificada normalmente */}
                      {!duplicatePolicyError.isUnidentified && !duplicatePolicyError.isPreliminary && (
                        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-3">
                          <p className="text-xs text-red-800 font-semibold mb-2">📋 Estado: <span className="text-red-900">REGISTRADA</span></p>
                          <p className="text-xs text-red-700 mb-2">
                            Esta póliza ya está completamente registrada en la base de datos.
                          </p>
                          <div className="bg-red-50 rounded p-2 mb-2">
                            <p className="text-xs text-red-800">👤 <strong>Cliente:</strong> {duplicatePolicyError.clientName}</p>
                            <p className="text-xs text-red-800">👨‍💼 <strong>Corredor:</strong> {duplicatePolicyError.brokerName}</p>
                          </div>
                          {duplicatePolicyError.isSameBroker ? (
                            <div className="bg-red-50 border border-red-300 rounded p-2 mt-2">
                              <p className="text-xs text-red-800">
                                🚫 <strong>Esta póliza ya está en tu cartera.</strong>
                              </p>
                              <p className="text-xs text-red-700 mt-2">
                                ✓ Verifica en tu <strong>Base de Datos</strong> si necesitas actualizar información.
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                ✓ Si es una renovación, usa el mismo número de póliza para actualizar las fechas en la póliza existente.
                              </p>
                            </div>
                          ) : (
                            <div className="bg-red-100 border border-red-300 rounded p-2 mt-2">
                              <p className="text-xs text-red-800">
                                ⚠️ <strong>Esta póliza está asignada a otro corredor.</strong> No puedes registrarla.
                              </p>
                              <p className="text-xs text-red-700 mt-2">
                                ¿Qué hacer?
                              </p>
                              <ul className="text-xs text-red-700 mt-1 ml-4 space-y-1">
                                <li>• Verifica que el número de póliza sea correcto</li>
                                <li>• Si el cliente cambió de corredor, <strong>contacta con un administrativo</strong> para realizar el traspaso</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aseguradora <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={formData.insurer_id} 
                  onValueChange={(value) => {
                    // LIMPIAR policy_number al cambiar aseguradora
                    // Esto evita que PolicyNumberInput intente parsear un número con formato de otra aseguradora
                    setFormData({ ...formData, insurer_id: value, policy_number: '' });
                    if (validationErrors.insurer_id && value) {
                      setValidationErrors(prev => ({ ...prev, insurer_id: false }));
                    }
                    // Limpiar error de duplicado
                    setDuplicatePolicyError(null);
                  }}
                >
                  <SelectTrigger className={`w-full border-2 ${
                    validationErrors.insurer_id ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}>
                    <SelectValue placeholder="Seleccionar aseguradora..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-auto">
                    {insurers.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.insurer_id && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                )}
              </div>

              {/* Número de Póliza con autoayuda por aseguradora */}
              {formData.insurer_id ? (
                <>
                  <PolicyNumberInput
                    insurerName={insurers.find(i => i.id === formData.insurer_id)?.name || ''}
                    value={formData.policy_number}
                    onChange={(value) => {
                      setFormData({ ...formData, policy_number: value });
                      if (validationErrors.policy_number && value.trim()) {
                        setValidationErrors(prev => ({ ...prev, policy_number: false }));
                      }
                      // Limpiar error de duplicado cuando el usuario cambia el valor
                      if (duplicatePolicyError && value !== duplicatePolicyError.policyNumber) {
                        setDuplicatePolicyError(null);
                      }
                    }}
                    label="Número de Póliza"
                    required
                    hasError={validationErrors.policy_number || !!duplicatePolicyError}
                  />
                  {checkingPolicy && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verificando disponibilidad...
                    </p>
                  )}
                  {duplicatePolicyError && (
                    <div className="bg-red-50 border border-red-300 rounded p-2 mt-1">
                      <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
                        <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>Póliza duplicada - Asignada a: <strong>{duplicatePolicyError.brokerName}</strong></span>
                      </p>
                    </div>
                  )}
                  {!duplicatePolicyError && !checkingPolicy && validationErrors.policy_number && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Primero selecciona una aseguradora para ver el formato correcto del número de póliza
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Póliza <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={formData.ramo} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, ramo: value });
                    if (validationErrors.ramo && value) {
                      setValidationErrors(prev => ({ ...prev, ramo: false }));
                    }
                  }}
                >
                  <SelectTrigger className={`w-full border-2 ${
                    validationErrors.ramo ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}>
                    <SelectValue placeholder="Selecciona el tipo de póliza..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-auto">
                    {POLICY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.ramo && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="w-full max-w-full overflow-hidden">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      
                      // Auto-calcular fecha de renovación (exactamente 1 año después)
                      let calculatedRenewalDate = formData.renewal_date || '';
                      if (startDate) {
                        calculatedRenewalDate = addOneYearToDate(startDate);
                      }
                      
                      setFormData({ 
                        ...formData, 
                        start_date: startDate,
                        renewal_date: calculatedRenewalDate
                      });
                      
                      if (validationErrors.start_date && startDate) {
                        setValidationErrors(prev => ({ ...prev, start_date: false }));
                      }
                    }}
                    className={`w-full max-w-full px-3 py-2 sm:px-4 border-2 rounded-lg focus:outline-none transition text-sm sm:text-base ${
                      validationErrors.start_date ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    style={{ WebkitAppearance: 'none' }}
                  />
                  {validationErrors.start_date && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </div>

                <div className="w-full max-w-full overflow-hidden">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Renovación <span className="text-red-500">*</span>
                    {formData.start_date && (
                      <span className="text-xs text-green-600 ml-2">✓ Auto-calculada</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={formData.renewal_date}
                    onChange={(e) => {
                      setFormData({ ...formData, renewal_date: e.target.value });
                      if (validationErrors.renewal_date && e.target.value) {
                        setValidationErrors(prev => ({ ...prev, renewal_date: false }));
                      }
                    }}
                    className={`w-full max-w-full px-3 py-2 sm:px-4 border-2 rounded-lg focus:outline-none transition text-sm sm:text-base ${
                      validationErrors.renewal_date ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    style={{ WebkitAppearance: 'none' }}
                    required
                  />
                  {validationErrors.renewal_date && (
                    <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition resize-none"
                  placeholder="Agrega cualquier información adicional sobre esta póliza..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Puedes agregar detalles importantes que quieras recordar sobre esta póliza
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Asignación */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-4">
                <FaUserTie size={24} />
                <h3 className="text-xl font-bold">Asignación de Corredor</h3>
              </div>

              {role === 'master' ? (
                <>
                  {selectedExistingClient && formData.broker_email && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-800">
                        <FaCheckCircle className="text-blue-600" />
                        <p className="text-sm font-medium">
                          Corredor autocompletado desde el cliente existente
                        </p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Corredor <span className="text-red-500">*</span>
                    </label>
                    <Select 
                      value={formData.broker_email} 
                      onValueChange={(value) => {
                        const selected = brokers.find((b: any) => b.profiles?.email === value);
                        // Aplicar condición especial ASSA + VIDA si aplica, sino usar default del broker
                        const percentToUse = specialOverride.hasSpecialOverride && specialOverride.overrideValue !== null
                          ? String(specialOverride.overrideValue)
                          : (selected as any)?.percent_default?.toString() || '';
                        
                        setFormData({ 
                          ...formData, 
                          broker_email: value,
                          percent_override: percentToUse
                        });
                        
                        if (validationErrors.broker_email && value) {
                          setValidationErrors(prev => ({ ...prev, broker_email: false }));
                        }
                      }}
                    >
                      <SelectTrigger className={`w-full border-2 ${
                        validationErrors.broker_email ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}>
                        <SelectValue placeholder="Seleccionar corredor..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-auto">
                        {brokers.map((broker: any) => (
                          <SelectItem key={broker.id} value={broker.profiles?.email || ''}>
                            {broker.name || broker.profiles?.full_name || 'Sin nombre'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.broker_email && (
                      <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porcentaje de Comisión (%) {specialOverride.hasSpecialOverride ? '(Condición Especial)' : ''} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.percent_override}
                      onChange={(e) => {
                        setFormData({ ...formData, percent_override: e.target.value });
                        if (validationErrors.percent_override && e.target.value.trim()) {
                          setValidationErrors(prev => ({ ...prev, percent_override: false }));
                        }
                      }}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none transition ${
                        validationErrors.percent_override 
                          ? 'border-red-500 focus:border-red-500' 
                          : specialOverride.hasSpecialOverride 
                            ? 'border-blue-300 bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                            : 'border-gray-300 focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20'
                      }`}
                      placeholder="15.5"
                    />
                    {validationErrors.percent_override && (
                      <p className="text-xs text-red-500 mt-1">⚠️ Este campo es obligatorio</p>
                    )}
                    {specialOverride.hasSpecialOverride ? (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 font-semibold">
                          🔒 Condición Especial ASSA + VIDA: 1.0% automático. Editable pero protegido de cambios masivos.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Porcentaje default del corredor seleccionado. Puede modificarse si es necesario.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Corredor asignado:</strong> Tú
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porcentaje de Comisión (%) {specialOverride.hasSpecialOverride ? '(Condición Especial)' : ''}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.percent_override}
                      readOnly
                      disabled
                      className={`w-full px-4 py-2 border-2 rounded-lg cursor-not-allowed ${
                        specialOverride.hasSpecialOverride 
                          ? 'border-blue-300 bg-blue-50 text-blue-900' 
                          : 'border-gray-300 bg-gray-100 text-gray-700'
                      }`}
                      placeholder="Se usará tu porcentaje default"
                    />
                    {specialOverride.hasSpecialOverride ? (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 font-semibold">
                          🔒 Condición Especial ASSA + VIDA: 1.0% automático aplicado.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-600 mt-2">
                        Se usará tu porcentaje de comisión predeterminado automáticamente
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmación */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-4">
                <FaCheckCircle size={24} />
                <h3 className="text-xl font-bold">Confirmar Información</h3>
              </div>

              {/* ADVERTENCIA PARA MASTER: Cliente existente con otro broker */}
              {role === 'master' && existingClientData && existingClientData.broker_id && (
                (() => {
                  // Obtener info del broker actual del cliente
                  const clientBrokerEmail = (existingClientData as any).brokers?.profiles?.email || '';
                  const clientBrokerName = (existingClientData as any).brokers?.name || 'Desconocido';
                  const isDifferentBroker = clientBrokerEmail !== formData.broker_email;
                  
                  return isDifferentBroker ? (
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-sm animate-fadeIn">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-yellow-800 mb-2">⚠️ Cliente Existente con Broker Diferente</h4>
                          <p className="text-sm text-yellow-700 mb-3">
                            El cliente <strong>{existingClientData.name}</strong> ya existe en la base de datos y actualmente está asignado a:
                          </p>
                          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-3">
                            <p className="text-xs text-yellow-800 mb-1">👤 <strong>Broker actual del cliente:</strong></p>
                            <p className="text-sm font-semibold text-yellow-900">{clientBrokerName}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-3">
                            <p className="text-xs text-blue-800 mb-1">👤 <strong>Broker que seleccionaste:</strong></p>
                            <p className="text-sm font-semibold text-blue-900">{formData.broker_email}</p>
                          </div>
                          <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                            <p className="text-xs text-green-800 mb-2">
                              ✅ <strong>Al continuar:</strong>
                            </p>
                            <ul className="text-xs text-green-700 space-y-1 ml-4">
                              <li>• La nueva póliza se asignará a <strong>{formData.broker_email}</strong></li>
                              <li>• El cliente seguirá asignado a <strong>{clientBrokerName}</strong></li>
                              <li>• Esta póliza quedará en la cartera de <strong>{formData.broker_email}</strong></li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()
              )}

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Cliente</h4>
                  <p className="text-lg font-bold text-[#010139]">{formData.client_name}</p>
                  {formData.national_id && <p className="text-sm text-gray-600">Cédula: {formData.national_id}</p>}
                  {!formData.national_id && (
                    <p className="text-sm text-amber-600 font-medium">⚠️ Cliente preliminar (sin cédula)</p>
                  )}
                </div>

                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm text-gray-600">Póliza</h4>
                  <p className="text-lg font-bold text-[#010139]">{formData.policy_number}</p>
                  <p className="text-sm text-gray-600">
                    {insurers.find(i => i.id === formData.insurer_id)?.name}
                  </p>
                  {formData.ramo && <p className="text-sm text-gray-600">{formData.ramo}</p>}
                </div>

                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm text-gray-600">Corredor</h4>
                  <p className="text-sm text-gray-800">{formData.broker_email}</p>
                  {formData.percent_override && (
                    <p className="text-sm text-gray-600">Comisión: {formData.percent_override}%</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t flex items-center justify-between gap-2 sm:gap-3 rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={loading}
            className="flex-1 sm:flex-none px-3 sm:px-6 py-2 text-sm sm:text-base text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="flex-1 sm:flex-none px-3 sm:px-6 py-2 text-sm sm:text-base bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 sm:flex-none px-3 sm:px-6 py-2 text-sm sm:text-base bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Creando...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Crear Cliente y Póliza</span>
                  <span className="sm:hidden">Crear</span>
                </>
              )}
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
