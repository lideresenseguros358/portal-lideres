/**
 * CameraCapture — Full-screen camera modal with bottom instructions
 * For vehicle inspection photos (CC emission flow)
 *
 * Shows live getUserMedia feed + instruction box at bottom + shutter button.
 * Matches the visual style of CedulaQRScanner.
 * Falls back gracefully with error state if camera permission is denied.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';
import { ImSpinner8 } from 'react-icons/im';

interface CameraCaptureProps {
  /** Label shown in the header (e.g. "Parte Frontal") */
  label: string;
  /** Photo-specific instructions shown while the camera is open */
  instructions: string;
  /** Unique photo id — passed back to onCapture */
  photoId: string;
  onCapture: (file: File, photoId: string) => void;
  onClose: () => void;
}

export default function CameraCapture({
  label,
  instructions,
  photoId,
  onCapture,
  onClose,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Permite el acceso en la configuración de tu navegador.');
        } else if (err?.name === 'NotFoundError') {
          setError('No se encontró cámara en tu dispositivo.');
        } else if (!navigator.mediaDevices?.getUserMedia) {
          setError('Tu navegador no soporta la cámara web. Intenta desde Chrome o Safari móvil.');
        } else {
          setError('No se pudo iniciar la cámara. Verifica los permisos e intenta nuevamente.');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Capture current frame as JPEG File
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !isReady || capturing) return;
    setCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );
      if (!blob) return;

      const file = new File([blob], `insp_${photoId}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(file, photoId);
    } catch (err) {
      console.error('[CameraCapture] Error capturing frame:', err);
      setCapturing(false);
    }
  }, [isReady, capturing, photoId, onCapture]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 h-[100dvh] overflow-hidden bg-black z-[9999] flex flex-col">
      {/* ── Header ────────────────────────────────── */}
      <div className="shrink-0 bg-[#010139] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaCamera className="text-2xl" />
          <div>
            <h2 className="text-lg font-bold">{label}</h2>
            <p className="text-xs text-gray-300">Coloca el vehículo en el encuadre</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          type="button"
          aria-label="Cerrar cámara"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>

      {/* ── Camera viewport ───────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-black overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 max-w-sm w-full text-center">
              <FaCamera className="text-4xl text-red-400 mx-auto mb-4" />
              <p className="text-white text-sm leading-relaxed mb-5">{error}</p>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold"
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Loading spinner */}
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImSpinner8 className="text-white text-4xl animate-spin" />
              </div>
            )}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s' }}
            />
          </>
        )}
      </div>

      {/* ── Bottom: instructions + shutter ────────── */}
      {!error && (
        <div className="shrink-0 bg-black/90 px-5 pt-4 pb-6 safe-bottom">
          {/* Instructions box — same style as CedulaQRScanner */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white mb-5">
            <h3 className="font-bold mb-2 flex items-center gap-2 text-sm">
              <FaCamera className="text-[#8AAA19]" />
              Instrucciones:
            </h3>
            <p className="text-sm leading-relaxed text-gray-200">{instructions}</p>
          </div>

          {/* Shutter button */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleCapture}
              disabled={!isReady || capturing}
              className={`relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center
                transition-all duration-150 active:scale-95
                ${!isReady || capturing
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:border-[#8AAA19] hover:scale-105'
                }`}
              type="button"
              aria-label="Tomar foto"
            >
              {capturing ? (
                <ImSpinner8 className="text-white text-2xl animate-spin" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────── */}
      <div className="shrink-0 bg-[#010139] text-white p-3 text-center">
        <p className="text-xs text-gray-400">🔒 Las fotos son para uso exclusivo de la inspección</p>
      </div>
    </div>
  );
}
