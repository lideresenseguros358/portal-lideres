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
  const percentRegex = /\d{1,3}\s*%/;
  const moneyTokenLooseRegex = /\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})/g;

  const isCandidateName = (l: string) => {
    const u = upper(l);
    if (u === 'DESC' || u === 'DESC.' || u === 'DESCUENTO') return false;
    if (u === 'GANADA' || u === 'GANADO' || u === 'GANADAS' || u === 'GANADOS') return false;
    if (u === 'SOBRE' || u === 'SOBRE COMIS' || u === 'SOBRE COMISION') return false;
    if (u.includes('SOBRE COMIS')) return false;
    if (u.includes('SOBRE COM')) return false;
    if (u.includes('DESC') && u.includes('COMIS')) return false;
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
    if (u.includes('FORMA DE PAGO')) return false;
    if (u.includes('FECHA COMISION')) return false;
    if (u.includes('DIRECCION')) return false;
    if (u.includes('TELEFONO')) return false;
    if (u.includes('EMAIL')) return false;
    if (dateRegex.test(l)) return false;
    if (policyRegex.test(l)) return false;
    if (moneyTokenRegex.test(l)) return false;
    if (l.length < 4) return false;
    if (!/^[A-ZÑÁÉÍÓÚÜ0-9\s,\.-]+$/.test(u)) return false;
    const letters = (u.match(/[A-ZÑÁÉÍÓÚÜ]/g) || []).length;
    if (letters < 3) return false;
    // Evitar tomar headers de una sola palabra como nombre
    if (u.split(/\s+/).length === 1) return false;
    return true;
  };

  const cleanClientName = (raw: string) => {
    const u = upper(raw).trim();
    if (!u) return '';
    if (u === 'DESC' || u === 'DESC.' || u === 'DESCUENTO') return '';
    if (u === 'GANADA' || u === 'GANADO' || u === 'GANADAS' || u === 'GANADOS') return '';
    if (u === 'SOBRE' || u === 'SOBRE COMIS' || u === 'SOBRE COMISION') return '';
    return raw.trim();
  };

  const tryExtractFromTransactionLine = (l: string, policyNumber: string) => {
    // Formato esperado (ejemplo):
    // 27/10/2025 AUTO-110063-2025 TATIANA ... 20% 58,30 11,66 ... 11,66
    if (!dateRegex.test(l)) return null;
    if (!l.includes(policyNumber)) return null;

    const idx = l.indexOf(policyNumber);
    if (idx < 0) return null;

    const afterPolicy = l.slice(idx + policyNumber.length).trim();
    if (!afterPolicy) return null;

    // Cliente = tokens de texto después de la póliza, hasta que aparezca % o un monto.
    // Omitir headers sueltos que pueden colarse (GANADA, DESC, etc.)
    const stopWords = new Set<string>([
      'DESC', 'DESC.', 'DESCUENTO',
      'GANADA', 'GANADO', 'GANADAS', 'GANADOS',
      'SOBRE', 'SOBRECOMIS', 'SOBRECOMISION', 'SOBRECOM',
      'COMISION', 'COMISIONES', 'SALDO', 'PRIMA', 'CLIENTE', 'POLIZA'
    ]);

    const rawTokens = afterPolicy.split(/\s+/).map(t => t.trim()).filter(Boolean);
    const nameTokens: string[] = [];

    for (const tok of rawTokens) {
      const uTok = upper(tok).replace(/[^A-ZÑÁÉÍÓÚÜ0-9]/g, '');
      if (!uTok) continue;

      // Fin del nombre al encontrar porcentaje o monto
      if (percentRegex.test(tok)) break;
      if (moneyTokenRegex.test(tok)) break;

      // Saltar headers
      if (stopWords.has(uTok)) continue;

      // Aceptar tokens con letras (permitir caracteres como - o . en original)
      const hasLetter = /[A-ZÑÁÉÍÓÚÜ]/.test(uTok);
      if (!hasLetter) continue;

      nameTokens.push(tok);
    }

    const clientName = cleanClientName(nameTokens.join(' '));
    if (!clientName) return null;
    if (upper(clientName).split(/\s+/).length < 2) return null;

    const tokens = l.match(moneyTokenRegex) || [];
    const last = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const grossAmount = last ? parseMoney(last) : 0;
    if (!grossAmount) return null;

    return { clientName, grossAmount };
  };

  const tryExtractFromNearbyLines = (index: number, policyNumber: string) => {
    // OCR puede romper la fila en varias líneas: intentamos concatenar ventanas de 1-3 líneas
    const windows: string[] = [];
    const a = lines[index] || '';
    const b = index + 1 < lines.length ? (lines[index + 1] || '') : '';
    const c = index + 2 < lines.length ? (lines[index + 2] || '') : '';
    const p = index - 1 >= 0 ? (lines[index - 1] || '') : '';
    const pp = index - 2 >= 0 ? (lines[index - 2] || '') : '';

    windows.push(a);
    windows.push(`${a} ${b}`.trim());
    windows.push(`${a} ${b} ${c}`.trim());
    windows.push(`${p} ${a}`.trim());
    windows.push(`${pp} ${p} ${a}`.trim());

    for (const w of windows) {
      const parsed = tryExtractFromTransactionLine(w, policyNumber);
      if (parsed) return parsed;
    }
    return null;
  };

  const findDefaultClientName = () => {
    // En estos PDFs el nombre del cliente/agente viene en el encabezado, justo antes de la línea "AGENTE:".
    // Ejemplo en el texto extraído:
    // "TATIANA MILENA DE CASTRO HURTADO DE CARDENAS"
    // "AGENTE: 744 LIDERES EN SEGUROS, S. A. LICENCIA: STATUS:"
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (upper(l).startsWith('AGENTE:')) {
        for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
          const cand = lines[j];
          if (!cand) continue;
          if (isCandidateName(cand)) return cand;
        }
      }
    }

    // Fallback: primera línea "tipo nombre" cerca del inicio
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const cand = lines[i];
      if (!cand) continue;
      if (isCandidateName(cand)) return cand;
    }

    return '';
  };

  const defaultClientName = findDefaultClientName();

  const parseTransactionLine = (l: string) => {
    const u = upper(l);
    if (!dateRegex.test(l)) return null;
    if (!percentRegex.test(l)) return null;
    if (u.includes('TOTALES')) return null;
    if (u.includes('POLIZA') && u.includes('CLIENTE')) return null;

    // IMPORTANTE: el OCR puede pegar el % al último monto (ej: 11,6620%),
    // por lo que usamos un regex sin \b para capturar correctamente el monto.
    const moneyTokens = l.match(moneyTokenLooseRegex) || [];
    if (moneyTokens.length < 2) return null;

    const grossAmount = parseMoney(moneyTokens[moneyTokens.length - 1] || '');
    if (!grossAmount) return null;

    // Intentar extraer nombre en la misma línea: texto entre fecha y el primer monto
    const dateMatch = l.match(dateRegex);
    const afterDate = dateMatch ? l.slice((dateMatch.index || 0) + dateMatch[0].length).trim() : l;

    // Encontrar la primera ocurrencia de un monto para cortar el nombre
    const localMoneyRegex = new RegExp(moneyTokenLooseRegex.source, 'g');
    const m = localMoneyRegex.exec(afterDate);
    const firstMoneyIdx = m && m.index !== undefined ? m.index : -1;

    const rawClient = firstMoneyIdx >= 0 ? afterDate.slice(0, firstMoneyIdx).trim() : '';
    const clientName = cleanClientName(rawClient);

    return {
      clientName: clientName && upper(clientName).split(/\s+/).length >= 2 ? clientName : '',
      grossAmount,
    };
  };

  // Pre-scan: extraer todas las transacciones (FECHA + montos) en orden
  const transactionQueue = lines
    .map(parseTransactionLine)
    .filter(Boolean) as Array<{ clientName: string; grossAmount: number }>;

  console.log('[GENERAL PDF] transactionQueue:', transactionQueue);

  const rows: GeneralRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const policyMatch = line.match(policyRegex);
    if (!policyMatch || !policyMatch[1]) continue;

    const policyNumber = policyMatch[1];

    // Si el OCR no trae la póliza en la línea de FECHA, emparejar por orden:
    // las pólizas (AUTO-...) suelen aparecer listadas luego de los recibos.
    const txn = transactionQueue.shift();
    let grossAmount = txn?.grossAmount || 0;
    let clientName = txn?.clientName || defaultClientName || '';

    console.log('[GENERAL PDF] Match policy -> txn', {
      policyNumber,
      clientName,
      grossAmount,
    });

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
