/**
 * Formulario de Cotización - Vida
 * Solo ASSA disponible
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUppercaseInputs } from '@/lib/cotizadores/hooks/useUppercaseInputs';
import { useOnline } from '@/lib/cotizadores/hooks/useOnline';
import OfflineBanner from './OfflineBanner';
import type { VidaQuoteInput } from '@/lib/cotizadores/types';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';

export default function FormVida() {
  const router = useRouter();
  const { createUppercaseHandler } = useUppercaseInputs();
  const isOnline = useOnline();
  
  const [formData, setFormData] = useState<Partial<VidaQuoteInput>>({
    policyType: 'VIDA',
    fumador: false
  });

  const [contactData, setContactData] = useState({ nombre: '', email: '', telefono: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.edad || formData.edad < 18 || formData.edad > 75) {
      newErrors.edad = 'Edad debe estar entre 18 y 75 años';
    }
    if (!formData.sexo) newErrors.sexo = 'Requerido';
    if (!formData.sumaAsegurada || formData.sumaAsegurada < 10000) {
      newErrors.sumaAsegurada = 'Suma mínima: $10,000';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    console.log('[Analytics] start_form:', { policyType: 'VIDA', data: formData });
    
    sessionStorage.setItem('quoteInput', JSON.stringify(formData));

    // Create petition in ops_cases (fire-and-forget)
    if (contactData.nombre.trim()) {
      createPetitionFromQuote({
        client_name: contactData.nombre.trim(),
        client_email: contactData.email.trim() || undefined,
        client_phone: contactData.telefono.trim() || undefined,
        ramo: 'vida',
        details: { ...formData },
        source: 'COTIZADOR_VIDA',
      });
    }

    router.push('/cotizadores/comparar');
  };

  const isValid = formData.edad && formData.sexo && formData.sumaAsegurada;

  return (
    <>
      <OfflineBanner />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Cotiza tu Seguro de Vida
          </h1>
          <p className="text-gray-600">
            Protección para tu familia • Solo ASSA disponible
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 md:p-8 space-y-6">
          
          {/* Edad y Sexo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Edad <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.edad || ''}
                onChange={(e) => setFormData({ ...formData, edad: parseInt(e.target.value) || undefined })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="30"
                min="18"
                max="75"
              />
              {errors.edad && <p className="text-red-500 text-sm mt-1">{errors.edad}</p>}
              <p className="text-xs text-gray-500 mt-1">Entre 18 y 75 años</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sexo <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexo: 'M' })}
                  className={`px-4 py-3 rounded-lg font-semibold border-2 transition-all ${
                    formData.sexo === 'M'
                      ? 'bg-[#010139] text-white border-[#010139]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                  }`}
                >
                  MASCULINO
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexo: 'F' })}
                  className={`px-4 py-3 rounded-lg font-semibold border-2 transition-all ${
                    formData.sexo === 'F'
                      ? 'bg-[#010139] text-white border-[#010139]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                  }`}
                >
                  FEMENINO
                </button>
              </div>
              {errors.sexo && <p className="text-red-500 text-sm mt-1">{errors.sexo}</p>}
            </div>
          </div>

          {/* Fumador */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fumador || false}
                onChange={(e) => setFormData({ ...formData, fumador: e.target.checked })}
                className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
              />
              <div>
                <span className="font-semibold text-gray-800">
                  ¿Es fumador?
                </span>
                <p className="text-sm text-gray-600">
                  Esto puede afectar el costo de la prima
                </p>
              </div>
            </label>
          </div>

          {/* Suma Asegurada */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Suma Asegurada (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.sumaAsegurada || ''}
              onChange={(e) => setFormData({ ...formData, sumaAsegurada: parseFloat(e.target.value) || undefined })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              placeholder="50000"
              min="10000"
              step="5000"
            />
            {errors.sumaAsegurada && <p className="text-red-500 text-sm mt-1">{errors.sumaAsegurada}</p>}
            <p className="text-xs text-gray-500 mt-1">Monto mínimo: $10,000</p>
          </div>

          {/* Plazo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Plazo en años (opcional)
            </label>
            <select
              value={formData.plazoAnnios || ''}
              onChange={(e) => setFormData({ ...formData, plazoAnnios: parseInt(e.target.value) || undefined })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Selecciona un plazo</option>
              <option value="10">10 años</option>
              <option value="15">15 años</option>
              <option value="20">20 años</option>
              <option value="25">25 años</option>
              <option value="30">30 años</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Duración de la cobertura</p>
          </div>

          {/* Ocupación */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ocupación (opcional)
            </label>
            <input
              type="text"
              value={formData.ocupacion || ''}
              onChange={createUppercaseHandler((e) => 
                setFormData({ ...formData, ocupacion: e.target.value })
              )}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              placeholder="INGENIERO"
            />
            <p className="text-xs text-gray-500 mt-1">Puede afectar la evaluación de riesgo</p>
          </div>

          {/* Datos de Contacto */}
          <div className="border-2 border-[#8AAA19]/30 rounded-xl p-5 space-y-4 bg-[#8AAA19]/5">
            <h3 className="text-sm font-bold text-[#010139]">Datos de Contacto (opcional)</h3>
            <p className="text-xs text-gray-500 -mt-2">Si deseas que un asesor te contacte con la cotización</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={contactData.nombre}
                  onChange={createUppercaseHandler((e) => setContactData({ ...contactData, nombre: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                  placeholder="NOMBRE COMPLETO"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={contactData.telefono}
                  onChange={(e) => setContactData({ ...contactData, telefono: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                  placeholder="6000-0000"
                />
              </div>
            </div>
          </div>

          {/* Nota informativa */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Información importante</h4>
                <p className="text-sm text-blue-800">
                  Los beneficiarios se solicitarán en la etapa de emisión. 
                  Puede que se requiera evaluación médica según la edad y suma asegurada.
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!isValid || !isOnline}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {!isOnline ? '⚠️ SIN CONEXIÓN' : 'COTIZAR AHORA'}
            </button>
            
            {!isValid && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Completa todos los campos obligatorios (*)
              </p>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
