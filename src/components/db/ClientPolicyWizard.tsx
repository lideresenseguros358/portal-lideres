'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaUser, FaFileAlt, FaUserTie } from 'react-icons/fa';
import { supabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    national_id: '',
    email: '',
    phone: '',
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
  }, [role]);

  useEffect(() => {
    if (formData.start_date) {
      const startDate = new Date(formData.start_date);
      const renewalDate = new Date(startDate);
      renewalDate.setFullYear(startDate.getFullYear() + 1);
      const renewalDateStr = renewalDate.toISOString().split('T')[0] || '';
      
      if (!formData.renewal_date) {
        setFormData(prev => ({ ...prev, renewal_date: renewalDateStr }));
      }
    }
  }, [formData.start_date]);

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

    const { data } = await supabaseClient()
      .from('clients')
      .select('id, name, national_id, email, phone, broker_id')
      .ilike('name', `%${searchTerm}%`)
      .limit(5);

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
    if (step === 1) {
      if (!formData.client_name) {
        toast.error('El nombre del cliente es obligatorio');
        return false;
      }
    } else if (step === 2) {
      if (!formData.policy_number || !formData.insurer_id) {
        toast.error('Número de póliza y aseguradora son obligatorios');
        return false;
      }
      if (!formData.renewal_date) {
        toast.error('La fecha de renovación es obligatoria');
        return false;
      }
      // Validar que el número de póliza no exista
      const isValid = await validatePolicyNumber(formData.policy_number);
      if (!isValid) {
        toast.error('Esta póliza ya existe en el sistema');
        return false;
      }
    } else if (step === 3 && role === 'master') {
      if (!formData.broker_email) {
        toast.error('Debe seleccionar un corredor');
        return false;
      }
    }
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
        // Obtener broker_id del broker seleccionado
        const broker = role === 'master' 
          ? brokers.find((b: any) => b.profile?.email === formData.broker_email)
          : null;
        
        const { data: userData } = await supabaseClient().auth.getUser();
        const broker_id = broker ? broker.p_id : userData.user?.id;

        const policyPayload = {
          policy_number: formData.policy_number.toUpperCase(),
          insurer_id: formData.insurer_id,
          ramo: formData.ramo ? formData.ramo.toUpperCase() : null,
          start_date: formData.start_date || null,
          renewal_date: formData.renewal_date || null,
          status: formData.status as 'ACTIVA' | 'VENCIDA' | 'CANCELADA',
          notas: formData.notas || null,
          client_id: selectedExistingClient.id,
          broker_id: broker_id,
        };

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
        // Obtener broker_id del broker seleccionado
        const broker = role === 'master' 
          ? brokers.find((b: any) => b.profile?.email === formData.broker_email)
          : null;

        const clientData = {
          name: formData.client_name.toUpperCase(),
          national_id: formData.national_id ? formData.national_id.toUpperCase() : null,
          email: formData.email || null,
          phone: formData.phone || null,
          active: true,
          broker_id: broker?.p_id || undefined,
        };

        const policyData = {
          policy_number: formData.policy_number.toUpperCase(),
          insurer_id: formData.insurer_id,
          ramo: formData.ramo ? formData.ramo.toUpperCase() : null,
          start_date: formData.start_date || null,
          renewal_date: formData.renewal_date || null,
          status: formData.status as 'ACTIVA' | 'VENCIDA' | 'CANCELADA',
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
          throw new Error(result.error || 'Error al crear cliente');
        }

        console.log('[ClientPolicyWizard] Cliente creado exitosamente');
        toast.success('Cliente y póliza creados exitosamente');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Error al crear', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-4 py-3 sm:p-6 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h2 className="text-base sm:text-2xl font-bold">Nuevo Cliente y Póliza</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition p-1">
            <FaTimes size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-3 sm:px-6 py-2 sm:py-4 bg-gray-50 border-b flex-shrink-0">
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

        {/* Form Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-2 sm:mb-4">
                <FaUser size={20} className="sm:w-6 sm:h-6" />
                <h3 className="text-lg sm:text-xl font-bold">Datos del Cliente</h3>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-2 sm:p-3 rounded mb-2 sm:mb-4">
                <p className="text-xs sm:text-sm text-blue-800">
                  <span className="text-red-500 font-bold">*</span> Campos obligatorios. 
                  Los demás son opcionales.
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
                  })}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  className={`w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition ${uppercaseInputClass}`}
                  placeholder="Juan Pérez"
                />
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

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Cédula / Pasaporte / RUC
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, national_id: e.target.value }))}
                  className={`w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition ${uppercaseInputClass}`}
                  placeholder="8-123-4567"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  ℹ️ Campo opcional - puede dejarse vacío si no se dispone del dato
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                    placeholder="cliente@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                    placeholder="6000-0000"
                  />
                </div>
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
                <Select value={formData.insurer_id} onValueChange={(value) => setFormData({ ...formData, insurer_id: value })}>
                  <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19]">
                    <SelectValue placeholder="Seleccionar aseguradora..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-auto">
                    {insurers.map((ins) => (
                      <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Póliza <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.policy_number}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition ${uppercaseInputClass}`}
                  placeholder="POL-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ramo / Tipo de Seguro</label>
                <input
                  type="text"
                  value={formData.ramo}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, ramo: e.target.value }))}
                  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition ${uppercaseInputClass}`}
                  placeholder="Autos, Vida, Incendio..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      let renewalDate = formData.renewal_date || '';
                      
                      // Auto-calcular fecha de renovación (exactamente 1 año después)
                      if (startDate) {
                        const date = new Date(startDate + 'T00:00:00');
                        date.setFullYear(date.getFullYear() + 1);
                        const calculatedDate = date.toISOString().split('T')[0];
                        if (calculatedDate) {
                          renewalDate = calculatedDate;
                        }
                      }
                      
                      setFormData({ 
                        ...formData, 
                        start_date: startDate,
                        renewal_date: renewalDate
                      });
                    }}
                    className="w-full min-w-0 px-2 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition text-sm sm:text-base appearance-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Renovación <span className="text-red-500">*</span>
                    {formData.start_date && (
                      <span className="text-xs text-green-600 ml-2">✓ Auto-calculada</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={formData.renewal_date}
                    onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                    className="w-full min-w-0 px-2 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition text-sm sm:text-base appearance-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19] text-sm sm:text-base">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVA">Activa</SelectItem>
                    <SelectItem value="VENCIDA">Vencida</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
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
                        setFormData({ 
                          ...formData, 
                          broker_email: value,
                          percent_override: (selected as any)?.percent_default?.toString() || ''
                        });
                      }}
                    >
                      <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19]">
                        <SelectValue placeholder="Seleccionar corredor..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-auto">
                        {brokers.map((broker: any) => (
                          <SelectItem key={broker.id} value={broker.profile?.email}>
                            {broker.name || broker.profile?.full_name} ({broker.profile?.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Porcentaje de Comisión (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.percent_override}
                      onChange={(e) => setFormData({ ...formData, percent_override: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                      placeholder="15.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si se deja vacío, se usará el porcentaje default del corredor
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Corredor asignado:</strong> Tú ({userEmail})
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Se usará tu porcentaje de comisión predeterminado
                  </p>
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

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t flex items-center justify-between rounded-b-xl flex-shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 sm:px-6 py-2 text-sm sm:text-base text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition transform hover:scale-105"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Cliente'}
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
