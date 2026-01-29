/**
 * Features Premium de FEDPA - Endoso Porcelana
 * Diferencias entre Básico (Full Extras) y Premium (Porcelana)
 */

import type { PremiumFeature } from './types';

/**
 * Obtiene las mejoras del plan Premium vs Básico
 */
export function getFedpaPremiumFeatures(): PremiumFeature[] {
  return [
    {
      nombre: 'Pérdida de efectos personales',
      descripcion: 'Cobertura para objetos personales dentro del vehículo en caso de robo o accidente',
      valorBasico: 'hasta B/. 100',
      valorPremium: 'hasta B/. 300',
      mejora: '+200%'
    },
    {
      nombre: 'Auto de alquiler por Colisión/Vuelco',
      descripcion: 'Días de vehículo de reemplazo mientras el tuyo está en reparación',
      valorBasico: '10 días',
      valorPremium: '15 días',
      mejora: '+5 días'
    },
    {
      nombre: 'Descuento GPS en deducible',
      descripcion: 'Descuento en deducibles si tu vehículo tiene GPS activo al momento de robo total',
      valorBasico: 'No incluido',
      valorPremium: '20% de descuento',
      mejora: 'Ahorro adicional'
    }
  ];
}

/**
 * Calcula precio al contado con descuento pronto pago
 * FEDPA aplica descuento cuando se paga en 1 cuota
 */
export function calcularPrecioContado(totalConTarjeta: number): number {
  // Según políticas FEDPA, el descuento de pronto pago es ~10%
  // Se aplica en emisión cuando cuotas = 1
  const descuentoProntoPago = 0.10; // 10%
  return totalConTarjeta * (1 - descuentoProntoPago);
}

/**
 * Tooltip para deducible
 */
export function getDeducibleTooltip(tipoDeducible: 'bajo' | 'medio' | 'alto'): string {
  const tooltips = {
    bajo: 'Deducible Bajo (~$300): Pagas menos en caso de reclamo, pero prima más alta.',
    medio: 'Deducible Medio (~$450): Balance entre prima y deducible.',
    alto: 'Deducible Alto (~$608): Pagas más en caso de reclamo, pero prima más baja.'
  };
  return tooltips[tipoDeducible] || '';
}

/**
 * Tooltip para endosos
 */
export function getEndosoTooltip(tipo: 'basico' | 'premium'): string {
  if (tipo === 'premium') {
    return 'Endoso Porcelana: Cobertura máxima con beneficios adicionales incluyendo mayor cobertura de efectos personales, más días de auto de alquiler y descuento GPS.';
  }
  return 'Endoso Full Extras: Cobertura estándar completa con todos los beneficios base incluidos.';
}

/**
 * Tooltip para precios
 */
export const preciosTooltips = {
  contado: 'Precio al Contado (1 cuota): Incluye descuento de pronto pago del 10%. Aplica para pago único con tarjeta, transferencia o ACH.',
  tarjeta: 'Precio con Tarjeta (2-10 cuotas): Precio estándar sin descuento. Puedes dividir el pago en hasta 10 cuotas mensuales.',
  deducible: 'Deducible: Es la cantidad que pagas de tu bolsillo en caso de un reclamo. Ejemplo: si tu auto sufre $5,000 en daños y tu deducible es $300, pagas $300 y el seguro cubre $4,700.'
};
