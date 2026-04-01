/**
 * Sección: Inspección Vehicular
 * Dibujo auto GRANDE + botones interactivos sobre el dibujo.
 * Al tocar un botón se abre CameraCapture (full-screen) con instrucciones en la parte inferior.
 */

'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { FaCamera, FaCheck, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';

// Lazy-load the camera modal — only instantiated when the user opens it
const CameraCapture = lazy(() => import('./CameraCapture'));

interface InspectionPhoto {
  id: string;
  name: string;
  label: string;
  instructions: string;
  position: 'on-car' | 'below-car';
  file?: File;
  preview?: string;
}

export interface VehicleInspectionData {
  frontalFile?: File;
  traseraFile?: File;
  lateralIzqFile?: File;
  lateralDerFile?: File;
  motorFile?: File;
  tableroFile?: File;
  vinFile?: File;
}

interface VehicleInspectionSectionProps {
  initialData?: Partial<VehicleInspectionData>;
  onComplete: (data: VehicleInspectionData) => void;
}

export default function VehicleInspectionSection({
  initialData,
  onComplete,
}: VehicleInspectionSectionProps) {
  const [photos, setPhotos] = useState<InspectionPhoto[]>([
    {
      id: 'frontal',
      name: 'frontal',
      label: 'Parte Frontal',
      instructions: 'Colócate frente al vehículo y toma la foto de manera que se vea el auto completo. Asegúrate de que la placa delantera y los faros sean visibles.',
      position: 'on-car',
    },
    {
      id: 'trasera',
      name: 'trasera',
      label: 'Parte Trasera',
      instructions: 'Colócate detrás del vehículo y captura la parte trasera completa. La placa trasera debe verse claramente en la foto.',
      position: 'on-car',
    },
    {
      id: 'lateral-izq',
      name: 'lateralIzq',
      label: 'Lateral Izquierdo',
      instructions: 'Colócate al lado izquierdo (lado del conductor). Captura todo el lateral del vehículo de punta a punta, asegurándote de que se vea la carrocería completa.',
      position: 'on-car',
    },
    {
      id: 'lateral-der',
      name: 'lateralDer',
      label: 'Lateral Derecho',
      instructions: 'Colócate al lado derecho (lado del pasajero). Captura todo el lateral del vehículo de punta a punta, asegurándote de que se vea la carrocería completa.',
      position: 'on-car',
    },
    {
      id: 'motor',
      name: 'motor',
      label: 'Parte Motor',
      instructions: 'Abre el capó y toma la foto del compartimiento del motor desde arriba. Asegúrate de que el motor sea claramente visible en la imagen.',
      position: 'on-car',
    },
    {
      id: 'tablero',
      name: 'tablero',
      label: 'Parte Tablero',
      instructions: 'Siéntate frente al tablero y toma la foto mostrando claramente el marcador de kilometraje del vehículo.',
      position: 'on-car',
    },
    {
      id: 'vin',
      name: 'vin',
      label: 'Placa de Chasis (VIN)',
      instructions: 'Busca la plaquita metálica con el número VIN (17 dígitos). Generalmente se encuentra en el marco interior de la puerta del conductor o del pasajero — es una etiqueta adherida al metal del marco al abrir la puerta. Si no la encuentras ahí, revisa la esquina inferior del parabrisas del lado del conductor, visible desde afuera. El número de 17 dígitos debe ser legible claramente en la foto.',
      position: 'below-car',
    },
  ]);

  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);
  // id of the photo whose camera is currently open, null = camera closed
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  // Restore cached photos on mount
  useEffect(() => {
    const cachedIndex = sessionStorage.getItem('inspectionPhotosIndex');
    if (!cachedIndex) return;
    try {
      const ids: string[] = JSON.parse(cachedIndex);
      setPhotos(prev => prev.map(photo => {
        if (!ids.includes(photo.id)) return photo;
        const cached = sessionStorage.getItem(`inspectionPhoto_${photo.id}`);
        if (!cached) return photo;
        try {
          const { name, type, data } = JSON.parse(cached);
          const byteString = atob(data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
          const file = new File([ab], name, { type });
          const preview = `data:${type};base64,${data}`;
          return { ...photo, file, preview };
        } catch (e) { return photo; }
      }));
    } catch (e) { console.error('Error restaurando fotos inspección:', e); }
  }, []);

  // Track first incomplete photo
  useEffect(() => {
    const firstPendingIndex = photos.findIndex(p => !p.file);
    setCurrentPendingIndex(firstPendingIndex >= 0 ? firstPendingIndex : photos.length);
  }, [photos]);

  // Open camera for a given photo
  const handlePhotoCapture = (photoId: string) => {
    setActiveCameraId(photoId);
  };

  // Called by CameraCapture when the user takes a photo
  const handleCaptureComplete = async (file: File, photoId: string) => {
    setActiveCameraId(null);

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB');
      return;
    }

    const preview = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setPhotos(prev => prev.map(photo =>
      photo.id === photoId ? { ...photo, file, preview } : photo
    ));

    // Cache in sessionStorage
    try {
      const base64 = preview.split(',')[1];
      sessionStorage.setItem(
        `inspectionPhoto_${photoId}`,
        JSON.stringify({ name: file.name, type: file.type, data: base64 })
      );
      const existingIndex = JSON.parse(sessionStorage.getItem('inspectionPhotosIndex') || '[]');
      if (!existingIndex.includes(photoId)) existingIndex.push(photoId);
      sessionStorage.setItem('inspectionPhotosIndex', JSON.stringify(existingIndex));
    } catch (e) { console.warn('No se pudo cachear foto de inspección:', e); }

    const photoLabel = photos.find(p => p.id === photoId)?.label;
    toast.success(`Foto de ${photoLabel} capturada`);
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.map(photo =>
      photo.id === photoId ? { ...photo, file: undefined, preview: undefined } : photo
    ));
    try {
      sessionStorage.removeItem(`inspectionPhoto_${photoId}`);
      const existingIndex = JSON.parse(sessionStorage.getItem('inspectionPhotosIndex') || '[]');
      sessionStorage.setItem(
        'inspectionPhotosIndex',
        JSON.stringify(existingIndex.filter((id: string) => id !== photoId))
      );
    } catch (e) { /* ignore */ }
    const photoLabel = photos.find(p => p.id === photoId)?.label;
    toast.info(`Foto de ${photoLabel} eliminada`);
  };

  const handleSubmit = () => {
    const missingPhotos = photos.filter(p => !p.file);
    if (missingPhotos.length > 0) {
      toast.error(`Faltan ${missingPhotos.length} foto(s) por capturar`);
      return;
    }
    const data: VehicleInspectionData = {
      frontalFile:    photos.find(p => p.id === 'frontal')?.file,
      traseraFile:    photos.find(p => p.id === 'trasera')?.file,
      lateralIzqFile: photos.find(p => p.id === 'lateral-izq')?.file,
      lateralDerFile: photos.find(p => p.id === 'lateral-der')?.file,
      motorFile:      photos.find(p => p.id === 'motor')?.file,
      tableroFile:    photos.find(p => p.id === 'tablero')?.file,
      vinFile:        photos.find(p => p.id === 'vin')?.file,
    };
    onComplete(data);
    toast.success('Inspección vehicular completada');
  };

  const completedCount = photos.filter(p => p.file).length;
  const totalCount = photos.length;
  const progressPercent = (completedCount / totalCount) * 100;

  const photosOnCar  = photos.filter(p => p.position === 'on-car');
  const photosBelowCar = photos.filter(p => p.position === 'below-car');

  // Active camera photo object
  const activeCameraPhoto = activeCameraId ? photos.find(p => p.id === activeCameraId) : null;

  // ── Inspection button on the car SVG ─────────────────────────────
  const InspectionButton = ({ photo, index }: { photo: InspectionPhoto; index: number }) => {
    const isComplete = !!photo.file;
    const isPending  = index === currentPendingIndex;
    const isLocked   = index > currentPendingIndex;

    return (
      <button
        onClick={() => { if (!isLocked) handlePhotoCapture(photo.id); }}
        disabled={isLocked}
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 font-bold text-sm
          transition-all duration-300 shadow-lg
          ${isComplete
            ? 'bg-[#8AAA19] border-white text-white scale-100'
            : isPending
              ? 'bg-amber-500 border-white text-white animate-pulseRing'
              : isLocked
                ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-amber-500 border-white text-white hover:scale-110'
          }`}
        type="button"
      >
        {isComplete
          ? <FaCheck className="w-full h-full p-3" />
          : <FaCamera className="w-full h-full p-3" />
        }
      </button>
    );
  };

  // ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <FaCamera className="text-[#010139] text-2xl" />
        <div>
          <h4 className="text-xl font-bold text-[#010139]">Inspección del Vehículo</h4>
          <p className="text-sm text-gray-600">
            Toma fotos de las partes indicadas ({completedCount} / {totalCount} completadas)
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-700">Progreso de Inspección</span>
          <span className="font-bold text-[#8AAA19]">{completedCount} / {totalCount}</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Car diagram + buttons */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
        <h5 className="text-lg font-bold text-[#010139] mb-4 text-center">
          🚗 Vistas del Vehículo
        </h5>

        <div className="relative max-w-md mx-auto" style={{ aspectRatio: '200/350' }}>
          {/* Car SVG */}
          <svg viewBox="0 0 200 350" className="w-full h-full">
            <rect x="30" y="80" width="140" height="240" rx="25"
              fill="#e5e7eb" stroke="#4b5563" strokeWidth="3"/>
            <rect x="45" y="95" width="110" height="35" rx="8"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="35" y="145" width="15" height="50" rx="3"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="150" y="145" width="15" height="50" rx="3"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="35" y="215" width="15" height="50" rx="3"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="150" y="215" width="15" height="50" rx="3"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="45" y="275" width="110" height="35" rx="8"
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <ellipse cx="100" cy="110" rx="35" ry="15"
              fill="#d1d5db" stroke="#4b5563" strokeWidth="2"/>
          </svg>

          {/* Frontal — top */}
          {photosOnCar[0] && (
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[0]} index={0} />
            </div>
          )}
          {/* Lateral izquierdo — left */}
          {photosOnCar[2] && (
            <div className="absolute top-1/2 left-[-8%] -translate-y-1/2">
              <InspectionButton photo={photosOnCar[2]} index={2} />
            </div>
          )}
          {/* Lateral derecho — right */}
          {photosOnCar[3] && (
            <div className="absolute top-1/2 right-[-8%] -translate-y-1/2">
              <InspectionButton photo={photosOnCar[3]} index={3} />
            </div>
          )}
          {/* Motor — on hood */}
          {photosOnCar[4] && (
            <div className="absolute top-[28%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[4]} index={4} />
            </div>
          )}
          {/* Tablero — center */}
          {photosOnCar[5] && (
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[5]} index={5} />
            </div>
          )}
          {/* Trasera — bottom */}
          {photosOnCar[1] && (
            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[1]} index={1} />
            </div>
          )}
        </div>
      </div>

      {/* Photos below car (VIN, etc.) */}
      {photosBelowCar.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-base font-bold text-gray-700">📋 Fotos Adicionales</h5>

          {photosBelowCar.map((photo) => {
            const globalIndex = 6; // VIN is photo #7 (index 6)
            const isComplete = !!photo.file;
            const isPending  = globalIndex === currentPendingIndex;
            const isLocked   = globalIndex > currentPendingIndex;

            return (
              <div
                key={photo.id}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  isComplete
                    ? 'border-[#8AAA19] bg-green-50'
                    : isPending
                      ? 'border-amber-400 bg-amber-50 animate-pulseRingCard'
                      : isLocked
                        ? 'border-gray-300 bg-gray-50 opacity-50'
                        : 'border-amber-400 bg-amber-50'
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {isComplete ? (
                      <div className="w-10 h-10 rounded-full bg-[#8AAA19] flex items-center justify-center">
                        <FaCheck className="text-white text-lg" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                        <FaCamera className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h6 className="font-bold text-gray-900 mb-3">{photo.label}</h6>

                    {photo.preview ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.preview}
                          alt={photo.label}
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                        />
                        <button
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          type="button"
                        >
                          <FaTimes size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => !isLocked && handlePhotoCapture(photo.id)}
                        disabled={isLocked}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold
                          transition-colors ${
                          isLocked
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#8AAA19] text-white hover:bg-[#6d8814]'
                        }`}
                        type="button"
                      >
                        <FaCamera />
                        <span className="text-sm">Tomar Foto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Missing photos alert */}
      {completedCount < totalCount && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationTriangle className="text-amber-600 text-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Faltan {totalCount - completedCount} foto(s) por capturar
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Las fotos deben tomarse en orden secuencial. Completa la foto actual antes de continuar.
            </p>
          </div>
        </div>
      )}

      {/* Continue button */}
      <div className="pt-6 border-t-2 border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={completedCount < totalCount}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
            completedCount === totalCount
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="button"
        >
          {completedCount === totalCount
            ? 'Guardar y Continuar →'
            : `Completa las ${totalCount - completedCount} foto(s) faltantes`}
        </button>
      </div>

      {/* ── CameraCapture modal ───────────────────── */}
      {activeCameraPhoto && (
        <Suspense fallback={null}>
          <CameraCapture
            label={activeCameraPhoto.label}
            instructions={activeCameraPhoto.instructions}
            photoId={activeCameraPhoto.id}
            onCapture={handleCaptureComplete}
            onClose={() => setActiveCameraId(null)}
          />
        </Suspense>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulseRing {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(245,158,11,0.75), 0 0 0 0 rgba(245,158,11,0.4); }
          60%  { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(245,158,11,0.08), 0 0 0 22px rgba(245,158,11,0); }
          100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(245,158,11,0.75), 0 0 0 0 rgba(245,158,11,0.4); }
        }
        .animate-pulseRing { animation: pulseRing 1.4s ease-out infinite; }

        @keyframes pulseRingCard {
          0%, 100% { border-color: rgb(251,191,36); box-shadow: 0 0 0 0 rgba(251,191,36,0.5); }
          50%       { border-color: rgb(245,158,11); box-shadow: 0 0 0 6px rgba(251,191,36,0); }
        }
        .animate-pulseRingCard { animation: pulseRingCard 1.4s ease-out infinite; }
      `}</style>
    </div>
  );
}
