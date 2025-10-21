// Deterministic classifier for cases (NO AI)
// Uses keyword matching to classify incoming emails

import type { Database } from '@/lib/database.types';

type CaseSection = Database['public']['Enums']['case_section_enum'];
type CaseType = Database['public']['Enums']['case_type_enum'];

// Keywords para clasificación
const ASEGURADORAS_KEYWORDS: Record<string, string[]> = {
  'ASSA': ['assa', 'assa compañía', 'assa.com'],
  'MAPFRE': ['mapfre', 'mapfre panama'],
  'FEDPA': ['fedpa', 'federación'],
  'VIVIR': ['vivir seguros', 'vivir'],
  'SURA': ['sura', 'seguros sura'],
  'QUALITAS': ['qualitas', 'quálitas'],
  'ACERTA': ['acerta'],
};

const CASE_TYPE_KEYWORDS: Record<string, string[]> = {
  'COTIZACION': ['cotizar', 'cotización', 'cot.', 'quote', 'presupuesto'],
  'EMISION_GENERAL': ['emitir', 'emisión', 'nueva póliza', 'nueva poliza'],
  'EMISION_VIDA_ASSA_WEB': ['vida assa web', 'assa web'],
  'REHABILITACION': ['rehabilitar', 'rehabilitación'],
  'MODIFICACION': ['modificar', 'modificación'],
  'CANCELACION': ['cancelar', 'cancelación'],
  'CAMBIO_CORREDOR': ['cambio de corredor', 'transfer'],
  'RECLAMO': ['reclamo', 'siniestro', 'claim'],
};

const TIPO_POLIZA_KEYWORDS: Record<string, string[]> = {
  'VIDA_ASSA': ['vida assa'],
  'VIDA_WEB': ['vida web'],
  'SALUD': ['salud', 'health'],
  'AUTO': ['auto', 'vehículo', 'vehiculo'],
  'MOTO': ['moto'],
  'INCENDIO': ['incendio', 'fire'],
  'RC': ['responsabilidad civil', 'rc'],
};

export interface ClassificationResult {
  insurer_name: string | null;
  case_type: CaseType | null;
  policy_type_hint: string | null;
  section: CaseSection;
  ticket_ref: string | null;
  confidence: number;
}

/**
 * Normalizes text for classification
 * Removes Fw:/Re:, signatures, disclaimers, tildes
 */
