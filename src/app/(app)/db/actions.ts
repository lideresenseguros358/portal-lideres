'use server';

import { revalidatePath } from 'next/cache';
import { createClientWithPolicy } from '@/lib/db/clients';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/supabase/server';
import type { ClientWithPolicies } from '@/types/db';

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

// Buscar clientes duplicados por cédula
export async function actionFindDuplicateByNationalId(nationalId: string, excludeClientId?: string) {
  try {
    const supabase = await getSupabaseServer();
    
    if (!nationalId || !nationalId.trim()) {
      return { ok: true as const, data: null };
    }

    let query = supabase
      .from('clients')
      .select(`
        *,
        policies (
          id,
          policy_number,
          insurer_id,
          ramo,
          status,
          insurers (
            name
          )
        )
      `)
      .eq('national_id', nationalId.trim().toUpperCase());
    
    if (excludeClientId) {
      query = query.neq('id', excludeClientId);
    }

    const { data, error } = await query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No hay duplicados
        return { ok: true as const, data: null };
      }
      return { ok: false as const, error: error.message };
    }
    
    return { ok: true as const, data: data as ClientWithPolicies };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Fusionar clientes: mover todas las referencias de sourceClientId a targetClientId
export async function actionMergeClients(sourceClientId: string, targetClientId: string) {
  try {
    const supabase = await getSupabaseServer();
    
    // 1. Mover todas las pólizas del cliente origen al cliente destino
    const { error: policiesErr } = await supabase
      .from('policies')
      .update({ client_id: targetClientId })
      .eq('client_id', sourceClientId);
    
    if (policiesErr) {
      return { ok: false as const, error: `Error moviendo pólizas: ${policiesErr.message}` };
    }
    
    // 2. Reasignar fortnight_details (lo importante es la póliza, no el cliente)
    const { error: fdErr } = await supabase
      .from('fortnight_details')
      .update({ client_id: targetClientId })
      .eq('client_id', sourceClientId);
    
    if (fdErr) {
      console.error('[actionMergeClients] Error reasignando fortnight_details:', fdErr);
    }

    // 3. Reasignar cases.client_id
    const { error: casesErr } = await supabase
      .from('cases')
      .update({ client_id: targetClientId })
      .eq('client_id', sourceClientId);
    
    if (casesErr) {
      console.error('[actionMergeClients] Error reasignando cases:', casesErr);
    }

    // 4. Reasignar cases.created_client_id
    const { error: casesCreatedErr } = await supabase
      .from('cases')
      .update({ created_client_id: targetClientId })
      .eq('created_client_id', sourceClientId);
    
    if (casesCreatedErr) {
      console.error('[actionMergeClients] Error reasignando cases.created_client_id:', casesCreatedErr);
    }

    // 5. Reasignar expediente_documents
    const { error: expErr } = await supabase
      .from('expediente_documents')
      .update({ client_id: targetClientId })
      .eq('client_id', sourceClientId);
    
    if (expErr) {
      console.error('[actionMergeClients] Error reasignando expediente_documents:', expErr);
    }

    // 6. Reasignar temp_client_import
    const { error: tempErr } = await supabase
      .from('temp_client_import')
      .update({ client_id: targetClientId })
      .eq('client_id', sourceClientId);
    
    if (tempErr) {
      console.error('[actionMergeClients] Error reasignando temp_client_import:', tempErr);
    }
    
    // 7. Eliminar el cliente origen (ahora sin referencias)
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', sourceClientId);
    
    if (deleteError) {
      return { ok: false as const, error: `Error eliminando duplicado: ${deleteError.message}` };
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

// LÓGICA CORRECTA: CLIENTS manda, POLICIES sigue
// Cuando se cambia broker de un cliente, TODAS sus pólizas se actualizan automáticamente
export async function actionReassignClientAndPolicies(clientId: string, newBrokerId: string) {
  try {
    const supabase = await getSupabaseServer();
    
    // 1. Actualizar broker del cliente
    const { error: clientError } = await supabase
      .from('clients')
      .update({ broker_id: newBrokerId })
      .eq('id', clientId);
    
    if (clientError) {
      return { ok: false as const, error: `Error actualizando cliente: ${clientError.message}` };
    }
    
    // 2. Actualizar broker de TODAS las pólizas del cliente para mantener consistencia
    const { error: policiesError } = await supabase
      .from('policies')
      .update({ broker_id: newBrokerId })
      .eq('client_id', clientId);
    
    if (policiesError) {
      return { ok: false as const, error: `Error actualizando pólizas: ${policiesError.message}` };
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

export async function actionLoadMoreClients(offset: number, limit: number = 100, searchQuery?: string) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from("clients")
      .select(`
        *,
        policies (
          id,
          policy_number,
          insurer_id,
          ramo,
          start_date,
          renewal_date,
          status,
          notas,
          percent_override,
          insurers (
            id,
            name,
            active
          )
        ),
        brokers (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchQuery) {
      query = query.or('name.ilike.%' + searchQuery + '%,national_id.ilike.%' + searchQuery + '%,email.ilike.%' + searchQuery + '%');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error loading more clients:", error);
      return { ok: false as const, error: error.message };
    }
    
    const clients = (data || []).map((client: any) => ({
      ...client,
      policies: client.policies ? [client.policies].flat() : [],
      brokers: client.brokers || null
    })) as ClientWithPolicies[];
    
    return { ok: true as const, data: clients };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// =====================================================
// FUNCIONES DEPRECADAS - USAR preliminary-actions.ts
// =====================================================
// Las siguientes funciones usan campos antiguos que no existen
// El sistema de preliminares está en preliminary-actions.ts

/*
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
    
    const payload: TablesInsert<'temp_client_import'> = {
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
      status: data.status || 'ACTIVA', // Enum: ACTIVA | VENCIDA | CANCELADA
      broker_email: broker_email || '',
      percent_override: data.percent_override || null,
      source: data.source || 'manual',
      created_by: user.id,
    };
    
    const { data: temp, error } = await supabase
      .from('temp_client_import')
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
      .from('temp_client_import')
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
      status: row.status || 'ACTIVA', // Enum: ACTIVA | VENCIDA | CANCELADA
      broker_email: userRole === 'master' ? row.broker_email : userEmail,
      percent_override: row.percent_override || null,
      source: 'csv_import',
      created_by: user.id,
    }));
    
    const { data, error } = await supabase
      .from('temp_client_import')
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
      .from('temp_client_import')
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
      .from('temp_client_import')
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
      .from('temp_client_import')
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
*/
