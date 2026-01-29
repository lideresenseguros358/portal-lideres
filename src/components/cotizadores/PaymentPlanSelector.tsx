/**
 * Selector Interactivo de Plan de Pagos
 * Máximo 10 cuotas con visualización dinámica del pago mensual
 */

'use client';

import { useState } from 'react';
import { FaMoneyBillWave, FaCalendarAlt, FaArrowRight } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

interface PaymentPlanSelectorProps {
  annualPremium: number;
  priceBreakdown?: {
    totalAlContado: number;
    totalConTarjeta: number;
  };
  onContinue: (installments: number, monthlyPayment: number) => void;
}

export default function PaymentPlanSelector({ annualPremium, priceBreakdown, onContinue }: PaymentPlanSelectorProps) {
  const router = useRouter();
  const [installments, setInstallments] = useState(1);
  
  // Calcular pago mensual usando breakdown si existe
  const calculateMonthlyPayment = (numInstallments: number) => {
    // Si tiene breakdown de contado/tarjeta, usarlo
    if (priceBreakdown) {
      if (numInstallments === 1) {
        // 1 cuota = al contado (con descuento)
        return priceBreakdown.totalAlContado;
      } else {
        // 2-10 cuotas = con tarjeta (sin descuento)
        return priceBreakdown.totalConTarjeta / numInstallments;
      }
    }
    
    // Fallback: cálculo tradicional si no hay breakdown
    if (numInstallments === 1) return annualPremium;
    
    // Recargo del 2% por financiamiento
    const interestRate = 0.02;
    const totalWithInterest = annualPremium * (1 + (interestRate * (numInstallments - 1) / 10));
    return totalWithInterest / numInstallments;
  };

  const monthlyPayment = calculateMonthlyPayment(installments);
  
  // Total a pagar según cuotas
  const totalToPay = installments === 1 
    ? monthlyPayment 
    : (priceBreakdown ? priceBreakdown.totalConTarjeta : monthlyPayment * installments);

  const handleContinue = () => {
    onContinue(installments, monthlyPayment);
  };

  // Función para obtener el emoji dinámico según las cuotas
  const getEmoji = (numInstallments: number): string => {
    // 10 = 🙈 (mono con ojos tapados - muchas cuotas)
    // 9-2 = progresivamente más feliz
    // 1 = 🤩 (estrellas en los ojos - pago contado)
    const emojiMap: Record<number, string> = {
      10: '🙈', // Ojos tapados - menos entusiasmo
      9: '😔',  // Pensativo
      8: '😐',  // Neutral
      7: '🙂',  // Leve sonrisa
      6: '😊',  // Sonrisa
      5: '😄',  // Contento
      4: '😁',  // Muy contento
      3: '😍',  // Enamorado
      2: '🥳',  // Festejando
      1: '🤩',  // Estrellas en los ojos - ¡Al contado!
    };
    return emojiMap[numInstallments] || '😊';
  };

  // Descripción según las cuotas
  const getDescription = (numInstallments: number): string => {
    if (numInstallments === 1) return priceBreakdown 
      ? '¡Excelente! Con descuento pronto pago' 
      : '¡Excelente decisión! Pago al contado';
    if (numInstallments === 2) return 'Muy bueno - Cada 6 meses';
    if (numInstallments <= 4) return 'Buena opción - Cuotas trimestrales';
    if (numInstallments <= 6) return 'Opción popular - Más cómodo';
    if (numInstallments <= 8) return 'Más cuotas - Más tiempo';
    return 'Máximo permitido - 10 cuotas';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
          Elige tu Plan de Pago
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          Divide tu prima en cuotas cómodas
        </p>
      </div>

      {/* Prima Total Box */}
      <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-2xl p-6 mb-8 text-white shadow-2xl">
        <div className="text-center">
          <FaMoneyBillWave className="text-4xl mx-auto mb-3 text-[#8AAA19]" />
          <div className="text-sm opacity-80 mb-1">Prima Anual Total</div>
          <div className="text-4xl sm:text-5xl font-bold mb-2">
            ${annualPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs opacity-70">Incluye coberturas seleccionadas</div>
        </div>
      </div>

      {/* Slider Interactive */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 sm:p-8 mb-6">
        <div className="mb-6">
          <label className="block text-lg font-bold text-[#010139] mb-4 text-center">
            🎯 Selecciona el número de cuotas
          </label>
          
          {/* Visual Slider */}
          <div className="relative py-4">
            <input
              type="range"
              min="1"
              max="10"
              value={installments}
              onChange={(e) => setInstallments(parseInt(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-payment"
              style={{
                background: `linear-gradient(to right, #8AAA19 0%, #8AAA19 ${((installments - 1) / 9) * 100}%, #e5e7eb ${((installments - 1) / 9) * 100}%, #e5e7eb 100%)`
              }}
            />
            
            {/* Slider Labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
            </div>
          </div>

          {/* Selected Option Display - Emoji Central Dinámico */}
          <div className="text-center mt-8">
            <div className="relative inline-block">
              {/* Emoji Grande Central */}
              <div className="text-8xl mb-4 animate-bounce">
                {getEmoji(installments)}
              </div>
              
              {/* Información de cuotas */}
              <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white px-8 py-4 rounded-2xl shadow-2xl">
                <div className="font-black text-3xl mb-1">
                  {installments} {installments === 1 ? 'Pago' : 'Cuotas'}
                </div>
                <div className="text-sm opacity-90">
                  {getDescription(installments)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Selection Buttons - Solo números */}
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              onClick={() => setInstallments(num)}
              className={`p-3 rounded-lg border-2 transition-all ${
                installments === num
                  ? 'border-[#8AAA19] bg-[#8AAA19] text-white scale-110 shadow-lg'
                  : 'border-gray-200 hover:border-[#8AAA19] hover:bg-gray-50'
              }`}
              title={`${num} ${num === 1 ? 'Pago' : 'Cuotas'}`}
            >
              <div className="text-xl font-black">{num}</div>
            </button>
          ))}
        </div>

        {/* Monthly Payment Display */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
          <div className="text-center">
            <FaCalendarAlt className="text-3xl text-blue-600 mx-auto mb-3" />
            <div className="text-sm text-gray-600 mb-2">
              {installments === 1 ? 'Pagarás en un solo pago' : `Pagarás ${installments} cuotas de:`}
            </div>
            <div className="text-4xl sm:text-5xl font-bold text-[#010139] mb-2 animate-pulse">
              ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            {installments > 1 && (
              <div className="text-xs text-gray-500">
                Total: ${totalToPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
            {installments === 1 && priceBreakdown && priceBreakdown.totalAlContado < priceBreakdown.totalConTarjeta && (
              <div className="text-xs text-green-600 font-semibold mt-1">
                ✓ Ahorro: ${(priceBreakdown.totalConTarjeta - priceBreakdown.totalAlContado).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border-2 border-gray-200 text-center">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-sm font-semibold text-gray-700">Sin trámites</div>
          <div className="text-xs text-gray-500">Aprobación inmediata</div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-gray-200 text-center">
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-sm font-semibold text-gray-700">100% Seguro</div>
          <div className="text-xs text-gray-500">Pago encriptado</div>
        </div>
        <div className="bg-white rounded-lg p-4 border-2 border-gray-200 text-center">
          <div className="text-2xl mb-2">📱</div>
          <div className="text-sm font-semibold text-gray-700">Fácil y rápido</div>
          <div className="text-xs text-gray-500">En minutos</div>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        className="w-full px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
      >
        Continuar a Emisión
        <FaArrowRight />
      </button>

      <style jsx>{`
        .slider-payment::-webkit-slider-thumb {
          appearance: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #8AAA19;
          cursor: pointer;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .slider-payment::-moz-range-thumb {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #8AAA19;
          cursor: pointer;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
