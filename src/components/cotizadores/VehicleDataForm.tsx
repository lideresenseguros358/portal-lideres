/**
 * Formulario Datos del Vehículo - Paso 3 Wizard Emisión
 * Solicita registro vehicular (foto/documento)
 * Mobile-first con inputs iOS-friendly
 */

'use client';

import { useState, useEffect } from 'react';
import { FaCar, FaCamera, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface VehicleDataFormProps {
  quoteData: any;
  onContinue: (vehicleData: VehicleData) => void;
  isInternacional?: boolean;
}

export interface VehicleData {
  // Campos del vehículo
  placa: string;
  vinChasis: string; // VIN y Chasis en un solo campo (se divide en backend)
  motor: string;
  color: string;
  pasajeros: number;
  puertas: number;
  kilometraje?: string;
  tipoCombustible?: 'GASOLINA' | 'DIESEL';
  tipoTransmision?: 'AUTOMATICO' | 'MANUAL';
  aseguradoAnteriormente?: boolean;
  aseguradoraAnterior?: string;
  registroVehicular: File | null;
  registroVehicularUrl?: string;
  notas?: string;
}

export default function VehicleDataForm({ quoteData, onContinue, isInternacional = false }: VehicleDataFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    placa: '',
    vinChasis: '',
    motor: '',
    color: '',
    pasajeros: 5,
    puertas: 4,
    kilometraje: '',
    tipoCombustible: 'GASOLINA' as 'GASOLINA' | 'DIESEL',
    tipoTransmision: 'AUTOMATICO' as 'AUTOMATICO' | 'MANUAL',
    aseguradoAnteriormente: false,
    aseguradoraAnterior: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registroVehicular, setRegistroVehicular] = useState<File | null>(null);
  const [registroPreview, setRegistroPreview] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [registroFileName, setRegistroFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restaurar datos cacheados al montar
  useEffect(() => {
    const savedData = sessionStorage.getItem('vehicleFormData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed.notas) setNotas(parsed.notas);
      } catch (e) { console.error('Error restaurando datos vehículo:', e); }
    }
    // Restaurar registro vehicular cacheado
    const cachedRegistro = sessionStorage.getItem('vehicleRegistroFile');
    if (cachedRegistro) {
      try {
        const { name, type, data } = JSON.parse(cachedRegistro);
        const byteString = atob(data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const file = new File([ab], name, { type });
        setRegistroVehicular(file);
        setRegistroFileName(name);
        if (type.startsWith('image/')) {
          setRegistroPreview(`data:${type};base64,${data}`);
        }
      } catch (e) { console.error('Error restaurando registro vehicular:', e); }
    }
  }, []);

  // Guardar datos del formulario cuando cambian
  useEffect(() => {
    if (formData.placa || formData.vinChasis || formData.motor) {
      sessionStorage.setItem('vehicleFormData', JSON.stringify({ ...formData, notas }));
    }
  }, [formData, notas]);

  // Helper para cachear archivo como base64
  const cacheFileToStorage = (key: string, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        sessionStorage.setItem(key, JSON.stringify({ name: file.name, type: file.type, data: base64 }));
      } catch (e) {
        console.warn('No se pudo cachear archivo (muy grande):', e);
      }
    };
    reader.readAsDataURL(file);
  };

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
    setRegistroFileName(file.name);
    cacheFileToStorage('vehicleRegistroFile', file);

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.placa) newErrors.placa = 'Requerido';
    if (!formData.vinChasis) newErrors.vinChasis = 'Requerido';
    if (!formData.motor) newErrors.motor = 'Requerido';
    if (!formData.color) newErrors.color = 'Requerido';
    if (!registroVehicular) newErrors.registroVehicular = 'Requerido';
    if (isInternacional && !formData.kilometraje) newErrors.kilometraje = 'Requerido para Internacional';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsSubmitting(true);

    try {
      // En producción, aquí subirías el archivo a storage
      // Por ahora simulamos delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const vehicleData: VehicleData = {
        ...formData,
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
            <div className="text-base font-medium text-gray-800">{quoteData.anno || quoteData.anio || 'N/A'}</div>
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
        {/* Campos del Vehículo */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Datos del Vehículo</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Placa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.placa ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="EJ: ABC-1234"
              />
              {errors.placa && <p className="text-xs text-red-500 mt-1">{errors.placa}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                VIN / Chasis <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vinChasis}
                onChange={(e) => setFormData({ ...formData, vinChasis: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.vinChasis ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="NÚMERO DE IDENTIFICACIÓN VEHÍCULO"
              />
              {errors.vinChasis && <p className="text-xs text-red-500 mt-1">{errors.vinChasis}</p>}
              <p className="text-xs text-gray-500 mt-1">VIN o número de chasis del vehículo</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.motor}
                onChange={(e) => setFormData({ ...formData, motor: e.target.value.toUpperCase() })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.motor ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="NÚMERO DE MOTOR"
              />
              {errors.motor && <p className="text-xs text-red-500 mt-1">{errors.motor}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Color <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.color ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="EJ: ROJO"
              />
              {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Capacidad de Pasajeros <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.pasajeros}
                onChange={(e) => setFormData({ ...formData, pasajeros: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
              >
                <option value={2}>2 pasajeros</option>
                <option value={3}>3 pasajeros</option>
                <option value={4}>4 pasajeros</option>
                <option value={5}>5 pasajeros</option>
                <option value={6}>6 pasajeros</option>
                <option value={7}>7 pasajeros</option>
                <option value={8}>8 pasajeros</option>
                <option value={9}>9 pasajeros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número de Puertas <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.puertas}
                onChange={(e) => setFormData({ ...formData, puertas: parseInt(e.target.value) })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
              >
                <option value={2}>2 puertas</option>
                <option value={3}>3 puertas</option>
                <option value={4}>4 puertas</option>
                <option value={5}>5 puertas</option>
              </select>
            </div>

            {/* Kilometraje - siempre visible */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kilometraje {isInternacional && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={formData.kilometraje}
                onChange={(e) => setFormData({ ...formData, kilometraje: e.target.value.replace(/[^0-9]/g, '') })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.kilometraje ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="EJ: 45000"
              />
              {errors.kilometraje && <p className="text-xs text-red-500 mt-1">{errors.kilometraje}</p>}
            </div>

            {/* Tipo de Combustible */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de Combustible {isInternacional && <span className="text-red-500">*</span>}
              </label>
              <select
                value={formData.tipoCombustible}
                onChange={(e) => setFormData({ ...formData, tipoCombustible: e.target.value as 'GASOLINA' | 'DIESEL' })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
              >
                <option value="GASOLINA">Gasolina</option>
                <option value="DIESEL">Diesel</option>
              </select>
            </div>

            {/* Tipo de Transmisión */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de Transmisión {isInternacional && <span className="text-red-500">*</span>}
              </label>
              <select
                value={formData.tipoTransmision}
                onChange={(e) => setFormData({ ...formData, tipoTransmision: e.target.value as 'AUTOMATICO' | 'MANUAL' })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
              >
                <option value="AUTOMATICO">Automático</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>

            {/* Asegurado Anteriormente */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ¿Estuvo asegurado anteriormente?
              </label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="aseguradoAnteriormente"
                    checked={formData.aseguradoAnteriormente === true}
                    onChange={() => setFormData({ ...formData, aseguradoAnteriormente: true })}
                    className="w-4 h-4 text-[#8AAA19]"
                  />
                  <span className="text-sm text-gray-700">Sí</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="aseguradoAnteriormente"
                    checked={formData.aseguradoAnteriormente === false}
                    onChange={() => setFormData({ ...formData, aseguradoAnteriormente: false, aseguradoraAnterior: '' })}
                    className="w-4 h-4 text-[#8AAA19]"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
              {formData.aseguradoAnteriormente && (
                <input
                  type="text"
                  value={formData.aseguradoraAnterior}
                  onChange={(e) => setFormData({ ...formData, aseguradoraAnterior: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none transition-colors"
                  placeholder="Nombre de la aseguradora anterior"
                />
              )}
            </div>
          </div>
        </div>

        {/* Registro Vehicular */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <label className="block text-base font-bold text-gray-800 mb-4">
            Adjuntar Registro Vehicular <span className="text-red-500">*</span>
          </label>
          {errors.registroVehicular && <p className="text-sm text-red-500 mb-2">{errors.registroVehicular}</p>}
          
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
