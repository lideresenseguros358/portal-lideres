import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface AcertaRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

export async function parseAcertaPDF(fileBuffer: ArrayBuffer): Promise<AcertaRow[]> {
  console.log('[ACERTA PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[ACERTA PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[ACERTA PDF] ===== FIN TEXTO =====');

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  console.log(`[ACERTA PDF] Total líneas: ${lines.length}`);

  const upper = (s: string) => s.toUpperCase();
  const isMoney = (s: string) => /^\d+\.\d{2}$/.test(s);
  const isDigitsOnly = (s: string) => /^\d+$/.test(s);

  const idxHeader = lines.findIndex(l => upper(l).includes('FECHA POLIZA'));
  const policyPairs: Array<{ ramo: string; poliza: string; lineIndex: number }> = [];
  if (idxHeader >= 0) {
    const scanStart = Math.max(0, idxHeader - 80);
    for (let i = scanStart; i < idxHeader; i++) {
      const l = lines[i];
      if (!l) continue;
      const mNumeric = l.match(/^(\d{2})\s+(\d{2,10})$/);
      const mAlpha = l.match(/^([A-Z]{2,10})\s+(\d{2,10})$/);
      if (mNumeric && mNumeric[1] && mNumeric[2]) {
        policyPairs.push({ ramo: mNumeric[1], poliza: mNumeric[2], lineIndex: i });
      } else if (mAlpha && mAlpha[1] && mAlpha[2]) {
        policyPairs.push({ ramo: mAlpha[1], poliza: mAlpha[2], lineIndex: i });
      }
    }
  }

  const idxTotal = lines.findIndex(l => upper(l).startsWith('TOTAL'));
  const firstPolicyLineIndex = policyPairs.length > 0 ? policyPairs[0]?.lineIndex ?? -1 : -1;

  const namesRaw: string[] = [];
  if (idxTotal >= 0) {
    const nameEnd = firstPolicyLineIndex > idxTotal ? firstPolicyLineIndex : lines.length;
    for (let i = idxTotal + 1; i < nameEnd; i++) {
      const l = lines[i];
      if (!l) continue;
      const u = upper(l);
      if (u.startsWith('FECHA POLIZA') || u.includes('FECHA POLIZA') || u.includes('LIDERES EN SEGUROS')) break;
      if (isMoney(l) || isDigitsOnly(l)) continue;
      if (u.includes('TOTAL')) continue;
      if (/^(\d{2})\s+(\d{2,10})$/.test(l) || /^([A-Z]{2,10})\s+(\d{2,10})$/.test(u)) break;
      namesRaw.push(l);
    }
  }

  const names: string[] = [];
  for (const n of namesRaw) {
    const curr = n.trim();
    if (!curr) continue;

    const words = curr.split(/\s+/).filter(Boolean);
    const prev = names[names.length - 1] ?? '';
    const prevUpper = upper(prev);
    const currUpper = upper(curr);
    const isShortContinuation = (words.length <= 2 || curr.length <= 12) && /^[A-ZÑÁÉÍÓÚÜ\s,\.]+$/.test(currUpper);
    const shouldJoin = names.length > 0 && isShortContinuation && !prevUpper.startsWith('TOTAL');

    if (shouldJoin) {
      names[names.length - 1] = `${prev} ${curr}`.replace(/\s+/g, ' ').trim();
    } else {
      names.push(curr);
    }
  }

  console.log('[ACERTA PDF] Conteos extraídos:', {
    policyPairs: policyPairs.length,
    names: names.length,
    headerIndex: idxHeader,
    totalIndex: idxTotal,
  });

  const expectedCount = policyPairs.length;
  const commissions: number[] = [];
  if (expectedCount > 0) {
    const idxRec = lines.findIndex(l => upper(l) === 'REC');
    const idxTotalLabel = idxTotal >= 0 ? idxTotal : lines.findIndex(l => upper(l).startsWith('TOTAL:'));
    if (idxRec >= 0) {
      const scanEnd = idxTotalLabel > idxRec ? idxTotalLabel : lines.length;
      const block: string[] = [];
      for (let i = idxRec; i < scanEnd; i++) {
        const l = lines[i];
        if (!l) continue;
        const u = upper(l);
        if (u.startsWith('TOTAL')) break;
        block.push(l);
      }

      const moneyTokens = block.filter(t => isMoney(t)).map(t => parseFloat(t)).filter(n => !isNaN(n));
      if (moneyTokens.length >= expectedCount * 3) {
        commissions.push(...moneyTokens.slice(expectedCount * 2, expectedCount * 3));
      } else if (moneyTokens.length >= expectedCount) {
        commissions.push(...moneyTokens.slice(-expectedCount));
      }
    }
  }

  console.log('[ACERTA PDF] Conteos montos:', {
    policyPairs: policyPairs.length,
    names: names.length,
    commissions: commissions.length,
  });

  const rows: AcertaRow[] = [];
  const count = Math.min(policyPairs.length, names.length, commissions.length);

  for (let i = 0; i < count; i++) {
    const { ramo, poliza } = policyPairs[i] || { ramo: '', poliza: '', lineIndex: -1 };
    const clientName = names[i] || '';
    const commission = commissions[i] || 0;

    const policyNumber = ramo && poliza ? `${ramo}-${poliza}-0` : '';

    if (policyNumber && clientName && commission > 0) {
      rows.push({
        policy_number: policyNumber,
        client_name: clientName,
        gross_amount: commission,
      });
    }
  }

  console.log(`[ACERTA PDF] Total filas extraídas: ${rows.length}`);
  return rows;
}
