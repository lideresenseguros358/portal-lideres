'use client';

import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getPolicyFormatConfig, 
  normalizePolicyNumber, 
  validatePolicyFormat,
  type InsurerSlug 
} from '@/lib/utils/policy-number';

interface PolicyNumberInputProps {
  insurerName: string; // Nombre de la aseguradora (ej: "ASSA", "ANCON")
  value: string; // Número completo de póliza
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  hasError?: boolean;
}

export default function PolicyNumberInput({
  insurerName,
  value,
  onChange,
  label = 'Número de Póliza',
  required = false,
  error,
  className = '',
  hasError = false
}: PolicyNumberInputProps) {
  const lastValueRef = useRef('');
  const hasInitialized = useRef(false);
  
  // Obtener configuración de la aseguradora
  const config = getPolicyFormatConfig(insurerName.toLowerCase().replace(/\s+/g, '-') as InsurerSlug);
  
  // Estados para múltiples inputs
  const [inputs, setInputs] = useState<string[]>([]);

  // Inicializar inputs desde el value prop - REPLICANDO LÓGICA DE NationalIdInput
  useEffect(() => {
    if (!config) return;
    
    // Si no hay value, limpiar todo
    if (!value || value.trim() === '') {
      if (lastValueRef.current !== '') {
        lastValueRef.current = '';
        setInputs(Array(config.inputCount).fill(''));
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
    
    // Separar el valor según el separador configurado
    if (config.inputCount === 1) {
      setInputs([value]);
    } else {
      const separator = config.joinWith || '-';
      const parts = value.split(separator);
      
      if (parts.length === config.inputCount) {
        // Caso perfecto: el número de partes coincide con el esperado
        setInputs(parts);
      } else if (parts.length === 1 && parts[0] && parts[0].trim() !== '') {
        // Caso especial para ASSA: formato sin separador (ej: 02B123456)
        if (config.slug === 'assa' && config.inputCount === 3) {
          const raw = parts[0];
          // Formato ASSA: 02B123456 → [02, B, 123456]
          // Extraer: primeros 2 dígitos, letras intermedias, resto de números
          const match = raw.match(/^(\d{1,2})([A-Z]{1,2})(\d+)$/i);
          if (match && match[1] && match[2] && match[3]) {
            setInputs([match[1], match[2].toUpperCase(), match[3]]);
          } else {
            // Si no coincide el patrón, poner todo en el último input como fallback
            const newInputs = Array(config.inputCount).fill('');
            newInputs[config.inputCount - 1] = parts[0];
            setInputs(newInputs);
          }
        } else {
          // Caso sin guiones para otras aseguradoras: poner en el último input
          const newInputs = Array(config.inputCount).fill('');
          newInputs[config.inputCount - 1] = parts[0];
          setInputs(newInputs);
        }
      } else if (parts.length > config.inputCount) {
        // Más partes de las esperadas: tomar solo las primeras
        setInputs(parts.slice(0, config.inputCount));
      } else {
        // Menos partes de las esperadas: rellenar con vacíos
        const newInputs = [...parts];
        while (newInputs.length < config.inputCount) {
          newInputs.push('');
        }
        setInputs(newInputs);
      }
    }
  }, [value, config]);

  // Actualizar el valor cuando cambien los inputs
  useEffect(() => {
    if (hasInitialized.current && config && inputs.length === config.inputCount) {
      // Filtrar inputs vacíos para no incluirlos
      const filledInputs = inputs.filter(i => i.trim() !== '');
      
      if (filledInputs.length === 0) {
        if (lastValueRef.current !== '') {
          lastValueRef.current = '';
          onChange('');
        }
        return;
      }
      
      // Normalizar según reglas de la aseguradora
      const normalized = normalizePolicyNumber(config.slug, inputs);
      
      if (normalized !== lastValueRef.current) {
        lastValueRef.current = normalized;
        onChange(normalized);
      }
    }
  }, [inputs, config, onChange]);

  const handleInputChange = (index: number, newValue: string) => {
    hasInitialized.current = true; // Marcar como inicializado al primer cambio manual
    const newInputs = [...inputs];
    newInputs[index] = newValue;
    setInputs(newInputs);
  };

  if (!config) {
    // Fallback: input simple si no hay configuración
    return (
      <div className={className}>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none h-11 font-mono ${
            hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
          }`}
          placeholder="Número de póliza"
        />
        {error && <p className="text-xs text-red-600 mt-2">⚠️ {error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Label */}
      <label className="block text-sm font-semibold text-[#010139] mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Info de aseguradora */}
      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>🏢 {config.insurer}</strong> - Formato: {config.inputCount} {config.inputCount === 1 ? 'campo' : 'campos'}
        </p>
      </div>

      {/* Inputs según configuración */}
      {config.inputCount === 1 ? (
        // Un solo input (SURA, PALIG, MAPFRE, etc.)
        <div>
          <input
            type="text"
            value={inputs[0] || ''}
            onChange={(e) => handleInputChange(0, e.target.value)}
            className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none h-11 font-mono ${
              hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
            }`}
            placeholder={config.examples[0] || 'Número de póliza'}
          />
        </div>
      ) : (
        // Múltiples inputs - siempre horizontales
        <div className="flex flex-row gap-2">
          {Array.from({ length: config.inputCount }).map((_, index) => {
            const inputType = config.inputTypes[index];

            if (inputType === 'dropdown') {
              // Dropdown (ej: ASSA parte 2)
              return (
                <div key={index} className="flex-none w-24 sm:w-32">
                  <Select 
                    value={inputs[index] || ''} 
                    onValueChange={(val) => handleInputChange(index, val)}
                  >
                    <SelectTrigger className={`w-full border-2 h-11 ${
                      hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.dropdownOptions?.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            } else if (inputType === 'numeric') {
              // Input numérico
              return (
                <div key={index} className="flex-1 min-w-0 sm:w-28">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inputs[index] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, ''); // Solo números
                      handleInputChange(index, val);
                    }}
                    className={`w-full px-1 sm:px-3 py-2 border-2 rounded-lg focus:outline-none h-11 text-center font-mono text-sm sm:text-base ${
                      hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    placeholder={`Parte ${index + 1}`}
                  />
                </div>
              );
            } else {
              // Input mixto (texto y números)
              return (
                <div key={index} className="flex-1 min-w-0 sm:w-32">
                  <input
                    type="text"
                    value={inputs[index] || ''}
                    onChange={(e) => handleInputChange(index, e.target.value.toUpperCase())}
                    className={`w-full px-1 sm:px-3 py-2 border-2 rounded-lg focus:outline-none h-11 font-mono text-sm sm:text-base ${
                      hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
                    }`}
                    placeholder={`Parte ${index + 1}`}
                  />
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Vista previa para configuraciones especiales */}
      {config.normalize && config.slug === 'internacional' && inputs.some(i => i) && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            <strong>⚠️ Nota:</strong> INTERNACIONAL reordena y normaliza automáticamente
          </p>
          <p className="text-xs text-amber-700 font-mono mt-1">
            Se guardará como: {normalizePolicyNumber(config.slug, inputs)}
          </p>
        </div>
      )}

      {/* Ejemplo */}
      <div className="mt-2">
        <p className="text-xs text-gray-500">
          📝 <strong>Ejemplo:</strong> <span className="font-mono">{config.examples[0]}</span>
        </p>
        {config.examples[1] && (
          <p className="text-xs text-gray-500">
            <span className="ml-4 font-mono">{config.examples[1]}</span>
          </p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 mt-2">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
