/**
 * GET /api/adm-cot/badges
 * Returns badge counts for ADM COT module tabs (Pagos, Chats).
 * Lightweight endpoint polled by AdmCotShell.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Pagos: PENDIENTE + PENDIENTE_CONFIRMACION ──
    const { count: pagosCount } = await supabase
      .from('adm_cot_payments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDIENTE', 'PENDIENTE_CONFIRMACION'])
      .eq('is_refund', false);
    const pagos = pagosCount || 0;

    // ── Chats: OPEN + ESCALATED conversations ──
    const { count: chatsCount } = await supabase
      .from('adm_cot_conversations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['OPEN', 'ESCALATED']);
    const chats = chatsCount || 0;

    return NextResponse.json({ pagos, chats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
