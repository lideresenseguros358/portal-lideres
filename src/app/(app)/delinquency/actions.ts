'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface DelinquencyRecord {
  id: string;
  insurer_id: string;
  policy_number: string;
  client_name: string;
  broker_id: string | null;
  due_soon: number;
  current: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_debt: number;
  cutoff_date: string;
  last_updated: string;
  created_at: string;
}

export interface DelinquencySummary {
  due_soon: number;
  current: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total: number;
  count: number;
  last_import_date: string | null;
}

// Get summary by insurer and/or broker
export async function actionGetDelinquencySummary(filters: {
  insurerId?: string;
  brokerId?: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from('delinquency')
      .select('*');
    
    if (filters.insurerId) {
      query = query.eq('insurer_id', filters.insurerId);
    }
    
    if (filters.brokerId) {
      query = query.eq('broker_id', filters.brokerId);
    }
    
    // Only show records with debt > 0
    query = query.gt('total_debt', 0);
    
    const { data, error } = await query;
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    // Calculate summary
    const summary: DelinquencySummary = {
      due_soon: 0,
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      total: 0,
      count: data?.length || 0,
      last_import_date: null,
    };
    
    if (data && data.length > 0) {
      data.forEach(record => {
        summary.due_soon += Number(record.due_soon) || 0;
        summary.current += Number(record.current) || 0;
        summary.bucket_1_30 += Number(record.bucket_1_30) || 0;
        summary.bucket_31_60 += Number(record.bucket_31_60) || 0;
        summary.bucket_61_90 += Number(record.bucket_61_90) || 0;
        summary.bucket_90_plus += Number(record.bucket_90_plus) || 0;
        summary.total += Number(record.total_debt) || 0;
      });
      
      // Get latest import date
      const latestRecord = data.reduce((latest, current) => {
        return new Date(current.cutoff_date) > new Date(latest.cutoff_date) ? current : latest;
      });
      summary.last_import_date = latestRecord.cutoff_date;
    }
    
    return { ok: true, data: summary };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Get detailed records
export async function actionGetDelinquencyRecords(filters: {
  insurerId?: string;
  brokerId?: string;
  search?: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from('delinquency')
      .select('*');
    
    if (filters.insurerId) {
      query = query.eq('insurer_id', filters.insurerId);
    }
    
    if (filters.brokerId) {
      query = query.eq('broker_id', filters.brokerId);
    }
    
    if (filters.search) {
      query = query.or(`policy_number.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%`);
    }
    
    // Only show records with debt > 0
    query = query.gt('total_debt', 0);
    query = query.order('total_debt', { ascending: false });
    
    const { data, error } = await query as any;
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    return { ok: true, data: data || [] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Import delinquency data
export async function actionImportDelinquency(payload: {
  insurerId: string;
  cutoffDate: string;
  records: Array<{
    policy_number: string;
    client_name: string;
    due_soon: number;
    current: number;
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_90_plus: number;
  }>;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    // Get policy numbers from this batch
    const policyNumbers = payload.records.map(r => r.policy_number);
    
    // Delete existing records for these policies
    const { error: deleteError } = await supabase
      .from('delinquency')
      .delete()
      .eq('insurer_id', payload.insurerId)
      .in('policy_number', policyNumbers);
    
    if (deleteError) {
      return { ok: false, error: 'Error al limpiar datos previos: ' + deleteError.message };
    }
    
    // Look up broker_id for each policy
    const { data: policies } = await supabase
      .from('policies')
      .select('policy_number, broker_id')
      .in('policy_number', policyNumbers);
    
    const brokerMap = new Map(
      (policies || []).map(p => [p.policy_number, p.broker_id])
    );
    
    // Prepare records for insertion
    const recordsToInsert = payload.records.map(record => {
      const total_debt = 
        (Number(record.due_soon) || 0) +
        (Number(record.current) || 0) +
        (Number(record.bucket_1_30) || 0) +
        (Number(record.bucket_31_60) || 0) +
        (Number(record.bucket_61_90) || 0) +
        (Number(record.bucket_90_plus) || 0);
      
      return {
        insurer_id: payload.insurerId,
        policy_number: record.policy_number,
        client_name: record.client_name,
        broker_id: brokerMap.get(record.policy_number) || null,
        due_soon: Number(record.due_soon) || 0,
        current: Number(record.current) || 0,
        bucket_1_30: Number(record.bucket_1_30) || 0,
        bucket_31_60: Number(record.bucket_31_60) || 0,
        bucket_61_90: Number(record.bucket_61_90) || 0,
        bucket_90_plus: Number(record.bucket_90_plus) || 0,
        total_debt,
        cutoff_date: payload.cutoffDate,
        last_updated: new Date().toISOString(),
      };
    });
    
    // Insert new records
    const { error: insertError } = await supabase
      .from('delinquency')
      .insert(recordsToInsert);
    
    if (insertError) {
      return { ok: false, error: 'Error al insertar datos: ' + insertError.message };
    }
    
    revalidatePath('/delinquency');
    
    return { 
      ok: true, 
      message: 'Import realizado correctamente sin errores',
      count: recordsToInsert.length 
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Get active insurers
export async function actionGetActiveInsurers() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data, error } = await supabase
      .from('insurers')
      .select('id, name')
      .eq('active', true)
      .order('name');
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    return { ok: true, data: data || [] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Get brokers (for Master role)
export async function actionGetBrokers() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data, error } = await supabase
      .from('brokers')
      .select('id, name')
      .order('name');
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    return { ok: true, data: data || [] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Update delinquency record client name
export async function actionUpdateDelinquencyClientName(payload: {
  recordId: string;
  clientName: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    const { error } = await supabase
      .from('delinquency')
      .update({ 
        client_name: payload.clientName,
        last_updated: new Date().toISOString()
      })
      .eq('id', payload.recordId);
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    revalidatePath('/delinquency');
    
    return { ok: true, message: 'Nombre del cliente actualizado correctamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Update delinquency record policy number
export async function actionUpdateDelinquencyPolicyNumber(payload: {
  recordId: string;
  policyNumber: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    const { error } = await supabase
      .from('delinquency')
      .update({ 
        policy_number: payload.policyNumber,
        last_updated: new Date().toISOString()
      })
      .eq('id', payload.recordId);
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    revalidatePath('/delinquency');
    
    return { ok: true, message: 'Número de póliza actualizado correctamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Update delinquency record broker
export async function actionUpdateDelinquencyBroker(payload: {
  recordId: string;
  brokerId: string | null;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    const { error } = await supabase
      .from('delinquency')
      .update({ 
        broker_id: payload.brokerId,
        last_updated: new Date().toISOString()
      })
      .eq('id', payload.recordId);
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    revalidatePath('/delinquency');
    
    return { ok: true, message: 'Corredor actualizado correctamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Sync delinquency with policies (update broker assignments)
export async function actionSyncDelinquencyWithPolicies() {
  try {
    const supabase = await getSupabaseServer();
    
    // Get all delinquency records
    const { data: delinquencyRecords, error: fetchError } = await supabase
      .from('delinquency')
      .select('id, policy_number, broker_id, client_name');
    
    if (fetchError) {
      return { ok: false, error: fetchError.message };
    }
    
    if (!delinquencyRecords || delinquencyRecords.length === 0) {
      return { ok: true, message: 'No hay registros para sincronizar', updated: 0 };
    }
    
    // Get policy numbers
    const policyNumbers = delinquencyRecords.map(r => r.policy_number);
    
    // Get current broker assignments from policies
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('policy_number, broker_id')
      .in('policy_number', policyNumbers);
    
    if (policiesError) {
      return { ok: false, error: policiesError.message };
    }
    
    // Create map for quick lookup
    const policyBrokerMap = new Map(
      (policies || []).map((p: any) => [p.policy_number, p.broker_id])
    );
    
    // Update records where broker_id has changed
    let updated = 0;
    for (const record of delinquencyRecords) {
      const currentBroker = policyBrokerMap.get(record.policy_number);
      
      // Only update if broker_id has changed
      if (currentBroker !== undefined && currentBroker !== record.broker_id) {
        const { error: updateError } = await supabase
          .from('delinquency')
          .update({ 
            broker_id: currentBroker || null,
            last_updated: new Date().toISOString()
          })
          .eq('id', record.id);
        
        if (!updateError) {
          updated++;
        }
      }
    }
    
    revalidatePath('/delinquency');
    
    return { 
      ok: true, 
      message: `Sincronización completada: ${updated} registro(s) actualizado(s)`,
      updated 
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
