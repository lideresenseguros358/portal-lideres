/**
 * Lista de acreedores para emisión de pólizas de auto
 * Usado por IS (codTipoConducto/codConducto) y FEDPA (Acreedor)
 *
 * IS:    codTipoConductoIS = tipo de institución (1=Banco, 2=Financiera, 3=Cooperativa, 4=Otro)
 *        codConductoIS     = código numérico de IS para la institución
 * FEDPA: codigoFEDPA       = string exacto que acepta el campo "Acreedor" de FEDPA
 *
 * Cómo agregar una nueva institución:
 *   1. Agregar una entrada en ACREEDORES_PANAMA con los tres campos.
 *   2. Si es un banco nuevo en IS, verificar el codConductoIS con /catalogos/conductores.
 *   3. Si es una financiera/cooperativa, usar codTipoConductoIS = 2 o 3 respectivamente.
 *   4. codigoFEDPA debe coincidir exactamente con lo que acepta la API de FEDPA.
 */

export type TipoAcreedor = 'BANCO' | 'FINANCIERA' | 'COOPERATIVA' | 'LEASING' | 'OTRO';

export interface Acreedor {
  label: string;               // Nombre para mostrar en el dropdown
  tipo: TipoAcreedor;          // Categoría de la institución
  codTipoConductoIS: number;   // Tipo para IS: 1=Banco, 2=Financiera, 3=Cooperativa, 4=Otro
  codConductoIS: number;       // Código numérico IS del conducto (0 si no aplica)
  codigoFEDPA: string;         // String exacto para el campo Acreedor de FEDPA
}

