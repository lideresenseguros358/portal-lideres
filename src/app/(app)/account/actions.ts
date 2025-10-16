'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

interface UpdateProfileParams {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
}

export async function actionUpdateProfile(params: UpdateProfileParams) {
  try {
    console.log('[actionUpdateProfile] Starting profile update');
    console.log('[actionUpdateProfile] Params:', { ...params, avatarUrl: params.avatarUrl ? 'has value' : 'null' });

    const supabaseServer = await getSupabaseServer();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      console.log('[actionUpdateProfile] No user authenticated');
      return { ok: false as const, error: 'No autenticado' };
    }

    console.log('[actionUpdateProfile] User ID:', user.id);

    const supabase = await getSupabaseAdmin();

    // Check if user has a broker profile
    const { data: broker } = await supabase
      .from('brokers')
      .select('id')
      .eq('p_id', user.id)
      .single();

    console.log('[actionUpdateProfile] Broker exists:', !!broker);

    // Update profiles table
    console.log('[actionUpdateProfile] Updating profiles table...');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: params.fullName,
        email: params.email,
        avatar_url: params.avatarUrl || null,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[actionUpdateProfile] Error updating profile:', profileError);
      return { ok: false as const, error: profileError.message };
    }
    console.log('[actionUpdateProfile] ✅ Profile updated');

    // Update brokers table if broker exists
    if (broker) {
      console.log('[actionUpdateProfile] Updating brokers table...');
      const { error: brokerError } = await supabase
        .from('brokers')
        .update({
          name: params.fullName,  // Sync full_name → name
          email: params.email,    // Sync email → email
          phone: params.phone     // Update phone
        })
        .eq('p_id', user.id);

      if (brokerError) {
        console.error('[actionUpdateProfile] Error updating broker:', brokerError);
        return { ok: false as const, error: brokerError.message };
      }
      console.log('[actionUpdateProfile] ✅ Broker updated');
    }

    // Update auth.users email if changed
    if (params.email !== user.email) {
      console.log('[actionUpdateProfile] Updating auth.users email...');
      const { error: authError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email: params.email }
      );

      if (authError) {
        console.error('[actionUpdateProfile] Error updating auth email:', authError);
        return { ok: false as const, error: authError.message };
      }
      console.log('[actionUpdateProfile] ✅ Auth email updated');
    }

    // Revalidate paths
    console.log('[actionUpdateProfile] Revalidating paths...');
    revalidatePath('/account');
    revalidatePath('/brokers');
    revalidatePath('/', 'layout'); // Update navbar

    console.log('[actionUpdateProfile] ✅ Profile update complete');
    return { ok: true as const };
  } catch (error: any) {
    console.error('[actionUpdateProfile] Error:', error);
    return { ok: false as const, error: error.message };
  }
}
