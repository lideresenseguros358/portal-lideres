/**
 * Converts raw insurer API error messages into user-friendly Spanish text.
 * Applied in EmissionLoadingModal — covers ANCON, FEDPA, REGIONAL, and INTERNACIONAL.
 */

const CONTACT = 'contacto@lideresenseguros.com';

export function formatEmissionError(raw: string | null | undefined): string {
  if (!raw) return `Ocurrió un error inesperado. Por favor intente nuevamente o contáctenos: ${CONTACT}`;

  const e = raw;
  const el = e.toLowerCase();

  // ── Vehicle already insured ──
  // ANCON: "El No Motor B061H983 esta Asegurado en la Póliza 0226-05249-09 y con la Vigencia Final del 08/04/2027."
  // REGIONAL / others: may say "ya existe póliza", "vehículo asegurado", etc.
  if (
    el.includes('asegurado en la póliza') ||
    el.includes('asegurado en la poliza') ||
    el.includes('esta asegurado') ||
    el.includes('está asegurado') ||
    (el.includes('asegurado') && (el.includes('póliza') || el.includes('poliza'))) ||
    el.includes('vehiculo asegurado') ||
    el.includes('vehículo asegurado') ||
    (el.includes('ya existe') && (el.includes('póliza') || el.includes('poliza')))
  ) {
    const policyMatch = e.match(/[Pp][oó]liza\s+([\d\w-]+)/);
    const policyNum = policyMatch?.[1] || '';
    const vigMatch = e.match(/[Vv]igencia [Ff]inal del ([^.]+)/);
    const vigencia = vigMatch?.[1]?.trim() || '';
    return (
      `Este vehículo ya se encuentra asegurado${policyNum ? ` bajo la póliza ${policyNum}` : ''}` +
      `${vigencia ? ` (vigente hasta el ${vigencia})` : ''}.` +
      ` Póngase en contacto con un administrativo para que lo oriente: ${CONTACT}`
    );
  }

  // ── Token expired / auth failure ──
  if (/token inactivo/i.test(e) || /token.*expirado/i.test(e)) {
    return 'Se interrumpió la comunicación con la aseguradora. Por favor intente nuevamente en unos momentos.';
  }

  // ── Duplicate client — Regional ORA-01422 ──
  if (/ORA-01422/i.test(e) || el.includes('conflicto con los datos del cliente')) {
    return `La aseguradora encontró un conflicto con los datos del cliente. Contacte a un administrativo: ${CONTACT}`;
  }

  // ── Network / DB link timeout — Regional ORA-03150 and similar ──
  if (/ORA-03150|ORA-03113|ORA-03114|ORA-12170|ORA-02063|end-of-file|ETIMEDOUT|ECONNRESET|socket hang up/i.test(e)) {
    return 'La aseguradora no responde en este momento. Por favor intente nuevamente en unos minutos.';
  }

  // ── Vehicle not in insurer catalog — FEDPA AUT_MODELO_FK ──
  if (/AUT_MODELO_FK/i.test(e)) {
    return `El modelo de vehículo no está en el catálogo de la aseguradora. Contacte a un administrativo: ${CONTACT}`;
  }

  // ── Quote already emitted ──
  if ((el.includes('cotizaci') && el.includes('emitida')) || el.includes('ya fue emitida')) {
    return 'Esta cotización ya fue utilizada para emitir una póliza. Por favor genere una nueva cotización.';
  }

  // ── Insurer server down (from our own translated messages) ──
  if (el.includes('no responde') || (el.includes('servidor') && el.includes('no está'))) {
    return `La aseguradora no está disponible en este momento. Por favor intente nuevamente en unos minutos o contacte: ${CONTACT}`;
  }

  // ── Generic ORA / technical codes — strip and fallback ──
  const hasTechCode = /\bORA-\d+\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(e);
  if (!hasTechCode && e.length <= 300) {
    // Message is already readable — pass it through as-is
    return e;
  }

  return `No se pudo completar la emisión. Contacte a un administrativo para recibir asistencia: ${CONTACT}`;
}
