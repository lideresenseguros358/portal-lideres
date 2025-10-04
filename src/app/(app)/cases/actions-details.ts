'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Tables, TablesInsert } from '@/lib/database.types';

// =====================================================
// CHECKLIST ACTIONS
// =====================================================

export async function actionAddChecklistItem(caseId: string, label: string, required: boolean = false) {
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
      return { ok: false as const, error: 'Solo Master puede agregar ítems' };
    }

    const itemData = {
      case_id: caseId,
      label,
      required,
      completed: false,
    } satisfies TablesInsert<'case_checklist'>;

    const { data, error } = await supabase
      .from('case_checklist')
      .insert([itemData])
      .select()
      .single();

    if (error) {
      console.error('Error adding checklist item:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: caseId,
      action: 'CHECKLIST_UPDATED',
      created_by: user.id,
      metadata: { action: 'added', label },
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionAddChecklistItem:', error);
    return { ok: false as const, error: error.message };
  }
}

export async function actionToggleChecklistItem(itemId: string, completed: boolean) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await supabase
      .from('case_checklist')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? user.id : null,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling checklist item:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: data.case_id,
      action: 'CHECKLIST_UPDATED',
      created_by: user.id,
      metadata: { action: completed ? 'completed' : 'uncompleted', item_id: itemId },
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionToggleChecklistItem:', error);
    return { ok: false as const, error: error.message };
  }
}

export async function actionDeleteChecklistItem(itemId: string) {
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
      return { ok: false as const, error: 'Solo Master puede eliminar ítems' };
    }

    // Get case_id before deleting
    const { data: item } = await supabase
      .from('case_checklist')
      .select('case_id, label')
      .eq('id', itemId)
      .single();

    const { error } = await supabase
      .from('case_checklist')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting checklist item:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    if (item) {
      await (supabase as any).from('case_history').insert([{
        case_id: item.case_id,
        action: 'CHECKLIST_UPDATED',
        created_by: user.id,
        metadata: { action: 'deleted', label: item.label },
      }]);
    }

    return { ok: true as const };
  } catch (error: any) {
    console.error('Error in actionDeleteChecklistItem:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// FILE ACTIONS
// =====================================================

export async function actionUploadCaseFile(caseId: string, file: {
  name: string;
  mime_type: string;
  size: number;
  storage_path: string;
}) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const fileData = {
      case_id: caseId,
      original_name: file.name,
      mime_type: file.mime_type,
      size_bytes: file.size,
      storage_path: file.storage_path,
      created_by: user.id,
    } satisfies TablesInsert<'case_files'>;

    const { data, error } = await supabase
      .from('case_files')
      .insert([fileData])
      .select()
      .single();

    if (error) {
      console.error('Error uploading case file:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: caseId,
      action: 'FILE_UPLOADED',
      created_by: user.id,
      metadata: { filename: file.name },
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionUploadCaseFile:', error);
    return { ok: false as const, error: error.message };
  }
}

export async function actionDeleteCaseFile(fileId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Get file info before deleting
    const { data: file } = await supabase
      .from('case_files')
      .select('case_id, original_name, storage_path')
      .eq('id', fileId)
      .single();

    if (!file) {
      return { ok: false as const, error: 'Archivo no encontrado' };
    }

    // Delete from storage
    try {
      await supabase.storage
        .from('pendientes')
        .remove([file.storage_path]);
    } catch (storageError) {
      console.error('Error deleting from storage:', storageError);
    }

    // Delete from database
    const { error } = await supabase
      .from('case_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error('Error deleting case file:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: file.case_id,
      action: 'FILE_DELETED',
      created_by: user.id,
      metadata: { filename: file.original_name },
    }]);

    return { ok: true as const };
  } catch (error: any) {
    console.error('Error in actionDeleteCaseFile:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// COMMENT ACTIONS
// =====================================================

export async function actionAddComment(caseId: string, content: string, channel: 'aseguradora' | 'oficina') {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const commentData = {
      case_id: caseId,
      content,
      channel,
      created_by: user.id,
    };

    const { data, error } = await (supabase as any)
      .from('case_comments')
      .insert([commentData])
      .select(`
        *,
        created_by_profile:profiles!created_by(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: caseId,
      action: 'COMMENT_ADDED',
      created_by: user.id,
      metadata: { channel },
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionAddComment:', error);
    return { ok: false as const, error: error.message };
  }
}

export async function actionGetComments(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await (supabase as any)
      .from('case_comments')
      .select(`
        *,
        created_by_profile:profiles!created_by(id, name, email)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionGetComments:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// HISTORY ACTIONS
// =====================================================

export async function actionGetHistory(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await (supabase as any)
      .from('case_history')
      .select(`
        *,
        created_by_profile:profiles!created_by(id, name, email)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionGetHistory:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// POSTPONE CASE
// =====================================================

export async function actionPostponeCase(caseId: string, postponedUntil: string, notes?: string) {
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
      return { ok: false as const, error: 'Solo Master puede aplazar casos' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update({
        status: 'APLAZADO' as any,
        postponed_until: postponedUntil,
        notes: notes || null,
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error postponing case:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: caseId,
      action: 'POSTPONED',
      created_by: user.id,
      metadata: { postponed_until: postponedUntil },
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionPostponeCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// GET STATS FOR DASHBOARD
// =====================================================

export async function actionGetCaseStats() {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('cases')
      .select('status, section, sla_date', { count: 'exact' })
      .eq('is_deleted', false);

    // RLS: Broker only sees their cases
    if (profile?.role === 'broker') {
      query = query.eq('broker_id', user.id);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching case stats:', error);
      return { ok: false as const, error: error.message };
    }

    // Calculate stats
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const todayTime = new Date(todayStr).getTime();
    const stats = {
      total: count || 0,
      by_status: {} as Record<string, number>,
      by_section: {} as Record<string, number>,
      sla_vencido: 0,
      sla_por_vencer: 0,
      sin_ver: 0,
    };

    data?.forEach((c: any) => {
      // Count by status
      stats.by_status[c.status] = (stats.by_status[c.status] || 0) + 1;

      // Count by section
      stats.by_section[c.section] = (stats.by_section[c.section] || 0) + 1;

      // Count SLA
      if (c.sla_date && todayStr) {
        if (c.sla_date < todayStr) {
          stats.sla_vencido++;
        } else {
          const daysRemaining = Math.floor((new Date(c.sla_date).getTime() - todayTime) / (1000 * 60 * 60 * 24));
          if (daysRemaining <= 5) {
            stats.sla_por_vencer++;
          }
        }
      }
    });

    // Count unseen (only for broker)
    if (profile?.role === 'broker') {
      const { count: unseenCount } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('broker_id', user.id)
        .eq('seen_by_broker', false)
        .eq('is_deleted', false);

      stats.sin_ver = unseenCount || 0;
    }

    return { ok: true as const, data: stats };
  } catch (error: any) {
    console.error('Error in actionGetCaseStats:', error);
    return { ok: false as const, error: error.message };
  }
}
