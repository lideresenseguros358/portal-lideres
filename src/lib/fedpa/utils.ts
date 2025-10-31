/**
 * Utilidades para FEDPA
 * Normalización, validaciones y transformaciones
 */

import { VALIDATION_RULES } from './config';

// ============================================
// NORMALIZACIÓN
// ============================================

/**
 * Normalizar texto a MAYÚSCULAS (regla global del portal)
 */
export function normalizeText(text: string): string {
  return text.trim().toUpperCase();
}

/**
 * Normalizar nombre completo (split y uppercase)
 */
export function splitNombreCompleto(nombreCompleto: string): {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
} {
  const parts = nombreCompleto.trim().split(/\s+/);
  
  if (parts.length < 2) {
    return {
      primerNombre: normalizeText(parts[0] || ''),
      primerApellido: '',
    };
  }
  
  if (parts.length === 2) {
    return {
      primerNombre: normalizeText(parts[0] || ''),
      primerApellido: normalizeText(parts[1] || ''),
    };
  }
  
  if (parts.length === 3) {
    return {
      primerNombre: normalizeText(parts[0] || ''),
      primerApellido: normalizeText(parts[1] || ''),
      segundoApellido: normalizeText(parts[2] || ''),
    };
  }
  
  // 4 o más partes
  return {
    primerNombre: normalizeText(parts[0] || ''),
    segundoNombre: normalizeText(parts[1] || ''),
    primerApellido: normalizeText(parts[2] || ''),
    segundoApellido: normalizeText(parts.slice(3).join(' ')),
  };
}

// ============================================
// VALIDACIONES
// ============================================

/**
 * Validar fecha en formato dd/mm/yyyy
 */
export function validateFecha(fecha: string): { valid: boolean; error?: string } {
  if (!VALIDATION_RULES.dateFormat.test(fecha)) {
    return {
      valid: false,
      error: 'Formato de fecha inválido. Use dd/mm/yyyy',
    };
  }
  
  const parts = fecha.split('/');
  const day = parseInt(parts[0] || '0');
  const month = parseInt(parts[1] || '0');
  const year = parseInt(parts[2] || '0');
  
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Mes inválido' };
  }
  
  if (day < 1 || day > 31) {
    return { valid: false, error: 'Día inválido' };
  }
  
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return { valid: false, error: 'Año inválido' };
  }
  
  return { valid: true };
}

/**
 * Validar placa panameña
 */
export function validatePlaca(placa: string): { valid: boolean; error?: string } {
  const normalized = normalizeText(placa);
  
  if (!VALIDATION_RULES.placa.test(normalized)) {
    return {
      valid: false,
      error: 'Formato de placa inválido. Ej: ABC-1234',
    };
  }
  
  return { valid: true };
}

/**
 * Validar cédula panameña
 */
export function validateCedula(cedula: string): { valid: boolean; error?: string } {
  if (!VALIDATION_RULES.cedula.test(cedula)) {
    return {
      valid: false,
      error: 'Formato de cédula inválido. Ej: 8-123-456',
    };
  }
  
  return { valid: true };
}

/**
 * Validar VIN (17 caracteres)
 */
export function validateVIN(vin: string): { valid: boolean; error?: string } {
  const normalized = normalizeText(vin);
  
  if (!VALIDATION_RULES.vin.test(normalized)) {
    return {
      valid: false,
      error: 'VIN debe tener 17 caracteres alfanuméricos',
    };
  }
  
  return { valid: true };
}

/**
 * Validar email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!VALIDATION_RULES.email.test(email)) {
    return {
      valid: false,
      error: 'Email inválido',
    };
  }
  
  return { valid: true };
}

// ============================================
// TRANSFORMACIONES
// ============================================

/**
 * Convertir fecha de yyyy-mm-dd a dd/mm/yyyy
 */
export function formatFechaToFEDPA(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convertir fecha de dd/mm/yyyy a yyyy-mm-dd
 */
export function formatFechaFromFEDPA(fedpaDate: string): string {
  const parts = fedpaDate.split('/');
  const day = parts[0] || '01';
  const month = parts[1] || '01';
  const year = parts[2] || '2000';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Convertir boolean a 0/1
 */
export function booleanToNumber(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * Formatear teléfono (agregar guión si no tiene)
 */
export function formatTelefono(telefono: string): string {
  // Si ya tiene guión, retornar
  if (telefono.includes('-')) return telefono;
  
  // Si tiene 8 dígitos, agregar guión
  if (telefono.length === 8 && /^\d{8}$/.test(telefono)) {
    return `${telefono.slice(0, 4)}-${telefono.slice(4)}`;
  }
  
  return telefono;
}

/**
 * Formatear identificación según tipo
 */
export function formatIdentificacion(
  identificacion: string,
  tipo: 'Cédula' | 'RUC' | 'Pasaporte'
): string {
  if (tipo === 'Cédula') {
    // Normalizar cédula si no tiene guiones
    if (!identificacion.includes('-') && /^\d{7,10}$/.test(identificacion)) {
      // Intentar formato automático (simple)
      return identificacion; // FEDPA debería aceptar sin guiones también
    }
  }
  
  return normalizeText(identificacion);
}

// ============================================
// ARCHIVO HELPERS
// ============================================

/**
 * Validar tamaño de archivo
 */
export function validateFileSize(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
  const maxSize = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `El archivo ${file.name} excede ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Validar MIME type
 */
export function validateMimeType(file: File, allowedMimes: readonly string[]): { valid: boolean; error?: string } {
  if (!allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `Formato ${file.type} no permitido`,
    };
  }
  
  return { valid: true };
}

/**
 * Comprimir imagen (basic - usando canvas)
 */
export async function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ============================================
// CÁLCULOS
// ============================================

/**
 * Verificar si plan está sincronizado
 */
export function verificarSincronizado(
  primaTotal: number,
  sumaCoberturas: number,
  tolerance: number = 0.01
): boolean {
  const diff = Math.abs(primaTotal - sumaCoberturas);
  return diff <= tolerance;
}

/**
 * Calcular impuesto
 */
export function calcularImpuesto(prima: number, porcentaje: number): number {
  return Number((prima * (porcentaje / 100)).toFixed(2));
}

/**
 * Calcular total con impuestos
 */
export function calcularTotalConImpuestos(
  primaBase: number,
  impuesto1Percent: number = 5,
  impuesto2Percent: number = 1
): {
  primaBase: number;
  impuesto1: number;
  impuesto2: number;
  total: number;
} {
  const impuesto1 = calcularImpuesto(primaBase, impuesto1Percent);
  const impuesto2 = calcularImpuesto(primaBase, impuesto2Percent);
  const total = primaBase + impuesto1 + impuesto2;
  
  return {
    primaBase,
    impuesto1,
    impuesto2,
    total: Number(total.toFixed(2)),
  };
}
