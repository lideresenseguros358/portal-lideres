/**
 * Resolver de planes CC (Cobertura Completa Particular) de Internacional de Seguros
 * 
 * Mapea los límites de cobertura seleccionados por el usuario en el formulario
 * (Lesiones Corporales, Daños a Propiedad, Gastos Médicos) al código de plan
 * correcto de IS (vcodplancobertura).
 * 
 * Catálogo obtenido de: GET /cotizaemisorauto/getplanes/1 (tipo 1 = CC Particular)
 * 
 * Formato del nombre del plan:
 *   CC [LC_persona/LC_evento en miles] - [DP en miles] - [GM_persona/GM_evento en miles o cientos]
 *   Ejemplo: "CC 25/50 - 50 - 5/25" = LC 25K/50K, DP 50K, GM 5K/25K
 */

export interface ISPlanCC {
  codigo: number;        // DATO del catálogo IS (vcodplancobertura)
  texto: string;         // Nombre del plan (ej: "CC 25/50 - 50 - 5/25")
  lcPersona: number;     // Lesiones Corporales por persona (en dólares)
  lcEvento: number;      // Lesiones Corporales por evento/accidente (en dólares)
  dp: number;            // Daños a la Propiedad (en dólares)
  gmPersona: number;     // Gastos Médicos por persona (en dólares)
  gmEvento: number;      // Gastos Médicos por evento/accidente (en dólares)
}

/**
 * Catálogo completo de planes CC Particular de IS
 * Fuente: API IS producción GET /cotizaemisorauto/getplanes/1
 */
export const PLANES_CC_IS: ISPlanCC[] = [
  // CC 5/10
  { codigo: 29,  texto: 'CC 5/10 - 5 - 500/2,500',    lcPersona: 5000,   lcEvento: 10000,   dp: 5000,   gmPersona: 500,   gmEvento: 2500 },
  { codigo: 30,  texto: 'CC 5/10 - 10 - 1/5',          lcPersona: 5000,   lcEvento: 10000,   dp: 10000,  gmPersona: 1000,  gmEvento: 5000 },
  // CC 10/20
  { codigo: 31,  texto: 'CC 10/20 - 10 - 2/10',        lcPersona: 10000,  lcEvento: 20000,   dp: 10000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 32,  texto: 'CC 10/20 - 15 - 2/10',        lcPersona: 10000,  lcEvento: 20000,   dp: 15000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 90,  texto: 'CC 10/20 - 20 - 2/10',        lcPersona: 10000,  lcEvento: 20000,   dp: 20000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 97,  texto: 'CC 10/20 - 20 - 5/25',        lcPersona: 10000,  lcEvento: 20000,   dp: 20000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 120, texto: 'CC 10/20 - 20 - 10/50',       lcPersona: 10000,  lcEvento: 20000,   dp: 20000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 91,  texto: 'CC 10/20 - 25 - 2/10',        lcPersona: 10000,  lcEvento: 20000,   dp: 25000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 33,  texto: 'CC 10/20 - 25 - 5/25',        lcPersona: 10000,  lcEvento: 20000,   dp: 25000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 98,  texto: 'CC 10/20 - 50 - 2/10',        lcPersona: 10000,  lcEvento: 20000,   dp: 50000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 132, texto: 'CC 10/20 - 50 - 5/25',        lcPersona: 10000,  lcEvento: 20000,   dp: 50000,  gmPersona: 5000,  gmEvento: 25000 },
  // CC 25/50
  { codigo: 116, texto: 'CC 25/50 - 15 - 5/25',        lcPersona: 25000,  lcEvento: 50000,   dp: 15000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 34,  texto: 'CC 25/50 - 25 - 2/10',        lcPersona: 25000,  lcEvento: 50000,   dp: 25000,  gmPersona: 2000,  gmEvento: 10000 },
  { codigo: 35,  texto: 'CC 25/50 - 25 - 5/25',        lcPersona: 25000,  lcEvento: 50000,   dp: 25000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 88,  texto: 'CC 25/50 - 25 - 10/50',       lcPersona: 25000,  lcEvento: 50000,   dp: 25000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 36,  texto: 'CC 25/50 - 50 - 5/25',        lcPersona: 25000,  lcEvento: 50000,   dp: 50000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 92,  texto: 'CC 25/50 - 50 - 10/50',       lcPersona: 25000,  lcEvento: 50000,   dp: 50000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 93,  texto: 'CC 25/50 - 100 - 10/50',      lcPersona: 25000,  lcEvento: 50000,   dp: 100000, gmPersona: 10000, gmEvento: 50000 },
  // CC 50/100
  { codigo: 95,  texto: 'CC 50/100 - 25 - 5/25',       lcPersona: 50000,  lcEvento: 100000,  dp: 25000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 96,  texto: 'CC 50/100 - 25 - 10/50',      lcPersona: 50000,  lcEvento: 100000,  dp: 25000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 37,  texto: 'CC 50/100 - 50 - 5/25',       lcPersona: 50000,  lcEvento: 100000,  dp: 50000,  gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 38,  texto: 'CC 50/100 - 50 - 10/50',      lcPersona: 50000,  lcEvento: 100000,  dp: 50000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 100, texto: 'CC 50/100 - 100 - 10/50',     lcPersona: 50000,  lcEvento: 100000,  dp: 100000, gmPersona: 10000, gmEvento: 50000 },
  // CC 100/300
  { codigo: 39,  texto: 'CC 100/300 - 50 - 10/50',     lcPersona: 100000, lcEvento: 300000,  dp: 50000,  gmPersona: 10000, gmEvento: 50000 },
  { codigo: 94,  texto: 'CC 100/300 - 100 - 5/25',     lcPersona: 100000, lcEvento: 300000,  dp: 100000, gmPersona: 5000,  gmEvento: 25000 },
  { codigo: 40,  texto: 'CC 100/300 - 100 - 10/50',    lcPersona: 100000, lcEvento: 300000,  dp: 100000, gmPersona: 10000, gmEvento: 50000 },
];

