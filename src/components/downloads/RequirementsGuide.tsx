'use client';

import { useState } from 'react';
import { FaClipboardList, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { getRequirements } from '@/lib/downloads/constants';

interface RequirementsGuideProps {
  policyType: string;
}

export default function RequirementsGuide({ policyType }: RequirementsGuideProps) {
  const [showModal, setShowModal] = useState(false);
  const requirements = getRequirements(policyType);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <>
      {/* Botón para abrir modal */}
      <button
        onClick={() => setShowModal(true)}
        className="
          inline-flex items-center gap-2 px-6 py-3 mb-6
          bg-gradient-to-r from-blue-500 to-blue-600
          text-white font-semibold rounded-lg
          hover:from-blue-600 hover:to-blue-700
          transition-all duration-200 shadow-lg hover:shadow-xl
        "
      >
        <FaClipboardList className="text-lg" />
        Ver Requisitos
      </button>

      {/* Modal con requisitos */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#010139] to-blue-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaClipboardList className="text-3xl text-white" />
                  <h2 className="text-2xl font-bold text-white">
                    Requisitos Necesarios
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FaTimes size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
                <p className="text-sm text-gray-700">
                  💡 Los siguientes documentos son necesarios para el trámite. Esta es una guía visual, no son archivos descargables.
                </p>
              </div>

              <ul className="space-y-3">
                {requirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <FaCheckCircle className="text-[#8AAA19] mt-1 flex-shrink-0" />
                    <span className={`${req.startsWith('  •') ? 'ml-4 text-sm text-gray-600' : 'text-gray-800 font-medium'}`}>
                      {req.replace('  • ', '')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
