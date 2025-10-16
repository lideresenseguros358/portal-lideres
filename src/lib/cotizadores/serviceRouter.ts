/**
 * Service Router - Enruta cotizaciones según tipo de póliza
 * Preparado para reemplazar mocks por APIs reales
 */

import type { QuoteInputBase, QuoteResult, AutoQuoteInput, VidaQuoteInput, FireContentsQuoteInput } from './types';
import { quoteAuto } from './services/auto/all-insurers.mock';
import { quoteVidaASSA } from './services/vida/assa.mock';
import { quoteFuegoTwo } from './services/fuego/two-insurers.mock';

export async function quoteByPolicyType(input: QuoteInputBase): Promise<QuoteResult> {
  switch (input.policyType) {
    case 'AUTO':
      return quoteAuto(input as AutoQuoteInput);
    
    case 'VIDA':
      return quoteVidaASSA(input as VidaQuoteInput);
    
    case 'INCENDIO':
      return quoteFuegoTwo(input as FireContentsQuoteInput);
    
    case 'CONTENIDO':
      return quoteFuegoTwo(input as FireContentsQuoteInput);
    
    default:
      throw new Error(`Tipo de póliza no soportado: ${(input as any).policyType}`);
  }
}

/**
 * Función para enriquecer opciones con logos reales de aseguradoras
 * Conecta con el sistema existente de aseguradoras
 */
export function enrichWithInsurerLogos(
  options: QuoteResult['options'],
  insurersMap: Map<string, { logo_url?: string | null }>
): QuoteResult['options'] {
  return options.map(option => {
    // Buscar aseguradora por nombre (normalizado)
    const insurerKey = option.insurerName.toUpperCase();
    const insurer = insurersMap.get(insurerKey);
    
    return {
      ...option,
      insurerLogoUrl: insurer?.logo_url || option.insurerLogoUrl
    };
  });
}
