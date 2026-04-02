/**
 * CameraCapture — Full-screen camera modal with bottom instructions
 * For vehicle inspection photos (CC emission flow)
 *
 * Mounted via React Portal on document.body so that position:fixed is always
 * relative to the viewport — ancestor transforms (reveal animations, touch
 * feedback) cannot offset the overlay.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Esperar DOM para montar el portal
  useEffect(() => { setMounted(true); }, []);

  // Bloquear scroll de la página de fondo
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

  // Iniciar cámara
  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted]);

  // Capturar frame actual como JPEG
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

  if (!mounted) return null;

  const overlay = (
    /*
      Overlay full-screen montado como portal en document.body.
      Al estar fuera del árbol DOM de la página, ningún transform/filter
      de un ancestro puede romper position:fixed.
      z-[9999] supera al header (z-40) y al bottom nav (z-40).
      env(safe-area-inset-*) respeta el notch y la barra de inicio en iPhone.
    */
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ────────────────────────────────── */}
      <div
        className="shrink-0 bg-[#010139] text-white px-4 flex items-center justify-between"
        style={{ height: 56 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FaCamera className="text-xl shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">{label}</p>
            <p className="text-xs text-gray-300">Coloca el vehículo en el encuadre</p>
          </div>
        </div>
        {/* Botón X siempre visible */}
        <button
          onClick={handleClose}
          type="button"
          aria-label="Cerrar cámara"
          className="shrink-0 ml-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 transition-colors"
        >
          <FaTimes className="text-base text-white" />
        </button>
      </div>

      {/* ── Visor de cámara — ocupa todo el espacio disponible ── */}
      <div className="flex-1 min-h-0 relative bg-black" style={{ overflow: 'hidden' }}>
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

      {/* ── Instrucciones + disparador (solo cuando no hay error) ── */}
      {!error && (
        <div className="shrink-0 bg-black/90 px-5 pt-4 pb-5">
          {/* Banner de instrucciones */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-white mb-4">
            <h3 className="font-bold mb-1.5 flex items-center gap-2 text-sm">
              <FaCamera className="text-[#8AAA19] shrink-0" />
              Instrucciones:
            </h3>
            <p className="text-xs leading-relaxed text-gray-200">{instructions}</p>
          </div>

          {/* Botón disparador */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleCapture}
              disabled={!isReady || capturing}
              type="button"
              aria-label="Tomar foto"
              className={`relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center
                transition-all duration-150 active:scale-95
                ${!isReady || capturing
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:border-[#8AAA19] hover:scale-105'
                }`}
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
      <div
        className="shrink-0 bg-[#010139] text-white px-4 text-center flex items-center justify-center"
        style={{ height: 44 }}
      >
        <p className="text-xs text-gray-400">Las fotos son para uso exclusivo de la inspección</p>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
