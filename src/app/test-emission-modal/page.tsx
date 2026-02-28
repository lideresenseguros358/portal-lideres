'use client';

import { useState, useRef, useCallback } from 'react';
import EmissionLoadingModal from '@/components/cotizadores/EmissionLoadingModal';

export default function TestEmissionModalPage() {
  const [showModal, setShowModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const STEPS = [
    { progress: 5, message: 'Preparando datos del cliente...' },
    { progress: 15, message: 'Validando información del vehículo...' },
    { progress: 25, message: 'Conectando con la aseguradora...' },
    { progress: 40, message: 'Enviando solicitud de emisión...' },
    { progress: 55, message: 'Esperando respuesta de la aseguradora...' },
    { progress: 65, message: 'Procesando número de póliza...' },
    { progress: 75, message: 'Guardando cliente y póliza en sistema...' },
    { progress: 85, message: 'Enviando expediente por correo...' },
    { progress: 92, message: 'Guardando documentos en expediente...' },
    { progress: 100, message: '¡Emisión completada!' },
  ];

  const startSimulation = useCallback((withError: boolean = false) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setShowModal(true);
    setProgress(0);
    setCurrentStep('Iniciando proceso de emisión...');
    setError(null);

    let stepIndex = 0;

    intervalRef.current = setInterval(() => {
      if (withError && stepIndex === 5) {
        setError('Error de conexión con la aseguradora. Por favor intente de nuevo.');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      if (stepIndex < STEPS.length) {
        const step = STEPS[stepIndex];
        setProgress(step!.progress);
        setCurrentStep(step!.message);
        stepIndex++;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1500);
  }, []);

  const handleClose = () => {
    setShowModal(false);
    setProgress(0);
    setCurrentStep('');
    setError(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleComplete = () => {
    console.log('Emission complete!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#010139] mb-2">
            Test: Modal de Emisión
          </h1>
          <p className="text-gray-500 text-sm">
            Prueba el modal de loading para emisión de pólizas
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => startSimulation(false)}
            className="w-full py-3 px-6 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-base"
          >
            Simular Emisión Exitosa
          </button>

          <button
            onClick={() => startSimulation(true)}
            className="w-full py-3 px-6 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-base"
          >
            Simular Emisión con Error
          </button>

          <button
            onClick={() => {
              setShowModal(true);
              setProgress(0);
              setCurrentStep('Preparando datos del cliente...');
              setError(null);
            }}
            className="w-full py-3 px-6 bg-gradient-to-r from-[#010139] to-[#020270] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-base"
          >
            Abrir Modal Estático (sin progreso)
          </button>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Control manual:</h3>
          <div className="flex gap-2 flex-wrap">
            {[0, 10, 25, 50, 75, 90, 100].map((val) => (
              <button
                key={val}
                onClick={() => {
                  setShowModal(true);
                  setError(null);
                  setProgress(val);
                  setCurrentStep(val === 100 ? '¡Emisión completada!' : `Progreso manual: ${val}%`);
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-mono transition-colors"
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <EmissionLoadingModal
        isOpen={showModal}
        progress={progress}
        currentStep={currentStep}
        error={error}
        onClose={handleClose}
        onComplete={handleComplete}
      />
    </div>
  );
}
