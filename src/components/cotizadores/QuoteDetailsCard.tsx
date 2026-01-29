/**
 * Tarjeta de detalles completos de cotización
 * Muestra coberturas, límites, beneficios, endosos y deducibles
 */

'use client';

import { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaShieldAlt, FaCheckCircle, FaStar, FaFileAlt, FaMoneyBillWave } from 'react-icons/fa';

interface CoberturaDetalle {
  codigo: string | number;
  nombre: string;
  descripcion: string;
  limite: string;
  prima: number;
  deducible?: string;
  incluida: boolean;
}

interface Limite {
  tipo: string;
  limitePorPersona: string;
  limitePorAccidente?: string;
  descripcion: string;
}

interface Beneficio {
  nombre: string;
  descripcion?: string;
  incluido: boolean;
}

interface Endoso {
  codigo: string;
  nombre: string;
  descripcion?: string;
  incluido: boolean;
}

interface DeducibleInfo {
  valor: number;
  tipo: string;
  descripcion: string;
}

interface QuoteDetailsCardProps {
  aseguradora: string;
  coberturasDetalladas?: CoberturaDetalle[];
  limites?: Limite[];
  beneficios?: Beneficio[];
  endosos?: Endoso[];
  deducibleInfo?: DeducibleInfo;
  sumaAsegurada?: number;
  primaBase?: number;
  impuesto1?: number;
  impuesto2?: number;
  primaTotal: number;
}

