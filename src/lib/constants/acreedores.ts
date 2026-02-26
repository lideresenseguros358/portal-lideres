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

export type TipoAcreedor = 'BANCO' | 'FINANCIERA' | 'COOPERATIVA' | 'OTRO';

export interface Acreedor {
  label: string;               // Nombre para mostrar en el dropdown
  tipo: TipoAcreedor;          // Categoría visual para agrupar en UI
  codTipoConductoIS: number;   // IS: siempre 1 (catálogo único /catalogos/bancos)
  codConductoIS: number;       // IS: codigoBanco real del endpoint /catalogos/bancos
  codigoFEDPA: string;         // FEDPA: string libre para campo "Acreedor"
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
  { label: 'Allbank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 275, codigoFEDPA: 'ALLBANK' },
  { label: 'BAC International Bank',           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 36,  codigoFEDPA: 'BAC INTERNATIONAL BANK' },
  { label: 'Balboa Bank & Trust',              tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 266, codigoFEDPA: 'BALBOA BANK TRUST' },
  { label: 'Banco Aliado',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 4,   codigoFEDPA: 'BANCO ALIADO' },
  { label: 'Banco Davivienda',                 tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 270, codigoFEDPA: 'BANCO DAVIVIENDA' },
  { label: 'Banco Delta',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 254, codigoFEDPA: 'BANCO DELTA' },
  { label: 'Banco Ficohsa',                    tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 115, codigoFEDPA: 'BANCO FICOHSA' },
  { label: 'Banco General',                    tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 12,  codigoFEDPA: 'BANCO GENERAL' },
  { label: 'Banco Lafise',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 256, codigoFEDPA: 'BANCO LAFISE' },
  { label: 'Banco Nacional de Panamá',         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 45,  codigoFEDPA: 'BANCO NACIONAL DE PANAMA' },
  { label: 'Banco Pichincha',                  tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 265, codigoFEDPA: 'BANCO PICHINCHA PANAMA' },
  { label: 'Banesco',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 245, codigoFEDPA: 'BANESCO' },
  { label: 'Banisi',                           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 279, codigoFEDPA: 'BANISI' },
  { label: 'Banistmo',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 35,  codigoFEDPA: 'BANISTMO' },
  { label: 'BBP Bank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 292, codigoFEDPA: 'BBP BANK' },
  { label: 'BCT Bank International',           tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 79,  codigoFEDPA: 'BCT BANK INTERNATIONAL' },
  { label: 'Bi-Bank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 289, codigoFEDPA: 'BI-BANK' },
  { label: 'Caja de Ahorros',                  tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 46,  codigoFEDPA: 'CAJA DE AHORROS' },
  { label: 'Canal Bank',                       tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 281, codigoFEDPA: 'CANAL BANK' },
  { label: 'Capital Bank',                     tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 250, codigoFEDPA: 'CAPITAL BANK' },
  { label: 'Credicorp Bank',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 34,  codigoFEDPA: 'CREDICORP BANK' },
  { label: 'Global Bank',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 41,  codigoFEDPA: 'GLOBAL BANK' },
  { label: 'La Hipotecaria',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 259, codigoFEDPA: 'LA HIPOTECARIA' },
  { label: 'Mercantil Bank',                   tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 276, codigoFEDPA: 'MERCANTIL BANK PANAMA' },
  { label: 'Metrobank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 247, codigoFEDPA: 'METRO BANK' },
  { label: 'MMG Bank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 44,  codigoFEDPA: 'MMG BANK' },
  { label: 'Multibank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 24,  codigoFEDPA: 'MULTIBANK' },
  { label: 'Panabank',                         tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 19,  codigoFEDPA: 'PANABANK' },
  { label: 'Prival Bank',                      tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 267, codigoFEDPA: 'PRIVAL BANK' },
  { label: 'Scotiabank',                       tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 93,  codigoFEDPA: 'SCOTIABANK' },
  { label: 'St. Georges Bank',                 tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 75,  codigoFEDPA: 'ST. GEORGES BANK' },
  { label: 'Towerbank',                        tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 32,  codigoFEDPA: 'TOWERBANK' },
  { label: 'Unibank',                          tipo: 'BANCO', codTipoConductoIS: 1, codConductoIS: 257, codigoFEDPA: 'UNIBANK' },

  // ── COOPERATIVAS (también en /catalogos/bancos de IS) ─────────
  { label: 'CACECHI',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 286, codigoFEDPA: 'CACECHI' },
  { label: 'COOESAN',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 242, codigoFEDPA: 'COOESAN' },
  { label: 'COOPEDUC',                         tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 241, codigoFEDPA: 'COOPEDUC' },
  { label: 'COOPEVE',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 244, codigoFEDPA: 'COOPEVE' },
  { label: 'COOPRAC',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 288, codigoFEDPA: 'COOPRAC' },
  { label: 'Cooperativa de Servicios Múltiples Profesionales', tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 124, codigoFEDPA: 'COOPERATIVA DE SERVICIOS MULTIPLES PROFESIONALES' },
  { label: 'EDIOACC',                          tipo: 'COOPERATIVA', codTipoConductoIS: 1, codConductoIS: 293, codigoFEDPA: 'EDIOACC' },

  // ── OTROS (instituciones en catálogo IS relevantes para financiamiento) ─
  { label: 'Producbank',                       tipo: 'OTRO', codTipoConductoIS: 1, codConductoIS: 126, codigoFEDPA: 'PRODUCBANK' },
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
