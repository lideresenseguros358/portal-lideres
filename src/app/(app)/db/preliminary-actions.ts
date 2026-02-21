'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// =====================================================
// GET PRELIMINARY CLIENTS
// =====================================================

export async function actionGetPreliminaryClients() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('temp_client_import')
      .select(`
        *,
        insurers(id, name),
        brokers(id, name, p_id, profiles!brokers_p_id_fkey(full_name, email))
      `)
      .eq('migrated', false)
      .order('created_at', { ascending: false });

    // If broker, only show their preliminary clients
    if (profile?.role !== 'master') {
      query = query.eq('broker_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching preliminary clients:', error);
      return { ok: false as const, error: error.message };
    }

    // Calculate missing fields for each record - TODOS los campos OBLIGATORIOS
    const enrichedData = (data || []).map((record: any) => {
      const missingFields: string[] = [];

      // Todos los campos son OBLIGATORIOS (excepto Notas) según banner actualizado:
      
      // Datos del Cliente
      if (!record.client_name || record.client_name.trim() === '') {
        missingFields.push('Nombre del cliente');
      }
      
      if (!record.national_id || record.national_id.trim() === '') {
        missingFields.push('Cédula/RUC');
      }
      
      if (!record.email || record.email.trim() === '') {
        missingFields.push('Email');
      }
      
      if (!record.phone || record.phone.trim() === '') {
        missingFields.push('Teléfono');
      }
      
      if (!record.birth_date) {
        missingFields.push('Fecha de nacimiento');
      }
      
      // Datos de la Póliza
      if (!record.policy_number || record.policy_number.trim() === '') {
        missingFields.push('Número de póliza');
      }
      
      if (!record.ramo || record.ramo.trim() === '') {
        missingFields.push('Tipo de póliza');
      }
      
      if (!record.insurer_id) {
        missingFields.push('Aseguradora');
      }
      
      if (!record.renewal_date) {
        missingFields.push('Fecha de renovación');
      }
      
      if (!record.broker_id) {
        missingFields.push('Corredor asignado');
      }

      return {
        ...record,
        missing_fields: missingFields,
        is_complete: missingFields.length === 0
      };
    });

    return { ok: true as const, data: enrichedData };
  } catch (error: any) {
    console.error('Error in actionGetPreliminaryClients:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// UPDATE PRELIMINARY CLIENT
// =====================================================

export async function actionUpdatePreliminaryClient(id: string, updates: any) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // DEBUG: Ver exactamente qué llega
    console.log('[actionUpdatePreliminaryClient] PAYLOAD RECIBIDO:', JSON.stringify(updates, null, 2));
    console.log('[actionUpdatePreliminaryClient] ¿Tiene status?:', 'status' in updates, updates.status);

    // Normalize data
    const cleanedUpdates: any = {};
    
    if (updates.client_name !== undefined) {
      cleanedUpdates.client_name = updates.client_name?.trim().toUpperCase() || null;
    }
    if (updates.national_id !== undefined) {
      cleanedUpdates.national_id = updates.national_id?.trim().toUpperCase() || null;
    }
    if (updates.email !== undefined) {
      cleanedUpdates.email = updates.email?.trim().toLowerCase() || null;
    }
    if (updates.phone !== undefined) {
      cleanedUpdates.phone = updates.phone?.trim() || null;
    }
    if (updates.birth_date !== undefined) {
      cleanedUpdates.birth_date = updates.birth_date || null;
    }
    if (updates.policy_number !== undefined) {
      cleanedUpdates.policy_number = updates.policy_number?.trim().toUpperCase() || null;
    }
    if (updates.ramo !== undefined) {
      cleanedUpdates.ramo = updates.ramo?.trim().toUpperCase() || null;
    }
    if (updates.insurer_id !== undefined) {
      cleanedUpdates.insurer_id = updates.insurer_id || null;
    }
    if (updates.start_date !== undefined) {
      cleanedUpdates.start_date = updates.start_date || null;
    }
    if (updates.renewal_date !== undefined) {
      cleanedUpdates.renewal_date = updates.renewal_date || null;
    }
    // Siempre enviar status='ACTIVA' para que el trigger use un valor válido del enum
    cleanedUpdates.status = 'ACTIVA';
    if (updates.broker_id !== undefined) {
      cleanedUpdates.broker_id = updates.broker_id || null;
    }
    if (updates.notes !== undefined) {
      cleanedUpdates.notes = updates.notes?.trim() || null;
    }

    const { data, error } = await supabase
      .from('temp_client_import')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Si el trigger rechaza porque la póliza ya existe, actualizar la info existente
      if (error.message && error.message.includes('ya existe') && cleanedUpdates.policy_number) {
        console.log('[Preliminar] Póliza ya existe, actualizando info existente...');
        
        const admin = getSupabaseAdmin();
        
        // Buscar la póliza existente con su cliente
        const { data: existingPolicy } = await admin
          .from('policies')
          .select('id, client_id, broker_id')
          .eq('policy_number', cleanedUpdates.policy_number)
          .single();
        
        if (!existingPolicy) {
          return { ok: false as const, error: 'La póliza existe pero no se pudo encontrar para actualizar.' };
        }
        
        console.log('[Preliminar] Póliza encontrada:', existingPolicy.id, '- Cliente:', existingPolicy.client_id);
        
        // Actualizar datos del cliente
        const clientUpdate: any = {};
        if (cleanedUpdates.client_name) clientUpdate.name = cleanedUpdates.client_name;
        if (cleanedUpdates.national_id) clientUpdate.national_id = cleanedUpdates.national_id;
        if (cleanedUpdates.email) clientUpdate.email = cleanedUpdates.email;
        if (cleanedUpdates.phone) clientUpdate.phone = cleanedUpdates.phone;
        if (cleanedUpdates.birth_date) clientUpdate.birth_date = cleanedUpdates.birth_date;
        if (cleanedUpdates.broker_id) clientUpdate.broker_id = cleanedUpdates.broker_id;
        
        if (Object.keys(clientUpdate).length > 0) {
          const { error: clientError } = await admin
            .from('clients')
            .update(clientUpdate)
            .eq('id', existingPolicy.client_id);
          
          if (clientError) {
            console.error('[Preliminar] Error actualizando cliente:', clientError);
          } else {
            console.log('[Preliminar] Cliente actualizado:', clientUpdate);
          }
        }
        
        // Actualizar datos de la póliza
        const policyUpdate: any = {};
        if (cleanedUpdates.ramo) policyUpdate.ramo = cleanedUpdates.ramo;
        if (cleanedUpdates.insurer_id) policyUpdate.insurer_id = cleanedUpdates.insurer_id;
        if (cleanedUpdates.start_date) policyUpdate.start_date = cleanedUpdates.start_date;
        if (cleanedUpdates.renewal_date) policyUpdate.renewal_date = cleanedUpdates.renewal_date;
        if (cleanedUpdates.broker_id) policyUpdate.broker_id = cleanedUpdates.broker_id;
        if (cleanedUpdates.notes) policyUpdate.notas = cleanedUpdates.notes;
        
        if (Object.keys(policyUpdate).length > 0) {
          const { error: policyError } = await admin
            .from('policies')
            .update(policyUpdate)
            .eq('id', existingPolicy.id);
          
          if (policyError) {
            console.error('[Preliminar] Error actualizando póliza:', policyError);
          } else {
            console.log('[Preliminar] Póliza actualizada:', policyUpdate);
          }
        }
        
        // Marcar el registro temporal como migrado
        await admin
          .from('temp_client_import')
          .update({ 
            migrated: true, 
            migrated_at: new Date().toISOString(),
            client_id: existingPolicy.client_id,
            policy_id: existingPolicy.id
          })
          .eq('id', id);
        
        console.log('[Preliminar] Registro temporal marcado como migrado (póliza existente actualizada)');
        
        revalidatePath('/db');
        return { 
          ok: true as const, 
          data: { migrated: true, updatedExisting: true }
        };
      }
      
      console.error('Error updating preliminary client:', error);
      return { ok: false as const, error: error.message };
    }

    // Verificar si el registro fue migrado automáticamente por el trigger SQL
    // El trigger check_temp_client_complete() migra si todos los campos obligatorios están completos
    const wasMigrated = data?.migrated === true;

    if (wasMigrated) {
      console.log('[Preliminar] Cliente migrado automáticamente:', data.client_name);
    }

    revalidatePath('/db');
    return { 
      ok: true as const, 
      data: {
        ...data,
        migrated: wasMigrated
      }
    };
  } catch (error: any) {
    console.error('Error in actionUpdatePreliminaryClient:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// DELETE PRELIMINARY CLIENT
// =====================================================

export async function actionDeletePreliminaryClient(id: string) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Check if user is master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede eliminar clientes preliminares' };
    }

    const { error } = await supabase
      .from('temp_client_import')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting preliminary client:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath('/db');
    return { ok: true as const, message: 'Cliente preliminar eliminado' };
  } catch (error: any) {
    console.error('Error in actionDeletePreliminaryClient:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// MANUAL MIGRATION TRIGGER
// =====================================================

export async function actionTriggerMigration(id: string) {
  try {
    const supabase = await getSupabaseAdmin();

    // Call the migration function directly
    const { error } = await supabase.rpc('migrate_temp_client_to_production', {
      temp_id: id
    });

    if (error) {
      console.error('Error triggering migration:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath('/db');
    return { ok: true as const, message: 'Cliente migrado exitosamente a la base de datos' };
  } catch (error: any) {
    console.error('Error in actionTriggerMigration:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// CREATE FROM UNIDENTIFIED PENDING
// =====================================================

export async function actionCreateFromUnidentified(pendingData: {
  client_name: string;
  policy_number: string;
  insurer_id: string;
  broker_id: string;
  source_id?: string;
  national_id?: string;
  ramo?: string;
}) {
  try {
    const supabase = await getSupabaseAdmin();

    const { data, error } = await supabase.rpc('create_temp_client_from_pending', {
      p_client_name: pendingData.client_name,
      p_policy_number: pendingData.policy_number,
      p_insurer_id: pendingData.insurer_id,
      p_broker_id: pendingData.broker_id,
      p_source_id: pendingData.source_id || undefined,
      p_national_id: pendingData.national_id || undefined,
      p_ramo: pendingData.ramo || undefined
    });

    if (error) {
      console.error('Error creating preliminary client from pending:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath('/db');
    revalidatePath('/commissions');
    return { ok: true as const, data, message: 'Cliente preliminar creado. Complete la fecha de renovación para migrar a la base de datos.' };
  } catch (error: any) {
    console.error('Error in actionCreateFromUnidentified:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// GET STATS
// =====================================================

export async function actionGetPreliminaryStats() {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('temp_client_import')
      .select('*', { count: 'exact' })
      .eq('migrated', false);

    if (profile?.role !== 'master') {
      query = query.eq('broker_id', user.id);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error fetching preliminary stats:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, count: count || 0 };
  } catch (error: any) {
    console.error('Error in actionGetPreliminaryStats:', error);
    return { ok: false as const, error: error.message };
  }
}