// ─────────────────────────────────────────────────────────────
// LISTA CONSOLIDADA — Funciona para IS y FEDPA
// Ordenada por tipo (bancos primero) y luego alfabéticamente
// ─────────────────────────────────────────────────────────────
export const ACREEDORES_PANAMA: Acreedor[] = [

  // ── BANCOS (codTipoConductoIS = 1) ──────────────────────────
  { label: 'BAC Credomatic',              tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 3,  codigoFEDPA: 'BAC' },
  { label: 'Banco Aliado',                tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 9,  codigoFEDPA: 'BANCO ALIADO' },
  { label: 'Banco Delta (St. Georges)',   tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 11, codigoFEDPA: 'BANCO DELTA' },
  { label: 'Banco Ficohsa',               tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 12, codigoFEDPA: 'FICOHSA' },
  { label: 'Banco General',               tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 1,  codigoFEDPA: 'BANCO GENERAL' },
  { label: 'Banco La Hipotecaria',        tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 13, codigoFEDPA: 'LA HIPOTECARIA' },
  { label: 'Banco Nacional de Panamá',    tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 4,  codigoFEDPA: 'BANCO NACIONAL' },
  { label: 'Banco Promerica',             tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 16, codigoFEDPA: 'PROMERICA' },
  { label: 'Banesco',                     tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 10, codigoFEDPA: 'BANESCO' },
  { label: 'Banistmo',                    tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 2,  codigoFEDPA: 'BANISTMO' },
  { label: 'Caja de Ahorros',             tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 5,  codigoFEDPA: 'CAJA DE AHORROS' },
  { label: 'Credicorp Bank',              tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 14, codigoFEDPA: 'CREDICORP' },
  { label: 'Global Bank',                 tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 6,  codigoFEDPA: 'GLOBAL BANK' },
  { label: 'MiBanco (Microserfin)',        tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 17, codigoFEDPA: 'MIBANCO' },
  { label: 'Multibank',                   tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 7,  codigoFEDPA: 'MULTIBANK' },
  { label: 'Scotiabank',                  tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 8,  codigoFEDPA: 'SCOTIABANK' },
  { label: 'Towerbank',                   tipo: 'BANCO',       codTipoConductoIS: 1, codConductoIS: 15, codigoFEDPA: 'TOWERBANK' },

  // ── FINANCIERAS (codTipoConductoIS = 2) ─────────────────────
  { label: 'Cambiamos',                   tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 30, codigoFEDPA: 'CAMBIAMOS' },
  { label: 'Confisa',                     tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 31, codigoFEDPA: 'CONFISA' },
  { label: 'Dina',                        tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 32, codigoFEDPA: 'DINA' },
  { label: 'Financial Warehousing',       tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 33, codigoFEDPA: 'FINANCIAL WAREHOUSING' },
  { label: 'Financiera General',          tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 34, codigoFEDPA: 'FINANCIERA GENERAL' },
  { label: 'Financorp',                   tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 35, codigoFEDPA: 'FINANCORP' },
  { label: 'LAFISE Financiera',           tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 36, codigoFEDPA: 'LAFISE' },
  { label: 'Multibank Credit',            tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 37, codigoFEDPA: 'MULTIBANK CREDIT' },
  { label: 'Prival Bank',                 tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 38, codigoFEDPA: 'PRIVAL' },
  { label: 'Telered',                     tipo: 'FINANCIERA',  codTipoConductoIS: 2, codConductoIS: 39, codigoFEDPA: 'TELERED' },

  // ── COOPERATIVAS (codTipoConductoIS = 3) ────────────────────
  { label: 'Acacoop',                     tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 50, codigoFEDPA: 'ACACOOP' },
  { label: 'Coocen',                      tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 51, codigoFEDPA: 'COOCEN' },
  { label: 'Coopeduc',                    tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 52, codigoFEDPA: 'COOPEDUC' },
  { label: 'Coopegas',                    tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 53, codigoFEDPA: 'COOPEGAS' },
  { label: 'Coopemep',                    tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 54, codigoFEDPA: 'COOPEMEP' },
  { label: 'Cooperativa San José',        tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 55, codigoFEDPA: 'SAN JOSE' },
  { label: 'Cuna Mutual (CUNA)',          tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 56, codigoFEDPA: 'CUNA MUTUAL' },
  { label: 'Fedpa Coop',                  tipo: 'COOPERATIVA', codTipoConductoIS: 3, codConductoIS: 57, codigoFEDPA: 'FEDPA COOP' },

  // ── LEASING / ARRENDAMIENTO (codTipoConductoIS = 4) ─────────
  { label: 'Arrendadora General',         tipo: 'LEASING',     codTipoConductoIS: 4, codConductoIS: 70, codigoFEDPA: 'ARRENDADORA GENERAL' },
  { label: 'BG Leasing',                  tipo: 'LEASING',     codTipoConductoIS: 4, codConductoIS: 71, codigoFEDPA: 'BG LEASING' },
  { label: 'Banistmo Leasing',            tipo: 'LEASING',     codTipoConductoIS: 4, codConductoIS: 72, codigoFEDPA: 'BANISTMO LEASING' },
  { label: 'Istmo Leasing',               tipo: 'LEASING',     codTipoConductoIS: 4, codConductoIS: 73, codigoFEDPA: 'ISTMO LEASING' },
  { label: 'Multibank Leasing',           tipo: 'LEASING',     codTipoConductoIS: 4, codConductoIS: 74, codigoFEDPA: 'MULTIBANK LEASING' },
  { label: 'Otro acreedor',               tipo: 'OTRO',        codTipoConductoIS: 4, codConductoIS: 99, codigoFEDPA: 'OTRO' },
];

/**
 * @deprecated Use ACREEDORES_PANAMA instead.
 * Kept for backward compatibility with components that reference ACREEDORES_BANCARIOS.
 */
export const ACREEDORES_BANCARIOS = ACREEDORES_PANAMA;

// Opción vacía para "Sin acreedor"
export const SIN_ACREEDOR: Acreedor = {
  label: '',
  tipo: 'OTRO',
  codTipoConductoIS: 0,
  codConductoIS: 0,
  codigoFEDPA: '',
};

/**
 * Buscar acreedor por label o codigoFEDPA (case-insensitive)
 */
export function findAcreedor(value: string): Acreedor | undefined {
  if (!value || !value.trim()) return undefined;
  const v = value.trim().toUpperCase();
  return ACREEDORES_PANAMA.find(
    a => a.codigoFEDPA === v || a.label.toUpperCase() === v
  );
}

/**
 * Get all acreedores grouped by type, for rendering grouped dropdowns
 */
export function getAcreedoresGrouped(): Record<TipoAcreedor, Acreedor[]> {
  return ACREEDORES_PANAMA.reduce((groups, a) => {
    if (!groups[a.tipo]) groups[a.tipo] = [];
    groups[a.tipo].push(a);
    return groups;
  }, {} as Record<TipoAcreedor, Acreedor[]>);
}
