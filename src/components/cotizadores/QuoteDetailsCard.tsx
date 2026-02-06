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
  subBeneficios?: string[];
}

interface DeducibleInfo {
  valor: number;
  tipo: string;
  descripcion: string;
  tooltip?: string;
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
  const [mainExpanded, setMainExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
    <div className="mt-4">
      {/* Botón principal colapsable */}
      <button
        onClick={() => setMainExpanded(!mainExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-200 hover:border-[#8AAA19] hover:shadow-md transition-all"
      >
        <span className="text-sm md:text-base font-bold text-[#010139] flex items-center gap-2">
          <FaShieldAlt className="text-[#8AAA19] text-lg" />
          Ver Detalles de la Cotización
        </span>
        {mainExpanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
      </button>

      {/* Contenido expandible */}
      {mainExpanded && (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 md:p-6 mt-2 border border-gray-200 shadow-sm">

      {/* Suma Asegurada y Deducible */}
      {(sumaAsegurada > 0 || deducibleInfo) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6 p-4 md:p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
          {sumaAsegurada > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Valor del Vehículo</p>
              <p className="text-base font-bold text-[#010139]">{formatCurrency(sumaAsegurada)}</p>
            </div>
          )}
          {deducibleInfo && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Deducibles</p>
              {deducibleInfo.tooltip ? (
                <div className="space-y-1">
                  {deducibleInfo.tooltip.split('\n').map((line: string, i: number) => (
                    <p key={i} className="text-sm font-bold text-[#8AAA19]">{line}</p>
                  ))}
                </div>
              ) : deducibleInfo.descripcion ? (
                <p className="text-base font-bold text-[#8AAA19]">{deducibleInfo.descripcion}</p>
              ) : deducibleInfo.valor > 0 ? (
                <p className="text-base font-bold text-[#8AAA19]">B/.{deducibleInfo.valor.toFixed(2)}</p>
              ) : null}
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
              Endosos Incluidos ({endosos.length})
            </span>
            {expandedSection === 'endosos' ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
          </button>
          {expandedSection === 'endosos' && (
            <div className="mt-3 md:mt-4 space-y-2.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {endosos.map((endoso: any, index: number) => {
                const subBeneficios = endoso.subBeneficios || [];
                return (
                  <div key={index} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-start gap-3 p-3 md:p-4">
                      <FaFileAlt className="text-[#8AAA19] flex-shrink-0 mt-0.5 text-base" />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm md:text-base font-semibold text-gray-800 leading-snug">
                          {typeof endoso === 'string' ? endoso : endoso.nombre}
                        </span>
                        {typeof endoso !== 'string' && endoso.descripcion && (
                          <span className="text-xs text-gray-500 mt-0.5">{endoso.descripcion}</span>
                        )}
                      </div>
                    </div>
                    {subBeneficios.length > 0 && (
                      <div className="px-4 pb-3 pt-0 border-t border-gray-50">
                        <div className="grid grid-cols-1 gap-1 mt-2">
                          {subBeneficios.map((sub: string, sIdx: number) => (
                            <div key={sIdx} className="flex items-start gap-1.5 text-xs text-gray-600">
                              <span className="text-[#8AAA19] mt-0.5 flex-shrink-0">✓</span>
                              <span>{sub}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
