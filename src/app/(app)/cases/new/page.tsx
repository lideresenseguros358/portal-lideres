import { Suspense } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NewCaseWizard from '@/components/cases/NewCaseWizard';

export const metadata = {
  title: 'Nuevo Pendiente - Portal Líderes',
  description: 'Crear nuevo trámite o caso',
};

export default async function NewCasePage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile - only Master can create cases
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    redirect('/cases');
  }

  // Get brokers list with profiles
  const { data: brokersRaw } = await supabase
    .from('brokers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  // Get profiles for brokers
  const brokerIds = brokersRaw?.map(b => b.p_id) || [];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', brokerIds);

  // Merge brokers with profiles
  const brokers = brokersRaw?.map(broker => ({
    ...broker,
    profile: profilesData?.find(p => p.id === broker.p_id)
  })) || [];

  // Get clients list
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, national_id')
    .order('name', { ascending: true });

  // Get insurers list
  const { data: insurers } = await supabase
    .from('insurers')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
        </div>
      }>
        <NewCaseWizard
          brokers={brokers || []}
          clients={clients || []}
          insurers={insurers || []}
        />
      </Suspense>
    </div>
  );
}
