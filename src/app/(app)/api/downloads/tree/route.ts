import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Árbol completo de navegación de Descargas
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener todas las secciones con aseguradoras
    const { data: sections, error } = await supabase
      .from('download_sections')
      .select(`
        *,
        insurer:insurers (
          id,
          name,
          active
        )
      `)
      .order('display_order');

    if (error) throw error;

    // Construir árbol
    const tree: any = {
      generales: {},
      personas: {}
    };

    sections?.forEach((section: any) => {
      const scope = section.scope as 'generales' | 'personas';
      const policyType = section.policy_type;

      if (!tree[scope][policyType]) {
        tree[scope][policyType] = {
          insurers: [],
          sections: []
        };
      }

      if (section.insurer && section.insurer.active) {
        // Aseguradora específica
        const existingInsurer = tree[scope][policyType].insurers.find(
          (i: any) => i.id === section.insurer.id
        );

        if (!existingInsurer) {
          tree[scope][policyType].insurers.push({
            id: section.insurer.id,
            name: section.insurer.name,
            sections: [{
              id: section.id,
              name: section.name,
              display_order: section.display_order
            }]
          });
        } else {
          existingInsurer.sections.push({
            id: section.id,
            name: section.name,
            display_order: section.display_order
          });
        }
      } else {
        // Sección general (sin aseguradora)
        tree[scope][policyType].sections.push({
          id: section.id,
          name: section.name,
          display_order: section.display_order
        });
      }
    });

    return NextResponse.json({ success: true, tree });
  } catch (error) {
    console.error('Error fetching downloads tree:', error);
    return NextResponse.json({ error: 'Error al obtener árbol de descargas' }, { status: 500 });
  }
}
