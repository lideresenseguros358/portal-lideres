/**
 * Breadcrumb Navegable para Wizard de Emisión
 * 6 pasos: Cuotas > Cliente > Vehículo > Inspección > Pago > Resumen
 * Mobile-friendly (se adapta en pantallas pequeñas)
 */

'use client';

import { useRouter } from 'next/navigation';
import { FaMoneyBillWave, FaUser, FaCar, FaCamera, FaCreditCard, FaClipboardCheck, FaChevronRight } from 'react-icons/fa';

export type EmissionStep = 'payment' | 'emission-data' | 'vehicle' | 'inspection' | 'payment-info' | 'review';

export interface BreadcrumbStepDef {
  key: EmissionStep;
  label: string;
  shortLabel: string;
  icon: any;
}

interface EmissionBreadcrumbProps {
  currentStep: EmissionStep;
  completedSteps?: EmissionStep[];
  onStepClick?: (step: EmissionStep) => void;
  steps?: BreadcrumbStepDef[];
  basePath?: string;
}

const DEFAULT_STEPS: BreadcrumbStepDef[] = [
  { key: 'payment', label: 'Cuotas', shortLabel: 'Cuotas', icon: FaMoneyBillWave },
  { key: 'emission-data', label: 'Cliente', shortLabel: 'Cliente', icon: FaUser },
  { key: 'vehicle', label: 'Vehículo', shortLabel: 'Vehículo', icon: FaCar },
  { key: 'inspection', label: 'Inspección', shortLabel: 'Inspección', icon: FaCamera },
  { key: 'payment-info', label: 'Pago', shortLabel: 'Pago', icon: FaCreditCard },
  { key: 'review', label: 'Resumen', shortLabel: 'Resumen', icon: FaClipboardCheck },
];

export default function EmissionBreadcrumb({ 
  currentStep, 
  completedSteps = [],
  onStepClick,
  steps,
  basePath = '/cotizadores/emitir',
}: EmissionBreadcrumbProps) {
  const router = useRouter();
  const activeSteps = steps || DEFAULT_STEPS;
  
  const currentIndex = activeSteps.findIndex(s => s.key === currentStep);
  
  const isStepCompleted = (step: EmissionStep) => completedSteps.includes(step);
  const isStepAccessible = (step: EmissionStep, index: number) => {
    // Paso actual siempre accesible
    if (step === currentStep) return true;
    // Pasos completados siempre accesibles
    if (isStepCompleted(step)) return true;
    // Pasos anteriores al actual siempre accesibles
    if (index < currentIndex) return true;
    return false;
  };
  
  const handleStepClick = (step: EmissionStep, index: number) => {
    if (!isStepAccessible(step, index)) return;
    if (onStepClick) {
      onStepClick(step);
    } else {
      // Default: navegar con query param
      router.push(`${basePath}?step=${step}`);
    }
  };
  
  return (
    <div className="w-full py-4 bg-white border-b-2 border-gray-100">
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        {/* Mobile: Lista Vertical Compacta */}
        <div className="sm:hidden">
          <div className="flex flex-col gap-2">
            {activeSteps.map((step, index) => {
              const isCurrent = step.key === currentStep;
              const isCompleted = isStepCompleted(step.key);
              const isAccessible = isStepAccessible(step.key, index);
              const Icon = step.icon;
              
              return (
                <button
                  key={step.key}
                  onClick={() => handleStepClick(step.key, index)}
                  disabled={!isAccessible}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-[#8AAA19] text-white shadow-md'
                      : isCompleted
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : isAccessible
                          ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          : 'bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrent
                      ? 'bg-white/20'
                      : isCompleted
                        ? 'bg-green-200'
                        : 'bg-gray-200'
                  }`}>
                    <Icon className={`text-sm ${isCurrent ? 'text-white' : ''}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-semibold ${isCurrent ? 'text-white' : ''}`}>
                      {step.label}
                    </div>
                    {isCurrent && (
                      <div className="text-xs opacity-80">Paso actual</div>
                    )}
                  </div>
                  {isCompleted && !isCurrent && (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Desktop: Lista Horizontal */}
        <div className="hidden sm:flex items-center justify-between gap-1">
          {activeSteps.map((step, index) => {
            const isCurrent = step.key === currentStep;
            const isCompleted = isStepCompleted(step.key);
            const isAccessible = isStepAccessible(step.key, index);
            const Icon = step.icon;
            const isLast = index === activeSteps.length - 1;
            
            return (
              <div key={step.key} className="flex items-center flex-1">
                <button
                  onClick={() => handleStepClick(step.key, index)}
                  disabled={!isAccessible}
                  className={`flex flex-col items-center gap-2 px-2 py-2 rounded-lg transition-all flex-1 ${
                    isCurrent
                      ? 'bg-[#8AAA19]/10 scale-105'
                      : isAccessible
                        ? 'hover:bg-gray-50'
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-br from-[#8AAA19] to-[#6d8814] shadow-lg scale-110'
                      : isCompleted
                        ? 'bg-green-500'
                        : isAccessible
                          ? 'bg-gray-300'
                          : 'bg-gray-200'
                  }`}>
                    {isCompleted && !isCurrent ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Icon className={`text-lg ${isCurrent || isCompleted ? 'text-white' : 'text-gray-600'}`} />
                    )}
                  </div>
                  <div className={`text-xs font-semibold text-center ${
                    isCurrent
                      ? 'text-[#8AAA19]'
                      : isCompleted
                        ? 'text-green-600'
                        : isAccessible
                          ? 'text-gray-600'
                          : 'text-gray-400'
                  }`}>
                    {step.shortLabel}
                  </div>
                </button>
                
                {/* Separator (excepto en el último) */}
                {!isLast && (
                  <div className="flex-shrink-0 px-1">
                    <FaChevronRight className={`text-xs ${
                      isCompleted ? 'text-green-400' : 'text-gray-300'
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
