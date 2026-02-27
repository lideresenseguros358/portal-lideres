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
          <h4 className="text-xl font-bold text-[#010139]">Términos y Condiciones</h4>
          <p className="text-sm text-gray-600">Lee y acepta los términos, condiciones y declaración de veracidad</p>
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
              He leído, comprendido y acepto los Términos y Condiciones, la Declaración de Veracidad, la Autorización de Tratamiento de Datos Personales y el Relevo de Responsabilidad.
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
          {isExpanded ? 'Ocultar' : 'Leer'} términos y condiciones completos
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
          isExpanded ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 space-y-5 text-sm text-gray-700 leading-relaxed">
          <h5 className="text-base font-bold text-[#010139] text-center uppercase tracking-wide">
            Autorización, Declaración de Veracidad, Tratamiento de Datos Personales y Relevo de Responsabilidad
          </h5>

          {/* PRIMERA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">PRIMERA: AUTORIZACIÓN PARA TRATAMIENTO DE DATOS PERSONALES</h6>
            <p>
              De conformidad con lo establecido en la Ley 81 de 26 de marzo de 2019 sobre Protección de Datos Personales de la República de Panamá y sus reglamentaciones vigentes, autorizo de manera libre, expresa, informada e inequívoca a LÍDERES EN SEGUROS, S.A., en su condición de corredor de seguros debidamente autorizado conforme a la legislación panameña, para:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Recopilar, almacenar, organizar, estructurar, conservar, modificar, consultar, utilizar, transmitir y/o transferir mis datos personales.</li>
              <li>Compartir dicha información con la(s) compañía(s) aseguradora(s) correspondiente(s), reaseguradoras, ajustadores, talleres, proveedores médicos, entidades financieras, pasarelas de pago y cualquier tercero estrictamente necesario para la gestión, cotización, emisión, administración, renovación o cancelación de pólizas.</li>
              <li>Realizar validaciones, verificaciones, consultas en bases de datos públicas o privadas y análisis de riesgo necesarios para la suscripción del seguro.</li>
            </ul>
            <p>Declaro conocer que mis datos serán utilizados exclusivamente para fines relacionados con la intermediación y gestión del contrato de seguro.</p>
          </div>

          {/* SEGUNDA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">SEGUNDA: NATURALEZA DE LA INTERMEDIACIÓN</h6>
            <p>
              Reconozco y acepto que LÍDERES EN SEGUROS, S.A. actúa única y exclusivamente en calidad de corredor e intermediario de seguros, conforme a lo dispuesto en el Decreto Ley 12 de 3 de abril de 2012, que regula la actividad de seguros y reaseguros en la República de Panamá. En consecuencia:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>El contrato de seguro se celebra única y exclusivamente entre el cliente y la compañía aseguradora.</li>
              <li>El corredor no forma parte del contrato de seguro como asegurador.</li>
              <li>Las obligaciones contractuales, coberturas, exclusiones, condiciones, límites y responsabilidades derivan directamente de la póliza emitida por la aseguradora.</li>
              <li>El deber del corredor se limita a asesorar, orientar e intermediar de buena fe entre las partes.</li>
            </ul>
          </div>

          {/* TERCERA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">TERCERA: COMUNICACIONES OFICIALES</h6>
            <p>
              Declaro que el correo electrónico suministrado por mí durante el proceso de cotización y emisión será el medio oficial de comunicación para: envío de cotizaciones, envío de pólizas, endosos, renovaciones, avisos de cobro, notificaciones de morosidad, cancelaciones, modificaciones contractuales y cualquier comunicado relevante relacionado con mi póliza. Acepto que:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Es mi responsabilidad suministrar un correo correcto y funcional.</li>
              <li>Es mi obligación revisar periódicamente dicho correo, incluyendo bandejas de spam o correo no deseado.</li>
              <li>El corredor no será responsable por errores en la digitación del correo suministrado por mí.</li>
              <li>La falta de revisión de mi correo electrónico no invalida notificaciones enviadas correctamente.</li>
            </ul>
          </div>

          {/* CUARTA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">CUARTA: RESPONSABILIDAD SOBRE PAGOS Y MOROSIDAD</h6>
            <p>
              Reconozco que la prima del seguro es una obligación contractual directa entre el cliente y la aseguradora. Aunque el portal permita registrar pagos recurrentes o automatizados, ello no traslada la responsabilidad del pago al corredor. La falta de pago oportuno puede generar cancelación automática de la póliza, suspensión de coberturas y rechazo de reclamos. Declaro que la responsabilidad por morosidad es exclusivamente mía, aun cuando:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Existan pagos recurrentes registrados.</li>
              <li>Haya errores bancarios.</li>
              <li>Existan rechazos por fondos insuficientes.</li>
              <li>Se produzcan fallas en tarjetas registradas por mí.</li>
            </ul>
            <p>El corredor no garantiza continuidad de cobertura por fallas en medios de pago.</p>
          </div>

          {/* QUINTA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">QUINTA: CLÁUSULA DE DEVOLUCIONES Y CARGOS ADMINISTRATIVOS</h6>
            <p>Acepto que:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Si por error imputable a mi persona se genera un cobro incorrecto, duplicado o mal gestionado por información suministrada de forma errónea, asumiré totalmente la responsabilidad.</li>
              <li>Toda solicitud de reverso o devolución podrá generar cargos administrativos, bancarios y operativos.</li>
              <li>Dichos cargos serán descontados del monto a devolver.</li>
              <li>El corredor no será responsable por demoras propias del banco, pasarela de pago o aseguradora.</li>
              <li>En caso de devoluciones, el tiempo y procedimiento dependerá exclusivamente de las políticas del tercero procesador.</li>
            </ul>
          </div>

          {/* SEXTA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">SEXTA: RELEVO DE RESPONSABILIDAD</h6>
            <p>
              Por medio del presente documento libero y exonero expresamente a LÍDERES EN SEGUROS, S.A., sus directores, agentes, colaboradores y representantes, de cualquier reclamación derivada de:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Decisiones de suscripción tomadas por la aseguradora.</li>
              <li>Rechazos de cobertura.</li>
              <li>Aplicación de deducibles.</li>
              <li>Exclusiones contractuales.</li>
              <li>Cancelaciones por morosidad.</li>
              <li>Errores en información suministrada por el cliente.</li>
              <li>Fallas en medios de pago proporcionados por el cliente.</li>
            </ul>
          </div>

          {/* SÉPTIMA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">SÉPTIMA: DECLARACIÓN DE VERACIDAD (INTEGRAL)</h6>
            <p>
              Declaro y certifico, bajo la gravedad de juramento, que toda la información suministrada durante este proceso, incluyendo pero no limitándose a: datos personales del asegurado y/o contratante, información del vehículo, fotografías, documentos adjuntos, inspección visual, condiciones del bien asegurado y cualquier otro dato proporcionado de forma escrita, digital o gráfica, es real, exacta, completa y veraz.
            </p>
            <p>
              Manifiesto expresamente que no he omitido, alterado ni falseado información alguna que pueda influir directa o indirectamente en la evaluación del riesgo, la aceptación del seguro, la determinación de primas, deducibles, coberturas o condiciones contractuales.
            </p>
            <p>
              Reconozco que la presentación de información falsa, inexacta, incompleta u omisiones relevantes constituye riesgo moral, y puede dar lugar, conforme a la legislación vigente de la República de Panamá:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>A la nulidad del contrato de seguro.</li>
              <li>A la cancelación de la póliza.</li>
              <li>A la pérdida total o parcial de coberturas.</li>
              <li>Al rechazo de reclamaciones derivadas de siniestros.</li>
            </ul>
            <p>
              Acepto que la aseguradora y/o el corredor de seguros podrán verificar, auditar y contrastar la información suministrada en cualquier momento, antes o después de la emisión de la póliza.
            </p>
            <p>
              Declaro que he leído, comprendido y aceptado plenamente el contenido de esta declaración, la cual forma parte integral del proceso de emisión del seguro.
            </p>
          </div>

          {/* OCTAVA */}
          <div className="space-y-2">
            <h6 className="font-bold text-[#010139]">OCTAVA: ACEPTACIÓN DIGITAL</h6>
            <p>
              Acepto que la firma digital incorporada en el portal mediante validación electrónica constituye aceptación plena, válida y vinculante del presente documento, conforme a la legislación vigente sobre comercio electrónico en la República de Panamá.
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
