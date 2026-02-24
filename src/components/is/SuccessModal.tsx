'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaDownload, FaTimes } from 'react-icons/fa';
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
      alert('El PDF de la póliza aún no está disponible.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
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

          {/* Modal Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="standard-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-bold">
                    <FaCheckCircle className="inline mr-2" />
                    ¡Felicidades!
                  </h2>
                  <p className="text-white/90 text-sm mt-1">Póliza Emitida Exitosamente</p>
                </div>
                <button onClick={onClose} className="text-white hover:text-gray-200 transition" type="button">
                  <FaTimes size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="standard-modal-content">
                <div className="text-center">
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

              {/* Botón de acción */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex justify-center"
              >
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl hover:shadow-2xl transition-all transform hover:scale-105 font-bold text-lg shadow-md"
                >
                  <FaDownload className="text-white" />
                  <span>Descargar Póliza</span>
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
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
