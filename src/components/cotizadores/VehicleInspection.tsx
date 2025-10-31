/**
 * Inspección Vehicular con Vista Superior
 * 10 puntos de foto para inspección completa
 */

'use client';

import { useState } from 'react';
import { FaCamera, FaCheck, FaUpload } from 'react-icons/fa';
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
  const [photos, setPhotos] = useState<InspectionPhoto[]>([
    { id: 'frontal', name: 'Vista Frontal' },
    { id: 'trasera', name: 'Vista Trasera' },
    { id: 'lateral-izq', name: 'Lateral Izquierdo' },
    { id: 'lateral-der', name: 'Lateral Derecho' },
    { id: 'registro', name: 'Registro Vehicular' },
    { id: 'motor', name: 'Motor Abierto' },
    { id: 'asientos', name: 'Asientos' },
    { id: 'kilometraje', name: 'Kilometraje' },
    { id: 'llave', name: 'Llave del Vehículo' },
    { id: 'tablero', name: 'Tablero' },
  ]);

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

      {/* Vista Superior del Auto */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4 text-center">
          🚗 Vistas del Vehículo
        </h3>
        
        <div className="relative max-w-sm mx-auto mb-6">
          {/* SVG Vista Superior del Auto */}
          <svg viewBox="0 0 200 300" className="w-full h-auto">
            {/* Cuerpo del auto */}
            <rect x="40" y="50" width="120" height="200" rx="20" fill="#e5e7eb" stroke="#4b5563" strokeWidth="2"/>
            
            {/* Parabrisas frontal */}
            <rect x="50" y="60" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Ventanas laterales */}
            <rect x="45" y="100" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="145" y="100" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="45" y="160" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            <rect x="145" y="160" width="10" height="40" rx="2" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Parabrisas trasero */}
            <rect x="50" y="210" width="100" height="30" rx="5" fill="#93c5fd" stroke="#4b5563" strokeWidth="1"/>
            
            {/* Puntos de captura */}
            {/* Frontal */}
            <circle cx="100" cy="40" r="15" fill={photos[0]?.file ? '#8AAA19' : '#f59e0b'} stroke="#fff" strokeWidth="2"/>
            <text x="100" y="45" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">F</text>
            
            {/* Trasera */}
            <circle cx="100" cy="260" r="15" fill={photos[1]?.file ? '#8AAA19' : '#f59e0b'} stroke="#fff" strokeWidth="2"/>
            <text x="100" y="265" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">T</text>
            
            {/* Lateral Izquierdo */}
            <circle cx="20" cy="150" r="15" fill={photos[2]?.file ? '#8AAA19' : '#f59e0b'} stroke="#fff" strokeWidth="2"/>
            <text x="20" y="155" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">LI</text>
            
            {/* Lateral Derecho */}
            <circle cx="180" cy="150" r="15" fill={photos[3]?.file ? '#8AAA19' : '#f59e0b'} stroke="#fff" strokeWidth="2"/>
            <text x="180" y="155" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">LD</text>
          </svg>
        </div>

        {/* Grid de Fotos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => handlePhotoCapture(photo.id)}
              className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${
                photo.file 
                  ? 'border-[#8AAA19] bg-green-50' 
                  : 'border-gray-300 hover:border-[#8AAA19] bg-gray-50'
              }`}
              type="button"
            >
              {photo.preview ? (
                <>
                  <img 
                    src={photo.preview} 
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 bg-[#8AAA19] text-white rounded-full p-1">
                    <FaCheck size={12} />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-2">
                  <FaCamera className="text-2xl text-gray-400 mb-1" />
                  <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">
                    {photo.name}
                  </span>
                </div>
              )}
            </button>
          ))}
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
