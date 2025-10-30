/**
 * Parser para QR de cédula panameña
 * Formato: CEDULA|NOMBRE|SEGUNDO NOMBRE|APELLIDO|SEGUNDO APELLIDO|SEXO|PROVINCIA|CONTROL|NACIONALIDAD|OTROS|OTROS
 */

export interface CedulaQRData {
  cedula: string;
  nombreCompleto: string;
  primerNombre: string;
  segundoNombre: string;
  apellidoCompleto: string;
  primerApellido: string;
  segundoApellido: string;
  sexo: string;
  provinciaNacimiento?: string;
  nacionalidad?: string;
}

/**
 * Parsea el texto del QR de cédula panameña
 */
export function parseCedulaQR(qrText: string): CedulaQRData | null {
  try {
    // El QR viene separado por | (pipe)
    const parts = qrText.split('|').map(p => p.trim());
    
    if (parts.length < 5) {
      console.error('QR inválido: no tiene suficientes campos', parts);
      return null;
    }

    const [
      cedula,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      sexo,
      provinciaNacimiento,
      , // numeroControl - no usado
      nacionalidad
    ] = parts;

    // Validar cédula
    if (!cedula || cedula.length < 5) {
      console.error('Cédula inválida', cedula);
      return null;
    }

    // Construir nombres y apellidos completos
    const nombreCompleto = [primerNombre, segundoNombre]
      .filter(Boolean)
      .join(' ')
      .trim();
    
    const apellidoCompleto = [primerApellido, segundoApellido]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      cedula: cedula.trim(),
      nombreCompleto,
      primerNombre: primerNombre?.trim() || '',
      segundoNombre: segundoNombre?.trim() || '',
      apellidoCompleto,
      primerApellido: primerApellido?.trim() || '',
      segundoApellido: segundoApellido?.trim() || '',
      sexo: sexo?.trim() || '',
      provinciaNacimiento: provinciaNacimiento?.trim() || undefined,
      nacionalidad: nacionalidad?.trim() || undefined,
    };
  } catch (error) {
    console.error('Error parseando QR de cédula:', error);
    return null;
  }
}

/**
 * Formatea el nombre completo con capitalización apropiada
 */
export function formatNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
