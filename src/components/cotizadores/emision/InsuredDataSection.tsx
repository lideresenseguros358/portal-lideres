/**
 * Sección: Datos del Asegurado
 * Todos los campos del cliente - iOS friendly
 */

'use client';

import { useState } from 'react';
import { FaUser, FaInfoCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { ACREEDORES_PANAMA, getAcreedoresGrouped } from '@/lib/constants/acreedores';

export interface InsuredData {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  cedula: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F';
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  esPEP: boolean;
  acreedor: string;
}

interface InsuredDataSectionProps {
  initialData?: Partial<InsuredData>;
  onComplete: (data: InsuredData) => void;
  requiresPEP?: boolean;
  requiresAccreedor?: boolean;
}

export default function InsuredDataSection({
  initialData,
  onComplete,
  requiresPEP = true,
  requiresAccreedor = false,
}: InsuredDataSectionProps) {
  const [formData, setFormData] = useState<InsuredData>({
    primerNombre: initialData?.primerNombre || '',
    segundoNombre: initialData?.segundoNombre || '',
    primerApellido: initialData?.primerApellido || '',
    segundoApellido: initialData?.segundoApellido || '',
    cedula: initialData?.cedula || '',
    fechaNacimiento: initialData?.fechaNacimiento || '',
    sexo: initialData?.sexo || 'M',
    email: initialData?.email || '',
    telefono: initialData?.telefono || '',
    celular: initialData?.celular || '',
    direccion: initialData?.direccion || '',
    esPEP: initialData?.esPEP || false,
    acreedor: initialData?.acreedor || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPEPTooltip, setShowPEPTooltip] = useState(false);

  const handleChange = (field: keyof InsuredData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error al editar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validaciones obligatorias
    if (!formData.primerNombre.trim()) newErrors.primerNombre = 'Primer nombre es obligatorio';
    if (!formData.primerApellido.trim()) newErrors.primerApellido = 'Primer apellido es obligatorio';
    if (!formData.cedula.trim()) newErrors.cedula = 'Cédula/Pasaporte es obligatorio';
    if (!formData.fechaNacimiento) newErrors.fechaNacimiento = 'Fecha de nacimiento es obligatoria';
    if (!formData.email.trim()) newErrors.email = 'Email es obligatorio';
    if (!formData.telefono.trim()) newErrors.telefono = 'Teléfono es obligatorio';
    if (!formData.celular.trim()) newErrors.celular = 'Celular es obligatorio';
    if (!formData.direccion.trim()) newErrors.direccion = 'Dirección es obligatoria';

    // Validar email
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validar edad mínima (18 años)
    if (formData.fechaNacimiento) {
      const birthDate = new Date(formData.fechaNacimiento);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        newErrors.fechaNacimiento = 'Debe ser mayor de 18 años';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onComplete(formData);
      toast.success('Datos del asegurado guardados correctamente');
    } else {
      toast.error('Por favor completa todos los campos obligatorios');
    }
  };

  // Estilo base para inputs (iOS-friendly)
  const inputClass = `w-full text-base min-h-[44px] px-4 border-2 rounded-lg transition-colors
    focus:outline-none focus:ring-2 focus:ring-[#8AAA19] focus:border-[#8AAA19]
    disabled:bg-gray-100 disabled:cursor-not-allowed`;

  const errorInputClass = 'border-red-500';
  const normalInputClass = 'border-gray-300';

  return (
    <div className="space-y-6">
      {/* Header de sección */}
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <FaUser className="text-[#010139] text-2xl" />
        <div>
          <h4 className="text-xl font-bold text-[#010139]">Datos del Asegurado</h4>
          <p className="text-sm text-gray-600">Completa la información del titular de la póliza</p>
        </div>
      </div>

      {/* Nombres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Primer Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.primerNombre}
            onChange={(e) => handleChange('primerNombre', e.target.value)}
            className={`${inputClass} ${errors.primerNombre ? errorInputClass : normalInputClass}`}
            placeholder="Juan"
          />
          {errors.primerNombre && (
            <p className="text-red-500 text-xs mt-1">{errors.primerNombre}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Segundo Nombre
          </label>
          <input
            type="text"
            value={formData.segundoNombre}
            onChange={(e) => handleChange('segundoNombre', e.target.value)}
            className={`${inputClass} ${normalInputClass}`}
            placeholder="Carlos"
          />
        </div>
      </div>

      {/* Apellidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Primer Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.primerApellido}
            onChange={(e) => handleChange('primerApellido', e.target.value)}
            className={`${inputClass} ${errors.primerApellido ? errorInputClass : normalInputClass}`}
            placeholder="Pérez"
          />
          {errors.primerApellido && (
            <p className="text-red-500 text-xs mt-1">{errors.primerApellido}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Segundo Apellido
          </label>
          <input
            type="text"
            value={formData.segundoApellido}
            onChange={(e) => handleChange('segundoApellido', e.target.value)}
            className={`${inputClass} ${normalInputClass}`}
            placeholder="López"
          />
        </div>
      </div>

      {/* Cédula y Fecha Nacimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cédula / Pasaporte <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.cedula}
            onChange={(e) => handleChange('cedula', e.target.value)}
            className={`${inputClass} ${errors.cedula ? errorInputClass : normalInputClass}`}
            placeholder="8-123-4567"
          />
          {errors.cedula && (
            <p className="text-red-500 text-xs mt-1">{errors.cedula}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Fecha de Nacimiento <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.fechaNacimiento}
            onChange={(e) => handleChange('fechaNacimiento', e.target.value)}
            className={`${inputClass} ${errors.fechaNacimiento ? errorInputClass : normalInputClass}`}
            style={{ fontSize: '16px' }} // Evita zoom en iOS
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.fechaNacimiento && (
            <p className="text-red-500 text-xs mt-1">{errors.fechaNacimiento}</p>
          )}
        </div>
      </div>

      {/* Sexo */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Sexo <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sexo"
              value="M"
              checked={formData.sexo === 'M'}
              onChange={(e) => handleChange('sexo', e.target.value as 'M' | 'F')}
              className="w-5 h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
            />
            <span className="text-base font-medium">Masculino</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sexo"
              value="F"
              checked={formData.sexo === 'F'}
              onChange={(e) => handleChange('sexo', e.target.value as 'M' | 'F')}
              className="w-5 h-5 text-[#8AAA19] focus:ring-[#8AAA19]"
            />
            <span className="text-base font-medium">Femenino</span>
          </label>
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`${inputClass} ${errors.email ? errorInputClass : normalInputClass}`}
          placeholder="correo@ejemplo.com"
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      {/* Teléfonos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Teléfono Fijo <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            className={`${inputClass} ${errors.telefono ? errorInputClass : normalInputClass}`}
            placeholder="255-1234"
          />
          {errors.telefono && (
            <p className="text-red-500 text-xs mt-1">{errors.telefono}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Celular <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={formData.celular}
            onChange={(e) => handleChange('celular', e.target.value)}
            className={`${inputClass} ${errors.celular ? errorInputClass : normalInputClass}`}
            placeholder="6555-1234"
          />
          {errors.celular && (
            <p className="text-red-500 text-xs mt-1">{errors.celular}</p>
          )}
        </div>
      </div>

      {/* Dirección */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Dirección Completa <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.direccion}
          onChange={(e) => handleChange('direccion', e.target.value)}
          className={`${inputClass} min-h-[88px] py-3 resize-none ${
            errors.direccion ? errorInputClass : normalInputClass
          }`}
          placeholder="Calle 50, Edificio XYZ, Apartamento 5B, Ciudad de Panamá"
          rows={3}
        />
        {errors.direccion && (
          <p className="text-red-500 text-xs mt-1">{errors.direccion}</p>
        )}
      </div>

      {/* PEP (si aplica) */}
      {requiresPEP && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="esPEP"
              checked={formData.esPEP}
              onChange={(e) => handleChange('esPEP', e.target.checked)}
              className="w-6 h-6 mt-1 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
            />
            <div className="flex-1">
              <label htmlFor="esPEP" className="text-base font-semibold text-gray-900 cursor-pointer">
                Soy una Persona Expuesta Políticamente (PEP)
              </label>
              <button
                type="button"
                onClick={() => setShowPEPTooltip(!showPEPTooltip)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                <FaInfoCircle />
                <span>¿Qué es una PEP?</span>
              </button>
              {showPEPTooltip && (
                <div className="mt-3 p-3 bg-white border-2 border-blue-300 rounded-lg text-sm text-gray-700">
                  <p className="font-semibold mb-2">Persona Expuesta Políticamente (PEP):</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Funcionarios públicos de alto nivel</li>
                    <li>Miembros de cuerpos legislativos</li>
                    <li>Jueces de tribunales superiores</li>
                    <li>Oficiales militares de alto rango</li>
                    <li>Directores de empresas estatales</li>
                    <li>Familiares directos de las personas mencionadas</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Acreedor (si aplica) */}
      {requiresAccreedor && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Acreedor (Banco/Financiera)
          </label>
          <select
            value={formData.acreedor}
            onChange={(e) => handleChange('acreedor', e.target.value)}
            className={`${inputClass} ${normalInputClass} bg-white`}
          >
            <option value="">Sin acreedor (no financiado)</option>
            <optgroup label="Bancos">
              {ACREEDORES_PANAMA.filter(a => a.tipo === 'BANCO').map(a => (
                <option key={a.codConductoIS} value={a.codigoFEDPA}>{a.label}</option>
              ))}
            </optgroup>
            <optgroup label="Financieras">
              {ACREEDORES_PANAMA.filter(a => a.tipo === 'FINANCIERA').map(a => (
                <option key={a.codConductoIS} value={a.codigoFEDPA}>{a.label}</option>
              ))}
            </optgroup>
            <optgroup label="Cooperativas">
              {ACREEDORES_PANAMA.filter(a => a.tipo === 'COOPERATIVA').map(a => (
                <option key={a.codConductoIS} value={a.codigoFEDPA}>{a.label}</option>
              ))}
            </optgroup>
            <optgroup label="Leasing / Arrendamiento">
              {ACREEDORES_PANAMA.filter(a => a.tipo === 'LEASING').map(a => (
                <option key={a.codConductoIS} value={a.codigoFEDPA}>{a.label}</option>
              ))}
            </optgroup>
            <optgroup label="Otros">
              {ACREEDORES_PANAMA.filter(a => a.tipo === 'OTRO').map(a => (
                <option key={a.codConductoIS} value={a.codigoFEDPA}>{a.label}</option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Solo si el vehículo tiene financiamiento
          </p>
        </div>
      )}

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
