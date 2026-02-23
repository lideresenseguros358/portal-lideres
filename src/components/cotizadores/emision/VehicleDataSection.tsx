/**
 * Sección: Datos del Vehículo
 * Campos específicos del vehículo para emisión
 */

'use client';

import { useState } from 'react';
import { FaCar } from 'react-icons/fa';
import { toast } from 'sonner';

export interface VehicleData {
  placa: string;
  vin: string;
  motor: string;
  color: string;
  pasajeros: number;
  puertas: number;
  marca?: string;
  modelo?: string;
  ano?: string;
}

interface VehicleDataSectionProps {
  initialData?: Partial<VehicleData>;
  quoteData: any;
  onComplete: (data: VehicleData) => void;
  showMarcaModelo?: boolean;
}

export default function VehicleDataSection({
  initialData,
  quoteData,
  onComplete,
  showMarcaModelo = false,
}: VehicleDataSectionProps) {
  const needsMarcaModelo = showMarcaModelo || (!quoteData?.marca && !quoteData?.modelo);
  
  const [formData, setFormData] = useState<VehicleData>({
    placa: initialData?.placa || '',
    vin: initialData?.vin || '',
    motor: initialData?.motor || '',
    color: initialData?.color || '',
    pasajeros: initialData?.pasajeros || 5,
    puertas: initialData?.puertas || 4,
    marca: initialData?.marca || quoteData?.marca || '',
    modelo: initialData?.modelo || quoteData?.modelo || '',
    ano: initialData?.ano || quoteData?.ano?.toString() || quoteData?.anio?.toString() || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof VehicleData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.placa.trim()) newErrors.placa = 'Placa es obligatoria';
    if (!formData.vin.trim()) newErrors.vin = 'VIN/Chasis es obligatorio';
    if (!formData.motor.trim()) newErrors.motor = 'Número de motor es obligatorio';
    if (!formData.color.trim()) newErrors.color = 'Color es obligatorio';
    if (needsMarcaModelo) {
      if (!formData.marca?.trim()) newErrors.marca = 'Marca es obligatoria';
      if (!formData.modelo?.trim()) newErrors.modelo = 'Modelo es obligatorio';
      if (!formData.ano?.trim()) newErrors.ano = 'Año es obligatorio';
    }

    // Validar VIN (debe tener al menos 17 caracteres)
    if (formData.vin && formData.vin.length < 17) {
      newErrors.vin = 'VIN debe tener al menos 17 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onComplete(formData);
      toast.success('Datos del vehículo guardados correctamente');
    } else {
      toast.error('Por favor completa todos los campos obligatorios');
    }
  };

  const inputClass = `w-full text-base min-h-[44px] px-4 border-2 rounded-lg transition-colors
    focus:outline-none focus:ring-2 focus:ring-[#8AAA19] focus:border-[#8AAA19]
    disabled:bg-gray-100 disabled:cursor-not-allowed`;

  const errorInputClass = 'border-red-500';
  const normalInputClass = 'border-gray-300';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <FaCar className="text-[#010139] text-2xl" />
        <div>
          <h4 className="text-xl font-bold text-[#010139]">Datos del Vehículo</h4>
          <p className="text-sm text-gray-600">Información específica del vehículo a asegurar</p>
        </div>
      </div>

      {/* Marca, Modelo, Año - editable si no viene de cotización */}
      {needsMarcaModelo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Marca <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.marca || ''}
              onChange={(e) => handleChange('marca', e.target.value.toUpperCase())}
              className={`${inputClass} ${errors.marca ? errorInputClass : normalInputClass}`}
              placeholder="Ej: TOYOTA, KIA, HYUNDAI"
            />
            {errors.marca && <p className="text-red-500 text-xs mt-1">{errors.marca}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Modelo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.modelo || ''}
              onChange={(e) => handleChange('modelo', e.target.value.toUpperCase())}
              className={`${inputClass} ${errors.modelo ? errorInputClass : normalInputClass}`}
              placeholder="Ej: COROLLA, SPORTAGE"
            />
            {errors.modelo && <p className="text-red-500 text-xs mt-1">{errors.modelo}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Año <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.ano || ''}
              onChange={(e) => handleChange('ano', e.target.value)}
              className={`${inputClass} ${errors.ano ? errorInputClass : normalInputClass}`}
            >
              <option value="">Seleccionar...</option>
              {Array.from({ length: new Date().getFullYear() - 1959 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {errors.ano && <p className="text-red-500 text-xs mt-1">{errors.ano}</p>}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
          <h5 className="font-bold text-gray-700 mb-3">Información de la Cotización</h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Marca</p>
              <p className="font-semibold text-gray-900">{quoteData.marca || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Modelo</p>
              <p className="font-semibold text-gray-900">{quoteData.modelo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Año</p>
              <p className="font-semibold text-gray-900">{quoteData.ano || quoteData.anio || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Valor</p>
              <p className="font-semibold text-gray-900">
                ${(quoteData.valorVehiculo || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Placa */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Placa <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.placa}
          onChange={(e) => handleChange('placa', e.target.value.toUpperCase())}
          className={`${inputClass} ${errors.placa ? errorInputClass : normalInputClass}`}
          placeholder="ABC-1234"
          maxLength={10}
        />
        {errors.placa && (
          <p className="text-red-500 text-xs mt-1">{errors.placa}</p>
        )}
      </div>

      {/* VIN y Motor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            VIN / Chasis <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.vin}
            onChange={(e) => handleChange('vin', e.target.value.toUpperCase())}
            className={`${inputClass} ${errors.vin ? errorInputClass : normalInputClass}`}
            placeholder="1HGBH41JXMN109186"
            maxLength={20}
          />
          {errors.vin && (
            <p className="text-red-500 text-xs mt-1">{errors.vin}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Mínimo 17 caracteres</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Número de Motor <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.motor}
            onChange={(e) => handleChange('motor', e.target.value.toUpperCase())}
            className={`${inputClass} ${errors.motor ? errorInputClass : normalInputClass}`}
            placeholder="ABC123456"
            maxLength={20}
          />
          {errors.motor && (
            <p className="text-red-500 text-xs mt-1">{errors.motor}</p>
          )}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Color <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.color}
          onChange={(e) => handleChange('color', e.target.value)}
          className={`${inputClass} ${errors.color ? errorInputClass : normalInputClass}`}
          placeholder="Ej: Rojo, Blanco, Negro"
        />
        {errors.color && (
          <p className="text-red-500 text-xs mt-1">{errors.color}</p>
        )}
      </div>

      {/* Pasajeros y Puertas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Capacidad de Pasajeros <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.pasajeros}
            onChange={(e) => handleChange('pasajeros', parseInt(e.target.value))}
            className={`${inputClass} ${normalInputClass}`}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <option key={num} value={num}>{num} pasajeros</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Número de Puertas <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.puertas}
            onChange={(e) => handleChange('puertas', parseInt(e.target.value))}
            className={`${inputClass} ${normalInputClass}`}
          >
            {[2, 3, 4, 5].map(num => (
              <option key={num} value={num}>{num} puertas</option>
            ))}
          </select>
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="pt-6 border-t-2 border-gray-200">
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white py-4 px-6 rounded-xl
            font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
          type="button"
        >
          Guardar y Continuar →
        </button>
      </div>
    </div>
  );
}
