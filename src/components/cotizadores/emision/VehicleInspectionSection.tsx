/**
 * Sección: Inspección Vehicular - ESTILO ASSA
 * Dibujo auto GRANDE + botones interactivos sobre el dibujo
 * Tooltips guiados, parpadeo secuencial
 */

'use client';

import { useState, useEffect } from 'react';
import { FaCamera, FaCheck, FaExclamationTriangle, FaTimes, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'sonner';

interface InspectionPhoto {
  id: string;
  name: string;
  label: string;
  tooltip: string;
  position: 'on-car' | 'below-car'; // Si va sobre el dibujo o en lista
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
      tooltip: 'Toma una foto de la vista frontal completa del vehículo. Debe verse el frente del auto claramente.',
      position: 'on-car',
    },
    {
      id: 'trasera',
      name: 'trasera',
      label: 'Parte Trasera',
      tooltip: 'Toma una foto de la vista trasera completa del vehículo. Debe verse la placa y la parte trasera.',
      position: 'on-car',
    },
    {
      id: 'lateral-izq',
      name: 'lateralIzq',
      label: 'Lateral Izquierdo',
      tooltip: 'Toma una foto del lado izquierdo completo del vehículo. Debe verse toda la carrocería lateral.',
      position: 'on-car',
    },
    {
      id: 'lateral-der',
      name: 'lateralDer',
      label: 'Lateral Derecho',
      tooltip: 'Toma una foto del lado derecho completo del vehículo. Debe verse toda la carrocería lateral.',
      position: 'on-car',
    },
    {
      id: 'motor',
      name: 'motor',
      label: 'Parte Motor',
      tooltip: 'Abre el capó y toma una foto del compartimiento del motor. Debe verse claramente el motor.',
      position: 'on-car',
    },
    {
      id: 'tablero',
      name: 'tablero',
      label: 'Parte Tablero',
      tooltip: 'Toma una foto del tablero donde se vea claramente el kilometraje del vehículo.',
      position: 'on-car',
    },
    {
      id: 'vin',
      name: 'vin',
      label: 'VIN o Chasis',
      tooltip: 'Generalmente se encuentra debajo de la puerta del conductor o dentro del compartimiento del motor, justo detrás del mismo. El número VIN/Chasis debe leerse claramente para validar el vehículo.',
      position: 'below-car',
    },
  ]);

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);

  // Determinar índice del pendiente actual
  useEffect(() => {
    const firstPendingIndex = photos.findIndex(p => !p.file);
    setCurrentPendingIndex(firstPendingIndex >= 0 ? firstPendingIndex : photos.length);
  }, [photos]);

  const handlePhotoCapture = async (photoId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment' as any;
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen debe ser menor a 5MB');
        return;
      }

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        return;
      }

      // Crear preview
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Actualizar foto
      setPhotos(prev => prev.map(photo => 
        photo.id === photoId ? { ...photo, file, preview } : photo
      ));

      const photoLabel = photos.find(p => p.id === photoId)?.label;
      toast.success(`Foto de ${photoLabel} capturada`);
    };
    
    input.click();
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.map(photo => 
      photo.id === photoId ? { ...photo, file: undefined, preview: undefined } : photo
    ));
    
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
      frontalFile: photos.find(p => p.id === 'frontal')?.file,
      traseraFile: photos.find(p => p.id === 'trasera')?.file,
      lateralIzqFile: photos.find(p => p.id === 'lateral-izq')?.file,
      lateralDerFile: photos.find(p => p.id === 'lateral-der')?.file,
      motorFile: photos.find(p => p.id === 'motor')?.file,
      tableroFile: photos.find(p => p.id === 'tablero')?.file,
      vinFile: photos.find(p => p.id === 'vin')?.file,
    };

    onComplete(data);
    toast.success('Inspección vehicular completada');
  };

  const completedCount = photos.filter(p => p.file).length;
  const totalCount = photos.length;
  const progressPercent = (completedCount / totalCount) * 100;

  // Fotos sobre el auto vs. debajo
  const photosOnCar = photos.filter(p => p.position === 'on-car');
  const photosBelowCar = photos.filter(p => p.position === 'below-car');

  // Botón de inspección sobre el auto
  const InspectionButton = ({ photo, index }: { photo: InspectionPhoto; index: number }) => {
    const isComplete = !!photo.file;
    const isPending = index === currentPendingIndex;
    const isLocked = index > currentPendingIndex;

    return (
      <div className="relative group">
        <button
          onClick={() => !isLocked && handlePhotoCapture(photo.id)}
          onMouseEnter={() => setActiveTooltip(photo.id)}
          onMouseLeave={() => setActiveTooltip(null)}
          disabled={isLocked}
          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 font-bold text-sm
            transition-all duration-300 shadow-lg
            ${isComplete 
              ? 'bg-[#8AAA19] border-white text-white scale-100' 
              : isPending
                ? 'bg-amber-500 border-white text-white animate-pulseSoft'
                : isLocked
                  ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-amber-500 border-white text-white hover:scale-110'
            }`}
          type="button"
        >
          {isComplete ? (
            <FaCheck className="w-full h-full p-3" />
          ) : (
            <FaCamera className="w-full h-full p-3" />
          )}
        </button>

        {/* Tooltip (desktop hover / mobile tap) */}
        {(activeTooltip === photo.id || isPending) && !isComplete && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 
            bg-gray-900 text-white text-xs rounded-lg p-3 shadow-2xl
            pointer-events-none"
          >
            <div className="font-bold mb-1">{photo.label}</div>
            <div className="text-gray-300">{photo.tooltip}</div>
            {/* Flecha */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
              border-8 border-transparent border-t-gray-900"
            />
          </div>
        )}
      </div>
    );
  };

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

      {/* DIBUJO AUTO GRANDE + BOTONES */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6">
        <h5 className="text-lg font-bold text-[#010139] mb-4 text-center">
          🚗 Vistas del Vehículo
        </h5>
        
        {/* SVG Auto + Botones posicionados */}
        <div className="relative max-w-md mx-auto" style={{ aspectRatio: '200/350' }}>
          {/* SVG del auto (MÁS GRANDE) */}
          <svg viewBox="0 0 200 350" className="w-full h-full">
            {/* Cuerpo del auto */}
            <rect x="30" y="80" width="140" height="240" rx="25" 
              fill="#e5e7eb" stroke="#4b5563" strokeWidth="3"/>
            
            {/* Parabrisas frontal */}
            <rect x="45" y="95" width="110" height="35" rx="8" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Ventanas laterales */}
            <rect x="35" y="145" width="15" height="50" rx="3" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="150" y="145" width="15" height="50" rx="3" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="35" y="215" width="15" height="50" rx="3" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            <rect x="150" y="215" width="15" height="50" rx="3" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Parabrisas trasero */}
            <rect x="45" y="275" width="110" height="35" rx="8" 
              fill="#93c5fd" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Capó (para motor) */}
            <ellipse cx="100" cy="110" rx="35" ry="15" 
              fill="#d1d5db" stroke="#4b5563" strokeWidth="2"/>
          </svg>

          {/* BOTONES POSICIONADOS SOBRE EL AUTO */}
          
          {/* Frontal - Arriba */}
          {photosOnCar[0] && (
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[0]} index={0} />
            </div>
          )}

          {/* Lateral Izquierdo - Izquierda */}
          {photosOnCar[2] && (
            <div className="absolute top-1/2 left-[-8%] -translate-y-1/2">
              <InspectionButton photo={photosOnCar[2]} index={2} />
            </div>
          )}

          {/* Lateral Derecho - Derecha */}
          {photosOnCar[3] && (
            <div className="absolute top-1/2 right-[-8%] -translate-y-1/2">
              <InspectionButton photo={photosOnCar[3]} index={3} />
            </div>
          )}

          {/* Motor - En el capó */}
          {photosOnCar[4] && (
            <div className="absolute top-[28%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[4]} index={4} />
            </div>
          )}

          {/* Tablero - Centro del auto */}
          {photosOnCar[5] && (
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[5]} index={5} />
            </div>
          )}

          {/* Trasera - Abajo */}
          {photosOnCar[1] && (
            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2">
              <InspectionButton photo={photosOnCar[1]} index={1} />
            </div>
          )}
        </div>
      </div>

      {/* FOTOS FUERA DEL AUTO (Lista debajo) */}
      {photosBelowCar.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-base font-bold text-gray-700">📋 Fotos Adicionales</h5>
          
          {photosBelowCar.map((photo, idx) => {
            const globalIndex = 6; // VIN es la foto 7 (index 6)
            const isComplete = !!photo.file;
            const isPending = globalIndex === currentPendingIndex;
            const isLocked = globalIndex > currentPendingIndex;

            return (
              <div
                key={photo.id}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  isComplete
                    ? 'border-[#8AAA19] bg-green-50'
                    : isPending
                      ? 'border-amber-400 bg-amber-50 animate-pulseSoft'
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
                    <h6 className="font-bold text-gray-900 mb-1">{photo.label}</h6>
                    
                    {/* Tooltip info */}
                    <div className="flex items-start gap-2 mb-3">
                      <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {photo.tooltip}
                      </p>
                    </div>

                    {/* Preview o botón */}
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

      {/* Alerta si faltan fotos */}
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

      {/* Botón Continuar */}
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

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulseSoft {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1); 
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.08); 
          }
        }
        .animate-pulseSoft {
          animation: pulseSoft 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
