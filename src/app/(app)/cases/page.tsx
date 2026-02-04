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

  // ============ RENOVACIONES LISSA (solo Master) ============
  let renovacionesData = null;
  if (profile.role === 'master') {
    // Obtener broker LISSA
    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();

    // Obtener brokers con notificaciones habilitadas
    const { data: allBrokers } = await supabase
      .from('brokers')
      .select('id, name, email, p_id, profiles!p_id(notify_broker_renewals)')
      .eq('active', true);

    const brokersWithNotifications = (allBrokers || []).filter((b: any) => 
      b.profiles?.notify_broker_renewals === true
    );

    const brokerIds = [
      lissaBroker?.id,
      ...brokersWithNotifications.map((b: any) => b.id)
    ].filter((id): id is string => id !== undefined && id !== null);

    // Obtener pólizas próximas a renovar (30 días)
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const { data: policiesToRenew } = await supabase
      .from('policies')
      .select(`
        id,
        policy_number,
        renewal_date,
        start_date,
        ramo,
        broker_id,
        client_id,
        insurer_id,
        clients!client_id(id, name, email, phone, national_id),
        insurers!insurer_id(name),
        brokers!broker_id(id, name, email)
      `)
      .in('broker_id', brokerIds)
      .gte('renewal_date', today.toISOString().split('T')[0])
      .lte('renewal_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .eq('status', 'ACTIVA')
      .order('renewal_date', { ascending: true });

    // Obtener casos de renovación existentes
    const { data: renewalCases } = await supabase
      .from('cases')
      .select('*, policies(*), clients(*), brokers(*)')
      .in('broker_id', brokerIds.length > 0 ? brokerIds : ['none'])
      .ilike('notes', '%renovar%')
      .neq('status', 'CERRADO')
      .order('created_at', { ascending: false });

    renovacionesData = {
      policies: policiesToRenew || [],
      cases: renewalCases || [],
      lissaBroker,
      brokersWithNotifications: brokersWithNotifications || [],
    };
  }

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
        renovacionesData={renovacionesData}
      />
    </Suspense>
  );
}
