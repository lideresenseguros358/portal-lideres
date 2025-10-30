'use client';

import { useRouter } from 'next/navigation';
import { FaCar, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';

export default function CotizarAutoPage() {
  const router = useRouter();

  const handleCoverageSelection = (type: 'third-party' | 'full-coverage') => {
    if (type === 'third-party') {
      router.push('/cotizadores/third-party');
    } else {
      // Cobertura completa - usando cotizador de IS
      router.push('/cotizadores/auto');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/cotizadores"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver a cotizaciones</span>
          </Link>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-[#010139] to-[#020270] rounded-full mb-4">
              <FaCar className="text-white text-4xl" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#010139] mb-4">
              Seguro de Auto
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Selecciona el tipo de cobertura que necesitas
            </p>
          </div>
        </div>

        {/* Coverage Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Daños a Terceros */}
          <div
            onClick={() => handleCoverageSelection('third-party')}
            className="group bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FaShieldAlt className="text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Daños a Terceros</h2>
              <p className="text-blue-100">Cobertura legal obligatoria</p>
            </div>

            <div className="p-8">
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Emisión inmediata</div>
                    <div className="text-sm text-gray-600">Sin inspección del vehículo</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Compara aseguradoras</div>
                    <div className="text-sm text-gray-600">Múltiples opciones con logos y tarifas</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Desde B/.115/año</div>
                    <div className="text-sm text-gray-600">Planes básicos y premium disponibles</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <div className="font-bold text-[#010139] mb-2">Incluye:</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Responsabilidad civil</li>
                  <li>• Daños corporales y materiales</li>
                  <li>• Gastos médicos</li>
                  <li>• Asistencia en carretera (según plan)</li>
                </ul>
              </div>

              <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                Ver Planes y Tarifas →
              </button>
            </div>
          </div>

          {/* Cobertura Completa */}
          <div
            onClick={() => handleCoverageSelection('full-coverage')}
            className="group bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] p-8 text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FaCar className="text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Cobertura Completa</h2>
              <p className="text-green-100">Protección total para tu vehículo</p>
            </div>

            <div className="p-8">
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Cobertura amplia</div>
                    <div className="text-sm text-gray-600">Daños propios y de terceros</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Robo e incendio</div>
                    <div className="text-sm text-gray-600">Protección contra pérdida total</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Asistencia completa</div>
                    <div className="text-sm text-gray-600">Grúa, cerrajería, taxi y más</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 mb-6">
                <div className="font-bold text-[#010139] mb-2">Incluye:</div>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Todo lo de daños a terceros</li>
                  <li>• Daños propios al vehículo</li>
                  <li>• Robo total y parcial</li>
                  <li>• Desastres naturales</li>
                </ul>
              </div>

              <button className="w-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#6d8814] hover:to-[#5a7010] text-white py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                Cotizar Ahora →
              </button>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-12 max-w-4xl mx-auto bg-white rounded-xl shadow-lg border-2 border-gray-100 p-8">
          <div className="flex items-start gap-4">
            <div className="text-5xl">💡</div>
            <div>
              <h3 className="text-2xl font-bold text-[#010139] mb-4">¿Cuál es la diferencia?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="font-bold text-blue-600 mb-2">Daños a Terceros</div>
                  <p className="text-sm text-gray-700">
                    Cubre los daños que <strong>tu vehículo cause a otros</strong>. Es el seguro 
                    mínimo legal obligatorio en Panamá. Ideal si tu auto es antiguo o de bajo 
                    valor y solo necesitas cumplir con la ley.
                  </p>
                </div>
                <div>
                  <div className="font-bold text-[#8AAA19] mb-2">Cobertura Completa</div>
                  <p className="text-sm text-gray-700">
                    Cubre daños a terceros <strong>y también a tu propio vehículo</strong>, 
                    incluyendo robo, incendio, desastres naturales y más. Recomendado para autos 
                    nuevos o de mayor valor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