/**
 * Opciones de límites disponibles para el formulario del cotizador
 */
export const OPCIONES_LC = [
  { lcPersona: 5000,   lcEvento: 10000,   label: '$5,000 / $10,000' },
  { lcPersona: 10000,  lcEvento: 20000,   label: '$10,000 / $20,000' },
  { lcPersona: 25000,  lcEvento: 50000,   label: '$25,000 / $50,000' },
  { lcPersona: 50000,  lcEvento: 100000,  label: '$50,000 / $100,000' },
  { lcPersona: 100000, lcEvento: 300000,  label: '$100,000 / $300,000' },
];

export const OPCIONES_DP = [
  { dp: 5000,   label: '$5,000' },
  { dp: 10000,  label: '$10,000' },
  { dp: 15000,  label: '$15,000' },
  { dp: 20000,  label: '$20,000' },
  { dp: 25000,  label: '$25,000' },
  { dp: 50000,  label: '$50,000' },
  { dp: 100000, label: '$100,000' },
];

export const OPCIONES_GM = [
  { gmPersona: 500,   gmEvento: 2500,  label: '$500 / $2,500' },
  { gmPersona: 1000,  gmEvento: 5000,  label: '$1,000 / $5,000' },
  { gmPersona: 2000,  gmEvento: 10000, label: '$2,000 / $10,000' },
  { gmPersona: 5000,  gmEvento: 25000, label: '$5,000 / $25,000' },
  { gmPersona: 10000, gmEvento: 50000, label: '$10,000 / $50,000' },
];

export interface CoverageSelection {
  lesionCorporalPersona: number;     // Ej: 25000
  lesionCorporalAccidente: number;   // Ej: 50000
  danoPropiedad: number;             // Ej: 50000
  gastosMedicosPersona: number;      // Ej: 5000
  gastosMedicosAccidente: number;    // Ej: 25000
}

/**
 * Resuelve el código de plan CC de IS (vcodplancobertura) a partir de los
 * límites de cobertura seleccionados por el usuario en el formulario.
 * 
 * Busca coincidencia exacta primero. Si no encuentra, busca el plan más cercano
 * que cubra al menos los límites solicitados.
 * 
 * @returns El plan IS que coincide, o null si no se encuentra
 */
