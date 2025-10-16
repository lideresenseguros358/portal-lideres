"use server";

import { revalidatePath } from 'next/cache';
import { 
  createInsurer,
  updateInsurer, 
  cloneInsurer,
  toggleInsurerActive,
  upsertInsurerMapping,
  upsertMappingRule,
  deleteMappingRule,
  importAssaCodes,
  previewMapping,
  InsurerInsertSchema,
  InsurerUpdateSchema,
  InsurerMappingInsertSchema,
  MappingRuleInsertSchema,
  type PreviewMappingOptions
} from '@/lib/db/insurers';
import { listAllBrokers } from '@/lib/db/brokers';

export async function actionCreateInsurer(data: unknown) {
  try {
    const parsed = InsurerInsertSchema.parse(data);
    const insurer = await createInsurer(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpdateInsurer(insurerId: string, data: unknown) {
  try {
    const parsed = InsurerUpdateSchema.parse(data);
    const insurer = await updateInsurer(insurerId, parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionCloneInsurer(insurerId: string) {
  try {
    const insurer = await cloneInsurer(insurerId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionToggleInsurerActive(insurerId: string) {
  try {
    const insurer = await toggleInsurerActive(insurerId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: insurer };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpsertInsurerMapping(data: unknown) {
  try {
    const parsed = InsurerMappingInsertSchema.parse(data);
    const mapping = await upsertInsurerMapping(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: mapping };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionUpsertMappingRule(data: unknown) {
  try {
    const parsed = MappingRuleInsertSchema.parse(data);
    const rule = await upsertMappingRule(parsed);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: rule };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionDeleteMappingRule(ruleId: string) {
  try {
    await deleteMappingRule(ruleId);
    revalidatePath('/(app)/insurers');
    return { ok: true as const };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionImportAssaCodes(insurerId: string, csvContent: string) {
  try {
    const result = await importAssaCodes(insurerId, csvContent);
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: result };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionPreviewMapping(options: PreviewMappingOptions) {
  try {
    const result = await previewMapping(options);
    return { ok: true as const, data: result };
  } catch (error) {
    return { 
      ok: false as const, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function actionGetAllBrokers() {
  try {
    const brokers = await listAllBrokers();
    return { ok: true as const, data: brokers };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function actionUpdateBrokerAssaCode(brokerId: string, assaCode: string | null) {
  // Placeholder for the database function
  console.log(`Updating broker ${brokerId} with ASSA code: ${assaCode}`);
  // In a real implementation, you would call a db function like:
  // await updateBroker(brokerId, { assa_code: assaCode });
  revalidatePath('/(app)/insurers');
  return { ok: true as const };
}

// =====================================================
// INSURER CONTACTS ACTIONS
// =====================================================

export async function actionGetInsurerContacts(insurerId: string) {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const supabase = await getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('insurer_contacts')
      .select('*')
      .eq('insurer_id', insurerId)
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al cargar contactos'
    };
  }
}

export async function actionCreateInsurerContact(data: {
  insurer_id: string;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  try {
    const { getSupabaseServer } = await import('@/lib/supabase/server');
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    
    // Verificar autenticación y rol
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }
    
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede agregar contactos' };
    }
    
    // Crear contacto
    const supabase = await getSupabaseAdmin();
    const { data: contact, error } = await supabase
      .from('insurer_contacts')
      .insert([{
        insurer_id: data.insurer_id,
        name: data.name,
        position: data.position || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    revalidatePath(`/(app)/insurers/${data.insurer_id}/edit`);
    return { ok: true as const, data: contact };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al crear contacto'
    };
  }
}

export async function actionUpdateInsurerContact(
  contactId: string,
  data: {
    name?: string;
    position?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }
) {
  try {
    const { getSupabaseServer } = await import('@/lib/supabase/server');
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    
    // Verificar autenticación y rol
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }
    
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede editar contactos' };
    }
    
    // Actualizar contacto
    const supabase = await getSupabaseAdmin();
    const { data: contact, error } = await supabase
      .from('insurer_contacts')
      .update(data)
      .eq('id', contactId)
      .select()
      .single();
    
    if (error) throw error;
    
    revalidatePath('/(app)/insurers');
    return { ok: true as const, data: contact };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al actualizar contacto'
    };
  }
}

export async function actionDeleteInsurerContact(contactId: string, insurerId: string) {
  try {
    const { getSupabaseServer } = await import('@/lib/supabase/server');
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    
    // Verificar autenticación y rol
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }
    
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede eliminar contactos' };
    }
    
    // Eliminar contacto
    const supabase = await getSupabaseAdmin();
    const { error } = await supabase
      .from('insurer_contacts')
      .delete()
      .eq('id', contactId);
    
    if (error) throw error;
    
    revalidatePath(`/(app)/insurers/${insurerId}/edit`);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al eliminar contacto'
    };
  }
}

export async function actionSetPrimaryContact(contactId: string, insurerId: string) {
  try {
    const { getSupabaseServer } = await import('@/lib/supabase/server');
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    
    // Verificar autenticación y rol
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }
    
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede establecer contacto principal' };
    }
    
    // Establecer como contacto principal (el trigger se encargará de desmarcar los demás)
    const supabase = await getSupabaseAdmin();
    const { error } = await supabase
      .from('insurer_contacts')
      .update({ is_primary: true } as any)
      .eq('id', contactId);
    
    if (error) throw error;
    
    revalidatePath('/(app)/insurers');
    revalidatePath(`/(app)/insurers/${insurerId}/edit`);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al establecer contacto principal'
    };
  }
}
