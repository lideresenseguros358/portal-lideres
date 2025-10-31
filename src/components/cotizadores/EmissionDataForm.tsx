/**
 * Formulario de Datos de Emisión
 * Solicita información adicional para emitir la póliza
 */

'use client';

import { useState } from 'react';
import { FaUser, FaCar, FaIdCard, FaUpload } from 'react-icons/fa';
import { toast } from 'sonner';
import CedulaQRScanner from './CedulaQRScanner';

interface EmissionDataFormProps {
  quoteData: any;
  onContinue: (data: EmissionData) => void;
}

export interface EmissionData {
  // Datos del cliente
  cedula: string;
  cedulaFile?: File;
  licenciaFile?: File;
  
  // Datos del vehículo
  placa: string;
  vin: string;
  motor: string;
  chasis?: string;
  color?: string;
}

export default function EmissionDataForm({ quoteData, onContinue }: EmissionDataFormProps) {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [formData, setFormData] = useState<EmissionData>({
    cedula: '',
    placa: '',
    vin: '',
    motor: '',
    chasis: '',
    color: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cedulaFileName, setCedulaFileName] = useState('');
  const [licenciaFileName, setLicenciaFileName] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.cedula) newErrors.cedula = 'Requerido';
    if (!formData.placa) newErrors.placa = 'Requerido';
    if (!formData.vin) newErrors.vin = 'Requerido';
    if (!formData.motor) newErrors.motor = 'Requerido';
    if (!formData.cedulaFile) newErrors.cedulaFile = 'Adjunta cédula/pasaporte';
    if (!formData.licenciaFile) newErrors.licenciaFile = 'Adjunta licencia del conductor';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }
    
    onContinue(formData);
  };

  const handleCedulaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo debe ser menor a 5MB');
        return;
      }
      setFormData({ ...formData, cedulaFile: file });
      setCedulaFileName(file.name);
      setErrors({ ...errors, cedulaFile: '' });
    }
  };

  const handleLicenciaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo debe ser menor a 5MB');
        return;
      }
      setFormData({ ...formData, licenciaFile: file });
      setLicenciaFileName(file.name);
      setErrors({ ...errors, licenciaFile: '' });
    }
  };

  const handleQRScanSuccess = (data: any) => {
    // Autocompletar con datos del QR
    setFormData(prev => ({
      ...prev,
      cedula: data.cedula || prev.cedula,
    }));
    setShowQRScanner(false);
    toast.success('Información cargada desde QR');
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
          Datos para Emisión
        </h2>
        <p className="text-sm text-gray-600">
          Completa la información necesaria para emitir tu póliza
        </p>
      </div>

      {/* QR Scanner Button */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-semibold text-blue-900 mb-1">✨ Autocompletar con QR</p>
            <p className="text-xs text-blue-700">Escanea tu cédula para llenar los datos automáticamente</p>
          </div>
          <button
            type="button"
            onClick={() => setShowQRScanner(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            📱 Escanear
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos del Cliente */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-5">
          <h3 className="text-lg font-bold text-[#010139] mb-4 flex items-center gap-2">
            <FaUser className="text-[#8AAA19]" />
            Datos del Cliente
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cédula / Pasaporte <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.cedula ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="Ej: 8-123-4567"
              />
              {errors.cedula && <p className="text-xs text-red-500 mt-1">{errors.cedula}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Adjuntar Cédula/Pasaporte <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleCedulaFileChange}
                  className="hidden"
                  id="cedula-upload"
                />
                <label
                  htmlFor="cedula-upload"
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    errors.cedulaFile ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-[#8AAA19] bg-gray-50'
                  }`}
                >
                  <FaUpload className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {cedulaFileName || 'Seleccionar archivo'}
                  </span>
                </label>
              </div>
              {errors.cedulaFile && <p className="text-xs text-red-500 mt-1">{errors.cedulaFile}</p>}
              <p className="text-xs text-gray-500 mt-1">Imagen o PDF, máx. 5MB</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Adjuntar Licencia de Conducir <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleLicenciaFileChange}
                  className="hidden"
                  id="licencia-upload"
                />
                <label
                  htmlFor="licencia-upload"
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    errors.licenciaFile ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-[#8AAA19] bg-gray-50'
                  }`}
                >
                  <FaUpload className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {licenciaFileName || 'Seleccionar archivo'}
                  </span>
                </label>
              </div>
              {errors.licenciaFile && <p className="text-xs text-red-500 mt-1">{errors.licenciaFile}</p>}
              <p className="text-xs text-gray-500 mt-1">Imagen o PDF, máx. 5MB</p>
            </div>
          </div>
        </div>

        {/* Datos del Vehículo */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-5">
          <h3 className="text-lg font-bold text-[#010139] mb-4 flex items-center gap-2">
            <FaCar className="text-[#8AAA19]" />
            Datos del Vehículo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Placa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.placa ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="Ej: ABC-1234"
              />
              {errors.placa && <p className="text-xs text-red-500 mt-1">{errors.placa}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                VIN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.vin ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="Número de identificación del vehículo"
              />
              {errors.vin && <p className="text-xs text-red-500 mt-1">{errors.vin}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Motor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.motor}
                onChange={(e) => setFormData({ ...formData, motor: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.motor ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="Número de motor"
              />
              {errors.motor && <p className="text-xs text-red-500 mt-1">{errors.motor}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Chasis
              </label>
              <input
                type="text"
                value={formData.chasis}
                onChange={(e) => setFormData({ ...formData, chasis: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                placeholder="Número de chasis (opcional)"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Color
              </label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                placeholder="Color del vehículo (opcional)"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
        >
          Continuar a Inspección →
        </button>
      </form>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <CedulaQRScanner
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
}
