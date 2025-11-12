import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/db/context';

/**
 * Endpoint para sincronizar adelantos recurrentes existentes
 * Genera el primer adelanto para recurrencias que no tienen ninguno
 */
export async function POST() {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    console.log('[sync-recurrences] Starting sync for user:', userId);
    
    // 1. Obtener todas las recurrencias activas
    const { data: recurrences, error: recurrencesError } = await (supabase as any)
      .from('advance_recurrences')
      .select('*')
      .eq('is_active', true);
    
    if (recurrencesError) {
      console.error('[sync-recurrences] Error fetching recurrences:', recurrencesError);
      throw recurrencesError;
    }
    
    console.log('[sync-recurrences] Found', recurrences?.length || 0, 'active recurrences');
    
    if (!recurrences || recurrences.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No hay recurrencias activas',
        synced: 0 
      });
    }
    
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    // 2. Para cada recurrencia, verificar si tiene adelantos
    for (const recurrence of recurrences) {
      try {
        console.log('[sync-recurrences] Checking recurrence:', recurrence.id);
        
        // Verificar si ya tiene adelantos pendientes
        const { data: existingAdvances, error: checkError } = await supabase
          .from('advances')
          .select('id')
          .eq('recurrence_id', recurrence.id)
          .eq('status', 'pending');
        
        if (checkError) {
          console.error('[sync-recurrences] Error checking advances:', checkError);
          errors.push(`Error checking ${recurrence.id}: ${checkError.message}`);
          continue;
        }
        
        // Si ya tiene adelantos pendientes, saltar
        if (existingAdvances && existingAdvances.length > 0) {
          console.log('[sync-recurrences] Recurrence', recurrence.id, 'already has pending advances, skipping');
          skipped++;
          continue;
        }
        
        // 3. Verificar si ha expirado
        if (recurrence.end_date) {
          const endDate = new Date(recurrence.end_date);
          const now = new Date();
          if (endDate < now) {
            console.log('[sync-recurrences] Recurrence', recurrence.id, 'has expired, skipping');
            skipped++;
            continue;
          }
        }
        
        // 4. Crear adelanto(s)
        const advancesToCreate = [];
        
        if (recurrence.fortnight_type === 'BOTH') {
          // Crear DOS adelantos
          advancesToCreate.push({
            broker_id: recurrence.broker_id,
            amount: recurrence.amount,
            reason: `${recurrence.reason} (Recurrente Q1)`,
            status: 'pending',
            created_by: recurrence.created_by || userId,
            is_recurring: true,
            recurrence_id: recurrence.id,
          });
          advancesToCreate.push({
            broker_id: recurrence.broker_id,
            amount: recurrence.amount,
            reason: `${recurrence.reason} (Recurrente Q2)`,
            status: 'pending',
            created_by: recurrence.created_by || userId,
            is_recurring: true,
            recurrence_id: recurrence.id,
          });
        } else {
          // Crear UN adelanto
          const quincenaText = recurrence.fortnight_type === 'Q1' ? 'Q1' : 'Q2';
          advancesToCreate.push({
            broker_id: recurrence.broker_id,
            amount: recurrence.amount,
            reason: `${recurrence.reason} (Recurrente ${quincenaText})`,
            status: 'pending',
            created_by: recurrence.created_by || userId,
            is_recurring: true,
            recurrence_id: recurrence.id,
          });
        }
        
        const { data: createdAdvances, error: advanceError } = await supabase
          .from('advances')
          .insert(advancesToCreate)
          .select();
        
        if (advanceError) {
          console.error('[sync-recurrences] Error creating advances:', advanceError);
          errors.push(`Error creating advances for ${recurrence.id}: ${advanceError.message}`);
          continue;
        }
        
        console.log('[sync-recurrences] Created', createdAdvances?.length || 0, 'advance(s)');
        
        // 5. Actualizar contador de la recurrencia
        const now = new Date().toISOString();
        const newCount = (recurrence.recurrence_count || 0) + advancesToCreate.length;
        
        const { error: updateError } = await (supabase as any)
          .from('advance_recurrences')
          .update({
            recurrence_count: newCount,
            last_generated_at: now,
          })
          .eq('id', recurrence.id);
        
        if (updateError) {
          console.error('[sync-recurrences] Error updating recurrence count:', updateError);
          // No es crítico, continuar
        }
        
        synced++;
        console.log('[sync-recurrences] Successfully synced recurrence:', recurrence.id);
        
      } catch (err) {
        console.error('[sync-recurrences] Exception processing recurrence:', recurrence.id, err);
        errors.push(`Exception for ${recurrence.id}: ${String(err)}`);
      }
    }
    
    console.log('[sync-recurrences] Sync complete. Synced:', synced, 'Skipped:', skipped, 'Errors:', errors.length);
    
    return NextResponse.json({ 
      ok: true, 
      message: `Sincronización completada. ${synced} adelantos creados, ${skipped} omitidos.`,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('[sync-recurrences] Fatal error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 });
  }
}
