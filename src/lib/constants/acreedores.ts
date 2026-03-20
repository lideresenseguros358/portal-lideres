/**
 * Lista de acreedores para emisión de pólizas de auto
 * Usado por IS (codTipoConducto/codConducto) y FEDPA (Acreedor)
 *
 * ── IS ──
 * codTipoConductoIS = 1  (IS usa un solo catálogo: GET /catalogos/bancos)
 * codConductoIS     = codigoBanco real extraído de la API de IS
 *   → Endpoint: GET https://www.iseguros.com/APIRestIsTester/api/catalogos/bancos
 *   → Se pasa en emisión como datosAuto.codTipoConducto y datosAuto.codConducto
 *
 * ── FEDPA ──
 * codigoFEDPA = string libre que se envía en el campo "Acreedor" del body de emisión
 *   → Endpoint: POST https://wscanales.segfedpa.com/EmisorPlan/api/emitirpoliza
 *   → Campo opcional, tipo String
 *
 * Última sincronización con IS API: 2026-02-26
 */

export type TipoAcreedor = 'BANCO' | 'FINANCIERA' | 'FIDUCIARIA' | 'COOPERATIVA' | 'OTRO';

export interface Acreedor {
  label: string;               // Nombre para mostrar en el dropdown
  tipo: TipoAcreedor;          // Categoría visual para agrupar en UI
  codTipoConductoIS: number;   // IS: siempre 1 (catálogo único /catalogos/bancos)
  codConductoIS: number;       // IS: codigoBanco real del endpoint /catalogos/bancos
  codigoFEDPA: string;         // FEDPA: string libre para campo "Acreedor"
  codigoREGIONAL: string;      // REGIONAL: código numérico string (ej: '81'=sin acreedor)
  codigoANCON?: string;        // ANCÓN: cod_acreedor de GenerarAcreedores (se resuelve dinámicamente)
}

