/**
 * Página de Visualización de Póliza Emitida
 * Funciona para INTERNACIONAL y FEDPA
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaCheckCircle, FaDownload, FaHome, FaCar, FaUser, FaCalendar, FaDollarSign } from 'react-icons/fa';

interface EmittedPolicy {
  insurer: 'INTERNACIONAL' | 'FEDPA' | string;
  nroPoliza: string;
  clientId?: string;
  policyId?: string;
  cliente: {
    nombre: string;
    cedula: string;
    email: string;
    telefono?: string;
  };
  vehiculo?: {
    marca: string;
    modelo: string;
    ano: number | string;
    placa: string;
    vin?: string;
  };
  vigencia: {
    desde: string;
    hasta: string;
  };
  prima?: {
    total: number;
    desglose?: any[];
  };
  pdfUrl?: string;
  ramo?: string;
}

export default function PolizaEmitidaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [policy, setPolicy] = useState<EmittedPolicy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentar cargar desde sessionStorage
    const storedPolicy = sessionStorage.getItem('emittedPolicy');
    
    if (storedPolicy) {
      try {
        const parsedPolicy = JSON.parse(storedPolicy);
        setPolicy(parsedPolicy);
      } catch (error) {
        console.error('Error parsing policy:', error);
      }
    } else {
      // Fallback: intentar cargar desde query params
      const nroPoliza = searchParams.get('poliza');
      const insurer = searchParams.get('insurer');
      
      if (nroPoliza && insurer) {
        // Construir objeto básico desde params
        setPolicy({
          insurer,
          nroPoliza,
          cliente: {
            nombre: searchParams.get('clienteNombre') || 'Cliente',
            cedula: searchParams.get('clienteCedula') || '',
            email: searchParams.get('clienteEmail') || '',
          },
          vigencia: {
            desde: searchParams.get('desde') || '',
            hasta: searchParams.get('hasta') || '',
          },
        });
      }
    }
    
    setLoading(false);
  }, [searchParams]);

  const handleDownloadPDF = () => {
    if (policy?.pdfUrl) {
      window.open(policy.pdfUrl, '_blank');
    } else {
      alert('El PDF de la póliza aún no está disponible. Será enviado a tu correo.');
    }
  };

  const handleGoHome = () => {
    // Limpiar sessionStorage
    sessionStorage.removeItem('emittedPolicy');
    sessionStorage.removeItem('selectedQuote');
    
    // Redirigir al inicio
    router.push('/cotizadores');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#010139]"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            No se encontró información de póliza
          </h2>
          <p className="text-gray-600 mb-6">
            No pudimos cargar los datos de la póliza emitida.
          </p>
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-[#010139] text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header de Éxito */}
        <div className="bg-white rounded-t-2xl shadow-xl p-8 text-center border-b-4 border-green-500">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaCheckCircle className="text-5xl text-green-600" />
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">
            ¡Póliza Emitida Exitosamente!
          </h1>
          
          <p className="text-lg text-gray-600 mb-4">
            Tu póliza ha sido generada y guardada en nuestro sistema
          </p>
          
          <div className="inline-block bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white px-8 py-4 rounded-xl shadow-lg">
            <div className="text-sm font-semibold opacity-90 mb-1">Número de Póliza</div>
            <div className="text-3xl font-bold tracking-wider">{policy.nroPoliza}</div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="bg-white shadow-xl p-8 space-y-6">
          {/* Aseguradora */}
          <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
            <div className="text-2xl">🏢</div>
            <div>
              <div className="text-sm text-gray-500 font-semibold">Aseguradora</div>
              <div className="text-xl font-bold text-[#010139]">{policy.insurer}</div>
            </div>
            {policy.ramo && (
              <div className="ml-auto">
                <div className="text-sm text-gray-500 font-semibold">Ramo</div>
                <div className="text-lg font-bold text-gray-700">{policy.ramo}</div>
              </div>
            )}
          </div>

          {/* Información del Cliente */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FaUser className="text-[#8AAA19] text-xl" />
              <h3 className="text-lg font-bold text-gray-800">Datos del Asegurado</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 font-semibold mb-1">Nombre Completo</div>
                <div className="text-base font-semibold text-gray-800">{policy.cliente.nombre}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500 font-semibold mb-1">Cédula / ID</div>
                <div className="text-base font-semibold text-gray-800">{policy.cliente.cedula}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500 font-semibold mb-1">Email</div>
                <div className="text-base text-gray-700">{policy.cliente.email}</div>
              </div>
              
              {policy.cliente.telefono && (
                <div>
                  <div className="text-sm text-gray-500 font-semibold mb-1">Teléfono</div>
                  <div className="text-base text-gray-700">{policy.cliente.telefono}</div>
                </div>
              )}
            </div>
          </div>

          {/* Información del Vehículo (si aplica) */}
          {policy.vehiculo && (
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaCar className="text-[#8AAA19] text-xl" />
                <h3 className="text-lg font-bold text-gray-800">Vehículo Asegurado</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 font-semibold mb-1">Marca y Modelo</div>
                  <div className="text-base font-semibold text-gray-800">
                    {policy.vehiculo.marca} {policy.vehiculo.modelo}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 font-semibold mb-1">Año</div>
                  <div className="text-base font-semibold text-gray-800">{policy.vehiculo.ano}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-500 font-semibold mb-1">Placa</div>
                  <div className="text-base font-semibold text-gray-800">{policy.vehiculo.placa}</div>
                </div>
                
                {policy.vehiculo.vin && (
                  <div>
                    <div className="text-sm text-gray-500 font-semibold mb-1">VIN</div>
                    <div className="text-base text-gray-700 font-mono">{policy.vehiculo.vin}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vigencia */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FaCalendar className="text-blue-600 text-xl" />
              <h3 className="text-lg font-bold text-gray-800">Vigencia de la Póliza</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 font-semibold mb-1">Fecha de Inicio</div>
                <div className="text-xl font-bold text-blue-700">{policy.vigencia.desde}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-semibold mb-1">Fecha de Vencimiento</div>
                <div className="text-xl font-bold text-blue-700">{policy.vigencia.hasta}</div>
              </div>
            </div>
          </div>

          {/* Prima (si está disponible) */}
          {policy.prima && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FaDollarSign className="text-green-600 text-xl" />
                <h3 className="text-lg font-bold text-gray-800">Prima Total</h3>
              </div>
              
              <div className="text-4xl font-bold text-[#8AAA19]">
                ${policy.prima.total.toFixed(2)}
              </div>
              
              {policy.prima.desglose && policy.prima.desglose.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <div className="text-sm text-gray-600 font-semibold mb-2">Desglose:</div>
                  <div className="space-y-1">
                    {policy.prima.desglose.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.descripcion}</span>
                        <span className="font-semibold text-gray-800">${item.monto.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-6">
            <h4 className="font-bold text-blue-900 mb-2">📧 Próximos Pasos:</h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Recibirás un correo de confirmación con los detalles de tu póliza</li>
              <li>• El PDF oficial será enviado a tu correo en las próximas 24 horas</li>
              <li>• Puedes contactarnos para cualquier consulta adicional</li>
            </ul>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="bg-white rounded-b-2xl shadow-xl p-8 flex flex-col sm:flex-row gap-4 justify-center">
          {policy.pdfUrl && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 shadow-lg"
            >
              <FaDownload className="text-white" />
              Descargar Póliza
            </button>
          )}
          
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-[#010139] text-white rounded-xl font-semibold hover:bg-opacity-90 transition-all shadow-lg"
          >
            <FaHome />
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
