'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'sonner';

export default function ComprehensiveQuotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    maritalStatus: '',
    insuredAmount: '',
    bodilyInjury: '10,000 / 20,000',
    propertyDamage: '10,000',
    medicalExpenses: '2,000 / 10,000',
    brand: '',
    model: '',
    year: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.insuredAmount || !formData.brand) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    // Simular API call
    setTimeout(() => {
      router.push('/quotes/comprehensive/results');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] p-4 rounded-full">
                <FaShieldAlt className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#010139]">
                  Cobertura Completa
                </h1>
                <p className="text-gray-600">
                  Cotiza en segundos con datos básicos
                </p>
              </div>
            </div>

            {/* API Integration Notice */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚧</span>
                <div>
                  <p className="font-semibold text-yellow-800 mb-1">
                    Cotización Preliminar
                  </p>
                  <p className="text-sm text-yellow-700">
                    Las tarifas mostradas son estimadas. La integración con APIs de aseguradoras está en proceso.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
          <div className="space-y-6">
            {/* Personal Data */}
            <div>
              <h2 className="text-xl font-bold text-[#010139] mb-4">Datos del Cliente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado Civil *
                  </label>
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({...formData, maritalStatus: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option>Soltero/a</option>
                    <option>Casado/a</option>
                    <option>Divorciado/a</option>
                    <option>Viudo/a</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Vehicle Data */}
            <div className="border-t-2 border-gray-100 pt-6">
              <h2 className="text-xl font-bold text-[#010139] mb-4">Datos del Vehículo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Suma Asegurada (B/.) *
                  </label>
                  <input
                    type="number"
                    value={formData.insuredAmount}
                    onChange={(e) => setFormData({...formData, insuredAmount: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    placeholder="15000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marca *
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    placeholder="Toyota"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    placeholder="Corolla"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Año *
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    placeholder="2020"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-bold text-lg disabled:opacity-50"
              >
                {loading ? 'Cotizando...' : 'Cotizar Ahora →'}
              </button>
              <p className="text-center text-sm text-gray-600 mt-4">
                Recibirás cotizaciones de 5 aseguradoras
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
