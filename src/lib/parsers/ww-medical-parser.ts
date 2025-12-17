import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface WWMedicalRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function upper(s: string) {
  return String(s || '').toUpperCase();
}

function parseMoney(s: string): number {
  const cleaned = String(s || '')
    .replace(/\s+/g, '')
    .replace(/,/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

const POLICY_RE = /^(WP[0-9A-Z]{2,}-\d{2}-\d+|WPSR-\d{4,6}|WVP-\d{4,6})$/i;
const POLICY_IN_TEXT_RE = /(WP[0-9A-Z]{2,}-\d{2}-\d+|WPSR-\d{4,6}|WVP-\d{4,6})/i;
const DATE_RE = /^\d{2}-[A-Z]{3}-\d{2}$/;
const MONEY_RE = /^-?\d{1,3}(?:,\d{3})*(?:\.\d{2})$|^-?\d+(?:\.\d{2})$/;

function extractMoneyTokens(s: string): number[] {
  return String(s || '')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && MONEY_RE.test(t))
    .map(t => parseMoney(t));
}

function extractRowFromLine(line: string): WWMedicalRow | null {
  const u = upper(line);
  const m = String(line || '').match(POLICY_IN_TEXT_RE);
  if (!m || !m[0]) return null;

  const policy_number = m[0].toUpperCase();

  const afterPolicy = String(line || '').slice((m.index || 0) + m[0].length).trim();
  const dateMatch = afterPolicy.match(/\b\d{2}-[A-Z]{3}-\d{2}\b/i);
  if (!dateMatch || dateMatch.index == null) return null;

  const nameRaw = afterPolicy.slice(0, dateMatch.index).trim();
  const client_name = nameRaw.replace(/\s+/g, ' ').trim();
  if (!client_name) return null;

  const beforeConcept = (() => {
    const idx = u.indexOf('COMISIONES');
    if (idx === -1) return String(line || '');
    return String(line || '').slice(0, idx);
  })();

  const monies = extractMoneyTokens(beforeConcept);
  const gross_amount = monies.length > 0 ? monies[monies.length - 1] || 0 : 0;
  if (!gross_amount) return null;

  return { policy_number, client_name, gross_amount };
}

export async function parseWWMedicalPDF(fileBuffer: ArrayBuffer): Promise<WWMedicalRow[]> {
  console.log('[WW MEDICAL PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[WW MEDICAL PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[WW MEDICAL PDF] ===== FIN TEXTO =====');

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  // 0) Intentar parseo por fila (cuando OCR devuelve una fila completa en una línea)
  const inlineRows: WWMedicalRow[] = [];
  for (const l of lines) {
    const row = extractRowFromLine(l);
    if (row) inlineRows.push(row);
  }

  if (inlineRows.length > 0) {
    console.log('[WW MEDICAL PDF] Modo inline detectado. Filas extraídas:', inlineRows.length);
    return inlineRows;
  }

  // 1) Extraer clientes: suelen venir listados después de las pólizas y antes de las fechas
  const firstPolicyIdx = lines.findIndex(l => POLICY_RE.test(String(l || '')));
  const lastPolicyIdx = firstPolicyIdx >= 0
    ? (() => {
        let idx = firstPolicyIdx;
        for (let i = firstPolicyIdx; i < lines.length; i++) {
          if (POLICY_RE.test(String(lines[i] || ''))) idx = i;
        }
        return idx;
      })()
    : -1;

  // 2) Extraer pólizas (solo del bloque inicial antes de nombres/fechas)
  const policies: string[] = [];
  if (firstPolicyIdx >= 0 && lastPolicyIdx >= firstPolicyIdx) {
    for (let i = firstPolicyIdx; i <= lastPolicyIdx; i++) {
      const s = String(lines[i] || '');
      if (POLICY_RE.test(s)) {
        policies.push(s.toUpperCase());
      }
    }
  }

  const names: string[] = [];
  if (lastPolicyIdx >= 0) {
    for (let i = lastPolicyIdx + 1; i < lines.length; i++) {
      const l = String(lines[i] || '');
      const u = upper(l);

      if (DATE_RE.test(u)) break;
      if (POLICY_RE.test(u)) continue;
      if (MONEY_RE.test(l)) continue;

      // Ignorar headers/labels
      if (
        u.includes('LIQUIDACION') ||
        u.includes('INTERMEDIARIO') ||
        u.includes('DETALLE') ||
        u.includes('POLIZA') ||
        u.includes('CLIENTE') ||
        u.includes('COMISIONES') ||
        u.includes('FACTURA') ||
        u.startsWith('**') ||
        u.includes('TOTAL')
      ) {
        continue;
      }

      // Heurística: nombre mayormente letras/espacios
      if (/^[A-ZÑÁÉÍÓÚÜ\s\.\-,]+$/.test(u) && u.replace(/\s+/g, '').length >= 6) {
        names.push(l.replace(/\s+/g, ' ').trim());
      }

      if (policies.length > 0 && names.length >= policies.length) break;
    }
  }

  // 3) Extraer comisiones: en el OCR aparecen como los últimos montos justo antes del bloque "COMISIONES"
  const idxConcept = lines.findIndex(l => upper(l) === 'COMISIONES');
  const moneyBeforeConcept: number[] = [];
  if (idxConcept > 0) {
    for (let i = 0; i < idxConcept; i++) {
      const l = String(lines[i] || '');
      if (MONEY_RE.test(l)) {
        const n = parseMoney(l);
        if (!Number.isNaN(n)) moneyBeforeConcept.push(n);
      }
    }
  }

  const expectedCount = policies.length;
  const commissions = expectedCount > 0
    ? moneyBeforeConcept.slice(-expectedCount)
    : [];

  console.log('[WW MEDICAL PDF] Conteos extraídos:', {
    policies: policies.length,
    names: names.length,
    commissions: commissions.length,
    idxConcept,
    moneyBeforeConcept: moneyBeforeConcept.length,
  });

  const rows: WWMedicalRow[] = [];
  const count = Math.min(policies.length, names.length, commissions.length);
  for (let i = 0; i < count; i++) {
    const policy_number = policies[i] || '';
    const client_name = names[i] || '';
    const gross_amount = commissions[i] || 0;

    if (!policy_number || !client_name) continue;

    rows.push({
      policy_number,
      client_name,
      gross_amount,
    });
  }

  console.log('[WW MEDICAL PDF] Total filas extraídas:', rows.length);
  return rows;
}
