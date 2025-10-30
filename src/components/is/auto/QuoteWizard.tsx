'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUser, FaCar, FaShieldAlt, FaCheckCircle } from 'react-icons/fa';

interface QuoteWizardProps {
  onQuoteGenerated: (idCotizacion: string, formData: any) => void;
  environment?: 'development' | 'production';
}

export default function QuoteWizard({ onQuoteGenerated, environment = 'development' }: QuoteWizardProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Cliente
    vcodtipodoc: 'CED',
    vnrodoc: '',
    vnombre: '',
    vapellido: '',
    vtelefono: '',
    vcorreo: '',
    // Vehículo
    vcodmarca: '',
    vmarca_label: '',
    vcodmodelo: '',
    vmodelo_label: '',
    vanioauto: new Date().getFullYear(),
    // Cobertura
    vsumaaseg: 15000,
    vcodplancobertura: 'PLAN01',
    vcodgrupotarifa: 'GT01',
    tipo_cobertura: 'Daños a terceros',
  });

  // MOCK: Catálogos (en producción vienen de /api/is/catalogs)
  const marcas = [
    { vcodmarca: '01', vdescripcion: 'Toyota' },
    { vcodmarca: '02', vdescripcion: 'Honda' },
    { vcodmarca: '03', vdescripcion: 'Hyundai' },
    { vcodmarca: '04', vdescripcion: 'Kia' },
    { vcodmarca: '05', vdescripcion: 'Nissan' },
  ];

  const modelos = [
    { vcodmodelo: '001', vdescripcion: 'Corolla', vcodmarca: '01' },
    { vcodmodelo: '002', vdescripcion: 'Camry', vcodmarca: '01' },
    { vcodmodelo: '003', vdescripcion: 'Civic', vcodmarca: '02' },
    { vcodmodelo: '004', vdescripcion: 'Accord', vcodmarca: '02' },
    { vcodmodelo: '005', vdescripcion: 'Elantra', vcodmarca: '03' },
    { vcodmodelo: '006', vdescripcion: 'Tucson', vcodmarca: '03' },
    { vcodmodelo: '007', vdescripcion: 'Rio', vcodmarca: '04' },
    { vcodmodelo: '008', vdescripcion: 'Sportage', vcodmarca: '04' },
    { vcodmodelo: '009', vdescripcion: 'Sentra', vcodmarca: '05' },
    { vcodmodelo: '010', vdescripcion: 'X-Trail', vcodmarca: '05' },
  ];

  const modelosFiltrados = modelos.filter(m => m.vcodmarca === formData.vcodmarca);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    // MOCK: Simular llamada a API (en producción llama a /api/is/auto/quote)
    setTimeout(() => {
      const mockIdCotizacion = `IDCOT-${Date.now()}`;
      console.log('[MOCK] Cotización generada:', mockIdCotizacion);
      onQuoteGenerated(mockIdCotizacion, formData);
      setIsLoading(false);
    }, 1500);
  };

  const steps = [
    { number: 1, title: 'Datos Cliente', icon: FaUser },
    { number: 2, title: 'Datos Vehículo', icon: FaCar },
    { number: 3, title: 'Cobertura', icon: FaShieldAlt },
    { number: 4, title: 'Resumen', icon: FaCheckCircle },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {steps.map((s, index) => (
            <div key={s.number} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    step >= s.number
                      ? 'bg-[#010139] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <div className={`mt-2 text-sm font-medium ${step >= s.number ? 'text-[#010139]' : 'text-gray-500'}`}>
                  {s.title}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-1 flex-1 mx-2 ${step > s.number ? 'bg-[#010139]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          {/* Step 1: Cliente */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[#010139] mb-6">Datos del Cliente</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={formData.vcodtipodoc}
                    onChange={(e) => setFormData({ ...formData, vcodtipodoc: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                  >
                    <option value="CED">Cédula</option>
                    <option value="PAS">Pasaporte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento *
                  </label>
                  <input
                    type="text"
                    value={formData.vnrodoc}
                    onChange={(e) => setFormData({ ...formData, vnrodoc: e.target.value })}
                    placeholder="8-888-8888"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.vnombre}
                    onChange={(e) => setFormData({ ...formData, vnombre: e.target.value })}
                    placeholder="Juan"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={formData.vapellido}
                    onChange={(e) => setFormData({ ...formData, vapellido: e.target.value })}
                    placeholder="Pérez"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={formData.vtelefono}
                    onChange={(e) => setFormData({ ...formData, vtelefono: e.target.value })}
                    placeholder="6666-6666"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    value={formData.vcorreo}
                    onChange={(e) => setFormData({ ...formData, vcorreo: e.target.value })}
                    placeholder="juan@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Vehículo */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[#010139] mb-6">Datos del Vehículo</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca *
                  </label>
                  <select
                    value={formData.vcodmarca}
                    onChange={(e) => {
                      const marca = marcas.find(m => m.vcodmarca === e.target.value);
                      setFormData({
                        ...formData,
                        vcodmarca: e.target.value,
                        vmarca_label: marca?.vdescripcion || '',
                        vcodmodelo: '',
                        vmodelo_label: '',
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  >
                    <option value="">Seleccione...</option>
                    {marcas.map(m => (
                      <option key={m.vcodmarca} value={m.vcodmarca}>
                        {m.vdescripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo *
                  </label>
                  <select
                    value={formData.vcodmodelo}
                    onChange={(e) => {
                      const modelo = modelosFiltrados.find(m => m.vcodmodelo === e.target.value);
                      setFormData({
                        ...formData,
                        vcodmodelo: e.target.value,
                        vmodelo_label: modelo?.vdescripcion || '',
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    disabled={!formData.vcodmarca}
                    required
                  >
                    <option value="">Seleccione...</option>
                    {modelosFiltrados.map(m => (
                      <option key={m.vcodmodelo} value={m.vcodmodelo}>
                        {m.vdescripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Año *
                  </label>
                  <input
                    type="number"
                    value={formData.vanioauto}
                    onChange={(e) => setFormData({ ...formData, vanioauto: parseInt(e.target.value) })}
                    min={1980}
                    max={new Date().getFullYear() + 1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139] focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Cobertura */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#010139] mb-6">Cobertura</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Cobertura
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setFormData({ ...formData, tipo_cobertura: 'Daños a terceros' })}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.tipo_cobertura === 'Daños a terceros'
                        ? 'border-[#010139] bg-[#010139]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold text-lg mb-1">Daños a Terceros</h3>
                    <p className="text-sm text-gray-600">Cobertura básica para daños a terceros</p>
                  </div>
                  
                  <div
                    onClick={() => setFormData({ ...formData, tipo_cobertura: 'Cobertura completa' })}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.tipo_cobertura === 'Cobertura completa'
                        ? 'border-[#010139] bg-[#010139]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold text-lg mb-1">Cobertura Completa</h3>
                    <p className="text-sm text-gray-600">Cobertura total incluye todo riesgo</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suma Asegurada: ${formData.vsumaaseg.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="1000"
                  value={formData.vsumaaseg}
                  onChange={(e) => setFormData({ ...formData, vsumaaseg: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#010139]"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$5,000</span>
                  <span>$100,000</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Resumen */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#010139] mb-6">Resumen de Cotización</h2>
              
              <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Cliente</h3>
                  <p className="text-gray-600">{formData.vnombre} {formData.vapellido}</p>
                  <p className="text-gray-600 text-sm">{formData.vcorreo} | {formData.vtelefono}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Vehículo</h3>
                  <p className="text-gray-600">{formData.vmarca_label} {formData.vmodelo_label} {formData.vanioauto}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Cobertura</h3>
                  <p className="text-gray-600">{formData.tipo_cobertura}</p>
                  <p className="text-gray-600 text-sm">Suma asegurada: ${formData.vsumaaseg.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Atrás
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#010139]/90 transition-colors"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#8AAA19]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Generando...' : 'Generar Cotización'}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
