/**
 * DIAGNOSTICS ENDPOINT - UI Query Probe
 * ======================================
 * Ejecuta la MISMA query que usa la UI de Pendientes
 * para diagnosticar por qué no aparecen casos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Query EXACTA que usa la UI (sin filtros de broker para master)
    const { data: allCases, error: casesError } = await supabase
      .from('cases')
      .select(`
        *,
        brokers!broker_id(name),
        profiles!assigned_master_id(full_name, email)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (casesError) {
      return NextResponse.json({
        success: false,
        error: casesError.message,
        summary: `❌ Error en query de cases: ${casesError.message}`,
      }, { status: 500 });
    }

    // 2. Contar casos totales
    const totalCases = allCases?.length || 0;

    // 3. Agrupar por ramo_bucket (como hace la UI)
    const byBucket = {
      vida_assa: allCases?.filter(c => c.ramo_bucket === 'vida_assa').length || 0,
      ramos_generales: allCases?.filter(c => c.ramo_bucket === 'ramos_generales').length || 0,
      ramo_personas: allCases?.filter(c => c.ramo_bucket === 'ramo_personas').length || 0,
      desconocido: allCases?.filter(c => !c.ramo_bucket || c.ramo_bucket === 'desconocido').length || 0,
    };

    // 4. Agrupar por estado_simple
    const byEstado = {
      nuevo: allCases?.filter(c => c.estado_simple === 'Nuevo').length || 0,
      sin_clasificar: allCases?.filter(c => c.estado_simple === 'Sin clasificar').length || 0,
      en_proceso: allCases?.filter(c => c.estado_simple === 'En proceso').length || 0,
      pendiente_cliente: allCases?.filter(c => c.estado_simple === 'Pendiente cliente').length || 0,
      pendiente_broker: allCases?.filter(c => c.estado_simple === 'Pendiente broker').length || 0,
      enviado: allCases?.filter(c => c.estado_simple === 'Enviado').length || 0,
      aplazado: allCases?.filter(c => c.estado_simple === 'Aplazado').length || 0,
      cerrado_aprobado: allCases?.filter(c => c.estado_simple === 'Cerrado aprobado').length || 0,
      cerrado_rechazado: allCases?.filter(c => c.estado_simple === 'Cerrado rechazado').length || 0,
    };

    // 5. Listar últimos 10 casos (para debug)
    const latestCases = allCases?.slice(0, 10).map(c => ({
      id: c.id,
      ticket: c.ticket,
      estado_simple: c.estado_simple,
      ramo_bucket: c.ramo_bucket || 'null',
      broker_id: c.broker_id || 'null',
      created_at: c.created_at,
    })) || [];

    // 6. Verificar si hay casos con broker_id null
    const casesWithoutBroker = allCases?.filter(c => !c.broker_id).length || 0;

    const diagnosis = [];

    if (totalCases === 0) {
      diagnosis.push('⚠️ NO HAY CASOS EN LA TABLA - El problema es que no se están creando casos');
    } else {
      diagnosis.push(`✅ Hay ${totalCases} casos en la tabla`);
    }

    if (byBucket.desconocido > 0) {
      diagnosis.push(`✅ ${byBucket.desconocido} casos "Sin Clasificar" (ramo_bucket null o desconocido)`);
    }

    if (byEstado.sin_clasificar > 0) {
      diagnosis.push(`✅ ${byEstado.sin_clasificar} casos con estado "Sin clasificar"`);
    }

    if (casesWithoutBroker > 0) {
      diagnosis.push(`ℹ️ ${casesWithoutBroker} casos sin broker_id (clientes externos)`);
    }

    if (totalCases > 0 && byBucket.vida_assa === 0 && byBucket.ramos_generales === 0 && byBucket.ramo_personas === 0) {
      diagnosis.push('⚠️ TODOS los casos están en "Sin Clasificar" - El tab aparece solo si hay casos desconocidos');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalCases,
      byBucket,
      byEstado,
      casesWithoutBroker,
      latestCases,
      diagnosis,
      summary: totalCases === 0
        ? '❌ NO HAY CASOS en la tabla - El pipeline IMAP → CaseEngine NO está creando casos'
        : `✅ Hay ${totalCases} casos - UI debe mostrarlos en tabs correspondientes`,
      uiNote: 'La UI agrupa por ramo_bucket. Si todos están en "desconocido", solo aparece el tab "Sin Clasificar"',
    });
  } catch (error: any) {
    console.error('[DIAGNOSTICS UI] Error:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      summary: `❌ Error ejecutando UI probe: ${error.message}`,
    }, { status: 500 });
  }
}
