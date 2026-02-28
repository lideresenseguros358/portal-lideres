import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Morosidad API
// Reads from ADM COT payments + recurrences
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // TODO: Join adm_cot_payments + adm_cot_recurrences + policies + clients
    // to build morosidad view for portal@lideresenseguros.com broker
    // For now return empty stub
    return NextResponse.json({
      data: [],
      total: 0,
      counts: { AL_DIA: 0, ATRASADO: 0, PAGO_RECIBIDO: 0, CANCELADO: 0 },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'send_morosidad_email': {
        // TODO: Send morosidad email to selected clients
        const { client_ids } = body;
        return NextResponse.json({ success: true, sent: client_ids?.length || 0 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
