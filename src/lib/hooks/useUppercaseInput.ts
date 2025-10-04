import { ChangeEvent, useCallback } from 'react';

/**
 * Hook para convertir automáticamente inputs a MAYÚSCULAS
 * 
 * @returns Handler para onChange que convierte el valor a uppercase
 * 
 * @example
 * const handleUppercase = useUppercaseInput();
 * <input onChange={handleUppercase((e) => setValue(e.target.value))} />
 */
export function useUppercaseInput() {
  return useCallback(<T extends HTMLInputElement | HTMLTextAreaElement>(
    handler: (e: ChangeEvent<T>) => void
  ) => {
    return (e: ChangeEvent<T>) => {
      // Guardar la posición del cursor
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      
      // Convertir a mayúsculas
      e.target.value = e.target.value.toUpperCase();
      
      // Restaurar la posición del cursor
      if (start !== null && end !== null) {
        e.target.setSelectionRange(start, end);
      }
      
      // Llamar al handler original
      handler(e);
    };
  }, []);
}

/**
 * Convierte todas las propiedades string de un objeto a MAYÚSCULAS
 * 
 * @param obj Objeto a convertir
 * @returns Nuevo objeto con strings en mayúsculas
 * 
 * @example
 * const data = { name: 'juan', email: 'test@test.com' };
 * const uppercase = toUppercasePayload(data);
 * // { name: 'JUAN', email: 'TEST@TEST.COM' }
 */
export function toUppercasePayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      result[key] = value.toUpperCase();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursivo para objetos anidados
      result[key] = toUppercasePayload(value);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Clase CSS para aplicar uppercase automáticamente
 * Agregar a inputs para visualizar en mayúsculas mientras se escribe
 */
export const uppercaseInputClass = 'uppercase';
