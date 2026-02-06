/**
 * Normalizador de Catálogos entre Aseguradoras
 * Mapea códigos de IS a códigos de FEDPA
 */

// Mapeo de marcas de vehículos a códigos de USO de FEDPA
export const VEHICLE_MARCA_TO_FEDPA_USO: Record<number, string> = {
  // Autos particulares (USO 10)
  156: '10', // Toyota
  148: '10', // Hyundai
  86: '10',  // Kia
  113: '10', // Nissan
  74: '10',  // Suzuki
  217: '10', // Geely
  204: '10', // Honda
  // Agregar más marcas según sea necesario
};

// Valor por defecto si no se encuentra la marca
export const DEFAULT_FEDPA_USO = '10'; // Auto Particular

/**
 * Mapeo de códigos IS a códigos FEDPA para Marca
 * IS usa números, FEDPA usa strings (abreviaciones)
 */
export const IS_TO_FEDPA_MARCA: Record<number, string> = {
  156: 'TOY',  // Toyota
  148: 'HYU',  // Hyundai
  86: 'KIA',   // Kia
  113: 'NIS',  // Nissan
  74: 'SUZ',   // Suzuki
  217: 'GEE',  // Geely
  204: 'HON',  // Honda
  // Agregar más según catálogo FEDPA
};

import { getFedpaMarcaFromIS, normalizarModeloFedpa } from './fedpa-vehicle-mapper';

/**
 * Obtener código FEDPA de marca desde código IS
 */
export function getFedpaMarcaCode(codigoMarcaIS: number, nombreMarca?: string): string {
  return getFedpaMarcaFromIS(codigoMarcaIS, nombreMarca);
}

/**
 * Mapear monto de lesiones corporales a código FEDPA
 * CODCOBERTURA 1 - Lesiones Corporales
 * Según documentación oficial FEDPA
 */
