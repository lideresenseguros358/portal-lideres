import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Configuration API
// ═══════════════════════════════════════════════════════

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from('ops_config')
      .select('*')
      .order('key');

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'update': {
        const { key, value, updated_by } = body;
        const { error } = await supabase
          .from('ops_config')
          .update({ value, updated_at: new Date().toISOString(), updated_by })
          .eq('key', key);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'bulk_update': {
        const { configs, updated_by } = body;
        for (const cfg of configs) {
          await supabase
            .from('ops_config')
            .update({ value: cfg.value, updated_at: new Date().toISOString(), updated_by })
            .eq('key', cfg.key);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
