/**
 * Página de Confirmación - Póliza Emitida con Confeti
 * Muestra resumen completo y permite descargar carátula PDF
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaDownload, FaHome, FaShieldAlt } from 'react-icons/fa';
import confetti from 'canvas-confetti';

export default function ConfirmacionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [policyData, setPolicyData] = useState<any>(null);
  const caratulaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const emittedPolicy = sessionStorage.getItem('emittedPolicy');
    if (emittedPolicy) {
      const data = JSON.parse(emittedPolicy);
      setPolicyData(data);
    }

    // Confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      if (Date.now() > animationEnd) { clearInterval(interval); return; }
      confetti({ particleCount: 50, angle: randomInRange(55, 125), spread: randomInRange(50, 70), origin: { x: randomInRange(0.1, 0.3), y: 0 }, colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'] });
      confetti({ particleCount: 50, angle: randomInRange(55, 125), spread: randomInRange(50, 70), origin: { x: randomInRange(0.7, 0.9), y: 0 }, colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'] });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const handleDownloadCaratula = () => {
    if (!caratulaRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Permite ventanas emergentes para descargar'); return; }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Carátula de Póliza - ${policyData?.nroPoliza || 'N/A'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
        .header { text-align: center; border-bottom: 3px solid #8AAA19; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #010139; font-size: 28px; margin-bottom: 5px; }
        .header h2 { color: #8AAA19; font-size: 18px; font-weight: 600; }
        .header .poliza-num { font-size: 24px; color: #010139; font-weight: 800; margin-top: 15px; background: #f0f4e0; padding: 10px 20px; border-radius: 8px; display: inline-block; }
        .section { margin-bottom: 25px; }
        .section h3 { color: #010139; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .row .label { color: #666; }
        .row .value { font-weight: 600; color: #010139; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
        .prima-box { background: #010139; color: white; padding: 15px 25px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .prima-box .amount { font-size: 32px; font-weight: 800; color: #8AAA19; }
        .prima-box .label { font-size: 12px; opacity: 0.8; }
        ${policyData?.isDemo ? '.demo-badge { background: #ff6b6b; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 10px; }' : ''}
        @media print { body { padding: 20px; } }
      </style></head><body>
        <div class="header">
          <h1>Líderes en Seguros</h1>
          <h2>Carátula de Póliza</h2>
          ${policyData?.nroPoliza ? `<div class="poliza-num">Póliza N° ${policyData.nroPoliza}</div>` : ''}
          ${policyData?.isDemo ? '<div class="demo-badge">DEMOSTRACIÓN</div>' : ''}
        </div>
        
        <div class="section">
          <h3>Información General</h3>
          <div class="row"><span class="label">Aseguradora:</span><span class="value">${policyData?.insurer || 'N/A'}</span></div>
          <div class="row"><span class="label">Plan:</span><span class="value">${policyData?.tipoCobertura || (policyData?.planType === 'premium' ? 'Premium (Endoso Porcelana)' : 'Básico (Full Extras)')}</span></div>
          ${policyData?.cotizacion ? `<div class="row"><span class="label">Cotización:</span><span class="value">${policyData.cotizacion}</span></div>` : ''}
          ${policyData?.vigenciaDesde ? `<div class="row"><span class="label">Vigencia:</span><span class="value">${policyData.vigenciaDesde} al ${policyData.vigenciaHasta}</span></div>` : ''}
        </div>
        
        <div class="section">
          <h3>Datos del Asegurado</h3>
          ${policyData?.asegurado ? `<div class="row"><span class="label">Nombre:</span><span class="value">${policyData.asegurado}</span></div>` : ''}
          ${policyData?.cedula ? `<div class="row"><span class="label">Identificación:</span><span class="value">${policyData.cedula}</span></div>` : ''}
        </div>
        
        <div class="section">
          <h3>Datos del Vehículo</h3>
          ${policyData?.vehiculo ? `<div class="row"><span class="label">Vehículo:</span><span class="value">${policyData.vehiculo}</span></div>` : ''}
          ${policyData?.placa ? `<div class="row"><span class="label">Placa:</span><span class="value">${policyData.placa}</span></div>` : ''}
        </div>
        
        ${policyData?.primaTotal ? `
        <div class="prima-box">
          <div class="label">Prima Total Anual</div>
          <div class="amount">$${Number(policyData.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>` : ''}
        
        <div class="footer">
          <p>Documento generado por Líderes en Seguros — ${new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin-top:5px;">Este documento es una carátula informativa. La póliza oficial será enviada por la aseguradora.</p>
        </div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleGoHome = () => {
    sessionStorage.removeItem('emittedPolicy');
    sessionStorage.removeItem('selectedQuote');
    sessionStorage.removeItem('quoteInput');
    sessionStorage.removeItem('emissionFormData');
    sessionStorage.removeItem('emissionCedulaFile');
    sessionStorage.removeItem('emissionLicenciaFile');
    router.push('/cotizadores');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-200 p-8 sm:p-12 text-center">
          {/* Ícono de Éxito */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-xl animate-bounce">
              <FaCheckCircle className="text-white text-5xl" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-4">
            ¡Felicidades!
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-green-700 mb-3">
            Tu póliza ha sido emitida con éxito
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mb-8">
            Gracias por confiar en <span className="font-bold text-[#8AAA19]">Líderes en Seguros</span>
          </p>

          {/* Información de la Póliza */}
          {policyData && (
            <div ref={caratulaRef} className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 mb-8 border-2 border-green-200 text-left">
              <h3 className="text-sm font-semibold text-gray-500 mb-4 text-center uppercase tracking-wide">
                Resumen de la Póliza
              </h3>
              
              <div className="space-y-3">
                {policyData.nroPoliza && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Número de Póliza</span>
                    <span className="text-lg font-bold text-[#010139]">{policyData.nroPoliza}</span>
                  </div>
                )}
                {policyData.insurer && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Aseguradora</span>
                    <span className="text-sm font-semibold text-gray-800">{policyData.insurer}</span>
                  </div>
                )}
                {(policyData.tipoCobertura || policyData.planType) && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Plan</span>
                    <span className="text-sm font-semibold text-[#8AAA19]">
                      {policyData.tipoCobertura || (policyData.planType === 'premium' ? 'Premium (Porcelana)' : 'Básico (Full Extras)')}
                    </span>
                  </div>
                )}
                {policyData.asegurado && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Asegurado</span>
                    <span className="text-sm font-semibold">{policyData.asegurado}</span>
                  </div>
                )}
                {policyData.vehiculo && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Vehículo</span>
                    <span className="text-sm font-semibold">{policyData.vehiculo}</span>
                  </div>
                )}
                {policyData.placa && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Placa</span>
                    <span className="text-sm font-semibold">{policyData.placa}</span>
                  </div>
                )}
                {policyData.vigenciaDesde && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span className="text-sm text-gray-600">Vigencia</span>
                    <span className="text-sm font-medium text-gray-700">
                      {policyData.vigenciaDesde} — {policyData.vigenciaHasta}
                    </span>
                  </div>
                )}
                {policyData.primaTotal && (
                  <div className="flex justify-between items-center py-3 px-4 bg-[#010139] rounded-lg mt-2">
                    <span className="text-sm text-white/80">Prima Total</span>
                    <span className="text-xl font-bold text-[#8AAA19]">
                      ${Number(policyData.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
              
              {policyData.isDemo && (
                <div className="mt-3 text-center">
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    DEMOSTRACIÓN
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botón: Descargar Póliza */}
          {policyData?.pdfUrl ? (
            <a
              href={policyData.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mb-4 mx-auto text-white"
            >
              <FaDownload className="text-xl text-white" />
              <span className="text-white">Descargar Póliza</span>
            </a>
          ) : (
            <button
              onClick={handleDownloadCaratula}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mb-4 mx-auto text-white"
            >
              <FaDownload className="text-xl text-white" />
              <span className="text-white">Descargar Póliza</span>
            </button>
          )}
          <p className="text-xs text-gray-500 mb-6">
            Documento oficial emitido por la aseguradora
          </p>

          <div className="my-6 border-t border-gray-200"></div>

          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-[#8AAA19] transition-colors text-sm font-medium"
          >
            <FaHome className="text-base" />
            Volver al inicio
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Recibirás un correo electrónico con la confirmación y detalles de tu póliza
          </p>
        </div>
      </div>
    </div>
  );
}
