/**
 * PÁGINA: RENOVACIONES LISSA (Oficina)
 * =====================================
 * Sección separada para manejar renovaciones de:
 * 1. Clientes asignados directamente a LISSA (contacto@lideresenseguros.com)
 * 2. Brokers que marcaron "recibir notificaciones de renovación"
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RenovacionesLissaClient from './RenovacionesLissaClient';

export const metadata = {
  title: 'Renovaciones LISSA | Portal Líderes',
  description: 'Gestión de renovaciones de oficina',
};

async function getRenovacionesLissa() {
  const supabase = await getSupabaseServer();

  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  // Verificar que sea Master
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    redirect('/dashboard');
  }

  // Obtener broker LISSA (contacto@lideresenseguros.com)
  const { data: lissaBroker } = await supabase
    .from('brokers')
    .select('id')
    .eq('email', 'contacto@lideresenseguros.com')
    .single();

  // Obtener brokers con notificaciones habilitadas
  const { data: brokersWithNotifications } = await supabase
    .from('brokers')
    .select('id, name, email')
    .eq('renewal_notifications', true)
    .eq('active', true);

  const brokerIds = [
    lissaBroker?.id,
    ...(brokersWithNotifications?.map((b: any) => b.id) || [])
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

  return {
    policies: policiesToRenew || [],
    cases: renewalCases || [],
    lissaBroker,
    brokersWithNotifications: brokersWithNotifications || [],
  };
}

export default async function RenovacionesLissaPage() {
  const data = await getRenovacionesLissa();

  return <RenovacionesLissaClient {...data} />;
}
