import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import ConfigMainClient from '@/components/config/ConfigMainClient';

export const metadata: Metadata = {
  title: 'Configuración | Portal Líderes',
  description: 'Panel de control maestro del sistema',
};

export default async function ConfigPage() {
  const supabase = await getSupabaseServer();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Verify user is Master
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (profile?.role !== 'master') {
    redirect('/dashboard');
  }
  
  return <ConfigMainClient userId={user.id} />;
}
