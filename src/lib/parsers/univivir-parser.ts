import { extractTextFromPDF } from '@/lib/services/vision-ocr';

interface UniVivirRow {
  policy_number: string;
  client_name: string;
  gross_amount: number;
}

function removeLeadingZeros(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? digits : String(n);
}

function normalizeUniVivirPolicyNumber(ramoRaw: string, polizaRaw: string): string {
  const ramoDigits = String(ramoRaw || '').replace(/\D/g, '');
  const polizaDigits = String(polizaRaw || '').replace(/\D/g, '');

  const ramo = (ramoDigits || '').padStart(3, '0').slice(-3);
  const poliza = removeLeadingZeros(polizaDigits);

  if (!ramo || !poliza) return '';
  return `01-${ramo}-${poliza}`;
}

export async function parseUniVivirPDF(fileBuffer: ArrayBuffer): Promise<UniVivirRow[]> {
  console.log('[UNIVIVIR PDF] Iniciando parseo directo de PDF');

  const buffer = Buffer.from(fileBuffer);
  const text = await extractTextFromPDF(buffer);

  console.log('[UNIVIVIR PDF] ===== TEXTO EXTRAÍDO =====');
  console.log(text);
  console.log('[UNIVIVIR PDF] ===== FIN TEXTO =====');

  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const isDate = (s: string) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s);
  const isMoney = (s: string) => /^-?\d+(?:\.\d{2})$/.test(s);
  const isCommissionWithRamo = (s: string) => /^-?\d+\.\d{2}\d{3}$/.test(s);

  const rows: UniVivirRow[] = [];

  for (const line of lines) {
    // Ignorar headers y totales
    const upper = line.toUpperCase();
    if (
      upper.includes('REPORTE DE HONORARIOS') ||
      upper.includes('REGULADO Y SUPERVISADO') ||
      upper.startsWith('PAGE ') ||
      upper.startsWith('NRO. OP') ||
      upper.includes('COMISIÓN A PAGAR') ||
      upper.includes('TOTAL')
    ) {
      continue;
    }

    const upperLine = line.toUpperCase();
    // Anotaciones del reporte (no son renglones de póliza)
    if (upperLine.includes('COMISIONES INTERMEDIARIOS')) continue;
    // Variante OCR: empieza con número + fecha + texto de comisiones
    if (/^\d{5,10}\s+\d{1,2}\/\d{1,2}\/\d{4}\s+COMISIONES\b/i.test(line)) continue;

    // OCR real (según logs) viene así:
    // "NOMBRE APELLIDO ...<RECIBO6> <POLIZA> <ENDOSO> <SALDO+%> <COMISION+RAMO3> <CUOTA> <PRIMAS> <DEB/CRED> <FECHA>"
    // Ejemplo: "...VANESSA815006 22514 3 4.6912.00 4.69009 1 39.05 0.00 16/10/2025"
    const m = line.match(/^(.*?)(\d{6})\s+(.*)$/);
    if (!m) continue;

    const clientName = String(m[1] || '').replace(/\s+/g, ' ').trim();
    const tail = String(m[3] || '').trim();
    if (!clientName || !tail) continue;

    // La fecha puede venir pegada al token anterior (ej: "0.0016/10/2025")
    const dateMatch = tail.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!dateMatch) continue;

    const tailTokens = tail.split(/\s+/).filter(Boolean);
    if (tailTokens.length < 5) continue;

    const poliza = tailTokens[0] ?? '';
    const endoso = tailTokens[1] ?? '';
    // Si no hay poliza/endoso numéricos, no es una fila válida
    if (!/^[0-9]+$/.test(poliza) || !/^[0-9]+$/.test(endoso)) continue;

    // Buscar token de comisión+ramo (ej: 4.69009, -1.50001)
    const commRamoToken = tailTokens.find(isCommissionWithRamo);
    if (!commRamoToken) continue;

    const commRamoMatch = commRamoToken.match(/^(-?\d+\.\d{2})(\d{3})$/);
    if (!commRamoMatch) continue;

    const commissionStr = commRamoMatch[1] || '';
    const ramo = commRamoMatch[2] || '';

    if (!isMoney(commissionStr)) continue;

    const policyNumber = normalizeUniVivirPolicyNumber(ramo, poliza);
    if (!policyNumber) continue;

    const grossAmount = parseFloat(commissionStr);
    if (Number.isNaN(grossAmount)) continue;

    rows.push({
      policy_number: policyNumber,
      client_name: clientName,
      gross_amount: grossAmount,
    });
  }

  console.log('[UNIVIVIR PDF] Total filas extraídas:', rows.length);
  return rows;
}
