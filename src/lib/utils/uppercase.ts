/**
 * Utilidades para convertir inputs y payloads a mayúsculas
 * Aplicar en todos los formularios del portal
 */

/**
 * Convierte recursivamente todos los valores string de un objeto a mayúsculas
 * Mantiene nulls, numbers, booleans, arrays y objetos anidados
 * Excluye campos específicos que NO deben convertirse a mayúsculas
 */
const EXCLUDE_UPPERCASE_FIELDS = ['role', 'email', 'password', 'token', 'tipo_cuenta', 'bank_route', 'broker_type', 'birth_date', 'aliases'];

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

/**
 * Sanitiza texto removiendo caracteres especiales, ñ y acentos
 * Para compatibilidad con sistemas bancarios
 */
export function sanitizeForBank(text: string): string {
  if (!text) return '';
  
  return text
    .toUpperCase()
    // Quitar acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar Ñ por N
    .replace(/Ñ/g, 'N')
    // Quitar caracteres especiales excepto espacios, números, letras y guiones
    .replace(/[^A-Z0-9\s\-]/g, '');
}

/**
 * Sanitiza número de póliza según aseguradora
 * Para La Regional: sin guiones
 * Para otras: permite guiones
 */
export function sanitizePolicyNumber(text: string, insurerName: string): string {
  if (!text) return '';
  
  const isLaRegional = insurerName?.toUpperCase().includes('LA REGIONAL') || 
                        insurerName?.toUpperCase().includes('REGIONAL');
  
  const sanitized = text
    .toUpperCase()
    // Quitar acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar Ñ por N
    .replace(/Ñ/g, 'N');
  
  if (isLaRegional) {
    // La Regional: solo letras, números, espacios y barras (no guiones)
    return sanitized.replace(/[^A-Z0-9\s\/]/g, '');
  } else {
    // Otras: permite guiones también
    return sanitized.replace(/[^A-Z0-9\s\-\/]/g, '');
  }
}

/**
 * Genera número de póliza para emisión web
 */
export function generateEmisionWebPolicy(): string {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  
  return `EMISION WEB ${day}/${month}/${year}`;
}

/**
 * Handler para inputs que deben sanitizarse para banco
 */
export function createBankSafeHandler<T extends HTMLInputElement | HTMLTextAreaElement>(
  handler: (e: React.ChangeEvent<T>) => void
) {
  return (e: React.ChangeEvent<T>) => {
    const target = e.target;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    // Sanitizar
    const sanitized = sanitizeForBank(target.value);
    target.value = sanitized;

    // Restaurar posición del cursor
    if (start !== null && end !== null) {
      target.setSelectionRange(start, end);
    }

    // Llamar al handler original
    handler(e);
  };
}
