import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

// GET - Obtener progreso de un caso
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('case_id');

    if (!caseId) {
      return NextResponse.json({ error: 'case_id es requerido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('case_progress')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ success: true, progress: data });
  } catch (error: any) {
    console.error('Error fetching case progress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear o actualizar progreso
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede actualizar progreso' }, { status: 403 });
    }

    const body = await request.json();
    const { case_id, current_step_number, total_steps, step_name, notes } = body;

    if (!case_id || !current_step_number || !total_steps || !step_name) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Verificar si ya existe progreso para este caso
    const { data: existing } = await supabase
      .from('case_progress')
      .select('id')
      .eq('case_id', case_id)
      .single();

    let result;
    if (existing) {
      // Actualizar
      const { data, error } = await supabase
        .from('case_progress')
        .update({
          current_step_number,
          total_steps,
          step_name,
          notes: notes || null,
          step_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('case_id', case_id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Crear
      const { data, error } = await supabase
        .from('case_progress')
        .insert([{
          case_id,
          current_step_number,
          total_steps,
          step_name,
          notes: notes || null,
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, progress: result });
  } catch (error: any) {
    console.error('Error updating case progress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Avanzar al siguiente paso
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede avanzar pasos' }, { status: 403 });
    }

    const body = await request.json();
    const { case_id, action } = body; // action: 'next', 'previous', 'complete'

    if (!case_id || !action) {
      return NextResponse.json({ error: 'case_id y action son requeridos' }, { status: 400 });
    }

    // Obtener progreso actual
    const { data: progress } = await supabase
      .from('case_progress')
      .select('*')
      .eq('case_id', case_id)
      .single();

    if (!progress) {
      return NextResponse.json({ error: 'Progreso no encontrado' }, { status: 404 });
    }

    let newStepNumber = progress.current_step_number;
    let stepCompletedAt = null;

    if (action === 'next' && progress.current_step_number < progress.total_steps) {
      newStepNumber = progress.current_step_number + 1;
    } else if (action === 'previous' && progress.current_step_number > 1) {
      newStepNumber = progress.current_step_number - 1;
    } else if (action === 'complete') {
      newStepNumber = progress.total_steps;
      stepCompletedAt = new Date().toISOString();
    }

    // Obtener nombre del nuevo paso
    const { data: caseData } = await (supabase as any)
      .from('cases')
      .select('policy_type, management_type')
      .eq('id', case_id)
      .single();

    const { data: stepData } = await supabase
      .from('workflow_steps')
      .select('step_name')
      .eq('ramo', caseData?.policy_type || 'AUTO')
      .eq('management_type', caseData?.management_type || 'EMISION')
      .eq('step_number', newStepNumber)
      .single();

    const { data, error } = await supabase
      .from('case_progress')
      .update({
        current_step_number: newStepNumber,
        step_name: stepData?.step_name || `Paso ${newStepNumber}`,
        step_started_at: new Date().toISOString(),
        step_completed_at: stepCompletedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', case_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, progress: data });
  } catch (error: any) {
    console.error('Error advancing case progress:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
