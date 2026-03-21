import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface RegionalRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

export async function parseRegionalPDF(fileBuffer: ArrayBuffer): Promise<RegionalRow[]> {
  console.log('[REGIONAL PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[REGIONAL PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[REGIONAL PDF] ===== FIN TEXTO =====');

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  console.log(`[REGIONAL PDF] Total líneas: ${lines.length}`);

  const rows: RegionalRow[] = [];

  const isDigitsOnly = (s: string) => /^\d+$/.test(s);
  const isMoney = (s: string) => /^-?\d[\d,]*\.\d{2}$/.test(s);
  const isMoneyOrComma = (s: string) => /^-?\d{1,3}(?:,?\d{3})*\.\d{2}$/.test(s);

  const upper = (s: string) => s.toUpperCase();

  // Find ALL indices matching a predicate (for multi-page support)
  const findAllIndices = (predicate: (l: string) => boolean): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (predicate(lines[i]!)) indices.push(i);
    }
    return indices;
  };

  // Extract digit lists after EVERY occurrence of a marker
  const extractDigitsAfterAllMarkers = (marker: (l: string) => boolean, opts?: { minLen?: number; maxLen?: number; skip?: number }) => {
    const indices = findAllIndices(marker);
    const minLen = opts?.minLen ?? 1;
    const maxLen = opts?.maxLen ?? 20;
    const skip = opts?.skip ?? 0;
    const out: string[] = [];
    for (const idx of indices) {
      for (let i = idx + 1 + skip; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;
        if (!isDigitsOnly(l)) break;
        if (l.length >= minLen && l.length <= maxLen) out.push(l);
      }
    }
    return out;
  };

  // Extract digit lists before EVERY occurrence of a marker
  const extractDigitsBeforeAllMarkers = (marker: (l: string) => boolean, opts?: { minLen?: number; maxLen?: number }) => {
    const indices = findAllIndices(marker);
    const minLen = opts?.minLen ?? 1;
    const maxLen = opts?.maxLen ?? 20;
    const out: string[] = [];
    for (const idx of indices) {
      const chunk: string[] = [];
      for (let i = idx - 1; i >= 0; i--) {
        const l = lines[i];
        if (!l) continue;
        if (!isDigitsOnly(l)) break;
        if (l.length >= minLen && l.length <= maxLen) chunk.push(l);
      }
      out.push(...chunk.reverse());
    }
    return out;
  };

  // 1) Extraer pólizas: under "Ramo" header, collect 6-10 digit policy IDs from ALL pages
  const policyList: string[] = [];
  const ramoIndices = findAllIndices(l => upper(l) === 'RAMO');
  for (const ramoIdx of ramoIndices) {
    for (let i = ramoIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isDigitsOnly(l)) break;
      if (l.length >= 6 && l.length <= 10) policyList.push(l);
    }
  }

  // Sucursal: digits BEFORE "Suc." label (all pages)
  const sucursalList = extractDigitsBeforeAllMarkers(l => upper(l) === 'SUC.', { minLen: 1, maxLen: 2 });
  // Ramo (29): under "Nro." followed by "Recibo" — skip "Nro." + "Ingreso" sections
  const ramoList: string[] = [];
  const nroIndices = findAllIndices(l => upper(l) === 'NRO.');
  for (const nroIdx of nroIndices) {
    // Only process if the next line is "Recibo" (not "Ingreso")
    const nextLine = lines[nroIdx + 1];
    if (!nextLine || upper(nextLine) !== 'RECIBO') continue;
    for (let i = nroIdx + 2; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isDigitsOnly(l)) break;
      if (l.length >= 1 && l.length <= 3) ramoList.push(l);
    }
  }

  // 2) Extraer montos "Monto C. Pagado" from ALL pages
  // But we need the per-row commission, which is under "Monto Comision" not "Monto C. Pagado"
  // From the extracted text: "Monto" + "Comision" header, then values
  // Let's look for both commission columns
  const montoCPagadoList: number[] = [];
  const certList: string[] = [];

  // Find "Monto C." sections (all pages)
  // We use "Monto Comision" column instead — it appears as "Monto" + "Comision" on separate lines
  // Actually from the text, the correct commission column is "Monto C." + "Pagado"
  const montoCIndices = findAllIndices(l => upper(l).startsWith('MONTO C.'));
  let pageNum = 0;
  for (const montoCIdx of montoCIndices) {
    pageNum++;
    let start = montoCIdx + 1;
    const maybePagado = lines[start];
    if (maybePagado && upper(maybePagado) === 'PAGADO') start++;

    let lastMoneyIdx = -1;
    const pageAmounts: number[] = [];
    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isMoneyOrComma(l)) break;
      const n = parseFloat(l.replace(/,/g, ''));
      pageAmounts.push(isNaN(n) ? 0 : n);
      lastMoneyIdx = i;
    }

    console.log(`[REGIONAL PDF] Page ${pageNum} Monto C. Pagado: ${pageAmounts.length} amounts, first=${pageAmounts[0]}, last=${pageAmounts[pageAmounts.length-1]}`);

    // Page 1: first value is the page total, then individual values
    // Page 2+: first 1-2 values are running totals, then individual values
    // Heuristic: the page total equals the sum of individual values on that page
    // Simpler: if first amount equals sum of the rest, skip it
    if (pageAmounts.length > 1) {
      const first = pageAmounts[0]!;
      const rest = pageAmounts.slice(1);
      const sumRest = rest.reduce((a, b) => a + b, 0);
      // If first ≈ sum of rest, it's a total — skip it
      if (Math.abs(first - sumRest) < 0.05) {
        console.log(`[REGIONAL PDF] Page ${pageNum}: skipping total ${first} (sum of rest = ${sumRest.toFixed(2)})`);
        montoCPagadoList.push(...rest);
      } else if (pageNum > 1) {
        // On page 2+, try skipping first 2 values (prev total + running total)
        const withoutTwo = pageAmounts.slice(2);
        const sumWithoutTwo = withoutTwo.reduce((a, b) => a + b, 0);
        if (withoutTwo.length > 0 && pageAmounts.length > 2) {
          // Check if first two are totals
          const second = pageAmounts[1]!;
          if (Math.abs(first - second) < 0.05) {
            // Both are same total — skip both
            console.log(`[REGIONAL PDF] Page ${pageNum}: skipping 2 repeated totals ${first}`);
            montoCPagadoList.push(...withoutTwo);
          } else {
            // Just skip the first (prev page total)
            montoCPagadoList.push(...rest);
          }
        } else {
          montoCPagadoList.push(...rest);
        }
      } else {
        montoCPagadoList.push(...rest);
      }
    } else {
      montoCPagadoList.push(...pageAmounts);
    }

    // Cert: digits after the money list, until "Cert" label
    if (lastMoneyIdx >= 0) {
      for (let i = lastMoneyIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;
        const u = upper(l);
        if (u === 'CERT') break;
        if (!isDigitsOnly(l)) break;
        if (l.length >= 1 && l.length <= 4) certList.push(l);
      }
    }
  }

  // 3) Extraer nombres bajo "Operación" from ALL pages
  const namesRaw: string[] = [];
  const operacionIndices = findAllIndices(l => upper(l) === 'OPERACIÓN');
  for (const operacionIdx of operacionIndices) {
    for (let i = operacionIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const u = upper(l);

      if (u === 'NOMBRE ASEGURADO %IMP.' || u.startsWith('NOMBRE ASEGURADO') || u === 'CERT') break;

      if (u.includes('PAGO DE')) continue;
      if (u.startsWith('TOTAL ')) continue;
      if (u.startsWith('SUB-TOTAL')) continue;
      if (u.includes('COMISIONES')) continue;
      if (isMoney(l) || isMoneyOrComma(l) || isDigitsOnly(l)) continue;
      // Skip lines with comma-formatted totals like "2,491.79Total Reporte: 470.13"
      if (u.includes('TOTAL REPORTE') || u.includes('REPORTE:')) continue;

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
    const shouldJoin =
      names.length > 0 &&
      isShortContinuation &&
      !prevUpper.includes('PAGO DE') &&
      !prevUpper.startsWith('TOTAL ');

    if (shouldJoin) {
      names[names.length - 1] = `${prev} ${curr}`.replace(/\s+/g, ' ').trim();
    } else {
      names.push(curr);
    }
  }

  console.log('[REGIONAL PDF] Conteos extraídos:', {
    sucursalList: sucursalList.length,
    ramoList: ramoList.length,
    policyList: policyList.length,
    names: names.length,
    montoCPagadoList: montoCPagadoList.length,
    certList: certList.length,
  });

  // Debug: show first few of each list
  console.log('[REGIONAL PDF] First 3 policies:', policyList.slice(0, 3));
  console.log('[REGIONAL PDF] First 3 names:', names.slice(0, 3));
  console.log('[REGIONAL PDF] First 3 comisiones:', montoCPagadoList.slice(0, 3));
  console.log('[REGIONAL PDF] Last 3 policies:', policyList.slice(-3));
  console.log('[REGIONAL PDF] Last 3 names:', names.slice(-3));
  console.log('[REGIONAL PDF] Last 3 comisiones:', montoCPagadoList.slice(-3));

  // Align: if montoCPagadoList has more entries than policies (running totals snuck in), trim from end
  const expectedCount = Math.min(policyList.length, names.length);
  let alignedMontoCPagadoList = montoCPagadoList;
  if (expectedCount > 0 && montoCPagadoList.length > expectedCount) {
    // Try trimming excess from start (running totals at page breaks)
    alignedMontoCPagadoList = montoCPagadoList.slice(montoCPagadoList.length - expectedCount);
  }

  console.log(`[REGIONAL PDF] Expected rows: ${expectedCount}, aligned comisiones: ${alignedMontoCPagadoList.length}`);

  const count = Math.min(policyList.length, names.length, alignedMontoCPagadoList.length);
  for (let i = 0; i < count; i++) {
    const policyReal = policyList[i] || '';
    const suc = sucursalList[i] || sucursalList[0] || '';
    const ramo = ramoList[i] || ramoList[0] || '';
    const cert = certList[i] || certList[0] || '0';
    const policyFull = suc && ramo ? `${suc}-${ramo}-${policyReal}-${cert}` : policyReal;
    const clientName = names[i] || '';
    const grossAmount = alignedMontoCPagadoList[i] || 0;

    if (policyFull && clientName && Math.abs(grossAmount) > 0.01) {
      rows.push({
        policy_number: policyFull,
        client_name: clientName,
        gross_amount: grossAmount,
      });
    }
  }

  console.log(`[REGIONAL PDF] Total filas extraídas: ${rows.length}`);
  return rows;
}
