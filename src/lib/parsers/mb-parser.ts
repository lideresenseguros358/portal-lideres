import { extractTextFromPDF } from '@/lib/services/vision-ocr';

export interface MBRow {
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

export async function parseMBPDF(fileBuffer: ArrayBuffer): Promise<MBRow[]> {
  console.log('[MB PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[MB PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[MB PDF] ===== FIN TEXTO =====');

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
  const tipoList = fechaList;

  const polizaTokensStart = polizaIdx;
  let polizaTokensEnd = aseguradoIdx;
  if (polizaTokensEnd < 0) {
    polizaTokensEnd = findNextIndex(lines, polizaTokensStart + 1, isLikelyNameLine);
  }

  const beforePoliza = collectContiguousNumericBlockBefore(lines, polizaTokensStart);
  const afterPoliza = collectContiguousNumericLinesAfter(lines, polizaTokensStart, polizaTokensEnd);
  const polizaTokens = [...beforePoliza, ...afterPoliza];
  const policyNumbers = buildPoliciesFromTokens(polizaTokens);

  const afterPolizaEndIdx = polizaTokensStart + afterPoliza.length;
  const insuredCandidates = sliceBetween(lines, afterPolizaEndIdx, aseguradoIdx);

  const commissionRaw = percentIdx >= 0 && ganadosIdx >= 0 ? sliceBetween(lines, percentIdx, ganadosIdx) : [];
  const commissionList = commissionRaw.map(parseAmount);

  const keepIndices = (tipoList || [])
    .map((t, idx) => ({ t: String(t || '').trim().toUpperCase(), idx }))
    .filter(({ t }) => t && t !== 'CH')
    .map(({ idx }) => idx);

  const alignedCommissions = keepIndices.length > 0
    ? keepIndices.map(i => commissionList[i] ?? 0)
    : commissionList;

  // Primero filtrar anotaciones del reporte de insuredCandidates
  const cleanedInsuredCandidates = insuredCandidates.map(name => {
    const n = String(name || '').trim();
    const nUpper = n.toUpperCase();
    
    // Si parece anotación del reporte, retornar vacío
    if (nUpper.includes('PAGO DE') || 
        nUpper.includes('HONORARIOS') || 
        nUpper.includes('PROFESIONALES') ||
        nUpper.includes('OCTUBRE') ||
        nUpper.includes('NOVIEMBRE') ||
        nUpper.includes('DICIEMBRE') ||
        nUpper.includes('ENERO') ||
        nUpper.includes('FEBRERO') ||
        nUpper.includes('MARZO') ||
        nUpper.includes('ABRIL') ||
        nUpper.includes('MAYO') ||
        nUpper.includes('JUNIO') ||
        nUpper.includes('JULIO') ||
        nUpper.includes('AGOSTO') ||
        nUpper.includes('SEPTIEMBRE') ||
        /^\d{2}\s+AL\s+\d{2}\s+DE/.test(nUpper)) {
      return '';
    }
    return n;
  });

  const alignedNamesRaw = keepIndices.length > 0
    ? keepIndices.map(i => cleanedInsuredCandidates[i] || '')
    : cleanedInsuredCandidates;

  // Filtrar nombres vacíos y mantener solo los válidos
  const insuredList = alignedNamesRaw.filter(n => n && n.length >= 3);

  const n = Math.min(policyNumbers.length, insuredList.length, alignedCommissions.length);

  console.log('[MB PDF] Conteos:', {
    refs: refList.length,
    fechas: fechaList.length,
    tipos: tipoList.length,
    policies: policyNumbers.length,
    insured: insuredList.length,
    ganados: alignedCommissions.length,
    taking: n,
  });

  const out: MBRow[] = [];
  for (let i = 0; i < n; i++) {
    const policy = policyNumbers[i] || '';
    const insured = String(insuredList[i] || '').trim();
    const gross = alignedCommissions[i] || 0;

    // Saltar filas sin número de póliza válido
    if (!policy || policy.length < 10) {
      console.log(`[MB PDF] Saltando fila ${i + 1}: número de póliza inválido o vacío`);
      continue;
    }

    // Saltar filas sin nombre de cliente o con anotaciones del reporte
    if (!insured || insured.length < 3) {
      console.log(`[MB PDF] Saltando fila ${i + 1}: nombre de cliente vacío o muy corto`);
      continue;
    }

    // Saltar filas con texto que parece anotación del reporte
    const insuredUpper = insured.toUpperCase();
    if (insuredUpper.includes('PAGO DE') || 
        insuredUpper.includes('HONORARIOS') || 
        insuredUpper.includes('PROFESIONALES') ||
        insuredUpper.includes('OCTUBRE') ||
        insuredUpper.includes('NOVIEMBRE') ||
        insuredUpper.includes('DICIEMBRE') ||
        insuredUpper.includes('ENERO') ||
        insuredUpper.includes('FEBRERO') ||
        insuredUpper.includes('MARZO') ||
        insuredUpper.includes('ABRIL') ||
        insuredUpper.includes('MAYO') ||
        insuredUpper.includes('JUNIO') ||
        insuredUpper.includes('JULIO') ||
        insuredUpper.includes('AGOSTO') ||
        insuredUpper.includes('SEPTIEMBRE') ||
        /^\d{2}\s+AL\s+\d{2}\s+DE/.test(insuredUpper)) {
      console.log(`[MB PDF] Saltando fila ${i + 1}: texto parece anotación del reporte (${insured.substring(0, 50)}...)`);
      continue;
    }

    // Saltar filas sin comisión
    if (!gross || gross === 0) {
      console.log(`[MB PDF] Saltando fila ${i + 1}: comisión es 0 o vacía`);
      continue;
    }

    out.push({
      policy_number: policy,
      client_name: insured,
      gross_amount: gross,
    });
  }

  console.log('[MB PDF] Total filas extraídas:', out.length);
  return out;
}
