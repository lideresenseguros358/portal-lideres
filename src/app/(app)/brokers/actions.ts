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

    // Get all brokers
    const { data: brokersData, error: brokersError } = await supabase
      .from('brokers')
      .select('*')
      .order('name', { ascending: true });

    if (brokersError) {
      console.error('Error fetching brokers:', brokersError);
      return { ok: false as const, error: brokersError.message };
    }

    if (!brokersData || brokersData.length === 0) {
      return { ok: true as const, data: [] };
    }

    // Get profiles for all brokers
    const brokerProfileIds = brokersData.map(b => b.p_id).filter(Boolean);
    let profilesData: any[] = [];
    
    if (brokerProfileIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .in('id', brokerProfileIds);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else {
        profilesData = profiles || [];
      }
    }

    // Merge brokers with profiles
    const brokersWithProfiles = brokersData.map(broker => ({
      ...broker,
      profiles: profilesData.find(p => p.id === broker.p_id) || null
    }));

    // Filter by search if provided
    let filteredBrokers = brokersWithProfiles;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBrokers = brokersWithProfiles.filter(broker => {
        const profileData = broker.profiles as any;
        
        return (
          broker.name?.toLowerCase().includes(searchLower) ||
          broker.email?.toLowerCase().includes(searchLower) ||
          broker.national_id?.toLowerCase().includes(searchLower) ||
          broker.assa_code?.toLowerCase().includes(searchLower) ||
          profileData?.email?.toLowerCase().includes(searchLower) ||
          profileData?.full_name?.toLowerCase().includes(searchLower)
        );
      });
    }

    return { ok: true as const, data: filteredBrokers };
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
    console.log('[actionUpdateBroker] Updates payload:', updates);
    
    // ====== AUTHENTICATION & AUTHORIZATION ======
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
      return { ok: false as const, error: 'Solo Master puede editar brokers' };
    }

    const supabase = await getSupabaseAdmin();

    // ====== GET BROKER INFO ======
    const { data: broker, error: fetchError } = await supabase
      .from('brokers')
      .select('p_id, email')
      .eq('id', brokerId)
      .single();

    if (fetchError || !broker) {
      return { ok: false as const, error: 'Corredor no encontrado' };
    }

    // ====== EXTRACT ROLE & PREPARE UPDATES ======
    const { role: newRole, ...brokerUpdates } = updates as any;

    // Clean up empty strings - convert to null for optional fields
    const nullableFields = [
      'birth_date', 'phone', 'national_id', 'assa_code', 'license_no', 
      'bank_account_no', 'beneficiary_name', 'email', 'carnet_expiry_date', 
      'nombre_completo', 'bank_route', 'tipo_cuenta'
    ];
    
    const cleanedBrokerUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(brokerUpdates)) {
      if (value === undefined) continue;
      cleanedBrokerUpdates[key] = (nullableFields.includes(key) && value === '') ? null : value;
    }

    // Prevent changing Oficina's percent
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', broker.p_id)
      .single();
      
    if (existingProfile?.email === OFICINA_EMAIL) {
      if (cleanedBrokerUpdates.percent_default && cleanedBrokerUpdates.percent_default !== 1.00) {
        return { ok: false as const, error: 'No se puede cambiar el % de Oficina (siempre 100%)' };
      }
      if (newRole) {
        return { ok: false as const, error: 'No se puede cambiar el rol de Oficina' };
      }
    }

    // ====== UPDATE BROKERS TABLE ======
    console.log('[actionUpdateBroker] Updating brokers table:', cleanedBrokerUpdates);
    const { data: updatedBroker, error: updateError } = await supabase
      .from('brokers')
      .update(cleanedBrokerUpdates satisfies TablesUpdate<'brokers'>)
      .eq('id', brokerId)
      .select()
      .single();

    if (updateError) {
      console.error('[actionUpdateBroker] Error updating broker:', updateError);
      return { ok: false as const, error: updateError.message };
    }

    // ====== SYNC TO PROFILES & AUTH.USERS ======
    const syncErrors: string[] = [];
    
    // Prepare profile updates
    const profileUpdates: Partial<TablesUpdate<'profiles'>> = {};
    if (cleanedBrokerUpdates.name !== undefined) {
      profileUpdates.full_name = cleanedBrokerUpdates.name;
    }
    if (cleanedBrokerUpdates.email !== undefined) {
      profileUpdates.email = cleanedBrokerUpdates.email;
    }
    if (newRole && (newRole === 'master' || newRole === 'broker')) {
      profileUpdates.role = newRole;
    }

    // SIEMPRE asegurar que el nombre esté sincronizado con profiles
    // Esto garantiza que brokers.name y profiles.full_name siempre coincidan
    if (!profileUpdates.full_name && updatedBroker.name) {
      profileUpdates.full_name = updatedBroker.name;
    }

    // Update profiles if there are changes
    if (Object.keys(profileUpdates).length > 0) {
      console.log('[actionUpdateBroker] Syncing to profiles:', profileUpdates);
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', broker.p_id);

      if (profileError) {
        console.error('[actionUpdateBroker] Profile sync error:', profileError);
        syncErrors.push('profiles: ' + profileError.message);
      }
    }

    // Sync email to auth.users if changed
    if (cleanedBrokerUpdates.email !== undefined && cleanedBrokerUpdates.email !== null) {
      console.log('[actionUpdateBroker] Syncing email to auth.users');
      const { error: authError } = await supabase.auth.admin.updateUserById(
        broker.p_id,
        { email: cleanedBrokerUpdates.email }
      );

      if (authError) {
        console.error('[actionUpdateBroker] Auth sync error:', authError);
        syncErrors.push('auth: ' + authError.message);
      }
    }

    // ====== REVALIDATE PATHS ======
    revalidatePath('/brokers');
    revalidatePath(`/brokers/${brokerId}`);
    revalidatePath('/account');
    revalidatePath('/', 'layout');

    console.log('[actionUpdateBroker] Complete! Sync errors:', syncErrors.length);
    
    // Return success even if sync had issues (broker table is updated)
    return { 
      ok: true as const, 
      data: updatedBroker,
      warnings: syncErrors.length > 0 ? syncErrors : undefined
    };
  } catch (error: any) {
    console.error('[actionUpdateBroker] Unexpected error:', error);
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
      .select('p_id')
      .eq('id', brokerId)
      .single();

    let brokerEmail = null;
    if (broker?.p_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', broker.p_id)
        .single();
      brokerEmail = profile?.email;
    }
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
      .select('p_id')
      .eq('id', brokerId)
      .single();

    let brokerEmail = null;
    if (broker?.p_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', broker.p_id)
        .single();
      brokerEmail = profile?.email;
    }
    if (brokerEmail === OFICINA_EMAIL) {
      return { ok: false as const, error: 'No se puede eliminar Oficina' };
    }

    // Get Oficina broker ID
    const { data: oficina } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', OFICINA_EMAIL)
      .single();

    let oficinaId = null;
    if (oficina?.id) {
      const { data: oficinaBroker } = await supabase
        .from('brokers')
        .select('id')
        .eq('p_id', oficina.id)
        .single();
      oficinaId = oficinaBroker?.id;
    }

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
// GET EXPIRING CARNETS (60 days or less)
// =====================================================

export async function actionGetExpiringCarnets(userRole?: 'master' | 'broker', brokerId?: string) {
  try {
    const supabase = await getSupabaseAdmin();

    let query = supabase
      .from('brokers')
      .select('id, name, carnet_expiry_date, p_id')
      .not('carnet_expiry_date', 'is', null)
      .eq('active', true);

    // If broker role, only show their own carnet
    if (userRole === 'broker' && brokerId) {
      query = query.eq('id', brokerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching expiring carnets:', error);
      return { ok: false as const, error: error.message };
    }

    if (!data || data.length === 0) {
      return { ok: true as const, data: [] };
    }

    // Get profiles for brokers
    const brokerProfileIds = data.map(b => b.p_id).filter(Boolean);
    let profilesData: any[] = [];
    
    if (brokerProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', brokerProfileIds);
      profilesData = profiles || [];
    }

    // Calculate days until expiry and filter those within 60 days
    const today = new Date();
    const expiringCarnets = data
      .map((broker: any) => {
        const expiryDate = new Date(broker.carnet_expiry_date);
        const diffTime = expiryDate.getTime() - today.getTime();
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const profile = profilesData.find(p => p.id === broker.p_id);

        return {
          id: broker.id,
          name: broker.name || profile?.full_name || 'Sin nombre',
          email: profile?.email || '',
          carnet_expiry_date: broker.carnet_expiry_date,
          daysUntilExpiry,
          status: daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry <= 30 ? 'critical' : 'warning'
        };
      })
      .filter(broker => broker.daysUntilExpiry <= 60) // Only within 60 days or already expired
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Sort by most urgent first

    return { ok: true as const, data: expiringCarnets };
  } catch (error: any) {
    console.error('Error in actionGetExpiringCarnets:', error);
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
      titular: b.nombre_completo || '',
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

// =====================================================
// BULK UPDATE BROKERS
// =====================================================

export async function actionBulkUpdateBrokers(updates: Array<{ id: string; [key: string]: any }>) {
  try {
    console.log('[actionBulkUpdateBrokers] Starting bulk update for', updates.length, 'brokers');
    
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
      return { ok: false as const, error: 'Solo Master puede editar brokers' };
    }

    const supabase = await getSupabaseAdmin();
    
    // ====== BULK UPDATE PROCESS ======
    const results = [];
    const nullableFields = [
      'birth_date', 'phone', 'national_id', 'assa_code', 'license_no', 
      'bank_account_no', 'beneficiary_name', 'email', 'carnet_expiry_date', 
      'nombre_completo', 'bank_route', 'tipo_cuenta'
    ];
    
    for (const update of updates) {
      const { id, role: newRole, ...brokerUpdates } = update as any;
      
      console.log(`[actionBulkUpdateBrokers] Processing broker ${id}:`, { newRole, brokerUpdates });
      
      // Skip if no changes
      if (Object.keys(brokerUpdates).length === 0 && !newRole) {
        console.log(`[actionBulkUpdateBrokers] Skipping broker ${id} - no changes`);
        continue;
      }

      try {
        // Clean updates
        const cleanedUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(brokerUpdates)) {
          if (value === undefined) continue;
          cleanedUpdates[key] = (nullableFields.includes(key) && value === '') ? null : value;
        }
        
        console.log(`[actionBulkUpdateBrokers] Cleaned updates for ${id}:`, cleanedUpdates);

        // Update brokers table
        const { data: broker, error: brokerError } = await supabase
          .from('brokers')
          .update(cleanedUpdates satisfies TablesUpdate<'brokers'>)
          .eq('id', id)
          .select('p_id, email')
          .single();

        if (brokerError || !broker) {
          console.error(`[actionBulkUpdateBrokers] Error updating broker ${id}:`, brokerError);
          results.push({ id, success: false, error: brokerError?.message || 'Unknown error' });
          continue;
        }

        // Check if this is Oficina - cannot change Oficina's role
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', broker.p_id)
          .single();
          
        if (existingProfile?.email === OFICINA_EMAIL && newRole) {
          console.log(`[actionBulkUpdateBrokers] Skipping role update for Oficina`);
          results.push({ id, success: true, warning: 'Rol de Oficina no modificado' });
          continue;
        }

        // Sync to profiles - SIEMPRE sincronizar nombre para mantener consistencia
        const profileUpdates: Partial<TablesUpdate<'profiles'>> = {};
        
        // Si se actualizó el nombre en brokers, sincronizar con profiles
        if (cleanedUpdates.name !== undefined) {
          profileUpdates.full_name = cleanedUpdates.name;
        } else if (broker.email || broker.p_id) {
          // Si NO se actualizó el nombre pero el broker existe, asegurar sincronización
          // Obtener el nombre actual del broker para sincronizarlo
          const { data: currentBroker } = await supabase
            .from('brokers')
            .select('name')
            .eq('id', id)
            .single();
          
          if (currentBroker?.name) {
            profileUpdates.full_name = currentBroker.name;
          }
        }
        
        if (cleanedUpdates.email !== undefined) profileUpdates.email = cleanedUpdates.email;
        if (newRole && (newRole === 'master' || newRole === 'broker')) {
          profileUpdates.role = newRole;
          console.log(`[actionBulkUpdateBrokers] Role update for ${id}: ${newRole}`);
        }

        if (Object.keys(profileUpdates).length > 0) {
          console.log(`[actionBulkUpdateBrokers] Syncing to profiles for ${id}:`, profileUpdates);
          const { error: profileError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', broker.p_id);
            
          if (profileError) {
            console.error(`[actionBulkUpdateBrokers] Profile sync error for ${id}:`, profileError);
          }
        }

        // Sync email to auth.users if changed
        if (cleanedUpdates.email !== undefined && cleanedUpdates.email !== null) {
          console.log(`[actionBulkUpdateBrokers] Syncing email to auth.users for ${id}`);
          const { error: authError } = await supabase.auth.admin.updateUserById(
            broker.p_id,
            { email: cleanedUpdates.email }
          );
          
          if (authError) {
            console.error(`[actionBulkUpdateBrokers] Auth sync error for ${id}:`, authError);
          }
        }

        results.push({ id, success: true });
      } catch (error: any) {
        console.error(`[actionBulkUpdateBrokers] Error processing broker ${id}:`, error);
        results.push({ id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    console.log(`[actionBulkUpdateBrokers] Complete. Success: ${successCount}, Errors: ${errorCount}`);
    console.log(`[actionBulkUpdateBrokers] Results:`, results);
    
    revalidatePath('/brokers');
    revalidatePath('/', 'layout');

    if (errorCount > 0 && successCount === 0) {
      return { 
        ok: false as const, 
        error: `No se pudo actualizar ningún corredor. ${errorCount} errores.` 
      };
    }

    return { 
      ok: true as const, 
      data: results,
      message: successCount > 0 
        ? `${successCount} corredor(es) actualizados${errorCount > 0 ? ` (${errorCount} con errores)` : ''}`
        : 'No se realizaron cambios'
    };
  } catch (error: any) {
    console.error('Error in actionBulkUpdateBrokers:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// SYNC ALL BROKERS NAMES WITH PROFILES
// =====================================================

export async function actionSyncBrokersWithProfiles() {
  try {
    console.log('[actionSyncBrokersWithProfiles] Starting sync...');
    
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
      return { ok: false as const, error: 'Solo Master puede ejecutar esta acción' };
    }

    const supabase = await getSupabaseAdmin();
    
    // Get all brokers
    const { data: brokers, error: brokersError } = await supabase
      .from('brokers')
      .select('id, p_id, name, email')
      .order('name', { ascending: true });

    if (brokersError || !brokers) {
      return { ok: false as const, error: brokersError?.message || 'No se encontraron brokers' };
    }

    console.log(`[actionSyncBrokersWithProfiles] Found ${brokers.length} brokers to sync`);

    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const broker of brokers) {
      if (!broker.p_id || !broker.name) {
        console.log(`[actionSyncBrokersWithProfiles] Skipping broker ${broker.id} - missing p_id or name`);
        continue;
      }

      try {
        // Update profiles.full_name with brokers.name
        const { error: syncError } = await supabase
          .from('profiles')
          .update({ full_name: broker.name })
          .eq('id', broker.p_id);

        if (syncError) {
          console.error(`[actionSyncBrokersWithProfiles] Error syncing broker ${broker.id}:`, syncError);
          errors.push(`${broker.name}: ${syncError.message}`);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (error: any) {
        console.error(`[actionSyncBrokersWithProfiles] Exception syncing broker ${broker.id}:`, error);
        errors.push(`${broker.name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`[actionSyncBrokersWithProfiles] Complete. Synced: ${syncedCount}, Errors: ${errorCount}`);

    revalidatePath('/brokers');
    revalidatePath('/', 'layout');

    return {
      ok: true as const,
      message: `Sincronización completa. ${syncedCount} brokers actualizados${errorCount > 0 ? `, ${errorCount} errores` : ''}`,
      syncedCount,
      errorCount,
      errors: errorCount > 0 ? errors : undefined
    };
  } catch (error: any) {
    console.error('Error in actionSyncBrokersWithProfiles:', error);
    return { ok: false as const, error: error.message };
  }
}
