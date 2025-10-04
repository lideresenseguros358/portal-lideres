import { Suspense } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BrokersListClient from '@/components/brokers/BrokersListClient';

export const metadata = {
  title: 'Corredores - Portal Líderes',
  description: 'Gestión de corredores',
};

export default async function BrokersPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile - only Master can access
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    redirect('/dashboard');
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    }>
      <BrokersListClient />
    </Suspense>
  );
}
