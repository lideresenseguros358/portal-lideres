import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DownloadsMainClient from '@/components/downloads/DownloadsMainClient';

export const metadata = {
  title: 'Descargas | Portal Líderes',
  description: 'Repositorio de documentos por Ramo, Tipo y Aseguradora'
};

export default async function DownloadsPage() {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return <DownloadsMainClient />;
}