export function normalizeText(text: string): string {
  // Remove Fw:, Re:, FWD:, etc.
  text = text.replace(/^(re|fw|fwd):\s*/gi, '').trim();
  
  // Remove common signatures
  const signaturePatterns = [
    /--\s*\n.*$/gis,
    /enviado desde mi iphone/gi,
    /sent from my/gi,
    /saludos cordiales.*$/gis,
    /atentamente.*$/gis,
  ];
  
  signaturePatterns.forEach(pattern => {
    text = text.replace(pattern, '');
  });
  
  // Remove legal disclaimers
  text = text.replace(/este correo es confidencial.*/gis, '');
  text = text.replace(/confidentiality notice.*/gis, '');
  
  // Normalize to lowercase
  text = text.toLowerCase();
  
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Detects insurer from text using keywords
 */
export function detectInsurer(subject: string, body: string): string | null {
  const text = normalizeText(subject + ' ' + body);
  
  for (const [insurer, keywords] of Object.entries(ASEGURADORAS_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return insurer;
    }
  }
  
  return null;
}

/**
 * Detects case type (gestion type) from text
 */
export function detectCaseType(subject: string, body: string): CaseType | null {
  const text = normalizeText(subject + ' ' + body);
  
  for (const [caseType, keywords] of Object.entries(CASE_TYPE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return caseType as CaseType;
    }
  }
  
  return null;
}

/**
 * Detects policy type hint from text
 */
export function detectPolicyType(subject: string, body: string): string | null {
  const text = normalizeText(subject + ' ' + body);
  
  for (const [policyType, keywords] of Object.entries(TIPO_POLIZA_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return policyType;
    }
  }
  
  return null;
}

/**
 * Detects ASSA ticket reference
 * Patterns: TICKET #12345, Ticket: 12345, REF: 12345, Caso #12345
 */
export function detectAssaTicket(subject: string, body: string): string | null {
  const text = subject + ' ' + body;
  
  const patterns = [
    /TICKET\s*#?\s*(\d+)/i,
    /Ticket:\s*(\d+)/i,
    /REF:\s*(\d+)/i,
    /Caso\s*#?\s*(\d+)/i,
    /Referencia:\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Determines section based on insurer and policy type
 */
export function determineSection(
  insurerName: string | null,
  policyTypeHint: string | null
): CaseSection {
  // ASSA Vida goes to special section
  if (insurerName === 'ASSA' && policyTypeHint?.includes('VIDA')) {
    return 'VIDA_ASSA';
  }
  
  // Other Personas products
  if (policyTypeHint && ['VIDA_WEB', 'SALUD', 'AP', 'COLECTIVO'].includes(policyTypeHint)) {
    return 'OTROS_PERSONAS';
  }
  
  // Generales products
  if (policyTypeHint && ['AUTO', 'MOTO', 'TAXI', 'INCENDIO', 'MULTIPOLIZA', 'RC'].includes(policyTypeHint)) {
    return 'RAMOS_GENERALES';
  }
  
  // Default to sin clasificar
  return 'SIN_CLASIFICAR';
}

/**
 * Tries to guess client name from email content
 */
export function guessClientName(subject: string, body: string): string | null {
  // Try to find patterns like "Cliente: Juan Pérez" or "Asegurado: Maria Lopez"
  const patterns = [
    /(?:cliente|asegurado|solicitante|titular):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:para|de)\s+(?:el\s+sr\.|la\s+sra\.|sr\.|sra\.)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];
  
  const text = subject + ' ' + body;
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Main classification function
 * Returns classification result with confidence level
 */
export function classifyEmail(
  subject: string,
  body: string
): ClassificationResult {
  const insurerName = detectInsurer(subject, body);
  const caseType = detectCaseType(subject, body);
  const policyTypeHint = detectPolicyType(subject, body);
  const ticketRef = detectAssaTicket(subject, body);
  const section = determineSection(insurerName, policyTypeHint);
  
  // Calculate confidence (0-1)
  let confidence = 0;
  if (insurerName) confidence += 0.3;
  if (caseType) confidence += 0.3;
  if (policyTypeHint) confidence += 0.2;
  if (section !== 'SIN_CLASIFICAR') confidence += 0.2;
  
  return {
    insurer_name: insurerName,
    case_type: caseType,
    policy_type_hint: policyTypeHint,
    section,
    ticket_ref: ticketRef,
    confidence,
  };
}

/**
 * Analyzes email content to suggest status based on ASSA ticket response
 */
export function suggestStatusFromContent(body: string): string | null {
  const text = normalizeText(body);
  
  // Patterns for approved/emitted
  if (
    text.includes('aprobado') ||
    text.includes('emitida') ||
    text.includes('emitido') ||
    text.includes('póliza generada')
  ) {
    return 'APROBADO_PEND_PAGO';
  }
  
  // Patterns for missing documents
  if (
    text.includes('falta') ||
    text.includes('pendiente') ||
    text.includes('requerimos') ||
    text.includes('necesitamos') ||
    text.includes('documentación')
  ) {
    return 'FALTA_DOC';
  }
  
  // Patterns for rejected
  if (
    text.includes('rechazado') ||
    text.includes('denegado') ||
    text.includes('no aprobado')
  ) {
    return 'RECHAZADO';
  }
  
  // Patterns for in process
  if (
    text.includes('en proceso') ||
    text.includes('revisión') ||
    text.includes('evaluando')
  ) {
    return 'EN_PROCESO';
  }
  
  return null;
}
