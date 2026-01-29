/**
 * Modal de Upgrade a Plan Premium
 * Muestra diferencias de cobertura y costo adicional
 * Se muestra al seleccionar plan básico o al hacer click en "Mejorar Plan"
 */

'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaStar, FaArrowUp } from 'react-icons/fa';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  // Calcular diferencias de precio según método de pago
  const hasBreakdown = premiumPlan._priceBreakdown && basicPlan._priceBreakdown;
  
  const precioBasicoTarjeta = hasBreakdown ? basicPlan._priceBreakdown.totalConTarjeta : basicPlan.premium;
  const precioBasicoContado = hasBreakdown ? basicPlan._priceBreakdown.totalAlContado : basicPlan.premium;
  
  const precioPremiumTarjeta = hasBreakdown ? premiumPlan._priceBreakdown.totalConTarjeta : premiumPlan.premium;
  const precioPremiumContado = hasBreakdown ? premiumPlan._priceBreakdown.totalAlContado : premiumPlan.premium;
  
  const diferenciaTarjeta = precioPremiumTarjeta - precioBasicoTarjeta;
  const diferenciaContado = precioPremiumContado - precioBasicoContado;
  
  const newCoverages = premiumPlan.coverages.filter(
    (c) => !basicPlan.coverages.includes(c)
  );
  
  // Extraer beneficios y endosos adicionales del plan premium
  const beneficiosBasico = basicPlan.beneficios || [];
  const beneficiosPremium = premiumPlan.beneficios || [];
  const endososPremium = premiumPlan.endosos || [];
  
  const beneficiosAdicionales = beneficiosPremium.filter(
    (b) => !beneficiosBasico.some((bb) => bb.nombre === b.nombre)
  );

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#8AAA19] transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] p-6 text-white relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <FaTimes size={20} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <FaStar className="text-yellow-300 text-3xl" />
            <h2 className="text-2xl font-bold">¡Mejora tu Cobertura!</h2>
          </div>
          <p className="text-white/90 text-sm">{insurerName}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Plan */}
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="text-center mb-3">
                <span className="inline-block px-3 py-1 bg-gray-300 text-gray-700 text-xs font-bold rounded-full">
                  PLAN BÁSICO
                </span>
              </div>
              <div className="text-center mb-4">
                {hasBreakdown ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1">Con Tarjeta (2-10 cuotas)</p>
                    <p className="text-2xl font-bold text-gray-700">
                      ${precioBasicoTarjeta.toFixed(2)}
                    </p>
                    <div className="text-xs text-gray-400 my-1">o</div>
                    <p className="text-xs text-gray-500 mb-1">Al Contado (1 cuota)</p>
                    <p className="text-xl font-semibold text-gray-600">
                      ${precioBasicoContado.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-700">
                      ${basicPlan.premium.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">por año</p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-600">
                  Deducible: ${basicPlan.deductible.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {basicPlan.coverages.length} coberturas
                </p>
                <p className="text-xs text-gray-500">
                  {beneficiosBasico.length} beneficio(s)
                </p>
              </div>
            </div>

            {/* Premium Plan */}
            <div className="border-2 border-[#8AAA19] rounded-xl p-4 bg-gradient-to-br from-green-50 to-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#8AAA19]/10 rounded-bl-full"></div>
              <div className="text-center mb-3">
                <span className="inline-block px-3 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-bold rounded-full shadow-md">
                  PLAN PREMIUM ⭐
                </span>
              </div>
              <div className="text-center mb-4">
                {hasBreakdown ? (
                  <>
                    <p className="text-xs text-gray-500 mb-1">Con Tarjeta (2-10 cuotas)</p>
                    <p className="text-2xl font-bold text-[#8AAA19]">
                      ${precioPremiumTarjeta.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#8AAA19] font-semibold mt-1">
                      +${diferenciaTarjeta.toFixed(2)} adicionales
                    </p>
                    <div className="text-xs text-gray-400 my-1">o</div>
                    <p className="text-xs text-gray-500 mb-1">Al Contado (1 cuota)</p>
                    <p className="text-xl font-semibold text-green-700">
                      ${precioPremiumContado.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600 font-semibold mt-1">
                      +${diferenciaContado.toFixed(2)} adicionales
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-[#8AAA19]">
                      ${premiumPlan.premium.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">por año</p>
                    <p className="text-xs text-[#8AAA19] font-semibold mt-1">
                      +${(premiumPlan.premium - basicPlan.premium).toFixed(2)} adicionales
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#8AAA19]">
                  Mismo Deducible: ${premiumPlan.deductible.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {premiumPlan.coverages.length} coberturas
                </p>
                <p className="text-xs font-semibold text-[#8AAA19]">
                  {beneficiosPremium.length} beneficio(s) • {endososPremium.length} endoso(s)
                </p>
              </div>
            </div>
          </div>

          {/* Endosos Premium */}
          {endososPremium.length > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
              <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                <FaStar className="text-yellow-600" />
                Endosos Incluidos en Plan Premium:
              </h3>
              <ul className="space-y-2">
                {endososPremium.map((endoso, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm bg-white p-2 rounded-lg border border-yellow-200">
                    <FaCheckCircle className="text-yellow-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">{typeof endoso === 'string' ? endoso : endoso.nombre}</p>
                      {typeof endoso === 'object' && endoso.descripcion && (
                        <p className="text-xs text-gray-600">{endoso.descripcion}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Beneficios Adicionales */}
          {beneficiosAdicionales.length > 0 && (
            <div className="bg-green-50 border-2 border-[#8AAA19] rounded-xl p-4">
              <h3 className="font-bold text-[#8AAA19] mb-3 flex items-center gap-2">
                <FaArrowUp />
                Beneficios Adicionales del Plan Premium:
              </h3>
              <ul className="space-y-2">
                {beneficiosAdicionales.map((beneficio, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <FaCheckCircle className="text-[#8AAA19] mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-gray-700 font-medium">{typeof beneficio === 'string' ? beneficio : beneficio.nombre}</p>
                      {typeof beneficio === 'object' && beneficio.descripcion && (
                        <p className="text-xs text-gray-500">{beneficio.descripcion}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits Highlight */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              💡 <strong>Ventaja del Plan Premium:</strong> Incluye endosos especiales y beneficios adicionales que te brindan mayor protección y tranquilidad, <strong>con el mismo deducible que seleccionaste (${premiumPlan.deductible.toLocaleString()})</strong>.
            </p>
            {hasBreakdown && (
              <p className="text-xs text-gray-600 mt-2">
                <strong>Diferencia de inversión:</strong> Solo ${diferenciaTarjeta.toFixed(2)} adicionales con tarjeta, o ${diferenciaContado.toFixed(2)} adicionales al contado para obtener cobertura superior.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-gray-50 border-t-2 border-gray-200 space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-bold hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <FaStar className="text-white" />
            Mejorar a Plan Premium
          </button>
          <button
            onClick={onContinueBasic}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors cursor-pointer"
          >
            Continuar con Plan Básico
          </button>
        </div>
      </div>
    </div>
  );
}
