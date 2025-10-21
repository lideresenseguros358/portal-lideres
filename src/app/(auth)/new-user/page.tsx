"use client";

import { FormEvent, useState } from "react";
import { FaUser, FaIdCard, FaUniversity, FaArrowRight, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import AuthShell from "../_AuthShell";
import { BankSelect, AccountTypeSelect } from '@/components/ui/BankSelect';
import { toUpperNoAccents, cleanAccountNumber } from '@/lib/commissions/ach-normalization';

// Wizard de 3 pasos para registro de nuevo usuario
export default function NewUserWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Paso 1: Credenciales
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Paso 2: Datos Personales
  const [personalData, setPersonalData] = useState({
    nombre: "", // Nombre completo del solicitante
    cedula: "",
    fecha_nacimiento: "",
    telefono: "",
    licencia: "",
    broker_type: "corredor",
    assa_code: "",
    carnet_expiry_date: "",
  });

  // Paso 3: Datos Bancarios ACH
  const [bankData, setBankData] = useState({
    bank_route: "", // Código de ruta desde ach_banks (ej: "71")
    account_type: "04", // Código desde ach_account_types: "03"=Corriente, "04"=Ahorro
    account_number: "", // Número de cuenta (limpio, sin espacios/guiones)
    numero_cedula: "", // Cédula del titular
    nombre_completo: "", // Nombre completo (normalizado ACH, MAYÚSCULAS sin acentos)
  });

  // Checkbox para ayuda a llenar
  const [autoFillCedula, setAutoFillCedula] = useState(false);

  // Validación Paso 1
  const validateStep1 = () => {
    if (!credentials.email || !credentials.password || !credentials.confirmPassword) {
      setError("Todos los campos son obligatorios");
      return false;
    }
    if (credentials.password !== credentials.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return false;
    }
    if (credentials.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return false;
    }
    setError(null);
    return true;
  };

  // Validación Paso 2
  const validateStep2 = () => {
    if (!personalData.nombre) {
      setError("El nombre completo es obligatorio");
      return false;
    }
    if (!personalData.cedula || !personalData.fecha_nacimiento || !personalData.telefono) {
      setError("Cédula, fecha de nacimiento y teléfono son obligatorios");
      return false;
    }
    setError(null);
    return true;
  };

  // Validación Paso 3
  const validateStep3 = () => {
    if (!bankData.bank_route) {
      setError("Debe seleccionar un banco");
      return false;
    }
    if (!bankData.account_type) {
      setError("Debe seleccionar el tipo de cuenta");
      return false;
    }
    if (!bankData.account_number) {
      setError("El número de cuenta es obligatorio");
      return false;
    }
    if (!bankData.numero_cedula) {
      setError("La cédula del titular es obligatoria");
      return false;
    }
    if (!bankData.nombre_completo) {
      setError("El nombre completo del titular es obligatorio");
      return false;
    }
    setError(null);
    return true;
  };

  // Función helper checkbox - Copia nombre Y cédula del broker
  const handleAutoFillChange = (checked: boolean) => {
    setAutoFillCedula(checked);
    if (checked) {
      // Normalizar nombre a formato ACH
      const nombreNormalizado = toUpperNoAccents(personalData.nombre || '').substring(0, 22);
      setBankData(prev => ({
        ...prev,
        numero_cedula: personalData.cedula,
        nombre_completo: nombreNormalizado
      }));
    } else {
      setBankData(prev => ({
        ...prev,
        numero_cedula: "",
        nombre_completo: ""
      }));
    }
  };

  // Siguiente paso
  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  // Paso anterior
  const handleBack = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  // Envío final
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!validateStep3()) return;

    setLoading(true);
    setError(null);

    const payload = {
      credentials,
      personalData,
      bankData,
    };

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setMessage("✅ " + data.message);
        
        // Reset después de 3 segundos
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (err: any) {
      setError(err.message || 'Error al enviar solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell backHref="/login" description="Solicitud de acceso al portal">
      <div className="w-full max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${step >= 1 ? 'text-[#010139]' : 'text-gray-400'}`}>
              Credenciales
            </span>
            <span className={`text-sm font-medium ${step >= 2 ? 'text-[#010139]' : 'text-gray-400'}`}>
              Datos Personales
            </span>
            <span className={`text-sm font-medium ${step >= 3 ? 'text-[#010139]' : 'text-gray-400'}`}>
              Datos Bancarios
            </span>
          </div>
          <div className="flex gap-2">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-[#010139]' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-[#010139]' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-[#010139]' : 'bg-gray-200'}`} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PASO 1: Credenciales */}
          {step === 1 && (
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="text-2xl text-[#010139]" />
                <h3 className="text-xl font-bold text-[#010139]">Paso 1: Credenciales de Acceso</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="correo@ejemplo.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={credentials.confirmPassword}
                  onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
            </div>
          )}

          {/* PASO 2: Datos Personales */}
          {step === 2 && (
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <FaIdCard className="text-2xl text-[#010139]" />
                <h3 className="text-xl font-bold text-[#010139]">Paso 2: Datos Personales</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={personalData.nombre}
                  onChange={(e) => {
                    setPersonalData({ ...personalData, nombre: e.target.value });
                    // Si checkbox está marcado, actualizar también el titular
                    if (autoFillCedula) {
                      const nombreNormalizado = toUpperNoAccents(e.target.value).substring(0, 22);
                      setBankData({ ...bankData, nombre_completo: nombreNormalizado });
                    }
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="Juan Pérez Gómez"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cédula / Pasaporte <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={personalData.cedula}
                  onChange={(e) => {
                    setPersonalData({ ...personalData, cedula: e.target.value });
                    if (autoFillCedula) {
                      setBankData({ ...bankData, numero_cedula: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="8-123-4567"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={personalData.fecha_nacimiento}
                  onChange={(e) => setPersonalData({ ...personalData, fecha_nacimiento: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={personalData.telefono}
                  onChange={(e) => setPersonalData({ ...personalData, telefono: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="+507 6000-0000"
                  required
                />
              </div>

              {/* Toggle Tipo de Broker */}
              <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-[#8AAA19]">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Broker
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setPersonalData({ ...personalData, broker_type: 'corredor' })}
                  className={`
                    flex-1 px-6 py-3 rounded-lg font-semibold transition-all
                    ${personalData.broker_type === 'corredor'
                      ? 'bg-[#010139] text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#8AAA19]'
                    }
                  `}
                >
                  📋 Corredor
                </button>
                <button
                  type="button"
                  onClick={() => setPersonalData({ ...personalData, broker_type: 'agente' })}
                  className={`
                    flex-1 px-6 py-3 rounded-lg font-semibold transition-all
                    ${personalData.broker_type === 'agente'
                      ? 'bg-[#8AAA19] text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#8AAA19]'
                    }
                  `}
                >
                  🎫 Agente
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {personalData.broker_type === 'corredor' 
                  ? '• Corredor: Requiere licencia'
                  : '• Agente: Requiere código ASSA y carnet'
                }
              </p>
            </div>

            {/* Campos condicionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Licencia - Solo para CORREDOR */}
              {personalData.broker_type === 'corredor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Licencia de Corredor (Opcional)
                  </label>
                  <input
                    type="text"
                    value={personalData.licencia}
                    onChange={(e) => setPersonalData({ ...personalData, licencia: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                    placeholder="Número de licencia"
                  />
                </div>
              )}

              {/* Código ASSA - Solo para AGENTE */}
              {personalData.broker_type === 'agente' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código ASSA (Opcional)
                  </label>
                  <input
                    type="text"
                    value={personalData.assa_code}
                    onChange={(e) => setPersonalData({ ...personalData, assa_code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                    placeholder="Código ASSA"
                  />
                </div>
              )}

              {/* Fecha Vencimiento Carnet - Solo para AGENTE */}
              {personalData.broker_type === 'agente' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Vencimiento Carnet (Opcional)
                  </label>
                  <input
                    type="date"
                    value={personalData.carnet_expiry_date}
                    onChange={(e) => setPersonalData({ ...personalData, carnet_expiry_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  />
                </div>
              )}
            </div>
            </div>
          )}

          {/* PASO 3: Datos Bancarios */}
          {step === 3 && (
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <FaUniversity className="text-2xl text-[#010139]" />
                <h3 className="text-xl font-bold text-[#010139]">Paso 3: Cuenta para Pago de Comisiones</h3>
              </div>

              {/* Checkbox ayuda llenar */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFillCedula}
                    onChange={(e) => handleAutoFillChange(e.target.checked)}
                    className="w-4 h-4 text-[#010139] border-gray-300 rounded focus:ring-[#010139]"
                  />
                  <div>
                    <span className="text-sm text-blue-900 font-semibold block">
                      Usar mis datos personales (cuenta propia)
                    </span>
                    <span className="text-xs text-blue-700">
                      Auto-llena titular y cédula con tus datos del Paso 2
                    </span>
                  </div>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banco <span className="text-red-500">*</span>
                </label>
                <BankSelect
                  value={bankData.bank_route}
                  onChange={(route) => setBankData({ ...bankData, bank_route: route })}
                  required
                />
                {bankData.bank_route && (
                  <p className="text-xs text-gray-500 mt-1">
                    Código de ruta: {bankData.bank_route}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cuenta <span className="text-red-500">*</span>
                </label>
                <AccountTypeSelect
                  value={bankData.account_type}
                  onChange={(type) => setBankData({ ...bankData, account_type: type })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Cuenta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankData.account_number}
                  onChange={(e) => {
                    const cleaned = cleanAccountNumber(e.target.value);
                    setBankData({ ...bankData, account_number: cleaned });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="040012345678"
                  maxLength={17}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Sin espacios ni guiones. Máximo 17 caracteres.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cédula del Titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankData.numero_cedula}
                  onChange={(e) => setBankData({ ...bankData, numero_cedula: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="8-123-4567"
                  required
                  disabled={autoFillCedula}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre Completo del Titular <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankData.nombre_completo}
                  onChange={(e) => {
                    const normalized = toUpperNoAccents(e.target.value);
                    setBankData({ ...bankData, nombre_completo: normalized.substring(0, 22) });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none disabled:bg-gray-100 disabled:text-gray-600"
                  placeholder="JUAN PEREZ"
                  maxLength={22}
                  required
                  disabled={autoFillCedula}
                />
                <p className="text-xs text-gray-500 mt-1">
                  MAYÚSCULAS sin acentos. Máximo 22 caracteres.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <FaCheckCircle />
              {message}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium flex items-center justify-center gap-2"
                disabled={loading}
              >
                <FaArrowLeft /> Atrás
              </button>
            )}
            
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition font-medium flex items-center justify-center gap-2"
              >
                Siguiente <FaArrowRight />
              </button>
            ) : (
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6f8815] transition font-medium flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar Solicitud"} <FaCheckCircle />
              </button>
            )}
          </div>
        </form>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-in-out;
          }
        `}</style>
      </div>
    </AuthShell>
  );
}