// ─────────────────────────────────────────────────────────────
// LISTA CONSOLIDADA — Datos reales de IS API + FEDPA free-text
//
// codConductoIS = codigoBanco exacto de GET /catalogos/bancos
// codTipoConductoIS = 1 para todos (IS no tiene tipoConducto, solo bancos)
// codigoFEDPA = string descriptivo para FEDPA (campo libre)
//
// Ordenada por tipo y luego alfabéticamente
// ─────────────────────────────────────────────────────────────
export const ACREEDORES_PANAMA: Acreedor[] = [

  // ── BANCOS ────────────────────────────────────────────────────
  // codConductoIS extraído de IS /catalogos/bancos (codigoBanco real)
  // codigoREGIONAL: '81' = sin acreedor (pendiente catálogo completo de Regional)
  { label: 'Allbank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 275, codigoFEDPA: 'ALLBANK',                          codigoREGIONAL: '81' },
  { label: 'BAC International Bank',           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 36,  codigoFEDPA: 'BAC INTERNATIONAL BANK',           codigoREGIONAL: '81' },
  { label: 'Balboa Bank & Trust',              tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 266, codigoFEDPA: 'BALBOA BANK TRUST',                codigoREGIONAL: '81' },
  { label: 'Banco Aliado',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 4,   codigoFEDPA: 'BANCO ALIADO',                     codigoREGIONAL: '81' },
  { label: 'Banco Davivienda',                 tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 270, codigoFEDPA: 'BANCO DAVIVIENDA',                 codigoREGIONAL: '81' },
  { label: 'Banco Delta',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 254, codigoFEDPA: 'BANCO DELTA',                      codigoREGIONAL: '81' },
  { label: 'Banco Ficohsa',                    tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 115, codigoFEDPA: 'BANCO FICOHSA',                    codigoREGIONAL: '81' },
  { label: 'Banco General',                    tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 12,  codigoFEDPA: 'BANCO GENERAL',                    codigoREGIONAL: '81' },
  { label: 'Banco Lafise',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 256, codigoFEDPA: 'BANCO LAFISE',                     codigoREGIONAL: '81' },
  { label: 'Banco Nacional de Panamá',         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 45,  codigoFEDPA: 'BANCO NACIONAL DE PANAMA',         codigoREGIONAL: '81' },
  { label: 'Banco Pichincha',                  tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 265, codigoFEDPA: 'BANCO PICHINCHA PANAMA',           codigoREGIONAL: '81' },
  { label: 'Banesco',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 245, codigoFEDPA: 'BANESCO',                          codigoREGIONAL: '81' },
  { label: 'Banisi',                           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 279, codigoFEDPA: 'BANISI',                           codigoREGIONAL: '81' },
  { label: 'Banistmo',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 35,  codigoFEDPA: 'BANISTMO',                         codigoREGIONAL: '81' },
  { label: 'BBP Bank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 292, codigoFEDPA: 'BBP BANK',                         codigoREGIONAL: '81' },
  { label: 'BCT Bank International',           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 79,  codigoFEDPA: 'BCT BANK INTERNATIONAL',           codigoREGIONAL: '81' },
  { label: 'Bi-Bank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 289, codigoFEDPA: 'BI-BANK',                          codigoREGIONAL: '81' },
  { label: 'Caja de Ahorros',                  tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 46,  codigoFEDPA: 'CAJA DE AHORROS',                  codigoREGIONAL: '81' },
  { label: 'Canal Bank',                       tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 281, codigoFEDPA: 'CANAL BANK',                       codigoREGIONAL: '81' },
  { label: 'Capital Bank',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 250, codigoFEDPA: 'CAPITAL BANK',                     codigoREGIONAL: '81' },
  { label: 'Credicorp Bank',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 34,  codigoFEDPA: 'CREDICORP BANK',                   codigoREGIONAL: '81' },
  { label: 'Global Bank',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 41,  codigoFEDPA: 'GLOBAL BANK',                      codigoREGIONAL: '81' },
  { label: 'La Hipotecaria',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 259, codigoFEDPA: 'LA HIPOTECARIA',                   codigoREGIONAL: '81' },
  { label: 'Mercantil Bank',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 276, codigoFEDPA: 'MERCANTIL BANK PANAMA',            codigoREGIONAL: '81' },
  { label: 'Metrobank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 247, codigoFEDPA: 'METRO BANK',                       codigoREGIONAL: '81' },
  { label: 'MMG Bank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 44,  codigoFEDPA: 'MMG BANK',                         codigoREGIONAL: '81' },
  { label: 'Multibank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 24,  codigoFEDPA: 'MULTIBANK',                        codigoREGIONAL: '81' },
  { label: 'Panabank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 19,  codigoFEDPA: 'PANABANK',                         codigoREGIONAL: '81' },
  { label: 'Prival Bank',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 267, codigoFEDPA: 'PRIVAL BANK',                      codigoREGIONAL: '81' },
  { label: 'Scotiabank',                       tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 93,  codigoFEDPA: 'SCOTIABANK',                       codigoREGIONAL: '81' },
  { label: 'St. Georges Bank',                 tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 75,  codigoFEDPA: 'ST. GEORGES BANK',                 codigoREGIONAL: '81' },
  { label: 'Towerbank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 32,  codigoFEDPA: 'TOWERBANK',                        codigoREGIONAL: '81' },
  { label: 'Unibank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 257, codigoFEDPA: 'UNIBANK',                          codigoREGIONAL: '81' },

  // ── FINANCIERAS ─────────────────────────────────────────────────
  { label: 'Financia Credit',                  tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'FINANCIA CREDIT',                codigoREGIONAL: '81' },
  { label: 'Finance Corp',                     tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'FINANCE CORP',                   codigoREGIONAL: '81' },
  { label: 'Financiera Govimar',               tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'FINANCIERA GOVIMAR',             codigoREGIONAL: '81' },
  { label: 'Financiera Madrileña',             tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'FINANCIERA MADRILENA',           codigoREGIONAL: '81' },
  { label: 'GDP Financial',                    tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'GDP FINANCIAL',                  codigoREGIONAL: '81' },
  { label: 'Grupo Financiero Continental',     tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'GRUPO FINANCIERO CONTINENTAL',   codigoREGIONAL: '81' },
  { label: 'Leasing de Panamá',                tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'LEASING DE PANAMA',              codigoREGIONAL: '81' },
  { label: 'Macrofinanciera',                  tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'MACROFINANCIERA',                codigoREGIONAL: '81' },
  { label: 'Multicréditos',                    tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'MULTICREDITOS',                  codigoREGIONAL: '81' },
  { label: 'Panacredit',                       tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'PANACREDIT',                     codigoREGIONAL: '81' },
  { label: 'TCM Financial',                    tipo: 'FINANCIERA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'TCM FINANCIAL',                  codigoREGIONAL: '81' },

  // ── FIDUCIARIAS ─────────────────────────────────────────────────
  { label: 'Aliado Fiduciaria',                tipo: 'FIDUCIARIA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'ALIADO FIDUCIARIA',              codigoREGIONAL: '81' },
  { label: 'BG Trust',                         tipo: 'FIDUCIARIA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'BG TRUST',                       codigoREGIONAL: '81' },
  { label: 'Global Trust',                     tipo: 'FIDUCIARIA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'GLOBAL TRUST',                   codigoREGIONAL: '81' },
  { label: 'Multi Trust',                      tipo: 'FIDUCIARIA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'MULTI TRUST',                    codigoREGIONAL: '81' },
  { label: 'Panama Trust',                     tipo: 'FIDUCIARIA', codTipoConductoIS: 1, codConductoIS: 0, codigoFEDPA: 'PANAMA TRUST',                   codigoREGIONAL: '81' },

  // ── COOPERATIVAS (también en /catalogos/bancos de IS) ─────────
  { label: 'CACECHI',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 286, codigoFEDPA: 'CACECHI',                      codigoREGIONAL: '81' },
  { label: 'CACSA',                            tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 0,   codigoFEDPA: 'CACSA',                        codigoREGIONAL: '81' },
  { label: 'COOACECSS',                        tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 0,   codigoFEDPA: 'COOACECSS',                    codigoREGIONAL: '81' },
  { label: 'COOESAN',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 242, codigoFEDPA: 'COOESAN',                      codigoREGIONAL: '81' },
  { label: 'COOPEDUC',                         tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 241, codigoFEDPA: 'COOPEDUC',                     codigoREGIONAL: '81' },
  { label: 'COOPEVE',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 244, codigoFEDPA: 'COOPEVE',                      codigoREGIONAL: '81' },
  { label: 'COOPRAC',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 288, codigoFEDPA: 'COOPRAC',                      codigoREGIONAL: '81' },
  { label: 'Cooperativa Cristobal',            tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 0,   codigoFEDPA: 'COOPERATIVA CRISTOBAL',        codigoREGIONAL: '81' },
  { label: 'Cooperativa de Servicios Múltiples Profesionales', tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 124, codigoFEDPA: 'COOPERATIVA DE SERVICIOS MULTIPLES PROFESIONALES', codigoREGIONAL: '81' },
  { label: 'Cooperativa Juan XXIII',           tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 0,   codigoFEDPA: 'COOPERATIVA JUAN XXIII',       codigoREGIONAL: '81' },
  { label: 'EDIOACC',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 293, codigoFEDPA: 'EDIOACC',                      codigoREGIONAL: '81' },

  // ── OTROS (instituciones relevantes para financiamiento) ──────
  { label: 'Producbank',                       tipo: 'OTRO', codTipoConductoIS: 1, codConductoIS: 126, codigoFEDPA: 'PRODUCBANK',                    codigoREGIONAL: '81' },
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
  codigoREGIONAL: '81', // 81 = sin acreedor en Regional
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

// ─────────────────────────────────────────────────────────────
// PER-INSURER NORMALIZERS
// Each insurer expects acreedor in a different format.
// These functions resolve the user-selected label to the correct
// code/string for each insurer's emission API.
// ─────────────────────────────────────────────────────────────

/** IS: returns { codTipoConducto, codConducto, txtBenef } */
export function resolveAcreedorIS(value: string): { codTipoConducto: number; codConducto: number; txtBenef: string } | null {
  const acreedor = findAcreedor(value);
  if (!acreedor || acreedor.codConductoIS === 0) return null;
  return {
    codTipoConducto: acreedor.codTipoConductoIS,
    codConducto: acreedor.codConductoIS,
    txtBenef: acreedor.label.toUpperCase(),
  };
}

/** FEDPA: returns free-text string for 'Acreedor' field */
export function resolveAcreedorFEDPA(value: string): string {
  const acreedor = findAcreedor(value);
  return acreedor?.codigoFEDPA || value.toUpperCase();
}

/** REGIONAL: returns numeric code string ('81' = sin acreedor) */
export function resolveAcreedorREGIONAL(value: string): string {
  if (!value || !value.trim()) return '81'; // sin acreedor
  const acreedor = findAcreedor(value);
  return acreedor?.codigoREGIONAL || '81';
}

/** ANCÓN: returns cod_acreedor string (dynamic from API) */
export function resolveAcreedorANCON(value: string): string {
  if (!value || !value.trim()) return '';
  // Ancón acreedores are resolved dynamically via GenerarAcreedores API.
  // The label is sent as-is; the emission page should resolve against
  // the ANCÓN catalog. Fallback: send the label uppercase.
  return value.toUpperCase();
}
