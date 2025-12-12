import { extractTextFromPDF } from '@/lib/services/vision-ocr';

export interface OptimaRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseAmount(raw: string): number {
  const s = String(raw || '').trim();
  if (!s) return 0;
  const normalized = s.replace(/,/g, '').replace(/^\./, '0.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function getLines(text: string) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function sliceBetween(lines: string[], startIdx: number, endIdx: number) {
  if (startIdx < 0 || endIdx < 0) return [];
  if (endIdx <= startIdx) return [];
  return lines.slice(startIdx + 1, endIdx).filter(Boolean);
}

function findIndex(lines: string[], predicate: (l: string) => boolean) {
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i] || '')) return i;
  }
  return -1;
}

function findNextIndex(lines: string[], from: number, predicate: (l: string) => boolean) {
  for (let i = Math.max(from, 0); i < lines.length; i++) {
    if (predicate(lines[i] || '')) return i;
  }
  return -1;
}

function normalizeHeader(s: string) {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isLikelyNameLine(l: string) {
  const u = normalizeHeader(l);
  if (!u) return false;
  if (u.includes('REGULADO') || u.includes('SUPERVISADO')) return false;
  if (u.includes('TOTALES') || u.includes('SALDO')) return false;
  if (u === 'ASEGURADO' || u === 'POLIZA' || u === 'GANADOS') return false;
  if (u.includes('PAGO DE') || u.includes('HON PROF') || u.includes('CORRESP')) return false;
  if (/^[-+]?\d+[\d.,]*%?$/.test(l)) return false;
  return /[A-ZÑÁÉÍÓÚÜ]/.test(u);
}

function buildPoliciesFromTokens(tokens: string[]): string[] {
  const clean = tokens
    .map((t) => String(t || '').trim())
    .filter((t) => t && /^\d+$/.test(t));

  if (clean.length < 4) return [];
  if (clean.length % 4 !== 0) return [];

  const n = clean.length / 4;
  const a = clean.slice(0, n);
  const b = clean.slice(n, 2 * n);
  const c = clean.slice(2 * n, 3 * n);
  const d = clean.slice(3 * n, 4 * n);

  const pad2 = (x: string) => x.padStart(2, '0');
  const pad6 = (x: string) => x.padStart(6, '0');

  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = pad2(a[i] || '');
    const p2 = pad2(b[i] || '');
    const p3 = pad6(c[i] || '');
    const p4 = d[i] || '';
    if (!p1 || !p2 || !p3 || !p4) continue;
    out.push(`${p1}-${p2}-${p3}-${p4}`);
  }
  return out;
}

function collectContiguousNumericBlockBefore(lines: string[], index: number): string[] {
  const out: string[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const l = String(lines[i] || '').trim();
    if (!/^\d+$/.test(l)) break;
    out.unshift(l);
  }
  return out;
}

function collectContiguousNumericLinesAfter(lines: string[], index: number, stopIndex: number): string[] {
  const out: string[] = [];
  for (let i = index + 1; i < lines.length && i < stopIndex; i++) {
    const l = String(lines[i] || '').trim();
    if (!/^\d+$/.test(l)) break;
    out.push(l);
  }
  return out;
}

