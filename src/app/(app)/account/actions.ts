'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TablesUpdate } from '@/lib/database.types';
import { revalidatePath } from 'next/cache';

interface UpdateProfileParams {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
}

export async function actionUpdateProfile(params: UpdateProfileParams) {
  try {
    console.log('[actionUpdateProfile] Starting update');
    console.log('[actionUpdateProfile] Params:', { fullName: params.fullName, email: params.email, phone: params.phone, hasAvatar: !!params.avatarUrl });

    // ====== AUTHENTICATION ======
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const supabase = await getSupabaseAdmin();

    // ====== CHECK BROKER PROFILE ======
    const { data: broker } = await supabase
      .from('brokers')
      .select('id')
      .eq('p_id', user.id)
      .single();

    console.log('[actionUpdateProfile] Broker exists:', !!broker);

    // ====== UPDATE PROFILES TABLE ======
    console.log('[actionUpdateProfile] Updating profiles...');
    const profileUpdates: TablesUpdate<'profiles'> = {
      full_name: params.fullName,
      email: params.email,
      avatar_url: params.avatarUrl || null,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id);

    if (profileError) {
      console.error('[actionUpdateProfile] Profile error:', profileError);
      return { ok: false as const, error: profileError.message };
    }

    // ====== SYNC TO BROKERS TABLE ======
    const syncErrors: string[] = [];
    
    if (broker) {
      console.log('[actionUpdateProfile] Syncing to brokers...');
      const brokerUpdates: TablesUpdate<'brokers'> = {
        name: params.fullName,
        email: params.email,
        phone: params.phone || null,
      };

      const { error: brokerError } = await supabase
        .from('brokers')
        .update(brokerUpdates)
        .eq('p_id', user.id);

      if (brokerError) {
        console.error('[actionUpdateProfile] Broker sync error:', brokerError);
        syncErrors.push('brokers: ' + brokerError.message);
      }
    }

    // ====== SYNC TO AUTH.USERS ======
    if (params.email !== user.email) {
      console.log('[actionUpdateProfile] Syncing email to auth.users...');
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email: params.email }
      );

      if (authError) {
        console.error('[actionUpdateProfile] Auth sync error:', authError);
        syncErrors.push('auth: ' + authError.message);
      }
    }

    // ====== REVALIDATE PATHS ======
    revalidatePath('/account');
    revalidatePath('/brokers');
    revalidatePath('/', 'layout');

    console.log('[actionUpdateProfile] Complete! Sync errors:', syncErrors.length);
    
    return { 
      ok: true as const,
      warnings: syncErrors.length > 0 ? syncErrors : undefined
    };
  } catch (error: any) {
    console.error('[actionUpdateProfile] Unexpected error:', error);
    return { ok: false as const, error: error.message };
  }
}

export async function actionResetMustChangePassword() {
  try {
    console.log('[actionResetMustChangePassword] Starting reset');

    // ====== AUTHENTICATION ======
    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const supabase = await getSupabaseAdmin();

    // ====== RESET must_change_password FLAG ======
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (updateError) {
      console.error('[actionResetMustChangePassword] Error:', updateError);
      return { ok: false as const, error: updateError.message };
    }

    console.log('[actionResetMustChangePassword] Flag reset successfully for user:', user.id);

    // ====== REVALIDATE PATHS ======
    revalidatePath('/account');
    revalidatePath('/', 'layout');

    return { ok: true as const };
  } catch (error: any) {
    console.error('[actionResetMustChangePassword] Unexpected error:', error);
    return { ok: false as const, error: error.message };
  }
}
