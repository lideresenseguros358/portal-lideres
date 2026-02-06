/**
 * Modal de Upgrade a Plan Premium
 * Muestra diferencias de cobertura y costo adicional
 * Se muestra al seleccionar plan básico o al hacer click en "Mejorar Plan"
 */

'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaTimesCircle, FaStar, FaArrowUp, FaChevronDown, FaChevronUp, FaShieldAlt } from 'react-icons/fa';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onContinueBasic: () => void;
  insurerName: string;
  basicPlan: {
    premium: number;
    deductible: number;
    coverages: string[];
    beneficios?: any[];
    endosos?: any[];
    _priceBreakdown?: any;
  };
  premiumPlan: {
    premium: number;
    deductible: number;
    coverages: string[];
    beneficios?: any[];
    endosos?: any[];
    _priceBreakdown?: any;
  };
}

export default function PremiumUpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  onContinueBasic,
  insurerName,
  basicPlan,
  premiumPlan,
}: PremiumUpgradeModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedEndoso, setExpandedEndoso] = useState<number | null>(0);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const hasBreakdown = premiumPlan._priceBreakdown && basicPlan._priceBreakdown;
  
  const precioBasicoTarjeta = hasBreakdown ? basicPlan._priceBreakdown.totalConTarjeta : basicPlan.premium;
  const precioBasicoContado = hasBreakdown ? basicPlan._priceBreakdown.totalAlContado : basicPlan.premium;
  
  const precioPremiumTarjeta = hasBreakdown ? premiumPlan._priceBreakdown.totalConTarjeta : premiumPlan.premium;
  const precioPremiumContado = hasBreakdown ? premiumPlan._priceBreakdown.totalAlContado : premiumPlan.premium;
  
  const diferenciaTarjeta = precioPremiumTarjeta - precioBasicoTarjeta;
  const diferenciaContado = precioPremiumContado - precioBasicoContado;
  
  const endososPremium = premiumPlan.endosos || [];
  const endososBasico = basicPlan.endosos || [];
  const beneficiosPremium = premiumPlan.beneficios || [];
  const beneficiosBasico = basicPlan.beneficios || [];
  
  const beneficiosAdicionales = beneficiosPremium.filter(
    (b: any) => !beneficiosBasico.some((bb: any) => bb.nombre === b.nombre)
  );

  // Endosos exclusivos del Premium (no están en Básico)
  const endososExclusivos = endososPremium.filter(
    (ep: any) => !endososBasico.some((eb: any) => eb.codigo === ep.codigo)
  );

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style jsx global>{`
        .premium-modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .premium-modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .premium-modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(138, 170, 25, 0.3);
          border-radius: 10px;
        }
        .premium-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(138, 170, 25, 0.6);
        }
        .premium-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(138, 170, 25, 0.3) transparent;
        }
        @keyframes premiumFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .premium-float {
          animation: premiumFloat 3s ease-in-out infinite;
        }
        @keyframes shimmerPremium {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div
        className={`premium-modal-scroll bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#8AAA19] transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] p-5 text-white relative">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <FaTimes size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <FaStar className="text-yellow-300 text-2xl" />
            <h2 className="text-xl font-bold">¡Mejora a Endoso Porcelana!</h2>
          </div>
          <p className="text-white/80 text-xs">{insurerName} — Protección superior para tu vehículo</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          
          {/* Price Comparison Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Premium */}
            <div className="premium-float border-2 border-[#8AAA19] rounded-xl p-4 bg-gradient-to-br from-green-50 to-white relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#8AAA19]/10 rounded-bl-full"></div>
              <div className="text-center mb-3">
                <span className="inline-block px-2.5 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-[10px] font-bold rounded-full shadow-md uppercase tracking-wide">
                  ⭐ Premium — Porcelana
                </span>
              </div>
              <div className="text-center mb-3">
                {hasBreakdown ? (
                  <>
                    <p className="text-[10px] text-gray-500 mb-0.5">Con Tarjeta</p>
                    <p className="text-xl font-bold text-[#8AAA19]">
                      ${precioPremiumTarjeta.toFixed(2)}
                    </p>
                    <div className="text-[10px] text-gray-400 my-0.5">o al contado</div>
                    <p className="text-base font-semibold text-green-700">
                      ${precioPremiumContado.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-[#8AAA19]">
                    ${premiumPlan.premium.toFixed(2)}<span className="text-xs font-normal text-gray-500">/año</span>
                  </p>
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-bold text-[#8AAA19]">{endososPremium.length} endosos incluidos</p>
                <p className="text-[11px] text-gray-500">{beneficiosPremium.length} beneficios</p>
              </div>
            </div>

            {/* Básico */}
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50/50 opacity-75">
              <div className="text-center mb-3">
                <span className="inline-block px-2.5 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-full uppercase tracking-wide">
                  Básico — Full Extras
                </span>
              </div>
              <div className="text-center mb-3">
                {hasBreakdown ? (
                  <>
                    <p className="text-[10px] text-gray-500 mb-0.5">Con Tarjeta</p>
                    <p className="text-xl font-bold text-gray-600">
                      ${precioBasicoTarjeta.toFixed(2)}
                    </p>
                    <div className="text-[10px] text-gray-400 my-0.5">o al contado</div>
                    <p className="text-base font-semibold text-gray-500">
                      ${precioBasicoContado.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-600">
                    ${basicPlan.premium.toFixed(2)}<span className="text-xs font-normal text-gray-500">/año</span>
                  </p>
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-[11px] text-gray-500">{endososBasico.length} endosos incluidos</p>
                <p className="text-[11px] text-gray-400">{beneficiosBasico.length} beneficios</p>
              </div>
            </div>
          </div>

          {/* Diferencia de precio destacada */}
          <div className="bg-gradient-to-r from-[#8AAA19]/10 to-green-50 border border-[#8AAA19]/30 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-[#010139]">
              Diferencia: solo <span className="text-[#8AAA19] text-lg">${hasBreakdown ? diferenciaTarjeta.toFixed(2) : (premiumPlan.premium - basicPlan.premium).toFixed(2)}</span> más al año
            </p>
            {hasBreakdown && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                (${diferenciaContado.toFixed(2)} al contado)
              </p>
            )}
          </div>

          {/* Tabla comparativa de endosos */}
          <div>
            <h3 className="font-bold text-[#010139] text-sm mb-3 flex items-center gap-2">
              <FaShieldAlt className="text-[#8AAA19]" />
              Comparación de Endosos
            </h3>
            <div className="border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px] bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500 p-2.5">
                <span>Endoso</span>
                <span className="text-center text-[#8AAA19]">Premium</span>
                <span className="text-center text-gray-400">Básico</span>
              </div>
              {/* Rows */}
              {endososPremium.map((endoso: any, index: number) => {
                const isInBasico = endososBasico.some((eb: any) => eb.codigo === endoso.codigo);
                const isExclusive = !isInBasico;
                const isExpanded = expandedEndoso === index;
                const subBeneficios = endoso.subBeneficios || [];
                
                return (
                  <div key={index} className={`border-t ${isExclusive ? 'bg-green-50/50' : 'bg-white'}`}>
                    <button
                      onClick={() => setExpandedEndoso(isExpanded ? null : index)}
                      className="w-full grid grid-cols-[1fr_80px_80px] items-center p-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-xs font-semibold text-gray-800">{endoso.nombre}</span>
                        {isExclusive && (
                          <span className="text-[9px] bg-[#8AAA19] text-white px-1.5 py-0.5 rounded-full font-bold">EXCLUSIVO</span>
                        )}
                        {subBeneficios.length > 0 && (
                          isExpanded ? <FaChevronUp className="text-gray-400 text-[10px]" /> : <FaChevronDown className="text-gray-400 text-[10px]" />
                        )}
                      </div>
                      <div className="flex justify-center">
                        <FaCheckCircle className="text-[#8AAA19] text-sm" />
                      </div>
                      <div className="flex justify-center">
                        {isInBasico ? (
                          <FaCheckCircle className="text-gray-400 text-sm" />
                        ) : (
                          <FaTimesCircle className="text-red-300 text-sm" />
                        )}
                      </div>
                    </button>
                    
                    {/* Sub-beneficios expandibles */}
                    {isExpanded && subBeneficios.length > 0 && (
                      <div className="px-4 pb-3 bg-gray-50/80 border-t border-gray-100">
                        {endoso.descripcion && (
                          <p className="text-[11px] text-gray-600 italic mb-2 mt-1">{endoso.descripcion}</p>
                        )}
                        <div className="grid grid-cols-1 gap-1">
                          {subBeneficios.map((sub: string, sIdx: number) => (
                            <div key={sIdx} className="flex items-start gap-1.5 text-[11px] text-gray-700">
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
          </div>

          {/* Beneficios adicionales del Premium */}
          {beneficiosAdicionales.length > 0 && (
            <div>
              <h3 className="font-bold text-[#010139] text-sm mb-3 flex items-center gap-2">
                <FaArrowUp className="text-[#8AAA19]" />
                +{beneficiosAdicionales.length} Beneficios Adicionales en Premium
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {beneficiosAdicionales.map((beneficio: any, index: number) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                    <FaCheckCircle className="text-[#8AAA19] mt-0.5 flex-shrink-0 text-xs" />
                    <span className="text-[11px] text-gray-700 font-medium">
                      {typeof beneficio === 'string' ? beneficio : beneficio.nombre}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlight */}
          <div className="bg-blue-50 border-l-4 border-[#010139] p-3 rounded-lg">
            <p className="text-xs text-[#010139]">
              💡 <strong>El Endoso Porcelana</strong> cubre vidrios, faros, espejos, luces, molduras y pintura — componentes que se dañan frecuentemente y son costosos de reparar. <strong>Mismo deducible</strong> que el plan básico.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 bg-gray-50 border-t-2 border-gray-200 space-y-2.5">
          <button
            onClick={onUpgrade}
            className="w-full py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-bold hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <FaStar className="text-yellow-300" />
            Mejorar a Premium — Endoso Porcelana
          </button>
          <button
            onClick={onContinueBasic}
            className="w-full py-2 bg-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-300 transition-colors cursor-pointer text-xs"
          >
            Continuar con Plan Básico (Full Extras)
          </button>
        </div>
      </div>
    </div>
  );
}
