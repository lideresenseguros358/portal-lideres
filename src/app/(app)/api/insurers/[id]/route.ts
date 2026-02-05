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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServer();
    const { id } = await params;
    const body = await request.json();

    // Campos permitidos para actualizar
    const allowedFields = ['name', 'is_active', 'invert_negatives', 'has_delinquency_reports'];
    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    const { data: insurer, error } = await supabase
      .from('insurers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating insurer:', error);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar aseguradora' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      insurer
    });
  } catch (error) {
    console.error('Error in PUT /api/insurers/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Error del servidor' },
      { status: 500 }
    );
  }
}
