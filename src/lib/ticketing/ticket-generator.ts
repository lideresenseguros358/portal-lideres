// =====================================================
// TICKET GENERATION ENGINE
// =====================================================

import type { TicketComponents } from './types';

/**
 * Parsea un ticket de 12 dígitos en sus componentes
 * Formato: [AAMM][RAMO][ASEG][TRAMITE][CORRELATIVO]
 * Ejemplo: 260103010001 → 26/01 + 03 + 01 + 01 + 001
 */
export function parseTicket(ticket: string): TicketComponents | null {
  if (!ticket || ticket.length !== 12 || !/^\d{12}$/.test(ticket)) {
    return null;
  }

  return {
    yearMonth: ticket.substring(0, 4), // 2601
    ramoCode: ticket.substring(4, 6), // 03
    aseguradoraCode: ticket.substring(6, 8), // 01
    tramiteCode: ticket.substring(8, 10), // 01
    correlative: ticket.substring(10, 12), // 001
    fullTicket: ticket,
  };
}

/**
 * Formatea los componentes del ticket para display
 */
export function formatTicketDisplay(ticket: string): string {
  const components = parseTicket(ticket);
  if (!components) return ticket;

  const year = '20' + components.yearMonth.substring(0, 2);
  const month = components.yearMonth.substring(2, 4);
  
  return `${year}/${month}-${components.ramoCode}${components.aseguradoraCode}${components.tramiteCode}-${components.correlative}`;
}

/**
 * Valida que los códigos sean válidos para generar ticket
 */
export function validateTicketCodes(
  ramoCode: string | null | undefined,
  aseguradoraCode: string | null | undefined,
  tramiteCode: string | null | undefined
): boolean {
  if (!ramoCode || !aseguradoraCode || !tramiteCode) {
    return false;
  }

  // Validar formato de códigos
  const ramoValid = /^\d{2}$/.test(ramoCode) && parseInt(ramoCode) >= 1 && parseInt(ramoCode) <= 99;
  const asegValid = /^\d{2}$/.test(aseguradoraCode) && parseInt(aseguradoraCode) >= 1 && parseInt(aseguradoraCode) <= 99;
  const tramiteValid = /^\d{1,2}$/.test(tramiteCode) && parseInt(tramiteCode) >= 1 && parseInt(tramiteCode) <= 99;

  return ramoValid && asegValid && tramiteValid;
}

/**
 * Determina si un caso está listo para generar ticket
 */
export function canGenerateTicket(
  ramoCode: string | null | undefined,
  aseguradoraCode: string | null | undefined,
  tramiteCode: string | null | undefined,
  section: string | null | undefined
): boolean {
  // No generar para casos sin clasificar
  if (section === 'SIN_CLASIFICAR') {
    return false;
  }

  return validateTicketCodes(ramoCode, aseguradoraCode, tramiteCode);
}

/**
 * Obtiene el nombre del mes en español desde AAMM
 */
export function getMonthNameFromYearMonth(yearMonth: string): string {
  if (yearMonth.length !== 4) return '';
  
  const monthNum = parseInt(yearMonth.substring(2, 4), 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return '';
  }
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const month = months[monthNum - 1];
  return month || '';
}

/**
 * Obtiene el año completo desde AAMM
 */
export function getYearFromYearMonth(yearMonth: string): string {
  if (yearMonth.length !== 4) return '';
  return '20' + yearMonth.substring(0, 2);
}

/**
 * Crea un objeto con metadata del ticket para logs
 */
export function createTicketMetadata(
  ramoCode: string,
  aseguradoraCode: string,
  tramiteCode: string,
  correlative: number
): Record<string, any> {
  const yearMonth = new Date().toISOString().substring(2, 7).replace('-', '');
  
  return {
    year_month: yearMonth,
    ramo_code: ramoCode,
    aseguradora_code: aseguradoraCode,
    tramite_code: tramiteCode,
    correlative,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Genera un ticket temporal para preview (sin guardar en BD)
 */
export function generatePreviewTicket(
  ramoCode: string,
  aseguradoraCode: string,
  tramiteCode: string
): string {
  const now = new Date();
  const year = now.getFullYear().toString().substring(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const yearMonth = year + month;
  
  const ramo = ramoCode.padStart(2, '0');
  const aseg = aseguradoraCode.padStart(2, '0');
  const tramite = tramiteCode.padStart(2, '0');
  const correlative = '000'; // Preview siempre muestra 000
  
  return `${yearMonth}${ramo}${aseg}${tramite}${correlative}`;
}
