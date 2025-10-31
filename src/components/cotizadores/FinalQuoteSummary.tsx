/**
 * Resumen Final de Cotización antes de Emitir
 * Muestra todos los datos ingresados, tarifa seleccionada, fechas
 */

'use client';

import { useState } from 'react';
import { 
  FaShieldAlt, 
  FaUser, 
  FaCar, 
  FaCalendarAlt, 
  FaMoneyBillWave,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface FinalQuoteSummaryProps {
  quoteData: any;
  selectedPlan: any;
  installments: number;
  monthlyPayment: number;
  emissionData?: any;
  inspectionPhotos?: any[];
  onConfirm: () => void;
}

export default function FinalQuoteSummary({
  quoteData,
  selectedPlan,
  installments,
  monthlyPayment,
  emissionData,
  inspectionPhotos,
  onConfirm
}: FinalQuoteSummaryProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  // Calcular fechas
  const today = new Date();
  const renewalDate = new Date(today);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const reminderDate = new Date(renewalDate);
  reminderDate.setDate(reminderDate.getDate() - 30);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      toast.success('¡Póliza emitida exitosamente!');
    } catch (error) {
      toast.error('Error al emitir póliza');
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] rounded-full mb-4">
          <FaCheckCircle className="text-3xl text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#010139] mb-2">
          Confirma tu Póliza
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Revisa todos los detalles antes de emitir
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Data Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaUser className="text-[#8AAA19]" />
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Cédula:</span>
                <div className="font-semibold">{quoteData.cedula || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-600">Nombre:</span>
                <div className="font-semibold">{quoteData.nombreConductor || quoteData.nombre}</div>
              </div>
              {quoteData.email && (
                <div>
                  <span className="text-gray-600">Email:</span>
                  <div className="font-semibold">{quoteData.email}</div>
                </div>
              )}
              {quoteData.telefono && (
                <div>
                  <span className="text-gray-600">Teléfono:</span>
                  <div className="font-semibold">{quoteData.telefono}</div>
                </div>
              )}
            </div>
          </div>

          {/* Vehículo / Propiedad */}
          {quoteData.marca && (
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
                <FaCar className="text-[#8AAA19]" />
                Datos del Vehículo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Marca:</span>
                  <div className="font-semibold">{quoteData.marca}</div>
                </div>
                <div>
                  <span className="text-gray-600">Modelo:</span>
                  <div className="font-semibold">{quoteData.modelo}</div>
                </div>
                <div>
                  <span className="text-gray-600">Año:</span>
                  <div className="font-semibold">{quoteData.anno}</div>
                </div>
                <div>
                  <span className="text-gray-600">Placa:</span>
                  <div className="font-semibold">{quoteData.placa}</div>
                </div>
                <div>
                  <span className="text-gray-600">Valor:</span>
                  <div className="font-semibold">${quoteData.valorVehiculo?.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Coberturas Seleccionadas */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaShieldAlt className="text-[#8AAA19]" />
              Coberturas Incluidas
            </h3>
            <div className="space-y-2">
              {selectedPlan?.coverages?.map((coverage: any, idx: number) => (
                coverage.included && (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <FaCheckCircle className="text-[#8AAA19] flex-shrink-0" />
                    <span>{coverage.name}</span>
                  </div>
                )
              ))}
            </div>
            
            {quoteData.deducible && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-gray-600 text-sm">Deducible:</span>
                <div className="font-semibold">${quoteData.deducible?.toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Fechas */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaCalendarAlt className="text-blue-600" />
              Vigencia de la Póliza
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-gray-700 text-sm font-semibold">Fecha de Emisión:</span>
                <div className="text-lg font-bold text-[#010139]">{formatDate(today)}</div>
              </div>
              <div className="relative">
                <span className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                  Fecha de Renovación:
                  <div className="group relative inline-block">
                    <FaInfoCircle className="text-blue-500 cursor-help" />
                    <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 z-10">
                      Le recordaremos 30 días antes sobre su renovación
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </span>
                <div className="text-lg font-bold text-[#010139]">{formatDate(renewalDate)}</div>
                <div className="text-xs text-gray-600 mt-1">
                  🔔 Recordatorio: {formatDate(reminderDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Payment Summary */}
        <div className="space-y-6">
          {/* Plan Seleccionado */}
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-xl shadow-2xl p-6 text-white sticky top-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaShieldAlt />
              Plan Seleccionado
            </h3>
            
            {/* Aseguradora */}
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <div className="text-sm opacity-80 mb-1">Aseguradora</div>
              <div className="text-lg font-bold">{selectedPlan?.insurerName}</div>
              <div className="text-xs opacity-70 mt-1">
                Plan {selectedPlan?.planType === 'premium' ? 'Premium' : 'Básico'}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-80">Prima Anual</span>
                <span className="text-xl font-bold">
                  ${selectedPlan?.annualPremium?.toLocaleString()}
                </span>
              </div>
              
              {installments > 1 && (
                <>
                  <div className="border-t border-white/20 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm opacity-80">Forma de Pago</span>
                      <span className="font-semibold">{installments} Cuotas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-80">Pago Mensual</span>
                      <span className="text-2xl font-bold text-[#8AAA19]">
                        ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Total a Pagar */}
            <div className="bg-[#8AAA19] rounded-lg p-4 mb-6">
              <div className="text-sm opacity-90 mb-1">Total a Pagar</div>
              <div className="text-3xl font-bold">
                ${((installments > 1 ? monthlyPayment * installments : selectedPlan?.annualPremium) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              {installments > 1 && (
                <div className="text-xs opacity-90 mt-1">
                  {installments} pagos de ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full py-4 bg-white text-[#010139] rounded-xl font-bold text-lg hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#010139]"></div>
                  Emitiendo...
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Confirmar y Emitir
                </>
              )}
            </button>

            <p className="text-xs text-center mt-4 opacity-70">
              Al confirmar aceptas nuestros términos y condiciones
            </p>
          </div>

          {/* Security Badge */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <div className="text-sm font-semibold text-gray-700">100% Seguro</div>
            <div className="text-xs text-gray-500 mt-1">
              Transacción encriptada y protegida
            </div>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6 text-center">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-[#010139] font-semibold text-sm"
        >
          ← Volver a modificar
        </button>
      </div>
    </div>
  );
}