export default function QuoteDetailsCard({
  aseguradora,
  coberturasDetalladas = [],
  limites = [],
  beneficios = [],
  endosos = [],
  deducibleInfo,
  sumaAsegurada = 0,
  primaBase = 0,
  impuesto1 = 0,
  impuesto2 = 0,
  primaTotal
}: QuoteDetailsCardProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('coberturas');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 md:p-6 mt-6 border border-gray-200 shadow-sm">
      <h3 className="text-base md:text-lg font-semibold text-[#010139] mb-4 md:mb-6 flex items-center gap-2">
        <FaShieldAlt className="text-[#8AAA19] text-lg" />
        Detalles de la Cotización
      </h3>

      {/* Suma Asegurada y Deducible */}
      {(sumaAsegurada > 0 || deducibleInfo) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6 p-4 md:p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
          {sumaAsegurada > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Valor del Vehículo</p>
              <p className="text-base font-bold text-[#010139]">{formatCurrency(sumaAsegurada)}</p>
            </div>
          )}
          {deducibleInfo && deducibleInfo.descripcion && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Deducible</p>
              <p className="text-base font-bold text-[#8AAA19]">{deducibleInfo.descripcion}</p>
            </div>
          )}
        </div>
      )}

      {/* Límites de Responsabilidad Civil */}
      {limites.length > 0 && (
        <div className="mb-4 md:mb-5">
          <button
            onClick={() => toggleSection('limites')}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-white rounded-xl border border-gray-200 hover:border-[#8AAA19] hover:shadow-md transition-all"
          >
            <span className="text-sm md:text-base font-semibold text-[#010139] flex items-center gap-2 md:gap-3">
              <FaShieldAlt className="text-[#8AAA19] text-lg" />
              Límites de Responsabilidad Civil ({limites.length})
            </span>
            {expandedSection === 'limites' ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </button>
          
          {expandedSection === 'limites' && (
            <div className="mt-3 md:mt-4 space-y-3">
              {limites.map((limite, index) => (
                <div key={index} className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm">
                  <p className="font-semibold text-sm md:text-base text-[#010139] mb-2">{limite.descripcion}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs md:text-sm text-gray-600">
                    <span>Por persona: <strong className="text-[#010139]">{limite.limitePorPersona}</strong></span>
                    {limite.limitePorAccidente && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span>Por accidente: <strong className="text-[#010139]">{limite.limitePorAccidente}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coberturas Detalladas */}
      {coberturasDetalladas.length > 0 && (
        <div className="mb-4 md:mb-5">
          <button
            onClick={() => toggleSection('coberturas')}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-white rounded-xl border border-gray-200 hover:border-[#8AAA19] hover:shadow-md transition-all"
          >
            <span className="text-sm md:text-base font-semibold text-[#010139] flex items-center gap-2 md:gap-3">
              <FaCheckCircle className="text-[#8AAA19] text-lg" />
              Coberturas Incluidas ({coberturasDetalladas.length})
            </span>
            {expandedSection === 'coberturas' ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </button>
          
          {expandedSection === 'coberturas' && (
            <div className="mt-3 md:mt-4 space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {coberturasDetalladas.map((cobertura, index) => (
                <div key={index} className="bg-white p-4 md:p-5 rounded-xl border border-gray-100 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold text-sm md:text-base text-[#010139] flex-1 leading-snug">{cobertura.nombre}</p>
                    <span className="text-sm md:text-base font-bold text-[#8AAA19] flex-shrink-0">
                      {formatCurrency(cobertura.prima)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs md:text-sm text-gray-600">
                    {cobertura.limite && (
                      <span>Límite: <strong className="text-[#010139]">{cobertura.limite}</strong></span>
                    )}
                    {cobertura.deducible && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span>Deducible: <strong className="text-[#010139]">{cobertura.deducible}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Beneficios */}
      {beneficios.length > 0 && (
        <div className="mb-4 md:mb-5">
          <button
            onClick={() => toggleSection('beneficios')}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-white rounded-xl border border-gray-200 hover:border-[#8AAA19] hover:shadow-md transition-all"
          >
            <span className="text-sm md:text-base font-semibold text-[#010139] flex items-center gap-2 md:gap-3">
              <FaStar className="text-[#8AAA19] text-lg" />
              Beneficios Extras ({beneficios.length})
            </span>
            {expandedSection === 'beneficios' ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </button>
          {expandedSection === 'beneficios' && (
            <div className="mt-3 md:mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {beneficios.map((beneficio, index) => (
                <div key={index} className="flex items-start gap-3 p-3 md:p-4 bg-green-50 rounded-lg border border-green-100">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5 text-base" />
                  <span className="text-sm md:text-base text-gray-700 leading-snug">
                    {typeof beneficio === 'string' ? beneficio : beneficio.nombre}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Endosos */}
      {endosos.length > 0 && (
        <div className="mb-4 md:mb-5">
          <button
            onClick={() => toggleSection('endosos')}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-white rounded-xl border border-gray-200 hover:border-[#8AAA19] hover:shadow-md transition-all"
          >
            <span className="text-sm md:text-base font-semibold text-[#010139] flex items-center gap-2 md:gap-3">
              <FaFileAlt className="text-[#8AAA19] text-lg" />
              Documentos Incluidos ({endosos.length})
            </span>
            {expandedSection === 'endosos' ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </button>
          {expandedSection === 'endosos' && (
            <div className="mt-3 md:mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {endosos.map((endoso, index) => (
                <div key={index} className="flex items-start gap-3 p-3 md:p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <FaFileAlt className="text-blue-600 flex-shrink-0 mt-0.5 text-base" />
                  <span className="text-sm md:text-base text-gray-700 leading-snug">
                    {typeof endoso === 'string' ? endoso : endoso.nombre}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desglose de Prima */}
      {(primaBase !== undefined || impuesto1 !== undefined || impuesto2 !== undefined) && (
        <div className="mt-5">
          <button
            onClick={() => toggleSection('prima')}
            className="w-full flex items-center justify-between p-4 md:p-5 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border-2 border-[#8AAA19] hover:shadow-lg transition-all"
          >
            <span className="text-sm md:text-base font-bold text-[#010139] flex items-center gap-2 md:gap-3">
              <FaMoneyBillWave className="text-[#8AAA19] text-lg" />
              ¿Cómo se Calcula el Precio?
            </span>
            {expandedSection === 'prima' ? <FaChevronUp className="text-[#8AAA19]" /> : <FaChevronDown className="text-[#8AAA19]" />}
          </button>
          {expandedSection === 'prima' && (
            <div className="mt-3 md:mt-4 p-4 md:p-5 bg-white rounded-xl border border-gray-200 space-y-3 text-sm md:text-base">
              {primaBase !== undefined && primaBase > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prima Base (sin descuentos):</span>
                    <span className="font-medium text-gray-700">{formatCurrency(primaBase)}</span>
                  </div>
                  {/* Mostrar descuento si existe */}
                  {primaBase > primaTotal * 1.5 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="font-medium">- Descuentos aplicados:</span>
                      <span className="font-bold">-{formatCurrency(primaBase - primaTotal + (impuesto1 || 0) + (impuesto2 || 0))}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 my-2"></div>
                </>
              )}
              {impuesto1 !== undefined && impuesto1 > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">+ Impuesto (5%):</span>
                  <span className="font-medium text-gray-700">{formatCurrency(impuesto1)}</span>
                </div>
              )}
              {impuesto2 !== undefined && impuesto2 > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">+ Recargo Legal (1%):</span>
                  <span className="font-medium text-gray-700">{formatCurrency(impuesto2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t-2 border-[#8AAA19]">
                <span className="font-bold text-base md:text-lg text-[#010139]">Total a Pagar Anual:</span>
                <span className="font-bold text-xl md:text-2xl text-[#8AAA19]">{formatCurrency(primaTotal)}</span>
              </div>
              {primaBase > primaTotal * 1.5 && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    💰 <strong>¡Descuento aplicado!</strong> El precio final incluye descuentos por perfil del cliente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Estilos personalizados para scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8AAA19;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6d8814;
        }
      `}</style>
    </div>
  );
}
