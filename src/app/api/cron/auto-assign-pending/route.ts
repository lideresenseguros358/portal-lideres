import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Cron Job: Auto-asignar pendientes antiguos
 * 
 * Pólizas sin identificar con más de 90 días se asignan automáticamente
 * al broker LISSA (contacto@lideresenseguros.com) y se registran
 * directamente en la base de datos real (clients + policies).
 * 
 * Flujo DIRECTO (sin ajustes, sin preliminar):
 * 1. Buscar pending_items con status='open' y created_at > 90 días
 * 2. Asignar assigned_broker_id = LISSA
 * 3. Para cada póliza que NO exista en BD:
 *    a. Crear o reutilizar cliente en tabla clients
 *    b. Crear póliza en tabla policies
 * 4. Marcar pending_items como 'migrated'
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
      .select('id, policy_number, insured_name, insurer_id, commission_raw, created_at')
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

    const itemIds = oldItems.map(item => item.id);

    // 3. Asignar todos a LISSA en pending_items
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

    // 4. Registrar directamente en BD real (clients + policies)
    //    Agrupar por policy_number para evitar duplicados
    const policyMap = new Map<string, typeof oldItems[0]>();
    for (const item of oldItems) {
      if (!policyMap.has(item.policy_number)) {
        policyMap.set(item.policy_number, item);
      }
    }

    // Verificar cuáles ya existen en policies
    const policyNumbers = Array.from(policyMap.keys());
    const { data: existingPolicies } = await supabase
      .from('policies')
      .select('policy_number')
      .in('policy_number', policyNumbers);
    const existingInPolicies = new Set((existingPolicies || []).map(p => p.policy_number));

    let clientsCreated = 0;
    let clientsReused = 0;
    let policiesCreated = 0;
    let policiesSkipped = 0;

    for (const [policyNumber, item] of policyMap) {
      // Si la póliza ya existe en BD, saltar
      if (existingInPolicies.has(policyNumber)) {
        policiesSkipped++;
        console.log(`[CRON auto-assign] ${policyNumber}: ya existe en BD, omitiendo`);
        continue;
      }

      const clientName = item.insured_name || 'POR COMPLETAR';

      // 4a. Buscar o crear cliente
      let clientId: string;

      // Buscar cliente existente por nombre + broker LISSA
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('broker_id', lissaBroker.id)
        .ilike('name', clientName)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
        clientsReused++;
      } else {
        // Crear nuevo cliente
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: clientName,
            broker_id: lissaBroker.id,
          })
          .select('id')
          .single();

        if (clientError || !newClient) {
          console.error(`[CRON auto-assign] Error creando cliente para ${policyNumber}:`, clientError);
          continue;
        }

        clientId = newClient.id;
        clientsCreated++;
      }

      // 4b. Crear póliza
      const { error: policyError } = await supabase
        .from('policies')
        .insert({
          policy_number: policyNumber,
          client_id: clientId,
          broker_id: lissaBroker.id,
          insurer_id: item.insurer_id!,
          notas: `Registrado automáticamente por antigüedad (90+ días sin identificar). ${new Date().toLocaleDateString('es-PA', { timeZone: 'America/Panama' })}.`,
        });

      if (policyError) {
        console.error(`[CRON auto-assign] Error creando póliza ${policyNumber}:`, policyError);
        continue;
      }

      policiesCreated++;
      console.log(`[CRON auto-assign] ✅ ${policyNumber} → cliente: ${clientName}, póliza creada`);
    }

    // 5. Marcar TODOS los pending_items como migrados
    const { error: migrateError } = await supabase
      .from('pending_items')
      .update({ status: 'migrated' })
      .in('id', itemIds);

    if (migrateError) {
      console.error('[CRON auto-assign] Error marcando como migrados:', migrateError);
    }

    const summary = {
      success: true,
      items_found: oldItems.length,
      unique_policies: policyMap.size,
      clients_created: clientsCreated,
      clients_reused: clientsReused,
      policies_created: policiesCreated,
      policies_skipped_existing: policiesSkipped,
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
