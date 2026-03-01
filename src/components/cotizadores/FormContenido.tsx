/**
 * Formulario de Cotización - Contenido
 * 2 aseguradoras disponibles
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUppercaseInputs } from '@/lib/cotizadores/hooks/useUppercaseInputs';
import { useOnline } from '@/lib/cotizadores/hooks/useOnline';
import OfflineBanner from './OfflineBanner';
import type { FireContentsQuoteInput } from '@/lib/cotizadores/types';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';

export default function FormContenido() {
  const router = useRouter();
  const { createUppercaseHandler } = useUppercaseInputs();
  const isOnline = useOnline();
  
  const [formData, setFormData] = useState<Partial<FireContentsQuoteInput>>({
    policyType: 'CONTENIDO',
    seguridad: {
      alarma: false,
      extintor: false,
      rociadores: false
    }
  });

  const [contactData, setContactData] = useState({ nombre: '', email: '', telefono: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.tipoInmueble) newErrors.tipoInmueble = 'Requerido';
    if (!formData.sumaContenido || formData.sumaContenido < 5000) {
      newErrors.sumaContenido = 'Suma mínima: $5,000';
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
    
    console.log('[Analytics] start_form:', { policyType: 'CONTENIDO', data: formData });
    
    sessionStorage.setItem('quoteInput', JSON.stringify(formData));

    // Create petition in ops_cases (fire-and-forget)
    if (contactData.nombre.trim()) {
      createPetitionFromQuote({
        client_name: contactData.nombre.trim(),
        client_email: contactData.email.trim() || undefined,
        client_phone: contactData.telefono.trim() || undefined,
        ramo: 'hogar',
        details: { ...formData },
        source: 'COTIZADOR_HOGAR',
      });
    }

    router.push('/cotizadores/comparar');
  };

  const isValid = formData.tipoInmueble && formData.sumaContenido;

  return (
    <>
      <OfflineBanner />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Cotiza tu Seguro de Contenido
          </h1>
          <p className="text-gray-600">
            Protección para tus muebles, enseres y pertenencias
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 md:p-8 space-y-6">
          
          {/* Tipo de Inmueble */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Tipo de inmueble <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipoInmueble: 'CASA' })}
                className={`px-4 py-4 rounded-lg font-semibold border-2 transition-all ${
                  formData.tipoInmueble === 'CASA'
                    ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                }`}
              >
                <div className="text-2xl mb-1">🏠</div>
                CASA
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipoInmueble: 'APTO' })}
                className={`px-4 py-4 rounded-lg font-semibold border-2 transition-all ${
                  formData.tipoInmueble === 'APTO'
                    ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                }`}
              >
                <div className="text-2xl mb-1">🏢</div>
                APTO
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipoInmueble: 'LOCAL' })}
                className={`px-4 py-4 rounded-lg font-semibold border-2 transition-all ${
                  formData.tipoInmueble === 'LOCAL'
                    ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                }`}
              >
                <div className="text-2xl mb-1">🏪</div>
                LOCAL
              </button>
            </div>
            {errors.tipoInmueble && <p className="text-red-500 text-sm mt-1">{errors.tipoInmueble}</p>}
          </div>

          {/* Suma Contenido */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Valor del contenido (USD) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.sumaContenido || ''}
              onChange={(e) => setFormData({ ...formData, sumaContenido: parseFloat(e.target.value) || undefined })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              placeholder="30000"
              min="5000"
              step="1000"
            />
            {errors.sumaContenido && <p className="text-red-500 text-sm mt-1">{errors.sumaContenido}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Incluye muebles, electrodomésticos, ropa, electrónicos, etc.
            </p>
          </div>

          {/* M² y Provincia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Metros cuadrados (opcional)
              </label>
              <input
                type="number"
                value={formData.metros2 || ''}
                onChange={(e) => setFormData({ ...formData, metros2: parseFloat(e.target.value) || undefined })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="150"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Provincia (opcional)
              </label>
              <input
                type="text"
                value={formData.provincia || ''}
                onChange={createUppercaseHandler((e) => 
                  setFormData({ ...formData, provincia: e.target.value })
                )}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="PANAMÁ"
              />
            </div>
          </div>

          {/* Seguridad */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Medidas de seguridad
            </label>
            <div className="space-y-3 bg-gray-50 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.seguridad?.alarma || false}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    seguridad: { ...formData.seguridad, alarma: e.target.checked } 
                  })}
                  className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                />
                <div>
                  <span className="font-semibold text-gray-800">Sistema de alarma</span>
                  <p className="text-sm text-gray-600">Reduce hasta 5% la prima</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.seguridad?.extintor || false}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    seguridad: { ...formData.seguridad, extintor: e.target.checked } 
                  })}
                  className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                />
                <div>
                  <span className="font-semibold text-gray-800">Extintor</span>
                  <p className="text-sm text-gray-600">Reduce hasta 3% la prima</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.seguridad?.rociadores || false}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    seguridad: { ...formData.seguridad, rociadores: e.target.checked } 
                  })}
                  className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                />
                <div>
                  <span className="font-semibold text-gray-800">Sistema de rociadores</span>
                  <p className="text-sm text-gray-600">Reduce hasta 7% la prima</p>
                </div>
              </label>
            </div>
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
              <div className="text-2xl">💡</div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Consejo</h4>
                <p className="text-sm text-blue-800">
                  Haz un inventario de tus pertenencias y su valor aproximado. 
                  Artículos de alto valor (joyas, obras de arte) pueden requerir cobertura adicional.
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
