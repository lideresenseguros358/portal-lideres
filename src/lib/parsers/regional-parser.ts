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
  const isMoney = (s: string) => /^\d+\.\d{2}$/.test(s);

  const upper = (s: string) => s.toUpperCase();
  const findIndex = (predicate: (l: string) => boolean) => lines.findIndex(predicate);

  const extractDigitsListAfterMarker = (marker: (l: string) => boolean, opts?: { minLen?: number; maxLen?: number; skip?: number }) => {
    const idx = findIndex(marker);
    if (idx < 0) return [] as string[];
    const minLen = opts?.minLen ?? 1;
    const maxLen = opts?.maxLen ?? 20;
    const skip = opts?.skip ?? 0;

    const out: string[] = [];
    for (let i = idx + 1 + skip; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isDigitsOnly(l)) break;
      if (l.length >= minLen && l.length <= maxLen) out.push(l);
    }
    return out;
  };

  const extractDigitsListBeforeMarker = (marker: (l: string) => boolean, opts?: { minLen?: number; maxLen?: number }) => {
    const idx = findIndex(marker);
    if (idx < 0) return [] as string[];
    const minLen = opts?.minLen ?? 1;
    const maxLen = opts?.maxLen ?? 20;

    const out: string[] = [];
    for (let i = idx - 1; i >= 0; i--) {
      const l = lines[i];
      if (!l) continue;
      if (!isDigitsOnly(l)) break;
      if (l.length >= minLen && l.length <= maxLen) out.push(l);
    }
    return out.reverse();
  };

  // 1) Extraer pólizas (en el texto extraído, la columna de póliza suele aparecer bajo el marcador "Ramo")
  const ramoIdx = findIndex(l => upper(l) === 'RAMO');
  const policyList: string[] = [];
  if (ramoIdx >= 0) {
    for (let i = ramoIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isDigitsOnly(l)) break;
      // En el PDF de REGIONAL, aquí vienen IDs numéricos de póliza (6-10 dígitos)
      if (l.length >= 6 && l.length <= 10) {
        policyList.push(l);
      }
    }
  }

  // Extraer sucursal (1ra sección), ramo (2da sección) y cert (4ta sección)
  // En el PDF, la primera columna suele ser Suc.=10, la segunda Ramo=29 y el cert suele ser 0.
  // En el texto extraído, los valores de sucursal aparecen ANTES del label "Suc.".
  const sucursalList = extractDigitsListBeforeMarker(l => upper(l) === 'SUC.', { minLen: 1, maxLen: 2 });
  // El "ramo" (29) aparece bajo "Nro." seguido por "Recibo".
  const ramoList = extractDigitsListAfterMarker(l => upper(l) === 'NRO.', { minLen: 1, maxLen: 3, skip: 1 });

  // 2) Extraer montos "Monto C. Pagado" (comisión pagada)
  const montoCIdx = findIndex(l => upper(l).startsWith('MONTO C.'));
  const montoCPagadoList: number[] = [];
  let montoCScanEndIndex = -1;
  if (montoCIdx >= 0) {
    // Suele venir en 2 líneas: "Monto C." y luego "Pagado"
    let start = montoCIdx + 1;
    const maybePagado = lines[start];
    if (maybePagado && upper(maybePagado) === 'PAGADO') start++;

    for (let i = start; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (!isMoney(l)) break;
      const n = parseFloat(l);
      montoCPagadoList.push(isNaN(n) ? 0 : n);
      montoCScanEndIndex = i;
    }
  }

  // Certificado: en el texto extraído suele venir como una lista de ceros inmediatamente después de Monto C. Pagado
  // hasta llegar al label "Cert".
  const certList: string[] = [];
  if (montoCScanEndIndex >= 0) {
    for (let i = montoCScanEndIndex + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const u = upper(l);
      if (u === 'CERT') break;
      if (!isDigitsOnly(l)) break;
      if (l.length >= 1 && l.length <= 4) certList.push(l);
    }
  }

  // 3) Extraer nombres bajo "Operación" (vienen como lista separada; algunos nombres se parten en 2 líneas)
  const operacionIdx = findIndex(l => upper(l) === 'OPERACIÓN');
  const namesRaw: string[] = [];
  if (operacionIdx >= 0) {
    for (let i = operacionIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const u = upper(l);

      // Stop markers al terminar la lista de nombres
      if (u === 'NOMBRE ASEGURADO %IMP.' || u.startsWith('NOMBRE ASEGURADO') || u === 'CERT') break;

      // Ignorar cosas que no son nombres
      if (!l) continue;
      if (u.includes('PAGO DE')) continue;
      if (u.startsWith('TOTAL ')) continue;
      if (isMoney(l) || isDigitsOnly(l)) continue;

      namesRaw.push(l);
    }
  }

  const names: string[] = [];
  for (const n of namesRaw) {
    const curr = n.trim();
    if (!curr) continue;

    // Si la línea parece “continuación” (1-2 palabras), la pegamos al nombre anterior
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

  const expectedCount = Math.min(policyList.length, names.length);
  const alignedMontoCPagadoList =
    expectedCount > 0 && montoCPagadoList.length > expectedCount
      ? montoCPagadoList.slice(-expectedCount)
      : montoCPagadoList;

  const count = Math.min(policyList.length, names.length, alignedMontoCPagadoList.length);
  for (let i = 0; i < count; i++) {
    const policyReal = policyList[i] || '';
    const suc = sucursalList[i] || sucursalList[0] || '';
    const ramo = ramoList[i] || ramoList[0] || '';
    const cert = certList[i] || certList[0] || '0';
    const policyFull = suc && ramo ? `${suc}-${ramo}-${policyReal}-${cert}` : policyReal;
    const clientName = names[i] || '';
    const grossAmount = alignedMontoCPagadoList[i] || 0;

    if (policyFull && clientName && grossAmount > 0) {
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
