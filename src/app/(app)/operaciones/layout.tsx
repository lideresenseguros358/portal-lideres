import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import OperacionesShell from '@/components/operaciones/OperacionesShell';

export const metadata = {
  title: 'Operaciones | Portal Líderes',
  description: 'Centro de operaciones y gestión integral',
};

export default async function OperacionesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    redirect('/dashboard');
  }

  return <OperacionesShell>{children}</OperacionesShell>;
}
