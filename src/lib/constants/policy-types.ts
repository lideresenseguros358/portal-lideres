// Tipos de póliza disponibles en el sistema
export const POLICY_TYPES = [
  { value: 'AUTO', label: '🚗 Auto' },
  { value: 'VIDA', label: '❤️ Vida' },
  { value: 'SALUD', label: '🏥 Salud' },
  { value: 'INCENDIO', label: '🔥 Incendio' },
  { value: 'TODO RIESGO', label: '🛡️ Todo Riesgo' },
  { value: 'RESPONSABILIDAD CIVIL', label: '⚖️ Responsabilidad Civil' },
  { value: 'ACCIDENTES PERSONALES', label: '🚑 Accidentes Personales' },
  { value: 'TRANSPORTE', label: '🚚 Transporte' },
  { value: 'HOGAR', label: '🏠 Hogar' },
  { value: 'OTROS', label: '📋 Otros' },
] as const;

export type PolicyType = typeof POLICY_TYPES[number]['value'];

// Condiciones especiales de override
export const SPECIAL_OVERRIDE_CONDITIONS = {
  ASSA_VIDA: {
    insurerName: 'ASSA',
    policyType: 'VIDA',
    overridePercent: 1.0,
    description: 'ASSA + VIDA siempre tiene 1.0% de comisión',
    isProtected: true, // No se afecta por cambios masivos
  }
} as const;

/**
 * Verifica si una póliza cumple con una condición especial de override
 */
export function checkSpecialOverride(
  insurerName: string | null | undefined,
  policyType: string | null | undefined
): { hasSpecialOverride: boolean; overrideValue: number | null; condition?: string } {
  if (!insurerName || !policyType) {
    return { hasSpecialOverride: false, overrideValue: null };
  }

  // Normalizar nombres para comparación
  const normalizedInsurer = insurerName.trim().toUpperCase();
  const normalizedType = policyType.trim().toUpperCase();

  // Verificar condición ASSA + VIDA
  if (
    normalizedInsurer.includes(SPECIAL_OVERRIDE_CONDITIONS.ASSA_VIDA.insurerName) &&
    normalizedType === SPECIAL_OVERRIDE_CONDITIONS.ASSA_VIDA.policyType
  ) {
    return {
      hasSpecialOverride: true,
      overrideValue: SPECIAL_OVERRIDE_CONDITIONS.ASSA_VIDA.overridePercent,
      condition: 'ASSA_VIDA'
    };
  }

  return { hasSpecialOverride: false, overrideValue: null };
}
