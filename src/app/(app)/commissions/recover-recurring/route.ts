import { NextRequest, NextResponse } from 'next/server';
import { actionCleanupDuplicateRecurring, actionRecreateRecurringAdvances, actionCleanupRecurringAdvances, actionFindMismarkedRecurringAdvances, actionRecoverRecurringAdvance } from '../actions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'list') {
      // Listar todos los adelantos recurrentes
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const supabase = await getSupabaseAdmin();
      
      const { data, error } = await supabase
        .from('advances')
        .select('id, recurrence_id, reason, amount, status, is_recurring, created_at, brokers(name)')
        .not('recurrence_id', 'is', null)
        .order('recurrence_id')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Agrupar por recurrence_id
      const grouped: Record<string, any[]> = {};
      (data || []).forEach(adv => {
        const recId = adv.recurrence_id!;
        if (!grouped[recId]) grouped[recId] = [];
        grouped[recId].push(adv);
      });
      
      return NextResponse.json({
        ok: true,
        total: data?.length || 0,
        duplicateGroups: Object.entries(grouped).filter(([_, adv]) => adv.length > 1).length,
        data: grouped
      });
    } else if (action === 'cleanup-duplicates') {
      // Limpiar duplicados de recurrentes (mantener solo el más reciente)
      const result = await actionCleanupDuplicateRecurring();
      return NextResponse.json(result);
    } else if (action === 'recreate') {
      // Recrear adelantos recurrentes faltantes
      const result = await actionRecreateRecurringAdvances();
      return NextResponse.json(result);
    } else if (action === 'cleanup') {
      // Limpieza automática de duplicados y reseteos
      const result = await actionCleanupRecurringAdvances();
      return NextResponse.json(result);
    } else {
      // Por defecto: buscar adelantos mal marcados
      const result = await actionFindMismarkedRecurringAdvances();
      return NextResponse.json(result);
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { advanceId } = body;
    
    if (!advanceId) {
      return NextResponse.json({ ok: false, error: 'advanceId requerido' }, { status: 400 });
    }
    
    const result = await actionRecoverRecurringAdvance(advanceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
