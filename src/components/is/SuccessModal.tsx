'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaDownload, FaEnvelope, FaTimes } from 'react-icons/fa';
import Confetti from 'react-confetti';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  nroPoliza: string;
  pdfUrl?: string;
  clienteNombre: string;
  vehiculo: string;
  primaTotal: number;
}

export default function SuccessModal({
  isOpen,
  onClose,
  nroPoliza,
  pdfUrl,
  clienteNombre,
  vehiculo,
  primaTotal,
}: SuccessModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });

      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleDownloadPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      // MOCK: Simular descarga
      console.log('[MOCK] Descargando PDF de póliza:', nroPoliza);
      alert('Función de descarga disponible en producción');
    }
  };

  const handleSendEmail = () => {
    // MOCK: Simular envío de email
    console.log('[MOCK] Enviando póliza por email');
    alert('Póliza enviada a su correo electrónico');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Confetti */}
          {showConfetti && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              recycle={false}
              numberOfPieces={500}
              gravity={0.3}
            />
          )}

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-4 sm:my-8"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
            >
              <FaTimes className="w-5 h-5 text-gray-500" />
            </button>

            {/* Content */}
            <div className="p-8 text-center">
              {/* Success icon animado */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 10,
                  delay: 0.2,
                }}
                className="inline-block mb-6"
              >
                <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <FaCheckCircle className="w-16 h-16 text-green-500" />
                </div>
              </motion.div>

              {/* Título */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-[#010139] mb-2"
              >
                ¡Felicidades!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-gray-600 mb-8"
              >
                Póliza Emitida Exitosamente
              </motion.p>

              {/* Número de póliza destacado */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-r from-[#010139] to-blue-800 text-white p-6 rounded-xl mb-8"
              >
                <p className="text-sm font-medium mb-2 opacity-90">Número de Póliza</p>
                <p className="text-3xl font-bold font-mono">{nroPoliza}</p>
              </motion.div>

              {/* Resumen */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gray-50 p-6 rounded-lg mb-8 text-left"
              >
                <h3 className="font-semibold text-gray-700 mb-4">Resumen de la Póliza</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium text-gray-900">{clienteNombre}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehículo:</span>
                    <span className="font-medium text-gray-900">{vehiculo}</span>
                  </div>
                  
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-gray-600">Prima Total:</span>
                    <span className="font-bold text-[#8AAA19] text-lg font-mono">
                      ${primaTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Botones de acción */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#010139]/90 transition-colors shadow-md"
                >
                  <FaDownload />
                  <span>Descargar Póliza</span>
                </button>

                <button
                  onClick={handleSendEmail}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-white border-2 border-[#010139] text-[#010139] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FaEnvelope />
                  <span>Enviar por Email</span>
                </button>
              </motion.div>

              {/* Mensaje final */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6 text-sm text-gray-500"
              >
                Recibirá una copia de su póliza en su correo electrónico
              </motion.p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
