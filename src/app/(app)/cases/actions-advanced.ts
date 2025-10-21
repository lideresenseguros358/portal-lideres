'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TablesUpdate } from '@/lib/database.types';

// =====================================================
// RECLASSIFY CASE (Master only)
// =====================================================

export async function actionReclassifyCase(
  caseId: string,
  updates: {
    section?: string;
    ctype?: string;
    broker_id?: string;
    insurer_id?: string;
    reason: string;
  }
) {
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
      return { ok: false as const, error: 'Solo Master puede reclasificar casos' };
    }

    // Get current case data
    const { data: currentCase } = await supabase
      .from('cases')
      .select('section, ctype, broker_id, insurer_id')
      .eq('id', caseId)
      .single();

    if (!currentCase) {
      return { ok: false as const, error: 'Caso no encontrado' };
    }

    // Build update object
    const updateData: TablesUpdate<'cases'> = {};
    
    if (updates.section) updateData.section = updates.section as any;
    if (updates.ctype) updateData.ctype = updates.ctype as any;
    if (updates.broker_id) updateData.broker_id = updates.broker_id;
    if (updates.insurer_id) updateData.insurer_id = updates.insurer_id;

    // Update case
    const { data, error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error reclassifying case:', error);
      return { ok: false as const, error: error.message };
    }

    // Add history entry
    await supabase
      .from('case_history')
      .insert([{
        case_id: caseId,
        action: 'RECLASSIFY',
        created_by: user.id,
        metadata: {
          previous: currentCase,
          new: updateData,
          reason: updates.reason,
        },
      }]);

    // If broker changed, notify new broker
    if (updates.broker_id && updates.broker_id !== currentCase.broker_id) {
      await supabase
        .from('notifications')
        .insert([{
          broker_id: updates.broker_id,
          notification_type: 'other',
          title: 'Caso reasignado',
          body: `Se te asignó un caso reclasificado`,
          target: `/cases/${caseId}`,
        }]);
    }

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionReclassifyCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// MERGE CASES (Master only)
// =====================================================

export async function actionMergeCases(
  targetCaseId: string, // Main case to keep
  sourceCaseIds: string[], // Cases to merge into target
  mergeReason: string
) {
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
      return { ok: false as const, error: 'Solo Master puede fusionar casos' };
    }

    // Get target case
    const { data: targetCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', targetCaseId)
      .single();

    if (!targetCase) {
      return { ok: false as const, error: 'Caso principal no encontrado' };
    }

    // Transfer checklist items from source cases
    for (const sourceId of sourceCaseIds) {
      // Get checklist items
      const { data: checklistItems } = await supabase
        .from('case_checklist')
        .select('*')
        .eq('case_id', sourceId);

      if (checklistItems && checklistItems.length > 0) {
        // Update to target case
        await supabase
          .from('case_checklist')
          .update({ case_id: targetCaseId })
          .eq('case_id', sourceId);
      }

      // Transfer files
      const { data: files } = await supabase
        .from('case_files')
        .select('*')
        .eq('case_id', sourceId);

      if (files && files.length > 0) {
        await supabase
          .from('case_files')
          .update({ case_id: targetCaseId })
          .eq('case_id', sourceId);
      }

      // Transfer comments
      const { data: comments } = await supabase
        .from('case_comments')
        .select('*')
        .eq('case_id', sourceId);

      if (comments && comments.length > 0) {
        await supabase
          .from('case_comments')
          .update({ case_id: targetCaseId })
          .eq('case_id', sourceId);
      }

      // Add history to source case
      await supabase
        .from('case_history')
        .insert([{
          case_id: sourceId,
          action: 'MERGED_INTO',
          created_by: user.id,
          metadata: {
            target_case_id: targetCaseId,
            reason: mergeReason,
          },
        }]);

      // Delete source case
      await supabase
        .from('cases')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_reason: `Fusionado en caso ${targetCase.case_number || targetCaseId}`,
        })
        .eq('id', sourceId);
    }

    // Add history to target case
    await supabase
      .from('case_history')
      .insert([{
        case_id: targetCaseId,
        action: 'MERGED_FROM',
        created_by: user.id,
        metadata: {
          source_case_ids: sourceCaseIds,
          reason: mergeReason,
          count: sourceCaseIds.length,
        },
      }]);

    return { 
      ok: true as const, 
      data: {
        target_case_id: targetCaseId,
        merged_count: sourceCaseIds.length,
      }
    };
  } catch (error: any) {
    console.error('Error in actionMergeCases:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// MARK DISCOUNT TO BROKER
// =====================================================

export async function actionMarkDiscountToBroker(
  caseId: string,
  amount: number,
  notes?: string
) {
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
      return { ok: false as const, error: 'Solo Master puede marcar descuentos' };
    }

    // Update case
    const { data, error } = await supabase
      .from('cases')
      .update({
        discount_to_broker: true,
        premium: amount,
        notes: notes || null,
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error marking discount:', error);
      return { ok: false as const, error: error.message };
    }

    // Add history
    await supabase
      .from('case_history')
      .insert([{
        case_id: caseId,
        action: 'DISCOUNT_MARKED',
        created_by: user.id,
        metadata: {
          amount,
          notes,
        },
      }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionMarkDiscountToBroker:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// MARK DIRECT PAYMENT
// =====================================================

export async function actionMarkDirectPayment(
  caseId: string,
  enabled: boolean,
  notes?: string
) {
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
      return { ok: false as const, error: 'Solo Master puede marcar pago directo' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update({
        direct_payment: enabled,
        notes: notes || null,
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error marking direct payment:', error);
      return { ok: false as const, error: error.message };
    }

    // Add history
    await supabase
      .from('case_history')
      .insert([{
        case_id: caseId,
        action: enabled ? 'DIRECT_PAYMENT_ENABLED' : 'DIRECT_PAYMENT_DISABLED',
        created_by: user.id,
        metadata: { notes },
      }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionMarkDirectPayment:', error);
    return { ok: false as const, error: error.message };
  }
}
