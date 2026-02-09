/**
 * Resumen Final de Cotización antes de Emitir
 * Muestra todos los datos ingresados, tarifa seleccionada, fechas
 */

'use client';

import { useState } from 'react';
import { 
  FaShieldAlt, 
  FaUser, 
  FaCar, 
  FaCalendarAlt, 
  FaMoneyBillWave,
  FaCheckCircle,
  FaInfoCircle,
  FaFileAlt,
  FaCamera,
  FaTimes
} from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface FinalQuoteSummaryProps {
  quoteData: any;
  selectedPlan: any;
  installments: number;
  monthlyPayment: number;
  emissionData?: any;
  vehicleData?: any;
  inspectionPhotos?: any[];
  onConfirm: () => void;
}

export default function FinalQuoteSummary({
  quoteData,
  selectedPlan,
  installments,
  monthlyPayment,
  emissionData,
  vehicleData,
  inspectionPhotos,
  onConfirm
}: FinalQuoteSummaryProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);
  const [showDeclaracionModal, setShowDeclaracionModal] = useState(false);

  // Calcular fechas
  const today = new Date();
  const renewalDate = new Date(today);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const reminderDate = new Date(renewalDate);
  reminderDate.setDate(reminderDate.getDate() - 30);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Datos del cliente: preferir emissionData sobre quoteData
  const clientName = emissionData
    ? `${emissionData.primerNombre || ''} ${emissionData.segundoNombre || ''} ${emissionData.primerApellido || ''} ${emissionData.segundoApellido || ''}`.replace(/\s+/g, ' ').trim()
    : quoteData?.nombreConductor || quoteData?.nombre || 'N/A';
  const clientCedula = emissionData?.cedula || quoteData?.cedula || 'N/A';
  const clientEmail = emissionData?.email || quoteData?.email;
  const clientTelefono = emissionData?.telefono || quoteData?.telefono;
  const clientCelular = emissionData?.celular;
  const clientDireccion = emissionData?.direccion;
  const clientFechaNacimiento = emissionData?.fechaNacimiento;
  const clientSexo = emissionData?.sexo;

  // Datos del vehículo: combinar quoteData + vehicleData
  const vehPlaca = vehicleData?.placa || quoteData?.placa || 'N/A';
  const vehVin = vehicleData?.vinChasis || vehicleData?.vin || '';
  const vehMotor = vehicleData?.motor || '';
  const vehColor = vehicleData?.color || '';
  const vehPasajeros = vehicleData?.pasajeros || '';
  const vehPuertas = vehicleData?.puertas || '';

  // Coberturas reales del plan seleccionado
  const coberturas = selectedPlan?.coverages?.filter((c: any) => c.included) || [];

  // Deducible
  const deducibleInfo = selectedPlan?._deducibleInfo;
  const deducibleLabel = deducibleInfo
    ? `$${deducibleInfo.valor?.toLocaleString()} (${deducibleInfo.porcentaje || deducibleInfo.descripcion || ''})`
    : quoteData?.deducible || '';

  const handleConfirm = async () => {
    if (!declaracionAceptada) {
      toast.error('Debes aceptar la Declaración de Veracidad para continuar');
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
    } catch (error) {
      toast.error('Error al emitir póliza');
      setIsConfirming(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] rounded-full mb-4">
          <FaCheckCircle className="text-3xl text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#010139] mb-2">
          Confirma tu Póliza
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Revisa todos los detalles antes de emitir
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Data Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaUser className="text-[#8AAA19]" />
              Datos del Asegurado
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Nombre Completo</span>
                <div className="font-semibold text-[#010139]">{clientName}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide">Cédula / Pasaporte</span>
                <div className="font-semibold text-[#010139]">{clientCedula}</div>
              </div>
              {clientFechaNacimiento && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Fecha de Nacimiento</span>
                  <div className="font-semibold">{clientFechaNacimiento}</div>
                </div>
              )}
              {clientSexo && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Sexo</span>
                  <div className="font-semibold">{clientSexo === 'M' ? 'Masculino' : 'Femenino'}</div>
                </div>
              )}
              {clientEmail && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Email</span>
                  <div className="font-semibold">{clientEmail}</div>
                </div>
              )}
              {clientTelefono && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Teléfono</span>
                  <div className="font-semibold">{clientTelefono}</div>
                </div>
              )}
              {clientCelular && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Celular</span>
                  <div className="font-semibold">{clientCelular}</div>
                </div>
              )}
              {clientDireccion && (
                <div className="sm:col-span-2">
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Dirección</span>
                  <div className="font-semibold">{clientDireccion}</div>
                </div>
              )}
              {emissionData?.esPEP !== undefined && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Persona Expuesta Políticamente</span>
                  <div className="font-semibold">{emissionData.esPEP ? 'Sí' : 'No'}</div>
                </div>
              )}
              {emissionData?.acreedor && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Acreedor</span>
                  <div className="font-semibold">{emissionData.acreedor}</div>
                </div>
              )}
            </div>
          </div>

          {/* Vehículo */}
          {quoteData?.marca && (
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
                <FaCar className="text-[#8AAA19]" />
                Datos del Vehículo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Marca</span>
                  <div className="font-semibold text-[#010139]">{quoteData.marca}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Modelo</span>
                  <div className="font-semibold text-[#010139]">{quoteData.modelo}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Año</span>
                  <div className="font-semibold">{quoteData.anno || quoteData.anio}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Placa</span>
                  <div className="font-semibold">{vehPlaca}</div>
                </div>
                {vehVin && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">VIN / Chasis</span>
                    <div className="font-semibold font-mono text-xs">{vehVin}</div>
                  </div>
                )}
                {vehMotor && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Motor</span>
                    <div className="font-semibold font-mono text-xs">{vehMotor}</div>
                  </div>
                )}
                {vehColor && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Color</span>
                    <div className="font-semibold">{vehColor}</div>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Valor Asegurado</span>
                  <div className="font-semibold text-[#8AAA19]">${quoteData.valorVehiculo?.toLocaleString()}</div>
                </div>
                {vehPasajeros && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Pasajeros</span>
                    <div className="font-semibold">{vehPasajeros}</div>
                  </div>
                )}
                {vehPuertas && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Puertas</span>
                    <div className="font-semibold">{vehPuertas}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coberturas Incluidas */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaShieldAlt className="text-[#8AAA19]" />
              Coberturas Incluidas
            </h3>
            {coberturas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {coberturas.map((coverage: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm py-1">
                    <FaCheckCircle className="text-[#8AAA19] flex-shrink-0 mt-0.5" />
                    <span>{coverage.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Coberturas del plan seleccionado</p>
            )}
            
            {deducibleLabel && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-gray-500 text-xs uppercase tracking-wide">Deducible</span>
                <div className="font-semibold text-[#010139]">{deducibleLabel}</div>
              </div>
            )}
          </div>

          {/* Documentos e Inspección */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaFileAlt className="text-[#8AAA19]" />
              Documentación
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {emissionData?.cedulaFile ? (
                  <FaCheckCircle className="text-[#8AAA19]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={emissionData?.cedulaFile ? 'font-semibold' : 'text-gray-400'}>
                  Cédula / Pasaporte
                </span>
              </div>
              <div className="flex items-center gap-2">
                {emissionData?.licenciaFile ? (
                  <FaCheckCircle className="text-[#8AAA19]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={emissionData?.licenciaFile ? 'font-semibold' : 'text-gray-400'}>
                  Licencia de Conducir
                </span>
              </div>
              <div className="flex items-center gap-2">
                {vehicleData?.registroVehicular ? (
                  <FaCheckCircle className="text-[#8AAA19]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={vehicleData?.registroVehicular ? 'font-semibold' : 'text-gray-400'}>
                  Registro Vehicular
                </span>
              </div>
              <div className="flex items-center gap-2">
                {inspectionPhotos && inspectionPhotos.length > 0 ? (
                  <FaCheckCircle className="text-[#8AAA19]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={inspectionPhotos && inspectionPhotos.length > 0 ? 'font-semibold' : 'text-gray-400'}>
                  <FaCamera className="inline mr-1" />
                  Inspección ({inspectionPhotos?.length || 0} fotos)
                </span>
              </div>
            </div>
          </div>

          {/* Fechas */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <FaCalendarAlt className="text-blue-600" />
              Vigencia de la Póliza
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-gray-700 text-sm font-semibold">Fecha de Emisión:</span>
                <div className="text-lg font-bold text-[#010139]">{formatDate(today)}</div>
              </div>
              <div className="relative">
                <span className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                  Fecha de Renovación:
                  <div className="group relative inline-block">
                    <FaInfoCircle className="text-blue-500 cursor-help" />
                    <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 z-10">
                      Le recordaremos 30 días antes sobre su renovación
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </span>
                <div className="text-lg font-bold text-[#010139]">{formatDate(renewalDate)}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Recordatorio: {formatDate(reminderDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Declaración de Veracidad */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-amber-200 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#010139] mb-4">
              <span className="text-xl">📋</span>
              Declaración de Veracidad
            </h3>
            
            <p className="text-sm text-gray-700 mb-4">
              Declaro que la información suministrada es veraz, completa y correcta.
            </p>

            <label className="flex items-start gap-3 cursor-pointer group mb-3">
              <input
                type="checkbox"
                checked={declaracionAceptada}
                onChange={(e) => setDeclaracionAceptada(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#8AAA19] focus:ring-[#8AAA19] cursor-pointer accent-[#8AAA19]"
              />
              <span className="text-sm text-gray-700 group-hover:text-[#010139] transition-colors">
                He leído y acepto la{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowDeclaracionModal(true); }}
                  className="text-[#8AAA19] font-semibold underline hover:text-[#6d8814]"
                >
                  Declaración de Veracidad completa
                </button>
              </span>
            </label>

            <p className="text-xs text-gray-500 italic">
              Esta declaración es requisito obligatorio para la emisión de la póliza.
            </p>
          </div>
        </div>

        {/* Right Column - Payment Summary */}
        <div className="space-y-6">
          {/* Plan Seleccionado */}
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-xl shadow-2xl p-6 text-white sticky top-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaShieldAlt />
              Plan Seleccionado
            </h3>
            
            {/* Aseguradora */}
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <div className="text-sm opacity-80 mb-1">Aseguradora</div>
              <div className="text-lg font-bold">{selectedPlan?.insurerName}</div>
              <div className="text-xs opacity-70 mt-1">
                Plan {selectedPlan?.planType === 'premium' ? 'Premium (Endoso Porcelana)' : 'Básico (Full Extras)'}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-80">Prima Anual</span>
                <span className="text-xl font-bold">
                  ${selectedPlan?.annualPremium?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {installments > 1 && (
                <>
                  <div className="border-t border-white/20 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm opacity-80">Forma de Pago</span>
                      <span className="font-semibold">{installments} Cuotas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-80">Pago Mensual</span>
                      <span className="text-2xl font-bold text-[#8AAA19]">
                        ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Total a Pagar */}
            <div className="bg-[#8AAA19] rounded-lg p-4 mb-6">
              <div className="text-sm opacity-90 mb-1">Total a Pagar</div>
              <div className="text-3xl font-bold">
                ${((installments > 1 ? monthlyPayment * installments : selectedPlan?.annualPremium) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              {installments > 1 && (
                <div className="text-xs opacity-90 mt-1">
                  {installments} pagos de ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              disabled={isConfirming || !declaracionAceptada}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                declaracionAceptada && !isConfirming
                  ? 'bg-white text-[#010139] hover:bg-gray-100 cursor-pointer'
                  : 'bg-white/30 text-white/60 cursor-not-allowed'
              }`}
            >
              {isConfirming ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#010139]"></div>
                  Emitiendo...
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Confirmar y Emitir
                </>
              )}
            </button>

            {!declaracionAceptada && (
              <p className="text-xs text-center mt-3 text-amber-300">
                Acepta la Declaración de Veracidad para continuar
              </p>
            )}
          </div>

          {/* Security Badge */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <div className="text-sm font-semibold text-gray-700">100% Seguro</div>
            <div className="text-xs text-gray-500 mt-1">
              Transacción encriptada y protegida
            </div>
          </div>
        </div>
      </div>

      {/* Modal Declaración de Veracidad */}
      {showDeclaracionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-[#010139] flex items-center gap-2">
                <span>📋</span> Declaración de Veracidad
              </h3>
              <button
                onClick={() => setShowDeclaracionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-4">
              <p>
                Declaro y certifico, bajo la gravedad de juramento, que toda la información suministrada durante este proceso, incluyendo pero no limitándose a: datos personales del asegurado y/o contratante, información del vehículo, fotografías, documentos adjuntos, inspección visual, condiciones del bien asegurado y cualquier otro dato proporcionado de forma escrita, digital o gráfica, es <strong>real, exacta, completa y veraz</strong>.
              </p>

              <p>
                Manifiesto expresamente que <strong>no he omitido, alterado ni falseado</strong> información alguna que pueda influir directa o indirectamente en la evaluación del riesgo, la aceptación del seguro, la determinación de primas, deducibles, coberturas o condiciones contractuales.
              </p>

              <p>
                Reconozco que la presentación de información falsa, inexacta, incompleta u omisiones relevantes constituye <strong>riesgo moral</strong>, y puede dar lugar, conforme a la legislación vigente de la República de Panamá y a las condiciones generales y particulares de la póliza:
              </p>

              <ul className="list-disc pl-6 space-y-1">
                <li>A la <strong>nulidad</strong> del contrato de seguro</li>
                <li>A la <strong>cancelación</strong> de la póliza</li>
                <li>A la <strong>pérdida total o parcial</strong> de coberturas</li>
                <li>Al <strong>rechazo de reclamaciones</strong> derivadas de siniestros</li>
              </ul>

              <p>
                Acepto que la aseguradora y/o el corredor de seguros podrán <strong>verificar, auditar y contrastar</strong> la información suministrada en cualquier momento, antes o después de la emisión de la póliza.
              </p>

              <p>
                Declaro que he leído, comprendido y aceptado plenamente el contenido de esta declaración, la cual forma parte integral del proceso de emisión del seguro.
              </p>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setDeclaracionAceptada(true);
                  setShowDeclaracionModal(false);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all"
              >
                Acepto la Declaración
              </button>
              <button
                onClick={() => setShowDeclaracionModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
