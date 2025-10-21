'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TablesInsert } from '@/lib/database.types';

// =====================================================
// CREATE PRELIMINAR IN DATABASE
// =====================================================

export async function actionCreatePreliminar(payload: {
  caseId: string;
  clientName: string;
  policyNumber: string;
  insurerId: string;
  nationalId?: string;
  email?: string;
  phone?: string;
  premium?: number;
  startDate?: string;
  policyTypeId?: string;
}) {
  try {
    const supabase = await getSupabaseAdmin();
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
      return { ok: false as const, error: 'Solo Master puede crear preliminares' };
    }

    // Get case data
    const { data: caseData } = await supabase
      .from('cases')
      .select('broker_id, client_id')
      .eq('id', payload.caseId)
      .single();

    if (!caseData) {
      return { ok: false as const, error: 'Caso no encontrado' };
    }

    let clientId = caseData.client_id;

    // If no client exists, create preliminar client
    if (!clientId) {
      const newClient: TablesInsert<'clients'> = {
        name: payload.clientName,
        national_id: payload.nationalId || null,
        email: payload.email || null,
        phone: payload.phone || null,
        broker_id: caseData.broker_id || user.id,
      };

      const { data: createdClient, error: clientError } = await supabase
        .from('clients')
        .insert([newClient])
        .select()
        .single();

      if (clientError || !createdClient) {
        console.error('Error creating client:', clientError);
        return { ok: false as const, error: 'Error al crear cliente preliminar' };
      }

      clientId = createdClient.id;
    }

    // Create preliminar policy
    const newPolicy: TablesInsert<'policies'> = {
      client_id: clientId,
      policy_number: payload.policyNumber,
      insurer_id: payload.insurerId,
      broker_id: caseData.broker_id || user.id,
      status: 'ACTIVA',
      start_date: payload.startDate || new Date().toISOString().split('T')[0],
    };

    const { data: createdPolicy, error: policyError } = await supabase
      .from('policies')
      .insert([newPolicy])
      .select()
      .single();

    if (policyError || !createdPolicy) {
      console.error('Error creating policy:', policyError);
      return { ok: false as const, error: 'Error al crear póliza preliminar' };
    }

    // Update case with client_id and policy_id
    await supabase
      .from('cases')
      .update({
        client_id: clientId,
        policy_id: createdPolicy.id,
        status: 'EMITIDO',
      })
      .eq('id', payload.caseId);

    // Add history entry
    await supabase
      .from('case_history')
      .insert([{
        case_id: payload.caseId,
        action: 'PRELIMINAR_CREATED',
        created_by: user.id,
        metadata: {
          client_id: clientId,
          policy_id: createdPolicy.id,
          policy_number: payload.policyNumber,
        },
      }]);

    // Create notification for broker
    if (caseData.broker_id) {
      await supabase
        .from('notifications')
        .insert([{
          broker_id: caseData.broker_id,
          notification_type: 'other',
          title: 'Preliminar creado - Completar datos',
          body: `Se creó preliminar para póliza ${payload.policyNumber}. Por favor completa los datos en Base de Datos.`,
          target: `/db?search=${payload.policyNumber}`,
        }]);
    }

    return { 
      ok: true as const, 
      data: {
        client_id: clientId,
        policy_id: createdPolicy.id,
        policy_number: payload.policyNumber,
      }
    };
  } catch (error: any) {
    console.error('Error in actionCreatePreliminar:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// SKIP PRELIMINAR (Just mark as EMITIDO)
// =====================================================

export async function actionSkipPreliminar(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede realizar esta acción' };
    }

    // Just update status to EMITIDO
    const { data, error } = await supabase
      .from('cases')
      .update({ status: 'EMITIDO' })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating case:', error);
      return { ok: false as const, error: error.message };
    }

    // Add history entry
    await supabase
      .from('case_history')
      .insert([{
        case_id: caseId,
        action: 'STATE_CHANGE',
        created_by: user.id,
        metadata: {
          new_status: 'EMITIDO',
          preliminar_skipped: true,
        },
      }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionSkipPreliminar:', error);
    return { ok: false as const, error: error.message };
  }
}
