/**
 * Página de Confirmación - Póliza Emitida con Confeti
 * Muestra resumen completo y permite descargar carátula PDF
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaDownload, FaHome, FaShieldAlt, FaEnvelope } from 'react-icons/fa';
import confetti from 'canvas-confetti';

export default function ConfirmacionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [policyData, setPolicyData] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const caratulaRef = useRef<HTMLDivElement>(null);

  // Only one visual indicator: disabled state on button
  // The spinner inside the button is the only feedback during download

  // Load policy data and mark page as mounted
  useEffect(() => {
    const emittedPolicy = sessionStorage.getItem('emittedPolicy');
    if (emittedPolicy) setPolicyData(JSON.parse(emittedPolicy));
    setMounted(true);
  }, []);

  // Confetti — runs only once page content is visible (mounted = true)
  // Uses requestAnimationFrame, same pattern as PayFortnightProgressModal
  useEffect(() => {
    if (!mounted) return;

    const duration = 4000;
    const end = Date.now() + duration;
    let rafId: number;

    const fire = () => {
      confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'] });
      if (Date.now() < end) rafId = requestAnimationFrame(fire);
    };

    fire();

    return () => cancelAnimationFrame(rafId);
  }, [mounted]);

  if (!mounted) return null;

  const handleDownloadCaratula = () => {
    // Build HTML content for the carátula
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Carátula de Póliza - ${policyData?.nroPoliza || 'N/A'}</title>
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
  @media print { body { padding: 20px; } .no-print { display: none; } }
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
  <div class="no-print" style="text-align:center;margin-top:30px;">
    <button onclick="window.print()" style="padding:12px 30px;background:#010139;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;">Imprimir / Guardar PDF</button>
  </div>
</body></html>`;

    // Safari-safe: use Blob + object URL + <a> download instead of window.open popup
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caratula-poliza-${policyData?.nroPoliza || 'N-A'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFedpaPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfError(null);

    const env = policyData?.amb || policyData?.environment || 'PROD';

    try {
      const poliza = policyData?.nroPoliza || policyData?.poliza || '';

      if (!poliza) {
        console.warn('[Confirmación] No hay número de póliza — usando carátula HTML');
        handleDownloadCaratula();
        return;
      }

      // Call Broker Integration API — only needs the poliza number (e.g. "04-07-772-0")
      const response = await fetch('/api/fedpa/caratula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poliza,
          environment: env,
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/pdf')) {
        // Direct PDF binary — trigger download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poliza-fedpa-${poliza}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // JSON response — error or unexpected
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'No se pudo obtener la carátula');
        }
        handleDownloadCaratula();
      }
    } catch (err: any) {
      console.error('[Confirmación] Error descargando PDF FEDPA:', err);
      const isDevPolicy = env === 'DEV';
      const errorMsg = isDevPolicy
        ? 'Póliza de prueba (DEV) — la carátula PDF no está disponible. Se descargará una carátula informativa.'
        : (err.message || 'Error descargando póliza');
      setPdfError(errorMsg);
      // Fallback to HTML carátula
      handleDownloadCaratula();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadRegionalPdf = async () => {
    const poliza = policyData?.regionalPoliza || policyData?.nroPoliza;
    if (!poliza || downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfError(null);

    try {
      const response = await fetch('/api/regional/auto/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poliza }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poliza-regional-${poliza}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'No se pudo obtener la póliza');
        } else {
          handleDownloadCaratula();
        }
      }
    } catch (err: any) {
      console.error('[Confirmación] Error descargando PDF REGIONAL:', err);
      setPdfError(err.message || 'Error descargando póliza');
      handleDownloadCaratula();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadAnconPdf = () => {
    const poliza = policyData?.anconPoliza || policyData?.nroPoliza;
    if (!poliza) return;
    // Use GET endpoint — it proxies the PDF or redirects to ANCON's HTML carátula page.
    // window.open must be called synchronously (from user gesture) to avoid popup blockers.
    window.open(`/api/ancon/caratula?poliza=${encodeURIComponent(poliza)}`, '_blank');
  };

  const handleGoHome = () => {
    sessionStorage.removeItem('emittedPolicy');
    sessionStorage.removeItem('selectedQuote');
    sessionStorage.removeItem('quoteInput');
    sessionStorage.removeItem('emissionFormData');
    sessionStorage.removeItem('emissionCedulaFile');
    sessionStorage.removeItem('emissionLicenciaFile');
    sessionStorage.removeItem('fedpaEmissionPayload');
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
                    <span className="text-sm font-semibold text-gray-800 text-right">{policyData.insurer}</span>
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
                  <div className="py-3 px-4 bg-[#010139] rounded-lg mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/80">
                        {policyData.formaPago === 'cuotas' && policyData.cantidadCuotas > 1
                          ? `Prima Total (${policyData.cantidadCuotas} cuotas)`
                          : 'Prima Total'}
                      </span>
                      <span className="text-xl font-bold text-[#8AAA19]">
                        ${Number(policyData.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {policyData.formaPago === 'cuotas' && policyData.montoCuota && policyData.cantidadCuotas > 1 && (
                      <>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-white/60">Cuota</span>
                          <span className="text-sm font-semibold text-[#8AAA19]">
                            {policyData.cantidadCuotas} x ${Number(policyData.montoCuota).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {policyData.primaContado > 0 && (
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-white/40">Precio al contado</span>
                            <span className="text-xs text-white/60">
                              ${Number(policyData.primaContado).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </>
                    )}
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
          {policyData?.insurer?.toUpperCase().includes('FEDPA') ? (
            <div className="mb-6">
              <button
                onClick={handleDownloadFedpaPdf}
                disabled={downloadingPdf}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                {downloadingPdf ? (
                  <>
                    <svg className="w-5 h-5 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm">Descargando...</span>
                  </>
                ) : (
                  <>
                    <FaDownload className="text-lg text-white" />
                    <span className="text-white">Descargar Póliza</span>
                  </>
                )}
              </button>
              {pdfError && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  {pdfError} — Se generó carátula alternativa
                </p>
              )}
            </div>
          ) : (policyData?.insurer?.toUpperCase().includes('ANCON') || policyData?.insurer?.toUpperCase().includes('ANCÓN')) && policyData?.anconPoliza ? (
            <div className="mb-6">
              <button
                onClick={handleDownloadAnconPdf}
                disabled={downloadingPdf}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                {downloadingPdf ? (
                  <>
                    <svg className="w-5 h-5 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm">Descargando...</span>
                  </>
                ) : (
                  <>
                    <FaDownload className="text-lg text-white" />
                    <span className="text-white">Descargar Póliza</span>
                  </>
                )}
              </button>
              {pdfError && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  {pdfError} — Se generó carátula alternativa
                </p>
              )}
            </div>
          ) : policyData?.insurer?.toUpperCase().includes('REGIONAL') && policyData?.regionalPoliza ? (
            <div className="mb-6">
              <button
                onClick={handleDownloadRegionalPdf}
                disabled={downloadingPdf}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mx-auto text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                {downloadingPdf ? (
                  <>
                    <svg className="w-5 h-5 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-white text-sm">Descargando...</span>
                  </>
                ) : (
                  <>
                    <FaDownload className="text-lg text-white" />
                    <span className="text-white">Descargar Póliza</span>
                  </>
                )}
              </button>
              {pdfError && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  {pdfError} — Se generó carátula alternativa
                </p>
              )}
            </div>
          ) : policyData?.pdfUrl ? (
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
