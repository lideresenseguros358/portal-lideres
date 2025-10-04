'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaUser, FaFileAlt, FaUserTie } from 'react-icons/fa';
import { supabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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
  address: string;
  // Póliza
  policy_number: string;
  insurer_id: string;
  ramo: string;
  start_date: string;
  renewal_date: string;
  status: string;
  // Broker y %
  broker_email: string;
  percent_override: string;
}

export default function ClientPolicyWizard({ onClose, onSuccess, role, userEmail }: WizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    national_id: '',
    email: '',
    phone: '',
    address: '',
    policy_number: '',
    insurer_id: '',
    ramo: '',
    start_date: '',
    renewal_date: '',
    status: 'active',
    broker_email: role === 'broker' ? userEmail : '',
    percent_override: '',
  });

  useEffect(() => {
    loadInsurers();
    if (role === 'master') {
      loadBrokers();
    }
  }, [role]);

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

  const validateStep = () => {
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
    } else if (step === 3 && role === 'master') {
      if (!formData.broker_email) {
        toast.error('Debe seleccionar un corredor');
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Resolver insurer_name
      const insurer = insurers.find(i => i.id === formData.insurer_id);
      
      const payload = {
        client_name: formData.client_name,
        national_id: formData.national_id || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        policy_number: formData.policy_number,
        insurer_name: insurer?.name,
        ramo: formData.ramo || null,
        start_date: formData.start_date || null,
        renewal_date: formData.renewal_date || null,
        status: formData.status,
        broker_email: formData.broker_email,
        percent_override: formData.percent_override ? parseFloat(formData.percent_override) : null,
        source: 'manual',
      };

      const { error } = await supabaseClient()
        .from('temp_client_imports')
        .insert([payload]);

      if (error) throw error;

      toast.success(formData.national_id ? 'Cliente creado exitosamente' : 'Cliente preliminar creado');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Error al crear cliente', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start sm:items-center justify-center overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full mx-2 sm:mx-4 my-4 sm:my-8 shadow-2xl flex flex-col min-h-0 max-h-[calc(100vh-2rem)] sm:max-h-[90vh]">
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
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0">
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
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Cédula / Pasaporte / RUC
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  placeholder="8-123-4567"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  ⚠️ Sin este campo, el cliente quedará como PRELIMINAR
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

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition resize-none"
                  rows={2}
                  placeholder="Calle 50, Ciudad de Panamá"
                />
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
                <select
                  value={formData.insurer_id}
                  onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                >
                  <option value="">Seleccionar aseguradora...</option>
                  {insurers.map((ins) => (
                    <option key={ins.id} value={ins.id}>{ins.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Póliza <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  placeholder="POL-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ramo / Tipo de Seguro</label>
                <input
                  type="text"
                  value={formData.ramo}
                  onChange={(e) => setFormData({ ...formData, ramo: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  placeholder="Autos, Vida, Incendio..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Renovación</label>
                  <input
                    type="date"
                    value={formData.renewal_date}
                    onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                >
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                  <option value="cancelled">Cancelada</option>
                </select>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Corredor <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.broker_email}
                      onChange={(e) => {
                        const selected = brokers.find((b: any) => b.profile?.email === e.target.value);
                        setFormData({ 
                          ...formData, 
                          broker_email: e.target.value,
                          percent_override: (selected as any)?.percent_default?.toString() || ''
                        });
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition"
                    >
                      <option value="">Seleccionar corredor...</option>
                      {brokers.map((broker: any) => (
                        <option key={broker.id} value={broker.profile?.email}>
                          {broker.name || broker.profile?.full_name} ({broker.profile?.email})
                        </option>
                      ))}
                    </select>
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
