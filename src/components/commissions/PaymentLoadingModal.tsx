'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

interface PaymentLoadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  fortnightId: string;
  payFortnightAction: (fortnightId: string) => Promise<{ ok: boolean; error?: string }>;
}

const STEPS = [
  { id: 'validate', name: 'Validando quincena', time: 1000 },
  { id: 'recalculate', name: 'Recalculando totales', time: 2000 },
  { id: 'totals', name: 'Obteniendo totales por corredor', time: 2000 },
  { id: 'retentions', name: 'Procesando retenciones', time: 3000 },
  { id: 'draftItems', name: 'Migrando items temporales', time: 4000 },
  { id: 'finalizing', name: 'Finalizando proceso', time: 2000 },
];

export default function PaymentLoadingModal({ 
  isOpen, 
  onClose, 
  fortnightId,
  payFortnightAction
}: PaymentLoadingModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(true);

  // Iniciar proceso cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;
    
    const processPayment = async () => {
      setCurrentStep(0);
      setError(null);
      setSuccess(false);
      setProcessing(true);
      
      try {
        // Proceso de cierre real
        const result = await payFortnightAction(fortnightId);
        
        // Si el proceso real falla, mostrar error
        if (!result.ok) {
          setError(result.error || 'Error desconocido');
          setProcessing(false);
          return;
        }
        
        // Simulación de progreso visual si el proceso fue rápido
        for (const [index, step] of STEPS.entries()) {
          setCurrentStep(index);
          // Esperar el tiempo definido para cada paso
          await new Promise(resolve => setTimeout(resolve, step.time));
        }
        
        // Finalizar con éxito
        setSuccess(true);
        setProcessing(false);
        
        // Redireccionar al historial después de 1.5 segundos
        setTimeout(() => {
          router.push('/commissions/history');
        }, 1500);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setProcessing(false);
      }
    };

    processPayment();
  }, [isOpen, fortnightId, payFortnightAction, router]);

  if (!isOpen) return null;

  const progressPercentage = success 
    ? 100 
    : Math.min(
        Math.round((currentStep / (STEPS.length - 1)) * 100),
        95 // Máximo 95% hasta confirmar éxito
      );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            Procesando Cierre de Quincena
          </h2>
          {!processing && (
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FaTimes size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-6">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${
                success ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {/* Progress steps */}
          <div className="space-y-3">
            {STEPS.map((step, index) => (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  currentStep === index && processing 
                    ? 'bg-blue-50 border border-blue-100' 
                    : currentStep > index || success
                    ? 'text-gray-500'
                    : 'text-gray-400'
                }`}
              >
                {currentStep === index && processing ? (
                  <FaSpinner className="animate-spin text-blue-500" size={18} />
                ) : currentStep > index || success ? (
                  <FaCheckCircle className="text-green-500" size={18} />
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />
                )}
                <span className={`${currentStep === index && processing ? 'font-medium text-blue-800' : ''}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>

          {/* Status message */}
          {error ? (
            <div className="mt-6 bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <FaExclamationTriangle className="text-red-500 mt-1 flex-shrink-0" size={18} />
                <div>
                  <p className="font-medium text-red-800 mb-1">Error al procesar</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : success ? (
            <div className="mt-6 bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <FaCheckCircle className="text-green-500 mt-1 flex-shrink-0" size={18} />
                <div>
                  <p className="font-medium text-green-800 mb-1">Proceso Completado</p>
                  <p className="text-sm text-green-700">
                    La quincena ha sido cerrada exitosamente. Redirigiendo al historial...
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            {processing ? 'Por favor no cierre esta ventana hasta que el proceso termine...' : 
              error ? 'Puede cerrar esta ventana e intentar nuevamente.' : 
              'Redirigiendo al historial de quincenas...'}
          </p>
        </div>
      </div>
    </div>
  );
}
