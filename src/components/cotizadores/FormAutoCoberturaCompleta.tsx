/**
 * Formulario de Cotización - Auto Cobertura Completa
 * Con sliders interactivos para coberturas
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCar, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import { toast } from 'sonner';
import ClientDataInput from './ClientDataInput';

export default function FormAutoCoberturaCompleta() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    // Datos del vehículo
    marca: '',
    modelo: '',
    anno: new Date().getFullYear(),
    placa: '',
    
    // Valor del vehículo
    valorVehiculo: 15000,
    
    // Coberturas con sliders
    lesionCorporal: 10000, // 5k, 10k, 15k, 20k, 25k, 30k, 50k, 100k
    danoPropiedad: 5000,   // 2.5k, 5k, 7.5k, 10k, 15k, 20k, 25k
    gastosMedicos: 1000,   // 500, 1k, 2k, 3k, 5k, 10k
    
    // Cliente/Conductor
    cedula: '',
    nombreConductor: '',
    email: '',
    telefono: '',
    edadConductor: 25,
    
    // Opcionales
    deducible: 500, // 250, 500, 1000, 1500
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Opciones de sliders
  const lesionCorporalOptions = [5000, 10000, 15000, 20000, 25000, 30000, 50000, 100000];
  const danoPropiedadOptions = [2500, 5000, 7500, 10000, 15000, 20000, 25000];
  const gastosMedicosOptions = [500, 1000, 2000, 3000, 5000, 10000];
  const deducibleOptions = [250, 500, 1000, 1500];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.marca) newErrors.marca = 'Requerido';
    if (!formData.modelo) newErrors.modelo = 'Requerido';
    if (!formData.placa) newErrors.placa = 'Requerido';
    if (!formData.cedula) newErrors.cedula = 'Requerido';
    if (!formData.nombreConductor) newErrors.nombreConductor = 'Requerido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    
    // Guardar en sessionStorage y navegar
    sessionStorage.setItem('quoteInput', JSON.stringify({
      ...formData,
      policyType: 'AUTO',
      cobertura: 'COMPLETA',
    }));
    
    toast.success('Generando cotización...');
    router.push('/cotizadores/comparar');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Link
          href="/cotizadores/auto"
          className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-6 font-semibold"
        >
          <FaArrowLeft />
          <span>Volver a opciones de auto</span>
        </Link>

        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] rounded-full mb-3 md:mb-4">
            <FaCar className="text-white text-3xl md:text-4xl" />
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#010139] mb-2 px-4">
            Cobertura Completa de Auto
          </h1>
          <p className="text-base md:text-lg text-gray-600 px-4">
            Protección total para tu vehículo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          {/* Datos del Vehículo */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-[#010139] mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
              <FaCar className="text-[#8AAA19]" />
              Datos del Vehículo
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Marca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.marca ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Ej: Toyota"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Modelo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.modelo ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Ej: Corolla"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Año <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.anno}
                  onChange={(e) => setFormData({ ...formData, anno: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                  min="1980"
                  max={new Date().getFullYear() + 1}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Placa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.placa}
                  onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.placa ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Ej: ABC-1234"
                />
              </div>
            </div>

            {/* Valor del Vehículo con Slider */}
            <div className="mt-6 md:mt-8">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Valor del Vehículo <span className="text-red-500">*</span>
              </label>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 md:p-6 border-2 border-blue-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139]">
                    {formatCurrency(formData.valorVehiculo)}
                  </span>
                  <input
                    type="number"
                    value={formData.valorVehiculo}
                    onChange={(e) => setFormData({ ...formData, valorVehiculo: parseInt(e.target.value) || 0 })}
                    className="w-full sm:w-32 px-3 py-2 border-2 border-gray-300 rounded-lg text-center sm:text-right font-mono text-base"
                  />
                </div>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="1000"
                  value={formData.valorVehiculo}
                  onChange={(e) => setFormData({ ...formData, valorVehiculo: parseInt(e.target.value) })}
                  className="w-full h-4 md:h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${((formData.valorVehiculo - 5000) / 95000) * 100}%, #e5e7eb ${((formData.valorVehiculo - 5000) / 95000) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>$5,000</span>
                  <span>$100,000</span>
                </div>
              </div>
            </div>
          </div>

          {/* Límites de Cobertura */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-[#010139] mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
              <FaShieldAlt className="text-[#8AAA19]" />
              Límites de Cobertura
            </h2>

            {/* Lesión Corporal */}
            <div className="mb-6 md:mb-8">
              <label className="block text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Lesión Corporal (por persona/por accidente)
              </label>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 md:p-6 border-2 border-green-200">
                <div className="text-center mb-3 md:mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139]">
                    {formatCurrency(formData.lesionCorporal)} / {formatCurrency(formData.lesionCorporal * 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={lesionCorporalOptions.length - 1}
                  value={Math.max(0, lesionCorporalOptions.indexOf(formData.lesionCorporal))}
                  onChange={(e) => setFormData({ ...formData, lesionCorporal: lesionCorporalOptions[parseInt(e.target.value)] || 10000 })}
                  className="w-full h-4 md:h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(Math.max(0, lesionCorporalOptions.indexOf(formData.lesionCorporal)) / (lesionCorporalOptions.length - 1)) * 100}%, #e5e7eb ${(Math.max(0, lesionCorporalOptions.indexOf(formData.lesionCorporal)) / (lesionCorporalOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>{formatCurrency(lesionCorporalOptions[0] || 5000)}</span>
                  <span>{formatCurrency(lesionCorporalOptions[lesionCorporalOptions.length - 1] || 100000)}</span>
                </div>
              </div>
            </div>

            {/* Daño a la Propiedad */}
            <div className="mb-6 md:mb-8">
              <label className="block text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Daño a la Propiedad
              </label>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 md:p-6 border-2 border-orange-200">
                <div className="text-center mb-3 md:mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139]">
                    {formatCurrency(formData.danoPropiedad)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={danoPropiedadOptions.length - 1}
                  value={Math.max(0, danoPropiedadOptions.indexOf(formData.danoPropiedad))}
                  onChange={(e) => setFormData({ ...formData, danoPropiedad: danoPropiedadOptions[parseInt(e.target.value)] || 5000 })}
                  className="w-full h-4 md:h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(Math.max(0, danoPropiedadOptions.indexOf(formData.danoPropiedad)) / (danoPropiedadOptions.length - 1)) * 100}%, #e5e7eb ${(Math.max(0, danoPropiedadOptions.indexOf(formData.danoPropiedad)) / (danoPropiedadOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>{formatCurrency(danoPropiedadOptions[0] || 2500)}</span>
                  <span>{formatCurrency(danoPropiedadOptions[danoPropiedadOptions.length - 1] || 25000)}</span>
                </div>
              </div>
            </div>

            {/* Gastos Médicos */}
            <div className="mb-6 md:mb-8">
              <label className="block text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Gastos Médicos
              </label>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 md:p-6 border-2 border-purple-200">
                <div className="text-center mb-3 md:mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139]">
                    {formatCurrency(formData.gastosMedicos)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={gastosMedicosOptions.length - 1}
                  value={Math.max(0, gastosMedicosOptions.indexOf(formData.gastosMedicos))}
                  onChange={(e) => setFormData({ ...formData, gastosMedicos: gastosMedicosOptions[parseInt(e.target.value)] || 1000 })}
                  className="w-full h-4 md:h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${(Math.max(0, gastosMedicosOptions.indexOf(formData.gastosMedicos)) / (gastosMedicosOptions.length - 1)) * 100}%, #e5e7eb ${(Math.max(0, gastosMedicosOptions.indexOf(formData.gastosMedicos)) / (gastosMedicosOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>{formatCurrency(gastosMedicosOptions[0] || 500)}</span>
                  <span>{formatCurrency(gastosMedicosOptions[gastosMedicosOptions.length - 1] || 10000)}</span>
                </div>
              </div>
            </div>

            {/* Deducible */}
            <div>
              <label className="block text-sm md:text-base font-semibold text-gray-700 mb-3 md:mb-4">
                Deducible (tu parte en caso de reclamo)
              </label>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 md:p-6 border-2 border-gray-300">
                <div className="text-center mb-3 md:mb-4">
                  <span className="text-2xl md:text-3xl font-bold text-[#010139]">
                    {formatCurrency(formData.deducible)}
                  </span>
                  <p className="text-sm text-gray-600 mt-2">
                    A menor deducible, mayor prima
                  </p>
                </div>
                <input
                  type="range"
                  min="0"
                  max={deducibleOptions.length - 1}
                  value={Math.max(0, deducibleOptions.indexOf(formData.deducible))}
                  onChange={(e) => setFormData({ ...formData, deducible: deducibleOptions[parseInt(e.target.value)] || 500 })}
                  className="w-full h-4 md:h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #010139 0%, #010139 ${(Math.max(0, deducibleOptions.indexOf(formData.deducible)) / (deducibleOptions.length - 1)) * 100}%, #e5e7eb ${(Math.max(0, deducibleOptions.indexOf(formData.deducible)) / (deducibleOptions.length - 1)) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-2">
                  <span>{formatCurrency(deducibleOptions[0] || 250)}</span>
                  <span>{formatCurrency(deducibleOptions[deducibleOptions.length - 1] || 1500)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Datos del Conductor */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 lg:p-8">
            <ClientDataInput
              cedula={formData.cedula}
              nombreCompleto={formData.nombreConductor}
              email={formData.email}
              telefono={formData.telefono}
              onCedulaChange={(cedula) => setFormData({ ...formData, cedula })}
              onNombreChange={(nombreConductor) => setFormData({ ...formData, nombreConductor })}
              onEmailChange={(email) => setFormData({ ...formData, email })}
              onTelefonoChange={(telefono) => setFormData({ ...formData, telefono })}
              onClientFound={(clientData) => {
                // Cliente encontrado, llenar todos los datos disponibles
                setFormData(prev => ({
                  ...prev,
                  cedula: clientData.national_id || prev.cedula,
                  nombreConductor: clientData.name || prev.nombreConductor,
                  email: clientData.email || prev.email,
                  telefono: clientData.phone || prev.telefono,
                }));
              }}
              errors={{
                cedula: errors.cedula,
                nombreCompleto: errors.nombreConductor,
                email: errors.email,
                telefono: errors.telefono,
              }}
            />

            {/* Edad del Conductor */}
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Edad del Conductor
              </label>
              <input
                type="number"
                value={formData.edadConductor}
                onChange={(e) => setFormData({ ...formData, edadConductor: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                min="18"
                max="99"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:flex-1 px-6 md:px-8 py-3 md:py-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-base md:text-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:flex-1 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-base md:text-lg hover:shadow-2xl transition-all transform active:scale-95 sm:hover:scale-105"
            >
              Ver Cotizaciones
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #8AAA19;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #8AAA19;
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        @media (min-width: 768px) {
          .slider-thumb::-webkit-slider-thumb {
            width: 24px;
            height: 24px;
          }
          .slider-thumb::-moz-range-thumb {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
}
