/**
 * Componente para escanear QR de cédula panameña
 * Solo visible en mobile
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { FaCamera, FaTimes, FaIdCard } from 'react-icons/fa';
import { parseCedulaQR, type CedulaQRData } from '@/lib/utils/cedula-qr-parser';
import { toast } from 'sonner';

interface CedulaQRScannerProps {
  onScanSuccess: (data: CedulaQRData) => void;
  onClose: () => void;
}

export default function CedulaQRScanner({ onScanSuccess, onClose }: CedulaQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // scannerH: computed in JS from window.innerHeight to avoid dvh/calc browser issues
  const [scannerH, setScannerH] = useState(240);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);

  // Compute scanner box height once on mount based on real viewport pixels
  useEffect(() => {
    // Total chrome to subtract: header(56) + footer(44) + py-4*2(32) + gap(12) + instructions(108) + breathing(20) = 272
    const available = window.innerHeight - 272;
    setScannerH(Math.min(Math.max(available, 200), 290));
  }, []);

  // Lock scroll on page behind the overlay
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

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
    } catch (err) {
      console.error('Error procesando QR:', err);
      toast.error('Error al procesar el QR');
      setError('Error al procesar el QR');
    }
  }, [onScanSuccess, onClose]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startScanner = async () => {
      try {
        setIsScanning(true);
        setError(null);

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 210, height: 210 },
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => { /* scan errors are normal */ }
        );
      } catch (err: any) {
        console.error('Error iniciando escáner:', err);
        if (err?.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.');
        } else if (err?.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara en tu dispositivo.');
        } else {
          setError('No se pudo iniciar la cámara. Verifica los permisos.');
        }
        toast.error('Error al acceder a la cámara');
        setIsScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch((err) => console.error('Error deteniendo escáner:', err));
      }
    };
  }, [handleScanSuccess]);

  const handleClose = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    onClose();
  };

  return (
    <>
      {/*
        html5-qrcode injects inline styles (height, width) directly onto its DOM elements
        via JS. These !important rules override those injected values so the video feed
        stays clipped inside our wrapper div instead of blowing past it.
        We also hide the library's own dashboard/header UI — we have our own.
      */}
      <style>{`
        #qr-reader {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          position: relative !important;
        }
        #qr-reader__scan_region {
          width: 100% !important;
          height: 100% !important;
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
        #qr-reader__dashboard { display: none !important; }
      `}</style>

      {/* Full-screen overlay — z-[9999] sits above header (z-40) and bottom nav (z-40) */}
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ overflow: 'hidden' }}>

        {/* Header — always visible, shrink-0 so it never gets squeezed */}
        <div className="shrink-0 bg-[#010139] text-white px-4 py-3 flex items-center justify-between" style={{ minHeight: 56 }}>
          <div className="flex items-center gap-3 min-w-0">
            <FaIdCard className="text-2xl shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">Escanear Cédula</h2>
              <p className="text-xs text-gray-300">Coloca el QR frente a la cámara</p>
            </div>
          </div>
          {/* X button — always visible in top-right */}
          <button
            onClick={handleClose}
            aria-label="Cerrar escáner"
            className="shrink-0 ml-3 w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-full transition-colors"
          >
            <FaTimes className="text-lg text-white" />
          </button>
        </div>

        {/* Body — starts from top, no justify-center (avoids symmetric clipping) */}
        <div className="flex-1 min-h-0 flex flex-col items-center px-4 pt-4 pb-2" style={{ overflow: 'hidden' }}>
          {error ? (
            <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 w-full max-w-sm mt-4">
              <FaCamera className="text-4xl text-red-500 mx-auto mb-4" />
              <p className="text-white text-center mb-4">{error}</p>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-semibold"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm flex flex-col gap-3">
              {/*
                Wrapper height is a JS-computed px value — avoids dvh/calc browser support gaps.
                overflow:hidden clips whatever html5-qrcode injects, even if !important CSS loses.
              */}
              <div
                className="rounded-xl border-4 border-[#8AAA19] shadow-2xl w-full shrink-0 relative bg-black"
                style={{ height: scannerH, overflow: 'hidden' }}
              >
                <div id="qr-reader" style={{ position: 'absolute', inset: 0 }} />
              </div>

              {/* Instructions */}
              <div className="shrink-0 bg-white/10 backdrop-blur-sm rounded-xl p-3 text-white">
                <h3 className="font-bold mb-1.5 flex items-center gap-2 text-sm">
                  <FaIdCard className="text-[#8AAA19] shrink-0" />
                  Instrucciones:
                </h3>
                <ol className="text-xs space-y-1 list-decimal list-inside">
                  <li>Coloca la cédula boca abajo</li>
                  <li>Enfoca el código QR en el recuadro</li>
                  <li>Mantén la cédula estable</li>
                  <li>Espera a que se escanee automáticamente</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-[#010139] text-white px-4 py-3 text-center" style={{ minHeight: 44 }}>
          <p className="text-xs text-gray-400">Tus datos están seguros y encriptados</p>
        </div>
      </div>
    </>
  );
}
