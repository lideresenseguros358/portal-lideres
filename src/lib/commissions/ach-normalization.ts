/**
 * ACH NORMALIZATION UTILITIES
 * Implementación exacta según instructivo oficial Banco General de Panamá
 * 
 * Reglas de caracteres ACH:
 * - Válidos: espacios, dígitos 0-9, letras A-Z (SIN acentos/ñ)
 * - Eliminar: tildes, ñ, símbolos especiales
 * - Formato: MAYÚSCULAS
 */

/**
 * Reemplazos de caracteres especiales para formato ACH
 */
const ACH_CHAR_MAP: Record<string, string> = {
  'á': 'A', 'Á': 'A', 'à': 'A', 'À': 'A', 'ä': 'A', 'Ä': 'A', 'â': 'A', 'Â': 'A',
  'é': 'E', 'É': 'E', 'è': 'E', 'È': 'E', 'ë': 'E', 'Ë': 'E', 'ê': 'E', 'Ê': 'E',
  'í': 'I', 'Í': 'I', 'ì': 'I', 'Ì': 'I', 'ï': 'I', 'Ï': 'I', 'î': 'I', 'Î': 'I',
  'ó': 'O', 'Ó': 'O', 'ò': 'O', 'Ò': 'O', 'ö': 'O', 'Ö': 'O', 'ô': 'O', 'Ô': 'O',
  'ú': 'U', 'Ú': 'U', 'ù': 'U', 'Ù': 'U', 'ü': 'U', 'Ü': 'U', 'û': 'U', 'Û': 'U',
  'ñ': 'N', 'Ñ': 'N',
};

/**
 * Caracteres inválidos para ACH (serán eliminados)
 * Incluye: . , % * $ @ # ~ ^ = { } [ ] ( ) / \ : ; - | + _ y ASCII control (<0x20)
 */
