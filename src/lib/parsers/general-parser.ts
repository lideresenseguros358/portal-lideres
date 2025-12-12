import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface GeneralRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

export async function parseGeneralPDF(fileBuffer: ArrayBuffer): Promise<GeneralRow[]> {
  console.log('[GENERAL PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[GENERAL PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[GENERAL PDF] ===== FIN TEXTO =====');

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  console.log(`[GENERAL PDF] Total líneas: ${lines.length}`);

  const upper = (s: string) => s.toUpperCase();

  const parseMoney = (raw: string): number => {
    const s = raw.trim();
    if (!s) return 0;
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  };

  const policyRegex = /\b([A-Z]{2,15}-\d{2,15}-\d{2,6})\b/;
  const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/;
  const moneyTokenRegex = /\b\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})\b/g;

  const isCandidateName = (l: string) => {
    const u = upper(l);
    if (u.includes('TOTALES')) return false;
    if (u.includes('RECIBO')) return false;
    if (u.includes('AGENTE')) return false;
    if (u.includes('LICENCIA')) return false;
    if (u.includes('STATUS')) return false;
    if (u.includes('POLIZA')) return false;
    if (u.includes('CLIENTE')) return false;
    if (u.includes('PRIMA')) return false;
    if (u.includes('COMISION')) return false;
    if (u.includes('SALDO')) return false;
    if (dateRegex.test(l)) return false;
    if (/\d/.test(l)) return false;
    if (l.length < 10) return false;
    if (!/^[A-ZÑÁÉÍÓÚÜ\s,\.]+$/.test(u)) return false;
    return true;
  };

  const rows: GeneralRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const policyMatch = line.match(policyRegex);
    if (!policyMatch || !policyMatch[1]) continue;

    const policyNumber = policyMatch[1];

    let clientName = '';
    for (let j = i - 1; j >= 0 && j >= i - 80; j--) {
      const cand = lines[j];
      if (!cand) continue;
      if (isCandidateName(cand)) {
        clientName = cand;
        break;
      }
    }

    if (!clientName) {
      for (let j = i - 1; j >= 0; j--) {
        const cand = lines[j];
        if (!cand) continue;
        if (isCandidateName(cand)) {
          clientName = cand;
          break;
        }
      }
    }

    let grossAmount = 0;
    for (let j = i - 1; j >= 0 && j >= i - 40; j--) {
      const l = lines[j];
      if (!l) continue;
      if (!dateRegex.test(l)) continue;

      const tokens = l.match(moneyTokenRegex) || [];
      if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        if (last) grossAmount = parseMoney(last);
        break;
      }
    }

    if (!grossAmount) {
      for (let j = i + 1; j < lines.length && j <= i + 40; j++) {
        const l = lines[j];
        if (!l) continue;
        if (!dateRegex.test(l)) continue;
        const tokens = l.match(moneyTokenRegex) || [];
        if (tokens.length >= 2) {
          const last = tokens[tokens.length - 1];
          if (last) grossAmount = parseMoney(last);
          break;
        }
      }
    }

    if (!grossAmount) {
      for (let j = i - 1; j >= 0 && j >= i - 80; j--) {
        const l = lines[j];
        if (!l) continue;
        const u = upper(l);
        if (u.includes('TOTALES')) continue;
        const tokens = l.match(moneyTokenRegex) || [];
        if (tokens.length >= 2) {
          const last = tokens[tokens.length - 1];
          if (last) grossAmount = parseMoney(last);
          break;
        }
      }
    }

    if (!grossAmount) {
      for (let j = i + 1; j < lines.length && j <= i + 80; j++) {
        const l = lines[j];
        if (!l) continue;
        const u = upper(l);
        if (u.includes('TOTALES')) continue;
        const tokens = l.match(moneyTokenRegex) || [];
        if (tokens.length >= 2) {
          const last = tokens[tokens.length - 1];
          if (last) grossAmount = parseMoney(last);
          break;
        }
      }
    }

    if (policyNumber && clientName && grossAmount > 0) {
      rows.push({
        policy_number: policyNumber,
        client_name: clientName,
        gross_amount: grossAmount,
      });
    }
  }

  const unique = new Map<string, GeneralRow>();
  for (const r of rows) {
    if (!unique.has(r.policy_number)) unique.set(r.policy_number, r);
  }

  const out = Array.from(unique.values());
  console.log(`[GENERAL PDF] Total filas extraídas: ${out.length}`);
  return out;
}
