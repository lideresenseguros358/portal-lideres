import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import ProductionMainClient from '@/components/production/ProductionMainClient';

export const metadata: Metadata = {
  title: 'Producción | Portal Líderes',
  description: 'Gestión de producción anual y concursos',
};

export default async function ProductionPage() {
  const supabase = await getSupabaseServer();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, broker_id, full_name')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    redirect('/login');
  }

  // Obtener lista de brokers para Master
  let brokers: any[] = [];
  if (profile.role === 'master') {
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('id, name')
      .order('name');
    
    brokers = brokersData || [];
  }

  return (
    <ProductionMainClient 
      userId={user.id}
      role={profile.role || 'broker'}
      brokerId={profile.role === 'master' ? null : profile.broker_id}
      brokers={brokers}
    />
  );
}
