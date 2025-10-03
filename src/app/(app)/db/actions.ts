'use server';

import { revalidatePath } from 'next/cache';
import { createClientWithPolicy } from '@/lib/db/clients';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/server';

export async function actionCreateClientWithPolicy(clientData: unknown, policyData: unknown) {
  try {
    const client = await createClientWithPolicy(clientData, policyData);
    revalidatePath('/(app)/db');
    return { ok: true as const, data: client };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Crear cliente vía tabla temporal
export async function actionCreateTempClient(data: any) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'Usuario no autenticado' };
    }

    // Si es broker, forzar su email
    const userRole = user.user_metadata?.role;
    const broker_email = userRole === 'broker' ? user.email : data.broker_email;
    
    const payload: TablesInsert<'temp_client_imports'> = {
      client_name: data.client_name,
      national_id: data.national_id || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      policy_number: data.policy_number,
      insurer_name: data.insurer_name,
      ramo: data.ramo || null,
      start_date: data.start_date || null,
      renewal_date: data.renewal_date || null,
      status: data.status || 'active',
      broker_email: broker_email || '',
      percent_override: data.percent_override || null,
      source: data.source || 'manual',
      created_by: user.id,
    };
    
    const { data: temp, error } = await supabase
      .from('temp_client_imports')
      .insert([payload])
      .select()
      .single();
      
    if (error) {
      return { ok: false as const, error: error.message };
    }
    
    // Esperar a que el trigger procese
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar resultado
    const { data: processed } = await supabase
      .from('temp_client_imports')
      .select('*')
      .eq('id', temp.id)
      .single();
    
    if (processed?.import_status === 'error') {
      return { ok: false as const, error: processed.error_message || 'Error al procesar' };
    }
    
    revalidatePath('/(app)/db');
    return { ok: true as const, data: processed };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Importar múltiples clientes desde CSV
export async function actionImportClientsCSV(rows: any[]) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'Usuario no autenticado' };
    }

    const userRole = user.user_metadata?.role;
    const userEmail = user.email;
    
    // Preparar rows
    const tempRows = rows.map(row => ({
      client_name: row.client_name,
      national_id: row.national_id || null,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      policy_number: row.policy_number,
      insurer_name: row.insurer_name,
      ramo: row.ramo || null,
      start_date: row.start_date || null,
      renewal_date: row.renewal_date || null,
      status: row.status || 'active',
      broker_email: userRole === 'master' ? row.broker_email : userEmail,
      percent_override: row.percent_override || null,
      source: 'csv_import',
      created_by: user.id,
    }));
    
    const { data, error } = await supabase
      .from('temp_client_imports')
      .insert(tempRows)
      .select();
    
    if (error) {
      return { ok: false as const, error: error.message };
    }
    
    // Esperar procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar resultados
    const ids = (data || []).map(d => d.id);
    const { data: results } = await supabase
      .from('temp_client_imports')
      .select('*')
      .in('id', ids);
    
    const processed = (results || []).filter(r => r.import_status === 'processed').length;
    const errors = (results || []).filter(r => r.import_status === 'error').map(e => ({
      row: e.client_name,
      policy: e.policy_number,
      message: e.error_message || 'Error desconocido'
    }));
    
    revalidatePath('/(app)/db');
    return { 
      ok: true as const, 
      data: { 
        total: rows.length, 
        processed, 
        errors
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Completar cliente preliminar
export async function actionCompletePreliminary(tempId: string, national_id: string) {
  try {
    const supabase = await getSupabaseServer();
    
    // Update nacional_id -> trigger procesa automáticamente
    const { error } = await supabase
      .from('temp_client_imports')
      .update({ national_id })
      .eq('id', tempId);
    
    if (error) {
      return { ok: false as const, error: error.message };
    }
    
    revalidatePath('/(app)/db');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Obtener clientes preliminares
export async function actionGetPreliminaryClients() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data, error } = await supabase
      .from('temp_client_imports')
      .select('*')
      .is('national_id', null)
      .eq('import_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      return { ok: false as const, error: error.message };
    }
    
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
