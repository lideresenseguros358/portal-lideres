/**
 * Formulario de Cotización - Auto
 * Todas las aseguradoras disponibles
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUppercaseInputs } from '@/lib/cotizadores/hooks/useUppercaseInputs';
import { useOnline } from '@/lib/cotizadores/hooks/useOnline';
import OfflineBanner from './OfflineBanner';
import type { AutoQuoteInput } from '@/lib/cotizadores/types';

export default function FormAuto() {
  const router = useRouter();
  const { createUppercaseHandler } = useUppercaseInputs();
  const isOnline = useOnline();
  
  const [formData, setFormData] = useState<Partial<AutoQuoteInput>>({
    policyType: 'AUTO',
    cobertura: 'TERCEROS',
    uso: 'PARTICULAR',
    garajeNocturno: false,
    siniestrosUltimos3: 0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.cobertura) newErrors.cobertura = 'Requerido';
    if (!formData.marca) newErrors.marca = 'Requerido';
    if (!formData.modelo) newErrors.modelo = 'Requerido';
    if (!formData.anno || formData.anno < 1980 || formData.anno > new Date().getFullYear() + 1) {
      newErrors.anno = 'Año inválido';
    }
    if (!formData.valor || formData.valor <= 0) newErrors.valor = 'Valor inválido';
    if (formData.conductorEdad && (formData.conductorEdad < 18 || formData.conductorEdad > 99)) {
      newErrors.conductorEdad = 'Edad inválida';
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
    
    // Analytics
    console.log('[Analytics] start_form:', { policyType: 'AUTO', data: formData });
    
    // Guardar en sessionStorage y navegar
    sessionStorage.setItem('quoteInput', JSON.stringify(formData));
    router.push('/cotizadores/comparar');
  };

  const isValid = formData.cobertura && formData.marca && formData.modelo && 
                  formData.anno && formData.valor;

  return (
    <>
      <OfflineBanner />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Cotiza tu Seguro de Auto
          </h1>
          <p className="text-gray-600">
            Completa los datos de tu vehículo para obtener las mejores opciones
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 md:p-8 space-y-6">
          
          {/* Uso */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Uso del vehículo <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.uso}
              onChange={(e) => setFormData({ ...formData, uso: e.target.value as any })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            >
              <option value="PARTICULAR">PARTICULAR</option>
              <option value="COMERCIAL">COMERCIAL</option>
            </select>
          </div>

          {/* Cobertura */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Tipo de cobertura <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, cobertura: 'TERCEROS' })}
                className={`px-4 py-4 rounded-lg font-semibold border-2 transition-all ${
                  formData.cobertura === 'TERCEROS'
                    ? 'bg-[#010139] text-white border-[#010139] shadow-lg scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                }`}
              >
                <div className="text-2xl mb-1">🛡️</div>
                TERCEROS
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, cobertura: 'COMPLETA' })}
                className={`px-4 py-4 rounded-lg font-semibold border-2 transition-all ${
                  formData.cobertura === 'COMPLETA'
                    ? 'bg-[#010139] text-white border-[#010139] shadow-lg scale-105'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#8AAA19]'
                }`}
              >
                <div className="text-2xl mb-1">🔰</div>
                COMPLETA
              </button>
            </div>
          </div>

          {/* Marca y Modelo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Marca <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.marca || ''}
                onChange={createUppercaseHandler((e) => 
                  setFormData({ ...formData, marca: e.target.value })
                )}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="TOYOTA"
              />
              {errors.marca && <p className="text-red-500 text-sm mt-1">{errors.marca}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.modelo || ''}
                onChange={createUppercaseHandler((e) => 
                  setFormData({ ...formData, modelo: e.target.value })
                )}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="COROLLA"
              />
              {errors.modelo && <p className="text-red-500 text-sm mt-1">{errors.modelo}</p>}
            </div>
          </div>

          {/* Año y Valor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Año <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.anno || ''}
                onChange={(e) => setFormData({ ...formData, anno: parseInt(e.target.value) || undefined })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="2020"
                min="1980"
                max={new Date().getFullYear() + 1}
              />
              {errors.anno && <p className="text-red-500 text-sm mt-1">{errors.anno}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Valor del vehículo (USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.valor || ''}
                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || undefined })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="15000"
                min="1000"
                step="100"
              />
              {errors.valor && <p className="text-red-500 text-sm mt-1">{errors.valor}</p>}
            </div>
          </div>

          {/* Provincia */}
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

          {/* Edad conductor y Siniestros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Edad del conductor (opcional)
              </label>
              <input
                type="number"
                value={formData.conductorEdad || ''}
                onChange={(e) => setFormData({ ...formData, conductorEdad: parseInt(e.target.value) || undefined })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="30"
                min="18"
                max="99"
              />
              {errors.conductorEdad && <p className="text-red-500 text-sm mt-1">{errors.conductorEdad}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Siniestros últimos 3 años
              </label>
              <select
                value={formData.siniestrosUltimos3 || 0}
                onChange={(e) => setFormData({ ...formData, siniestrosUltimos3: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              >
                <option value="0">Sin siniestros</option>
                <option value="1">1 siniestro</option>
                <option value="2">2 siniestros</option>
                <option value="3">3+ siniestros</option>
              </select>
            </div>
          </div>

          {/* Garaje nocturno */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.garajeNocturno || false}
                onChange={(e) => setFormData({ ...formData, garajeNocturno: e.target.checked })}
                className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
              />
              <div>
                <span className="font-semibold text-gray-800">
                  Tiene garaje nocturno
                </span>
                <p className="text-sm text-gray-600">
                  Puede reducir el costo de tu prima
                </p>
              </div>
            </label>
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
