/**
 * Formulario de Datos de Emisión
 * Solicita información adicional para emitir la póliza
 */

'use client';

import { useState, useEffect } from 'react';
import { FaUser, FaCar, FaIdCard, FaUpload } from 'react-icons/fa';
import { toast } from 'sonner';
import CedulaQRScanner from './CedulaQRScanner';

interface EmissionDataFormProps {
  quoteData: any;
  onContinue: (data: EmissionData) => void;
}

export interface EmissionData {
  // Datos del cliente SOLAMENTE
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  cedula: string;
  fechaNacimiento: string;
  estadoCivil: string; // soltero, casado, divorciado, viudo
  sexo: 'M' | 'F';
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  esPEP: boolean;
  acreedor?: string;
  cedulaFile?: File;
  licenciaFile?: File;
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
    estadoCivil: 'soltero',
    sexo: 'M',
    email: '',
    telefono: '',
    celular: '',
    direccion: '',
    esPEP: false,
    acreedor: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cedulaFileName, setCedulaFileName] = useState('');
  const [licenciaFileName, setLicenciaFileName] = useState('');

  // Cargar datos desde FormAutoCoberturaCompleta al montar
  useEffect(() => {
    const savedQuoteInput = sessionStorage.getItem('quoteInput');
    if (savedQuoteInput) {
      try {
        const parsed = JSON.parse(savedQuoteInput);
        if (parsed.cobertura === 'COMPLETA') {
          // Extraer nombre completo y separar en componentes
          const nombreCompleto = parsed.nombreCompleto || '';
          const partes = nombreCompleto.trim().split(/\s+/);
          
          let primerNombre = '';
          let segundoNombre = '';
          let primerApellido = '';
          let segundoApellido = '';
          
          if (partes.length >= 2) {
            primerNombre = partes[0];
            primerApellido = partes[1];
            if (partes.length >= 3) {
              segundoApellido = partes[2];
            }
            if (partes.length >= 4) {
              segundoNombre = primerApellido;
              primerApellido = segundoApellido || '';
              segundoApellido = partes[3] || '';
            }
          } else if (partes.length === 1) {
            primerNombre = partes[0];
          }
          
          setFormData(prev => ({
            ...prev,
            primerNombre,
            segundoNombre,
            primerApellido,
            segundoApellido,
            fechaNacimiento: parsed.fechaNacimiento || '',
            estadoCivil: parsed.estadoCivil || 'soltero',
          }));
        }
      } catch (error) {
        console.error('Error al cargar datos de cotización:', error);
      }
    }
    
    // Cargar datos guardados del formulario de emisión si existen
    const savedEmissionData = sessionStorage.getItem('emissionFormData');
    if (savedEmissionData) {
      try {
        const parsed = JSON.parse(savedEmissionData);
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed.cedulaFile) setCedulaFileName('(archivo guardado)');
        if (parsed.licenciaFile) setLicenciaFileName('(archivo guardado)');
      } catch (error) {
        console.error('Error al cargar datos de emisión guardados:', error);
      }
    }
  }, []);

  // Guardar datos en sessionStorage cuando cambian (para mantener durante proceso)
  useEffect(() => {
    if (formData.primerNombre || formData.email) {
      // Solo guardar si hay algún dato significativo
      const dataToSave = { ...formData };
      // No guardar archivos en sessionStorage (demasiado grande)
      delete dataToSave.cedulaFile;
      delete dataToSave.licenciaFile;
      sessionStorage.setItem('emissionFormData', JSON.stringify(dataToSave));
    }
  }, [formData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Cliente SOLAMENTE
    if (!formData.primerNombre) newErrors.primerNombre = 'Requerido';
    if (!formData.primerApellido) newErrors.primerApellido = 'Requerido';
    if (!formData.cedula) newErrors.cedula = 'Requerido';
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = 'Requerido';
    if (!formData.email) newErrors.email = 'Requerido';
    if (!formData.telefono) newErrors.telefono = 'Requerido';
    if (!formData.celular) newErrors.celular = 'Requerido';
    if (!formData.direccion) newErrors.direccion = 'Requerido';
    
    // Documentos del cliente
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
                  className={`w-full max-w-full px-3 py-2.5 md:px-4 md:py-3 text-sm md:text-base border-2 rounded-lg focus:outline-none transition-colors ${
                    errors.fechaNacimiento ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                  }`}
                  style={{ minHeight: '50px' }}
                />
                {errors.fechaNacimiento && <p className="text-xs text-red-500 mt-1">{errors.fechaNacimiento}</p>}
              </div>
            </div>

            {/* Estado Civil */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado Civil <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.estadoCivil}
                onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
                style={{ minHeight: '50px' }}
              >
                <option value="soltero">Soltero/a</option>
                <option value="casado">Casado/a</option>
                <option value="divorciado">Divorciado/a</option>
                <option value="viudo">Viudo/a</option>
              </select>
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
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105"
        >
          Continuar a Datos del Vehículo →
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