const ACH_INVALID_CHARS = /[.,\-%*$@#~^={}[\]()/\\:;\-|+_\x00-\x1F]/g;

/**
 * Normaliza texto a formato ACH oficial de Banco General
 * - Convierte a MAYÚSCULAS
 * - Reemplaza acentos y ñ
 * - Elimina caracteres inválidos
 * - Solo permite: A-Z, 0-9, espacios
 * 
 * @param text - Texto a normalizar
 * @returns Texto normalizado para ACH
 */
export function toUpperNoAccents(text: string | null | undefined): string {
  if (!text) return '';
  
  let normalized = text.trim();
  
  // Convertir a mayúsculas primero
  normalized = normalized.toUpperCase();
  
  // Reemplazar acentos y ñ
  for (const [char, replacement] of Object.entries(ACH_CHAR_MAP)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  // Eliminar caracteres inválidos
  normalized = normalized.replace(ACH_INVALID_CHARS, '');
  
  // Eliminar caracteres que no sean A-Z, 0-9 o espacio
  normalized = normalized.replace(/[^A-Z0-9 ]/g, '');
  
  // Comprimir espacios múltiples a uno solo
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

/**
 * Limpia número de cuenta para formato ACH
 * - Elimina espacios, guiones y símbolos
 * - Solo permite alfanuméricos
 * - Límite: 17 caracteres
 * 
 * @param accountNumber - Número de cuenta a limpiar
 * @returns Número de cuenta limpio (máx 17 caracteres)
 */
export function cleanAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '';
  
  // Eliminar espacios, guiones y símbolos
  let clean = accountNumber.trim().replace(/[\s\-.,]/g, '');
  
  // Solo permitir alfanuméricos
  clean = clean.replace(/[^A-Z0-9]/gi, '');
  
  // Convertir a mayúsculas
  clean = clean.toUpperCase();
  
  // Limitar a 17 caracteres
  return clean.substring(0, 17);
}

/**
 * Normaliza código de ruta bancaria
 * - Elimina ceros a la izquierda innecesarios
 * - Valida longitud 1-9 dígitos
 * - Solo permite numéricos
 * 
 * @param routeCode - Código de ruta (puede tener ceros iniciales: "000000071")
 * @returns Código normalizado sin ceros iniciales ("71")
 */
export function normalizeRoute(routeCode: string | null | undefined): string {
  if (!routeCode) return '';
  
  // Eliminar espacios y convertir a string
  let clean = String(routeCode).trim();
  
  // Solo permitir dígitos
  clean = clean.replace(/[^0-9]/g, '');
  
  // Eliminar ceros a la izquierda
  clean = clean.replace(/^0+/, '');
  
  // Si queda vacío después de quitar ceros, retornar "0"
  if (clean === '') return '0';
  
  // Validar longitud máxima 9 dígitos
  if (clean.length > 9) {
    clean = clean.substring(0, 9);
  }
  
  return clean;
}

/**
 * Trunca texto a longitud máxima de forma segura
 * 
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima
 * @returns Texto truncado
 */
export function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}

/**
 * Valida código de tipo de cuenta ACH
 * Solo se permiten 2 códigos según Banco General (cargados desde tabla ach_account_types):
 * - 03 = Cuenta Corriente
 * - 04 = Cuenta de Ahorro (default)
 * 
 * IMPORTANTE: El dropdown ya maneja códigos desde la tabla ach_account_types,
 * esta función solo valida que el código sea correcto.
 * 
 * @param accountType - Código de tipo de cuenta (debe ser '03' o '04')
 * @returns Código ACH de 2 dígitos (03 o 04)
 */
export function getAccountTypeCode(accountType: string | null | undefined): string {
  if (!accountType) return '04'; // Default: Ahorro
  
  const code = accountType.trim();
  
  // Solo aceptar códigos válidos de la tabla
  if (code === '03' || code === '04') {
    return code;
  }
  
  // Si viene cualquier otro valor, usar default (esto no debería pasar con el dropdown)
  console.warn(`Tipo de cuenta inválido: "${accountType}". Usando default (04 - Ahorro)`);
  return '04';
}

/**
 * Formatea monto para ACH
 * - Siempre 2 decimales
 * - Formato: ###0.00
 * 
 * @param amount - Monto a formatear
 * @returns String con formato ###0.00
 */
export function formatACHAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Genera referencia de texto ACH válida
 * - Debe iniciar con "REF*TXT**"
 * - Debe terminar con "\"
 * - Máximo 80 caracteres totales
 * - Normaliza contenido (sin acentos, mayúsculas)
 * 
 * @param description - Descripción de la transacción
 * @returns Referencia ACH válida
 */
export function generateACHReference(description: string): string {
  const prefix = 'REF*TXT**';
  const suffix = '\\';
  
  // Normalizar descripción
  const normalized = toUpperNoAccents(description);
  
  // Calcular espacio disponible para descripción
  const maxDescLength = 80 - prefix.length - suffix.length;
  
  // Truncar si es necesario
  const truncated = truncate(normalized, maxDescLength);
  
  return `${prefix}${truncated}${suffix}`;
}

/**
 * Valida que un broker tenga todos los campos requeridos para ACH
 * 
 * @param broker - Objeto broker con datos bancarios
 * @returns Objeto con validación y lista de errores
 */
export function validateBrokerForACH(broker: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validar ruta bancaria
  if (!broker.bank_route) {
    errors.push('Falta ruta bancaria (código del banco)');
  } else {
    const normalized = normalizeRoute(broker.bank_route);
    if (!normalized || normalized === '0') {
      errors.push('Ruta bancaria inválida');
    }
  }
  
  // Validar número de cuenta
  if (!broker.bank_account_no) {
    errors.push('Falta número de cuenta');
  } else {
    const cleaned = cleanAccountNumber(broker.bank_account_no);
    if (!cleaned || cleaned.length === 0) {
      errors.push('Número de cuenta inválido');
    }
  }
  
  // Validar tipo de cuenta
  if (!broker.tipo_cuenta) {
    errors.push('Falta tipo de cuenta');
  }
  
  // Validar nombre del beneficiario
  if (!broker.nombre_completo && !broker.name) {
    errors.push('Falta nombre del beneficiario');
  } else {
    const name = toUpperNoAccents(broker.nombre_completo || broker.name);
    if (!name || name.length === 0) {
      errors.push('Nombre del beneficiario inválido');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Limpia y valida ID de beneficiario
 * - Alfanumérico
 * - Máximo 15 caracteres
 * 
 * @param id - ID a limpiar
 * @returns ID limpio
 */
export function cleanBeneficiaryId(id: string | null | undefined): string {
  if (!id) return '';
  
  // Permitir alfanuméricos
  let clean = String(id).trim().replace(/[^A-Z0-9]/gi, '');
  
  // Convertir a mayúsculas
  clean = clean.toUpperCase();
  
  // Limitar a 15 caracteres
  return clean.substring(0, 15);
}
