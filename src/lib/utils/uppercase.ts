/**
 * Utilidades para convertir inputs y payloads a mayúsculas
 * Aplicar en todos los formularios del portal
 */

/**
 * Convierte recursivamente todos los valores string de un objeto a mayúsculas
 * Mantiene nulls, numbers, booleans, arrays y objetos anidados
 * Excluye campos específicos que NO deben convertirse a mayúsculas
 */
const EXCLUDE_UPPERCASE_FIELDS = ['role', 'email', 'password', 'token', 'tipo_cuenta', 'bank_route', 'broker_type'];

export function toUppercasePayload<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => toUppercasePayload(item)) as unknown as T;
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string' && !EXCLUDE_UPPERCASE_FIELDS.includes(key)) {
      result[key] = value.toUpperCase();
    } else if (typeof value === 'object') {
      result[key] = toUppercasePayload(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Wrapper para onChange que convierte automáticamente a mayúsculas
 * Uso: 
 * const uppercaseChange = useUppercaseWrapper();
 * <input onChange={uppercaseChange((e) => setField(e.target.value))} />
 */
export function createUppercaseHandler<T extends HTMLInputElement | HTMLTextAreaElement>(
  handler: (e: React.ChangeEvent<T>) => void
) {
  return (e: React.ChangeEvent<T>) => {
    const target = e.target;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    // Convertir a mayúsculas
    const upperValue = target.value.toUpperCase();
    target.value = upperValue;

    // Restaurar posición del cursor
    if (start !== null && end !== null) {
      target.setSelectionRange(start, end);
    }

    // Llamar al handler original
    handler(e);
  };
}

/**
 * Función para aplicar uppercase transform en inputs
 * Agregar a className: "uppercase"
 */
export const uppercaseInputClass = 'uppercase placeholder:normal-case';
