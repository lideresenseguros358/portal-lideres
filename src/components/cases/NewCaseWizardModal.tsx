'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaUser, FaFileAlt, FaUpload, FaEye, FaPlus, FaTrash, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionCreateCase } from '@/app/(app)/cases/actions';
import { CASE_SECTIONS, CASE_STATUSES, MANAGEMENT_TYPES, POLICY_TYPES, getRequiredDocuments, type PolicyType } from '@/lib/constants/cases';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { supabaseClient } from '@/lib/supabase/client';
import { getClientDocuments, type ExpedienteDocument } from '@/lib/storage/expediente';
import RegisterPaymentWizard from '@/components/checks/RegisterPaymentWizard';

interface WizardProps {
  onClose: () => void;
  onSuccess: () => void;
  brokers: any[];
  insurers: any[];
  prefillData?: any;
}

export default function NewCaseWizardModal({ onClose, onSuccess, brokers, insurers, prefillData }: WizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [pagoOficina, setPagoOficina] = useState(false);
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [createdCaseData, setCreatedCaseData] = useState<any>(null);
  
  // Estados para determinación automática de sección
  const [isAssaLife, setIsAssaLife] = useState(false);
  const [customPolicyType, setCustomPolicyType] = useState('');
  
  // Estado para descuento de salario
  const [salaryDiscountType, setSalaryDiscountType] = useState<'CSS' | 'APADEA'>('CSS');
  
  // Estado para agregar documento personalizado
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  
  // Estados para cliente existente
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState<any>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [expedienteDocuments, setExpedienteDocuments] = useState<ExpedienteDocument[]>([]);
  
  // Estados para autenticación
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBrokerId, setUserBrokerId] = useState<string | null>(null);
  
  // Obtener información del usuario al montar
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabaseClient().auth.getUser();
      if (user) {
        const { data: profile } = await supabaseClient()
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setUserRole(profile?.role || null);
        
        // Si es broker, obtener su broker_id
        if (profile?.role === 'broker') {
          const { data: broker } = await supabaseClient()
            .from('brokers')
            .select('id')
            .eq('p_id', user.id)
            .single();
          
          setUserBrokerId(broker?.id || null);
          
          // Auto-seleccionar broker si es rol broker (solo si no hay prefillData)
          if (broker?.id && !prefillData) {
            setFormData(prev => ({ ...prev, broker_id: broker.id }));
          }
        }
      }
    };
    fetchUserInfo();
  }, [prefillData]);

  // Pre-llenar datos cuando viene de edición (prefillData)
  useEffect(() => {
    if (prefillData) {
      setFormData({
        client_id: prefillData.client_id || '',
        client_name: prefillData.client_name || '',
        broker_id: prefillData.broker_id || '',
        insurer_id: prefillData.insurer_id || '',
        policy_number: prefillData.policy_number || '',
        ctype: prefillData.ctype || 'EMISION_GENERAL',
        canal: prefillData.canal || 'ASEGURADORA',
        section: prefillData.section || 'RAMOS_GENERALES',
        status: prefillData.status || 'PENDIENTE_REVISION',
        management_type: prefillData.management_type || 'COTIZACION',
        policy_type: prefillData.policy_type || '',
        notes: prefillData.notes || '',
        premium: prefillData.premium || 0,
        payment_method: prefillData.payment_method || '',
        documents: [],
        customDocuments: [],
      });

      // Set ASSA checkbox if applicable
      if (prefillData.section === 'VIDA_ASSA') {
        setIsAssaLife(true);
      }
    }
  }, [prefillData]);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Data
    client_id: '',
    client_name: '',
    broker_id: '',
    insurer_id: '',
    policy_number: '',
    ctype: 'EMISION_GENERAL',
    canal: 'ASEGURADORA',
    
    // Step 2: Classification
    section: 'RAMOS_GENERALES',
    status: 'PENDIENTE_REVISION',
    management_type: 'COTIZACION',
    policy_type: '' as PolicyType | '',
    notes: '',
    premium: 0,
    payment_method: '',
    
    // Step 3: Documents
    documents: [] as { label: string; required: boolean; standardName: string; category?: string; file?: File; uploaded: boolean; isMultiDocument?: boolean; documentParts?: string[] }[],
    customDocuments: [] as { label: string; standardName: string; file?: File; uploaded: boolean }[],
  });

  const steps = [
    { num: 1, label: 'Datos Básicos', icon: FaUser, description: 'Cliente y corredor' },
    { num: 2, label: 'Clasificación', icon: FaFileAlt, description: 'Tipo y estado del caso' },
    { num: 3, label: 'Documentos', icon: FaUpload, description: 'Archivos requeridos' },
    { num: 4, label: 'Confirmar', icon: FaEye, description: 'Revisar y crear' },
  ];

  const handleNext = () => {
    // Validation for each step
    if (step === 1) {
      if (!formData.broker_id) {
        toast.error('Selecciona un corredor');
        return;
      }
      if (!formData.client_name && !formData.client_id) {
        toast.error('Ingresa el nombre del cliente');
        return;
      }
    }

    if (step === 2) {
      if (!formData.policy_type) {
        toast.error('Selecciona un tipo de póliza');
        return;
      }
      
      // Validaciones específicas para tipo OTROS
      if (formData.policy_type === 'OTROS') {
        if (!customPolicyType.trim()) {
          toast.error('Especifica el tipo de póliza cuando seleccionas "Otros"');
          return;
        }
        if (!formData.section || formData.section === 'SIN_CLASIFICAR') {
          toast.error('Selecciona una sección manualmente para tipo "Otros"');
          return;
        }
      }
      
      // Validar sección (ya se determina automáticamente excepto para OTROS)
      if (!formData.section || formData.section === 'SIN_CLASIFICAR') {
        toast.error('Error al determinar la sección del caso');
        return;
      }
      
      // Prima obligatoria para Pago Oficina
      if (pagoOficina && (!formData.premium || formData.premium <= 0)) {
        toast.error('La prima es obligatoria cuando se marca "Pago Oficina"');
        return;
      }
      
      // Prima obligatoria para Descuento a corredor
      if (formData.payment_method === 'DESCUENTO_A_CORREDOR' && (!formData.premium || formData.premium <= 0)) {
        toast.error('La prima es obligatoria para crear el adelanto al corredor');
        return;
      }
    }

    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Buscar clientes existentes
  const searchClients = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setExistingClients([]);
      setShowClientSuggestions(false);
      return;
    }

    let query = supabaseClient()
      .from('clients')
      .select('id, name, national_id, email, phone, broker_id')
      .ilike('name', `%${searchTerm}%`);
    
    // Si es broker, solo mostrar sus clientes
    if (userRole === 'broker' && userBrokerId) {
      query = query.eq('broker_id', userBrokerId);
    }
    
    const { data } = await query.limit(5);

    setExistingClients(data || []);
    setShowClientSuggestions(true);
  };

  // Seleccionar cliente existente
  const selectExistingClient = async (client: any) => {
    setSelectedExistingClient(client);
    setShowClientSuggestions(false);
    
    // Auto-cargar broker del cliente
    let brokerIdToSet = formData.broker_id;
    if (client.broker_id) {
      try {
        const { data: brokerData } = await supabaseClient()
          .from('brokers')
          .select('id, p_id')
          .eq('id', client.broker_id)
          .single();
        
        if (brokerData) {
          brokerIdToSet = brokerData.id;
        }
      } catch (error) {
        console.error('Error al obtener broker del cliente:', error);
      }
    }

    // Cargar documentos del expediente
    try {
      const docsResult = await getClientDocuments(client.id);
      if (docsResult.ok && docsResult.data) {
        setExpedienteDocuments(docsResult.data);
        
        const cedulaDoc = docsResult.data.find(d => d.document_type === 'cedula');
        const licenciaDoc = docsResult.data.find(d => d.document_type === 'licencia');
        
        if (cedulaDoc || licenciaDoc) {
          toast.success('Documentos del expediente cargados', {
            description: `${cedulaDoc ? 'Cédula' : ''}${cedulaDoc && licenciaDoc ? ' y ' : ''}${licenciaDoc ? 'Licencia' : ''} disponibles`,
          });
        }
      }
    } catch (error) {
      console.error('Error al cargar documentos:', error);
    }
    
    setFormData({
      ...formData,
      client_id: client.id,
      client_name: client.name,
      broker_id: brokerIdToSet,
    });
    
    toast.success(`Cliente "${client.name}" seleccionado`);
  };

  // Determinar sección automáticamente según tipo de póliza
  useEffect(() => {
    if (!formData.policy_type) return;
    
    let autoSection = 'RAMOS_GENERALES';
    
    if (formData.policy_type === 'VIDA') {
      // Para VIDA, depende del checkbox ASSA
      autoSection = isAssaLife ? 'VIDA_ASSA' : 'OTROS_PERSONAS';
    } else if (['SALUD', 'ACCIDENTES_PERSONALES'].includes(formData.policy_type)) {
      autoSection = 'OTROS_PERSONAS';
    } else if (['AUTO', 'INCENDIO', 'TODO_RIESGO', 'RESPONSABILIDAD_CIVIL'].includes(formData.policy_type)) {
      autoSection = 'RAMOS_GENERALES';
    } else if (formData.policy_type === 'OTROS') {
      // Para OTROS, la sección se elige manualmente
      autoSection = formData.section || 'RAMOS_GENERALES';
    }
    
    setFormData(prev => ({ ...prev, section: autoSection }));
  }, [formData.policy_type, isAssaLife]);
  
  // Load documents when policy type or management type changes
  useEffect(() => {
    if (formData.policy_type && formData.management_type) {
      const docs = getRequiredDocuments(formData.policy_type, formData.management_type, isAssaLife);
      const documentsWithState = docs.map(doc => {
        // Auto-marcar como completado si existe en el expediente
        let isFromExpediente = false;
        if (doc.standardName === 'cedula' && expedienteDocuments.find(d => d.document_type === 'cedula')) {
          isFromExpediente = true;
        } else if (doc.standardName === 'licencia' && expedienteDocuments.find(d => d.document_type === 'licencia')) {
          isFromExpediente = true;
        }
        
        return {
          ...doc,
          uploaded: isFromExpediente,
          file: undefined,
        };
      });
      setFormData(prev => ({ ...prev, documents: documentsWithState }));
    }
  }, [formData.policy_type, formData.management_type, isAssaLife, expedienteDocuments]);

  const handleAddCustomDocument = () => {
    if (!newDocName.trim()) {
      toast.error('Ingresa el nombre del documento');
      return;
    }

    const newDoc = {
      label: newDocName.trim(),
      required: true, // Siempre obligatorio
      standardName: `custom_${Date.now()}`,
      uploaded: false,
      file: undefined,
    };

    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));

    setNewDocName('');
    setShowAddDocModal(false);
    toast.success(`Documento "${newDoc.label}" agregado como obligatorio`);
  };

  const handleRemoveCustomDocument = (index: number) => {
    const doc = formData.documents[index];
    if (!doc || !doc.standardName.startsWith('custom_')) {
      toast.error('No puedes eliminar documentos estándar');
      return;
    }

    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));

    toast.success('Documento personalizado eliminado');
  };

  const handleSubmit = async () => {
    setSaving(true);

    // Prepare checklist from documents
    const checklist = formData.documents.map(doc => ({
      label: doc.label,
      required: doc.required,
      completed: doc.uploaded,
      standardName: doc.standardName,
    }));

    // Add custom documents to checklist
    formData.customDocuments.forEach(customDoc => {
      checklist.push({
        label: customDoc.label,
        required: false,
        completed: customDoc.uploaded,
        standardName: customDoc.standardName,
      });
    });

    // Prepare files for upload
    const files: any[] = [];
    formData.documents.forEach(doc => {
      if (doc.file) {
        files.push({
          file: doc.file,
          standardName: doc.standardName,
          category: doc.category,
          isMultiDocument: doc.isMultiDocument,
          documentParts: doc.documentParts,
        });
      }
    });

    formData.customDocuments.forEach(customDoc => {
      if (customDoc.file) {
        files.push({
          file: customDoc.file,
          standardName: customDoc.standardName,
        });
      }
    });

    // Prepare data for submission
    const caseData: any = {
      section: formData.section,
      status: formData.status,
      ctype: formData.ctype,
      canal: formData.canal,
      management_type: formData.management_type,
      policy_type: formData.policy_type || undefined,
      insurer_id: formData.insurer_id || undefined,
      broker_id: formData.broker_id,
      client_id: formData.client_id || undefined,
      client_name: formData.client_name || undefined,
      policy_number: formData.policy_number || undefined,
      premium: formData.premium || undefined,
      payment_method: formData.payment_method || undefined,
      notes: formData.notes || undefined,
      checklist,
      files,
    };

    const result = await actionCreateCase(caseData);

    if (result.ok) {
      toast.success('✅ Caso creado correctamente');
      
      // Si marcó "Pago Oficina", abrir wizard de pagos pendientes
      if (pagoOficina) {
        setCreatedCaseData({
          caseId: result.data?.id,
          client_name: formData.client_name,
          policy_number: formData.policy_number,
          insurer_id: formData.insurer_id,
          premium: formData.premium,
        });
        setShowPaymentWizard(true);
        setSaving(false);
      } else {
        onSuccess();
        onClose();
      }
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  };

  const getBrokerName = (brokerId: string) => {
    const broker = brokers.find((b: any) => b.id === brokerId);
    return (broker as any)?.name || (broker as any)?.profile?.full_name || (broker as any)?.email || 'Sin nombre';
  };

  const getInsurerName = (insurerId: string) => {
    const insurer = insurers.find(i => i.id === insurerId);
    return insurer?.name || 'Sin aseguradora';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full my-4 sm:my-8 shadow-2xl flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-4 sm:p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold">Nuevo Caso (Trámite)</h2>
            <p className="text-white/90 text-xs sm:text-sm mt-1">Paso {step} de 4 - {steps[step - 1]?.description}</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="text-white hover:text-gray-200 transition disabled:opacity-50"
            title="Cerrar"
          >
            <FaTimes size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b flex-shrink-0 overflow-x-auto">
          <div className="flex items-center min-w-max sm:min-w-0 sm:justify-between gap-1 sm:gap-0">
            {steps.map((s, index) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isCompleted = step > s.num;

              return (
                <div key={s.num} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all text-sm sm:text-base
                        ${isCompleted ? 'bg-[#8AAA19] text-white shadow-md' : ''}
                        ${isActive ? 'bg-[#010139] text-white shadow-lg scale-110' : ''}
                        ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                      `}
                    >
                      {isCompleted ? <FaCheckCircle className="text-white" size={14} /> : <Icon className={isActive ? 'text-white' : ''} size={14} />}
                    </div>
                    <p className={`
                      text-[9px] sm:text-xs mt-1 text-center font-semibold whitespace-nowrap px-1
                      ${isActive ? 'text-[#010139]' : 'text-gray-500'}
                    `}>
                      {s.label}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      h-1 sm:h-1.5 w-6 sm:w-12 md:w-20 mx-1 sm:mx-2 transition-all flex-shrink-0 rounded-full
                      ${step > s.num ? 'bg-[#8AAA19]' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Step 1: Basic Data */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-3">
                <FaUser size={20} />
                <h3 className="text-lg sm:text-xl font-bold">Información Básica</h3>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-sm">
                <p className="text-blue-800">
                  <strong>💡 Sugerencia:</strong> Completa los datos principales del cliente y el caso.
                </p>
              </div>

              {/* Broker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Corredor <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.broker_id}
                  onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                  disabled={userRole === 'broker'}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Selecciona un corredor</option>
                  {brokers.map((broker: any) => (
                    <option key={broker.id} value={broker.id}>
                      {broker.name || broker.profile?.full_name || broker.email}
                    </option>
                  ))}
                </select>
                {userRole === 'broker' && (
                  <p className="text-xs text-gray-500 mt-1">✓ Auto-asignado a tu cuenta</p>
                )}
              </div>

              {/* Client Name with Search */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre del Cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={createUppercaseHandler((e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, client_name: value, client_id: '' });
                    setSelectedExistingClient(null);
                    searchClients(value);
                  })}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  placeholder="INGRESA EL NOMBRE DEL CLIENTE"
                  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                />
                
                {/* Suggestions Dropdown */}
                {showClientSuggestions && existingClients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="p-2 bg-blue-50 text-xs text-blue-700 border-b">
                      📋 Clientes existentes - Click para auto-completar
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
                
                {/* Selected Client Indicator */}
                {selectedExistingClient && (
                  <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <FaCheckCircle /> Cliente existente - Datos y expediente cargados
                  </div>
                )}
                
                {/* Expediente Documents Indicator */}
                {expedienteDocuments.length > 0 && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <span className="font-semibold text-green-800">📁 Expediente:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {expedienteDocuments.map((doc, idx) => (
                        <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded">
                          {doc.document_type === 'cedula' ? '🪪 Cédula' : 
                           doc.document_type === 'licencia' ? '🚗 Licencia' : 
                           doc.document_name || 'Otro'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Insurer */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Aseguradora
                </label>
                <select
                  value={formData.insurer_id}
                  onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="">Selecciona una aseguradora (opcional)</option>
                  {insurers.map((insurer) => (
                    <option key={insurer.id} value={insurer.id}>
                      {insurer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Policy Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número de Póliza
                </label>
                <input
                  type="text"
                  value={formData.policy_number}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                  placeholder="POL-12345 (opcional)"
                  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                />
              </div>

              {/* Canal */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Canal
                </label>
                <select
                  value={formData.canal}
                  onChange={(e) => setFormData({ ...formData, canal: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="ASEGURADORA">Aseguradora</option>
                  <option value="OFICINA">Oficina</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Classification */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-3">
                <FaFileAlt size={20} />
                <h3 className="text-lg sm:text-xl font-bold">Clasificación del Caso</h3>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-sm">
                <p className="text-blue-800">
                  <strong>💡 Sugerencia:</strong> Selecciona el tipo de póliza. La sección se determinará automáticamente.
                </p>
              </div>

              {/* Policy Type - PRIMERO */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Póliza <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.policy_type}
                  onChange={(e) => {
                    const newType = e.target.value as PolicyType;
                    setFormData({ ...formData, policy_type: newType });
                    // Reset ASSA checkbox cuando cambia el tipo
                    if (newType !== 'VIDA') {
                      setIsAssaLife(false);
                    }
                    // Reset custom type cuando cambia
                    if (newType !== 'OTROS') {
                      setCustomPolicyType('');
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="">Selecciona un tipo de póliza</option>
                  {Object.entries(POLICY_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox ASSA - Solo para VIDA */}
              {formData.policy_type === 'VIDA' && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAssaLife}
                      onChange={(e) => setIsAssaLife(e.target.checked)}
                      className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-700">🏢 ¿Es póliza ASSA?</span>
                      <p className="text-xs text-gray-600 mt-1">
                        {isAssaLife 
                          ? '✓ Se registrará en: Vida ASSA' 
                          : 'Se registrará en: Otros Personas (otras aseguradoras)'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Inputs manuales - Solo para OTROS */}
              {formData.policy_type === 'OTROS' && (
                <>
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Especifica el Tipo de Póliza <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customPolicyType}
                      onChange={createUppercaseHandler((e) => setCustomPolicyType(e.target.value))}
                      placeholder="EJ: FIANZA, TRANSPORTE, ETC."
                      className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none ${uppercaseInputClass}`}
                    />
                    <p className="text-xs text-orange-600 mt-1">
                      ℹ️ Ingresa manualmente el tipo de póliza específico
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sección Manual <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    >
                      {Object.entries(CASE_SECTIONS).filter(([key]) => key !== 'SIN_CLASIFICAR').map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      ℹ️ Selecciona manualmente la sección apropiada
                    </p>
                  </div>
                </>
              )}

              {/* Mostrar sección determinada automáticamente */}
              {formData.policy_type && formData.policy_type !== 'OTROS' && (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    <strong>📂 Sección:</strong> {CASE_SECTIONS[formData.section as keyof typeof CASE_SECTIONS]}
                    <span className="text-xs text-gray-500 ml-2">(determinada automáticamente)</span>
                  </p>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado Inicial
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  {Object.entries(CASE_STATUSES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Management Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Gestión
                </label>
                <select
                  value={formData.management_type}
                  onChange={(e) => setFormData({ ...formData, management_type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  {Object.entries(MANAGEMENT_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Forma de Pago (opcional)
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="">Selecciona forma de pago</option>
                  <option value="VOLUNTARIO">Voluntario</option>
                  <option value="ACH">ACH</option>
                  <option value="TCR">TCR</option>
                  <option value="DESCUENTO_A_CORREDOR">Descuento a Corredor</option>
                  {/* Descuento de salario solo para VIDA ASSA */}
                  {isAssaLife && formData.policy_type === 'VIDA' && (
                    <option value="DESCUENTO_SALARIO">Descuento de Salario</option>
                  )}
                </select>
              </div>

              {/* Selector CSS/APADEA para Descuento de Salario */}
              {formData.payment_method === 'DESCUENTO_SALARIO' && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Descuento de Salario <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="CSS"
                        checked={salaryDiscountType === 'CSS'}
                        onChange={(e) => setSalaryDiscountType(e.target.value as 'CSS' | 'APADEA')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-semibold">CSS</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="APADEA"
                        checked={salaryDiscountType === 'APADEA'}
                        onChange={(e) => setSalaryDiscountType(e.target.value as 'CSS' | 'APADEA')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-semibold">APADEA</span>
                    </label>
                  </div>
                  <p className="text-xs text-purple-600 mt-2">
                    ℹ️ Selecciona la entidad para descuento de salario
                  </p>
                </div>
              )}

              {/* Premium */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Prima {(pagoOficina || formData.payment_method === 'DESCUENTO_A_CORREDOR') && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="number"
                  value={formData.premium || ''}
                  onChange={(e) => setFormData({ ...formData, premium: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                />
                {pagoOficina && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ La prima es obligatoria cuando se marca "Pago Oficina"
                  </p>
                )}
                {formData.payment_method === 'DESCUENTO_A_CORREDOR' && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ La prima es obligatoria para crear el adelanto al corredor
                  </p>
                )}
              </div>

              {/* Pago Oficina Checkbox */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagoOficina}
                    onChange={(e) => setPagoOficina(e.target.checked)}
                    className="mt-1 w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-700">💰 Pago Oficina</span>
                    <p className="text-xs text-gray-600 mt-1">
                      Marcar para registrar un pago pendiente en oficina. Se abrirá el wizard de pagos pendientes después de crear el caso.
                    </p>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas / Descripción
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Detalles adicionales del caso..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-3">
                <FaUpload size={20} />
                <h3 className="text-lg sm:text-xl font-bold">Documentos Requeridos</h3>
              </div>

              {formData.documents.length === 0 && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 font-semibold">
                    ⚠️ Selecciona un tipo de póliza en el paso anterior para ver los documentos requeridos
                  </p>
                </div>
              )}

              {expedienteDocuments.length > 0 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded text-sm">
                  <p className="text-green-800">
                    <strong>✅ Expediente Disponible</strong> - Cédula y/o licencia ya marcados como completados
                  </p>
                </div>
              )}

              {/* Botón + para agregar documentos personalizados */}
              {formData.documents.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowAddDocModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg font-semibold transition-all"
                  >
                    <FaPlus className="text-white" />
                    Agregar Documento Obligatorio
                  </button>
                </div>
              )}

              {formData.documents.length > 0 && (
                <div className="space-y-3">
                  {formData.documents.map((doc, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${doc.uploaded ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-700">{doc.label}</p>
                            {doc.required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">Obligatorio</span>
                            )}
                            {doc.standardName.startsWith('custom_') && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">Personalizado</span>
                            )}
                            {doc.uploaded && !doc.file && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                                📁 Del Expediente
                              </span>
                            )}
                          </div>
                          
                          {doc.file && (
                            <p className="text-xs text-gray-600 mt-1">
                              📄 {doc.file.name} ({(doc.file.size / 1024).toFixed(2)} KB)
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {/* Botón para eliminar documento personalizado */}
                          {doc.standardName.startsWith('custom_') && (
                            <button
                              onClick={() => handleRemoveCustomDocument(index)}
                              className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg text-sm"
                              title="Eliminar documento personalizado"
                            >
                              <FaTrash className="text-white" />
                            </button>
                          )}

                          <label className={`cursor-pointer px-3 py-2 rounded-lg text-sm font-semibold transition-all ${doc.uploaded ? 'bg-green-600 hover:bg-green-700' : 'bg-[#010139] hover:bg-[#020270]'} text-white`}>
                            {doc.uploaded ? '✓ OK' : '📎 Adjuntar'}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const newDocuments = [...formData.documents];
                                  newDocuments[index] = {
                                    ...doc,
                                    file,
                                    uploaded: true,
                                  };
                                  setFormData({ ...formData, documents: newDocuments });
                                  toast.success(`✅ ${doc.label} adjuntado`);
                                }
                              }}
                            />
                          </label>

                          {doc.uploaded && doc.file && (
                            <button
                              onClick={() => {
                                const newDocuments = [...formData.documents];
                                newDocuments[index] = {
                                  ...doc,
                                  file: undefined,
                                  uploaded: false,
                                };
                                setFormData({ ...formData, documents: newDocuments });
                                toast.info('Archivo eliminado');
                              }}
                              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                            >
                              <FaTrash className="text-white" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {formData.documents.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 text-center">
                    💡 Los documentos son opcionales. Puedes adjuntarlos ahora o después desde el detalle del caso.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-[#010139] mb-3">
                <FaEye size={20} />
                <h3 className="text-lg sm:text-xl font-bold">Revisar y Confirmar</h3>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-sm">
                <p className="text-blue-800">
                  <strong>✓ Revisa la información</strong> antes de crear el caso
                </p>
              </div>

              {/* Summary */}
              <div className="space-y-3">
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-700 mb-3">📋 Información Básica</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Cliente:</span>
                      <p className="font-semibold text-gray-900">{formData.client_name || 'Sin nombre'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Corredor:</span>
                      <p className="font-semibold text-gray-900">{getBrokerName(formData.broker_id)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Aseguradora:</span>
                      <p className="font-semibold text-gray-900">{formData.insurer_id ? getInsurerName(formData.insurer_id) : 'No especificada'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Póliza:</span>
                      <p className="font-semibold text-gray-900">{formData.policy_number || 'No especificada'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-700 mb-3">📁 Clasificación</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Sección:</span>
                      <p className="font-semibold text-gray-900">{CASE_SECTIONS[formData.section as keyof typeof CASE_SECTIONS]}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Tipo de Póliza:</span>
                      <p className="font-semibold text-gray-900">{formData.policy_type ? POLICY_TYPES[formData.policy_type as PolicyType] : 'No especificado'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Estado:</span>
                      <p className="font-semibold text-gray-900">{CASE_STATUSES[formData.status as keyof typeof CASE_STATUSES]}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Gestión:</span>
                      <p className="font-semibold text-gray-900">{MANAGEMENT_TYPES[formData.management_type as keyof typeof MANAGEMENT_TYPES]}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-700 mb-3">📎 Documentos</h4>
                  <div className="text-sm">
                    <p className="text-gray-600">
                      {formData.documents.filter(d => d.uploaded).length} de {formData.documents.length} documentos adjuntados
                    </p>
                    {formData.documents.filter(d => d.uploaded).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {formData.documents.filter(d => d.uploaded).map((doc, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            ✓ {doc.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="border-t bg-gray-50 p-4 sm:p-6 flex items-center justify-between gap-3 flex-shrink-0 rounded-b-2xl">
          <button
            onClick={handlePrev}
            disabled={step === 1 || saving}
            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FaArrowLeft className="text-sm" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex-1 text-center text-sm text-gray-600">
            Paso {step} de 4
          </div>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="px-4 py-2.5 bg-gradient-to-r from-[#010139] to-[#020270] hover:shadow-lg text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <FaArrowRight className="text-sm text-white" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:shadow-lg text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <FaCheckCircle className="text-white" />
                  <span>Crear Caso</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal para agregar documento personalizado obligatorio */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-[#8AAA19]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#010139]">📄 Agregar Documento Obligatorio</h3>
              <button
                onClick={() => {
                  setShowAddDocModal(false);
                  setNewDocName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <FaTimes className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-sm">
                <p className="text-blue-800">
                  El documento se agregará como <strong>obligatorio</strong> al checklist del caso
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre del Documento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={createUppercaseHandler((e) => setNewDocName(e.target.value))}
                  placeholder="EJ: CARTA DE AUTORIZACIÓN"
                  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomDocument();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddDocModal(false);
                    setNewDocName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCustomDocument}
                  disabled={!newDocName.trim()}
                  className="flex-1 px-4 py-2.5 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <FaPlus className="text-white" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Wizard Modal - Se abre después de crear caso con Pago Oficina */}
      {showPaymentWizard && createdCaseData && (
        <RegisterPaymentWizard
          onClose={() => {
            setShowPaymentWizard(false);
            onSuccess();
            onClose();
          }}
          onSuccess={() => {
            setShowPaymentWizard(false);
            onSuccess();
            onClose();
          }}
          prefillData={{
            client_name: createdCaseData.client_name,
            policy_number: createdCaseData.policy_number,
            insurer_id: createdCaseData.insurer_id,
            amount_to_pay: createdCaseData.premium,
            purpose: 'poliza',
            notes: `Caso #${createdCaseData.caseId} - Pago oficina`,
          }}
        />
      )}
    </div>
  );
}
