import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GuidesMainClient from '@/components/guides/GuidesMainClient';
import { GuideSection } from '@/lib/guides/types';

export const metadata = {
  title: 'Guías | Portal Líderes',
  description: 'Material interno de estudio y soporte'
};

export default async function GuidesPage() {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Obtener perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isMaster = profile?.role === 'master';

  // Obtener secciones con count de archivos
  const { data: sections } = await supabase
    .from('guide_sections')
    .select(`
      *,
      guide_files (
        id,
        is_new,
        marked_new_until
      )
    `)
    .order('display_order');

  // Procesar para agregar counts
  const now = new Date();
  const sectionsWithCounts: GuideSection[] = sections?.map(section => {
    const files = section.guide_files || [];
    return {
      id: section.id,
      name: section.name,
      display_order: section.display_order,
      created_at: section.created_at,
      updated_at: section.updated_at,
      files_count: files.length,
      has_new_files: files.some((f: any) => 
        f.is_new && f.marked_new_until && new Date(f.marked_new_until) > now
      )
    };
  }) || [];

  return <GuidesMainClient initialSections={sectionsWithCounts} isMaster={isMaster} />;
}
