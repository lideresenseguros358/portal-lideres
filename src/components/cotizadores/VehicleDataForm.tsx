/**
 * Formulario Datos del Vehículo - Paso 3 Wizard Emisión
 * Solicita registro vehicular (foto/documento)
 * Mobile-first con inputs iOS-friendly
 */

'use client';

import { useState } from 'react';
import { FaCar, FaCamera, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface VehicleDataFormProps {
  quoteData: any;
  onContinue: (vehicleData: VehicleData) => void;
}

export interface VehicleData {
  registroVehicular: File | null;
  registroVehicularUrl?: string;
  notas?: string;
}

export default function VehicleDataForm({ quoteData, onContinue }: VehicleDataFormProps) {
  const router = useRouter();
  const [registroVehicular, setRegistroVehicular] = useState<File | null>(null);
  const [registroPreview, setRegistroPreview] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegistroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe superar 5MB');
      return;
    }

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WEBP) o PDF');
      return;
    }

    setRegistroVehicular(file);

    // Preview solo para imágenes
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegistroPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setRegistroPreview('');
    }

    toast.success('Documento cargado correctamente');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registroVehicular) {
      toast.error('Debe adjuntar el registro vehicular');
      return;
    }

    setIsSubmitting(true);

    try {
      // En producción, aquí subirías el archivo a storage
      // Por ahora simulamos delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const vehicleData: VehicleData = {
        registroVehicular,
        notas,
      };

      onContinue(vehicleData);
    } catch (error) {
      console.error('Error guardando datos vehículo:', error);
      toast.error('Error al guardar datos');
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push('/cotizadores/emitir?step=emission-data');
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#8AAA19] to-[#6d8814] mb-4">
          <FaCar className="text-white text-3xl" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
          Datos del Vehículo
        </h2>
        <p className="text-sm sm:text-base text-gray-600">
          Adjunta el registro vehicular para continuar
        </p>
      </div>

      {/* Datos Precargados del Vehículo */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Información del Vehículo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Marca</label>
            <div className="text-base font-medium text-gray-800">{quoteData.marca || 'N/A'}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Modelo</label>
            <div className="text-base font-medium text-gray-800">{quoteData.modelo || 'N/A'}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Año</label>
            <div className="text-base font-medium text-gray-800">{quoteData.anio || 'N/A'}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Valor Asegurado</label>
            <div className="text-base font-medium text-gray-800">
              ${quoteData.valorVehiculo?.toLocaleString('en-US') || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Registro Vehicular */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <label className="block text-base font-bold text-gray-800 mb-4">
            Registro Vehicular <span className="text-red-500">*</span>
          </label>
          
          <div className="space-y-4">
            {/* Botón Upload o Cámara */}
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleRegistroChange}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors text-base">
                  <FaCamera className="text-white text-lg" />
                  Subir Documento
                </div>
              </label>
            </div>

            {/* Preview */}
            {registroPreview && (
              <div className="mt-4">
                <img 
                  src={registroPreview} 
                  alt="Preview registro vehicular"
                  className="w-full max-w-md mx-auto rounded-lg border-2 border-gray-300 shadow-md"
                />
              </div>
            )}

            {/* Archivo cargado (PDF) */}
            {registroVehicular && !registroPreview && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{registroVehicular.name}</p>
                    <p className="text-xs text-gray-600">
                      {(registroVehicular.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegistroVehicular(null);
                      setRegistroPreview('');
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-semibold"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Formatos aceptados: JPG, PNG, WEBP, PDF (máx. 5MB)
            </p>
          </div>
        </div>

        {/* Notas Adicionales (Opcional) */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <label className="block text-base font-bold text-gray-800 mb-4">
            Notas Adicionales <span className="text-gray-400 text-sm">(Opcional)</span>
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Ej: Vehículo tiene modificaciones, cambios de color, etc."
            className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Botones de Navegación */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 sm:flex-initial px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <FaArrowLeft />
            Volver
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !registroVehicular}
            className={`flex-1 px-8 py-3 rounded-lg font-bold text-base transition-all flex items-center justify-center gap-2 ${
              isSubmitting || !registroVehicular
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-xl'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </>
            ) : (
              <>
                Continuar
                <FaArrowRight className="text-white" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
