'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import { DEFAULT_SLA_DAYS } from '@/lib/constants/cases';

// =====================================================
// TYPES
// =====================================================

type CaseWithRelations = Tables<'cases'> & {
  broker?: Tables<'brokers'> & {
    profiles?: Tables<'profiles'>;
  };
  client?: Tables<'clients'>;
  insurer?: Tables<'insurers'>;
  checklist?: Tables<'case_checklist'>[];
  files?: Tables<'case_files'>[];
};

// =====================================================
// GET CASES (with filtering)
// =====================================================

export async function actionGetCases(filters?: {
  section?: string | null;
  status?: string | null;
  broker_id?: string | null;
  search?: string | null;
  include_deleted?: boolean;
  insurer_id?: string | null;
}) {
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
      .select(`
        *,
        broker:brokers!broker_id(
          *,
          profiles(id, email, name, role)
        ),
        client:clients(id, name, national_id),
        insurer:insurers(id, name, active)
      `)
      .order('created_at', { ascending: false });

    // RLS: Broker only sees their cases
    if (profile?.role === 'broker') {
      query = query.eq('broker_id', user.id);
    }

    // Apply filters
    if (!filters?.include_deleted) {
      query = query.eq('is_deleted', false);
    }

    if (filters?.section) {
      query = query.eq('section', filters.section as any);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status as any);
    }

    if (filters?.broker_id && profile?.role === 'master') {
      query = query.eq('broker_id', filters.broker_id);
    }

    if (filters?.insurer_id) {
      query = query.eq('insurer_id', filters.insurer_id);
    }

    if (filters?.search) {
      query = query.or(`
        client_name.ilike.%${filters.search}%,
        ticket_ref.ilike.%${filters.search}%,
        policy_number.ilike.%${filters.search}%,
        notes.ilike.%${filters.search}%
      `);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cases:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data: data as any };
  } catch (error: any) {
    console.error('Error in actionGetCases:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// GET SINGLE CASE
// =====================================================

export async function actionGetCase(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        broker:brokers!broker_id(
          *,
          profiles(id, email, name, role)
        ),
        client:clients(id, name, national_id, email, phone),
        insurer:insurers(id, name, active)
      `)
      .eq('id', caseId)
      .single();

    if (error) {
      console.error('Error fetching case:', error);
      return { ok: false as const, error: error.message };
    }

    // Get checklist
    const { data: checklist } = await supabase
      .from('case_checklist')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    // Get files
    const { data: files } = await supabase
      .from('case_files')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    const caseData: any = {
      ...data,
      checklist: checklist || [],
      files: files || [],
    };

    return { ok: true as const, data: caseData };
  } catch (error: any) {
    console.error('Error in actionGetCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// CREATE CASE (Manual by Master)
// =====================================================

export async function actionCreateCase(payload: {
  section: string;
  ctype: string;
  canal?: string;
  management_type: string;
  insurer_id: string;
  broker_id: string;
  client_id?: string;
  client_name?: string;
  policy_number?: string;
  policy_type?: string;
  premium?: number;
  payment_method?: string;
  sla_days?: number;
  notes?: string;
  checklist?: { label: string; required: boolean; completed: boolean; standardName?: string }[];
  files?: { file: File; standardName: string; category?: string; isMultiDocument?: boolean; documentParts?: string[] }[];
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
      return { ok: false as const, error: 'Solo Master puede crear casos manualmente' };
    }

    // Calculate SLA date
    const sla_days = payload.sla_days || DEFAULT_SLA_DAYS[payload.section as keyof typeof DEFAULT_SLA_DAYS] || 7;
    const sla_date = new Date();
    sla_date.setDate(sla_date.getDate() + sla_days);

    const caseData = {
      section: payload.section,
      ctype: payload.ctype,
      canal: payload.canal || 'MANUAL',
      management_type: payload.management_type,
      insurer_id: payload.insurer_id,
      broker_id: payload.broker_id,
      client_id: payload.client_id || null,
      client_name: payload.client_name || null,
      policy_number: payload.policy_number || null,
      policy_type: payload.policy_type || null,
      premium: payload.premium || null,
      payment_method: payload.payment_method || null,
      sla_days,
      sla_date: sla_date.toISOString().split('T')[0],
      status: 'PENDIENTE_REVISION',
      created_by: user.id,
      is_verified: true,
      seen_by_broker: false,
      notes: payload.notes || null,
    };

    const { data: newCase, error } = await (supabase as any)
      .from('cases')
      .insert([caseData])
      .select()
      .single();

    if (error) {
      console.error('Error creating case:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await (supabase as any).from('case_history').insert([{
      case_id: newCase.id,
      action: 'EMAIL_INGRESO',
      created_by: user.id,
      metadata: { source: 'manual', created_by_master: true },
    }]);

    // Create checklist items if provided
    if (payload.checklist && payload.checklist.length > 0) {
      const checklistItems = payload.checklist.map((item) => ({
        case_id: newCase.id,
        label: item.label,
        required: item.required,
        completed: item.completed,
        completed_at: item.completed ? new Date().toISOString() : null,
        completed_by: item.completed ? user.id : null,
      }));

      await supabase.from('case_checklist').insert(checklistItems);
    }

    // Upload files if provided
    if (payload.files && payload.files.length > 0) {
      for (const fileData of payload.files) {
        try {
          // Generate standardized filename with extension
          const fileExtension = fileData.file.name.split('.').pop() || 'pdf';
          const standardizedName = `${fileData.standardName}.${fileExtension}`;
          const storagePath = `${newCase.id}/${standardizedName}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('pendientes')
            .upload(storagePath, fileData.file, {
              contentType: fileData.file.type,
              upsert: true,
            });

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          // Create file record in database
          const fileRecord: any = {
            case_id: newCase.id,
            original_name: standardizedName,
            mime_type: fileData.file.type,
            size_bytes: fileData.file.size,
            storage_path: storagePath,
            created_by: user.id,
            document_type: fileData.standardName,
            category: fileData.category || null,
          };

          // If it's a multi-document PDF, store that info
          if (fileData.isMultiDocument && fileData.documentParts) {
            fileRecord.is_multi_document = true;
            fileRecord.document_parts = fileData.documentParts;
          }

          await supabase.from('case_files').insert([fileRecord]);
        } catch (fileError) {
          console.error('Error processing file:', fileError);
        }
      }
    }

    // Handle payment-related logic
    if (payload.payment_method === 'DESCUENTO_A_CORREDOR' && payload.premium && payload.premium > 0) {
      // Create advance for broker
      const { data: advance, error: advanceError } = await supabase
        .from('advances')
        .insert([{
          broker_id: payload.broker_id,
          amount: payload.premium,
          status: 'pending',
          reason: `Caso #${newCase.id} - ${payload.client_name || 'Cliente'} - ${payload.policy_number || 'Sin póliza'}`,
          created_by: user.id,
        }])
        .select()
        .single();

      if (advanceError) {
        console.error('Error creating advance:', advanceError);
        // Don't fail the case creation, just log
      } else {
        // Create pending payment linked to this case
        const { error: paymentError } = await supabase
          .from('pending_payments')
          .insert([{
            amount_to_pay: payload.premium,
            client_name: payload.client_name || 'CLIENTE NO ESPECIFICADO',
            insurer_name: payload.insurer_id ? `ID: ${payload.insurer_id}` : null,
            policy_number: payload.policy_number || null,
            purpose: 'DESCUENTO A CORREDOR',
            status: 'pending',
            can_be_paid: false, // Can't be paid until advance is settled
            notes: `Caso #${newCase.id} - Adelanto ID: ${advance?.id}`,
            created_by: user.id,
          }]);

        if (paymentError) {
          console.error('Error creating pending payment:', paymentError);
        }
      }
    } else if (payload.payment_method === 'TRANSFERENCIA' && payload.premium && payload.premium > 0) {
      // Create pending payment for bank transfer
      const { error: paymentError } = await supabase
        .from('pending_payments')
        .insert([{
          amount_to_pay: payload.premium,
          client_name: payload.client_name || 'CLIENTE NO ESPECIFICADO',
          insurer_name: payload.insurer_id ? `ID: ${payload.insurer_id}` : null,
          policy_number: payload.policy_number || null,
          purpose: 'PAGO DE POLIZA',
          status: 'pending',
          can_be_paid: true, // Can be paid immediately
          notes: `Caso #${newCase.id} - Transferencia bancaria`,
          created_by: user.id,
        }]);

      if (paymentError) {
        console.error('Error creating pending payment for transfer:', paymentError);
      }
    }

    return { ok: true as const, data: newCase };
  } catch (error: any) {
    console.error('Error in actionCreateCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// UPDATE CASE STATUS
// =====================================================

export async function actionUpdateCaseStatus(caseId: string, status: string, notes?: string) {
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
      return { ok: false as const, error: 'Solo Master puede cambiar estados' };
    }

    // If changing to EMITIDO, policy_number must exist
    if (status === 'EMITIDO') {
      const { data: caseData } = await supabase
        .from('cases')
        .select('policy_number, ctype, client_name, insurer_id')
        .eq('id', caseId)
        .single();

      if (!caseData?.policy_number) {
        return { ok: false as const, error: 'Número de póliza es obligatorio para EMITIDO' };
      }

      // Check if policy exists in DB (only if NOT VIDA ASSA WEB)
      if (caseData.ctype !== 'EMISION_VIDA_ASSA_WEB') {
        const { data: existingPolicy } = await supabase
          .from('policies')
          .select('id')
          .eq('policy_number', caseData.policy_number)
          .single();

        // If policy doesn't exist, flag for preliminar creation
        if (!existingPolicy) {
          return { 
            ok: true as const, 
            data: caseData as any,
            requires_preliminar: true,
            preliminar_data: {
              client_name: caseData.client_name,
              policy_number: caseData.policy_number,
              insurer_id: caseData.insurer_id
            }
          };
        }
      }
    }

    const updateData: TablesUpdate<'cases'> = {
      status: status as any,
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating case status:', error);
      return { ok: false as const, error: error.message };
    }

    // Trigger logs state change via database trigger

    return { ok: true as const, data, requires_preliminar: false };
  } catch (error: any) {
    console.error('Error in actionUpdateCaseStatus:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// UPDATE CASE (General)
// =====================================================

export async function actionUpdateCase(caseId: string, updates: Partial<TablesUpdate<'cases'>>) {
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
      return { ok: false as const, error: 'Solo Master puede editar casos' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating case:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionUpdateCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// DELETE CASE (Move to trash)
// =====================================================

export async function actionDeleteCase(caseId: string) {
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
      return { ok: false as const, error: 'Solo Master puede eliminar casos' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting case:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await supabase.from('case_history').insert([{
      case_id: caseId,
      action: 'DELETED',
      created_by: user.id,
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionDeleteCase:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// MARK AS SEEN
// =====================================================

export async function actionMarkCaseSeen(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update({ 
        visto: true,
        visto_at: new Date().toISOString(),
        visto_by: user.id,
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error marking case as seen:', error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionMarkCaseSeen:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// CLAIM CASE ("Mío")
// =====================================================

export async function actionClaimCase(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data, error } = await supabase
      .from('cases')
      .update({ claimed_by_broker_id: user.id })
      .eq('id', caseId)
      .select()
      .single();

    if (error) {
      console.error('Error claiming case:', error);
      return { ok: false as const, error: error.message };
    }

    // Log history
    await supabase.from('case_history').insert([{
      case_id: caseId,
      action: 'CLAIMED',
      created_by: user.id,
    }]);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionClaimCase:', error);
    return { ok: false as const, error: error.message };
  }
}
