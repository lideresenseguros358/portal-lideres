'use client';

import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NationalIdInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

type DocumentType = 'cedula' | 'pasaporte' | 'ruc';

// Provincias y prefijos de Panamá
const CEDULA_PREFIXES = [
  'PE',  // Panamá Este
  'E',   // Extranjero
  'PN',  // Panamá Norte
  'PI',  // Panamá Interior
  '1',   // Bocas del Toro
  '2',   // Coclé
  '3',   // Colón
  '4',   // Chiriquí
  '5',   // Darién
  '6',   // Herrera
  '7',   // Los Santos
  '8',   // Panamá
  '9',   // Veraguas
  '10',  // Guna Yala
  '11',  // Emberá-Wounaan
  '12',  // Ngäbe-Buglé
];

export default function NationalIdInput({
  value,
  onChange,
  label = 'Documento de Identidad',
  required = false,
  error,
  className = ''
}: NationalIdInputProps) {
  const [documentType, setDocumentType] = useState<DocumentType>('cedula');
  const isInitialMount = useRef(true);
  const lastValueRef = useRef('');
  const hasInitialized = useRef(false);
  
  // Para cédula: 3 partes separadas
  const [cedulaPart1, setCedulaPart1] = useState('');
  const [cedulaPart2, setCedulaPart2] = useState('');
  const [cedulaPart3, setCedulaPart3] = useState('');

  // Para pasaporte y RUC: un solo campo
  const [singleValue, setSingleValue] = useState('');

  // Debug: rastrear cambios de estado
  useEffect(() => {
    console.log('[NationalIdInput] Estado actual:', {
      documentType,
      cedulaPart1,
      cedulaPart2,
      cedulaPart3,
      singleValue,
      value
    });
  }, [documentType, cedulaPart1, cedulaPart2, cedulaPart3, singleValue, value]);

  // Inicializar desde el value prop
  useEffect(() => {
    // Si no hay value, limpiar todo
    if (!value || value.trim() === '') {
      if (lastValueRef.current !== '') {
        lastValueRef.current = '';
        setCedulaPart1('');
        setCedulaPart2('');
        setCedulaPart3('');
        setSingleValue('');
        setDocumentType('cedula');
      }
      return;
    }
    
    // Si el value no ha cambiado, no hacer nada
    if (value === lastValueRef.current) {
      return;
    }
    
    // Actualizar lastValueRef
    lastValueRef.current = value;
    hasInitialized.current = true;
    
    console.log('[NationalIdInput] Procesando value:', value);
    
    // Detectar tipo de documento de manera inteligente
    if (!value.includes('-')) {
      // Sin guiones = pasaporte
      console.log('[NationalIdInput] Detectado: PASAPORTE (sin guiones)');
      setDocumentType('pasaporte');
      setSingleValue(value);
      setCedulaPart1('');
      setCedulaPart2('');
      setCedulaPart3('');
    } else {
      const parts = value.split('-');
      console.log('[NationalIdInput] Parts:', parts);
      
      // Verificar si es cédula (3 partes y provincia válida)
      if (parts.length === 3 && parts[0]) {
        const provincia = parts[0].toUpperCase();
        console.log('[NationalIdInput] Verificando provincia:', provincia, 'en lista:', CEDULA_PREFIXES.includes(provincia));
        
        if (CEDULA_PREFIXES.includes(provincia)) {
          // Es cédula
          console.log('[NationalIdInput] Detectado: CÉDULA');
          setDocumentType('cedula');
          setCedulaPart1(provincia);
          setCedulaPart2(parts[1] || '');
          setCedulaPart3(parts[2] || '');
          setSingleValue('');
        } else if (parts[0].length > 2) {
          // Primera parte tiene más de 2 caracteres = RUC
          console.log('[NationalIdInput] Detectado: RUC (primera parte > 2 caracteres)');
          setDocumentType('ruc');
          setSingleValue(value);
          setCedulaPart1('');
          setCedulaPart2('');
          setCedulaPart3('');
        } else {
          // Provincia no válida y primera parte <= 2 = RUC
          console.log('[NationalIdInput] Detectado: RUC (provincia no válida)');
          setDocumentType('ruc');
          setSingleValue(value);
          setCedulaPart1('');
          setCedulaPart2('');
          setCedulaPart3('');
        }
      } else if (parts[0] && parts[0].length > 2) {
        // No tiene 3 partes pero primera parte > 2 caracteres = RUC
        console.log('[NationalIdInput] Detectado: RUC (no 3 partes, primera > 2)');
        setDocumentType('ruc');
        setSingleValue(value);
        setCedulaPart1('');
        setCedulaPart2('');
        setCedulaPart3('');
      } else {
        // Cualquier otro formato con guiones = RUC
        console.log('[NationalIdInput] Detectado: RUC (formato desconocido)');
        setDocumentType('ruc');
        setSingleValue(value);
        setCedulaPart1('');
        setCedulaPart2('');
        setCedulaPart3('');
      }
    }
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [value]);

  // Actualizar el valor cuando cambien las partes de la cédula
  useEffect(() => {
    if (!isInitialMount.current && documentType === 'cedula') {
      const fullCedula = [cedulaPart1, cedulaPart2, cedulaPart3]
        .filter(part => part) // Eliminar partes vacías
        .join('-');
      
      if (fullCedula !== lastValueRef.current) {
        lastValueRef.current = fullCedula;
        onChange(fullCedula);
      }
    }
  }, [cedulaPart1, cedulaPart2, cedulaPart3, documentType, onChange]);

  // Actualizar el valor cuando cambie el campo único
  useEffect(() => {
    if (!isInitialMount.current && (documentType === 'pasaporte' || documentType === 'ruc')) {
      if (singleValue !== lastValueRef.current) {
        lastValueRef.current = singleValue;
        onChange(singleValue);
      }
    }
  }, [singleValue, documentType, onChange]);

  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    // Limpiar campos al cambiar tipo
    setCedulaPart1('');
    setCedulaPart2('');
    setCedulaPart3('');
    setSingleValue('');
    lastValueRef.current = '';
    onChange('');
  };

  const handleCedulaPart2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Solo números
    if (val.length <= 4) {
      setCedulaPart2(val);
    }
  };

  const handleCedulaPart3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Solo números
    if (val.length <= 5) {
      setCedulaPart3(val);
    }
  };

  const handleSingleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSingleValue(e.target.value);
  };

  return (
    <div className={className}>
      {/* Label */}
      <label className="block text-sm font-semibold text-[#010139] mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Selector de tipo de documento */}
      <div className="mb-3">
        <Select 
          value={documentType} 
          onValueChange={handleDocumentTypeChange}
          key={`doctype-${documentType}`}
        >
          <SelectTrigger className="w-full sm:w-64 border-2 border-gray-300 focus:border-[#8AAA19] h-10">
            <SelectValue>
              {documentType === 'cedula' && '🪪 Cédula'}
              {documentType === 'pasaporte' && '🛂 Pasaporte'}
              {documentType === 'ruc' && '🏢 RUC'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cedula">🪪 Cédula</SelectItem>
            <SelectItem value="pasaporte">🛂 Pasaporte</SelectItem>
            <SelectItem value="ruc">🏢 RUC</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {documentType === 'cedula' && '✅ Detectado: Cédula Panameña'}
          {documentType === 'pasaporte' && '✅ Detectado: Pasaporte (sin guiones)'}
          {documentType === 'ruc' && '✅ Detectado: RUC (formato especial)'}
        </p>
      </div>

      {/* Inputs según tipo de documento */}
      {documentType === 'cedula' && (
        <div>
          <div className="p-3 bg-green-50 border-2 border-green-300 rounded-lg mb-3">
            <p className="text-xs text-green-800 font-semibold">
              ✅ Provincia válida detectada → CÉDULA PANAMEÑA
            </p>
          </div>
          <div className="flex flex-row gap-2">
            {/* Parte 1: Provincia/Prefijo */}
            <div className="flex-none w-24 sm:w-32">
              <Select 
                value={cedulaPart1} 
                onValueChange={(val) => {
                  console.log('[NationalIdInput] Select onChange:', val);
                  setCedulaPart1(val);
                }}
                key={`provincia-${cedulaPart1}`}
              >
                <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19] h-11">
                  <SelectValue placeholder="Provincia">
                    {cedulaPart1 || 'Provincia'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CEDULA_PREFIXES.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parte 2: Tomo (max 4 dígitos) */}
            <div className="flex-1 min-w-0 sm:w-28">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Tomo"
                value={cedulaPart2}
                onChange={handleCedulaPart2Change}
                maxLength={4}
                className="w-full px-1 sm:px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none h-11 text-center font-mono text-sm sm:text-base"
              />
            </div>

            {/* Parte 3: Asiento (max 5 dígitos) */}
            <div className="flex-1 min-w-0 sm:w-32">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Asiento"
                value={cedulaPart3}
                onChange={handleCedulaPart3Change}
                maxLength={5}
                className="w-full px-1 sm:px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none h-11 text-center font-mono text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Preview */}
          {(cedulaPart1 || cedulaPart2 || cedulaPart3) && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Vista previa:</strong>{' '}
                <span className="font-mono text-sm">
                  {cedulaPart1 || '___'}-{cedulaPart2 || '____'}-{cedulaPart3 || '_____'}
                </span>
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            📝 <strong>Formato:</strong> Provincia-Tomo-Asiento (ej: 8-999-9999 o E-8888-88888)
          </p>
        </div>
      )}

      {documentType === 'pasaporte' && (
        <div>
          <div className="p-3 bg-blue-50 border-2 border-blue-300 rounded-lg mb-3">
            <p className="text-xs text-blue-800 font-semibold">
              🚫 Sin guiones detectados → PASAPORTE
            </p>
          </div>
          <input
            type="text"
            placeholder="PA123456789"
            value={singleValue}
            onChange={handleSingleValueChange}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none h-11 font-mono"
          />
          {singleValue && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Valor leído:</strong>{' '}
                <span className="font-mono text-sm font-semibold">{singleValue}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            📝 <strong>Formato:</strong> Letras y números sin espacios (ej: PA123456789)
          </p>
        </div>
      )}

      {documentType === 'ruc' && (
        <div>
          <div className="p-3 bg-orange-50 border-2 border-orange-300 rounded-lg mb-3">
            <p className="text-xs text-orange-800 font-semibold">
              🏢 Formato no coincide con cédula → RUC
            </p>
          </div>
          <input
            type="text"
            placeholder="475690-1-434939"
            value={singleValue}
            onChange={handleSingleValueChange}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none h-11 font-mono"
          />
          {singleValue && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs text-orange-700">
                <strong>Valor leído:</strong>{' '}
                <span className="font-mono text-sm font-semibold">{singleValue}</span>
              </p>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            📝 <strong>Formato:</strong> Números separados por guiones (ej: 475690-1-434939)
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 mt-2">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
