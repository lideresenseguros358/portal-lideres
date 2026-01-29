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
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  cedula: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F';
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  esPEP: boolean;
  acreedor?: string;
  cedulaFile?: File;
  licenciaFile?: File;
  registroFile?: File;
  
  // Datos del vehículo
  placa: string;
  vin: string;
  motor: string;
  chasis?: string;
  color: string;
  pasajeros: number;
  puertas: number;
}

export default function EmissionDataForm({ quoteData, onContinue }: EmissionDataFormProps) {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [formData, setFormData] = useState<EmissionData>({
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    cedula: '',
    fechaNacimiento: '',
    sexo: 'M',
    email: '',
    telefono: '',
    celular: '',
    direccion: '',
    esPEP: false,
    acreedor: '',
    placa: '',
    vin: '',
    motor: '',
    chasis: '',
    color: '',
    pasajeros: 5,
    puertas: 4,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cedulaFileName, setCedulaFileName] = useState('');
  const [licenciaFileName, setLicenciaFileName] = useState('');
  const [registroFileName, setRegistroFileName] = useState('');

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Cliente
    if (!formData.primerNombre) newErrors.primerNombre = 'Requerido';
    if (!formData.primerApellido) newErrors.primerApellido = 'Requerido';
    if (!formData.cedula) newErrors.cedula = 'Requerido';
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = 'Requerido';
    if (!formData.email) newErrors.email = 'Requerido';
    if (!formData.telefono) newErrors.telefono = 'Requerido';
    if (!formData.celular) newErrors.celular = 'Requerido';
    if (!formData.direccion) newErrors.direccion = 'Requerido';
    
    // Vehículo
    if (!formData.placa) newErrors.placa = 'Requerido';
    if (!formData.vin) newErrors.vin = 'Requerido';
    if (!formData.motor) newErrors.motor = 'Requerido';
    if (!formData.color) newErrors.color = 'Requerido';
    
    // Documentos
    if (!formData.cedulaFile) newErrors.cedulaFile = 'Adjunta cédula/pasaporte';
    if (!formData.licenciaFile) newErrors.licenciaFile = 'Adjunta licencia del conductor';
    if (!formData.registroFile) newErrors.registroFile = 'Adjunta registro vehicular';
    
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

  const handleRegistroFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo debe ser menor a 5MB');
        return;
      }
      setFormData({ ...formData, registroFile: file });
      setRegistroFileName(file.name);
      setErrors({ ...errors, registroFile: '' });
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
            {/* Nombre completo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primer Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.primerNombre}
                  onChange={(e) => setFormData({ ...formData, primerNombre: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.primerNombre ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Juan"
                />
                {errors.primerNombre && <p className="text-xs text-red-500 mt-1">{errors.primerNombre}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Segundo Nombre
                </label>
                <input
                  type="text"
                  value={formData.segundoNombre}
                  onChange={(e) => setFormData({ ...formData, segundoNombre: e.target.value })}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                  placeholder="Carlos (opcional)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primer Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.primerApellido}
                  onChange={(e) => setFormData({ ...formData, primerApellido: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.primerApellido ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Pérez"
                />
                {errors.primerApellido && <p className="text-xs text-red-500 mt-1">{errors.primerApellido}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Segundo Apellido
                </label>
                <input
                  type="text"
                  value={formData.segundoApellido}
                  onChange={(e) => setFormData({ ...formData, segundoApellido: e.target.value })}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                  placeholder="López (opcional)"
                />
              </div>
            </div>

            {/* Identificación y Fecha de Nacimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cédula / Pasaporte <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.cedula ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="Ej: 8-123-4567"
                />
                {errors.cedula && <p className="text-xs text-red-500 mt-1">{errors.cedula}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Fecha de Nacimiento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.fechaNacimiento ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                />
                {errors.fechaNacimiento && <p className="text-xs text-red-500 mt-1">{errors.fechaNacimiento}</p>}
              </div>
            </div>

            {/* Sexo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sexo <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sexo"
                    value="M"
                    checked={formData.sexo === 'M'}
                    onChange={(e) => setFormData({ ...formData, sexo: e.target.value as 'M' | 'F' })}
                    className="w-5 h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
                  />
                  <span className="text-base">Masculino</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sexo"
                    value="F"
                    checked={formData.sexo === 'F'}
                    onChange={(e) => setFormData({ ...formData, sexo: e.target.value as 'M' | 'F' })}
                    className="w-5 h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
                  />
                  <span className="text-base">Femenino</span>
                </label>
              </div>
            </div>

            {/* Email y Teléfonos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.email ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="correo@ejemplo.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Teléfono Fijo <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value.replace(/\D/g, '') })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.telefono ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="555-1234"
                />
                {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Celular <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value.replace(/\D/g, '') })}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.celular ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  placeholder="6555-1234"
                />
                {errors.celular && <p className="text-xs text-red-500 mt-1">{errors.celular}</p>}
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Dirección Completa <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors resize-none ${
                  errors.direccion ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                rows={2}
                placeholder="Calle, número, barrio, ciudad"
              />
              {errors.direccion && <p className="text-xs text-red-500 mt-1">{errors.direccion}</p>}
            </div>

            {/* PEP Checkbox */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.esPEP}
                  onChange={(e) => setFormData({ ...formData, esPEP: e.target.checked })}
                  className="w-5 h-5 mt-0.5 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
                />
                <div className="flex-1">
                  <span className="text-base font-semibold text-blue-900">
                    Es Persona Expuesta Políticamente (PEP)
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Marca esta casilla si desempeñas o has desempeñado funciones públicas importantes
                  </p>
                </div>
              </label>
            </div>

            {/* Acreedor (condicional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Banco Acreedor <span className="text-gray-500 text-xs">(si el vehículo está financiado)</span>
              </label>
              <input
                type="text"
                value={formData.acreedor}
                onChange={(e) => setFormData({ ...formData, acreedor: e.target.value })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                placeholder="Ej: Banco General (opcional)"
              />
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Adjuntar Registro Vehicular <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleRegistroFileChange}
                  className="hidden"
                  id="registro-upload"
                />
                <label
                  htmlFor="registro-upload"
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    errors.registroFile ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-[#8AAA19] bg-gray-50'
                  }`}
                >
                  <FaUpload className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {registroFileName || 'Seleccionar archivo'}
                  </span>
                </label>
              </div>
              {errors.registroFile && <p className="text-xs text-red-500 mt-1">{errors.registroFile}</p>}
              <p className="text-xs text-gray-500 mt-1">Tarjeta de circulación - Imagen o PDF, máx. 5MB</p>
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
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
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
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                  errors.vin ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                }`}
                placeholder="Número de identificación"
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
                className={`w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
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
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                placeholder="Opcional"
              />
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
                placeholder="Ej: Rojo"
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
