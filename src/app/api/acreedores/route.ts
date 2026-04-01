/**
 * GET /api/acreedores
 *
 * Fetches the full acreedor list from ANCON's GenerarAcreedores catalog and
 * merges it with static IS/FEDPA/REGIONAL codes from ACREEDORES_PANAMA.
 *
 * Response: { success, data: Acreedor[], source: 'ancon' | 'static' }
 *
 * Used by EmissionDataForm and InsuredDataSection to populate the acreedor
 * dropdown with the complete list (including fideicomisos, leasings, fiduciarias).
 */

import { NextResponse } from 'next/server';
import { getAcreedores } from '@/lib/ancon/catalogs.service';
import { ACREEDORES_PANAMA } from '@/lib/constants/acreedores';
import type { TipoAcreedor } from '@/lib/constants/acreedores';

export const maxDuration = 20;

function inferTipo(nombre: string): TipoAcreedor {
  const n = nombre.toUpperCase();
  if (n.includes('TRUST') || n.includes('FIDUCIARIA') || n.includes('FIDEICOMISO')) return 'FIDUCIARIA';
  if (
    n.includes('LEASING') ||
    n.includes('FINANCIERA') ||
    n.includes('FINANCE') ||
    n.includes('FINANCIAL') ||
    n.includes('CREDITO') ||
    n.includes('MACROFINAN') ||
    n.includes('MULTICREDIT')
  ) return 'FINANCIERA';
  if (
    n.includes('COOPERATIVA') ||
    n.includes('COOPE') ||
    /^COOP|^CACE|^EDIOAC/.test(n)
  ) return 'COOPERATIVA';
  if (
    n.includes('BANCO') ||
    n.includes('BANK') ||
    n.includes('BANESCO') ||
    n.includes('BANISTMO') ||
    n.includes('BANISI') ||
    n.includes('CAJA DE AHORROS') ||
    n.includes('HIPOTECARIA')
  ) return 'BANCO';
  return 'FINANCIERA';
}

const TYPE_ORDER: Record<TipoAcreedor, number> = {
  BANCO: 0,
  COOPERATIVA: 1,
  FINANCIERA: 2,
  FIDUCIARIA: 3,
  OTRO: 4,
};

export async function GET() {
  const result = await getAcreedores();

  if (!result.success || !result.data?.length) {
    return NextResponse.json({ success: true, data: ACREEDORES_PANAMA, source: 'static' });
  }

  // Build lookup map from static list (by label, case-insensitive)
  const staticByName = new Map(
    ACREEDORES_PANAMA.map(a => [a.label.toUpperCase().trim(), a])
  );

  const merged = result.data
    .filter(item => item.nombre?.trim())
    .map(item => {
      const nombre = item.nombre.trim();
      const key = nombre.toUpperCase();
      const sta = staticByName.get(key);
      return {
        label: nombre,
        tipo: sta?.tipo ?? inferTipo(nombre),
        codTipoConductoIS: sta?.codTipoConductoIS ?? 1,
        codConductoIS: sta?.codConductoIS ?? 0,
        codigoFEDPA: sta?.codigoFEDPA ?? key,
        codigoREGIONAL: sta?.codigoREGIONAL ?? '81',
        codigoANCON: item.cod_acreedor,
      };
    });

  // Sort: by tipo order, then alphabetically
  merged.sort((a, b) => {
    const ta = TYPE_ORDER[a.tipo as TipoAcreedor] ?? 5;
    const tb = TYPE_ORDER[b.tipo as TipoAcreedor] ?? 5;
    if (ta !== tb) return ta - tb;
    return a.label.localeCompare(b.label, 'es');
  });

  return NextResponse.json({ success: true, data: merged, source: 'ancon' });
}
