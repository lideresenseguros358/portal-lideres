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
 *
 * Formato real del QR (pipe-delimited):
 *
 * SIN segundo nombre (campo vacío en [3], sexo en [4]):
 *   [0] cédula | [1] primerNombre | [2] "primerApellido segundoApellido" | [3] (vacío) | [4] sexo(M/F) | [5] provincia | [6] fechaNac(yyyymmdd) | [7] nacionalidad | ...
 *
 * CON segundo nombre (campo vacío en [4], sexo en [5]):
 *   [0] cédula | [1] primerNombre | [2] segundoNombre | [3] "primerApellido segundoApellido" | [4] (vacío) | [5] sexo(M/F) | [6] provincia | [7] fechaNac(yyyymmdd) | [8] nacionalidad | ...
 */
export function parseCedulaQR(qrText: string): CedulaQRData | null {
  try {
    // Split por pipe — NO trim general, para preservar campos vacíos
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

    let primerNombre = '';
    let segundoNombre = '';
    let apellidosRaw = '';
    let sexo = '';
    let provincia = '';
    let fechaRaw = '';
    let nacionalidad = '';

    // Detectar formato:
    // Sin 2do nombre → parts[3] vacío, parts[4] es M/F
    // Con 2do nombre → parts[4] vacío, parts[5] es M/F
    const f3 = parts[3]?.trim() || '';
    const f4 = parts[4]?.trim() || '';
    const f5 = parts[5]?.trim() || '';

    if (f3 === '' && (f4 === 'M' || f4 === 'F')) {
      // SIN segundo nombre
      primerNombre = parts[1]?.trim() || '';
      segundoNombre = '';
      apellidosRaw = parts[2]?.trim() || '';
      sexo = f4;
      provincia = parts[5]?.trim() || '';
      fechaRaw = parts[6]?.trim() || '';
      nacionalidad = parts[7]?.trim() || '';
    } else if (f4 === '' && (f5 === 'M' || f5 === 'F')) {
      // CON segundo nombre
      primerNombre = parts[1]?.trim() || '';
      segundoNombre = parts[2]?.trim() || '';
      apellidosRaw = parts[3]?.trim() || '';
      sexo = f5;
      provincia = parts[6]?.trim() || '';
      fechaRaw = parts[7]?.trim() || '';
      nacionalidad = parts[8]?.trim() || '';
    } else {
      // Fallback: intentar sin segundo nombre con offset simple
      primerNombre = parts[1]?.trim() || '';
      segundoNombre = '';
      apellidosRaw = parts[2]?.trim() || '';
      sexo = f4 || f5 || '';
      provincia = parts[5]?.trim() || parts[6]?.trim() || '';
      fechaRaw = parts[6]?.trim() || parts[7]?.trim() || '';
      nacionalidad = parts[7]?.trim() || parts[8]?.trim() || '';
    }

    // Separar apellidos (vienen juntos en un campo separados por espacio)
    const apellidoParts = apellidosRaw.split(/\s+/).filter(Boolean);
    const primerApellido = apellidoParts[0] || '';
    const segundoApellido = apellidoParts.slice(1).join(' ') || '';

    // Convertir fecha de yyyymmdd → yyyy-mm-dd
    let fechaNacimiento: string | undefined;
    if (fechaRaw && fechaRaw.length === 8 && /^\d{8}$/.test(fechaRaw)) {
      fechaNacimiento = `${fechaRaw.slice(0, 4)}-${fechaRaw.slice(4, 6)}-${fechaRaw.slice(6, 8)}`;
    }

    // Aplicar formato título a nombres
    primerNombre = formatNombre(primerNombre);
    segundoNombre = segundoNombre ? formatNombre(segundoNombre) : '';
    const fmtPrimerApellido = formatNombre(primerApellido);
    const fmtSegundoApellido = segundoApellido ? formatNombre(segundoApellido) : '';

    // Construir nombres y apellidos completos
    const nombreCompleto = [primerNombre, segundoNombre]
      .filter(Boolean)
      .join(' ')
      .trim();

    const apellidoCompleto = [fmtPrimerApellido, fmtSegundoApellido]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      cedula,
      nombreCompleto,
      primerNombre,
      segundoNombre,
      apellidoCompleto,
      primerApellido: fmtPrimerApellido,
      segundoApellido: fmtSegundoApellido,
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
