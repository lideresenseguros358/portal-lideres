'use client';

import { useState } from 'react';
import { FaClock, FaBell, FaExclamationTriangle } from 'react-icons/fa';

interface DelinquencyTabProps {
  userId: string;
}

export default function DelinquencyTab({ userId }: DelinquencyTabProps) {
  return (
    <div className="space-y-6">
      {/* Policy */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaExclamationTriangle className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Política de Morosidad</h2>
            <p className="text-sm text-gray-600">Configuración de reemplazo y actualización</p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">
            <strong>Reemplazo Total:</strong> Cada importación reemplaza completamente los datos anteriores
          </p>
          <p className="text-sm text-blue-800">
            <strong>Sin Histórico:</strong> No se mantiene historial de importaciones previas
          </p>
        </div>
      </div>

      {/* Inactivity Clocks */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaClock className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Relojes de Inactividad</h2>
            <p className="text-sm text-gray-600">Automatización por falta de actualización</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-lg">
            <div className="flex items-start gap-3">
              <FaClock className="text-orange-600 text-xl mt-1" />
              <div>
                <p className="font-bold text-gray-800 mb-1">60 días sin actualización</p>
                <p className="text-sm text-gray-600">
                  Se establece automáticamente en cero ($0.00) para todas las categorías
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
            <div className="flex items-start gap-3">
              <FaBell className="text-red-600 text-xl mt-1" />
              <div>
                <p className="font-bold text-gray-800 mb-1">90 días en cero</p>
                <p className="text-sm text-gray-600 mb-2">
                  Alerta al broker. Si no atiende, alerta al Master
                </p>
                <span className="inline-block px-3 py-1 bg-red-600 text-white rounded-full text-xs font-semibold">
                  +90 días
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> Los relojes se desactivan automáticamente si la aseguradora tiene el toggle "Sin reportes de morosidad" activado
            </p>
          </div>
        </div>
      </div>

      {/* Visual Labels */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaExclamationTriangle className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Etiquetas Visuales</h2>
            <p className="text-sm text-gray-600">Chips y badges para categorías</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-semibold">
              Por Vencer
            </span>
            <span className="text-gray-600">Próximos a vencer</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
              Al Día
            </span>
            <span className="text-gray-600">Sin retraso</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-semibold">
              1-30 días
            </span>
            <span className="text-gray-600">Primer bucket</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold">
              +90 días
            </span>
            <span className="text-gray-600">Crítico (mismo estilo que Pendientes)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
