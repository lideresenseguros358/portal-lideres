"use client";

import { FormEvent, useState } from "react";
import { FaUser, FaIdCard, FaUniversity, FaArrowRight, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import AuthShell from "../_AuthShell";

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
    cedula: "",
    fecha_nacimiento: "",
    telefono: "",
    licencia: "",
  });

  // Paso 3: Datos Bancarios
  const [bankData, setBankData] = useState({
    tipo_cuenta: "Ahorro",
    numero_cuenta: "",
    numero_cedula: "",
    nombre_completo: "",
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
    if (!personalData.cedula || !personalData.fecha_nacimiento || !personalData.telefono) {
      setError("Cédula, fecha de nacimiento y teléfono son obligatorios");
      return false;
    }
    setError(null);
    return true;
  };

  // Validación Paso 3
  const validateStep3 = () => {
    if (!bankData.numero_cuenta || !bankData.numero_cedula || !bankData.nombre_completo) {
      setError("Todos los campos bancarios son obligatorios");
      return false;
    }
    setError(null);
    return true;
  };

  // Auto-llenar cédula bancaria
  const handleAutoFillChange = (checked: boolean) => {
    setAutoFillCedula(checked);
    if (checked) {
      setBankData(prev => ({
        ...prev,
        numero_cedula: personalData.cedula,
      }));
    } else {
      setBankData(prev => ({
        ...prev,
        numero_cedula: "",
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
      submittedAt: new Date().toISOString(),
    };

    console.log("[new-user-wizard] Payload:", payload);

    // TODO: Llamar a action para guardar en BD
    // const result = await actionCreateUserRequest(payload);

    setTimeout(() => {
      setLoading(false);
      setMessage("Solicitud enviada exitosamente. Espera la aprobación del Master.");
      
      // Reset después de 3 segundos
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    }, 1000);
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFillCedula}
                    onChange={(e) => handleAutoFillChange(e.target.checked)}
                    className="w-4 h-4 text-[#010139]"
                  />
                  <span className="text-sm text-blue-900 font-medium">
                    Usar mi cédula para datos bancarios
                  </span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cuenta <span className="text-red-500">*</span>
                </label>
                <select
                  value={bankData.tipo_cuenta}
                  onChange={(e) => setBankData({ ...bankData, tipo_cuenta: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  required
                >
                  <option value="Ahorro">Ahorro</option>
                  <option value="Corriente">Corriente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Cuenta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankData.numero_cuenta}
                  onChange={(e) => setBankData({ ...bankData, numero_cuenta: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="040012345678"
                  required
                />
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
                  onChange={(e) => setBankData({ ...bankData, nombre_completo: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none"
                  placeholder="Nombre completo del titular"
                  required
                />
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
