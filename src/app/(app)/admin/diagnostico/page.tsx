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
  let diagnosticRuns: any[] = [];
  let migrationNeeded = false;
  
  try {
    const { data, error } = await (supabase as any)
      .from('diagnostic_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    
    if (error) {
      // Si la tabla no existe (code 42P01), necesitamos aplicar migration
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[DIAGNOSTICO] Tabla diagnostic_runs no existe - migration necesaria');
        migrationNeeded = true;
      } else {
        console.error('[DIAGNOSTICO] Error query diagnostic_runs:', error);
      }
    } else {
      diagnosticRuns = data || [];
    }
  } catch (err) {
    console.error('[DIAGNOSTICO] Error inesperado:', err);
  }

  return <DiagnosticoClient 
    diagnosticRuns={diagnosticRuns} 
    migrationNeeded={migrationNeeded}
  />;
}
