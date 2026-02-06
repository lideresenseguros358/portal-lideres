/**
 * Inspección Vehicular con Vista Superior
 * 9 puntos de foto para inspección completa (sin registro vehicular)
 */

'use client';

import { useState, useEffect } from 'react';
import { FaCamera, FaCheck } from 'react-icons/fa';
import { toast } from 'sonner';

interface InspectionPhoto {
  id: string;
  name: string;
  file?: File;
  preview?: string;
}

interface VehicleInspectionProps {
  onContinue: (photos: InspectionPhoto[]) => void;
}

export default function VehicleInspection({ onContinue }: VehicleInspectionProps) {
  // ORDEN DE CAPTURA: F, LI, LD, T, MA, KM, TB, AS, KEY
  const [photos, setPhotos] = useState<InspectionPhoto[]>([
    { id: 'frontal', name: 'Vista Frontal' },
    { id: 'lateral-izq', name: 'Lateral Izquierdo' },
    { id: 'lateral-der', name: 'Lateral Derecho' },
    { id: 'trasera', name: 'Vista Trasera' },
    { id: 'motor', name: 'Motor Abierto' },
    { id: 'kilometraje', name: 'Kilometraje' },
    { id: 'tablero', name: 'Tablero' },
    { id: 'asientos', name: 'Asientos' },
    { id: 'llave', name: 'Llave del Vehículo' },
  ]);
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState<number>(0);

  // Descripciones para tooltips
  const photoDescriptions: Record<string, string> = {
    'frontal': 'Toma una foto del frente del vehículo',
    'lateral-izq': 'Toma una foto del lado izquierdo completo',
    'lateral-der': 'Toma una foto del lado derecho completo',
    'trasera': 'Toma una foto de la parte trasera del vehículo',
    'motor': 'Abre el capó y toma foto del motor',
    'kilometraje': 'Toma foto del odometro mostrando los kilómetros',
    'tablero': 'Toma foto del tablero de instrumentos encendido',
    'asientos': 'Toma foto del interior mostrando los asientos',
    'llave': 'Toma foto de las llaves del vehículo',
  };

  // Animación de parpadeo secuencial
  useEffect(() => {
    const nextIncompleteIndex = photos.findIndex(p => !p.file);
    if (nextIncompleteIndex !== -1) {
      setCurrentHighlight(nextIncompleteIndex);
    }
  }, [photos]);

  const handlePhotoCapture = async (photoId: string) => {
    try {
      // En mobile, capturar con cámara
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment' as any;
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen debe ser menor a 5MB');
            return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
            setPhotos(prev => prev.map(photo => 
              photo.id === photoId 
                ? { ...photo, file, preview: reader.result as string }
                : photo
            ));
            toast.success(`Foto de ${photos.find(p => p.id === photoId)?.name} capturada`);
          };
          reader.readAsDataURL(file);
        }
      };
      
      input.click();
    } catch (error) {
      console.error('Error capturando foto:', error);
      toast.error('Error al capturar la foto');
    }
  };

  const handleSubmit = () => {
    const missingPhotos = photos.filter(p => !p.file);
    
    if (missingPhotos.length > 0) {
      toast.error(`Faltan ${missingPhotos.length} foto(s) por capturar`);
      return;
    }
    
    onContinue(photos);
  };

  const completedCount = photos.filter(p => p.file).length;
  const progressPercent = (completedCount / photos.length) * 100;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
          Inspección del Vehículo
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Toma fotos de las siguientes partes del vehículo
        </p>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progreso</span>
            <span className="font-bold">{completedCount} / {photos.length}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vista Superior del Auto con Botónes Interactivos */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4 text-center">
          🚗 Puntos de Inspección del Vehículo
        </h3>
        
        <div className="relative max-w-md mx-auto">
          {/* SVG Vista Superior del Auto */}
          <svg viewBox="0 0 240 400" className="w-full h-auto">
            {/* Definir animación de parpadeo */}
            <defs>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.4; }
                }
                .pulse-active {
                  animation: pulse 1.5s ease-in-out infinite;
                }
              `}</style>
            </defs>
            
            {/* Cuerpo del auto */}
            <rect x="60" y="90" width="120" height="200" rx="20" fill="#e5e7eb" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Parabrisas frontal */}
            <rect x="70" y="100" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Ventanas laterales */}
            <rect x="65" y="140" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="165" y="140" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="65" y="200" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="165" y="200" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Parabrisas trasero */}
            <rect x="70" y="250" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Botón F - Frontal */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('frontal')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="120" 
                cy="70" 
                r="18" 
                fill={photos[0]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 0 && !photos[0]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('frontal')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="76" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>F</text>
            </g>
            
            {/* Botón LI - Lateral Izquierdo */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('lateral-izq')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="30" 
                cy="190" 
                r="18" 
                fill={photos[1]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 1 && !photos[1]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('lateral-izq')}
                style={{ cursor: 'pointer' }}
              />
              <text x="30" y="196" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none' }}>LI</text>
            </g>
            
            {/* Botón LD - Lateral Derecho */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('lateral-der')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="210" 
                cy="190" 
                r="18" 
                fill={photos[2]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 2 && !photos[2]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('lateral-der')}
                style={{ cursor: 'pointer' }}
              />
              <text x="210" y="196" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" style={{ pointerEvents: 'none' }}>LD</text>
            </g>
            
            {/* Botón T - Trasera */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('trasera')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="120" 
                cy="310" 
                r="18" 
                fill={photos[3]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 3 && !photos[3]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('trasera')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="316" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none' }}>T</text>
            </g>
            
            {/* Botón MA - Motor Abierto (debajo de F) */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('motor')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="120" 
                cy="115" 
                r="16" 
                fill={photos[4]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 4 && !photos[4]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('motor')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="121" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>MA</text>
            </g>
            
            {/* Botón KM - Kilometraje (izquierda, debajo de MA) */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('kilometraje')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="90" 
                cy="155" 
                r="16" 
                fill={photos[5]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 5 && !photos[5]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('kilometraje')}
                style={{ cursor: 'pointer' }}
              />
              <text x="90" y="161" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>KM</text>
            </g>
            
            {/* Botón TB - Tablero (derecha, debajo de MA) */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('tablero')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="150" 
                cy="155" 
                r="16" 
                fill={photos[6]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 6 && !photos[6]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('tablero')}
                style={{ cursor: 'pointer' }}
              />
              <text x="150" y="161" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>TB</text>
            </g>
            
            {/* Botón AS - Asientos (centro) */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('asientos')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="120" 
                cy="190" 
                r="16" 
                fill={photos[7]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 7 && !photos[7]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('asientos')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="196" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" style={{ pointerEvents: 'none' }}>AS</text>
            </g>
            
            {/* Botón KEY - Llaves (debajo de AS) */}
            <g className="cursor-pointer" onMouseEnter={() => setActiveTooltip('llave')} onMouseLeave={() => setActiveTooltip(null)}>
              <circle 
                cx="120" 
                cy="235" 
                r="16" 
                fill={photos[8]?.file ? '#10b981' : '#3b82f6'} 
                stroke="#fff" 
                strokeWidth="3"
                className={currentHighlight === 8 && !photos[8]?.file ? 'pulse-active' : ''}
                onClick={() => handlePhotoCapture('llave')}
                style={{ cursor: 'pointer' }}
              />
              <text x="120" y="241" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>KEY</text>
            </g>
          </svg>
          
          {/* Tooltip */}
          {activeTooltip && (
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 z-10">
              <div className="bg-[#010139] text-white px-4 py-2 rounded-lg shadow-xl text-sm font-semibold whitespace-nowrap">
                {photoDescriptions[activeTooltip]}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                  <div className="border-8 border-transparent border-t-[#010139]"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Leyenda */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Completada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-gray-600">Siguiente sugerida</span>
          </div>
        </div>
      </div>

      {/* Botón Continuar */}
      <div className="space-y-3">
        {completedCount < photos.length && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-800">
              ⚠️ Faltan <span className="font-bold">{photos.length - completedCount}</span> foto(s) por capturar
            </p>
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={completedCount < photos.length}
          className={`w-full px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
            completedCount === photos.length
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="button"
        >
          {completedCount === photos.length 
            ? 'Continuar a Información de Pago →' 
            : 'Completa todas las fotos'}
        </button>
      </div>
    </div>
  );
}
