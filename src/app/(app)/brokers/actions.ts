'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import { Tables, TablesUpdate } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';
import { OFICINA_EMAIL } from '@/lib/constants/brokers';

// =====================================================
// GET ALL BROKERS
// =====================================================

export async function actionGetBrokers(search?: string) {
  try {
    const supabase = await getSupabaseAdmin();

    // Get brokers
    let brokersQuery = supabase
      .from('brokers')
      .select('*')
      .order('name', { ascending: true });

    if (search) {
      brokersQuery = brokersQuery.or(`
        name.ilike.%${search}%,
        email.ilike.%${search}%,
        national_id.ilike.%${search}%,
        assa_code.ilike.%${search}%
      `);
    }

    const { data: brokersData, error: brokersError } = await brokersQuery;

    if (brokersError) {
      console.error('Error fetching brokers:', brokersError);
      return { ok: false as const, error: brokersError.message };
    }

    if (!brokersData || brokersData.length === 0) {
      return { ok: true as const, data: [] };
    }

    // Get profiles for brokers
    const brokerIds = brokersData.map(b => b.p_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .in('id', brokerIds);

    // Merge brokers with profiles
    const brokers = brokersData.map(broker => ({
      ...broker,
      profiles: profilesData?.find(p => p.id === broker.p_id) || null
    }));

    return { ok: true as const, data: brokers };
  } catch (error: any) {
    console.error('Error in actionGetBrokers:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// GET SINGLE BROKER WITH STATS
// =====================================================

export async function actionGetBroker(brokerId: string) {
  try {
    const supabase = await getSupabaseAdmin();

    // Get broker
    const { data: brokerData, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', brokerId)
      .single();

    if (brokerError) {
      console.error('Error fetching broker:', brokerError);
      return { ok: false as const, error: brokerError.message };
    }

    // Get profile for broker
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', brokerData.p_id)
      .single();

    const broker = {
      ...brokerData,
      profiles: profileData || null
    };

    // Get stats for current year
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    // Get paid commissions (from fortnights)
    // TODO: This should query from actual commission records
    // For now, returning 0 until proper commission tracking is implemented
    const totalPaid = 0;

    // Get open advances balance
    const { data: advances } = await supabase
      .from('advances')
      .select('amount')
      .eq('broker_id', brokerId)
      .eq('status', 'open');

    const advancesBalance = advances?.reduce((sum, a) => sum + a.amount, 0) || 0;

    // Get policies count (cartera)
    const { count: policiesCount } = await supabase
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('broker_id', brokerId);

    return { 
      ok: true as const, 
      data: {
        ...broker,
        stats: {
          totalPaid,
          advancesBalance,
          policiesCount: policiesCount || 0,
        }
      }
    };
  } catch (error: any) {
    console.error('Error in actionGetBroker:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// UPDATE BROKER
// =====================================================

export async function actionUpdateBroker(brokerId: string, updates: Partial<TablesUpdate<'brokers'>>) {
  try {
    console.log('[actionUpdateBroker] Starting update for brokerId:', brokerId);
    console.log('[actionUpdateBroker] Updates payload (raw):', updates);
    
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      console.log('[actionUpdateBroker] No user authenticated');
      return { ok: false as const, error: 'No autenticado' };
    }

    console.log('[actionUpdateBroker] User ID:', user.id);

    // Check if user is master
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[actionUpdateBroker] User role:', profile?.role);

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede editar brokers' };
    }

    // Clean up empty strings - convert to null for optional fields
    const nullableFields = ['birth_date', 'phone', 'national_id', 'assa_code', 'license_no', 'bank_account_no', 'beneficiary_name', 'beneficiary_id', 'email'];
    
    const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      // Convert empty strings to null for nullable fields
      if (nullableFields.includes(key) && value === '') {
        acc[key] = null;
      } else if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    console.log('[actionUpdateBroker] Cleaned updates:', cleanedUpdates);

    const supabase = await getSupabaseAdmin();
    console.log('[actionUpdateBroker] Using admin client for update');

    // Check if it's Oficina and trying to change percent_default
    const { data: broker } = await supabase
      .from('brokers')
      .select('email, profiles!p_id(email)')
      .eq('id', brokerId)
      .single();

    const brokerEmail = (broker?.profiles as any)?.email || broker?.email;
    if (brokerEmail === OFICINA_EMAIL && cleanedUpdates.percent_default && cleanedUpdates.percent_default !== 1.00) {
      return { ok: false as const, error: 'No se puede cambiar el % de Oficina (siempre 100%)' };
    }

    console.log('[actionUpdateBroker] Executing UPDATE query...');
    const { data, error } = await supabase
      .from('brokers')
      .update(cleanedUpdates)
      .eq('id', brokerId)
      .select()
      .single();

    if (error) {
      console.error('[actionUpdateBroker] Error updating broker:', error);
      return { ok: false as const, error: error.message };
    }

    console.log('[actionUpdateBroker] Update successful, data:', data);
    console.log('[actionUpdateBroker] Revalidating paths...');
    
    revalidatePath('/brokers');
    revalidatePath(`/brokers/${brokerId}`);

    console.log('[actionUpdateBroker] Complete!');
    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionUpdateBroker:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// TOGGLE ACTIVE STATUS
// =====================================================

export async function actionToggleBrokerActive(brokerId: string, active: boolean) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Check if user is master
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede cambiar estados' };
    }

    const supabase = await getSupabaseAdmin();

    // Cannot deactivate Oficina
    const { data: broker } = await supabase
      .from('brokers')
      .select('profiles!p_id(email)')
      .eq('id', brokerId)
      .single();

    const brokerEmail = (broker?.profiles as any)?.email;
    if (brokerEmail === OFICINA_EMAIL && !active) {
      return { ok: false as const, error: 'No se puede desactivar Oficina' };
    }

    const { data, error } = await supabase
      .from('brokers')
      .update({ active })
      .eq('id', brokerId)
      .select()
      .single();

    if (error) {
      console.error('Error toggling broker active:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath('/brokers');
    revalidatePath(`/brokers/${brokerId}`);

    return { ok: true as const, data };
  } catch (error: any) {
    console.error('Error in actionToggleBrokerActive:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// DELETE BROKER (Move portfolio to Oficina)
// =====================================================

export async function actionDeleteBroker(brokerId: string) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Check if user is master
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede eliminar brokers' };
    }

    const supabase = await getSupabaseAdmin();

    // Cannot delete Oficina
    const { data: broker } = await supabase
      .from('brokers')
      .select('profiles!p_id(email)')
      .eq('id', brokerId)
      .single();

    const brokerEmail = (broker?.profiles as any)?.email;
    if (brokerEmail === OFICINA_EMAIL) {
      return { ok: false as const, error: 'No se puede eliminar Oficina' };
    }

    // Get Oficina broker ID
    const { data: oficina } = await supabase
      .from('profiles')
      .select('id, brokers!p_id(id)')
      .eq('email', OFICINA_EMAIL)
      .single();

    const oficinaId = (oficina?.brokers as any)?.id;

    if (!oficinaId) {
      return { ok: false as const, error: 'No se encontró broker Oficina' };
    }

    // Move all policies to Oficina and mark as new
    const { error: policiesError } = await supabase
      .from('policies')
      .update({ 
        broker_id: oficinaId,
        is_new: true 
      })
      .eq('broker_id', brokerId);

    if (policiesError) {
      console.error('Error moving policies:', policiesError);
      return { ok: false as const, error: 'Error moviendo cartera a Oficina' };
    }

    // Delete broker
    const { error } = await supabase
      .from('brokers')
      .delete()
      .eq('id', brokerId);

    if (error) {
      console.error('Error deleting broker:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath('/brokers');

    return { ok: true as const, message: 'Broker eliminado y cartera movida a Oficina' };
  } catch (error: any) {
    console.error('Error in actionDeleteBroker:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// APPLY DEFAULT PERCENT TO ALL POLICIES
// =====================================================

export async function actionApplyDefaultPercentToAll(brokerId: string) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Check if user is master
    const { data: profile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return { ok: false as const, error: 'Solo Master puede aplicar % default' };
    }

    const supabase = await getSupabaseAdmin();

    // Get broker's default percent
    const { data: broker } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', brokerId)
      .single();

    if (!broker || !broker.percent_default) {
      return { ok: false as const, error: 'Broker no tiene % default configurado' };
    }

    // Update all policies to null (will inherit default)
    const { error } = await supabase
      .from('policies')
      .update({ percent_override: null })
      .eq('broker_id', brokerId);

    if (error) {
      console.error('Error applying default percent:', error);
      return { ok: false as const, error: error.message };
    }

    revalidatePath(`/brokers/${brokerId}`);
    revalidatePath('/db');

    return { ok: true as const, message: '% default aplicado a todas las pólizas' };
  } catch (error: any) {
    console.error('Error in actionApplyDefaultPercentToAll:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// EXPORT BROKERS TO CSV
// =====================================================

export async function actionExportBrokers(brokerIds?: string[]) {
  try {
    const supabase = await getSupabaseAdmin();

    // Get brokers
    let brokersQuery = supabase
      .from('brokers')
      .select('*');

    if (brokerIds && brokerIds.length > 0) {
      brokersQuery = brokersQuery.in('id', brokerIds);
    }

    const { data: brokersData, error: brokersError } = await brokersQuery;

    if (brokersError) {
      console.error('Error exporting brokers:', brokersError);
      return { ok: false as const, error: brokersError.message };
    }

    if (!brokersData || brokersData.length === 0) {
      return { ok: true as const, data: [] };
    }

    // Get profiles for brokers
    const brokerProfileIds = brokersData.map(b => b.p_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, created_at')
      .in('id', brokerProfileIds);

    // Merge data
    const data = brokersData.map(b => ({
      ...b,
      profiles: profilesData?.find(p => p.id === b.p_id) || null
    }));

    // Format data for export
    const exportData = data.map(b => ({
      nombre: b.name || '',
      email: (b.profiles as any)?.email || b.email || '',
      telefono: b.phone || '',
      codigo_assa: b.assa_code || '',
      licencia: b.license_no || '',
      banco: b.bank_account_no || '', // Bank name would need separate table
      numero_cuenta: b.bank_account_no || '',
      titular: b.beneficiary_name || '',
      cedula_titular: b.beneficiary_id || '',
      percent_default: b.percent_default || '',
      estado: b.active ? 'Activo' : 'Inactivo',
      fecha_creacion: (b.profiles as any)?.created_at || b.created_at || '',
    }));

    return { ok: true as const, data: exportData };
  } catch (error: any) {
    console.error('Error in actionExportBrokers:', error);
    return { ok: false as const, error: error.message };
  }
}
