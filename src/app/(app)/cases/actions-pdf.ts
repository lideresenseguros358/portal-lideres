'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';

// =====================================================
// GET CASE DATA FOR PDF
// =====================================================

export async function actionGetCaseForPDF(caseId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    // Get case with all relations
    const { data: caseData, error } = await supabase
      .from('cases')
      .select(`
        *,
        broker:brokers!broker_id(name),
        insurer:insurers(name),
        client:clients(name)
      `)
      .eq('id', caseId)
      .single();

    if (error || !caseData) {
      return { ok: false as const, error: 'Caso no encontrado' };
    }

    // Get checklist
    const { data: checklist } = await supabase
      .from('case_checklist')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    // Get files
    const { data: files } = await supabase
      .from('case_files')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    // Get history
    const { data: history } = await supabase
      .from('case_history')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      ok: true as const,
      data: {
        ...caseData,
        checklist: checklist || [],
        files: files || [],
        history: history || [],
      },
    };
  } catch (error: any) {
    console.error('Error getting case for PDF:', error);
    return { ok: false as const, error: error.message };
  }
}

// =====================================================
// GET MULTIPLE CASES FOR CONSOLIDATED PDF
// =====================================================

export async function actionGetCasesForPDF(caseIds: string[]) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false as const, error: 'No autenticado' };
    }

    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        *,
        broker:brokers!broker_id(name),
        insurer:insurers(name),
        client:clients(name)
      `)
      .in('id', caseIds)
      .order('created_at', { ascending: false });

    if (error) {
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, data: cases || [] };
  } catch (error: any) {
    console.error('Error getting cases for PDF:', error);
    return { ok: false as const, error: error.message };
  }
}
