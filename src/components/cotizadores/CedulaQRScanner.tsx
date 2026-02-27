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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStartedRef = useRef(false);

  const handleScanSuccess = useCallback(async (qrText: string) => {
    try {
      // Detener el escáner
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      // Parsear el QR
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
          { facingMode: 'environment' }, // Cámara trasera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // QR escaneado exitosamente
            handleScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Error de escaneo (normal, no mostrar)
          }
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
      // Cleanup
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
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
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#010139] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaIdCard className="text-2xl" />
          <div>
            <h2 className="text-lg font-bold">Escanear Cédula</h2>
            <p className="text-xs text-gray-300">Coloca el QR frente a la cámara</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 max-w-md">
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
          <div className="w-full max-w-md">
            {/* QR Reader Container */}
            <div
              id="qr-reader"
              className="rounded-xl overflow-hidden border-4 border-[#8AAA19] shadow-2xl"
            />

            {/* Instructions */}
            <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <FaIdCard className="text-[#8AAA19]" />
                Instrucciones:
              </h3>
              <ol className="text-sm space-y-2 list-decimal list-inside">
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
      <div className="bg-[#010139] text-white p-4 text-center">
        <p className="text-xs text-gray-400">
          🔒 Tus datos están seguros y encriptados
        </p>
      </div>
    </div>
  );
}
