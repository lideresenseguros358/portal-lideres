'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaFire, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';

export default function IncendioQuotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyType: '',
    address: '',
    constructionValue: '',
    contentValue: '',
    constructionType: '',
    floors: '',
    securityMeasures: '',
    ownerName: '',
    ownerId: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.propertyType || !formData.address || !formData.constructionValue || !formData.email) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const params = new URLSearchParams({
        propertyType: formData.propertyType,
        constructionValue: formData.constructionValue,
        contentValue: formData.contentValue || '0',
      });
      router.push(`/quotes/incendio/results?${params.toString()}`);
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
              <div className="bg-orange-100 p-3 rounded-full">
                <FaFire className="text-orange-600" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#010139]">
                  Seguro de Incendio
                </h1>
                <p className="text-gray-600">
                  Protege tu propiedad contra incendios
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-semibold text-[#010139] mb-1">Aseguradoras Disponibles:</p>
              <p className="text-sm text-gray-600">Internacional • Ancón</p>
            </div>
          </div>
        </div>

        {/* Banner API */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Cotización Preliminar</p>
              <p>Las tarifas son estimadas. Se requiere inspección física de la propiedad para confirmar la prima final.</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-[#010139] mb-6">Datos de la Propiedad</h2>

          <div className="space-y-6">
            {/* Tipo de Propiedad */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">1.</span>
                Información General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Propiedad *
                  </label>
                  <select
                    name="propertyType"
                    value={formData.propertyType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Selecciona...</option>
                    <option value="casa">Casa</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="edificio">Edificio</option>
                    <option value="local_comercial">Local Comercial</option>
                    <option value="bodega">Bodega</option>
                    <option value="oficina">Oficina</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección Completa *
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Calle, número, ciudad, provincia"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Valores */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">2.</span>
                Valores a Asegurar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor de Construcción *
                  </label>
                  <input
                    type="number"
                    name="constructionValue"
                    value={formData.constructionValue}
                    onChange={handleChange}
                    placeholder="Ej: 150000"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">En Balboas (B/.)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor del Contenido (Opcional)
                  </label>
                  <input
                    type="number"
                    name="contentValue"
                    value={formData.contentValue}
                    onChange={handleChange}
                    placeholder="Ej: 50000"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Muebles, equipos, etc.</p>
                </div>
              </div>
            </div>

            {/* Características */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">3.</span>
                Características de la Propiedad
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Construcción
                  </label>
                  <select
                    name="constructionType"
                    value={formData.constructionType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  >
                    <option value="">Selecciona...</option>
                    <option value="concreto">Concreto</option>
                    <option value="madera">Madera</option>
                    <option value="mixta">Mixta</option>
                    <option value="metal">Metal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Pisos
                  </label>
                  <input
                    type="number"
                    name="floors"
                    value={formData.floors}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medidas de Seguridad
                  </label>
                  <input
                    type="text"
                    name="securityMeasures"
                    value={formData.securityMeasures}
                    onChange={handleChange}
                    placeholder="Ej: Extintores, alarma contra incendios, rociadores"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Datos del Propietario */}
            <div>
              <h3 className="font-semibold text-[#010139] mb-4 flex items-center gap-2">
                <span className="text-[#8AAA19]">4.</span>
                Datos del Propietario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cédula / RUC
                  </label>
                  <input
                    type="text"
                    name="ownerId"
                    value={formData.ownerId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  />
                </div>
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
          </div>

          {/* Submit */}
          <div className="mt-8 pt-6 border-t-2 border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:shadow-lg transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Procesando...
                </span>
              ) : (
                'Comparar Cotizaciones'
              )}
            </button>
          </div>
        </form>

        {/* Info adicional */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">🔥 Coberturas típicas incluidas:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Incendio y rayos</li>
            <li>• Explosión</li>
            <li>• Daños por agua (según plan)</li>
            <li>• Robo con violencia (según plan)</li>
            <li>• Responsabilidad civil (según plan)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
