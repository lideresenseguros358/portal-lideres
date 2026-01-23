import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import DiagnosticoClient from './DiagnosticoClient';

export const metadata = {
  title: 'Diagnóstico del Sistema | Portal Líderes',
  description: 'Panel de diagnóstico y testing del flujo IMAP/SMTP/Vertex/CaseEngine',
};

export default async function DiagnosticoPage() {
  const supabase = await getSupabaseServer();

  // Verificar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verificar que es master
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    redirect('/'); // Solo master puede acceder
  }

  // Obtener últimas 20 ejecuciones de diagnóstico
  const { data: diagnosticRuns } = await (supabase as any)
    .from('diagnostic_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20);

  return <DiagnosticoClient diagnosticRuns={diagnosticRuns || []} />;
}
