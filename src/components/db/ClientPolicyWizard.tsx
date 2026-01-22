'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadInsurers();
    if (role === 'master') {
      loadBrokers();
    }
    
    // Obtener broker_id y percent_default si es broker
    if (role === 'broker') {
      const fetchBrokerInfo = async () => {
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
      };
      fetchBrokerInfo();
    }
  }, [role]);

  useEffect(() => {
    if (formData.start_date && !formData.renewal_date) {
      const calculatedRenewalDate = addOneYearToDate(formData.start_date);
      setFormData(prev => ({ ...prev, renewal_date: calculatedRenewalDate }));
    }
  }, [formData.start_date, formData.renewal_date]);
  
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
    // Get brokers
    const { data: brokersData } = await supabaseClient()
      .from('brokers')
      .select('*')
      .eq('active', true)
      .order('name');

    if (!brokersData) {
      setBrokers([]);
      return;
    }

    // Get profiles for brokers
    const brokerIds = brokersData.map(b => b.p_id);
    const { data: profilesData } = await supabaseClient()
      .from('profiles')
      .select('id, full_name, email')
      .in('id', brokerIds);

    // Merge brokers with profiles
    const merged = brokersData.map(broker => ({
      ...broker,
      profile: profilesData?.find(p => p.id === broker.p_id)
    }));

    setBrokers(merged || []);
  };

  const searchClients = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setExistingClients([]);
      setShowClientSuggestions(false);
      return;
    }

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
  };

  const selectExistingClient = async (client: any) => {
    setSelectedExistingClient(client);
    
    let brokerEmail = formData.broker_email;
    
    // Auto-completar broker del cliente existente (solo para Master)
    if (client.broker_id && role === 'master') {
      try {
        // Paso 1: Obtener el p_id del broker
        const { data: brokerData } = await supabaseClient()
          .from('brokers')
          .select('p_id')
          .eq('id', client.broker_id)
          .single();
        
        if (brokerData?.p_id) {
          // Paso 2: Obtener el email del perfil
          const { data: profileData } = await supabaseClient()
            .from('profiles')
            .select('email')
            .eq('id', brokerData.p_id)
            .single();
          
          if (profileData?.email) {
            brokerEmail = profileData.email;
            console.log('[ClientPolicyWizard] Broker auto-completado:', brokerEmail);
          }
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
    if (!policyNumber) return true;

    const { data } = await supabaseClient()
      .from('policies')
      .select('id')
      .eq('policy_number', policyNumber)
      .single();

    return !data; // true si no existe, false si ya existe
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
        toast.error('Esta póliza ya existe en el sistema');
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
          const broker = brokers.find((b: any) => b.profile?.email === formData.broker_email);
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
          const broker = brokers.find((b: any) => b.profile?.email === formData.broker_email);
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
          
          // Manejar error de póliza duplicada específicamente
          if (result.error?.includes('duplicate key') || result.error?.includes('policies_policy_number_key')) {
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
        <div className="p-6 overflow-y-auto flex-1">
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
                }}
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

              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento {documentType !== 'ruc' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  required={documentType !== 'ruc'}
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
            </div>
          )}

          {/* Step 2: Póliza */}
          {step === 2 && (
            <div className="space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-2 sm:mb-4">
                <FaFileAlt size={20} className="sm:w-6 sm:h-6" />
                <h3 className="text-lg sm:text-xl font-bold">Datos de la Póliza</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aseguradora <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={formData.insurer_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, insurer_id: value });
                    if (validationErrors.insurer_id && value) {
                      setValidationErrors(prev => ({ ...prev, insurer_id: false }));
                    }
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
                    }}
                    label="Número de Póliza"
                    required
                    hasError={validationErrors.policy_number}
                  />
                  {validationErrors.policy_number && (
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
                        const selected = brokers.find((b: any) => b.profile?.email === value);
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
                          <SelectItem key={broker.id} value={broker.profile?.email}>
                            {broker.name || broker.profile?.full_name}
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
