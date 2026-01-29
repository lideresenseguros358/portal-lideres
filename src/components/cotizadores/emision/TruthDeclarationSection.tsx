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
              Declaro que la información suministrada es veraz, completa y correcta.
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
            Declaración de Veracidad
          </h5>

          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <p>
              Declaro y certifico, bajo la gravedad de juramento, que toda la información suministrada durante este proceso, incluyendo pero no limitándose a: datos personales del asegurado y/o contratante, información del vehículo, fotografías, documentos adjuntos, inspección visual, condiciones del bien asegurado y cualquier otro dato proporcionado de forma escrita, digital o gráfica, es real, exacta, completa y veraz.
            </p>

            <p>
              Manifiesto expresamente que no he omitido, alterado ni falseado información alguna que pueda influir directa o indirectamente en la evaluación del riesgo, la aceptación del seguro, la determinación de primas, deducibles, coberturas o condiciones contractuales.
            </p>

            <p>
              Reconozco que la presentación de información falsa, inexacta, incompleta u omisiones relevantes constituye riesgo moral, y puede dar lugar, conforme a la legislación vigente de la República de Panamá y a las condiciones generales y particulares de la póliza:
            </p>

            <ul className="list-disc list-inside pl-4 space-y-2">
              <li>A la nulidad del contrato de seguro</li>
              <li>A la cancelación de la póliza</li>
              <li>A la pérdida total o parcial de coberturas</li>
              <li>Al rechazo de reclamaciones derivadas de siniestros</li>
            </ul>

            <p>
              Acepto que la aseguradora y/o el corredor de seguros podrán verificar, auditar y contrastar la información suministrada en cualquier momento, antes o después de la emisión de la póliza.
            </p>

            <p>
              Declaro que he leído, comprendido y aceptado plenamente el contenido de esta declaración, la cual forma parte integral del proceso de emisión del seguro.
            </p>
          </div>
        </div>
      </div>

      {/* Texto final fijo (no colapsable) */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-700 font-medium">
          Esta declaración es requisito obligatorio para la emisión de la póliza.
        </p>
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
