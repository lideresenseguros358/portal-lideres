// lib/importMaps.ts
// Normalizadores por aseguradora + utilidades comunes

// ------------------------- Tipos -------------------------
export type InsurerKey =
  | 'ACERTA' | 'ANCON' | 'ASSA' | 'BANESCO' | 'FEDPA' | 'GENERAL'
  | 'IFS' | 'INTERNACIONAL' | 'REGIONAL' | 'MAPFRE' | 'MB' | 'OPTIMA'
  | 'PALIG' | 'SURA' | 'VIVIR' | 'WWMEDICAL' | 'MERCANTIL' | 'ALIADO' | 'ASSISTCARD';

export type RowObj = Record<string, any> | string[];  // CSV/XLSX o arreglo
export interface Normalized {
  policy: string;      // número de póliza (o Voucher / Poliza/Cert según cias)
  insured: string;     // nombre asegurado / referencia / banco
  commission: number;  // monto (si viene con () = negativo)
}

type Ctx = { headers?: string[] }; // por si recibes arreglo y además headers

type Resolver = (row: RowObj, ctx: Ctx) => Normalized | null;

// ------------------------- Utils -------------------------
const norm = (s: any) => String(s ?? '').trim();

// convierte "1,234.56" o "(1,234.56)" o "1.234,56" a número JS
export function toNumber(v: any): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s);          // formato contable (..)
  s = s.replace(/[()]/g, '');
  // intenta detectar separadores; primero elimina miles
  // soporta "1,234.56", "1.234,56", "1234,56", "1234.56"
  const comma = s.indexOf(','); const dot = s.indexOf('.');
  if (comma > -1 && dot > -1) {
    if (dot < comma) s = s.replace(/\./g, '').replace(',', '.');  // 1.234,56
    else s = s.replace(/,/g, '');                                  // 1,234.56
  } else if (comma > -1 && dot === -1) {
    // "1234,56" -> usa coma como decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, ''); // "1,234" -> 1234
  }
  const n = Number(s);
  return neg ? -Math.abs(n) : (isFinite(n) ? n : 0);
}

// busca columna por alias (case-insensitive)
function pick(obj: RowObj, aliases: string[], ctx?: Ctx): any {
  if (Array.isArray(obj)) {
    // si es arreglo, intenta con headers si existen
    const headers = ctx?.headers ?? [];
    for (const a of aliases) {
      const idx = headers.findIndex(h => h?.toLowerCase() === a.toLowerCase());
      if (idx >= 0) return obj[idx];
    }
    return undefined;
  }
  const lower = Object.fromEntries(Object.keys(obj).map(k => [k.toLowerCase(), k]));
  for (const a of aliases) {
    const k = lower[a.toLowerCase()];
    if (k) return (obj as Record<string, any>)[k];
  }
  return undefined;
}

// penúltima columna (tu requerimiento para ACERTA)
function penultimate(obj: RowObj, ctx?: Ctx): any {
  if (Array.isArray(obj)) {
    return obj.length >= 2 ? obj[obj.length - 2] : undefined;
  }
  const keys = Object.keys(obj);
  return keys.length >= 2 ? (obj as Record<string, any>)[keys[keys.length - 2]] : undefined;
}

// extrae token numérico >= 3 dígitos (MB/ÓPTIMA/ACERTA variante)
function extractPolicyFromMixed(cell: any): string {
  const s = norm(cell);
  const tokens = s.split(/\s+/);
  const best = tokens.find(t => /^\d{3,}$/.test(t));
  return best ?? s;
}

// asegura string limpio (sin saltos ni dobles espacios)
function cleanText(v: any): string {
  return norm(v).replace(/\s+/g, ' ');
}

// util para ASSA (elige primera columna de honorarios no-cero)
function firstNonZero(obj: RowObj, aliasesGroups: string[][], ctx?: Ctx): number {
  for (const group of aliasesGroups) {
    const v = pick(obj, group, ctx);
    const n = toNumber(v);
    if (Math.abs(n) > 0) return n;
  }
  return 0;
}