export function mapLesionesACodigo(montoPersona: number, montoAccidente: number): string {
  const limite = `${montoPersona.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}/${montoAccidente.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  
  // Mapeo exacto según catálogo FEDPA
  if (montoPersona >= 100000 && montoAccidente >= 300000) return '2'; // 100,000.00/300,000.00
  if (montoPersona >= 50000 && montoAccidente >= 100000) return '6'; // 50,000.00/100,000.00
  if (montoPersona >= 50000 && montoAccidente >= 50000) return '7'; // 50,000.00/50,000.00
  if (montoPersona >= 25000 && montoAccidente >= 50000) return '4'; // 25,000.00/50,000.00
  if (montoPersona >= 20000 && montoAccidente >= 40000) return '3'; // 20,000.00/40,000.00
  if (montoPersona >= 10000 && montoAccidente >= 20000) return '1'; // 10,000.00/20,000.00
  if (montoPersona >= 5000 && montoAccidente >= 10000) return '5'; // 5,000.00/10,000.00
  return '1'; // Default: 10,000.00/20,000.00
}

/**
 * Mapear monto de daños a la propiedad a código FEDPA
 * CODCOBERTURA 2 - Daños a la Propiedad
 * Según documentación oficial FEDPA
 */
export function mapDanosPropiedadACodigo(monto: number): string {
  // Mapeo exacto según catálogo FEDPA
  if (monto >= 100000) return '9'; // 100,000.00
  if (monto >= 50000) return '14'; // 50,000.00
  if (monto >= 25000) return '12'; // 25,000.00
  if (monto >= 20000) return '11'; // 20,000.00
  if (monto >= 15000) return '10'; // 15,000.00
  if (monto >= 10000) return '8'; // 10,000.00
  if (monto >= 5000) return '13'; // 5,000.00
  return '8'; // Default: 10,000.00
}

/**
 * Mapear monto de gastos médicos a código FEDPA
 * CODCOBERTURA 3 - Gastos Médicos
 * Según documentación oficial FEDPA
 */
export function mapGastosMedicosACodigo(montoPersona: number, montoAccidente: number): string {
  // Mapeo exacto según catálogo FEDPA
  if (montoPersona >= 15000 && montoAccidente >= 10000) return '25'; // 15,000.00/10,000.00
  if (montoPersona >= 10000 && montoAccidente >= 50000) return '16'; // 10,000.00/50,000.00
  if (montoPersona >= 5000 && montoAccidente >= 75000) return '21'; // 5,000.00/75,000.00
  if (montoPersona >= 5000 && montoAccidente >= 40000) return '20'; // 5,000.00/40,000.00
  if (montoPersona >= 5000 && montoAccidente >= 35000) return '19'; // 5,000.00/35,000.00
  if (montoPersona >= 5000 && montoAccidente >= 25000) return '18'; // 5,000.00/25,000.00
  if (montoPersona >= 3000 && montoAccidente >= 3000) return '26'; // 3,000.00/3,000.00
  if (montoPersona >= 2500 && montoAccidente >= 12500) return '27'; // 2,500.00/12,500.00
  if (montoPersona >= 2000 && montoAccidente >= 10000) return '17'; // 2,000.00/10,000.00
  if (montoPersona >= 1000 && montoAccidente >= 5000) return '15'; // 1,000.00/5,000.00
  if (montoPersona >= 500 && montoAccidente >= 2500) return '23'; // 500.00/2,500.00
  if (montoPersona >= 500 && montoAccidente >= 1000) return '22'; // 500.00/1,000.00
  return '17'; // Default: 2,000.00/10,000.00
}

/**
 * Obtener código de USO de FEDPA basado en marca de IS
 */
export function getUsoFromMarca(vcodmarca: number): string {
  return VEHICLE_MARCA_TO_FEDPA_USO[vcodmarca] || DEFAULT_FEDPA_USO;
}

/**
 * Determinar PLAN de FEDPA basado en tipo de cobertura y valor del vehículo
 * Según documentación FEDPA:
 * 
 * COBERTURA COMPLETA (CC):
 * - Plan 411: C.C. PARTICULAR (para todos los rangos de suma asegurada)
 * 
 * DAÑOS A TERCEROS (DT):
 * - Plan 412: D.T. COMERCIAL HASTA 4 TONELADAS
 * - Plan 416: D.T. TAXI
 * 
 * Los rangos específicos deben ser proporcionados por FEDPA
 */
export interface FedpaPlanConfig {
  plan: string;
  tipo: 'CC' | 'DT';
  minValue?: number;
  maxValue?: number;
  descripcion: string;
}

export const FEDPA_PLAN_CONFIGS: FedpaPlanConfig[] = [
  // COBERTURA COMPLETA - Según catálogo real FEDPA
  {
    plan: '411',
    tipo: 'CC',
    descripcion: 'C.C. PARTICULAR - SOLO PARA WEB SERVICES',
  },
  {
    plan: '461',
    tipo: 'CC',
    minValue: 3000,
    maxValue: 19999.99,
    descripcion: 'CC 3,000 A 19,999.99 - SOLO WEB SERVICES',
  },
  {
    plan: '462',
    tipo: 'CC',
    minValue: 20000,
    maxValue: 60000,
    descripcion: 'CC 20,000 A 60,000 - SOLO WEB SERVICES',
  },
  {
    plan: '463',
    tipo: 'CC',
    minValue: 60001,
    maxValue: 150000,
    descripcion: 'CC 60,001 A 150,000 - SOLO WEB SERVICES',
  },
  
  // DAÑOS A TERCEROS - Según catálogo real FEDPA
  {
    plan: '426',
    tipo: 'DT',
    descripcion: 'D.T. PARTICULARES',
  },
];

/**
 * Determinar PLAN de FEDPA basado en tipo de cobertura y valor del vehículo
 * Según catálogo oficial FEDPA
 */
export function getPlanFromCoberturaYValor(
  tipoCoberturaIS: number,
  valorVehiculo: number
): string {
  // CRÍTICO: Determinar tipo por RANGO de plan, no solo por valor exacto
  // FEDPA Cobertura Completa: 411-463
  // FEDPA Daños a Terceros: 426
  // IS Cobertura Completa: 14
  
  let tipoCobertura: 'CC' | 'DT';
  
  // Detectar por rango de plan FEDPA o valor IS
  if (
    tipoCoberturaIS === 14 || // IS Cobertura Completa
    (tipoCoberturaIS >= 411 && tipoCoberturaIS <= 463) || // FEDPA CC (411, 412, 461-463)
    tipoCoberturaIS === 412 // FEDPA CC Premium específico
  ) {
    tipoCobertura = 'CC';
  } else if (tipoCoberturaIS === 426) {
    tipoCobertura = 'DT';
  } else {
    // Default: Si no está claro, usar Cobertura Completa (más común)
    console.warn(`[PLAN Determiner] Tipo desconocido ${tipoCoberturaIS}, usando CC por defecto`);
    tipoCobertura = 'CC';
  }
  
  console.log(`[PLAN Determiner] Tipo IS: ${tipoCoberturaIS} → ${tipoCobertura} (${tipoCobertura === 'CC' ? 'Cobertura Completa' : 'Daños a Terceros'})`);
  console.log(`[PLAN Determiner] Valor vehículo: $${valorVehiculo.toLocaleString()}`);
  
  if (tipoCobertura === 'CC') {
    // Para Cobertura Completa, SIEMPRE usar 411 o 412 (según básico/premium)
    // Los rangos 461-463 son variantes pero usamos 411/412 para simplificar
    console.log('[PLAN Determiner] Plan: 411 (CC PARTICULAR)');
    return '411';
  } else {
    // Para Daños a Terceros, usar plan 426 (DT PARTICULARES)
    console.log('[PLAN Determiner] Plan: 426 (DT PARTICULARES)');
    return '426';
  }
}

/**
 * Obtener descripción del plan
 */
export function getPlanDescripcion(plan: string): string {
  const planConfig = FEDPA_PLAN_CONFIGS.find((config) => config.plan === plan);
  return planConfig?.descripcion || 'Plan no encontrado';
}

/**
 * Interface de datos normalizados para cotización
 * Compatible con ambas aseguradoras
 */
export interface NormalizedQuoteData {
  // Datos del cliente
  cliente: {
    tipoDocumento: number; // 1=CC, 2=RUC, 3=PAS
    numeroDocumento: string;
    nombre: string;
    apellido: string;
    telefono: string;
    correo: string;
  };
  
  // Datos del vehículo (formato IS)
  vehiculo: {
    marca: number; // Código IS
    marcaNombre?: string; // Nombre de la marca
    modelo: number; // Código IS
    modeloNombre?: string; // Nombre del modelo (ej: FORTUNER)
    anio: number;
    valor: number;
  };
  
  // Datos de cobertura (formato IS)
  cobertura: {
    sumaAsegurada: number;
    planCobertura: number; // Código IS
    grupoTarifa: number; // Código IS
    // Límites de responsabilidad civil
    lesionCorporalPersona?: number;
    lesionCorporalAccidente?: number;
    danoPropiedad?: number;
    gastosMedicosPersona?: number;
    gastosMedicosAccidente?: number;
    // Deducible
    deducible?: string; // 'bajo', 'medio', 'alto'
  };
  
  // Datos mapeados para FEDPA (generados automáticamente)
  fedpa?: {
    uso: string; // Código de uso
    plan: string; // Plan determinado por valor
    codMarca: string; // Código FEDPA de marca (ej: 'TOY', 'HYU')
    codModelo: string; // Código FEDPA de modelo (genérico por ahora)
    // Límites de coberturas (códigos FEDPA)
    codLimiteLesiones: string; // Lesiones corporales
    codLimitePropiedad: string; // Daños a la propiedad
    codLimiteGastosMedico: string; // Gastos médicos
    endosoIncluido: 'S' | 'N'; // Muerte accidental incluida
  };
}

/**
 * Normalizar datos de formulario para ambas aseguradoras
 */
export function normalizeQuoteData(formData: any): NormalizedQuoteData {
  const normalized: NormalizedQuoteData = {
    cliente: {
      tipoDocumento: formData.vcodtipodoc || 1,
      numeroDocumento: formData.vnrodoc,
      nombre: formData.vnombre,
      apellido: formData.vapellido,
      telefono: formData.vtelefono,
      correo: formData.vcorreo,
    },
    vehiculo: {
      marca: parseInt(formData.vcodmarca as string),
      marcaNombre: formData.marca || '',
      modelo: parseInt(formData.vcodmodelo as string),
      modeloNombre: formData.modelo || '',
      anio: parseInt(formData.vanioauto),
      valor: parseFloat(formData.vsumaaseg) || 0,
    },
    cobertura: {
      sumaAsegurada: parseFloat(formData.vsumaaseg) || 0,
      planCobertura: parseInt(formData.vcodplancobertura as string),
      grupoTarifa: parseInt(formData.vcodgrupotarifa as string),
      // Coberturas adicionales del formulario
      lesionCorporalPersona: formData.lesionCorporalPersona ? parseFloat(formData.lesionCorporalPersona) : 10000,
      lesionCorporalAccidente: formData.lesionCorporalAccidente ? parseFloat(formData.lesionCorporalAccidente) : 20000,
      danoPropiedad: formData.danoPropiedad ? parseFloat(formData.danoPropiedad) : 10000,
      gastosMedicosPersona: formData.gastosMedicosPersona ? parseFloat(formData.gastosMedicosPersona) : 2000,
      gastosMedicosAccidente: formData.gastosMedicosAccidente ? parseFloat(formData.gastosMedicosAccidente) : 10000,
      deducible: formData.deducible || 'medio',
    },
  };
  
  // Mapear automáticamente a FEDPA
  normalized.fedpa = {
    uso: getUsoFromMarca(normalized.vehiculo.marca),
    plan: getPlanFromCoberturaYValor(
      normalized.cobertura.planCobertura,
      normalized.vehiculo.valor
    ),
    codMarca: getFedpaMarcaCode(normalized.vehiculo.marca, normalized.vehiculo.marcaNombre),
    // Normalizar nombre real del modelo (FORTUNER, COROLLA, etc)
    codModelo: normalizarModeloFedpa(normalized.vehiculo.modeloNombre || ''),
    // Mapear límites de coberturas
    codLimiteLesiones: mapLesionesACodigo(
      normalized.cobertura.lesionCorporalPersona || 10000,
      normalized.cobertura.lesionCorporalAccidente || 20000
    ),
    codLimitePropiedad: mapDanosPropiedadACodigo(
      normalized.cobertura.danoPropiedad || 10000
    ),
    codLimiteGastosMedico: mapGastosMedicosACodigo(
      normalized.cobertura.gastosMedicosPersona || 2000,
      normalized.cobertura.gastosMedicosAccidente || 10000
    ),
    // Muerte accidental por defecto en 'S' (incluido)
    endosoIncluido: 'S',
  };
  
  return normalized;
}

/**
 * Log de mapeo para debugging
 */
export function logQuoteMapping(normalized: NormalizedQuoteData): void {
  console.log('[Catalog Normalizer] Datos normalizados:');
  console.log(`  - Cliente: ${normalized.cliente.nombre} ${normalized.cliente.apellido}`);
  console.log(`  - Vehículo IS: Marca ${normalized.vehiculo.marca}, Modelo ${normalized.vehiculo.modelo}, Año ${normalized.vehiculo.anio}`);
  console.log(`  - Valor: $${normalized.vehiculo.valor.toLocaleString()}`);
  console.log(`  - FEDPA USO: ${normalized.fedpa?.uso} (${getUsoDescripcion(normalized.fedpa?.uso || '')})`);
  console.log(`  - FEDPA PLAN: ${normalized.fedpa?.plan} (${getPlanDescripcion(normalized.fedpa?.plan || '')})`);
  console.log(`  - FEDPA MARCA: ${normalized.fedpa?.codMarca} (desde IS ${normalized.vehiculo.marca})`);
  console.log(`  - FEDPA MODELO: ${normalized.fedpa?.codModelo}`);
  console.log(`  - FEDPA COBERTURAS:`);
  console.log(`    • Lesiones corporales: ${normalized.fedpa?.codLimiteLesiones} ($${normalized.cobertura.lesionCorporalPersona}/$${normalized.cobertura.lesionCorporalAccidente})`);
  console.log(`    • Daños propiedad: ${normalized.fedpa?.codLimitePropiedad} ($${normalized.cobertura.danoPropiedad})`);
  console.log(`    • Gastos médicos: ${normalized.fedpa?.codLimiteGastosMedico} ($${normalized.cobertura.gastosMedicosPersona}/$${normalized.cobertura.gastosMedicosAccidente})`);
  console.log(`    • Muerte accidental: ${normalized.fedpa?.endosoIncluido} (${normalized.fedpa?.endosoIncluido === 'S' ? 'Incluido' : 'No incluido'})`);
  console.log(`  - Deducible: ${normalized.cobertura.deducible}`);
}

/**
 * Obtener descripción del USO
 */
function getUsoDescripcion(uso: string): string {
  const descripciones: Record<string, string> = {
    '10': 'AUTO PARTICULAR',
    '22': 'BUS (0-15 PASAJEROS)',
  };
  return descripciones[uso] || 'Desconocido';
}
