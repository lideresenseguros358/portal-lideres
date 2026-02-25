import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import AdmCotShell from '@/components/adm-cot/AdmCotShell';

export const metadata = {
  title: 'ADM COT | Portal Líderes',
  description: 'Módulo administrativo de cotizadores',
};

export default async function AdmCotLayout({ children }: { children: React.ReactNode }) {
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

  return <AdmCotShell>{children}</AdmCotShell>;
}