// ------------------------- Resolvers por aseguradora -------------------------
const maps: Record<InsurerKey, Resolver> = {
  // ACERTA:
  // Poliza: número >= 3 dígitos; Cliente: campo cliente; Comisión: penúltima columna SIEMPRE.
  ACERTA: (row, ctx) => {
    const policyRaw =
      pick(row, ['Poliza', 'Póliza', 'policy', 'No Poliza', 'No. Poliza'], ctx) ??
      (Array.isArray(row) ? row[0] : '');
    const policy = extractPolicyFromMixed(policyRaw);

    const insured = cleanText(
      pick(row, ['Cliente', 'Asegurado', 'Nombre Asegurado', 'Nombre del Asegurado'], ctx) ??
      (Array.isArray(row) ? row[1] : '')
    );

    const comm = toNumber(penultimate(row, ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // ANCON: Poliza / Asegurado / Comision
  ANCON: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza', 'policy', 'No. de póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión', 'Comision generada'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // ASSA: Poliza / Asegurado / Honorarios Profesionales (Monto | Vida 1er. Año | Vida renov.) -> primera no-cero
  ASSA: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza', 'policy', 'No. póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = firstNonZero(
      row,
      [
        ['Honorarios Profesionales (Monto)', 'Honorarios Profesionales', 'Monto'],
        ['Vida 1er. Año', 'Vida Primer Año'],
        ['Vida renov.', 'Vida Renov.', 'Vida Renovacion']
      ],
      ctx
    );
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // BANESCO
  BANESCO: (row, ctx) => {
    const policy = cleanText(pick(row, ['No. De póliza', 'No. de póliza', 'Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Nombre del Asegurado', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision generada', 'Comisión generada', 'Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // FEDPA
  FEDPA: (row, ctx) => {
    const policy = cleanText(pick(row, ['Nro póliza', 'No Poliza', 'Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Nombre Asegurado', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Monto Honorarios', 'Honorarios', 'Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // GENERAL DE SEGUROS
  GENERAL: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Cliente', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision Ganada', 'Comisión Ganada', 'Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // IFS
  IFS: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Cliente', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // INTERNACIONAL
  INTERNACIONAL: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado/Banco', 'Asegurado', 'Banco'], ctx));
    const comm = toNumber(pick(row, ['Total'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // REGIONAL
  REGIONAL: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Nombre Asegurado', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Monto C. Pagado', 'Comision Pagado', 'Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // MAPFRE
  MAPFRE: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // MB Seguros (Multibank Seguros)
  MB: (row, ctx) => {
    const polRaw =
      pick(row, ['Poliza', 'Póliza', 'Detalle', 'Descripcion'], ctx) ??
      (Array.isArray(row) ? row[0] : '');
    const policy = extractPolicyFromMixed(polRaw);
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx) ?? (Array.isArray(row) ? row[1] : ''));
    const comm = toNumber(pick(row, ['Ganados', 'Comision'], ctx) ?? (Array.isArray(row) ? row[2] : 0));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // OPTIMA
  OPTIMA: (row, ctx) => {
    const polRaw = pick(row, ['Poliza', 'Póliza', 'Detalle'], ctx) ?? (Array.isArray(row) ? row[0] : '');
    const policy = extractPolicyFromMixed(polRaw);
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx) ?? (Array.isArray(row) ? row[1] : ''));
    const comm = toNumber(pick(row, ['Ganados', 'Comision'], ctx) ?? (Array.isArray(row) ? row[2] : 0));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // PALIG (múltiples tablas en un PDF) -> Poliza/Cert / Referencia / Total
  PALIG: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza/Cert', 'Póliza/Cert', 'Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Referencia'], ctx)); // así me lo pediste
    const comm = toNumber(pick(row, ['Total'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // SURA (varias tablas posible)
  SURA: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión', 'Total Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // UNIVIVIR (VIVIR)
  VIVIR: (row, ctx) => {
    const policy = cleanText(pick(row, ['Nro Poliza', 'Nro póliza', 'Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // WWMEDICAL
  WWMEDICAL: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Cliente', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // MERCANTIL
  MERCANTIL: (row, ctx) => {
    const policy = cleanText(pick(row, ['Nro de Poliza', 'No. de Poliza', 'Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Nombre Asegurado', 'Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision Generada', 'Comisión Generada', 'Comision'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // ALIADO
  ALIADO: (row, ctx) => {
    const policy = cleanText(pick(row, ['Poliza', 'Póliza'], ctx));
    const insured = cleanText(pick(row, ['Asegurado', 'Nombre Asegurado'], ctx));
    const comm = toNumber(pick(row, ['Comision', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },

  // ASSIST CARD
  ASSISTCARD: (row, ctx) => {
    const policy = cleanText(pick(row, ['Voucher'], ctx)); // así lo pediste
    const insured = cleanText(pick(row, ['Nombre Pax', 'Pasajero'], ctx));
    const comm = toNumber(pick(row, ['Comission', 'Commission', 'Comisión'], ctx));
    if (!policy || !insured) return null;
    return { policy, insured, commission: comm };
  },
};

// ------------------------- API de normalización -------------------------
export function normalizeRow(insurer: InsurerKey, row: RowObj, ctx: Ctx = {}): Normalized | null {
  const r = maps[insurer];
  if (!r) throw new Error(`Aseguradora no soportada: ${insurer}`);
  const n = r(row, ctx);
  if (!n) return null;
  // sanitiza finales
  return {
    policy: norm(n.policy),
    insured: cleanText(n.insured),
    commission: Number.isFinite(n.commission) ? n.commission : 0,
  };
}

export function normalizeRows(insurer: InsurerKey, rows: RowObj[], headers?: string[]) {
  const ctx: Ctx = { headers };
  const normalized: Normalized[] = [];
  let skipped = 0;
  for (const r of rows) {
    const n = normalizeRow(insurer, r, ctx);
    if (n && n.policy && n.insured) normalized.push(n);
    else skipped++;
  }
  return { normalized, skipped };
}

// ------------------------- ASSA CÓDIGOS (tabla assa_progress / assa_codes) -------------------------
// Regla: solo filas cuyo SUFIJO sea "PJ750-XXX". Los números de código vienen en columna "LICENCIA".
// La comisión está en "COMISION PAGADA".

export interface AssaCodeRow {
  license: string;        // LICENCIA
  suffix?: string;        // SUFIJO (debe machar PJ750-XXX)
  commission_paid: number;// COMISION PAGADA
  policy?: string;        // si viene
  brokerEmail?: string;   // si viene
}

const SUFFIX_RE = /^PJ750-\w{3}$/i;

export function parseAssaCodesRow(row: RowObj, ctx?: Ctx): AssaCodeRow | null {
  const lic = norm(pick(row, ['LICENCIA', 'Licencia', 'license'], ctx));
  const suf = norm(pick(row, ['SUFIJO', 'Sufijo', 'suffix'], ctx));
  const paid = toNumber(pick(row, ['COMISION PAGADA', 'Comision Pagada', 'Commission Paid'], ctx));
  if (!SUFFIX_RE.test(suf)) return null; // ignorar si no cumple sufijo
  return {
    license: lic,
    suffix: suf,
    commission_paid: paid,
    policy: norm(pick(row, ['POLIZA', 'Póliza', 'Poliza', 'Policy'], ctx)),
    brokerEmail: norm(pick(row, ['BrokerEmail', 'Correo', 'Email'], ctx)),
  };
}
