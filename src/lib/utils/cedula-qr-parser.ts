/**
 * Parser para QR de cédula panameña
 * Formato real (pipe-delimited):
 *   cedula | primerNombre | primerApellido | segundoApellido | (vacío) | sexo | provincia | fechaNac(yyyymmdd) | nacionalidad | fechaExp | fechaVenc | codInterno
 * Cuando HAY segundo nombre se inserta entre primerNombre y primerApellido:
 *   cedula | primerNombre | segundoNombre | primerApellido | segundoApellido | sexo | provincia | fechaNac | nacionalidad | ...
 * La clave: si el campo entre primerNombre y lo que sigue es vacío (||), no hay segundo nombre.
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
  fechaNacimiento?: string;   // yyyy-mm-dd
  provinciaNacimiento?: string;
  nacionalidad?: string;
}

/**
 * Parsea el texto del QR de cédula panameña
 */
export function parseCedulaQR(qrText: string): CedulaQRData | null {
  try {
    // Split por pipe — NO trim, para preservar campos vacíos
    const parts = qrText.split('|');

    if (parts.length < 7) {
      console.error('QR inválido: no tiene suficientes campos', parts.length);
      return null;
    }

    const cedula = parts[0]?.trim() || '';

    // Validar cédula
    if (!cedula || cedula.length < 3) {
      console.error('Cédula inválida', cedula);
      return null;
    }

    // Determinar si hay segundo nombre:
    // Sin 2do nombre: cedula|nombre|apellido1|apellido2||sexo|prov|fecha|nac|...  (parts[4] vacío, parts[5] es M/F)
    // Con 2do nombre: cedula|nombre|nombre2|apellido1|apellido2|sexo|prov|fecha|nac|...  (parts[5] es M/F)
    let primerNombre = '';
    let segundoNombre = '';
    let primerApellido = '';
    let segundoApellido = '';
    let sexo = '';
    let provincia = '';
    let fechaRaw = '';
    let nacionalidad = '';

    const field4 = parts[4]?.trim() || '';
    const field5 = parts[5]?.trim() || '';

    if (field4 === '' && (field5 === 'M' || field5 === 'F')) {
      // Sin segundo nombre: idx 1=nombre, 2=apellido1, 3=apellido2, 4=vacío, 5=sexo
      primerNombre = parts[1]?.trim() || '';
      segundoNombre = '';
      primerApellido = parts[2]?.trim() || '';
      segundoApellido = parts[3]?.trim() || '';
      sexo = field5;
      provincia = parts[6]?.trim() || '';
      fechaRaw = parts[7]?.trim() || '';
      nacionalidad = parts[8]?.trim() || '';
    } else {
      // Con segundo nombre: idx 1=nombre, 2=nombre2, 3=apellido1, 4=apellido2, 5=sexo
      primerNombre = parts[1]?.trim() || '';
      segundoNombre = parts[2]?.trim() || '';
      primerApellido = parts[3]?.trim() || '';
      segundoApellido = parts[4]?.trim() || '';
      sexo = parts[5]?.trim() || '';
      provincia = parts[6]?.trim() || '';
      fechaRaw = parts[7]?.trim() || '';
      nacionalidad = parts[8]?.trim() || '';
    }

    // Convertir fecha de yyyymmdd → yyyy-mm-dd
    let fechaNacimiento: string | undefined;
    if (fechaRaw && fechaRaw.length === 8 && /^\d{8}$/.test(fechaRaw)) {
      fechaNacimiento = `${fechaRaw.slice(0, 4)}-${fechaRaw.slice(4, 6)}-${fechaRaw.slice(6, 8)}`;
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
      cedula,
      nombreCompleto,
      primerNombre,
      segundoNombre,
      apellidoCompleto,
      primerApellido,
      segundoApellido,
      sexo,
      fechaNacimiento,
      provinciaNacimiento: provincia || undefined,
      nacionalidad: mapNacionalidad(nacionalidad) || undefined,
    };
  } catch (error) {
    console.error('Error parseando QR de cédula:', error);
    return null;
  }
}

/**
 * Mapea la nacionalidad del QR (ej. "PANAMEÑA") al nombre de país estándar
 */
function mapNacionalidad(raw: string): string {
  if (!raw) return '';
  const upper = raw.toUpperCase();
  const map: Record<string, string> = {
    'PANAMEÑA': 'Panamá',
    'PANAMENA': 'Panamá',
    'COLOMBIANA': 'Colombia',
    'VENEZOLANA': 'Venezuela',
    'COSTARRICENSE': 'Costa Rica',
    'MEXICANA': 'México',
    'ESTADOUNIDENSE': 'Estados Unidos',
    'AMERICANA': 'Estados Unidos',
    'ESPAÑOLA': 'España',
    'ESPANOLA': 'España',
    'BRASILEÑA': 'Brasil',
    'BRASILENA': 'Brasil',
    'DOMINICANA': 'República Dominicana',
    'ECUATORIANA': 'Ecuador',
    'PERUANA': 'Perú',
    'CHILENA': 'Chile',
    'ARGENTINA': 'Argentina',
    'NICARAGÜENSE': 'Nicaragua',
    'NICARAGUENSE': 'Nicaragua',
    'HONDUREÑA': 'Honduras',
    'HONDURENA': 'Honduras',
    'SALVADOREÑA': 'El Salvador',
    'SALVADORENA': 'El Salvador',
    'GUATEMALTECA': 'Guatemala',
    'CUBANA': 'Cuba',
    'HAITIANA': 'Haití',
    'CHINA': 'China',
    'INDIA': 'India',
  };
  return map[upper] || raw;
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
