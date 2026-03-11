/**
 * API Route: Precio mínimo de Daños a Terceros - INTERNACIONAL
 * Reads from app_settings cache (populated by cron/is-dt-reference).
 * Near-instant — no live API calls.
 */

import { NextResponse } from 'next/server';
import { getSetting } from '@/server/settings';

const SETTINGS_KEY = 'is_dt_reference_prices';
const FALLBACK_PRICE = 154;

export async function GET() {
  try {
    const ref = await getSetting<any>(SETTINGS_KEY);
    const minPrice = ref?.basic?.price ?? FALLBACK_PRICE;

    return NextResponse.json({
      success: true,
      minPrice,
      insurer: 'INTERNACIONAL',
      plan: 'Daños a Terceros',
      ...(ref ? {} : { note: 'Precio de referencia (cron no ha corrido)' }),
    });
  } catch (error) {
    console.error('[INTERNACIONAL Min Price DT] Error:', error);
    return NextResponse.json({
      success: true,
      minPrice: FALLBACK_PRICE,
      insurer: 'INTERNACIONAL',
      plan: 'Daños a Terceros',
      note: 'Precio de referencia (error)',
    });
  }
}
