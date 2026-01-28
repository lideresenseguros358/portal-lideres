/**
 * Mapper dinámico de coberturas
 * Convierte los valores estándar del formulario a formatos específicos de cada aseguradora
 */

export interface CoverageValues {
  // Lesiones corporales
  lesionCorporalPersona: number;
  lesionCorporalAccidente: number;
  
  // Daños a propiedad
  danoPropiedad: number;
  
  // Gastos médicos
  gastosMedicosPersona: number;
  gastosMedicosAccidente: number;
  
  // Deducible
  deducible: string; // 'bajo', 'medio', 'alto'
  
  // Valor del vehículo
  valorVehiculo: number;
}

/**
 * Opciones estándar de coberturas
 * Estas son las opciones que se muestran en el UI
 */
export const STANDARD_COVERAGE_OPTIONS = {
  lesionCorporal: [
    { persona: 5000, accidente: 10000 },
    { persona: 10000, accidente: 20000 },
    { persona: 25000, accidente: 50000 },
    { persona: 50000, accidente: 100000 },
    { persona: 100000, accidente: 300000 },
  ],
  danoPropiedad: [5000, 10000, 15000, 25000, 50000, 100000],
  gastosMedicos: [
    { persona: 500, accidente: 2500 },
    { persona: 2000, accidente: 10000 },
    { persona: 5000, accidente: 25000 },
    { persona: 10000, accidente: 50000 },
  ],
  deducible: {
    bajo: 250,
    medio: 500,
    alto: 1000,
  },
} as const;

/**
 * Mapper para Internacional de Seguros (IS)
 */
export function mapToIS(values: CoverageValues): any {
  return {
    // IS usa códigos específicos para coberturas
    lesionCorporalPersona: values.lesionCorporalPersona,
    lesionCorporalAccidente: values.lesionCorporalAccidente,
    danoPropiedad: values.danoPropiedad,
    gastosMedicosPersona: values.gastosMedicosPersona,
    gastosMedicosAccidente: values.gastosMedicosAccidente,
    deducible: STANDARD_COVERAGE_OPTIONS.deducible[values.deducible as keyof typeof STANDARD_COVERAGE_OPTIONS.deducible],
    sumaAsegurada: values.valorVehiculo,
    
    // Campos adicionales que requiere IS
    tipoPlan: determineTipoPlanIS(values),
    grupoTarifa: determineGrupoTarifaIS(values),
  };
}

/**
 * Mapper para FEDPA
 */
export function mapToFEDPA(values: CoverageValues): any {
  return {
    // FEDPA puede usar una estructura diferente
    coberturaLesiones: {
      porPersona: values.lesionCorporalPersona,
      porAccidente: values.lesionCorporalAccidente,
    },
    coberturaDanos: values.danoPropiedad,
    coberturaGastosMedicos: {
      porPersona: values.gastosMedicosPersona,
      porAccidente: values.gastosMedicosAccidente,
    },
    deducible: STANDARD_COVERAGE_OPTIONS.deducible[values.deducible as keyof typeof STANDARD_COVERAGE_OPTIONS.deducible],
    valorAsegurado: values.valorVehiculo,
    
    // Campos adicionales de FEDPA
    planSeleccionado: determinePlanFEDPA(values),
  };
}

/**
 * Determinar tipo de plan para IS basado en coberturas
 */
function determineTipoPlanIS(values: CoverageValues): string {
  // Lógica para determinar el plan según los valores seleccionados
  if (values.lesionCorporalPersona >= 50000) {
    return 'PREMIUM';
  } else if (values.lesionCorporalPersona >= 25000) {
    return 'PLUS';
  } else {
    return 'BASICO';
  }
}

/**
 * Determinar grupo de tarifa para IS
 */
function determineGrupoTarifaIS(values: CoverageValues): string {
  // Lógica para determinar grupo de tarifa
  const totalCobertura = values.lesionCorporalAccidente + values.danoPropiedad;
  
  if (totalCobertura >= 200000) {
    return 'A'; // Cobertura alta
  } else if (totalCobertura >= 100000) {
    return 'B'; // Cobertura media
  } else {
    return 'C'; // Cobertura básica
  }
}

/**
 * Determinar plan para FEDPA basado en coberturas
 */
function determinePlanFEDPA(values: CoverageValues): string {
  if (values.lesionCorporalPersona >= 50000) {
    return 'COMPLETO_PLUS';
  } else if (values.lesionCorporalPersona >= 25000) {
    return 'COMPLETO';
  } else {
    return 'ESTANDAR';
  }
}

/**
 * Mapper genérico que selecciona el mapper correcto según la aseguradora
 */
export function mapCoverageValues(
  values: CoverageValues,
  insurerSlug: 'INTERNACIONAL' | 'FEDPA' | string
): any {
  switch (insurerSlug) {
    case 'INTERNACIONAL':
      return mapToIS(values);
    case 'FEDPA':
      return mapToFEDPA(values);
    default:
      // Para aseguradoras futuras, retornar valores estándar
      console.warn(`Mapper no encontrado para ${insurerSlug}, usando valores estándar`);
      return {
        lesionCorporalPersona: values.lesionCorporalPersona,
        lesionCorporalAccidente: values.lesionCorporalAccidente,
        danoPropiedad: values.danoPropiedad,
        gastosMedicosPersona: values.gastosMedicosPersona,
        gastosMedicosAccidente: values.gastosMedicosAccidente,
        deducible: STANDARD_COVERAGE_OPTIONS.deducible[values.deducible as keyof typeof STANDARD_COVERAGE_OPTIONS.deducible],
        valorVehiculo: values.valorVehiculo,
      };
  }
}

/**
 * Validar que los valores seleccionados estén dentro de las opciones estándar
 */
export function validateCoverageValues(values: CoverageValues): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validar lesión corporal
  const lesionValid = STANDARD_COVERAGE_OPTIONS.lesionCorporal.some(
    opt => opt.persona === values.lesionCorporalPersona && opt.accidente === values.lesionCorporalAccidente
  );
  if (!lesionValid) {
    errors.push('Valor de lesión corporal no válido');
  }
  
  // Validar daño a propiedad
  if (!STANDARD_COVERAGE_OPTIONS.danoPropiedad.includes(values.danoPropiedad)) {
    errors.push('Valor de daño a propiedad no válido');
  }
  
  // Validar gastos médicos
  const gastosValid = STANDARD_COVERAGE_OPTIONS.gastosMedicos.some(
    opt => opt.persona === values.gastosMedicosPersona && opt.accidente === values.gastosMedicosAccidente
  );
  if (!gastosValid) {
    errors.push('Valor de gastos médicos no válido');
  }
  
  // Validar deducible
  if (!['bajo', 'medio', 'alto'].includes(values.deducible)) {
    errors.push('Deducible no válido');
  }
  
  // Validar valor del vehículo
  if (values.valorVehiculo < 5000 || values.valorVehiculo > 100000) {
    errors.push('Valor del vehículo debe estar entre $5,000 y $100,000');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
