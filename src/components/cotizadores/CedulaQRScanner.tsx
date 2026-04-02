/**
 * Componente para escanear QR de cédula panameña
 * Solo visible en mobile — se monta como Portal en document.body para garantizar
 * que position:fixed sea siempre relativo al viewport, sin importar si algún
 * ancestro del árbol DOM tiene transform/filter aplicado.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { FaCamera, FaTimes, FaIdCard } from 'react-icons/fa';
import { parseCedulaQR, type CedulaQRData } from '@/lib/utils/cedula-qr-parser';
import { toast } from 'sonner';

interface CedulaQRScannerProps {
  onScanSuccess: (data: CedulaQRData) => void;
  onClose: () => void;
}

export default function CedulaQRScanner({ onScanSuccess, onClose }: CedulaQRScannerProps) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);

  // Esperar a que el DOM esté disponible antes de montar el portal
  useEffect(() => { setMounted(true); }, []);

  // Bloquear scroll de la página de fondo mientras el scanner está abierto
  useEffect(() => {
    if (!mounted) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [mounted]);

  const handleScanSuccess = useCallback(async (qrText: string) => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      const cedulaData = parseCedulaQR(qrText);
      if (!cedulaData) {
        toast.error('QR inválido. Asegúrate de escanear el QR de la cédula.');
        setError('QR de cédula inválido');
        return;
      }
      toast.success('¡Cédula escaneada correctamente!');
      onScanSuccess(cedulaData);
      onClose();
    } catch {
      toast.error('Error al procesar el QR');
      setError('Error al procesar el QR');
    }
  }, [onScanSuccess, onClose]);

  useEffect(() => {
    if (!mounted) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startScanner = async () => {
      try {
        setError(null);
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 210, height: 210 } },
          (decodedText) => { handleScanSuccess(decodedText); },
          () => { /* errores de frame son normales */ }
        );
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Permite el acceso en la configuración de tu navegador.');
        } else if (err?.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara en tu dispositivo.');
        } else {
          setError('No se pudo iniciar la cámara. Verifica los permisos.');
        }
        toast.error('Error al acceder a la cámara');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
    };
  }, [mounted, handleScanSuccess]);

  const handleClose = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    onClose();
  };

  if (!mounted) return null;

  const overlay = (
    <>
      {/*
        Reglas !important para neutralizar los estilos inline que html5-qrcode inyecta
        via JS sobre sus propios elementos (#qr-reader, #qr-reader__scan_region, video).
        Ocultamos también la UI propia de la librería (dashboard, header message).
      */}
      <style>{`
        #qr-reader,
        #qr-reader__scan_region {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          overflow: hidden !important;
          position: relative !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
        #qr-reader__header_message { display: none !important; }
        #qr-reader__dashboard       { display: none !important; }
      `}</style>

      {/*
        Overlay full-screen montado como portal en document.body.
        Al estar fuera del árbol DOM de la página, ningún transform/filter
        de un ancestro puede romper el comportamiento de position:fixed.
        z-[9999] supera al header (z-40) y al bottom nav (z-40).
        env(safe-area-inset-*) respeta el notch y la barra de inicio en iPhone.
      */}
      <div
        className="fixed inset-0 z-[9999] bg-black flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[#010139] text-white px-4 flex items-center justify-between" style={{ height: 56 }}>
          <div className="flex items-center gap-3 min-w-0">
            <FaIdCard className="text-xl shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Escanear Cédula</p>
              <p className="text-xs text-gray-300 truncate">Coloca el QR frente a la cámara</p>
            </div>
          </div>
          {/* Botón X siempre visible */}
          <button
            onClick={handleClose}
            aria-label="Cerrar escáner"
            className="shrink-0 ml-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 transition-colors"
          >
            <FaTimes className="text-base text-white" />
          </button>
        </div>

        {/* ── Cuerpo ────────────────────────────────────────────────── */}
        {/*
          flex-1 min-h-0: ocupa exactamente el espacio restante entre header y footer.
          items-center centra horizontalmente.
          pt-4 pb-2: respiración vertical (sin justify-center que causaría clipping simétrico).
          overflow-hidden: segunda barrera de contención por si !important CSS pierde.
        */}
        <div
          className="flex-1 min-h-0 flex flex-col items-center px-4 pt-4 pb-2"
          style={{ overflow: 'hidden' }}
        >
          {error ? (
            /* ── Estado de error ── */
            <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 w-full max-w-sm mt-2">
              <FaCamera className="text-4xl text-red-500 mx-auto mb-3" />
              <p className="text-white text-center text-sm mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-semibold text-sm"
              >
                Cerrar
              </button>
            </div>
          ) : (
            /*
              Columna interior: ocupa todo el alto disponible (h-full min-h-0).
              El recuadro del scanner toma flex-1 min-h-0 con maxHeight para no crecer
              demasiado en tablets. Las instrucciones son shrink-0 siempre visibles abajo.
            */
            <div className="w-full max-w-sm h-full min-h-0 flex flex-col gap-3">
              {/* Recuadro del scanner — adaptativo */}
              <div
                className="w-full flex-1 min-h-0 rounded-xl border-4 border-[#8AAA19] shadow-2xl relative bg-black"
                style={{ maxHeight: 320, overflow: 'hidden' }}
              >
                {/*
                  #qr-reader es position:absolute inset-0 dentro del wrapper.
                  Combinado con las reglas CSS !important de arriba, el video
                  siempre queda contenido dentro de este recuadro.
                */}
                <div
                  id="qr-reader"
                  style={{ position: 'absolute', inset: 0 }}
                />
              </div>

              {/* Banner de instrucciones — siempre visible debajo del recuadro */}
              <div className="shrink-0 bg-white/10 backdrop-blur-sm rounded-xl p-3 text-white">
                <h3 className="font-bold mb-1.5 flex items-center gap-2 text-sm">
                  <FaIdCard className="text-[#8AAA19] shrink-0" />
                  Instrucciones:
                </h3>
                <ol className="text-xs space-y-0.5 list-decimal list-inside text-gray-200">
                  <li>Coloca la cédula boca abajo</li>
                  <li>Enfoca el código QR en el recuadro verde</li>
                  <li>Mantén la cédula estable y espera</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 bg-[#010139] text-white px-4 text-center flex items-center justify-center"
          style={{ height: 44 }}
        >
          <p className="text-xs text-gray-400">Tus datos están seguros y encriptados</p>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
