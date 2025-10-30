'use client';

import { useState, useEffect } from 'react';
import { FaArrowLeft, FaArrowRight, FaCheck, FaTimes, FaUser, FaFileAlt, FaUpload, FaEye, FaPlus, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { actionCreateCase } from '@/app/(app)/cases/actions';
import { CASE_SECTIONS, CASE_STATUSES, MANAGEMENT_TYPES, POLICY_TYPES, REQUIRED_DOCUMENTS, type PolicyType } from '@/lib/constants/cases';
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { supabaseClient } from '@/lib/supabase/client';
import { getClientDocuments, type ExpedienteDocument } from '@/lib/storage/expediente';

interface NewCaseWizardProps {
  brokers: any[];
  clients: any[];
  insurers: any[];
}

export default function NewCaseWizard({ brokers, clients, insurers }: NewCaseWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Estados para cliente existente
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState<any>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [expedienteDocuments, setExpedienteDocuments] = useState<ExpedienteDocument[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Data
    client_id: '',
    client_name: '',
    broker_id: '',
    insurer_id: '',
    policy_number: '',
    ctype: 'REGULAR', // Type of case
    canal: 'ASEGURADORA',
    
    // Step 2: Classification
    section: 'SIN_CLASIFICAR',
    status: 'PENDIENTE_REVISION',
    management_type: 'COTIZACION',
    policy_type: '' as PolicyType | '',
    notes: '',
    premium: 0,
    payment_method: '',
    
    // Step 3: Documents and Files (unified)
    documents: [] as { label: string; required: boolean; standardName: string; category?: string; file?: File; uploaded: boolean; isMultiDocument?: boolean; documentParts?: string[] }[],
    customDocuments: [] as { label: string; standardName: string; file?: File; uploaded: boolean }[],
    
    // Step 4: Review (no additional fields)
  });

  const steps = [
    { num: 1, label: 'Datos básicos', shortLabel: 'Datos', icon: FaUser },
    { num: 2, label: 'Clasificación', shortLabel: 'Clasif.', icon: FaFileAlt },
    { num: 3, label: 'Documentos', shortLabel: 'Docs', icon: FaUpload },
    { num: 4, label: 'Revisión', shortLabel: 'Review', icon: FaEye },
  ];

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 1) {
      if (!formData.broker_id) {
        toast.error('Selecciona un corredor');
        return;
      }
      if (!formData.client_name && !formData.client_id) {
        toast.error('Ingresa el nombre del cliente o selecciona uno existente');
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.section || formData.section === 'SIN_CLASIFICAR') {
        toast.error('Selecciona una sección');
        return;
      }
      if (!formData.policy_type) {
        toast.error('Selecciona un tipo de póliza');
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Buscar clientes existentes
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

  // Seleccionar cliente existente y cargar toda su información
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
        console.error('[NewCaseWizard] Error al obtener broker del cliente:', error);
      }
    }

    // Cargar documentos del expediente
    try {
      const docsResult = await getClientDocuments(client.id);
      if (docsResult.ok && docsResult.data) {
        setExpedienteDocuments(docsResult.data);
        
        // Auto-completar documentos cédula y licencia si existen
        const cedulaDoc = docsResult.data.find(d => d.document_type === 'cedula');
        const licenciaDoc = docsResult.data.find(d => d.document_type === 'licencia');
        
        if (cedulaDoc || licenciaDoc) {
          toast.success('Documentos del expediente cargados', {
            description: `${cedulaDoc ? 'Cédula' : ''}${cedulaDoc && licenciaDoc ? ' y ' : ''}${licenciaDoc ? 'Licencia' : ''} disponibles`,
          });
        }
      }
    } catch (error) {
      console.error('[NewCaseWizard] Error al cargar documentos:', error);
    }
    
    setFormData({
      ...formData,
      client_id: client.id,
      client_name: client.name,
      broker_id: brokerIdToSet,
    });
    
    toast.success(`Cliente "${client.name}" seleccionado`, {
      description: 'Se cargó la información del cliente y su corredor asignado',
    });
  };

  // Load documents when policy type changes
  useEffect(() => {
    if (formData.policy_type) {
      const docs = REQUIRED_DOCUMENTS[formData.policy_type as PolicyType] || [];
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
          uploaded: isFromExpediente, // Auto-marcar si está en expediente
          file: undefined,
        };
      });
      setFormData(prev => ({ ...prev, documents: documentsWithState }));
    }
  }, [formData.policy_type, expedienteDocuments]);

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
      ctype: formData.ctype,
      canal: formData.canal,
      management_type: formData.management_type,
      policy_type: formData.policy_type || undefined,
      insurer_id: formData.insurer_id || undefined, // Cambiado de '' a undefined para evitar FK constraint error
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
      toast.success('Caso creado correctamente');
      router.push(`/cases`);
    } else {
      toast.error(result.error);
      setSaving(false);
    }
  };

  const getBrokerName = (brokerId: string) => {
    const broker = brokers.find((b: any) => b.id === brokerId);
    return (broker as any)?.name || (broker as any)?.profile?.full_name || (broker as any)?.email || 'Sin nombre';
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Sin nombre';
  };

  const getInsurerName = (insurerId: string) => {
    const insurer = insurers.find(i => i.id === insurerId);
    return insurer?.name || 'Sin nombre';
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/cases"
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <FaArrowLeft className="text-gray-600" />
          </Link>
          <div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 py-2">
          <div className="flex items-center min-w-max sm:min-w-0 sm:justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;

              return (
                <div key={step.num} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all
                        ${isCompleted ? 'bg-[#8AAA19] text-white' : ''}
                        ${isActive ? 'bg-[#010139] text-white shadow-lg' : ''}
                        ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                      `}
                    >
                      {isCompleted ? <FaCheck size={14} /> : <Icon size={14} />}
                    </div>
                    <p className={`
                      text-[10px] sm:text-sm mt-2 text-center font-semibold whitespace-nowrap px-1
                      ${isActive ? 'text-[#010139]' : 'text-gray-500'}
                    `}>
                      <span className="sm:hidden">{step.shortLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      h-1 w-8 sm:w-16 md:w-24 mx-2 transition-all flex-shrink-0
                      ${currentStep > step.num ? 'bg-[#8AAA19]' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 mb-6">
        {/* Step 1: Basic Data */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Datos básicos del caso
            </h2>

            {/* Broker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Corredor *
              </label>
              <select
                value={formData.broker_id}
                onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="">Selecciona un corredor</option>
                {brokers.map((broker: any) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name || broker.profile?.full_name || broker.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Name with Search */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Nombre del cliente *
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
                    📋 Clientes existentes - Click para auto-cargar información
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
                  <FaCheckCircle /> Cliente existente seleccionado - Corredor y expediente cargados
                </div>
              )}
              
              {/* Expediente Documents Indicator */}
              {expedienteDocuments.length > 0 && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <span className="font-semibold text-green-800">📁 Documentos del expediente:</span>
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
                <option value="">Selecciona una aseguradora</option>
                {insurers.map((insurer) => (
                  <option key={insurer.id} value={insurer.id}>
                    {insurer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Policy Number */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Número de póliza
              </label>
              <input
                type="text"
                value={formData.policy_number}
                onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                placeholder="POL-12345"
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
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Clasificación del caso
            </h2>

            {/* Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sección *
              </label>
              <select
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                {Object.entries(CASE_SECTIONS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado inicial
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
                Tipo de gestión
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

            {/* Policy Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de póliza *
              </label>
              <select
                value={formData.policy_type}
                onChange={(e) => setFormData({ ...formData, policy_type: e.target.value as PolicyType })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="">Selecciona un tipo de póliza</option>
                {Object.entries(POLICY_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Los documentos requeridos se determinarán según el tipo de póliza seleccionado
              </p>
            </div>

            {/* Premium */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Prima (opcional)
              </label>
              <input
                type="number"
                value={formData.premium || ''}
                onChange={(e) => setFormData({ ...formData, premium: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Forma de pago (opcional)
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="">Selecciona forma de pago</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DESCUENTO_A_CORREDOR">Descuento a Corredor</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notas / Descripción
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ingresa detalles del caso..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3: Documents and Files (Unified) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#010139] mb-1">
                  Documentos Requeridos
                </h2>
                <p className="text-sm text-gray-600">
                  {formData.policy_type ? `Tipo de póliza: ${POLICY_TYPES[formData.policy_type as PolicyType]}` : 'Selecciona un tipo de póliza en el paso anterior'}
                </p>
              </div>
            </div>

            {formData.documents.length === 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 font-semibold">
                  ⚠️ Debes seleccionar un tipo de póliza en el paso anterior para ver los documentos requeridos
                </p>
              </div>
            )}

            {expedienteDocuments.length > 0 && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="text-sm text-green-800">
                  <strong>✅ Documentos del Expediente Cargados</strong> - Los documentos de cédula y/o licencia ya están disponibles en el expediente del cliente y se marcarán automáticamente como completados.
                </p>
              </div>
            )}

            {formData.documents.length > 0 && (
              <>
                {/* Required Documents */}
                <div className="space-y-3">
                  {formData.documents.map((doc, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${doc.uploaded ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'} ${doc.category === 'inspection' ? 'border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-700">{doc.label}</p>
                            {doc.required && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">Requerido</span>
                            )}
                            {doc.category === 'inspection' && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">📸 Inspección</span>
                            )}
                            {doc.uploaded && !doc.file && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">
                                📁 Disponible en Expediente
                              </span>
                            )}
                          </div>
                          
                          {doc.file && (
                            <p className="text-xs text-gray-600 mt-1">
                              📄 {doc.standardName}.{doc.file.name.split('.').pop()} ({(doc.file.size / 1024).toFixed(2)} KB)
                            </p>
                          )}

                          {doc.isMultiDocument && doc.documentParts && (
                            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                              <p className="font-semibold text-purple-800 mb-1">📦 Documento múltiple contiene:</p>
                              <ul className="list-disc list-inside text-purple-700 space-y-0.5">
                                {doc.documentParts.map((part, i) => (
                                  <li key={i}>{part}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-all ${doc.uploaded ? 'bg-green-600 hover:bg-green-700' : 'bg-[#010139] hover:bg-[#020270]'} text-white`}>
                            {doc.uploaded ? '✓ Adjuntado' : '📎 Adjuntar'}
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
                                  toast.success(`Archivo adjuntado: ${doc.label}`);
                                }
                              }}
                            />
                          </label>

                          {doc.uploaded && (
                            <button
                              onClick={() => {
                                const newDocuments = [...formData.documents];
                                newDocuments[index] = {
                                  ...doc,
                                  file: undefined,
                                  uploaded: false,
                                  isMultiDocument: false,
                                  documentParts: undefined,
                                };
                                setFormData({ ...formData, documents: newDocuments });
                                toast.info('Archivo eliminado');
                              }}
                              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Multi-document option */}
                      {doc.file && !doc.isMultiDocument && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            onClick={() => {
                              const parts = prompt('Este PDF contiene múltiples documentos. Ingresa los nombres separados por comas (ej: cédula, formulario, comprobante):');
                              if (parts) {
                                const documentParts = parts.split(',').map(p => p.trim()).filter(p => p);
                                if (documentParts.length > 0) {
                                  const newDocuments = [...formData.documents];
                                  newDocuments[index] = {
                                    ...doc,
                                    isMultiDocument: true,
                                    documentParts,
                                  };
                                  setFormData({ ...formData, documents: newDocuments });
                                  toast.success('Documento marcado como múltiple');
                                }
                              }
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                          >
                            📦 Este PDF contiene varios documentos
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom Documents */}
                <div className="mt-8 pt-6 border-t-2 border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#010139]">
                      Otros Documentos
                    </h3>
                    <button
                      onClick={() => {
                        const label = prompt('Nombre del documento:');
                        if (label) {
                          const standardName = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                          setFormData({
                            ...formData,
                            customDocuments: [
                              ...formData.customDocuments,
                              { label, standardName, uploaded: false }
                            ]
                          });
                        }
                      }}
                      className="px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                    >
                      <FaPlus /> Agregar Documento
                    </button>
                  </div>

                  {formData.customDocuments.length > 0 && (
                    <div className="space-y-3">
                      {formData.customDocuments.map((customDoc, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${customDoc.uploaded ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-700">{customDoc.label}</p>
                              {customDoc.file && (
                                <p className="text-xs text-gray-600 mt-1">
                                  📄 {customDoc.standardName}.{customDoc.file.name.split('.').pop()} ({(customDoc.file.size / 1024).toFixed(2)} KB)
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <label className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-semibold transition-all ${customDoc.uploaded ? 'bg-green-600 hover:bg-green-700' : 'bg-[#010139] hover:bg-[#020270]'} text-white`}>
                                {customDoc.uploaded ? '✓ Adjuntado' : '📎 Adjuntar'}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const newCustomDocs = [...formData.customDocuments];
                                      newCustomDocs[index] = {
                                        ...customDoc,
                                        file,
                                        uploaded: true,
                                      };
                                      setFormData({ ...formData, customDocuments: newCustomDocs });
                                      toast.success(`Archivo adjuntado: ${customDoc.label}`);
                                    }
                                  }}
                                />
                              </label>

                              <button
                                onClick={() => {
                                  const newCustomDocs = formData.customDocuments.filter((_, i) => i !== index);
                                  setFormData({ ...formData, customDocuments: newCustomDocs });
                                  toast.info('Documento personalizado eliminado');
                                }}
                                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">📊 Resumen:</span> {formData.documents.filter(d => d.uploaded).length} de {formData.documents.length} documentos requeridos adjuntados
                    {formData.customDocuments.length > 0 && ` + ${formData.customDocuments.filter(d => d.uploaded).length} documentos adicionales`}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Revisión final
            </h2>

            <div className="space-y-4">
              {/* Basic Data */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-[#010139]">
                <h3 className="font-bold text-[#010139] mb-3">Datos básicos</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Corredor:</span> {getBrokerName(formData.broker_id)}</p>
                  <p><span className="font-semibold">Cliente:</span> {formData.client_name || (formData.client_id ? getClientName(formData.client_id) : 'Sin especificar')}</p>
                  {formData.insurer_id && (
                    <p><span className="font-semibold">Aseguradora:</span> {getInsurerName(formData.insurer_id)}</p>
                  )}
                  {formData.policy_number && (
                    <p><span className="font-semibold">Póliza:</span> {formData.policy_number}</p>
                  )}
                  <p><span className="font-semibold">Canal:</span> {formData.canal}</p>
                </div>
              </div>

              {/* Classification */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-[#8AAA19]">
                <h3 className="font-bold text-[#010139] mb-3">Clasificación</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Sección:</span> {CASE_SECTIONS[formData.section as keyof typeof CASE_SECTIONS]}</p>
                  <p><span className="font-semibold">Estado:</span> {CASE_STATUSES[formData.status as keyof typeof CASE_STATUSES]}</p>
                  <p><span className="font-semibold">Tipo de gestión:</span> {MANAGEMENT_TYPES[formData.management_type as keyof typeof MANAGEMENT_TYPES]}</p>
                  {formData.policy_type && (
                    <p><span className="font-semibold">Tipo de póliza:</span> {POLICY_TYPES[formData.policy_type as PolicyType]}</p>
                  )}
                  {formData.notes && (
                    <p><span className="font-semibold">Notas:</span> {formData.notes}</p>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              {(formData.premium || formData.payment_method) && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-green-500">
                  <h3 className="font-bold text-[#010139] mb-3">Información de pago</h3>
                  <div className="space-y-2 text-sm">
                    {formData.premium > 0 && (
                      <p><span className="font-semibold">Prima:</span> ${formData.premium.toFixed(2)}</p>
                    )}
                    {formData.payment_method && (
                      <p><span className="font-semibold">Forma de pago:</span> {formData.payment_method}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Documents */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-blue-500">
                <h3 className="font-bold text-[#010139] mb-3">📄 Documentos</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">
                    <span className="font-semibold">Requeridos:</span> {formData.documents.filter(d => d.uploaded).length} de {formData.documents.length} adjuntados
                  </p>
                  {formData.customDocuments.length > 0 && (
                    <p className="text-gray-700">
                      <span className="font-semibold">Adicionales:</span> {formData.customDocuments.filter(d => d.uploaded).length} de {formData.customDocuments.length} adjuntados
                    </p>
                  )}
                  {formData.documents.some(d => d.category === 'inspection' && d.uploaded) && (
                    <p className="text-blue-700">
                      <span className="font-semibold">📸 Inspección:</span> {formData.documents.filter(d => d.category === 'inspection' && d.uploaded).length} fotos adjuntadas
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex justify-between gap-4">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaArrowLeft />
            Anterior
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center gap-2"
            >
              Siguiente
              <FaArrowRight />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                <>
                  <FaCheck />
                  Crear caso
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
