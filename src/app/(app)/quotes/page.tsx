// Landing page del cotizador - Selector de tipo de seguro
import Link from 'next/link';
import { FaCar, FaShieldAlt, FaHeartbeat, FaFire, FaHome } from 'react-icons/fa';

export default function QuotesLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#010139] mb-4">
            Cotizador de Seguros
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Compara planes y obtén tu cotización al instante. Elige el tipo de seguro que necesitas.
          </p>
        </div>

        {/* Coverage Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Daños a Terceros Card */}
          <Link
            href="/quotes/third-party"
            className="block group"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] transition-all duration-300 hover:shadow-2xl overflow-hidden h-full">
              <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-8 text-white">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <FaCar size={48} />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                  Daños a Terceros
                </h2>
                <p className="text-center text-white/80 text-sm">
                  Cobertura obligatoria básica
                </p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-[#010139] mb-3 flex items-center gap-2">
                    <span className="text-[#8AAA19]">✓</span>
                    Incluye:
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Lesiones corporales a terceros</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Daños a la propiedad</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Gastos médicos (según plan)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Asistencia legal y vial</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-green-800">
                    💰 Desde B/.115.00/año
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Tarifa fija - Sin cotización necesaria
                  </p>
                </div>

                <div className="flex items-center justify-center text-[#010139] group-hover:text-[#8AAA19] transition-colors font-semibold">
                  Ver Planes →
                </div>
              </div>
            </div>
          </Link>

          {/* Cobertura Completa Card */}
          <Link
            href="/quotes/comprehensive"
            className="block group"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] transition-all duration-300 hover:shadow-2xl overflow-hidden h-full">
              <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] p-8 text-white">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <FaShieldAlt size={48} />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                  Cobertura Completa
                </h2>
                <p className="text-center text-white/80 text-sm">
                  Protección total para tu vehículo
                </p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-[#010139] mb-3 flex items-center gap-2">
                    <span className="text-[#8AAA19]">✓</span>
                    Incluye:
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Todo lo de Daños a Terceros</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Daños propios (colisión)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Robo total del vehículo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#8AAA19] mt-0.5">•</span>
                      <span>Incendio y fenómenos naturales</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-blue-800">
                    📋 Cotización personalizada
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Basada en valor del vehículo y coberturas
                  </p>
                </div>

                <div className="flex items-center justify-center text-[#010139] group-hover:text-[#8AAA19] transition-colors font-semibold">
                  Cotizar Ahora →
                </div>
              </div>
            </div>
          </Link>

          {/* Vida Card */}
          <Link
            href="/quotes/vida"
            className="block group"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] transition-all duration-300 hover:shadow-2xl overflow-hidden h-full">
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-6 text-white">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <FaHeartbeat size={40} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-2">
                  Seguro de Vida
                </h2>
                <p className="text-center text-white/80 text-sm">
                  Protección para tu familia
                </p>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Protege a tus seres queridos con un seguro de vida que garantiza su estabilidad financiera.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold text-blue-800">
                    🏢 Aseguradora: ASSA
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Cotización personalizada
                  </p>
                </div>

                <div className="flex items-center justify-center text-[#010139] group-hover:text-[#8AAA19] transition-colors font-semibold">
                  Cotizar Ahora →
                </div>
              </div>
            </div>
          </Link>

          {/* Incendio Card */}
          <Link
            href="/quotes/incendio"
            className="block group"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] transition-all duration-300 hover:shadow-2xl overflow-hidden h-full">
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-6 text-white">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <FaFire size={40} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-2">
                  Seguro de Incendio
                </h2>
                <p className="text-center text-white/80 text-sm">
                  Protege tu propiedad
                </p>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Protección contra incendios, rayos y otros riesgos que puedan afectar tu propiedad.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold text-blue-800">
                    🏢 Aseguradoras: Internacional, Ancón
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Cotización personalizada
                  </p>
                </div>

                <div className="flex items-center justify-center text-[#010139] group-hover:text-[#8AAA19] transition-colors font-semibold">
                  Cotizar Ahora →
                </div>
              </div>
            </div>
          </Link>

          {/* Contenido Card */}
          <Link
            href="/quotes/contenido"
            className="block group"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] transition-all duration-300 hover:shadow-2xl overflow-hidden h-full">
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-6 text-white">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-white/20 p-3 rounded-full">
                    <FaHome size={40} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center mb-2">
                  Seguro de Contenido
                </h2>
                <p className="text-center text-white/80 text-sm">
                  Protege tus pertenencias
                </p>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Protección para muebles, equipos electrónicos y demás pertenencias de tu hogar u oficina.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold text-blue-800">
                    🏢 Aseguradoras: Internacional, Ancón
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Cotización personalizada
                  </p>
                </div>

                <div className="flex items-center justify-center text-[#010139] group-hover:text-[#8AAA19] transition-colors font-semibold">
                  Cotizar Ahora →
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Info Footer */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-white rounded-lg shadow-md border-2 border-gray-100 p-6 max-w-3xl">
            <h3 className="font-bold text-[#010139] mb-3 flex items-center justify-center gap-2">
              <span className="text-2xl">ℹ️</span>
              ¿Necesitas ayuda para decidir?
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Nuestro cotizador te permite comparar diferentes opciones y obtener tu cotización al instante. 
              Cada tipo de seguro está diseñado para proteger diferentes aspectos de tu vida y patrimonio.
            </p>
            <p className="text-xs text-gray-500">
              💬 Contáctanos si tienes dudas sobre qué seguro es mejor para ti
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
