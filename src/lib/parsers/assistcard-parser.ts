import { extractTextFromImageBuffer } from '@/lib/services/vision-ocr';

interface AssistcardRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function parseNumberToken(token: string): number {
  const cleaned = String(token || '')
    .replace(/,/g, '')
    .replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function isHeaderLine(u: string): boolean {
  return (
    u.includes('AGENCY') ||
    u.includes('DOC') ||
    u.includes('VOUCHER') ||
    u.includes('NOMBRE') ||
    u.includes('PAX') ||
    u.includes('NET') ||
    u.includes('SALES') ||
    u.includes('COMISSION') ||
    u.includes('COMMISSION')
  );
}

function extractRowsFromText(text: string): AssistcardRow[] {
  const lines = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rowsByBlocks: AssistcardRow[] = [];
  const isMoneyLine = (s: string) => /^-?\d+(?:\.\d+)?$/.test(String(s || '').trim()) && String(s || '').includes('.');
  const isDigitToken = (t: string) => /^\d{6,}$/.test(String(t || ''));

  let pending: { policy_number: string; client_name: string } | null = null;
  let seenCommissionHeader = false;
  let capturedAmounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const u = line.toUpperCase();

    if (isHeaderLine(u)) {
      if (u.includes('COMISSION') || u.includes('COMMISSION')) {
        seenCommissionHeader = true;
        capturedAmounts = [];
      }
      continue;
    }

    if (pending && seenCommissionHeader && isMoneyLine(line)) {
      const n = parseNumberToken(line);
      if (n) capturedAmounts.push(n);

      // En estos reportes normalmente vienen 2 montos consecutivos: Net Sales y luego Comission.
      // Tomamos el segundo si existe; si no, tomamos el único.
      if (capturedAmounts.length >= 2) {
        const gross_amount = capturedAmounts[1] ?? capturedAmounts[0] ?? 0;
        if (gross_amount) {
          rowsByBlocks.push({
            policy_number: pending.policy_number,
            client_name: pending.client_name,
            gross_amount,
          });
        }
        pending = null;
        seenCommissionHeader = false;
        capturedAmounts = [];
        continue;
      }

      // Si solo hay un monto, lo usamos como comisión (casos donde el OCR no capturó Net Sales).
      if (capturedAmounts.length === 1) {
        const next = lines[i + 1] || '';
        const nextIsMoney = isMoneyLine(next);
        if (!nextIsMoney) {
          const gross_amount = capturedAmounts[0] ?? 0;
          if (gross_amount) {
            rowsByBlocks.push({
              policy_number: pending.policy_number,
              client_name: pending.client_name,
              gross_amount,
            });
          }
          pending = null;
          seenCommissionHeader = false;
          capturedAmounts = [];
        }
      }

      continue;
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    const digitTokens = tokens.filter(isDigitToken);
    const hasNameComma = line.includes(',');
    if (digitTokens.length >= 1 && hasNameComma) {
      const voucherToken = digitTokens.find(t => t.length === 10) || digitTokens[0];
      if (voucherToken) {
        const lastDigitIdx = tokens.map((t, idx) => ({ t, idx })).filter(x => isDigitToken(x.t)).slice(-1)[0]?.idx;
        const nameStart = lastDigitIdx != null ? lastDigitIdx + 1 : 0;
        const client_name = tokens.slice(nameStart).join(' ').trim();
        if (client_name) {
          pending = { policy_number: voucherToken, client_name };
          seenCommissionHeader = false;
          continue;
        }
      }
    }
  }

  if (rowsByBlocks.length > 0) return rowsByBlocks;

  const rows: AssistcardRow[] = [];

  for (const line of lines) {
    const u = line.toUpperCase();
    if (isHeaderLine(u)) continue;

    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 4) continue;

    const firstDigitIdx = tokens.findIndex(t => /^\d{6,}$/.test(t));
    if (firstDigitIdx === -1) continue;

    const decimalIdxs = tokens
      .map((t, idx) => ({ t, idx }))
      .filter(x => /^-?\d+(?:\.\d+)?$/.test(x.t) && x.t.includes('.'))
      .map(x => x.idx);

    if (decimalIdxs.length === 0) continue;

    const commissionIdx = decimalIdxs[decimalIdxs.length - 1] as number;
    const gross_amount = parseNumberToken(tokens[commissionIdx] || '0');
    if (!gross_amount) continue;

    const digitTokens: Array<{ idx: number; value: string }> = [];
    for (let i = firstDigitIdx; i < tokens.length; i++) {
      const t = tokens[i];
      if (!t) continue;
      if (/^\d{6,}$/.test(t)) {
        digitTokens.push({ idx: i, value: t });
        if (digitTokens.length >= 3) break;
      } else {
        if (digitTokens.length > 0) break;
      }
    }

    if (digitTokens.length === 0) continue;

    const voucherToken = digitTokens.find(d => d.value.length === 10) || digitTokens[0];
    if (!voucherToken) continue;
    const policy_number = voucherToken.value;

    const nameStartIdx = digitTokens[digitTokens.length - 1]?.idx != null
      ? digitTokens[digitTokens.length - 1]!.idx + 1
      : firstDigitIdx + 1;

    const nameEndIdx = Math.min(commissionIdx, tokens.length);
    const nameTokens = tokens.slice(nameStartIdx, nameEndIdx);

    const client_name = nameTokens.join(' ').trim();
    if (!client_name) continue;

    rows.push({
      policy_number,
      client_name,
      gross_amount,
    });
  }

  return rows;
}

export async function parseAssistcardImage(fileBuffer: ArrayBuffer, fileName: string): Promise<AssistcardRow[]> {
  const ext = fileName.toLowerCase().split('.').pop();
  if (!ext || !['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(ext)) {
    return [];
  }

  const text = await extractTextFromImageBuffer(fileBuffer);
  const rows = extractRowsFromText(text);
  if (rows.length === 0) {
    const snippet = String(text || '')
      .split('\n')
      .slice(0, 25)
      .join('\n');
    console.log('[ASSISTCARD OCR] No se detectaron filas. Primeras líneas del OCR:');
    console.log(snippet);
  }
  return rows;
}

export function parseAssistcardText(text: string): AssistcardRow[] {
  return extractRowsFromText(text);
}
