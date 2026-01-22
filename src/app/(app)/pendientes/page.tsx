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

  // Query base para casos
  let casosQuery = supabase
    .from('cases')
    .select(`
      *,
      brokers!broker_id(name),
      profiles!assigned_master_id(full_name, email)
    `)
    .is('deleted_at', null)
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
