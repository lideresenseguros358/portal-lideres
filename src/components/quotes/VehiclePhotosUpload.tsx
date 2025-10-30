'use client';

import { useState } from 'react';
import { FaCamera, FaCheckCircle, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';

interface PhotoSlot {
  id: string;
  label: string;
  description: string;
  file: File | null;
  preview: string | null;
  required: boolean;
}

interface VehiclePhotosUploadProps {
  onPhotosChange: (photos: { [key: string]: File }) => void;
  readOnly?: boolean;
}

const REQUIRED_PHOTOS = [
  {
    id: 'frontal',
    label: 'Foto Frontal',
    description: 'Vista completa frontal del vehículo',
    required: true,
  },
  {
    id: 'trasera',
    label: 'Foto Trasera',
    description: 'Vista completa trasera del vehículo',
    required: true,
  },
  {
    id: 'lateral_izquierda',
    label: 'Foto Lateral Izquierda',
    description: 'Vista lateral completa del lado izquierdo',
    required: true,
  },
  {
    id: 'lateral_derecha',
    label: 'Foto Lateral Derecha',
    description: 'Vista lateral completa del lado derecho',
    required: true,
  },
  {
    id: 'tablero',
    label: 'Foto del Tablero',
    description: 'Vista del tablero mostrando kilometraje',
    required: true,
  },
  {
    id: 'serial_motor',
    label: 'Foto Serial del Motor',
    description: 'Número de serial del motor visible',
    required: true,
  },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export default function VehiclePhotosUpload({ onPhotosChange, readOnly = false }: VehiclePhotosUploadProps) {
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    REQUIRED_PHOTOS.map(photo => ({
      ...photo,
      file: null,
      preview: null,
    }))
  );

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WebP');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('La imagen no debe superar 5MB');
      return false;
    }

    return true;
  };

  const handleFileSelect = (photoId: string, file: File) => {
    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos(prev => {
        const updated = prev.map(photo =>
          photo.id === photoId
            ? { ...photo, file, preview: reader.result as string }
            : photo
        );

        // Notify parent component
        const photosMap: { [key: string]: File } = {};
        updated.forEach(p => {
          if (p.file) photosMap[p.id] = p.file;
        });
        onPhotosChange(photosMap);

        return updated;
      });

      toast.success('Foto cargada correctamente');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => {
      const updated = prev.map(photo =>
        photo.id === photoId
          ? { ...photo, file: null, preview: null }
          : photo
      );

      // Notify parent component
      const photosMap: { [key: string]: File } = {};
      updated.forEach(p => {
        if (p.file) photosMap[p.id] = p.file;
      });
      onPhotosChange(photosMap);

      return updated;
    });

    toast.info('Foto eliminada');
  };

  const getCompletionPercentage = () => {
    const uploaded = photos.filter(p => p.file !== null).length;
    return Math.round((uploaded / photos.length) * 100);
  };

  const allPhotosUploaded = photos.every(p => p.file !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-[#010139]">
              Fotos del Vehículo
            </h3>
            <p className="text-sm text-gray-600">
              Todas las fotos son obligatorias para procesar tu solicitud
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#010139]">
              {photos.filter(p => p.file).length} / {photos.length}
            </div>
            <div className="text-xs text-gray-600">completadas</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#010139] via-[#020270] to-[#8AAA19] transition-all duration-500 rounded-full"
            style={{ width: `${getCompletionPercentage()}%` }}
          >
            {getCompletionPercentage() > 10 && (
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            )}
          </div>
        </div>

        {/* Completion Status */}
        {allPhotosUploaded && (
          <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-lg p-4 flex items-center gap-3">
            <FaCheckCircle className="text-green-600 flex-shrink-0" size={24} />
            <div>
              <p className="font-semibold text-green-800">
                ¡Todas las fotos han sido cargadas!
              </p>
              <p className="text-sm text-green-600">
                Puedes continuar con el proceso de emisión
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`border-2 rounded-xl overflow-hidden transition-all ${
              photo.file
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-white hover:border-[#8AAA19]'
            }`}
          >
            {/* Photo Header */}
            <div className={`p-4 border-b-2 ${
              photo.file ? 'bg-green-100 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    photo.file ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {photo.file ? <FaCheckCircle /> : index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[#010139]">
                      {photo.label}
                    </h4>
                    {photo.required && (
                      <span className="text-xs text-red-600 font-semibold">* Obligatoria</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">{photo.description}</p>
            </div>

            {/* Photo Preview or Upload */}
            <div className="p-4">
              {photo.preview ? (
                <div className="relative">
                  <img
                    src={photo.preview}
                    alt={photo.label}
                    className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg"
                      title="Eliminar foto"
                    >
                      <FaTimes size={16} />
                    </button>
                  )}
                  <div className="mt-2 text-xs text-gray-600">
                    {photo.file && (
                      <span>
                        {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <label
                  className={`block w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all ${
                    readOnly
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-gray-50 border-gray-300 hover:border-[#8AAA19] hover:bg-green-50 cursor-pointer'
                  }`}
                >
                  <FaCamera className="text-gray-400" size={32} />
                  {!readOnly && (
                    <>
                      <span className="text-sm font-semibold text-gray-700">
                        Click para subir
                      </span>
                      <span className="text-xs text-gray-500">
                        JPG, PNG o WebP (máx. 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(photo.id, file);
                        }}
                        className="hidden"
                        disabled={readOnly}
                      />
                    </>
                  )}
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaExclamationTriangle className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">Consejos para mejores fotos:</p>
            <ul className="space-y-1 text-xs">
              <li>• Toma las fotos en un lugar bien iluminado</li>
              <li>• Asegúrate de que el vehículo esté completo en la imagen</li>
              <li>• Las placas y números de serial deben ser legibles</li>
              <li>• Evita reflejos en el tablero y el parabrisas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