export function resolverPlanCCIS(sel: CoverageSelection): ISPlanCC | null {
  // 1. Buscar coincidencia exacta
  const exacto = PLANES_CC_IS.find(p =>
    p.lcPersona === sel.lesionCorporalPersona &&
    p.lcEvento === sel.lesionCorporalAccidente &&
    p.dp === sel.danoPropiedad &&
    p.gmPersona === sel.gastosMedicosPersona &&
    p.gmEvento === sel.gastosMedicosAccidente
  );
  
  if (exacto) {
    console.log(`[IS Plan CC Resolver] ✅ Coincidencia exacta: ${exacto.texto} (código ${exacto.codigo})`);
    return exacto;
  }
  
  // 2. Buscar plan que cubra al menos los límites solicitados (menor prima posible)
  const candidatos = PLANES_CC_IS.filter(p =>
    p.lcPersona >= sel.lesionCorporalPersona &&
    p.lcEvento >= sel.lesionCorporalAccidente &&
    p.dp >= sel.danoPropiedad &&
    p.gmPersona >= sel.gastosMedicosPersona &&
    p.gmEvento >= sel.gastosMedicosAccidente
  );
  
  if (candidatos.length > 0) {
    // Ordenar por "cercanía" — el que tenga la menor suma total de límites
    candidatos.sort((a, b) => {
      const totalA = a.lcPersona + a.lcEvento + a.dp + a.gmPersona + a.gmEvento;
      const totalB = b.lcPersona + b.lcEvento + b.dp + b.gmPersona + b.gmEvento;
      return totalA - totalB;
    });
    
    const mejor = candidatos[0]!;
    console.log(`[IS Plan CC Resolver] ⚠️ Sin coincidencia exacta. Plan más cercano: ${mejor.texto} (código ${mejor.codigo})`);
    return mejor ?? null;
  }
  
  // 3. No encontrado — usar plan máximo como fallback
  console.warn(`[IS Plan CC Resolver] ❌ No se encontró plan para LC=${sel.lesionCorporalPersona}/${sel.lesionCorporalAccidente} DP=${sel.danoPropiedad} GM=${sel.gastosMedicosPersona}/${sel.gastosMedicosAccidente}`);
  return null;
}

/**
 * Versión simplificada: obtiene solo el código de plan.
 * Si no encuentra plan, retorna 29 (plan mínimo) como fallback.
 */
export function resolverCodigoPlanCCIS(sel: CoverageSelection): number {
  const plan = resolverPlanCCIS(sel);
  return plan?.codigo || 29; // Fallback al plan más básico
}

/**
 * Obtener opciones de DP disponibles para una combinación de LC dada.
 * Filtra los planes que tienen esos LC y devuelve los DP únicos.
 */
export function getOpcionesDPParaLC(lcPersona: number, lcEvento: number): number[] {
  const dps = new Set<number>();
  PLANES_CC_IS
    .filter(p => p.lcPersona === lcPersona && p.lcEvento === lcEvento)
    .forEach(p => dps.add(p.dp));
  return Array.from(dps).sort((a, b) => a - b);
}

/**
 * Obtener opciones de GM disponibles para una combinación de LC + DP dada.
 */
export function getOpcionesGMParaLCDP(lcPersona: number, lcEvento: number, dp: number): { gmPersona: number; gmEvento: number }[] {
  const gms = new Map<string, { gmPersona: number; gmEvento: number }>();
  PLANES_CC_IS
    .filter(p => p.lcPersona === lcPersona && p.lcEvento === lcEvento && p.dp === dp)
    .forEach(p => {
      const key = `${p.gmPersona}-${p.gmEvento}`;
      if (!gms.has(key)) {
        gms.set(key, { gmPersona: p.gmPersona, gmEvento: p.gmEvento });
      }
    });
  return Array.from(gms.values()).sort((a, b) => a.gmPersona - b.gmPersona);
}
