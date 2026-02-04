import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import PendientesClient from './PendientesClient';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Pendientes | Portal Líderes',
  description: 'Gestión de casos y trámites pendientes',
};

async function PendientesContent() {
  const supabase = await getSupabaseServer();

  // Verificar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Obtener perfil del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, brokers(id, name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  const isMaster = profile.role === 'master';
  const brokerId = profile.broker_id;

  // ============ RENOVACIONES LISSA (solo Master) ============
  let renovacionesData = null;
  if (isMaster) {
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

  // Query base para casos
  let casosQuery = supabase
    .from('cases')
    .select(`
      *,
      brokers!broker_id(name),
      profiles!assigned_master_id(full_name, email)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  // Filtrar por broker si no es master
  if (!isMaster && brokerId) {
    casosQuery = casosQuery.eq('broker_id', brokerId);
  }

  const { data: casos, error } = await casosQuery;

  if (error) {
    console.error('Error fetching casos:', error);
  }

  // Obtener conteo de correos por caso (simplificado)
  // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
  const { data: emailCounts } = await supabase
    .from('case_emails')
    .select('case_id, inbound_email_id')
    .in('case_id', casos?.map(c => c.id) || []);

  // Agregar conteo a casos
  const casosConConteo = (casos || []).map(caso => ({
    ...caso,
    emails_count: emailCounts?.filter(e => e.case_id === caso.id).length || 0,
  }));

  return (
    <PendientesClient
      casos={casosConConteo}
      isMaster={isMaster}
      userId={user.id}
      userRole={profile.role || 'broker'}
      renovacionesData={renovacionesData}
    />
  );
}

export default function PendientesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-[#8AAA19]" />
          </div>
        }
      >
        <PendientesContent />
      </Suspense>
    </div>
  );
}
