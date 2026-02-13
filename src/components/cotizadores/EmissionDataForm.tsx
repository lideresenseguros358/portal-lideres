/**
 * Formulario de Datos de Emisión
 * Solicita información adicional para emitir la póliza
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaUser, FaCar, FaIdCard, FaUpload, FaCamera, FaCheckCircle } from 'react-icons/fa';
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
  // Dirección estructurada (IS)
  codProvincia?: number;
  codDistrito?: number;
  codCorregimiento?: number;
  codUrbanizacion?: number;
  casaApto?: string;
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

  // IS Address catalogs — cascading dropdowns
  const isInternacional = quoteData?.insurerName?.includes('INTERNACIONAL') || false;
  const [provincias, setProvincias] = useState<{ DATO: number; TEXTO: string }[]>([]);
  const [distritos, setDistritos] = useState<{ DATO: number; TEXTO: string }[]>([]);
  const [corregimientos, setCorregimientos] = useState<{ DATO: number; TEXTO: string }[]>([]);
  const [urbanizaciones, setUrbanizaciones] = useState<{ DATO: number; TEXTO: string }[]>([]);
  const [loadingAddr, setLoadingAddr] = useState<string>('');

  // Fetch provincias on mount (only for IS)
  useEffect(() => {
    if (!isInternacional) return;
    setLoadingAddr('provincias');
    fetch('/api/is/catalogos/direccion?tipo=provincias&codpais=1')
      .then(r => r.json())
      .then(d => { if (d.data) setProvincias(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAddr(''));
  }, [isInternacional]);

  // Fetch distritos when provincia changes
  const fetchDistritos = useCallback((codProvincia: number) => {
    setDistritos([]);
    setCorregimientos([]);
    setFormData(prev => ({ ...prev, codDistrito: undefined, codCorregimiento: undefined, codUrbanizacion: undefined }));
    if (!codProvincia) return;
    setLoadingAddr('distritos');
    fetch(`/api/is/catalogos/direccion?tipo=distritos&codpais=1&codprovincia=${codProvincia}`)
      .then(r => r.json())
      .then(d => { if (d.data) setDistritos(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAddr(''));
  }, []);

  // Fetch corregimientos when distrito changes
  const fetchCorregimientos = useCallback((codProvincia: number, codDistrito: number) => {
    setCorregimientos([]);
    setFormData(prev => ({ ...prev, codCorregimiento: undefined, codUrbanizacion: undefined }));
    if (!codDistrito) return;
    setLoadingAddr('corregimientos');
    fetch(`/api/is/catalogos/direccion?tipo=corregimientos&codpais=1&codprovincia=${codProvincia}&coddistrito=${codDistrito}`)
      .then(r => r.json())
      .then(d => { if (d.data) setCorregimientos(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAddr(''));
  }, []);

  // Fetch urbanizaciones once (large catalog, fetch on mount for IS)
  useEffect(() => {
    if (!isInternacional) return;
    fetch('/api/is/catalogos/direccion?tipo=urbanizaciones&page=1&size=5000')
      .then(r => r.json())
      .then(d => { if (d.data) setUrbanizaciones(d.data); })
      .catch(() => {});
  }, [isInternacional]);

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
      } catch (error) {
        console.error('Error al cargar datos de emisión guardados:', error);
      }
    }

    // Restaurar archivos cacheados como File objects desde base64
    const cachedCedula = sessionStorage.getItem('emissionCedulaFile');
    if (cachedCedula) {
      try {
        const { name, type, data } = JSON.parse(cachedCedula);
        const byteString = atob(data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const file = new File([ab], name, { type });
        setFormData(prev => ({ ...prev, cedulaFile: file }));
        setCedulaFileName(name);
      } catch (e) { console.error('Error restaurando cédula:', e); }
    }
    const cachedLicencia = sessionStorage.getItem('emissionLicenciaFile');
    if (cachedLicencia) {
      try {
        const { name, type, data } = JSON.parse(cachedLicencia);
        const byteString = atob(data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const file = new File([ab], name, { type });
        setFormData(prev => ({ ...prev, licenciaFile: file }));
        setLicenciaFileName(name);
      } catch (e) { console.error('Error restaurando licencia:', e); }
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
    
    // Dirección estructurada (IS)
    if (isInternacional) {
      if (!formData.codProvincia) newErrors.codProvincia = 'Selecciona provincia';
      if (!formData.codDistrito) newErrors.codDistrito = 'Selecciona distrito';
      if (!formData.codCorregimiento) newErrors.codCorregimiento = 'Selecciona corregimiento';
    }
    
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

  // Helper to cache a file as base64 in sessionStorage
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
      cacheFileToStorage('emissionCedulaFile', file);
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
      cacheFileToStorage('emissionLicenciaFile', file);
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

            {/* IS Address Dropdowns — solo para Internacional */}
            {isInternacional && (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Dirección Estructurada (requerido por Internacional)</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Provincia */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Provincia <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.codProvincia || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, codProvincia: val || undefined }));
                        fetchDistritos(val);
                      }}
                      className={`w-full px-3 py-2.5 text-base border-2 rounded-lg focus:outline-none bg-white ${
                        errors.codProvincia ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}
                      disabled={loadingAddr === 'provincias'}
                    >
                      <option value="">{loadingAddr === 'provincias' ? 'Cargando...' : 'Seleccionar provincia'}</option>
                      {provincias.map(p => (
                        <option key={p.DATO} value={p.DATO}>{p.TEXTO}</option>
                      ))}
                    </select>
                    {errors.codProvincia && <p className="text-xs text-red-500 mt-1">{errors.codProvincia}</p>}
                  </div>

                  {/* Distrito */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Distrito <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.codDistrito || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, codDistrito: val || undefined }));
                        if (formData.codProvincia) fetchCorregimientos(formData.codProvincia, val);
                      }}
                      className={`w-full px-3 py-2.5 text-base border-2 rounded-lg focus:outline-none bg-white ${
                        errors.codDistrito ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}
                      disabled={!formData.codProvincia || loadingAddr === 'distritos'}
                    >
                      <option value="">{loadingAddr === 'distritos' ? 'Cargando...' : 'Seleccionar distrito'}</option>
                      {distritos.map(d => (
                        <option key={d.DATO} value={d.DATO}>{d.TEXTO}</option>
                      ))}
                    </select>
                    {errors.codDistrito && <p className="text-xs text-red-500 mt-1">{errors.codDistrito}</p>}
                  </div>

                  {/* Corregimiento */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Corregimiento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.codCorregimiento || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, codCorregimiento: val || undefined }));
                      }}
                      className={`w-full px-3 py-2.5 text-base border-2 rounded-lg focus:outline-none bg-white ${
                        errors.codCorregimiento ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                      }`}
                      disabled={!formData.codDistrito || loadingAddr === 'corregimientos'}
                    >
                      <option value="">{loadingAddr === 'corregimientos' ? 'Cargando...' : 'Seleccionar corregimiento'}</option>
                      {corregimientos.map(c => (
                        <option key={c.DATO} value={c.DATO}>{c.TEXTO}</option>
                      ))}
                    </select>
                    {errors.codCorregimiento && <p className="text-xs text-red-500 mt-1">{errors.codCorregimiento}</p>}
                  </div>

                  {/* Urbanización */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Urbanización / Barriada
                    </label>
                    <select
                      value={formData.codUrbanizacion || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData(prev => ({ ...prev, codUrbanizacion: val || undefined }));
                      }}
                      className="w-full px-3 py-2.5 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
                    >
                      <option value="">Seleccionar (opcional)</option>
                      {urbanizaciones.map(u => (
                        <option key={u.DATO} value={u.DATO}>{u.TEXTO}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Casa / Apto */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Casa / Apartamento
                  </label>
                  <input
                    type="text"
                    value={formData.casaApto || ''}
                    onChange={(e) => setFormData({ ...formData, casaApto: e.target.value })}
                    className="w-full px-3 py-2.5 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none"
                    placeholder="Ej: Casa 12-B, Apto 3C"
                  />
                </div>
              </div>
            )}

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
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg cursor-pointer transition-colors font-semibold text-base ${
                    cedulaFileName
                      ? 'bg-green-50 border-2 border-[#8AAA19] text-[#8AAA19]'
                      : errors.cedulaFile
                        ? 'bg-red-50 border-2 border-red-500 text-red-600'
                        : 'bg-[#8AAA19] text-white hover:bg-[#6d8814]'
                  }`}
                >
                  {cedulaFileName ? (
                    <><FaCheckCircle className="text-lg" /> {cedulaFileName}</>
                  ) : (
                    <><FaCamera className="text-lg" /> Subir Documento</>
                  )}
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
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg cursor-pointer transition-colors font-semibold text-base ${
                    licenciaFileName
                      ? 'bg-green-50 border-2 border-[#8AAA19] text-[#8AAA19]'
                      : errors.licenciaFile
                        ? 'bg-red-50 border-2 border-red-500 text-red-600'
                        : 'bg-[#8AAA19] text-white hover:bg-[#6d8814]'
                  }`}
                >
                  {licenciaFileName ? (
                    <><FaCheckCircle className="text-lg" /> {licenciaFileName}</>
                  ) : (
                    <><FaCamera className="text-lg" /> Subir Documento</>
                  )}
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
