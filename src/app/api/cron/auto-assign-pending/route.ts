import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Cron Job: Auto-asignar pendientes antiguos
 * 
 * Pólizas sin identificar con más de 90 días se asignan automáticamente
 * al broker LISSA (contacto@lideresenseguros.com).
 * 
 * Flujo:
 * 1. Buscar pending_items con status='open' y created_at > 90 días
 * 2. Asignar assigned_broker_id = LISSA
 * 3. Migrar a comm_items (calcular gross_amount con percent_default de LISSA)
 * 4. Crear adjustment_report pre-aprobado para LISSA
 * 5. Crear registros en temp_client_import (preliminar) si no existen en policies ni en preliminar
 * 
 * Schedule: Diario a las 6:00 AM
 */
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Obtener broker LISSA (oficina)
    const OFICINA_EMAIL = 'contacto@lideresenseguros.com';
    const { data: lissaBroker, error: brokerError } = await supabase
      .from('brokers')
      .select('id, percent_default, name')
      .eq('email', OFICINA_EMAIL)
      .single();

    if (brokerError || !lissaBroker) {
      console.error('[CRON auto-assign] No se encontró broker LISSA:', brokerError);
      return NextResponse.json({ error: 'Broker LISSA no encontrado' }, { status: 500 });
    }

    console.log(`[CRON auto-assign] Broker LISSA: ${lissaBroker.name} (${lissaBroker.id})`);

    // 2. Buscar pending_items con más de 90 días sin asignar
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: oldItems, error: itemsError } = await supabase
      .from('pending_items')
      .select('id, policy_number, insured_name, insurer_id, commission_raw, import_id, created_at')
      .eq('status', 'open')
      .is('assigned_broker_id', null)
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (itemsError) {
      console.error('[CRON auto-assign] Error buscando pending_items:', itemsError);
      throw itemsError;
    }

    if (!oldItems || oldItems.length === 0) {
      console.log('[CRON auto-assign] No hay items pendientes con más de 90 días');
      return NextResponse.json({
        success: true,
        assigned: 0,
        message: 'No hay items pendientes antiguos',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[CRON auto-assign] Encontrados ${oldItems.length} items con más de 90 días`);

    const lissaPercent = lissaBroker.percent_default || 1.0;
    const itemIds = oldItems.map(item => item.id);

    // 3. Asignar todos a LISSA
    const { error: updateError } = await supabase
      .from('pending_items')
      .update({
        assigned_broker_id: lissaBroker.id,
        assigned_at: new Date().toISOString(),
        assignment_notes: 'Auto-asignado por sistema (90+ días sin identificar)',
      })
      .in('id', itemIds);

    if (updateError) {
      console.error('[CRON auto-assign] Error asignando broker:', updateError);
      throw updateError;
    }

    // 4. Migrar a comm_items (solo items que tienen import_id)
    let commItemsCreated = 0;
    let commItemsSkipped = 0;

    for (const item of oldItems) {
      // comm_items requiere import_id NOT NULL — si no tiene, solo marcar como migrado
      if (!item.import_id) {
        commItemsSkipped++;
        console.log(`[CRON auto-assign] ${item.policy_number}: sin import_id, omitiendo comm_items`);
      } else {
        const grossAmount = item.commission_raw * lissaPercent;

        const { data: newCommItem, error: insertError } = await supabase
          .from('comm_items')
          .insert({
            import_id: item.import_id,
            insurer_id: item.insurer_id!,
            policy_number: item.policy_number,
            broker_id: lissaBroker.id,
            gross_amount: grossAmount,
            insured_name: item.insured_name,
            raw_row: null,
          })
          .select('id')
          .single();

        if (insertError || !newCommItem) {
          console.error(`[CRON auto-assign] Error creando comm_item para ${item.policy_number}:`, insertError);
        } else {
          commItemsCreated++;
        }
      }

      // Marcar pending_item como migrado (siempre, ya fue asignado a LISSA)
      await supabase
        .from('pending_items')
        .update({ status: 'migrated' })
        .eq('id', item.id);
    }

    console.log(`[CRON auto-assign] ${commItemsCreated} comm_items creados, ${commItemsSkipped} sin import_id omitidos`);

    // 5. Crear adjustment_report pre-aprobado para LISSA (incluye TODOS los items)
    let reportId: string | null = null;
    if (oldItems.length > 0) {
      const totalBrokerCommission = oldItems.reduce((sum, item) => {
        return sum + (item.commission_raw * lissaPercent);
      }, 0);

      const { data: report, error: reportError } = await supabase
        .from('adjustment_reports')
        .insert({
          broker_id: lissaBroker.id,
          status: 'approved',
          total_amount: totalBrokerCommission,
          broker_notes: 'Auto-asignación por antigüedad (90+ días).',
          admin_notes: `CRON: ${oldItems.length} pólizas sin identificar por más de 90 días asignadas automáticamente a ${lissaBroker.name}. Total: $${totalBrokerCommission.toFixed(2)}.`,
          reviewed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (reportError) {
        console.error('[CRON auto-assign] Error creando adjustment_report:', reportError);
      } else if (report) {
        reportId = report.id;
        console.log(`[CRON auto-assign] Adjustment report creado: ${reportId}`);

        // Crear adjustment_report_items para TODOS los pending_items
        const reportItems = oldItems.map(item => ({
          report_id: reportId!,
          pending_item_id: item.id,
          commission_raw: item.commission_raw,
          broker_commission: item.commission_raw * lissaPercent,
        }));

        const { error: itemsInsertError } = await supabase
          .from('adjustment_report_items')
          .insert(reportItems);

        if (itemsInsertError) {
          console.error('[CRON auto-assign] Error creando adjustment_report_items:', itemsInsertError);
        } else {
          console.log(`[CRON auto-assign] ${reportItems.length} adjustment_report_items creados`);
        }
      }
    }

    // 6. Crear registros en temp_client_import (preliminar) para pólizas que no existen en BD
    let preliminarCreated = 0;
    const policyNumbers = oldItems.map(i => i.policy_number).filter(Boolean);

    if (policyNumbers.length > 0) {
      // Verificar cuáles ya existen en policies (BD real)
      const { data: existingPolicies } = await supabase
        .from('policies')
        .select('policy_number')
        .in('policy_number', policyNumbers);
      const existingInPolicies = new Set((existingPolicies || []).map(p => p.policy_number));

      // Verificar cuáles ya existen en temp_client_import (preliminar)
      const { data: existingPrelim } = await supabase
        .from('temp_client_import')
        .select('policy_number')
        .in('policy_number', policyNumbers);
      const existingInPrelim = new Set((existingPrelim || []).map((p: any) => p.policy_number));

      const prelimRecords: any[] = [];
      const seenPolicies = new Set<string>();

      for (const item of oldItems) {
        const pn = item.policy_number;
        if (!pn) continue;
        if (existingInPolicies.has(pn)) continue;
        if (existingInPrelim.has(pn)) continue;
        if (seenPolicies.has(pn)) continue;

        seenPolicies.add(pn);
        prelimRecords.push({
          broker_id: lissaBroker.id,
          client_name: item.insured_name || 'POR COMPLETAR',
          policy_number: pn,
          insurer_id: item.insurer_id,
          source: 'cron_auto_assign',
          status: 'ACTIVA',
          migrated: false,
          notes: `Auto-asignado a oficina por antigüedad (90+ días). ${new Date().toLocaleDateString('es-PA')}.`,
        });
      }

      if (prelimRecords.length > 0) {
        const { error: prelimError } = await supabase
          .from('temp_client_import')
          .insert(prelimRecords);

        if (prelimError) {
          console.error('[CRON auto-assign] Error creando preliminar:', prelimError);
        } else {
          preliminarCreated = prelimRecords.length;
          console.log(`[CRON auto-assign] ${preliminarCreated} registros preliminares creados`);
        }
      }
    }

    const summary = {
      success: true,
      assigned: oldItems.length,
      comm_items_created: commItemsCreated,
      comm_items_skipped_no_import: commItemsSkipped,
      report_id: reportId,
      preliminar_created: preliminarCreated,
      skipped_existing: policyNumbers.length - preliminarCreated,
      timestamp: new Date().toISOString(),
    };

    console.log('[CRON auto-assign] ✅ Completado:', JSON.stringify(summary));

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[CRON auto-assign] ❌ Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
