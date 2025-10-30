'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaHeartbeat, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import InsurerLogo from '@/components/shared/InsurerLogo';

export default function VidaQuotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationalId: '',
    birthDate: '',
    gender: '',
    occupation: '',
    email: '',
    phone: '',
    coverage: '',
    beneficiaries: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.firstName || !formData.lastName || !formData.nationalId || 
        !formData.birthDate || !formData.email || !formData.coverage) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);

    // Simular procesamiento
    setTimeout(() => {
      setLoading(false);
      // Redirigir a resultados con datos en query params
      const params = new URLSearchParams({
        coverage: formData.coverage,
        name: `${formData.firstName} ${formData.lastName}`,
      });
      router.push(`/quotes/vida/results?${params.toString()}`);
    }, 1500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver a Cotizadores</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <FaHeartbeat className="text-red-600" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#010139]">
                  Seguro de Vida
                </h1>
                <p className="text-gray-600">
                  Protege a tus seres queridos
                </p>
              </div>
            </div>

            {/* ASSA Logo */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
              <InsurerLogo 
                logoUrl={null} // Se cargará dinámicamente
                insurerName="ASSA"
                size="lg"
              />
              <div>
                <p className="font-semibold text-[#010139]">Aseguradora: ASSA</p>
                <p className="text-sm text-gray-600">Líder en seguros de vida en Panamá</p>
              </div>
            </div>
          </div>
        </div>

        {/* Banner API */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Cotización Preliminar</p>
              <p>Las tarifas mostradas son estimadas. Un asesor se contactará contigo para confirmar la cotización final según evaluación médica.</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-[#010139] mb-6">Datos para Cotización</h2>

          <div className="space-y-6">
            {/* Datos Personales */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">1.</span>
                Datos Personales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cédula / Pasaporte *
                  </label>
                  <input
                    type="text"
                    name="nationalId"
                    value={formData.nationalId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Género *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Selecciona...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ocupación
                  </label>
                  <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">2.</span>
                Información de Contacto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Cobertura */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">3.</span>
                Cobertura Deseada
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suma Asegurada *
                </label>
                <select
                  name="coverage"
                  value={formData.coverage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  required
                >
                  <option value="">Selecciona monto...</option>
                  <option value="50000">B/. 50,000</option>
                  <option value="100000">B/. 100,000</option>
                  <option value="200000">B/. 200,000</option>
                  <option value="300000">B/. 300,000</option>
                  <option value="500000">B/. 500,000</option>
                  <option value="1000000">B/. 1,000,000</option>
                </select>
              </div>
            </div>

            {/* Beneficiarios */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">4.</span>
                Beneficiarios (Opcional)
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres de beneficiarios
                </label>
                <textarea
                  name="beneficiaries"
                  value={formData.beneficiaries}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Ej: Juan Pérez (50%), María García (50%)"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Puedes ajustar esto después con tu asesor
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-8 pt-6 border-t-2 border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Procesando...
                </span>
              ) : (
                'Ver Cotización'
              )}
            </button>
          </div>
        </form>

        {/* Info adicional */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">📋 Siguiente paso:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Recibirás una cotización preliminar</li>
            <li>• Un asesor te contactará para completar evaluación médica</li>
            <li>• La prima final dependerá de tu estado de salud y ocupación</li>
            <li>• El proceso de aprobación toma 3-5 días hábiles</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
