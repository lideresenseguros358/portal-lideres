'use client';

import { useState } from 'react';
import { FaArrowLeft, FaArrowRight, FaCheck, FaTimes, FaUser, FaFileAlt, FaListUl, FaDollarSign, FaEye } from 'react-icons/fa';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { actionCreateCase } from '@/app/(app)/cases/actions';
import { CASE_SECTIONS, CASE_STATUSES, MANAGEMENT_TYPES, DEFAULT_CHECKLIST } from '@/lib/constants/cases';

interface NewCaseWizardProps {
  brokers: any[];
  clients: any[];
  insurers: any[];
}

export default function NewCaseWizard({ brokers, clients, insurers }: NewCaseWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Data
    client_id: '',
    client_name: '',
    broker_id: '',
    insurer_id: '',
    policy_number: '',
    ticket_ref: '',
    ctype: 'REGULAR', // Type of case
    canal: 'ASEGURADORA',
    
    // Step 2: Classification
    section: 'SIN_CLASIFICAR',
    status: 'PENDIENTE_REVISION',
    management_type: 'COTIZACION',
    notes: '',
    premium: 0,
    payment_method: '',
    
    // Step 3: Checklist
    checklist: DEFAULT_CHECKLIST.map((item: any) => ({ ...item, completed: false })),
    
    // Step 4: Files (will be handled separately)
    files: [] as File[],
    
    // Step 5: Review (no additional fields)
  });

  const steps = [
    { num: 1, label: 'Datos básicos', icon: FaUser },
    { num: 2, label: 'Clasificación', icon: FaFileAlt },
    { num: 3, label: 'Checklist', icon: FaListUl },
    { num: 4, label: 'Archivos', icon: FaDollarSign },
    { num: 5, label: 'Revisión', icon: FaEye },
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
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    // Prepare data for submission
    const caseData = {
      section: formData.section,
      ctype: formData.ctype,
      management_type: formData.management_type,
      insurer_id: formData.insurer_id || '',
      broker_id: formData.broker_id,
      client_id: formData.client_id || undefined,
      client_name: formData.client_name || undefined,
      policy_number: formData.policy_number || undefined,
      premium: formData.premium || undefined,
      payment_method: formData.payment_method || undefined,
      notes: formData.notes || undefined,
    };

    const result = await actionCreateCase(caseData);

    if (result.ok) {
      toast.success('Caso creado correctamente');
      router.push(`/cases/${result.data.id}`);
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139]">
              Nuevo Pendiente
            </h1>
            <p className="text-gray-600 mt-1">Paso {currentStep} de 5</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex justify-between items-center">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all
                      ${isCompleted ? 'bg-[#8AAA19] text-white' : ''}
                      ${isActive ? 'bg-[#010139] text-white ring-4 ring-[#010139] ring-opacity-20' : ''}
                      ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                    `}
                  >
                    {isCompleted ? <FaCheck /> : <Icon />}
                  </div>
                  <p className={`
                    text-xs sm:text-sm mt-2 text-center font-semibold
                    ${isActive ? 'text-[#010139]' : 'text-gray-500'}
                  `}>
                    {step.label}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    h-1 flex-1 mx-2 transition-all
                    ${currentStep > step.num ? 'bg-[#8AAA19]' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            );
          })}
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

            {/* Client Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cliente existente (opcional)
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => {
                  const clientId = e.target.value;
                  const client = clients.find(c => c.id === clientId);
                  setFormData({ 
                    ...formData, 
                    client_id: clientId,
                    client_name: client?.name || ''
                  });
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="">Selecciona un cliente o ingresa nuevo abajo</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.national_id ? `(${client.national_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Client Name (if new) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre del cliente *
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value, client_id: '' })}
                placeholder="Ingresa el nombre del cliente"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              />
              {formData.client_id && (
                <p className="text-xs text-gray-500 mt-1">
                  Cliente seleccionado: {getClientName(formData.client_id)}
                </p>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número de póliza
              </label>
              <input
                type="text"
                value={formData.policy_number}
                onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                placeholder="Ej: POL-12345"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              />
            </div>

            {/* Ticket Reference */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ticket de referencia
              </label>
              <input
                type="text"
                value={formData.ticket_ref}
                onChange={(e) => setFormData({ ...formData, ticket_ref: e.target.value })}
                placeholder="Ej: TKT-001"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
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

        {/* Step 3: Checklist */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Checklist de documentos
            </h2>
            <p className="text-gray-600">
              Selecciona los documentos que ya han sido recibidos
            </p>

            <div className="space-y-3">
              {formData.checklist.map((item: any, index: number) => (
                <label
                  key={index}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer border-2 border-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => {
                      const newChecklist = [...formData.checklist];
                      newChecklist[index].completed = e.target.checked;
                      setFormData({ ...formData, checklist: newChecklist });
                    }}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-700">{item.label}</p>
                    {item.required && (
                      <p className="text-xs text-red-600">Requerido</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Files */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              Archivos adjuntos
            </h2>
            <p className="text-gray-600 mb-4">
              Puedes agregar archivos después de crear el caso
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📎</div>
              <p className="text-gray-600">
                Los archivos se pueden cargar desde la página de detalle del caso
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
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
                  {formData.ticket_ref && (
                    <p><span className="font-semibold">Ticket:</span> {formData.ticket_ref}</p>
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
                  <p><span className="font-semibold">Tipo:</span> {MANAGEMENT_TYPES[formData.management_type as keyof typeof MANAGEMENT_TYPES]}</p>
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

              {/* Checklist */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-blue-500">
                <h3 className="font-bold text-[#010139] mb-3">Checklist</h3>
                <p className="text-sm text-gray-600">
                  {formData.checklist.filter((c: any) => c.completed).length} de {formData.checklist.length} documentos recibidos
                </p>
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

          {currentStep < 5 ? (
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