export async function parseOptimaPDF(fileBuffer: ArrayBuffer): Promise<OptimaRow[]> {
  console.log('[OPTIMA PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[OPTIMA PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[OPTIMA PDF] ===== FIN TEXTO =====');

  const lines = getLines(text);

  const refIdx = findIndex(lines, (l) => normalizeHeader(l) === 'REF');
  const fechaIdx = findIndex(lines, (l) => normalizeHeader(l) === 'FECHA');
  const tipoIdx = findIndex(lines, (l) => normalizeHeader(l) === 'TIPO');
  const polizaIdx = findIndex(lines, (l) => normalizeHeader(l) === 'POLIZA' || normalizeHeader(l) === 'POLIZA ');
  const aseguradoIdx = findIndex(lines, (l) => normalizeHeader(l) === 'ASEGURADO');
  const primaIdx = findIndex(lines, (l) => normalizeHeader(l) === 'PRIMA');
  const ganadosIdx = findIndex(lines, (l) => normalizeHeader(l) === 'GANADOS');
  const percentIdx = findIndex(lines, (l) => normalizeHeader(l).includes('%COMISION'));

  const paidIdx = findIndex(lines, (l) => normalizeHeader(l).startsWith('PAGADO'));

  const refList = sliceBetween(lines, refIdx, fechaIdx);
  const fechaList = sliceBetween(lines, fechaIdx, tipoIdx);
  // En OPTIMA OCR, la columna Tipo (AD/CH) aparece ENTRE "Fecha" y "Tipo"
  const tipoList = fechaList;

  const polizaTokensStart = polizaIdx;
  let polizaTokensEnd = aseguradoIdx;
  if (polizaTokensEnd < 0) {
    polizaTokensEnd = findNextIndex(lines, polizaTokensStart + 1, isLikelyNameLine);
  }

  // En OPTIMA, el OCR suele poner la 1ra parte de la póliza (ej: 02 14 01...) ANTES del header "Póliza"
  // y las otras partes después. Tomamos el bloque numérico contiguo antes + los bloques numéricos contiguos después.
  const beforePoliza = collectContiguousNumericBlockBefore(lines, polizaTokensStart);
  const afterPoliza = collectContiguousNumericLinesAfter(lines, polizaTokensStart, polizaTokensEnd);
  const polizaTokens = [...beforePoliza, ...afterPoliza];
  const policyNumbers = buildPoliciesFromTokens(polizaTokens);

  // En el OCR de OPTIMA, los nombres aparecen ANTES del header "Asegurado".
  // Se ubican inmediatamente después del último token numérico del bloque de póliza.
  const afterPolizaEndIdx = polizaTokensStart + afterPoliza.length;
  const insuredCandidates = sliceBetween(lines, afterPolizaEndIdx, aseguradoIdx);

  // En el OCR de OPTIMA, la columna "Ganados" (comisión) aparece como números ENTRE "%Comisión" y "Ganados".
  // El bloque después de "Ganados" corresponde a "Pagado/Descontado" y NO debe usarse como comisión.
  const commissionRaw = percentIdx >= 0 && ganadosIdx >= 0 ? sliceBetween(lines, percentIdx, ganadosIdx) : [];
  const commissionList = commissionRaw.map(parseAmount);

  // En algunos reportes hay líneas CH (cheque) que aparecen como fila con "PAGO DE..." y
  // comisión 0.00 (porque lo pagado va en otra columna). Esas filas NO deben desplazar la alineación.
  // Usamos la columna Tipo para excluir CH y mantener el índice sincronizado.
  const keepIndices = (tipoList || [])
    .map((t, idx) => ({ t: String(t || '').trim().toUpperCase(), idx }))
    .filter(({ t }) => t && t !== 'CH')
    .map(({ idx }) => idx);

  const alignedCommissions = keepIndices.length > 0
    ? keepIndices.map(i => commissionList[i] ?? 0)
    : commissionList;

  const alignedNamesRaw = keepIndices.length > 0
    ? keepIndices.map(i => String(insuredCandidates[i] || '').trim())
    : insuredCandidates.map(n => String(n || '').trim());

  const insuredList = alignedNamesRaw.map(n => (isLikelyNameLine(n) ? n : '')).filter(Boolean);

  const n = Math.min(policyNumbers.length, insuredList.length, alignedCommissions.length);

  console.log('[OPTIMA PDF] Conteos:', {
    refs: refList.length,
    fechas: fechaList.length,
    tipos: tipoList.length,
    policies: policyNumbers.length,
    insured: insuredList.length,
    ganados: alignedCommissions.length,
    taking: n,
  });

  const out: OptimaRow[] = [];
  for (let i = 0; i < n; i++) {
    const policy = policyNumbers[i] || '';
    const insured = String(insuredList[i] || '').trim();
    const gross = alignedCommissions[i] || 0;

    if (!policy || !insured || !gross) continue;

    out.push({
      policy_number: policy,
      client_name: insured,
      gross_amount: gross,
    });
  }

  console.log('[OPTIMA PDF] Total filas extraídas:', out.length);
  return out;
}
