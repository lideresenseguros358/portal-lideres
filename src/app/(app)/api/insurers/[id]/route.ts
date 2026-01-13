import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServer();
    const { id } = await params;

    const { data: insurer, error } = await supabase
      .from('insurers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching insurer:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener aseguradora' },
        { status: 500 }
      );
    }

    if (!insurer) {
      return NextResponse.json(
        { success: false, error: 'Aseguradora no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      insurer
    });
  } catch (error) {
    console.error('Error in GET /api/insurers/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
