import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const supabase = await getSupabaseAdmin();
    
    if (action === 'list-wrong-dates') {
      // Listar logs con fecha UTC que cruza medianoche
      const { data: logs, error } = await supabase
        .from('advance_logs')
        .select('id, advance_id, amount, payment_type, created_at')
        .gte('created_at', '2025-11-20T00:00:00')
        .lte('created_at', '2025-11-22T23:59:59')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const logsWithDates = (logs || []).map(log => ({
        ...log,
        utc_date: String(log.created_at).substring(0, 10),
        utc_full: log.created_at,
        // Convertir UTC a local (UTC-5)
        local_date: new Date(new Date(log.created_at).getTime() - 5 * 60 * 60 * 1000).toISOString().substring(0, 10)
      }));
      
      // Encontrar los que están mal (UTC date != local date)
      const wrongDates = logsWithDates.filter(log => log.utc_date !== log.local_date);
      
      return NextResponse.json({
        ok: true,
        total: logs?.length || 0,
        wrongDates: wrongDates.length,
        logs: logsWithDates,
        needFix: wrongDates
      });
    }
    
    if (action === 'fix-all') {
      // Corregir todos los logs con fecha incorrecta
      const { data: logs, error: fetchError } = await supabase
        .from('advance_logs')
        .select('id, created_at')
        .gte('created_at', '2025-11-20T00:00:00')
        .lte('created_at', '2025-11-22T23:59:59');
      
      if (fetchError) throw fetchError;
      
      let fixed = 0;
      const details = [];
      
      for (const log of logs || []) {
        const utcDate = String(log.created_at).substring(0, 10);
        const localDate = new Date(new Date(log.created_at).getTime() - 5 * 60 * 60 * 1000).toISOString().substring(0, 10);
        
        if (utcDate !== localDate) {
          // Necesita corrección - convertir UTC a hora local de Panamá (UTC-5)
          const originalTime = new Date(log.created_at);
          
          // Opción: mantener solo la fecha correcta, ajustando a medianoche local
          const localDateStr = new Date(originalTime.getTime() - 5 * 60 * 60 * 1000).toISOString().substring(0, 10);
          
          // Usar la hora original pero con la fecha local correcta
          const utcTime = originalTime.toISOString().substring(11, 19); // HH:MM:SS
          const newTimestamp = `${localDateStr} ${utcTime}`;
          
          const { error: updateError } = await supabase
            .from('advance_logs')
            .update({ created_at: newTimestamp })
            .eq('id', log.id);
          
          if (!updateError) {
            fixed++;
            details.push({
              id: String(log.id).substring(0, 8),
              from: log.created_at,
              to: newTimestamp
            });
          }
        }
      }
      
      return NextResponse.json({
        ok: true,
        fixed,
        details
      });
    }
    
    return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId } = body;
    
    if (!logId) {
      return NextResponse.json({ ok: false, error: 'logId required' }, { status: 400 });
    }
    
    const supabase = await getSupabaseAdmin();
    
    // Corregir registro específico a fecha 20/11/2025
    const { error } = await supabase
      .from('advance_logs')
      .update({ created_at: '2025-11-20 20:32:09' })
      .eq('id', logId);
    
    if (error) throw error;
    
    // Verificar
    const { data: updated } = await supabase
      .from('advance_logs')
      .select('id, amount, created_at')
      .eq('id', logId)
      .single();
    
    return NextResponse.json({
      ok: true,
      message: 'Fecha corregida',
      updated
    });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
