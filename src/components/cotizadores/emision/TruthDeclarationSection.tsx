/**
 * Sección: Declaración de Veracidad
 * Checkbox obligatorio + texto legal colapsable (NO modal)
 */

'use client';

import { useState } from 'react';
import { FaCheckCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { toast } from 'sonner';

interface TruthDeclarationSectionProps {
  onComplete: () => void;
}

export default function TruthDeclarationSection({
  onComplete,
}: TruthDeclarationSectionProps) {
  const [isAccepted, setIsAccepted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    if (!isAccepted) {
      toast.error('Debes aceptar la declaración de veracidad para continuar');
      return;
    }

    onComplete();
    toast.success('Declaración aceptada correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <FaCheckCircle className="text-[#010139] text-2xl" />
        <div>
          <h4 className="text-xl font-bold text-[#010139]">Declaración de Veracidad</h4>
          <p className="text-sm text-gray-600">Acepta los términos y condiciones</p>
        </div>
      </div>

      {/* Checkbox principal - GRANDE y fácil de tocar */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
        <label className="flex items-start gap-4 cursor-pointer group">
          <input
            type="checkbox"
            checked={isAccepted}
            onChange={(e) => setIsAccepted(e.target.checked)}
            className="w-7 h-7 mt-1 text-[#8AAA19] focus:ring-[#8AAA19] rounded flex-shrink-0 cursor-pointer"
          />
          <div className="flex-1">
            <p className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed">
              Declaro que la información suministrada es veraz y correcta
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Al marcar esta casilla, confirmo que he proporcionado información verdadera y completa.
            </p>
          </div>
        </label>
      </div>

      {/* Botón para expandir/colapsar texto legal */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 
          bg-white border-2 border-gray-300 rounded-xl hover:border-gray-400 
          transition-colors text-left"
        type="button"
      >
        <span className="font-semibold text-gray-700">
          {isExpanded ? 'Ocultar' : 'Leer'} declaración completa
        </span>
        {isExpanded ? (
          <FaChevronUp className="text-gray-500" />
        ) : (
          <FaChevronDown className="text-gray-500" />
        )}
      </button>

      {/* Texto legal colapsable */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <h5 className="text-lg font-bold text-[#010139] mb-3">
            DECLARACIÓN DE VERACIDAD Y RESPONSABILIDAD
          </h5>

          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>Yo, el asegurado solicitante,</strong> declaro bajo juramento que:
            </p>

            <ol className="list-decimal list-inside space-y-2 pl-4">
              <li>
                <strong>Información Verídica:</strong> Toda la información proporcionada en esta 
                solicitud de seguro es completa, verdadera y correcta a mi leal saber y entender.
              </li>
              
              <li>
                <strong>Conocimiento de Consecuencias:</strong> Soy consciente de que cualquier 
                declaración falsa, omisión material o inexactitud en la información suministrada 
                puede resultar en:
                <ul className="list-disc list-inside pl-6 mt-1 space-y-1">
                  <li>La anulación de la póliza de seguro</li>
                  <li>La pérdida total de coberturas contratadas</li>
                  <li>La denegación de reclamaciones futuras</li>
                  <li>Consecuencias legales según la legislación de la República de Panamá</li>
                </ul>
              </li>

              <li>
                <strong>Condiciones del Vehículo:</strong> Confirmo que el vehículo objeto del 
                seguro se encuentra en buenas condiciones de funcionamiento y no presenta daños 
                preexistentes no declarados.
              </li>

              <li>
                <strong>Documentos Adjuntos:</strong> Los documentos adjuntados (cédula, licencia 
                de conducir, registro vehicular y fotos de inspección) son auténticos, actualizados 
                y corresponden al vehículo y al titular declarado.
              </li>

              <li>
                <strong>Términos y Condiciones:</strong> He leído, entendido y acepto los términos 
                y condiciones de la póliza de seguro, incluyendo coberturas, exclusiones, deducibles 
                y obligaciones del asegurado.
              </li>

              <li>
                <strong>Normativa Aplicable:</strong> Esta declaración se realiza conforme a:
                <ul className="list-disc list-inside pl-6 mt-1 space-y-1">
                  <li>Ley 12 de 3 de abril de 2012 sobre Seguros en Panamá</li>
                  <li>Resoluciones de la Superintendencia de Seguros y Reaseguros de Panamá</li>
                  <li>Condiciones generales de la póliza contratada</li>
                </ul>
              </li>

              <li>
                <strong>Actualización de Información:</strong> Me comprometo a notificar 
                inmediatamente a la aseguradora cualquier cambio material en la información 
                declarada durante la vigencia de la póliza.
              </li>

              <li>
                <strong>Inspección Vehicular:</strong> Autorizo a la aseguradora a realizar 
                inspecciones adicionales del vehículo si lo considera necesario para validar 
                la información proporcionada.
              </li>
            </ol>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mt-4">
              <p className="font-semibold text-amber-900 mb-2">
                ⚠️ ADVERTENCIA IMPORTANTE
              </p>
              <p className="text-xs text-amber-800">
                La falsedad u omisión de información material en esta solicitud puede dar lugar 
                a la cancelación de la póliza de seguro sin derecho a reembolso de primas pagadas, 
                y puede exponerle a responsabilidades civiles y penales conforme a la legislación 
                panameña. La aseguradora se reserva el derecho de verificar la autenticidad de 
                toda la información y documentos suministrados.
              </p>
            </div>

            <p className="text-xs text-gray-500 italic mt-4">
              Al aceptar esta declaración, usted confirma que ha leído y comprendido todo lo 
              anterior y acepta todas las condiciones establecidas.
            </p>
          </div>
        </div>
      </div>

      {/* Validación visual */}
      {!isAccepted && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <FaCheckCircle className="text-red-500 text-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              Debes aceptar la declaración para continuar
            </p>
            <p className="text-xs text-red-700 mt-1">
              Marca la casilla de arriba para confirmar que la información es verídica
            </p>
          </div>
        </div>
      )}

      {/* Botón Continuar */}
      <div className="pt-6 border-t-2 border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={!isAccepted}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
            isAccepted
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="button"
        >
          {isAccepted 
            ? 'Aceptar y Continuar →' 
            : 'Acepta la declaración para continuar'}
        </button>
      </div>
    </div>
  );
}
