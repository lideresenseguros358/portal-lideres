import { Suspense } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CasesMainClient from '@/components/cases/CasesMainClient';

export const metadata = {
  title: 'Pendientes - Portal Líderes',
  description: 'Gestión de trámites y casos',
};

export default async function CasesPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Get brokers list (for Master filters)
  let brokers: any[] = [];
  if (profile.role === 'master') {
    const { data: brokersRaw } = await supabase
      .from('brokers')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });

    if (brokersRaw && brokersRaw.length > 0) {
      // Get profiles for brokers
      const brokerIds = brokersRaw.map(b => b.p_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', brokerIds);

      // Merge brokers with profiles
      brokers = brokersRaw.map(broker => ({
        ...broker,
        profiles: profilesData?.find(p => p.id === broker.p_id) || null
      }));
    }
  }

  // Get insurers list (for filters)
  const { data: insurers } = await supabase
    .from('insurers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    }>
      <CasesMainClient 
        userProfile={profile} 
        brokers={brokers}
        insurers={insurers || []}
      />
    </Suspense>
  );
}
