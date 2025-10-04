import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RequestsMainClient from '@/components/requests/RequestsMainClient';

export const metadata = {
  title: 'Solicitudes | Portal Líderes',
  description: 'Gestión de solicitudes de nuevos usuarios'
};

export default async function RequestsPage() {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Solo Master puede acceder
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    redirect('/dashboard');
  }

  return <RequestsMainClient />;
}
