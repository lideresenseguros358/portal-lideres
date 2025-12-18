/**
 * Procesador de importaciones de Códigos ASSA
 * Maneja la lógica especial de distribución por código PJ750-xxx
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { parseAssaCodigosExcel } from '@/lib/parsers/assa-codigos-parser';
import type { TablesInsert } from '@/lib/supabase/server';

type CommItemIns = TablesInsert<'comm_items'>;
type CommImportIns = TablesInsert<'comm_imports'>;

interface ProcessAssaCodigosResult {
  ok: boolean;
  error?: string;
  data?: {
    import_id: string;
    items_created: number;
    total_amount: number;
  };
}

/**
 * Procesa un archivo de Códigos ASSA y crea los registros correspondientes
 */
export async function processAssaCodigosImport(
  file: File,
  parsed: {
    fortnight_id: string;
    total_amount: string;
  },
  userId: string,
  supabase: any,
  bankTransferId: string | null,
  bankGroupIds: string[]
): Promise<ProcessAssaCodigosResult> {
  try {
    console.log('[ASSA_CODIGOS] Starting import process');
    
    // 1. Parsear archivo Excel
    const buffer = await file.arrayBuffer();
    let codigosRows;
    
    try {
      codigosRows = parseAssaCodigosExcel(buffer);
    } catch (parseError) {
      console.error('[ASSA_CODIGOS] Parse error:', parseError);
      return { 
        ok: false, 
        error: `Error al parsear archivo: ${parseError instanceof Error ? parseError.message : 'Formato incorrecto'}` 
      };
    }

    if (codigosRows.length === 0) {
      return { 
        ok: false, 
        error: 'No se encontraron códigos válidos en el archivo. Verifica que contenga códigos PJ750-xxx con comisiones.' 
      };
    }

    console.log('[ASSA_CODIGOS] Parsed rows:', codigosRows.length);

    // 2. Obtener aseguradora ASSA real
    const { data: assaInsurer } = await supabase
      .from('insurers')
      .select('id')
      .ilike('name', 'ASSA')
      .single();

    if (!assaInsurer) {
      return { ok: false, error: 'No se encontró la aseguradora ASSA en el sistema' };
    }

    const assaInsurerId = assaInsurer.id;

    // 3. Obtener mapeo de códigos a brokers
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id, name, assa_code, percent_default')
      .not('assa_code', 'is', null);

    // Crear mapa de código -> broker
    const codeMap = new Map<string, { id: string; name: string; percent_default: number }>();
    (brokers || []).forEach((broker: any) => {
      if (broker.assa_code) {
        codeMap.set(broker.assa_code.toUpperCase(), {
          id: broker.id,
          name: broker.name,
          percent_default: broker.percent_default || 0
        });
      }
    });

    console.log('[ASSA_CODIGOS] Brokers with ASSA codes:', codeMap.size);

    // 4. Obtener usuario LISSA (contacto@lideresenseguros.com) para códigos huérfanos
    const { data: lissaProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();

    if (!lissaProfile) {
      return { ok: false, error: 'No se encontró el perfil LISSA (contacto@lideresenseguros.com) en el sistema' };
    }

    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id, name')
      .eq('p_id', lissaProfile.id)
      .single();

    if (!lissaBroker) {
      return { ok: false, error: 'No se encontró el corredor LISSA para códigos huérfanos' };
    }

    // 5. Calcular monto total
    const totalAmount = codigosRows.reduce((sum, row) => sum + row.comision_pagada, 0);

    // 6. Crear registro de importación
    const { data: importRecord, error: importError } = await supabase
      .from('comm_imports')
      .insert([{
        insurer_id: assaInsurerId,
        period_label: parsed.fortnight_id,
        uploaded_by: userId,
        total_amount: totalAmount,
        is_life_insurance: false, // Códigos ASSA no son vida
      }])
      .select()
      .single();

    if (importError) {
      console.error('[ASSA_CODIGOS] Import creation error:', importError);
      return { ok: false, error: 'Error al crear registro de importación' };
    }

    console.log('[ASSA_CODIGOS] Import record created:', importRecord.id);

    // 7. Vincular con transferencia bancaria o grupos si se proporcionó
    if (bankTransferId) {
      await supabase
        .from('bank_transfer_imports')
        .insert([{
          transfer_id: bankTransferId,
          import_id: importRecord.id,
          amount_assigned: totalAmount
        }]);
      
      console.log('[ASSA_CODIGOS] Linked to bank transfer:', bankTransferId);
    }

    if (bankGroupIds && bankGroupIds.length > 0) {
      const groupImports = bankGroupIds.map((groupId: string) => ({
        group_id: groupId,
        import_id: importRecord.id,
        amount_assigned: totalAmount / bankGroupIds.length // Distribuir equitativamente entre grupos
      }));

      await supabase
        .from('bank_group_imports')
        .insert(groupImports);
      
      console.log('[ASSA_CODIGOS] Linked to bank groups:', bankGroupIds.length);
    }

    // 8. Crear items con mapeo a brokers
    const itemsToInsert: CommItemIns[] = [];
    let orphanCount = 0;

    for (const row of codigosRows) {
      const codigo = row.licencia.toUpperCase();
      const broker = codeMap.get(codigo);

      // Determinar porcentaje: 100% para todos excepto PJ750-20 que usa default_percent
      let percentApplied: number;
      let brokerId: string;
      let brokerName: string;

      if (codigo === 'PJ750-20' && broker) {
        // PJ750-20 usa el percent_default del broker asignado
        percentApplied = broker.percent_default;
        brokerId = broker.id;
        brokerName = broker.name;
        console.log(`[ASSA_CODIGOS] ${codigo} -> ${broker.name} (${percentApplied}% - default)`);
      } else if (broker) {
        // Código tiene broker asignado: 100%
        percentApplied = 100;
        brokerId = broker.id;
        brokerName = broker.name;
        console.log(`[ASSA_CODIGOS] ${codigo} -> ${broker.name} (100%)`);
      } else {
        // Código huérfano: va a LISSA al 100%
        percentApplied = 100;
        brokerId = lissaBroker.id;
        brokerName = `${lissaBroker.name} (Huérfano: ${codigo})`;
        orphanCount++;
        console.log(`[ASSA_CODIGOS] ${codigo} -> LISSA (100% - huérfano)`);
      }

      const grossAmount = row.comision_pagada;

      itemsToInsert.push({
        import_id: importRecord.id,
        insurer_id: assaInsurerId,
        policy_number: codigo,
        insured_name: `Código ${codigo}`,
        gross_amount: grossAmount,
        broker_id: brokerId,
        raw_row: {
          licencia: codigo,
          comision_pagada: grossAmount,
          percent_applied: percentApplied,
          broker_name: brokerName,
          is_orphan: !broker
        }
      });
    }

    // 9. Insertar items en lotes
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
      const batch = itemsToInsert.slice(i, i + batchSize);
      const { error: itemsError } = await supabase
        .from('comm_items')
        .insert(batch);

      if (itemsError) {
        console.error('[ASSA_CODIGOS] Items insertion error:', itemsError);
        return { 
          ok: false, 
          error: `Error al insertar items (batch ${Math.floor(i / batchSize) + 1}): ${itemsError.message}` 
        };
      }

      totalInserted += batch.length;
      console.log(`[ASSA_CODIGOS] Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} items`);
    }

    console.log('[ASSA_CODIGOS] Total items inserted:', totalInserted);
    console.log('[ASSA_CODIGOS] Orphan codes (assigned to LISSA):', orphanCount);

    return {
      ok: true,
      data: {
        import_id: importRecord.id,
        items_created: totalInserted,
        total_amount: totalAmount
      }
    };

  } catch (error) {
    console.error('[ASSA_CODIGOS] Unexpected error:', error);
    return { 
      ok: false, 
      error: `Error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}` 
    };
  }
}
