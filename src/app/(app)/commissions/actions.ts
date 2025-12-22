'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/db/context';
import {
  UploadImportSchema,
  CreateDraftSchema,
  ResolvePendingSchema,
  AdvanceSchema,
  ToggleNotifySchema,
} from '@/lib/commissions/schemas';
import { calculateDiscounts } from '@/lib/commissions/rules';
import { buildBankACH } from '@/lib/commissions/bankACH';
import { parseCsvXlsx } from '@/lib/commissions/importers';
import { processDocumentOCR } from '@/lib/services/vision-ocr';
import { getInsurerSlug, getPolicySearchTerm } from '@/lib/utils/policy-number';
import { processAssaCodigosImport } from './assa-codigos-processor';

// Type for action results
interface ActionResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

type FortnightRow = Tables<'fortnights'>;
type FortnightIns = TablesInsert<'fortnights'>;
type FortnightUpd = TablesUpdate<'fortnights'>;
type FortnightBrokerTotalRow = Tables<'fortnight_broker_totals'>;
type FortnightBrokerTotalIns = TablesInsert<'fortnight_broker_totals'>;
type CommImportRow = Tables<'comm_imports'>;
type CommImportIns = TablesInsert<'comm_imports'>;
type CommItemRow = Tables<'comm_items'>;
type CommItemIns = TablesInsert<'comm_items'>;
type CommItemUpd = TablesUpdate<'comm_items'>;
type PendingItemRow = Tables<'pending_items'>;
type PendingItemUpd = TablesUpdate<'pending_items'>;
type AdvanceRow = Tables<'advances'>;
type AdvanceIns = TablesInsert<'advances'>;
type AdvanceLogRow = Tables<'advance_logs'>;
type AdvanceLogIns = TablesInsert<'advance_logs'>;

/**
 * Upload and import commission file (CSV/XLSX/PDF)
 */
export async function actionUploadImport(formData: FormData) {
  try {
    console.log('[SERVER] actionUploadImport called');
    const file = formData.get('file') as File;
    const rawData = {
      insurer_id: String(formData.get('insurer_id') || ''),
      total_amount: String(formData.get('total_amount') || '0'),
      fortnight_id: String(formData.get('fortnight_id') || ''),
      invert_negatives: String(formData.get('invert_negatives') || 'false'),
      is_life_insurance: String(formData.get('is_life_insurance') || 'false'),
    };
    
    // Extraer bank_transfer_id o bank_group_ids del FormData
    const bankTransferId = formData.get('bank_transfer_id') as string | null;
    const bankGroupIdsStr = formData.get('bank_group_ids') as string | null;
    const bankGroupIds = bankGroupIdsStr ? JSON.parse(bankGroupIdsStr) : [];

    console.log('[SERVER] FormData:', { ...rawData, fileName: file?.name });

    // Detectar ASSA_CODIGOS ANTES de validar (no es un UUID válido)
    const isAssaCodigos = rawData.insurer_id === 'ASSA_CODIGOS';
    
    if (!file) {
      return { ok: false as const, error: 'Archivo requerido' };
    }

    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    // Manejar ASSA_CODIGOS sin validación de schema (no tiene insurer_id UUID)
    if (isAssaCodigos) {
      console.log('[SERVER] Detected ASSA_CODIGOS import');
      const parsedSpecial = {
        fortnight_id: rawData.fortnight_id,
        total_amount: rawData.total_amount,
        insurer_id: 'ASSA_CODIGOS',
        invert_negatives: rawData.invert_negatives,
        is_life_insurance: rawData.is_life_insurance,
      };
      return await processAssaCodigosImport(file, parsedSpecial, userId, supabase, bankTransferId, bankGroupIds);
    }

    // Validate input para aseguradoras normales
    const parsed = UploadImportSchema.parse(rawData);
    console.log('[SERVER] Validation passed:', parsed);
    
    console.log('[SERVER] Parsing file...');

    const { data: insurerForFile } = await supabase
      .from('insurers')
      .select('name')
      .eq('id', parsed.insurer_id)
      .single();

    const insurerName = String((insurerForFile as any)?.name || '').toUpperCase();
    const slug = getInsurerSlug(insurerName);
    const isPdfWithSpecialParser = file.name.toLowerCase().endsWith('.pdf') &&
      (
        slug === 'banesco' ||
        slug === 'mercantil' ||
        slug === 'sura' ||
        slug === 'regional' ||
        slug === 'acerta' ||
        slug === 'general' ||
        slug === 'univivir' ||
        slug === 'ww-medical' ||
        slug === 'ifs' ||
        slug === 'optima' ||
        slug === 'mb' ||
        slug === 'aliado' ||
        slug === 'palig' ||
        slug === 'vumi'
      );

    const isAssistcardImage =
      slug === 'assistcard' &&
      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(file.name.toLowerCase().split('.').pop() || '');
    
    // Helper to check if file requires OCR
    const requiresOCR = (fileName: string): boolean => {
      const extension = fileName.toLowerCase().split('.').pop();
      const ocrExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'pdf'];
      return ocrExtensions.includes(extension || '');
    };
    
    // Verificar si el archivo requiere OCR (imagen o PDF)
    let processedFile: File = file;
    const needsOCR = requiresOCR(file.name);
    
    if (needsOCR && !isPdfWithSpecialParser) {
      if (isAssistcardImage) {
        console.log('[SERVER] ASSISTCARD image detected - skipping generic OCR-to-XLSX conversion');
      } else {
      console.log('[SERVER] File requires OCR processing:', file.name);
      
      // Procesar con OCR
      const arrayBuffer = await file.arrayBuffer();
      const ocrResult = await processDocumentOCR(arrayBuffer, file.name);
      
      if (!ocrResult.success || !ocrResult.xlsxBuffer) {
        return {
          ok: false as const,
          error: `Error en OCR: ${ocrResult.error || 'No se pudo procesar el documento'}`
        };
      }
      
      console.log('[SERVER] OCR completed successfully. Converting to XLSX File...');
      
      // Crear un nuevo File con el buffer XLSX normalizado
      const xlsxBlob = new Blob([ocrResult.xlsxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      processedFile = new File([xlsxBlob], file.name.replace(/\.[^.]+$/, '.xlsx'), {
        type: xlsxBlob.type
      });
      
      console.log('[SERVER] XLSX file created from OCR:', processedFile.name);
      }
    }
    
    // Get insurer mapping rules (including multi-column support for ASSA)
    const { data: mappingRules } = await supabase
      .from('insurer_mapping_rules')
      .select('target_field, aliases, commission_column_2_aliases, commission_column_3_aliases')
      .eq('insurer_id', parsed.insurer_id) as any;
    
    console.log('[SERVER] Mapping rules:', mappingRules);
    
    // Get insurer configuration for invert_negatives and multi-column support (ASSA)
    const { data: insurerData } = await supabase
      .from('insurers')
      .select('invert_negatives, use_multi_commission_columns')
      .eq('id', parsed.insurer_id)
      .single();
    
    // Prioridad: valor enviado por UI (FormData) > config en BD
    const invertNegatives = parsed.invert_negatives === 'true' ? true : ((insurerData as any)?.invert_negatives || false);
    const useMultiColumns = (insurerData as any)?.use_multi_commission_columns || false;
    console.log('[SERVER] Invert negatives from insurer config:', invertNegatives);
    console.log('[SERVER] Use multi commission columns (ASSA):', useMultiColumns);
    
    const rows = await parseCsvXlsx(processedFile, mappingRules || [], invertNegatives, useMultiColumns, parsed.insurer_id);
    console.log(`[SERVER][${insurerName}] ========== RESULTADO PARSER ==========`);
    console.log(`[SERVER][${insurerName}] Total filas parseadas: ${rows.length}`);
    console.log(`[SERVER][${insurerName}] Primeras 3 filas:`, rows.slice(0, 3).map(r => ({
      policy: r.policy_number,
      client: r.client_name,
      amount: r.commission_amount
    })));
    
    if (rows.length === 0) {
      console.error(`[SERVER][${insurerName}] ❌ PARSER NO EXTRAJO NINGUNA FILA - Revisar parser`);
    }

    // 1. Create the comm_imports record with user-entered total_amount and life insurance flag
    const { data: importRecord, error: importError } = await supabase
      .from('comm_imports')
      .insert([{
        insurer_id: parsed.insurer_id,
        period_label: parsed.fortnight_id,
        uploaded_by: userId,
        total_amount: parseFloat(parsed.total_amount),
        is_life_insurance: parsed.is_life_insurance === 'true',
      }])
      .select()
      .single<CommImportRow>();

    if (importError) throw importError;
    if (!importRecord) throw new Error('Failed to create import record');
    
    console.log('[SERVER] Saved total_amount:', importRecord.total_amount, 'for import:', importRecord.id);

    // 2. Buscar pólizas existentes para identificar broker y porcentaje
    // Para aseguradoras con "parserRule: partial", el número real de póliza para match puede ser solo un grupo.
    const policyNumbers = rows.map(r => r.policy_number).filter(Boolean) as string[];
    const insurerSlug = getInsurerSlug(insurerName);
    const usesPartialMatch = insurerSlug ? getPolicySearchTerm(insurerSlug, '1-1-1') !== '1-1-1' : false;

    let existingPolicies: any[] = [];
    if (policyNumbers.length > 0 && insurerSlug && usesPartialMatch) {
      const searchTerms = Array.from(
        new Set(
          policyNumbers
            .map(pn => getPolicySearchTerm(insurerSlug, pn))
            .map(t => String(t || '').trim())
            .filter(Boolean)
        )
      );

      const batchSize = 40;
      for (let i = 0; i < searchTerms.length; i += batchSize) {
        const batch = searchTerms.slice(i, i + batchSize);
        const orClause = batch
          .map(term => `policy_number.ilike.%${term.replace(/%/g, '')}%`)
          .join(',');

        const { data } = await supabase
          .from('policies')
          .select(`
            policy_number,
            broker_id,
            client_id,
            percent_override,
            clients(national_id),
            brokers!inner(percent_default)
          `)
          .or(orClause);

        existingPolicies.push(...(data || []));
      }
    } else {
      const { data } = await supabase
        .from('policies')
        .select(`
          policy_number, 
          broker_id, 
          client_id, 
          percent_override,
          clients(national_id),
          brokers!inner(percent_default)
        `)
        .in('policy_number', policyNumbers.length > 0 ? policyNumbers : ['__NONE__']);

      existingPolicies = data || [];
    }

    const policyMap = new Map<string, { 
      broker_id: string | null; 
      client_id: string; 
      national_id: string | null;
      percent: number;
    }>();
    
    (existingPolicies || []).forEach((p: any) => {
      // Prioridad: percent_override > percent_default > 1.0
      const percent = p.percent_override ?? p.brokers?.percent_default ?? 1.0;
      
      policyMap.set(p.policy_number, {
        broker_id: p.broker_id,
        client_id: p.client_id,
        national_id: p.clients?.national_id || null,
        percent: percent,
      });
    });

    const findPolicyData = (rawPolicyNumber: string | null) => {
      if (!rawPolicyNumber) return { matchedPolicyNumber: null as string | null, policyData: null as any };

      // 1) Exact match
      const exact = policyMap.get(rawPolicyNumber);
      if (exact) return { matchedPolicyNumber: rawPolicyNumber, policyData: exact };

      // 2) Match parcial por aseguradora (ANCON/ACERTA/MB/FEDPA/REGIONAL/OPTIMA/ALIADO/UNIVIVIR/BANESCO)
      if (insurerSlug && usesPartialMatch) {
        const term = getPolicySearchTerm(insurerSlug, rawPolicyNumber);
        if (term) {
          const candidates = (existingPolicies || []).filter((p: any) => String(p.policy_number || '').includes(String(term)));
          if (candidates.length === 1) {
            const pn = String(candidates[0].policy_number);
            return { matchedPolicyNumber: pn, policyData: policyMap.get(pn) || null };
          }
          if (candidates.length > 1) {
            // Preferir coincidencia exacta en algún segmento del número (cuando esté separado por '-')
            const preferred = candidates.find((p: any) => {
              const parts = String(p.policy_number || '').split('-');
              return parts.includes(String(term));
            }) || candidates[0];
            const pn = preferred ? String(preferred.policy_number) : null;
            return { matchedPolicyNumber: pn, policyData: pn ? (policyMap.get(pn) || null) : null };
          }
        }
      }

      return { matchedPolicyNumber: rawPolicyNumber, policyData: null };
    };

    // 3. Separar: comm_items (identificados con broker) y pending_items (sin identificar)
    const itemsToInsert: CommItemIns[] = [];
    const pendingItemsToInsert: any[] = [];

    for (const row of rows) {
      const { matchedPolicyNumber, policyData } = findPolicyData(row.policy_number || null);
      
      // Si existe póliza con broker identificado, va a comm_items
      if (policyData && policyData.broker_id) {
        // CALCULAR comisión del broker aplicando el porcentaje
        // percent_default es DECIMAL (0.82 = 82%)
        const commissionRaw = row.commission_amount || 0;
        const percent = policyData.percent;
        const grossAmount = commissionRaw * percent;
        
        console.log(`[CALC] Policy ${row.policy_number}: Raw=${commissionRaw}, Percent=${percent}, Gross=${grossAmount}`);
        
        itemsToInsert.push({
          import_id: importRecord.id,
          insurer_id: parsed.insurer_id,
          policy_number: matchedPolicyNumber || row.policy_number || 'UNKNOWN',
          gross_amount: grossAmount,  // ← Aplicado el porcentaje
          insured_name: row.client_name || 'UNKNOWN',
          raw_row: row.raw_row,
          broker_id: policyData.broker_id,
        });
      } else {
        // Sin broker identificado: va a pending_items con commission_raw (NO calculado con %)
        pendingItemsToInsert.push({
          insured_name: row.client_name || null,
          policy_number: matchedPolicyNumber || row.policy_number || 'UNKNOWN',
          insurer_id: parsed.insurer_id,
          commission_raw: row.commission_amount || 0, // RAW, no calculado
          fortnight_id: parsed.fortnight_id,
          import_id: importRecord.id,
          status: 'open',
          assigned_broker_id: null,
        });
      }
    }

    console.log(`[SERVER][${insurerName}] ========== SEPARACIÓN IDENTIFICADOS/SIN IDENTIFICAR ==========`);
    console.log(`[SERVER][${insurerName}] Items identificados (con broker): ${itemsToInsert.length}`);
    console.log(`[SERVER][${insurerName}] Items sin identificar: ${pendingItemsToInsert.length}`);
    
    if (itemsToInsert.length > 0) {
      console.log(`[SERVER][${insurerName}] Muestra de identificados:`, itemsToInsert.slice(0, 2).map(i => ({
        policy: i.policy_number,
        broker: i.broker_id,
        amount: i.gross_amount
      })));
    }
    
    if (pendingItemsToInsert.length > 0) {
      console.log(`[SERVER][${insurerName}] Muestra de sin identificar:`, pendingItemsToInsert.slice(0, 2).map(i => ({
        policy: i.policy_number,
        name: i.insured_name,
        amount: i.commission_raw
      })));
    }

    // 4. Insert comm_items (con cédula)
    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('comm_items')
        .insert(itemsToInsert);
      
      if (itemsError) {
        console.error('[SERVER] Error inserting items:', itemsError);
        throw itemsError;
      }
      console.log('[SERVER] Items inserted successfully');
    }

    // 5. Insert draft_unidentified_items (no identificados - zona de trabajo temporal)
    // NO insertamos en pending_items hasta confirmar PAGADO
    if (pendingItemsToInsert.length > 0) {
      console.log(`[SERVER][${insurerName}] Preparando ${pendingItemsToInsert.length} items para draft_unidentified_items...`);
      
      const draftItems = pendingItemsToInsert.map(item => ({
        fortnight_id: item.fortnight_id,
        import_id: item.import_id,
        insurer_id: item.insurer_id,
        policy_number: item.policy_number,
        insured_name: item.insured_name,
        commission_raw: item.commission_raw,
        raw_row: item.raw_row || null,
        temp_assigned_broker_id: null,
      }));

      console.log(`[SERVER][${insurerName}] Insertando en draft_unidentified_items con ON CONFLICT DO NOTHING...`);
      const { error: draftError, count } = await (supabase as any)
        .from('draft_unidentified_items')
        .upsert(draftItems, { 
          onConflict: 'fortnight_id,import_id,policy_number,insured_name',
          ignoreDuplicates: true 
        });
      
      if (draftError) {
        console.error(`[SERVER][${insurerName}] ❌ ERROR insertando draft unidentified:`, draftError);
        console.error(`[SERVER][${insurerName}] Error details:`, {
          code: draftError.code,
          message: draftError.message,
          details: draftError.details,
          hint: draftError.hint
        });
        console.log(`[SERVER][${insurerName}] Continuando a pesar del error...`);
      } else {
        console.log(`[SERVER][${insurerName}] ✅ ${draftItems.length} items procesados en draft_unidentified_items (duplicados ignorados)`);
      }
    } else {
      console.log(`[SERVER][${insurerName}] ℹ️ No hay items sin identificar para insertar (todos fueron identificados con broker)`);
    }

    // 6. BANCO: Vincular transfer individual o grupos con el import (TEMPORAL)
    if (bankTransferId) {
      console.log('[BANCO] Vinculando transfer individual con import (temporal):', bankTransferId);
      
      // Obtener cutoff_id de la transferencia para tracking de origen
      const { data: transferData } = await supabase
        .from('bank_transfers_comm')
        .select('cutoff_id, bank_cutoffs:cutoff_id(start_date, end_date)')
        .eq('id', bankTransferId)
        .single();
      
      const cutoffOrigin = transferData?.cutoff_id;
      const cutoffDates = transferData?.bank_cutoffs as any;
      const originNote = cutoffDates 
        ? `Origen: Corte ${new Date(cutoffDates.start_date).toLocaleDateString('es-PA')} - ${new Date(cutoffDates.end_date).toLocaleDateString('es-PA')}`
        : 'Origen: Sin corte';
      
      const { error: transferLinkError } = await (supabase as any)
        .from('bank_transfer_imports')
        .insert({
          transfer_id: bankTransferId,
          import_id: importRecord.id,
          amount_assigned: parseFloat(parsed.total_amount),
          cutoff_origin_id: cutoffOrigin,
          fortnight_paid_id: null, // Se llenará al confirmar pago
          notes: originNote,
          is_temporary: true, // Temporal hasta confirmar quincena
        });
      
      if (transferLinkError) {
        console.error('[BANCO] Error vinculando transfer:', transferLinkError);
      } else {
        console.log('[BANCO] Transfer vinculada exitosamente (temporal)');
      }
    }

    if (bankGroupIds.length > 0) {
      console.log('[BANCO] Vinculando grupos bancarios con import (temporal):', bankGroupIds);
      for (const groupId of bankGroupIds) {
        const { data: groupData } = await supabase
          .from('bank_groups')
          .select('total_amount, created_at')
          .eq('id', groupId)
          .single();

        if (groupData) {
          const originNote = groupData.created_at 
            ? `Origen: Grupo creado ${new Date(groupData.created_at).toLocaleDateString('es-PA')}`
            : 'Origen: Grupo bancario';
          
          await (supabase as any)
            .from('bank_group_imports')
            .insert({
              group_id: groupId,
              import_id: importRecord.id,
              amount_assigned: groupData.total_amount || 0,
              cutoff_origin_id: null, // Grupos no tienen cutoff específico
              fortnight_paid_id: null, // Se llenará al confirmar pago
              notes: originNote,
              is_temporary: true, // Temporal hasta confirmar quincena
            });
          
          console.log('[BANCO] Grupo vinculado (temporal):', groupId);
        }
      }
    }

    const result = { 
      insertedCount: itemsToInsert.length,
      pendingCount: pendingItemsToInsert.length,
      importId: importRecord.id,
      totalAmount: parsed.total_amount,
    };

    console.log('[SERVER] Import successful:', result);
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: result };
  } catch (error) {
    console.error('[SERVER] Import error:', error);
    
    // Mejor manejo de errores
    let errorMessage = 'Error desconocido';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Supabase errors
      errorMessage = JSON.stringify(error);
    }
    
    console.error('[SERVER] Error message:', errorMessage);
    
    return {
      ok: false as const,
      error: errorMessage,
    };
  }
}

export async function actionMarkPendingAsPayNow(payload: { policy_number: string; item_ids?: string[] }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    let targetIds = payload.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', payload.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para marcar como pagados.' };
    }

    const { data, error } = await supabase
      .from('pending_items')
      .update({
        status: 'approved_pay_now',
        action_type: 'pay_now',
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      } satisfies PendingItemUpd)
      .in('id', targetIds)
      .select('id');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionMarkPendingAsNextFortnight(payload: { policy_number: string; item_ids?: string[] }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    let targetIds = payload.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', payload.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para enviar a la próxima quincena.' };
    }

    const { data, error } = await supabase
      .from('pending_items')
      .update({
        status: 'approved_next',
        action_type: 'next_fortnight',
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      } satisfies PendingItemUpd)
      .in('id', targetIds)
      .select('id');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Create a new draft fortnight
 */
export async function actionCreateDraftFortnight(payload: unknown) {
  try {
    const parsed = CreateDraftSchema.parse(payload);
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('fortnights')
      .select('id')
      .eq('status', 'DRAFT')
      .single<Pick<FortnightRow, 'id'>>();

    if (existing) {
      return { ok: false as const, error: 'Ya existe una quincena en borrador' };
    }

    const { data, error } = await supabase
      .from('fortnights')
      .insert([{
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        status: 'DRAFT',
        notify_brokers: false,
        created_by: userId,
      } satisfies FortnightIns])
      .select()
      .single<FortnightRow>();

    if (error || !data) throw new Error(error?.message || 'No se pudo crear fortnight');

    // Inyectar pending_items "approved_next" en el nuevo draft
    const { data: pendingNext } = await supabase
      .from('pending_items')
      .select('*')
      .eq('status', 'approved_next')
      .not('assigned_broker_id', 'is', null)
      .returns<PendingItemRow[]>();
    
    const firstItem = pendingNext?.[0];
    if (pendingNext && pendingNext.length > 0 && firstItem?.insurer_id) {
      console.log(`[actionCreateDraftFortnight] Inyectando ${pendingNext.length} items de próxima quincena`);
      
      // Crear import virtual para estos items
      const { data: virtualImport } = await supabase
        .from('comm_imports')
        .insert([{
          insurer_id: firstItem.insurer_id,
          period_label: data.id,
          uploaded_by: userId,
          total_amount: pendingNext.reduce((s, p) => s + p.commission_raw, 0),
          is_life_insurance: false,
        } satisfies CommImportIns])
        .select()
        .single<CommImportRow>();
      
      if (virtualImport) {
        // Migrar cada item
        for (const item of pendingNext) {
          const { data: broker } = await supabase
            .from('brokers')
            .select('percent_default')
            .eq('id', item.assigned_broker_id!)
            .single();
          
          const percent = (broker as any)?.percent_default || 1.0;
          const grossAmount = item.commission_raw * percent;
          
          await supabase
            .from('comm_items')
            .insert([{
              import_id: virtualImport.id,
              insurer_id: item.insurer_id!,
              policy_number: item.policy_number,
              broker_id: item.assigned_broker_id,
              gross_amount: grossAmount,
              insured_name: item.insured_name,
              raw_row: null,
            } satisfies CommItemIns]);
          
          // Marcar como procesado
          await supabase
            .from('pending_items')
            .update({ status: 'injected_to_fortnight' } satisfies PendingItemUpd)
            .eq('id', item.id);
        }
        
        console.log(`[actionCreateDraftFortnight] ✓ ${pendingNext.length} items inyectados exitosamente`);
      }
    }

    // Inyectar ajustes aprobados para siguiente quincena
    const { data: queuedAdjustments } = await supabase
      .from('comm_item_claims')
      .select(`
        id,
        comm_item_id,
        broker_id,
        comm_items!inner (
          id,
          policy_number,
          insured_name,
          gross_amount,
          insurer_id
        ),
        brokers!inner (
          id,
          name,
          percent_default
        )
      `)
      .eq('status', 'approved')
      .eq('payment_type', 'next_fortnight');

    if (queuedAdjustments && queuedAdjustments.length > 0) {
      console.log(`[actionCreateDraftFortnight] Inyectando ${queuedAdjustments.length} ajustes en cola`);

      // Agrupar por broker para crear import virtual por broker
      const adjustmentsByBroker = new Map<string, any[]>();
      queuedAdjustments.forEach((adj: any) => {
        const brokerId = adj.broker_id;
        if (!adjustmentsByBroker.has(brokerId)) {
          adjustmentsByBroker.set(brokerId, []);
        }
        adjustmentsByBroker.get(brokerId)!.push(adj);
      });

      // Crear comm_items para cada ajuste
      for (const [brokerId, adjustments] of adjustmentsByBroker.entries()) {
        const firstAdj = adjustments[0];
        const commItem = firstAdj.comm_items;
        const broker = firstAdj.brokers;

        // Crear import virtual para estos ajustes
        const { data: adjustmentImport } = await supabase
          .from('comm_imports')
          .insert([{
            insurer_id: commItem.insurer_id,
            period_label: data.id,
            uploaded_by: userId,
            total_amount: 0, // Se calculará después
            is_life_insurance: false,
          } satisfies CommImportIns])
          .select()
          .single<CommImportRow>();

        if (adjustmentImport) {
          let totalAmount = 0;

          // Crear comm_item para cada ajuste
          for (const adj of adjustments) {
            const item = adj.comm_items;
            const rawAmount = Math.abs(item.gross_amount);
            const percent = broker.percent_default || 1.0;
            const brokerAmount = rawAmount * percent;

            await supabase
              .from('comm_items')
              .insert([{
                import_id: adjustmentImport.id,
                insurer_id: item.insurer_id,
                policy_number: item.policy_number,
                broker_id: brokerId,
                gross_amount: brokerAmount,
                insured_name: item.insured_name || `Ajuste - ${item.policy_number}`,
                raw_row: null,
              } satisfies CommItemIns]);

            totalAmount += brokerAmount;

            // Actualizar claim con fortnight_id
            await supabase
              .from('comm_item_claims')
              .update({
                fortnight_id: data.id,
              } satisfies TablesUpdate<'comm_item_claims'>)
              .eq('id', adj.id);
          }

          // Actualizar total del import
          await supabase
            .from('comm_imports')
            .update({ total_amount: totalAmount } satisfies TablesUpdate<'comm_imports'>)
            .eq('id', adjustmentImport.id);
        }
      }

      console.log(`[actionCreateDraftFortnight] ✓ ${queuedAdjustments.length} ajustes inyectados exitosamente`);
    }

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Get Year-to-Date commissions from closed fortnights, aggregated by month and insurer
 */
export async function actionGetYTDCommissions(year: number, brokerId?: string | null, includePreviousYear?: boolean) {
  const supabase = await getSupabaseAdmin();

  const currentYearStartDate = `${year}-01-01`;
  const currentYearEndDate = `${year}-12-31`;

  const previousYear = year - 1;
  const previousYearStartDate = `${previousYear}-01-01`;
  const previousYearEndDate = `${previousYear}-12-31`;

  try {
    console.log('📊 [actionGetYTDCommissions] year:', year, 'brokerId:', brokerId);
    
    // Obtener quincenas cerradas del año actual (y anterior si se solicita)
    let fortnightsQuery = supabase
      .from('fortnights')
      .select('id, period_start, period_end, status')
      .eq('status', 'PAID')
      .gte('period_end', includePreviousYear ? previousYearStartDate : currentYearStartDate)
      .lte('period_end', currentYearEndDate)
      .order('period_end', { ascending: true });

    const { data: fortnights, error: fortnightsError } = await fortnightsQuery;

    console.log('📊 [actionGetYTDCommissions] fortnights encontrados:', fortnights?.length || 0);
    console.log('📊 [actionGetYTDCommissions] fortnights:', fortnights);

    if (fortnightsError) throw new Error(fortnightsError.message);
    if (!fortnights || fortnights.length === 0) {
      console.log('⚠️ [actionGetYTDCommissions] No hay quincenas PAID');
      // Si no hay quincenas, retornar estructura vacía
      return {
        ok: true as const,
        data: {
          currentYear: { byMonth: {}, byInsurer: {}, total: 0 },
          previousYear: { byMonth: {}, byInsurer: {}, total: 0 }
        }
      };
    }

    // Obtener código ASSA del broker si existe
    let assaCode: string | null = null;
    if (brokerId) {
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('assa_code')
        .eq('id', brokerId)
        .single();
      assaCode = brokerData?.assa_code || null;
      console.log('📊 [actionGetYTDCommissions] assa_code del broker:', assaCode);
    }

    // Obtener detalles de todas las quincenas
    const fortnightIds = fortnights.map(f => f.id);
    
    let detailsQuery = supabase
      .from('fortnight_details')
      .select(`
        fortnight_id,
        commission_calculated,
        broker_id,
        assa_code,
        brokers (id, name),
        insurers (id, name),
        fortnights!inner (period_end)
      `)
      .in('fortnight_id', fortnightIds);

    // Filtrar por broker_id O por assa_code
    if (brokerId) {
      if (assaCode) {
        // Incluir registros donde broker_id = brokerId O assa_code = assaCode del broker
        detailsQuery = detailsQuery.or(`broker_id.eq.${brokerId},assa_code.eq.${assaCode}`);
      } else {
        // Solo por broker_id si no tiene código ASSA
        detailsQuery = detailsQuery.eq('broker_id', brokerId);
      }
    }

    const { data: details, error: detailsError } = await detailsQuery as any;

    console.log('📊 [actionGetYTDCommissions] details encontrados:', details?.length || 0);

    if (detailsError) throw new Error(detailsError.message);

    // Agrupar por año, mes y aseguradora
    const currentYearData: any = { byMonth: {}, byInsurer: {}, total: 0 };
    const previousYearData: any = { byMonth: {}, byInsurer: {}, total: 0 };

    (details || []).forEach((detail: any) => {
      const periodEnd = detail.fortnights?.period_end;
      if (!periodEnd) return;

      const date = new Date(periodEnd);
      const itemYear = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const insurerName = detail.insurers?.name || 'Sin Aseguradora';
      const commission = Number(detail.commission_calculated) || 0;

      const targetData = itemYear === year ? currentYearData : previousYearData;

      // Agregar por mes
      if (!targetData.byMonth[month]) {
        targetData.byMonth[month] = 0;
      }
      targetData.byMonth[month] += commission;

      // Agregar por aseguradora
      if (!targetData.byInsurer[insurerName]) {
        targetData.byInsurer[insurerName] = 0;
      }
      targetData.byInsurer[insurerName] += commission;

      // Total
      targetData.total += commission;
    });

    console.log('✅ [actionGetYTDCommissions] currentYearData:', currentYearData);
    console.log('✅ [actionGetYTDCommissions] total:', currentYearData.total);

    return {
      ok: true as const,
      data: {
        currentYear: currentYearData,
        previousYear: includePreviousYear ? previousYearData : { byMonth: {}, byInsurer: {}, total: 0 }
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
      data: {
        currentYear: { byMonth: {}, byInsurer: {}, total: 0 },
        previousYear: { byMonth: {}, byInsurer: {}, total: 0 }
      }
    };
  }
}

/**
 * Get available years from closed fortnights
 */
export async function actionGetAvailableYears() {
  const supabase = await getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('fortnights')
      .select('period_end')
      .eq('status', 'PAID');

    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: true as const, years: [new Date().getFullYear()] };
    }

    const years = Array.from(
      new Set(data.map(item => new Date(item.period_end).getFullYear()))
    ).sort((a, b) => b - a);

    return { ok: true as const, years };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
      years: [new Date().getFullYear()]
    };
  }
}

export async function actionGetAllAdvances() {
  const supabase = await getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .returns<AdvanceRow[]>();

    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

// Get total paid advances by summing advance_logs
export async function actionGetPaidAdvancesTotal(brokerId?: string, year?: number) {
  try {
    const supabase = await getSupabaseAdmin();
    
    // First get all paid advances IDs
    let advancesQuery = supabase
      .from('advances')
      .select('id, created_at')
      .eq('status', 'PAID');

    if (brokerId) {
      advancesQuery = advancesQuery.eq('broker_id', brokerId);
    }

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      advancesQuery = advancesQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: paidAdvances, error: advancesError } = await advancesQuery;

    if (advancesError) {
      console.error('[actionGetPaidAdvancesTotal] Error fetching paid advances:', advancesError);
      throw advancesError;
    }

    if (!paidAdvances || paidAdvances.length === 0) {
      console.log('[actionGetPaidAdvancesTotal] No paid advances found');
      return { ok: true as const, total: 0 };
    }

    const paidIds = paidAdvances.map(a => a.id);

    // Then get sum from advance_logs
    const { data: logs, error: logsError } = await supabase
      .from('advance_logs')
      .select('amount')
      .in('advance_id', paidIds);

    if (logsError) {
      console.error('[actionGetPaidAdvancesTotal] Error fetching logs:', logsError);
      throw logsError;
    }

    const total = (logs || []).reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
    
    console.log('[actionGetPaidAdvancesTotal] Paid advances:', paidAdvances.length, 'Total from logs:', total);

    return { ok: true as const, total };
  } catch (error) {
    console.error('[actionGetPaidAdvancesTotal] Exception:', error);
    return { ok: false as const, error: String(error), total: 0 };
  }
}

// Limpiar duplicados de adelantos recurrentes (mantener solo el más reciente)
export async function actionCleanupDuplicateRecurring() {
  try {
    const supabase = await getSupabaseAdmin();
    
    console.log('[actionCleanupDuplicateRecurring] Buscando duplicados...');
    
    // Obtener todos los adelantos recurrentes
    const { data: allRecurring, error } = await supabase
      .from('advances')
      .select('id, recurrence_id, created_at, status, amount, reason')
      .not('recurrence_id', 'is', null)
      .order('created_at', { ascending: false }); // Más recientes primero
    
    if (error) throw error;
    
    if (!allRecurring || allRecurring.length === 0) {
      return { ok: true as const, message: 'No hay adelantos recurrentes', deleted: 0 };
    }
    
    console.log('Total adelantos recurrentes encontrados:', allRecurring.length);
    
    // Agrupar por recurrence_id
    const grouped: Record<string, any[]> = {};
    allRecurring.forEach(adv => {
      const recId = (adv as any).recurrence_id;
      if (!grouped[recId]) grouped[recId] = [];
      grouped[recId].push(adv);
    });
    
    let deleted = 0;
    const toDelete: string[] = [];
    const toReset: string[] = [];
    const details: any[] = [];
    
    // Para cada grupo con más de 1 adelanto
    for (const [recId, advances] of Object.entries(grouped)) {
      if (advances.length > 1) {
        console.log(`\n📦 Recurrence ID ${recId.substring(0, 8)}: ${advances.length} adelantos`);
        
        // Mantener el más reciente (primero en el array), eliminar todos los demás
        const toKeep = advances[0];
        const duplicates = advances.slice(1);
        
        console.log(`  ✅ Mantener: ${(toKeep as any).id.substring(0, 8)} (${(toKeep as any).reason})`);
        
        for (const dup of duplicates) {
          console.log(`  ❌ Eliminar: ${(dup as any).id.substring(0, 8)} - Status: ${(dup as any).status} - Monto: ${(dup as any).amount}`);
          toDelete.push((dup as any).id);
        }
        
        // Si el que vamos a mantener está PAID, resetearlo
        if ((toKeep as any).status === 'PAID' || (toKeep as any).amount === 0) {
          console.log(`  🔄 Resetear adelanto principal`);
          toReset.push((toKeep as any).id);
        }
      } else {
        // Solo uno, verificar si necesita reseteo
        const adv = advances[0];
        if ((adv as any).status === 'PAID' || (adv as any).amount === 0) {
          console.log(`  🔄 Resetear: ${(adv as any).id.substring(0, 8)} (${(adv as any).reason})`);
          toReset.push((adv as any).id);
        }
      }
    }
    
    console.log('\n=== RESUMEN ===');
    console.log(`Adelantos a eliminar: ${toDelete.length}`);
    console.log(`Adelantos a resetear: ${toReset.length}`);
    
    // Ejecutar eliminaciones
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('advances')
        .delete()
        .in('id', toDelete);
      
      if (deleteError) {
        console.error('Error al eliminar duplicados:', deleteError);
        throw deleteError;
      }
      console.log(`✅ ${toDelete.length} duplicados eliminados`);
    }
    
    // Ejecutar reseteos
    for (const advId of toReset) {
      // Obtener configuración de recurrencia
      const { data: adv } = await supabase
        .from('advances')
        .select('recurrence_id')
        .eq('id', advId)
        .single();
      
      if (adv && (adv as any).recurrence_id) {
        const { data: rec } = await supabase
          .from('advance_recurrences')
          .select('amount')
          .eq('id', (adv as any).recurrence_id)
          .single();
        
        if (rec && (rec as any).amount) {
          const { error: updateError } = await supabase
            .from('advances')
            .update({
              amount: (rec as any).amount,
              status: 'PENDING',
              is_recurring: true
            })
            .eq('id', advId);
          
          if (updateError) {
            console.error(`Error al resetear ${advId.substring(0, 8)}:`, updateError);
          } else {
            console.log(`✅ Reseteado ${advId.substring(0, 8)} a $${(rec as any).amount}`);
          }
        }
      }
    }
    
    revalidatePath('/(app)/commissions');
    
    return { 
      ok: true as const, 
      message: 'Limpieza completada',
      deleted: toDelete.length,
      reset: toReset.length
    };
  } catch (error) {
    console.error('[actionCleanupDuplicateRecurring] Exception:', error);
    return { ok: false as const, error: String(error), deleted: 0, reset: 0 };
  }
}

// Buscar adelantos recurrentes marcados incorrectamente como PAID
export async function actionFindMismarkedRecurringAdvances() {
  try {
    const supabase = await getSupabaseAdmin();
    
    console.log('[actionFindMismarkedRecurringAdvances] Buscando adelantos recurrentes marcados como PAID...');
    
    const { data: advances, error } = await supabase
      .from('advances')
      .select('id, reason, amount, status, is_recurring, recurrence_id, brokers(id, name)')
      .eq('status', 'PAID')
      .not('recurrence_id', 'is', null);
    
    if (error) {
      console.error('Error:', error);
      throw error;
    }
    
    console.log('Adelantos recurrentes marcados como PAID:', advances?.length || 0);
    
    if (advances && advances.length > 0) {
      advances.forEach(adv => {
        console.log('  -', {
          id: (adv as any).id.substring(0, 8),
          reason: (adv as any).reason,
          amount: (adv as any).amount,
          status: (adv as any).status,
          is_recurring: (adv as any).is_recurring,
          broker: (adv as any).brokers?.name,
          recurrence_id: (adv as any).recurrence_id?.substring(0, 8)
        });
      });
    }
    
    return { ok: true as const, data: advances || [] };
  } catch (error) {
    console.error('[actionFindMismarkedRecurringAdvances] Exception:', error);
    return { ok: false as const, error: String(error), data: [] };
  }
}

// Recuperar adelantos recurrentes que se marcaron como PAID incorrectamente
export async function actionRecoverRecurringAdvance(advanceId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    
    console.log('[actionRecoverRecurringAdvance] Recuperando adelanto:', advanceId);
    
    // Obtener el adelanto
    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .select('id, amount, status, recurrence_id, is_recurring, reason')
      .eq('id', advanceId)
      .single();
    
    if (advanceError) {
      console.error('Error al obtener adelanto:', advanceError);
      throw advanceError;
    }
    
    if (!advance) {
      return { ok: false as const, error: 'Adelanto no encontrado' };
    }
    
    console.log('Adelanto encontrado:', advance);
    
    // Verificar que tenga recurrence_id
    if (!(advance as any).recurrence_id) {
      return { ok: false as const, error: 'El adelanto no tiene recurrence_id configurado' };
    }
    
    // Obtener la configuración de recurrencia
    const { data: recurrence, error: recError } = await supabase
      .from('advance_recurrences')
      .select('amount, is_active')
      .eq('id', (advance as any).recurrence_id)
      .single();
    
    if (recError) {
      console.error('Error al obtener recurrencia:', recError);
      throw recError;
    }
    
    if (!recurrence) {
      return { ok: false as const, error: 'No se encontró la configuración de recurrencia' };
    }
    
    console.log('Recurrencia encontrada, monto original:', recurrence.amount);
    console.log('Reseteando adelanto recurrente a monto original...');
    
    // Resetear el adelanto
    const { error: updateError } = await supabase
      .from('advances')
      .update({
        amount: recurrence.amount,
        status: 'PENDING',
        is_recurring: true
      })
      .eq('id', advanceId);
    
    if (updateError) {
      console.error('Error al resetear adelanto:', updateError);
      throw updateError;
    }
    
    console.log('✅ Adelanto recurrente recuperado exitosamente');
    console.log('   - Monto reseteado a:', recurrence.amount);
    console.log('   - Status: PENDING');
    console.log('   - is_recurring: true');
    
    revalidatePath('/(app)/commissions');
    
    return { ok: true as const };
  } catch (error) {
    console.error('[actionRecoverRecurringAdvance] Exception:', error);
    return { ok: false as const, error: String(error) };
  }
}

export async function actionGetAdvanceLogs(brokerId?: string, year?: number) {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Obtener todos los advance_logs con info del adelanto y broker
    let logsQuery = supabase
      .from('advance_logs')
      .select(`
        id,
        advance_id,
        amount,
        payment_type,
        created_at,
        advances!inner (
          id,
          reason,
          broker_id,
          is_recurring,
          brokers (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (brokerId) {
      logsQuery = logsQuery.eq('advances.broker_id', brokerId);
    }

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      logsQuery = logsQuery.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: logs, error } = await logsQuery;

    if (error) {
      console.error('[actionGetAdvanceLogs] Error:', error);
      throw error;
    }

    console.log('[actionGetAdvanceLogs] Loaded logs:', logs?.length || 0);
    
    return { ok: true as const, data: logs || [] };
  } catch (error) {
    console.error('[actionGetAdvanceLogs] Exception:', error);
    return { ok: false as const, error: String(error), data: [] };
  }
}

// Get advances filtered by broker and year
export async function actionGetAdvances(brokerId?: string, year?: number) {
  const supabase = await getSupabaseAdmin();
  try {
    let query = supabase
      .from('advances')
      .select('*, brokers(id, name)')
      .order('created_at', { ascending: false });

    // Filter by broker_id if provided
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    // Filter by year if provided
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[actionGetAdvances] Error:', error);
      throw error;
    }
    
    console.log('[actionGetAdvances] Loaded advances:', data?.length || 0);
    
    // Para todos los adelantos, obtener el total pagado desde advance_logs
    let dataWithExtras = data || [];
    if (data && data.length > 0) {
      const allIds = data.map(a => a.id);
      
      // Obtener suma de pagos y fecha del último pago por adelanto
      const { data: logs } = await supabase
        .from('advance_logs')
        .select('advance_id, amount, created_at')
        .in('advance_id', allIds);
      
      // Obtener pending_payments asociados (descuentos a corredor)
      const { data: pendingPayments } = await supabase
        .from('pending_payments')
        .select('id, notes, policy_number, client_name, insurer_name')
        .in('status', ['pending', 'processing']);
      
      // Mapear pending_payments por advance_id
      const paymentDetailsByAdvance: Record<string, any> = {};
      if (pendingPayments) {
        for (const payment of pendingPayments) {
          try {
            const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
            if (metadata?.advance_id) {
              paymentDetailsByAdvance[metadata.advance_id] = {
                policy_number: payment.policy_number,
                client_name: payment.client_name,
                insurer_name: payment.insurer_name,
              };
            }
          } catch (e) {
            // Ignorar si no se puede parsear
          }
        }
      }
      
      // Agrupar logs por advance_id - ESTRICTO por día
      const paymentsByAdvance: Record<string, { total: number, lastDate: string, logs: Array<{date: string, amount: number}> }> = {};
      if (logs) {
        logs.forEach((log: any) => {
          if (!paymentsByAdvance[log.advance_id]) {
            // Extraer ESTRICTAMENTE solo YYYY-MM-DD (primeros 10 caracteres)
            // Ignorar completamente hora y zona horaria
            const dateOnly = String(log.created_at).substring(0, 10);
            paymentsByAdvance[log.advance_id] = { total: 0, lastDate: dateOnly, logs: [] };
          }
          const current = paymentsByAdvance[log.advance_id];
          if (current) {
            const logDateOnly = String(log.created_at).substring(0, 10);
            const logAmount = Number(log.amount) || 0;
            
            current.total += logAmount;
            current.logs.push({ date: logDateOnly, amount: logAmount });
            
            // Actualizar última fecha si es más reciente (comparación string YYYY-MM-DD)
            if (logDateOnly > current.lastDate) {
              current.lastDate = logDateOnly;
            }
          }
        });
      }
      
      console.log('[actionGetAdvances] Payment dates (sample):', 
        Object.values(paymentsByAdvance).slice(0, 3).map(p => p.lastDate)
      );
      
      // Agregar total_paid, last_payment_date, payment_logs y payment_details a cada adelanto
      dataWithExtras = data.map((adv: any) => ({
        ...adv,
        total_paid: paymentsByAdvance[adv.id]?.total || 0,
        last_payment_date: paymentsByAdvance[adv.id]?.lastDate || null,
        payment_logs: paymentsByAdvance[adv.id]?.logs || [],
        payment_details: paymentDetailsByAdvance[adv.id] || null,
      }));
      
      console.log('[actionGetAdvances] Added payment history to', Object.keys(paymentsByAdvance).length, 'advances');
      console.log('[actionGetAdvances] Added payment details to', Object.keys(paymentDetailsByAdvance).length, 'advances');
      console.log('[actionGetAdvances] Sample with payments:', dataWithExtras
        .filter((a: any) => a.total_paid > 0)
        .slice(0, 3)
        .map((a: any) => ({
          id: a.id.substring(0, 8),
          status: a.status,
          is_recurring: a.is_recurring,
          total_paid: a.total_paid,
          last_payment_date: a.last_payment_date
        }))
      );
    }
    
    // Debug: contar por status
    if (dataWithExtras) {
      const statusCounts = dataWithExtras.reduce((acc: any, adv: any) => {
        const status = adv.status?.toLowerCase() || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log('[actionGetAdvances] Status counts:', statusCounts);
      
      // Calcular totales por status
      const totals = dataWithExtras.reduce((acc: any, adv: any) => {
        const status = adv.status?.toLowerCase() || 'unknown';
        if (!acc[status]) acc[status] = 0;
        if (status === 'paid') {
          acc[status] += Number(adv.total_paid) || 0;
        } else {
          acc[status] += Number(adv.amount) || 0;
        }
        return acc;
      }, {});
      console.log('[actionGetAdvances] Totals by status:', totals);
    }
    
    return { ok: true as const, data: dataWithExtras };
  } catch (error) {
    console.error('[actionGetAdvances] Exception:', error);
    return { ok: false as const, error: String(error) };
  }
}

export async function actionApplyAdvancePayment(payload: { 
  advance_id: string; 
  amount: number; 
  payment_type: string; 
  fortnight_id?: string; 
  broker_id?: string;
  reference_number?: string;
  payment_date?: string;
}) {
  try {
    const { advance_id, amount, payment_type, fortnight_id, broker_id, reference_number, payment_date } = payload;
    const { userId: applied_by } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    // Validar que el monto no sea negativo
    if (amount <= 0) {
      return { ok: false as const, error: 'El monto debe ser mayor a cero' };
    }

    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .select('id, amount, status, broker_id, is_recurring, recurrence_id, reason')
      .eq('id', advance_id)
      .single();

    if (advanceError) throw advanceError;
    if (!advance) throw new Error('Adelanto no encontrado');
    
    console.log('[actionApplyAdvancePayment] Adelanto a pagar:', {
      id: advance_id.substring(0, 8),
      amount: (advance as any).amount,
      status: (advance as any).status,
      is_recurring: (advance as any).is_recurring,
      recurrence_id: (advance as any).recurrence_id,
      reason: (advance as any).reason,
      payment_amount: amount
    });

    // Validar que el monto no exceda el saldo del adelanto
    if (amount > (advance as any).amount) {
      return { ok: false as const, error: `El monto no puede exceder el saldo del adelanto ($${(advance as any).amount.toFixed(2)})` };
    }

    // Si es descuento de quincena, validar que no exceda comisión bruta
    if (payment_type === 'fortnight' && fortnight_id && broker_id) {
      const { data: brokerTotal } = await supabase
        .from('fortnight_broker_totals')
        .select('gross_amount, discount_amount')
        .eq('fortnight_id', fortnight_id)
        .eq('broker_id', broker_id)
        .single();

      if (brokerTotal) {
        const currentGross = (brokerTotal as any).gross_amount || 0;
        const currentDiscounts = (brokerTotal as any).discount_amount || 0;
        const availableForDiscount = currentGross - currentDiscounts;
        
        if (amount > availableForDiscount) {
          return { ok: false as const, error: `El monto excede la comisión bruta disponible ($${availableForDiscount.toFixed(2)})` };
        }
      }
    }

    // Si es transferencia externa, validar referencia y aplicar directamente
    if (payment_type === 'external_transfer' && reference_number) {
      console.log(`💳 Procesando transferencia externa - Ref: ${reference_number} - Monto: $${amount}`);
      
      // Buscar la referencia en bank_transfers
      const { data: transfer, error: transferError } = await supabase
        .from('bank_transfers')
        .select('*')
        .eq('reference_number', reference_number)
        .single();
      
      if (transferError || !transfer) {
        return { 
          ok: false as const, 
          error: `La referencia "${reference_number}" no existe en el historial de banco. Por favor, impórtela primero.` 
        };
      }
      
      // Validar que el monto no exceda el disponible en la transferencia
      const transferAmount = Number(transfer.amount) || 0;
      const transferUsed = Number(transfer.used_amount) || 0;
      const transferRemaining = transferAmount - transferUsed;
      
      if (amount > transferRemaining) {
        return { 
          ok: false as const, 
          error: `El monto a utilizar ($${amount.toFixed(2)}) excede el saldo disponible de la referencia ($${transferRemaining.toFixed(2)}).` 
        };
      }
      
      console.log(`✅ Referencia validada - Disponible: $${transferRemaining.toFixed(2)} - A usar: $${amount.toFixed(2)}`);
      
      // Obtener información del adelanto y broker
      const { data: advanceData } = await supabase
        .from('advances')
        .select(`
          id,
          amount,
          reason,
          broker_id,
          brokers (name)
        `)
        .eq('id', advance_id)
        .single();
      
      const brokerName = (advanceData as any)?.brokers?.name || 'CORREDOR';
      const advanceReason = (advanceData as any)?.reason || 'Adelanto';
      
      // Actualizar bank_transfers con el monto usado
      const newUsedAmount = transferUsed + amount;
      const newRemainingAmount = transferAmount - newUsedAmount;
      const newStatus = newRemainingAmount <= 0.01 ? 'used' : 
                       newUsedAmount > 0 ? 'partial' : 'available';
      
      const { error: updateTransferError } = await supabase
        .from('bank_transfers')
        .update({
          used_amount: newUsedAmount,
          remaining_amount: newRemainingAmount,
          status: newStatus
        } satisfies TablesUpdate<'bank_transfers'>)
        .eq('id', transfer.id);
      
      if (updateTransferError) throw updateTransferError;
      
      console.log(`📝 Bank transfer actualizado - Usado: $${newUsedAmount.toFixed(2)} - Remanente: $${newRemainingAmount.toFixed(2)} - Status: ${newStatus}`);
      
      // Crear registro en payment_details para trazabilidad
      const { error: detailError } = await supabase
        .from('payment_details')
        .insert([{
          bank_transfer_id: transfer.id,
          payment_id: null, // No hay pending_payment en este flujo
          policy_number: `ADV-${advance_id.substring(0, 8)}`,
          insurer_name: 'ADELANTO',
          client_name: `Adelanto: ${brokerName}`,
          purpose: advanceReason,
          amount_used: amount,
          paid_at: payment_date || new Date().toISOString()
        }] satisfies TablesInsert<'payment_details'>[]);
      
      if (detailError) {
        console.error('Error creating payment detail:', detailError);
        // No fallar, solo log
      }
      
      console.log(`✅ Transferencia aplicada al adelanto - Registrada en historial banco`);
    }

    // Para efectivo u otros pagos, aplicar directamente
    // IMPORTANTE: Usar fecha LOCAL para evitar cambio de día por zona horaria
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const localHours = String(now.getHours()).padStart(2, '0');
    const localMinutes = String(now.getMinutes()).padStart(2, '0');
    const localSeconds = String(now.getSeconds()).padStart(2, '0');
    
    // Formato: YYYY-MM-DD HH:MM:SS (sin zona horaria, fecha local pura)
    const localTimestamp = `${localYear}-${localMonth}-${localDay} ${localHours}:${localMinutes}:${localSeconds}`;
    
    const logPayload: AdvanceLogIns = {
      advance_id,
      amount,
      payment_type,
      fortnight_id: fortnight_id || null,
      applied_by: applied_by || null,
      created_at: localTimestamp as any, // Forzar fecha local
    };
    
    console.log('[actionApplyAdvancePayment] Creating advance log with LOCAL timestamp:', localTimestamp);
    
    const { data: logData, error: logError } = await supabase
      .from('advance_logs')
      .insert([logPayload])
      .select();

    if (logError) {
      console.error('[actionApplyAdvancePayment] Error creating advance log:', logError);
      throw logError;
    }
    
    console.log('[actionApplyAdvancePayment] Advance log created successfully:', logData);

    const newAmount = (Number((advance as any).amount) || 0) - amount;
    const isFullyPaid = newAmount <= 0;
    
    // ADELANTOS RECURRENTES: cuando se pagan completamente, resetear al monto original
    if (isFullyPaid && (advance as any).is_recurring && (advance as any).recurrence_id) {
      console.log('🔄 Adelanto recurrente pagado completamente - Reseteando a monto original');
      console.log('   - Advance ID:', advance_id);
      console.log('   - Recurrence ID:', (advance as any).recurrence_id);
      console.log('   - Current amount:', (advance as any).amount);
      console.log('   - Payment amount:', amount);
      console.log('   - New amount would be:', newAmount);
      
      // Obtener el monto original de la recurrencia
      const { data: recurrence, error: recurrenceError } = await supabase
        .from('advance_recurrences')
        .select('amount, is_active')
        .eq('id', (advance as any).recurrence_id)
        .single();
      
      if (recurrenceError) {
        console.error('❌ Error al obtener recurrencia:', recurrenceError);
        throw recurrenceError;
      }
      
      if (recurrence) {
        console.log('   - Recurrence amount:', recurrence.amount);
        console.log('   - Recurrence is_active:', recurrence.is_active);
        
        // Resetear a monto original y mantener como PENDING
        const { error: updateError } = await supabase.from('advances').update({
          amount: recurrence.amount,
          status: 'PENDING',
        } satisfies TablesUpdate<'advances'>).eq('id', advance_id);
        
        if (updateError) {
          console.error('❌ Error al resetear adelanto:', updateError);
          throw updateError;
        }
        
        console.log('✅ Adelanto recurrente reseteado - permanece en Deudas Activas con historial');
        console.log('   - Resetted to amount:', recurrence.amount);
        
        revalidatePath('/(app)/commissions');
        return { ok: true as const };
      } else {
        console.error('❌ No se encontró configuración de recurrencia');
      }
    }
    
    // ADELANTOS RECURRENTES PARCIALMENTE PAGADOS: mantener como PARTIAL
    if (!isFullyPaid && (advance as any).is_recurring) {
      const { error: updateError } = await supabase.from('advances').update({
        amount: newAmount,
        status: 'PARTIAL',
      } satisfies TablesUpdate<'advances'>).eq('id', advance_id);
      
      if (updateError) throw updateError;
      console.log('✅ Adelanto recurrente parcialmente pagado - status PARTIAL');
      
      revalidatePath('/(app)/commissions');
      return { ok: true as const };
    }
    
    // ADELANTOS NO RECURRENTES: comportamiento normal
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

    const { error: updateError } = await supabase.from('advances').update({
      amount: newAmount,
      status: newStatus,
    } satisfies TablesUpdate<'advances'>).eq('id', advance_id);

    if (updateError) throw updateError;

    // Si el adelanto está saldado (no recurrente), habilitar pending_payment relacionado
    if (newStatus === 'PAID') {
      
      // Buscar todos los pagos pendientes para filtrar los descuentos a corredor
      const { data: allPendingPayments } = await supabase
        .from('pending_payments')
        .select('id, notes, client_name, amount_to_pay, can_be_paid, purpose')
        .eq('status', 'pending');

      if (allPendingPayments && allPendingPayments.length > 0) {
        // Filtrar descuentos a corredor: tienen is_auto_advance=true, advance_id o "Adelanto ID:" en notes
        const pendingPayments = allPendingPayments.filter(payment => {
          try {
            if (payment.notes) {
              let metadata: any = null;
              if (typeof payment.notes === 'object' && payment.notes !== null) {
                metadata = payment.notes;
              } else if (typeof payment.notes === 'string') {
                metadata = JSON.parse(payment.notes);
              }
              
              if (metadata) {
                const hasAutoFlag = metadata.is_auto_advance === true;
                const hasAdvanceIdDirect = !!metadata.advance_id;
                const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                           metadata.notes.includes('Adelanto ID:');
                return hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
              }
            }
          } catch (e) {
            // Si no se puede parsear, no es descuento a corredor
          }
          return false;
        });

        for (const payment of pendingPayments) {
          // Parsear notes para extraer advance_id
          let paymentAdvanceId: string | null = null;
          
          try {
            if (payment.notes) {
              if (typeof payment.notes === 'object' && payment.notes !== null) {
                paymentAdvanceId = (payment.notes as any).advance_id || null;
              } else if (typeof payment.notes === 'string') {
                const parsed = JSON.parse(payment.notes);
                paymentAdvanceId = parsed.advance_id || null;
              }
            }
          } catch (e) {
            console.error('Error parsing notes for advance_id:', e);
          }
          
          // Si coincide el advance_id y aún no está habilitado
          if (paymentAdvanceId === advance_id && !payment.can_be_paid) {
            await supabase
              .from('pending_payments')
              .update({
                can_be_paid: true,
              } satisfies TablesUpdate<'pending_payments'>)
              .eq('id', payment.id);
          }
        }
      }
    }

    revalidatePath('/(app)/commissions');
    revalidatePath('/(app)/checks');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Alias for compatibility
export async function actionApplyAdvanceDiscount(payload: any) {
  return actionApplyAdvancePayment({
    advance_id: payload.advance_id,
    amount: payload.amount,
    payment_type: payload.payment_type || 'fortnight',
    fortnight_id: payload.fortnight_id,
    broker_id: payload.broker_id,
  });
}

export async function actionCreateClaim(payload: { comm_item_id: string; broker_id: string }) {
  try {
    const supabase = getSupabaseAdmin();
    const { comm_item_id, broker_id } = payload;

    const { data, error } = await supabase
      .from('comm_item_claims')
      .insert([{
        comm_item_id,
        broker_id,
        status: 'pending',
      }])
      .select();

    if (error) {
      throw new Error(error.message);
    }
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionResolveClaim(payload: unknown) {
  try {
    const parsed = payload as {
      claim_id: string;
      status: string;
      broker_id: string;
      comm_item_id: string;
    };
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('comm_item_claims')
      .update({ status: parsed.status, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('id', parsed.claim_id);

    if (error) throw error;

    if (parsed.status === 'approved') {
      const { error: updateItemError } = await supabase
        .from('comm_items')
        .update({ broker_id: parsed.broker_id })
        .eq('id', parsed.comm_item_id);
      if (updateItemError) throw updateItemError;
    }

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Assign pending items to a broker
export async function actionResolvePendingGroups(payload: unknown) {
  try {
    const parsed = ResolvePendingSchema.parse(payload);
    const supabase = getSupabaseAdmin();

    let targetIds = parsed.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', parsed.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para asignar.' };
    }
    const { data, error } = await supabase
      .from('pending_items')
      .update({
        assigned_broker_id: parsed.broker_id,
      })
      .in('id', targetIds)
      .eq('status', 'open')
      .select('id');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionCreateAdvance(payload: { broker_id: string; amount: number; reason: string }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    const { broker_id, amount, reason } = payload;

    const { data, error } = await supabase
      .from('advances')
      .insert([{
        broker_id,
        amount,
        reason,
        status: 'PENDING',
        created_by: userId,
      } satisfies AdvanceIns])
      .select();

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Alias for compatibility
export async function actionAddAdvance(brokerId: string, payload: { amount: number; reason: string }) {
  return actionCreateAdvance({
    broker_id: brokerId,
    amount: payload.amount,
    reason: payload.reason,
  });
}

// Update advance
export async function actionUpdateAdvance(advanceId: string, payload: { amount: number; reason: string }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    console.log('[actionUpdateAdvance] Updating advance:', advanceId, payload);
    
    const { data, error } = await supabase
      .from('advances')
      .update({
        amount: payload.amount,
        reason: payload.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', advanceId)
      .select()
      .single();
    
    if (error) {
      console.error('[actionUpdateAdvance] Error:', error);
      throw error;
    }
    
    console.log('[actionUpdateAdvance] Updated successfully:', data.id);
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    console.error('[actionUpdateAdvance] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionRejectAdvance(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('advances')
      .update({ status: 'REJECTED' })
      .eq('id', advanceId);

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ============================================
// ADVANCE RECURRENCES
// ============================================

export async function actionGetAdvanceRecurrences(brokerId?: string) {
  try {
    console.log('[actionGetAdvanceRecurrences] Fetching recurrences for broker:', brokerId);
    const supabase = getSupabaseAdmin();
    
    let query = (supabase as any)
      .from('advance_recurrences')
      .select('*, brokers(id, name)')
      .order('created_at', { ascending: false });
    
    if (brokerId) {
      console.log('[actionGetAdvanceRecurrences] Filtering by broker_id:', brokerId);
      query = query.eq('broker_id', brokerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[actionGetAdvanceRecurrences] Error:', error);
      throw error;
    }
    
    console.log('[actionGetAdvanceRecurrences] Found', data?.length || 0, 'recurrences');
    console.log('[actionGetAdvanceRecurrences] Data:', JSON.stringify(data, null, 2));
    
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionCreateAdvanceRecurrence(payload: {
  broker_id: string;
  amount: number;
  reason: string;
  fortnight_type: 'Q1' | 'Q2' | 'BOTH';
  end_date: string | null;
}) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    console.log('[actionCreateAdvanceRecurrence] Creating recurrence:', payload);
    
    // 1. Crear la recurrencia
    const { data: recurrence, error: recurrenceError } = await (supabase as any)
      .from('advance_recurrences')
      .insert({
        broker_id: payload.broker_id,
        amount: payload.amount,
        reason: payload.reason,
        fortnight_type: payload.fortnight_type,
        end_date: payload.end_date,
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        created_by: userId,
        recurrence_count: 0,
      })
      .select()
      .single();
    
    if (recurrenceError) {
      console.error('[actionCreateAdvanceRecurrence] Error creating recurrence:', recurrenceError);
      throw recurrenceError;
    }
    
    console.log('[actionCreateAdvanceRecurrence] Recurrence created:', recurrence.id);
    
    // 2. Generar adelanto(s) inmediatamente
    const advancesToCreate = [];
    
    if (payload.fortnight_type === 'BOTH') {
      // Crear DOS adelantos: uno para Q1 y otro para Q2
      advancesToCreate.push({
        broker_id: payload.broker_id,
        amount: payload.amount,
        reason: `${payload.reason} (Recurrente Q1)`,
        status: 'pending',
        created_by: userId,
        is_recurring: true,
        recurrence_id: recurrence.id,
      });
      advancesToCreate.push({
        broker_id: payload.broker_id,
        amount: payload.amount,
        reason: `${payload.reason} (Recurrente Q2)`,
        status: 'pending',
        created_by: userId,
        is_recurring: true,
        recurrence_id: recurrence.id,
      });
    } else {
      // Crear UN adelanto para la quincena especificada
      const quincenaText = payload.fortnight_type === 'Q1' ? 'Q1' : 'Q2';
      advancesToCreate.push({
        broker_id: payload.broker_id,
        amount: payload.amount,
        reason: `${payload.reason} (Recurrente ${quincenaText})`,
        status: 'pending',
        created_by: userId,
        is_recurring: true,
        recurrence_id: recurrence.id,
      });
    }
    
    const { data: createdAdvances, error: advanceError } = await supabase
      .from('advances')
      .insert(advancesToCreate)
      .select();
    
    if (advanceError) {
      console.error('[actionCreateAdvanceRecurrence] Error creating advances:', advanceError);
      throw advanceError;
    }
    
    console.log('[actionCreateAdvanceRecurrence] Created', createdAdvances?.length || 0, 'advance(s)');
    
    // 3. Actualizar contador de la recurrencia
    const now = new Date().toISOString();
    const countToAdd = advancesToCreate.length; // 1 o 2
    const { error: updateError } = await (supabase as any)
      .from('advance_recurrences')
      .update({
        recurrence_count: countToAdd,
        last_generated_at: now,
      })
      .eq('id', recurrence.id);
    
    if (updateError) {
      console.error('[actionCreateAdvanceRecurrence] Error updating recurrence count:', updateError);
      // No lanzamos error aquí porque el adelanto ya se creó
    }
    
    console.log('[actionCreateAdvanceRecurrence] Recurrence completed successfully');
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: recurrence };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionUpdateAdvanceRecurrence(
  id: string,
  payload: { amount?: number; reason?: string; is_active?: boolean }
) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await (supabase as any)
      .from('advance_recurrences')
      .update(payload)
      .eq('id', id);
    
    if (error) throw error;
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionDeleteAdvanceRecurrence(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await (supabase as any)
      .from('advance_recurrences')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Eliminar un adelanto con validación de historial
 * - Si NO tiene historial: ELIMINA completamente el adelanto
 * - Si SÍ tiene historial: Cambia status a PAID para que aparezca en "Deudas Saldadas"
 */
export async function actionDeleteAdvance(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Verificar si el adelanto existe
    const { data: advance, error: fetchError } = await supabase
      .from('advances')
      .select('id, is_recurring, recurrence_id, status, amount, brokers(name)')
      .eq('id', advanceId)
      .single();
    
    if (fetchError || !advance) {
      return {
        ok: false as const,
        error: 'Adelanto no encontrado',
      };
    }
    
    // 2. Verificar si tiene historial de pagos
    const { data: logs, error: logsError } = await supabase
      .from('advance_logs')
      .select('id, amount')
      .eq('advance_id', advanceId);
    
    if (logsError) {
      return {
        ok: false as const,
        error: 'Error al verificar historial de pagos',
      };
    }
    
    const hasPaymentHistory = logs && logs.length > 0;
    
    // 2.5. ADELANTOS RECURRENTES: Simplemente eliminar
    // El sistema NO los recreará automáticamente porque sync-recurrences verifica si ya existe
    if (advance.is_recurring && advance.recurrence_id) {
      console.log(`🗑️ Adelanto recurrente ${advanceId}: eliminando`);
      
      const { error: deleteError } = await supabase
        .from('advances')
        .delete()
        .eq('id', advanceId);
      
      if (deleteError) {
        console.error('Error eliminando adelanto recurrente:', deleteError);
        return {
          ok: false as const,
          error: 'Error al eliminar adelanto recurrente',
        };
      }
      
      revalidatePath('/(app)/commissions');
      return { 
        ok: true as const,
        message: 'Adelanto recurrente eliminado',
      };
    }
    
    // 3. Si NO tiene historial: ELIMINAR completamente (solo para NO recurrentes)
    if (!hasPaymentHistory) {
      // Primero, buscar y eliminar pagos pendientes asociados a este adelanto
      const { data: pendingPayments } = await supabase
        .from('pending_payments')
        .select('id, notes')
        .ilike('notes', `%${advanceId}%`);
      
      if (pendingPayments && pendingPayments.length > 0) {
        console.log(`🧹 Eliminando ${pendingPayments.length} pago(s) pendiente(s) asociado(s) al adelanto ${advanceId}`);
        
        // Verificar que realmente contienen el advance_id en los metadata
        const validPaymentIds: string[] = [];
        (pendingPayments || []).forEach(p => {
          try {
            const metadata = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
            if (metadata?.advance_id === advanceId) {
              validPaymentIds.push(p.id);
            }
          } catch (e) {
            // Ignorar si no se puede parsear
          }
        });
        
        if (validPaymentIds.length > 0) {
          // Eliminar referencias primero
          await supabase
            .from('payment_references')
            .delete()
            .in('payment_id', validPaymentIds);
          
          // Eliminar pagos pendientes
          const { error: deletePaymentsError } = await supabase
            .from('pending_payments')
            .delete()
            .in('id', validPaymentIds);
          
          if (deletePaymentsError) {
            console.error('Error eliminando pagos pendientes asociados:', deletePaymentsError);
          }
        }
      }
      
      // Ahora eliminar el adelanto
      const { error: deleteError } = await supabase
        .from('advances')
        .delete()
        .eq('id', advanceId);
      
      if (deleteError) {
        return {
          ok: false as const,
          error: `Error al eliminar adelanto: ${deleteError.message}`,
        };
      }
      
      revalidatePath('/(app)/commissions');
      return { 
        ok: true as const
      };
    }
    
    // Si llegamos aquí, no se cumplió ninguna condición anterior
    return {
      ok: false as const,
      error: 'El adelanto tiene historial de pagos y no se puede eliminar',
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido al eliminar adelanto',
    };
  }
}

export async function actionCheckAdvanceHasHistory(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: logs, error } = await supabase
      .from('advance_logs')
      .select('id')
      .eq('advance_id', advanceId)
      .limit(1);
    
    if (error) {
      return {
        ok: false as const,
        error: 'Error al verificar historial',
        hasHistory: false,
      };
    }
    
    return {
      ok: true as const,
      hasHistory: logs && logs.length > 0,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
      hasHistory: false,
    };
  }
}

export async function actionReassignAdvance(advanceId: string, broker_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('advances')
      .update({ broker_id })
      .eq('id', advanceId);

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ============================================
// RETAINED COMMISSIONS
// ============================================

export async function actionRetainBrokerPayment(payload: {
  fortnight_id: string;
  broker_id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Marcar como retenido en fortnight_broker_totals
    const { error } = await supabase
      .from('fortnight_broker_totals')
      .update({ is_retained: true } satisfies TablesUpdate<'fortnight_broker_totals'>)
      .eq('fortnight_id', payload.fortnight_id)
      .eq('broker_id', payload.broker_id);
    
    if (error) throw error;
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionUnretainBrokerPayment(payload: {
  fortnight_id: string;
  broker_id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Quitar retención
    const { error } = await supabase
      .from('fortnight_broker_totals')
      .update({ is_retained: false } satisfies TablesUpdate<'fortnight_broker_totals'>)
      .eq('fortnight_id', payload.fortnight_id)
      .eq('broker_id', payload.broker_id);
    
    if (error) throw error;
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionGetRetainedCommissions() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener todas las comisiones retenidas (cerradas)
    const { data, error } = await (supabase as any)
      .from('retained_commissions')
      .select('*, brokers(id, name), fortnights(period_start, period_end)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtener estado de retención para un broker en una quincena específica
 */
export async function actionGetRetentionStatus(brokerId: string, fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Buscar si hay retención para este broker en esta quincena
    const { data: retention, error } = await supabase
      .from('retained_commissions')
      .select(`
        id,
        status,
        net_amount,
        fortnight_id,
        applied_fortnight_id,
        applied_fortnight:fortnights!retained_commissions_applied_fortnight_id_fkey(
          id,
          period_start,
          period_end,
          fortnight_number
        )
      `)
      .eq('broker_id', brokerId)
      .eq('fortnight_id', fortnightId)
      .single();
    
    if (error) {
      // No existe retención para este broker/quincena
      if (error.code === 'PGRST116') {
        return { ok: true as const, data: null };
      }
      throw error;
    }

    return { ok: true as const, data: retention };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionPayRetainedCommission(payload: {
  retained_id: string;
  pay_option: 'immediate' | 'next_fortnight';
}) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    if (payload.pay_option === 'immediate') {
      // Marcar como pagado inmediatamente
      const { error } = await (supabase as any)
        .from('retained_commissions')
        .update({
          status: 'paid_immediate',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payload.retained_id);
      
      if (error) throw error;
    } else {
      // Marcar como aplicado a siguiente quincena
      const { error } = await (supabase as any)
        .from('retained_commissions')
        .update({
          status: 'paid_in_fortnight',
        })
        .eq('id', payload.retained_id);
      
      if (error) throw error;
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionApplyRetainedToAdvance(payload: {
  retained_id: string;
  advance_id: string;
  amount: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener info de la retención
    const { data: retained, error: retainedError } = await (supabase as any)
      .from('retained_commissions')
      .select('*, fortnights(period_start, period_end)')
      .eq('id', payload.retained_id)
      .single();
    
    if (retainedError) throw retainedError;
    
    // Aplicar el pago al adelanto
    const result = await actionApplyAdvancePayment({
      advance_id: payload.advance_id,
      amount: payload.amount,
      payment_type: 'retained_commission',
      reference_number: `Retenido Q${retained.fortnights.period_start}`,
    });
    
    if (!result.ok) throw new Error(result.error);
    
    // Marcar la retención como aplicada
    const { error } = await (supabase as any)
      .from('retained_commissions')
      .update({
        status: 'applied_to_advance',
        applied_advance_id: payload.advance_id,
      })
      .eq('id', payload.retained_id);
    
    if (error) throw error;
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get advance history
export async function actionGetAdvanceHistory(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener información del adelanto
    const { data: advance, error: advError } = await supabase
      .from('advances')
      .select('*, advance_recurrences(amount)')
      .eq('id', advanceId)
      .single();
    
    if (advError) throw advError;
    
    // Obtener logs de pagos
    const { data: logs, error } = await supabase
      .from('advance_logs')
      .select('*, fortnights(period_start, period_end)')
      .eq('advance_id', advanceId)
      .order('created_at', { ascending: true }); // Ordenar ASC para calcular deudas

    if (error) throw error;

    // Calcular monto inicial
    const initialAmount = (advance as any).is_recurring && (advance as any).advance_recurrences
      ? (advance as any).advance_recurrences.amount
      : (advance as any).amount + (logs || []).reduce((sum: number, log: any) => sum + Number(log.amount), 0);

    return { 
      ok: true as const, 
      data: logs,
      advance: {
        id: (advance as any).id,
        reason: (advance as any).reason,
        initial_amount: initialAmount,
        current_amount: (advance as any).amount,
        status: (advance as any).status,
        is_recurring: (advance as any).is_recurring
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Toggle notification setting for a fortnight
export async function actionToggleNotify(fortnightId: string, on: boolean) {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('fortnights')
      .update({ notify_brokers: on } satisfies FortnightUpd)
      .eq('id', fortnightId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
    };
  }
}

// Delete import
export async function actionDeleteImport(importId: string) {
  try {
    console.log('[actionDeleteImport] Iniciando eliminación de import:', importId);
    const supabase = getSupabaseAdmin();

    // Get import data to verify it's from a DRAFT fortnight
    const { data: importData, error: getError } = await supabase
      .from('comm_imports')
      .select('id, period_label')
      .eq('id', importId)
      .single();

    console.log('[actionDeleteImport] Import encontrado:', importData);
    
    if (getError || !importData) {
      console.error('[actionDeleteImport] Error buscando import:', getError);
      return { ok: false as const, error: 'Importación no encontrada.' };
    }

    // Verify fortnight is DRAFT
    const { data: fortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('status')
      .eq('id', importData.period_label)
      .single();

    console.log('[actionDeleteImport] Fortnight status:', fortnight?.status);

    if (fortnightError || fortnight?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar importaciones de quincenas en borrador.' };
    }

    // Delete all comm_items associated with this import
    console.log('[actionDeleteImport] Eliminando comm_items...');
    const { error: itemsError, count: itemsCount } = await supabase
      .from('comm_items')
      .delete({ count: 'exact' })
      .eq('import_id', importId);

    if (itemsError) {
      console.error('[actionDeleteImport] Error eliminando items:', itemsError);
      throw new Error(`Error eliminando items: ${itemsError.message}`);
    }
    console.log('[actionDeleteImport] Items eliminados:', itemsCount);

    // Delete the import record
    console.log('[actionDeleteImport] Eliminando import...');
    const { error: importError } = await supabase
      .from('comm_imports')
      .delete()
      .eq('id', importId);

    if (importError) {
      console.error('[actionDeleteImport] Error eliminando import:', importError);
      throw new Error(`Error eliminando importación: ${importError.message}`);
    }

    // Eliminar fortnight_broker_totals de la quincena para limpiar datos
    console.log('[actionDeleteImport] Limpiando fortnight_broker_totals...');
    const { error: totalsDeleteError } = await supabase
      .from('fortnight_broker_totals')
      .delete()
      .eq('fortnight_id', importData.period_label);
    
    if (totalsDeleteError) {
      console.error('[actionDeleteImport] Error eliminando totales:', totalsDeleteError);
    }

    // Recalcular totales de la quincena para actualizar fortnight_broker_totals
    console.log('[actionDeleteImport] Recalculando totales de quincena...');
    const recalcResult = await actionRecalculateFortnight(importData.period_label);
    if (!recalcResult.ok) {
      console.error('[actionDeleteImport] Error recalculando:', recalcResult.error);
      // No fallamos por esto, pero lo loggeamos
    }

    console.log('[actionDeleteImport] ✓ Import eliminado exitosamente');
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    console.error('[actionDeleteImport] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get closed fortnights
export async function actionGetClosedFortnights(year: number, month: number, fortnight?: number, brokerId?: string | null) {
  try {
    const supabase = getSupabaseAdmin();
    // Usar Date.UTC para generar fechas en UTC correctamente
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = new Date(Date.UTC(year, month - 1, lastDay)).toISOString().split('T')[0];

    let query = supabase
      .from('fortnights')
      .select(`
        *,
        fortnight_broker_totals (
          *,
          brokers ( name )
        )
      `)
      .eq('status', 'PAID')
      .gte('period_start', startDate)
      .lte('period_end', endDate);

    if (fortnight === 1) {
      const q1End = new Date(Date.UTC(year, month - 1, 15)).toISOString().split('T')[0];
      query = query.lte('period_start', q1End);
    } else if (fortnight === 2) {
      const q2Start = new Date(Date.UTC(year, month - 1, 16)).toISOString().split('T')[0];
      query = query.gte('period_start', q2Start);
    }

    const { data: fortnights, error: fError } = await query.order('period_start', { ascending: false });

    if (fError) throw fError;

    // Get all comm_items for the entire month in one go
    const { data: allCommItems, error: itemsError } = await supabase
      .from('comm_items')
      .select('gross_amount, insurer_id, insurers(name), created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (itemsError) throw itemsError;

    // Get comm_imports para totales de aseguradoras
    const { data: commImports, error: importsError } = await supabase
      .from('comm_imports')
      .select('total_amount, insurer_id, insurers(name)');

    if (importsError) {
      console.error('Error loading comm_imports:', importsError);
    }

    const formattedData = (fortnights || []).map((f: any) => {
      const brokerTotals = f.fortnight_broker_totals || [];
      const fortnightStart = new Date(f.period_start);
      const fortnightEnd = new Date(f.period_end);

      // Filter items for the specific fortnight in memory
      const commItems = (allCommItems || []).filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= fortnightStart && itemDate <= fortnightEnd;
      });

      // Totales simples
      const total_imported = (commImports || []).reduce((sum, imp) => sum + (Number(imp.total_amount) || 0), 0);
      const total_paid_net = brokerTotals.reduce((sum: number, bt: any) => sum + (Number(bt.net_amount) || 0), 0);
      const total_office_profit = total_imported - total_paid_net;

      // Calcular totales por aseguradora
      const totalsByInsurer = (commImports || []).reduce((acc, imp) => {
        if (!imp.insurers) return acc;
        const insurerName = imp.insurers.name || 'Desconocido';
        acc[insurerName] = (acc[insurerName] || 0) + (Number(imp.total_amount) || 0);
        return acc;
      }, {} as Record<string, number>);

      const paidByInsurer = commItems.reduce((acc, item) => {
        if (!item.insurers) return acc;
        const insurerName = item.insurers.name || 'Desconocido';
        acc[insurerName] = (acc[insurerName] || 0) + (Number(item.gross_amount) || 0);
        return acc;
      }, {} as Record<string, number>);

      const filteredBrokers = brokerId
        ? brokerTotals.filter((bt: any) => bt.broker_id === brokerId)
        : brokerTotals;

      if (brokerId && filteredBrokers.length === 0) {
        return null;
      }

      // Determinar quincena correctamente según el día de inicio
      const startDay = fortnightStart.getUTCDate();
      const fortnightNum = startDay <= 15 ? 1 : 2;
      
      return {
        id: f.id,
        label: `Q${fortnightNum} - ${fortnightStart.toLocaleString('es-PA', { month: 'short', timeZone: 'UTC' })}. ${fortnightStart.getUTCFullYear()}`,
        fortnight_number: fortnightNum,
        total_imported,
        total_paid_net,
        total_paid_gross: brokerTotals.reduce((sum: number, bt: any) => sum + (Number(bt.gross_amount) || 0), 0),
        total_office_profit,
        totalsByInsurer: Object.entries(totalsByInsurer).map(([name, total]) => ({ 
          name, 
          total, 
          paid: paidByInsurer[name] || 0,
          office_total: total - (paidByInsurer[name] || 0)
        })).sort((a, b) => b.total - a.total),
        brokers: filteredBrokers.map((bt: any) => ({
          broker_id: bt.broker_id,
          broker_name: bt.brokers?.name || 'N/A',
          net_amount: bt.net_amount,
          gross_amount: bt.gross_amount,
          discounts_json: bt.discounts_json,
        })).sort((a: any, b: any) => b.net_amount - a.net_amount),
      };
    });

    return { ok: true as const, data: formattedData.filter(Boolean) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get last closed fortnight
export async function actionGetLastClosedFortnight() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('fortnights')
      .select('period_end')
      .eq('status', 'PAID')
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { ok: true as const, data: null };
      }
      throw error;
    }

    return { ok: true as const, data: data?.period_end || null };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get pending items
export async function actionGetPendingItems() {
  try {
    console.log('[actionGetPendingItems] Fetching pending items...');
    const supabase = getSupabaseAdmin();
    const { role, brokerId } = await getAuthContext();

    // 1. Buscar en pending_items: SOLO status='open' realmente sin asignar
    // TANTO MASTER COMO BROKER ven items status='open' SIN assigned_broker_id (sin identificar)
    // Los brokers pueden "marcar mío" seleccionándolos y enviando reporte de ajuste
    let pendingQuery = supabase
      .from('pending_items')
      .select(`
        id,
        insured_name,
        policy_number,
        commission_raw,
        created_at,
        status,
        fortnight_id,
        assigned_broker_id,
        insurers ( name )
      `)
      .eq('status', 'open') // CRÍTICO: Solo items realmente sin identificar
      .is('assigned_broker_id', null) // CRÍTICO: Sin broker asignado
      .order('created_at', { ascending: true });
    
    // Tanto master como broker ven todos los items sin identificar
    
    const { data: pendingData, error: pendingError } = await pendingQuery;

    if (pendingError) {
      console.error('[actionGetPendingItems] Error pending_items:', pendingError);
    }

    // 2. Buscar en comm_items (comisiones del bulk upload)
    // TANTO MASTER COMO BROKER ven items SIN broker_id (sin identificar)
    // Los brokers pueden "marcar mío" seleccionándolos y enviando reporte de ajuste
    let commQuery = supabase
      .from('comm_items')
      .select('*, insurers(id, name)')
      .is('broker_id', null)
      .order('created_at', { ascending: true });
    
    const { data: commData, error: commError } = await commQuery;

    if (commError) {
      console.error('[actionGetPendingItems] Error comm_items:', commError);
    }

    // 3. Combinar ambos resultados
    const formattedPending = (pendingData || []).map(item => ({
      id: item.id,
      policy_number: item.policy_number,
      insured_name: item.insured_name,
      gross_amount: Number((item as any).commission_raw) || 0,
      created_at: item.created_at,
      status: item.status,
      fortnight_id: item.fortnight_id,
      insurers: item.insurers,
      source: 'pending_items' as const,
    }));

    const formattedComm = (commData || []).map(item => ({
      id: item.id,
      policy_number: item.policy_number,
      insured_name: item.insured_name,
      gross_amount: Number(item.gross_amount) || 0,
      created_at: item.created_at,
      status: 'open' as const,
      insurers: item.insurers,
      source: 'comm_items' as const,
    }));

    const allPending = [...formattedPending, ...formattedComm]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    console.log('[actionGetPendingItems] Found:', {
      pending_items: formattedPending.length,
      comm_items: formattedComm.length,
      total: allPending.length
    });

    return { ok: true as const, data: allPending };
  } catch (error) {
    console.error('[actionGetPendingItems] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get draft details
export async function actionGetDraftDetails(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Primero obtener IDs de imports de esta quincena
    const { data: imports, error: importsError } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnightId);
    
    if (importsError) throw importsError;
    
    if (!imports || imports.length === 0) {
      return { ok: true as const, data: [] };
    }
    
    const importIds = imports.map(i => i.id);
    
    // Luego obtener comm_items de esos imports
    const { data, error } = await supabase
      .from('comm_items')
      .select(`
        id,
        gross_amount,
        insured_name,
        brokers (id, name),
        insurers (id, name)
      `)
      .in('import_id', importIds)
      .not('broker_id', 'is', null);

    if (error) throw error;

    // Convert gross_amount from unknown to number
    const formattedData = (data || []).map((item: any) => ({
      ...item,
      gross_amount: Number(item.gross_amount) || 0
    }));

    return { ok: true as const, data: formattedData };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Marcar items como míos - SOLO asignar broker_id, NO migrar
export async function actionMarkItemsAsMine(itemIds: string[]) {
  try {
    console.log('[actionMarkItemsAsMine] Asignando broker a items:', itemIds);
    const { userId, brokerId } = await getAuthContext();
    if (!brokerId) throw new Error('User is not a broker.');

    const supabase = getSupabaseAdmin();

    // SOLO actualizar assigned_broker_id - mantener status 'open'
    const { error } = await supabase
      .from('pending_items')
      .update({
        assigned_broker_id: brokerId,
        assigned_at: new Date().toISOString(),
      })
      .in('id', itemIds)
      .eq('status', 'open');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    console.error('[actionMarkItemsAsMine] Error:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Enviar reporte de ajustes - Migrar a comm_items Y crear claims
export async function actionClaimPendingItem(pendingItemIds: string[]) {
  try {
    console.log('[actionClaimPendingItem] Migrando y creando claims para items:', pendingItemIds);
    const { userId, brokerId } = await getAuthContext();
    if (!brokerId) throw new Error('User is not a broker.');

    const supabase = getSupabaseAdmin();

    // 1. Migrar pending_items a comm_items
    const migrateResult = await actionMigratePendingToCommItems(pendingItemIds);
    
    if (!migrateResult.ok || !migrateResult.data?.commItemIds) {
      throw new Error(migrateResult.error || 'Error al migrar items');
    }

    const commItemIds = migrateResult.data.commItemIds;
    console.log('[actionClaimPendingItem] Items migrados a comm_items:', commItemIds);

    // 2. Crear registros en comm_item_claims (según documento)
    const claimsToInsert = commItemIds.map(commItemId => ({
      comm_item_id: commItemId,
      broker_id: brokerId,
      status: 'pending',
    }));

    const { error: claimsError } = await supabase
      .from('comm_item_claims')
      .insert(claimsToInsert);

    if (claimsError) {
      console.error('[actionClaimPendingItem] Error creando claims:', claimsError);
      throw claimsError;
    }

    console.log('[actionClaimPendingItem] Claims creados exitosamente:', claimsToInsert.length);

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { claims: claimsToInsert.length } };
  } catch (error) {
    console.error('[actionClaimPendingItem] Error:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Auto-assign old pending items to office broker
export async function actionAutoAssignOldPendingItems() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Find office broker by email
    const { data: officeBroker, error: brokerError } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();

    if (brokerError || !officeBroker) {
      return { ok: false as const, error: 'No se encontró el broker de oficina' };
    }

    // Find pending items older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: oldItems, error: itemsError } = await supabase
      .from('pending_items')
      .select('id, policy_number')
      .eq('status', 'open')
      .is('assigned_broker_id', null)
      .lt('created_at', ninetyDaysAgo.toISOString());

    if (itemsError) throw itemsError;

    if (!oldItems || oldItems.length === 0) {
      return { ok: true as const, data: { assigned: 0 } };
    }

    // Group by policy for better assignment
    const itemIds = oldItems.map(item => item.id);

    // Assign to office broker
    const { error: updateError } = await supabase
      .from('pending_items')
      .update({ assigned_broker_id: officeBroker.id })
      .in('id', itemIds);

    if (updateError) throw updateError;

    // Migrate to comm_items
    const migrateResult = await actionMigratePendingToCommItems(itemIds);
    
    if (!migrateResult.ok) {
      console.error('Error al migrar items antiguos:', migrateResult.error);
    }

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { assigned: itemIds.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Delete draft fortnight
export async function actionDeleteDraft(fortnightId: string) {
  try {
    console.log('[actionDeleteDraft] Iniciando eliminación de borrador:', fortnightId);
    const supabase = getSupabaseAdmin();

    // Verify it's a draft
    const { data: fortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('status')
      .eq('id', fortnightId)
      .single<Pick<FortnightRow, 'status'>>();

    console.log('[actionDeleteDraft] Fortnight encontrada:', fortnight);
    if (fortnightError) {
      console.error('[actionDeleteDraft] Error buscando fortnight:', fortnightError);
      throw fortnightError;
    }

    if (fortnight?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar quincenas en borrador.' };
    }

    // Delete fortnight_broker_totals FIRST (no dependencies)
    console.log('[actionDeleteDraft] Eliminando totals...');
    await supabase
      .from('fortnight_broker_totals')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Delete temp imports if any (no dependencies)
    console.log('[actionDeleteDraft] Eliminando temp imports...');
    await supabase
      .from('temp_client_import')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Get all imports BEFORE deleting items
    console.log('[actionDeleteDraft] Buscando imports...');
    const { data: imports } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnightId);

    console.log('[actionDeleteDraft] Imports encontrados:', imports?.length || 0);

    // Delete comm_items by import_id
    if (imports && imports.length > 0) {
      for (const imp of imports) {
        console.log('[actionDeleteDraft] Eliminando items de import:', imp.id);
        await supabase
          .from('comm_items')
          .delete()
          .eq('import_id', imp.id);
      }
      
      // Now delete imports
      console.log('[actionDeleteDraft] Eliminando imports...');
      await supabase
        .from('comm_imports')
        .delete()
        .eq('period_label', fortnightId);
    }

    // Delete any orphan comm_items
    console.log('[actionDeleteDraft] Eliminando items huérfanos...');
    await supabase
      .from('comm_items')
      .delete()
      .eq('fortnight_id', fortnightId);

    // REVERTIR VÍNCULOS BANCO TEMPORALES
    console.log('[actionDeleteDraft] Revirtiendo vínculos banco temporales...');
    if (imports && imports.length > 0) {
      const importIds = imports.map(i => i.id);
      
      // Obtener transferencias con vínculos temporales para revertir estado
      const { data: tempTransfers } = await (supabase as any)
        .from('bank_transfer_imports')
        .select('transfer_id')
        .in('import_id', importIds)
        .eq('is_temporary', true);
      
      if (tempTransfers && tempTransfers.length > 0) {
        const transferIds = tempTransfers.map((t: any) => t.transfer_id);
        
        // Revertir transferencias marcadas como OK temporalmente a PENDIENTE
        await supabase
          .from('bank_transfers_comm')
          .update({ status: 'PENDIENTE' })
          .in('id', transferIds)
          .eq('status', 'OK_CONCILIADO'); // Solo revertir las que están en OK
        
        console.log(`[actionDeleteDraft] ✓ ${transferIds.length} transferencias revertidas a PENDIENTE`);
      }
      
      // Eliminar vínculos temporales de transfers
      await (supabase as any)
        .from('bank_transfer_imports')
        .delete()
        .in('import_id', importIds)
        .eq('is_temporary', true);
      
      // Eliminar vínculos temporales de groups (no se revierten estados de grupos)
      await (supabase as any)
        .from('bank_group_imports')
        .delete()
        .in('import_id', importIds)
        .eq('is_temporary', true);
      
      console.log('[actionDeleteDraft] ✓ Vínculos banco temporales eliminados');
    }
    
    // Delete advance_logs that reference this fortnight (CRITICAL: must be before fortnight deletion)
    console.log('[actionDeleteDraft] Eliminando advance_logs...');
    await supabase
      .from('advance_logs')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Delete fortnight
    console.log('[actionDeleteDraft] Eliminando fortnight...');
    const { error: deleteError } = await supabase
      .from('fortnights')
      .delete()
      .eq('id', fortnightId);

    if (deleteError) {
      console.error('[actionDeleteDraft] Error eliminando fortnight:', deleteError);
      throw deleteError;
    }

    console.log('[actionDeleteDraft] ✓ Borrador eliminado exitosamente');
    revalidatePath('/commissions');
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    console.error('[actionDeleteDraft] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Export bank CSV without closing fortnight
export async function actionExportBankCsv(fortnightId: string) {
  try {
    console.log('[actionExportBankCsv] Inicio para quincena:', fortnightId);
    const supabase = getSupabaseAdmin();

    // Get fortnight info
    console.log('[actionExportBankCsv] Obteniendo datos de quincena...');
    const { data: fortnight, error: fError } = await supabase
      .from('fortnights')
      .select('*')
      .eq('id', fortnightId)
      .single();

    if (fError || !fortnight) {
      console.error('[actionExportBankCsv] Error obteniendo quincena:', fError);
      throw new Error('Quincena no encontrada');
    }

    // Get imports for this fortnight
    const { data: imports } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnightId);
    
    if (!imports || imports.length === 0) {
      return {
        ok: true as const,
        bankACH: '',
        achErrors: [],
        achValidCount: 0,
        achTotalAmount: 0,
      };
    }
    
    const importIds = imports.map(i => i.id);
    
    // Get comm_items and sum by broker (IGUAL QUE LA UI)
    const { data: items } = await supabase
      .from('comm_items')
      .select(`
        broker_id,
        gross_amount,
        brokers (*)
      `)
      .in('import_id', importIds)
      .not('broker_id', 'is', null);
    
    if (!items || items.length === 0) {
      return {
        ok: true as const,
        bankACH: '',
        achErrors: [],
        achValidCount: 0,
        achTotalAmount: 0,
      };
    }
    
    // Agrupar por broker y sumar (EXACTAMENTE igual que BrokerTotals.tsx)
    const brokerGroups = items.reduce((acc: any, item: any) => {
      const brokerId = item.broker_id;
      if (!acc[brokerId]) {
        acc[brokerId] = {
          broker_id: brokerId,
          broker: item.brokers,
          gross_amount: 0,
          net_amount: 0
        };
      }
      acc[brokerId].gross_amount += Math.abs(Number(item.gross_amount) || 0);
      return acc;
    }, {});
    
    // Get retention status from fortnight_broker_totals
    const { data: brokerTotals } = await supabase
      .from('fortnight_broker_totals')
      .select('broker_id, is_retained')
      .eq('fortnight_id', fortnightId);
    
    // Apply retention and calculate net (gross - 0 descuentos for now)
    const totalsArray = Object.values(brokerGroups).map((bg: any) => {
      const total = brokerTotals?.find(bt => bt.broker_id === bg.broker_id);
      return {
        ...bg,
        is_retained: total?.is_retained || false,
        net_amount: bg.gross_amount // Por ahora sin descuentos
      };
    });
    
    // Filter: net > 0 AND not retained
    const filteredTotals = totalsArray.filter((t: any) => {
      console.log(`[actionExportBankCsv] Broker ${t.broker?.name}:`, {
        gross_amount: t.gross_amount,
        net_amount: t.net_amount,
        retained: t.is_retained
      });
      return t.net_amount > 0 && !t.is_retained;
    });
    
    console.log('[actionExportBankCsv] Totales filtrados:', filteredTotals.length);

    if (filteredTotals.length === 0) {
      return {
        ok: true as const,
        bankACH: '',
        achErrors: [],
        achValidCount: 0,
        achTotalAmount: 0,
      };
    }

    const totalsWithBroker = filteredTotals;

    // Generar label: Q1/Q2 MES AÑO - DD/MM/YYYY
    const endDate = new Date(fortnight.period_end);
    const day = endDate.getDate();
    const month = endDate.getMonth();
    const year = endDate.getFullYear();
    
    const quincena = day <= 15 ? 'Q1' : 'Q2';
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const mesNombre = meses[month];
    
    const now = new Date();
    const fechaDescarga = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    const fortnightLabel = `${quincena} ${mesNombre} ${year} - ${fechaDescarga}`;
    console.log('[actionExportBankCsv] Generando ACH con label:', fortnightLabel);
    console.log('[actionExportBankCsv] Primer broker a procesar:', totalsWithBroker[0]?.broker?.name);
    const achResult = await buildBankACH(totalsWithBroker, fortnightLabel);

    console.log('[actionExportBankCsv] ACH generado:', {
      contentLength: achResult.content.length,
      validCount: achResult.validCount,
      errors: achResult.errors.length,
      totalAmount: achResult.totalAmount
    });

    return {
      ok: true as const,
      bankACH: achResult.content,
      achErrors: achResult.errors,
      achValidCount: achResult.validCount,
      achTotalAmount: achResult.totalAmount,
    };
  } catch (error) {
    console.error('[actionExportBankCsv] Error:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Recalculate fortnight broker totals
 */
export async function actionRecalculateFortnight(fortnight_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Obtener todos los imports del draft
    const { data: imports, error: importsError } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnight_id);
    
    if (importsError) throw importsError;
    
    // Si no hay imports, limpiar fortnight_broker_totals y retornar
    if (!imports || imports.length === 0) {
      console.log('[actionRecalculateFortnight] No hay imports, limpiando totales...');
      await supabase
        .from('fortnight_broker_totals')
        .delete()
        .eq('fortnight_id', fortnight_id);
      
      return { ok: true as const, data: { message: 'No hay imports, totales limpiados' } };
    }
    
    const importIds = imports.map(i => i.id);
    
    // 2. Obtener todos los comm_items del draft
    const { data: items, error: itemsError } = await supabase
      .from('comm_items')
      .select('broker_id, gross_amount')
      .in('import_id', importIds)
      .not('broker_id', 'is', null);
    
    if (itemsError) throw itemsError;
    
    // 3. Agrupar por broker
    const brokerTotals = (items || []).reduce((acc, item) => {
      const brokerId = item.broker_id!;
      if (!acc[brokerId]) {
        acc[brokerId] = { gross: 0, items_count: 0 };
      }
      acc[brokerId].gross += Number(item.gross_amount) || 0;
      acc[brokerId].items_count += 1;
      return acc;
    }, {} as Record<string, { gross: number; items_count: number }>);
    
    // 4. Obtener descuentos aplicados desde advance_logs (no desde comm_metadata para evitar duplicados)
    const { data: advanceLogs } = await supabase
      .from('advance_logs')
      .select('advance_id, amount, advances!inner(broker_id, reason, recurrence_id, is_recurring)')
      .eq('fortnight_id', fortnight_id)
      .eq('payment_type', 'fortnight');
    
    // 5. Agrupar adelantos por broker, consolidando adelantos recurrentes
    const brokerAdvances: Record<string, { advance_id: string; amount: number; description: string }[]> = {};
    
    // Primero, agrupar por recurrence_id para adelantos recurrentes
    const recurrenceGroups: Record<string, { broker_id: string; reason: string; total: number; advance_ids: string[] }> = {};
    const nonRecurrentLogs: any[] = [];
    
    (advanceLogs || []).forEach(log => {
      try {
        const brokerId = (log.advances as any).broker_id;
        const description = (log.advances as any).reason || 'Adelanto';
        const recurrenceId = (log.advances as any).recurrence_id;
        const isRecurring = (log.advances as any).is_recurring;
        
        if (!brokerId) return;
        
        // Si es recurrente y tiene recurrence_id, agrupar
        if (isRecurring && recurrenceId) {
          const key = `${brokerId}_${recurrenceId}`;
          if (!recurrenceGroups[key]) {
            recurrenceGroups[key] = {
              broker_id: brokerId,
              reason: description,
              total: 0,
              advance_ids: []
            };
          }
          recurrenceGroups[key].total += Number(log.amount);
          recurrenceGroups[key].advance_ids.push(log.advance_id);
        } else {
          // Adelanto no recurrente, agregar directamente
          nonRecurrentLogs.push({
            broker_id: brokerId,
            advance_id: log.advance_id,
            amount: Number(log.amount),
            description: description
          });
        }
      } catch (e) {
        console.error('Error parsing advance log:', e);
      }
    });
    
    // Agregar adelantos recurrentes consolidados (un solo registro por recurrence_id)
    Object.values(recurrenceGroups).forEach(group => {
      if (group.advance_ids.length === 0) return; // Skip si no hay IDs
      
      const brokerId = group.broker_id;
      if (!brokerAdvances[brokerId]) {
        brokerAdvances[brokerId] = [];
      }
      
      const brokerAdvancesList = brokerAdvances[brokerId];
      if (brokerAdvancesList) {
        brokerAdvancesList.push({
          advance_id: group.advance_ids[0] || '',
          amount: group.total,
          description: group.reason
        });
      }
    });
    
    // Agregar adelantos no recurrentes
    nonRecurrentLogs.forEach(log => {
      const brokerId = log.broker_id;
      if (!brokerAdvances[brokerId]) {
        brokerAdvances[brokerId] = [];
      }
      
      const brokerAdvancesList = brokerAdvances[brokerId];
      if (brokerAdvancesList) {
        brokerAdvancesList.push({
          advance_id: log.advance_id,
          amount: log.amount,
          description: log.description
        });
      }
    });
    
    // 6. Calcular totales y crear/actualizar fortnight_broker_totals
    const upsertPromises = Object.entries(brokerTotals).map(async ([brokerId, totals]) => {
      const advances = brokerAdvances[brokerId] || [];
      const totalDiscounts = advances.reduce((sum, adv) => sum + adv.amount, 0);
      const netAmount = totals.gross - totalDiscounts;
      
      const { data: existing } = await supabase
        .from('fortnight_broker_totals')
        .select('id')
        .eq('fortnight_id', fortnight_id)
        .eq('broker_id', brokerId)
        .single();
      
      const payload: any = {
        fortnight_id,
        broker_id: brokerId,
        gross_amount: totals.gross,
        net_amount: netAmount,
        discounts_json: {
          adelantos: advances,
          total: totalDiscounts,
        },
      };
      
      if (existing) {
        return supabase
          .from('fortnight_broker_totals')
          .update(payload)
          .eq('id', existing.id);
      } else {
        return supabase
          .from('fortnight_broker_totals')
          .insert([payload]);
      }
    });
    
    await Promise.all(upsertPromises);
    
    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      data: { 
        brokers_count: Object.keys(brokerTotals).length,
        total_gross: Object.values(brokerTotals).reduce((s, t) => s + t.gross, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al recalcular',
    };
  }
}

/**
 * Pay/Close fortnight
 */
const toIsoDate = (value?: string | null) => {
  if (!value) return new Date().toISOString().split('T')[0];
  if (value.includes('T')) return value.split('T')[0];
  return value;
};

const formatFortnightLabel = (start?: string | null, end?: string | null) => {
  try {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const month = endDate.toLocaleDateString('es-PA', { month: 'long' });
    const year = endDate.getFullYear();
    return `del ${startDate.getUTCDate()} al ${endDate.getUTCDate()} de ${month} ${year}`;
  } catch (_err) {
    return '';
  }
};

export async function actionPayFortnight(fortnight_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Verificar que existe el draft
    const { data: fortnight, error: fnError } = await supabase
      .from('fortnights')
      .select('id, status, notify_brokers, period_start, period_end')
      .eq('id', fortnight_id)
      .single<FortnightRow>();
    
    if (fnError) throw fnError;
    if (!fortnight) throw new Error('Quincena no encontrada');
    if (fortnight.status === 'PAID') {
      return { ok: false as const, error: 'Esta quincena ya fue pagada' };
    }
    
    // 2. Recalcular automáticamente (seguridad)
    const recalcResult = await actionRecalculateFortnight(fortnight_id);
    if (!recalcResult.ok) {
      return { ok: false as const, error: 'Error al recalcular: ' + recalcResult.error };
    }
    
    // 3. Obtener totales por broker
    const { data: brokerTotals, error: totalsError } = await supabase
      .from('fortnight_broker_totals')
      .select(`
        *,
        brokers (
          id,
          name,
          bank_account_no,
          beneficiary_name
        )
      `)
      .eq('fortnight_id', fortnight_id);
    
    if (totalsError) throw totalsError;
    if (!brokerTotals || brokerTotals.length === 0) {
      return { ok: false as const, error: 'No hay totales calculados' };
    }
    
    // 4. Crear registros de retained_commissions para pagos retenidos
    for (const bt of brokerTotals) {
      if (bt.is_retained) {
        // Obtener detalle de comisiones por aseguradora para este broker
        const { data: commItems, error: itemsError } = await supabase
          .from('comm_items')
          .select('*, comm_imports(insurer_id, insurers(name))')
          .eq('fortnight_id', fortnight_id)
          .eq('broker_id', bt.broker_id);
        
        if (itemsError) throw itemsError;
        
        // Agrupar por aseguradora
        const insurersDetail: any = {};
        if (commItems) {
          for (const item of commItems) {
            const itemAny = item as any;
            const insurerName = itemAny.comm_imports?.insurers?.name || 'Sin aseguradora';
            if (!insurersDetail[insurerName]) {
              insurersDetail[insurerName] = {
                insurer: insurerName,
                clients: [],
                total: 0,
              };
            }
            insurersDetail[insurerName].clients.push({
              client_name: itemAny.insured_name || 'Sin nombre',
              policy_number: item.policy_number,
              amount: itemAny.gross_amount || 0,
            });
            insurersDetail[insurerName].total += itemAny.gross_amount || 0;
          }
        }
        
        // Calcular discount_amount del broker
        const btAny = bt as any;
        const discountAmount = btAny.discount_amount || (bt.gross_amount - bt.net_amount);
        
        // Crear retained_commission
        const { error: retainedError } = await (supabase as any)
          .from('retained_commissions')
          .insert({
            broker_id: bt.broker_id,
            fortnight_id: fortnight_id,
            gross_amount: bt.gross_amount,
            discount_amount: discountAmount,
            net_amount: bt.net_amount,
            status: 'pending',
            insurers_detail: insurersDetail,
            created_by: userId,
          });
        
        if (retainedError) throw retainedError;
      }
    }
    
    // 5. Generar CSV Banco (solo brokers con neto > 0 Y NO retenidos)
    const filteredTotals = brokerTotals
      .filter(bt => bt.net_amount > 0 && !bt.is_retained)
      .map(bt => ({
        ...bt,
        broker: bt.brokers as any
      }));
    
    // Generar label con período de la quincena
    const fortnightLabel = `PAGO COMISIONES ${formatFortnightLabel(fortnight.period_start, fortnight.period_end)}`.toUpperCase();
    const achResult = await buildBankACH(filteredTotals, fortnightLabel);
    const csvContent = achResult.content;
    
    // 6. MIGRAR ITEMS TEMPORALES DE ZONA DE TRABAJO
    console.log('[actionPayFortnight] Migrando items temporales...');
    
    const { data: draftItems, error: draftError } = await (supabase as any)
      .from('draft_unidentified_items')
      .select(`
        id,
        policy_number,
        insured_name,
        commission_raw,
        insurer_id,
        temp_assigned_broker_id,
        import_id,
        raw_row,
        brokers ( percent_default )
      `)
      .eq('fortnight_id', fortnight_id);
    
    if (draftError) {
      console.error('[actionPayFortnight] Error cargando draft items:', draftError);
      throw draftError;
    }
    
    if (draftItems && draftItems.length > 0) {
      const identified = draftItems.filter((item: any) => item.temp_assigned_broker_id);
      const unidentified = draftItems.filter((item: any) => !item.temp_assigned_broker_id);
      
      console.log(`[actionPayFortnight] Draft items - Identificados: ${identified.length}, Sin identificar: ${unidentified.length}`);
      
      // 6.1 Registrar identificados en preliminar
      // NOTA: Ya están en comm_items (insertados al momento de identificar manualmente)
      if (identified.length > 0) {
        console.log(`[actionPayFortnight] Procesando ${identified.length} items identificados (ya en comm_items)...`);
        
        // Solo registrar en preliminar para cada cliente identificado
        for (const item of identified) {
          try {
            const { data: existingPolicy } = await supabase
              .from('policies')
              .select('id, client_id')
              .eq('policy_number', item.policy_number)
              .single();
            
            if (existingPolicy) {
              // Verificar si ya existe en preliminar
              const { data: existingPrelim } = await (supabase as any)
                .from('preliminar')
                .select('id')
                .eq('client_id', existingPolicy.client_id)
                .eq('broker_id', item.temp_assigned_broker_id)
                .single();
              
              if (!existingPrelim) {
                await (supabase as any)
                  .from('preliminar')
                  .insert({
                    client_id: existingPolicy.client_id,
                    broker_id: item.temp_assigned_broker_id,
                    notes: 'Identificado en zona de trabajo de Nueva Quincena'
                  });
                
                console.log(`[actionPayFortnight] Cliente ${item.policy_number} registrado en preliminar`);
              }
            }
          } catch (prelimError) {
            console.error('[actionPayFortnight] Error registrando en preliminar:', prelimError);
            // No fallar el proceso completo
          }
        }
      }
      
      // 6.2 Migrar sin identificar a pending_items (ajustes)
      if (unidentified.length > 0) {
        const pendingItemsToInsert = unidentified.map((item: any) => ({
          insured_name: item.insured_name,
          policy_number: item.policy_number,
          insurer_id: item.insurer_id,
          commission_raw: item.commission_raw,
          fortnight_id: fortnight_id,
          import_id: item.import_id,
          status: 'open',
          assigned_broker_id: null,
        }));
        
        const { error: pendingInsertError } = await supabase
          .from('pending_items')
          .insert(pendingItemsToInsert);
        
        if (pendingInsertError) {
          console.error('[actionPayFortnight] Error insertando pending_items:', pendingInsertError);
          // No fallar, solo logear
        } else {
          console.log(`[actionPayFortnight] ✅ ${unidentified.length} items sin identificar migrados a pending_items (ajustes)`);
        }
      }
      
      // 6.3 Limpiar draft_unidentified_items
      const { error: deleteError } = await (supabase as any)
        .from('draft_unidentified_items')
        .delete()
        .eq('fortnight_id', fortnight_id);
      
      if (deleteError) {
        console.error('[actionPayFortnight] Error limpiando draft items:', deleteError);
        // No fallar
      }
    }
    
    // 7. Cambiar status a PAID
    const { error: updateError } = await supabase
      .from('fortnights')
      .update({ status: 'PAID' } satisfies FortnightUpd)
      .eq('id', fortnight_id);
    
    if (updateError) throw updateError;
    
    // 7.1 NUEVO: Guardar detalle completo en fortnight_details
    console.log('[actionPayFortnight] Guardando detalle en fortnight_details...');
    
    const { data: commItems, error: itemsError } = await supabase
      .from('comm_items')
      .select(`
        id,
        broker_id,
        policy_number,
        insured_name,
        insurer_id,
        gross_amount,
        import_id,
        policies!left (
          id,
          percent_override,
          ramo,
          client_id
        ),
        brokers!inner (
          id,
          percent_default,
          assa_code
        )
      `)
      .eq('fortnight_id', fortnight_id);
    
    if (itemsError) {
      console.error('[actionPayFortnight] Error obteniendo comm_items:', itemsError);
      throw itemsError;
    }
    
    if (commItems && commItems.length > 0) {
      const detailsToInsert = commItems.map((item: any) => {
        // Determinar porcentaje aplicado
        const percentApplied = item.policies?.percent_override ?? 
                              item.brokers?.percent_default ?? 
                              1.0;
        
        // Calcular commission_raw (reverso del cálculo)
        const commissionRaw = item.gross_amount / percentApplied;
        
        // Detectar si es código ASSA
        const isAssaCode = item.policy_number?.startsWith('PJ750') || false;
        
        // Extraer código ASSA del broker si corresponde
        let assaCodeToSave = null;
        if (isAssaCode && item.brokers?.assa_code) {
          // Verificar si el policy_number contiene el código ASSA del broker
          // Formato esperado: PJ750-1-123456 donde PJ750-1 es el código del broker
          const policyNumber = item.policy_number || '';
          const brokerAssaCode = item.brokers.assa_code;
          
          // Si el policy_number empieza con el código del broker, guardarlo
          if (policyNumber.startsWith(brokerAssaCode)) {
            assaCodeToSave = brokerAssaCode;
          }
        }
        
        return {
          fortnight_id: fortnight_id,
          broker_id: item.broker_id,
          insurer_id: item.insurer_id,
          policy_id: item.policies?.id || null,
          client_id: item.policies?.client_id || null,
          policy_number: item.policy_number,
          client_name: item.insured_name || 'Sin nombre',
          ramo: item.policies?.ramo || null,
          commission_raw: commissionRaw,
          percent_applied: percentApplied,
          commission_calculated: item.gross_amount,
          is_assa_code: isAssaCode,
          assa_code: assaCodeToSave,
          source_import_id: item.import_id
        };
      });
      
      const { error: detailsError } = await (supabase as any)
        .from('fortnight_details')
        .insert(detailsToInsert);
      
      if (detailsError) {
        console.error('[actionPayFortnight] Error guardando fortnight_details:', detailsError);
        throw detailsError;
      }
      
      console.log(`[actionPayFortnight] ✅ ${detailsToInsert.length} detalles guardados en fortnight_details`);
    } else {
      console.log('[actionPayFortnight] ⚠️ No hay comm_items para guardar en fortnight_details');
    }
    
    // 6.5 NUEVO: CONFIRMAR VÍNCULOS BANCO TEMPORALES Y ACTUALIZAR A PAGADO
    console.log('[actionPayFortnight] Confirmando vínculos banco temporales...');
    
    // Obtener imports de esta quincena
    const { data: quincenaImports } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnight_id);
    
    if (quincenaImports && quincenaImports.length > 0) {
      const importIds = quincenaImports.map((i: any) => i.id);
      
      // Confirmar bank_transfer_imports temporales
      const { data: tempTransferLinks } = await (supabase as any)
        .from('bank_transfer_imports')
        .select('transfer_id, cutoff_origin_id, notes')
        .in('import_id', importIds)
        .eq('is_temporary', true);
      
      if (tempTransferLinks && tempTransferLinks.length > 0) {
        // Actualizar vínculos a permanentes
        const { error: confirmError } = await (supabase as any)
          .from('bank_transfer_imports')
          .update({
            is_temporary: false,
            fortnight_paid_id: fortnight_id,
            notes: (supabase as any).raw(`notes || ' | Pagado en quincena: ' || '${fortnight_id}'`)
          })
          .in('import_id', importIds)
          .eq('is_temporary', true);
        
        if (confirmError) {
          console.error('[actionPayFortnight] Error confirmando transfer links:', confirmError);
        }
        
        // Actualizar transferencias a PAGADO
        const transferIds = tempTransferLinks.map((t: any) => t.transfer_id);
        const { error: updateTransferError } = await supabase
          .from('bank_transfers_comm')
          .update({ status: 'PAGADO' })
          .in('id', transferIds);
        
        if (updateTransferError) {
          console.error('[actionPayFortnight] Error actualizando transferencias a PAGADO:', updateTransferError);
        } else {
          console.log(`[actionPayFortnight] ✅ ${transferIds.length} transferencias actualizadas a PAGADO`);
        }
      }
      
      // Confirmar bank_group_imports temporales
      const { data: tempGroupLinks } = await (supabase as any)
        .from('bank_group_imports')
        .select('group_id, notes')
        .in('import_id', importIds)
        .eq('is_temporary', true);
      
      if (tempGroupLinks && tempGroupLinks.length > 0) {
        // Actualizar vínculos a permanentes
        const { error: confirmGroupError } = await (supabase as any)
          .from('bank_group_imports')
          .update({
            is_temporary: false,
            fortnight_paid_id: fortnight_id,
            notes: (supabase as any).raw(`notes || ' | Pagado en quincena: ' || '${fortnight_id}'`)
          })
          .in('import_id', importIds)
          .eq('is_temporary', true);
        
        if (confirmGroupError) {
          console.error('[actionPayFortnight] Error confirmando group links:', confirmGroupError);
        }
        
        // Actualizar grupos a PAGADO
        const groupIds = tempGroupLinks.map((g: any) => g.group_id);
        const { error: updateGroupError } = await supabase
          .from('bank_groups')
          .update({ status: 'PAGADO' })
          .in('id', groupIds);
        
        if (updateGroupError) {
          console.error('[actionPayFortnight] Error actualizando grupos a PAGADO:', updateGroupError);
        } else {
          console.log(`[actionPayFortnight] ✅ ${groupIds.length} grupos actualizados a PAGADO`);
        }
      }
    }
    
    // 6.6 NUEVO: Marcar reportes de ajustes como pagados
    console.log('[actionPayFortnight] Marcando reportes de ajustes...');
    const { data: adjustmentReports, error: adjError } = await supabase
      .from('adjustment_reports')
      .select('id')
      .eq('fortnight_id', fortnight_id)
      .eq('status', 'approved')
      .eq('payment_mode', 'next_fortnight');
    
    if (adjustmentReports && adjustmentReports.length > 0) {
      const reportIds = adjustmentReports.map((r: any) => r.id);
      const { error: updateAdjError } = await supabase
        .from('adjustment_reports')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString()
        })
        .in('id', reportIds);
      
      if (updateAdjError) {
        console.error('[actionPayFortnight] Error actualizando adjustment_reports:', updateAdjError);
      } else {
        console.log(`[actionPayFortnight] ✅ ${reportIds.length} reportes de ajustes marcados como pagados`);
      }
    } else {
      console.log('[actionPayFortnight] ⚠️ No hay reportes de ajustes pendientes');
    }
    
    // 7. Marcar adelantos como aplicados (crear logs)
    for (const bt of brokerTotals) {
      const discounts = bt.discounts_json as any;
      if (!discounts?.adelantos || !Array.isArray(discounts.adelantos) || discounts.adelantos.length === 0) {
        continue;
      }

      let totalDiscount = 0;

      for (const adv of discounts.adelantos) {
        await supabase.from('advance_logs').insert([{
          advance_id: adv.advance_id,
          amount: adv.amount,
          payment_type: 'fortnight',
          fortnight_id,
          applied_by: userId,
        } satisfies AdvanceLogIns]);

        const { data: advance } = await supabase
          .from('advances')
          .select('amount, status')
          .eq('id', adv.advance_id)
          .single();

        if (advance) {
          const newAmount = (advance as any).amount - adv.amount;
          const newStatus = newAmount <= 0 ? 'PAID' : 'PARTIAL';

          await supabase
            .from('advances')
            .update({
              amount: Math.max(0, newAmount),
              status: newStatus,
            } satisfies TablesUpdate<'advances'>)
            .eq('id', adv.advance_id);
        }

        totalDiscount += Number(adv.amount) || 0;
      }

      if (totalDiscount <= 0) {
        continue;
      }

      const periodLabel = formatFortnightLabel(fortnight.period_start ?? null, fortnight.period_end ?? null);
      const referenceNumber = `DESCUENTO-COMISIONES-${fortnight_id}-${bt.broker_id}`.toUpperCase();
      const periodDate = toIsoDate(fortnight.period_end ?? null);
      const nowIso = new Date().toISOString();

      const { error: bankTransferError } = await supabase
        .from('bank_transfers')
        .insert([
          {
            date: periodDate as string,
            reference_number: referenceNumber,
            transaction_code: 'DESCUENTO_COMISIONES',
            description: `Broker: ${bt.brokers?.name ?? 'N/D'} — Quincena: ${periodLabel || fortnight_id}`,
            amount: totalDiscount,
            imported_at: nowIso,
            used_amount: totalDiscount,
          } satisfies TablesInsert<'bank_transfers'>,
        ]);

      if (bankTransferError) {
        throw bankTransferError;
      }

      const pendingPayload = {
        client_name: bt.brokers?.name ?? 'Broker',
        insurer_name: null,
        policy_number: null,
        purpose: 'devolucion',
        amount_to_pay: totalDiscount,
        total_received: totalDiscount,
        can_be_paid: true,
        status: 'pending',
        notes: JSON.stringify({
          source: 'fortnight_discount',
          fortnight_id,
          broker_id: bt.broker_id,
        }),
        created_at: nowIso,
        created_by: userId,
      } satisfies TablesInsert<'pending_payments'>;

      const { error: pendingError } = await supabase
        .from('pending_payments')
        .insert([pendingPayload]);

      if (pendingError) {
        throw pendingError;
      }
    }
    
    // 8. Notificar brokers que reciben pago (AMBAS: email + campanita)
    // Solo notificar a brokers que:
    // - NO tienen descuento del 100% (net_amount > 0)
    // - NO están retenidos
    const brokersToNotify = brokerTotals.filter(bt => 
      bt.net_amount > 0 && !bt.is_retained
    );
    
    if (brokersToNotify.length > 0) {
      const periodLabel = formatFortnightLabel(fortnight.period_start, fortnight.period_end);
      
      for (const bt of brokersToNotify) {
        try {
          const { createNotification } = await import('@/lib/notifications/create');
          const { sendNotificationEmail } = await import('@/lib/notifications/send-email');
          
          const notificationData = {
            type: 'commission' as const,
            target: 'BROKER' as const,
            title: `💵 Comisiones Pagadas - ${periodLabel}`,
            body: `Se han procesado los pagos de la quincena ${periodLabel}. Monto neto: $${bt.net_amount.toFixed(2)}`,
            brokerId: bt.broker_id,
            meta: {
              fortnight_id,
              period_label: periodLabel,
              gross_amount: bt.gross_amount,
              net_amount: bt.net_amount,
              discount_amount: bt.gross_amount - bt.net_amount,
            },
            entityId: `${fortnight_id}-${bt.broker_id}`,
          };
          
          // Crear notificación en BD
          const notifResult = await createNotification(notificationData);
          
          // Enviar email
          if (notifResult.success && !notifResult.isDuplicate) {
            // Obtener email del broker
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', (bt.brokers as any)?.p_id)
              .single();
            
            if (profile?.email) {
              await sendNotificationEmail({
                type: 'commission',
                to: profile.email,
                data: {
                  brokerName: (bt.brokers as any)?.name || 'Broker',
                  periodLabel,
                  grossAmount: bt.gross_amount,
                  netAmount: bt.net_amount,
                  discountAmount: bt.gross_amount - bt.net_amount,
                  fortnightId: fortnight_id,
                },
                notificationId: notifResult.notificationId,
              });
            }
          }
        } catch (notifError) {
          console.error('[actionPayFortnight] Error enviando notificación:', notifError);
          // No fallar si la notificación falla
        }
      }
    }
    
    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        brokers_paid: filteredTotals.length,
        total_paid: filteredTotals.reduce((s, r) => s + r.net_amount, 0),
        brokers_notified: brokersToNotify.length,
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al pagar quincena',
    };
  }
}

/**
 * Migrate assigned pending items to comm_items
 */
export async function actionMigratePendingToCommItems(pending_item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: pendingItems, error: fetchError } = await supabase
      .from('pending_items')
      .select('*')
      .in('id', pending_item_ids)
      .not('assigned_broker_id', 'is', null)
      .returns<PendingItemRow[]>();
    
    if (fetchError) throw fetchError;
    if (!pendingItems || pendingItems.length === 0) {
      return { ok: false as const, error: 'No hay items para migrar' };
    }
    
    const commItemIds: string[] = [];
    
    for (const item of pendingItems) {
      const { data: broker } = await supabase
        .from('brokers')
        .select('percent_default')
        .eq('id', item.assigned_broker_id!)
        .single();
      
      if (!broker) continue;
      
      const percent = (broker as any).percent_default || 1.0;
      const grossAmount = item.commission_raw * percent;
      
      const { data: newCommItem, error: insertError } = await supabase
        .from('comm_items')
        .insert([{
          import_id: item.import_id!,
          insurer_id: item.insurer_id!,
          policy_number: item.policy_number,
          broker_id: item.assigned_broker_id,
          gross_amount: grossAmount,
          insured_name: item.insured_name,
          raw_row: null,
        } satisfies CommItemIns])
        .select('id')
        .single();
      
      if (insertError || !newCommItem) {
        console.error('Error inserting comm_item:', insertError);
        continue;
      }
      
      // Guardar el ID del comm_item creado
      commItemIds.push(newCommItem.id);
      
      await supabase
        .from('pending_items')
        .update({ status: 'migrated' } satisfies PendingItemUpd)
        .eq('id', item.id);
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { migrated: pendingItems.length, commItemIds } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al migrar items',
    };
  }
}

/**
 * Generate CSV for Pay Now adjustments
 */
export async function actionGeneratePayNowCSV(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: items, error: fetchError } = await supabase
      .from('pending_items')
      .select(`
        *,
        brokers (
          id,
          name,
          bank_account_no,
          beneficiary_name,
          percent_default
        )
      `)
      .in('id', item_ids)
      .eq('status', 'approved_pay_now')
      .returns<(PendingItemRow & { brokers: any })[]>();
    
    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return { ok: false as const, error: 'No hay items para pagar' };
    }
    
    // Crear fortnight_broker_totals falsos para el CSV
    const totalsByBroker = items.reduce((acc, item) => {
      const brokerId = item.assigned_broker_id!;
      const percent = item.brokers?.percent_default || 1.0;
      const grossAmount = item.commission_raw * percent;
      
      if (!acc[brokerId]) {
        acc[brokerId] = {
          broker_id: brokerId,
          fortnight_id: 'pay_now',
          gross_amount: 0,
          net_amount: 0,
          discounts_json: {},
          created_at: new Date().toISOString(),
          id: brokerId,
          bank_snapshot: null,
          broker: item.brokers
        };
      }
      acc[brokerId].net_amount += grossAmount;
      acc[brokerId].gross_amount += grossAmount;
      return acc;
    }, {} as Record<string, any>);
    
    // Generar referencia con fecha para ajustes
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const adjustmentRef = `AJUSTES ${day}/${month}/${year}`;
    
    const achResult = await buildBankACH(Object.values(totalsByBroker), adjustmentRef);
    const csvContent = achResult.content;
    
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        items_count: items.length,
        total_amount: Object.values(totalsByBroker).reduce((s, r) => s + r.net_amount, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al generar CSV',
    };
  }
}

/**
 * Confirm Pay Now items as paid
 */
export async function actionConfirmPayNowPaid(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    const { data: items } = await supabase
      .from('pending_items')
      .select('*, brokers(percent_default)')
      .in('id', item_ids)
      .eq('status', 'approved_pay_now')
      .returns<(PendingItemRow & { brokers: any })[]>();
    
    if (!items || items.length === 0) {
      return { ok: false as const, error: 'No hay items para confirmar' };
    }
    
    for (const item of items) {
      const percent = item.brokers?.percent_default || 1.0;
      const grossAmount = item.commission_raw * percent;
      
      await supabase
        .from('comm_metadata')
        .insert([{
          key: 'paid_adjustment',
          value: JSON.stringify({
            pending_item_id: item.id,
            broker_id: item.assigned_broker_id,
            policy_number: item.policy_number,
            commission_raw: item.commission_raw,
            gross_amount: grossAmount,
            paid_at: new Date().toISOString(),
            paid_by: userId,
          }),
        }]);
      
      await supabase
        .from('pending_items')
        .update({ status: 'paid_now' } satisfies PendingItemUpd)
        .eq('id', item.id);
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { paid_count: items.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al confirmar pago',
    };
  }
}

// =====================================================
// SISTEMA DE AJUSTES CON SELECCIÓN MÚLTIPLE
// =====================================================

/**
 * Enviar reporte de ajustes del broker
 * Agrupa múltiples items marcados como "mío"
 */
export async function actionSubmitClaimsReport(itemIds: string[]) {
  try {
    const { userId, brokerId } = await getAuthContext();
    if (!brokerId) {
      return { ok: false as const, error: 'Usuario no es un broker' };
    }

    const supabase = getSupabaseAdmin();

    // Verificar que los items no estén ya reclamados
    const { data: existingClaims } = await supabase
      .from('comm_item_claims')
      .select('comm_item_id')
      .in('comm_item_id', itemIds);

    const alreadyClaimed = existingClaims?.map(c => c.comm_item_id) || [];
    const newItems = itemIds.filter(id => !alreadyClaimed.includes(id));

    if (newItems.length === 0) {
      return { ok: false as const, error: 'Todos los items ya fueron reclamados' };
    }

    // Crear claims para cada item
    const claimsToInsert = newItems.map(itemId => ({
      comm_item_id: itemId,
      broker_id: brokerId,
      status: 'pending',
    }));

    const { error } = await supabase
      .from('comm_item_claims')
      .insert(claimsToInsert);

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      message: `Reporte enviado: ${newItems.length} ajuste(s)`,
      count: newItems.length
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al enviar reporte',
    };
  }
}

/**
 * Obtener reportes de ajustes agrupados por broker
 * Para vista de Master
 */
export async function actionGetClaimsReports(status?: string) {
  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('comm_item_claims')
      .select(`
        *,
        comm_items!inner (
          id,
          policy_number,
          insured_name,
          gross_amount,
          insurer_id,
          insurers (name)
        ),
        brokers!inner (
          id,
          name,
          percent_default,
          tipo_cuenta,
          national_id,
          nombre_completo,
          bank_account_no,
          profiles!p_id (
            full_name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['pending', 'approved']);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al obtener reportes',
    };
  }
}

/**
 * Aprobar reportes de ajustes
 * Crea registros en temp_client_import
 */
export async function actionApproveClaimsReports(
  claimIds: string[],
  paymentType: 'now' | 'next_fortnight'
) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    // Usar función SQL que hace todo el proceso
    const { data, error } = await supabase.rpc('approve_claims_and_create_preliminary', {
      p_claim_ids: claimIds,
      p_payment_type: paymentType,
      p_approved_by: userId,
    });

    if (error) throw error;

    const result = data?.[0];
    if (!result?.success) {
      return { ok: false as const, error: result?.message || 'Error desconocido' };
    }

    revalidatePath('/(app)/commissions');
    revalidatePath('/(app)/db');

    return { 
      ok: true as const,
      message: `${claimIds.length} ajuste(s) aprobado(s)`,
      preliminaryCount: result.preliminary_count,
      paymentType
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al aprobar reportes',
    };
  }
}

/**
 * Rechazar reportes de ajustes
 */
export async function actionRejectClaimsReports(
  claimIds: string[],
  rejectionReason?: string
) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.rpc('reject_claims', {
      p_claim_ids: claimIds,
      p_rejection_reason: rejectionReason || 'Rechazado por Master',
      p_rejected_by: userId,
    });

    if (error) throw error;

    revalidatePath('/(app)/commissions');

    return { 
      ok: true as const,
      message: `${claimIds.length} ajuste(s) rechazado(s)`
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al rechazar reportes',
    };
  }
}

/**
 * Generar datos para CSV bancario de ajustes
 */
export async function actionGetAdjustmentsCSVData(claimIds: string[]) {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('comm_item_claims')
      .select(`
        *,
        comm_items (
          gross_amount
        ),
        brokers (
          name,
          percent_default,
          tipo_cuenta,
          national_id,
          nombre_completo,
          bank_account_no,
          profiles!p_id (
            full_name,
            email
          )
        )
      `)
      .in('id', claimIds)
      .eq('status', 'approved')
      .eq('payment_type', 'now');

    if (error) throw error;

    if (!data || data.length === 0) {
      return { ok: false as const, error: 'No hay ajustes aprobados para pagar' };
    }

    // Agrupar por broker y calcular totales
    const brokerTotals = new Map();

    data.forEach((claim: any) => {
      const broker = claim.brokers;
      const item = claim.comm_items;
      
      if (!broker || !item) return;

      const brokerId = broker.id;
      const percent = broker.percent_default ?? 1.0;
      const brokerAmount = Math.abs(item.gross_amount) * percent;

      if (!brokerTotals.has(brokerId)) {
        brokerTotals.set(brokerId, {
          broker,
          totalAmount: 0,
        });
      }

      const entry = brokerTotals.get(brokerId);
      entry.totalAmount += brokerAmount;
    });

    // Generar filas CSV
    const csvRows: any[] = [];

    brokerTotals.forEach(({ broker, totalAmount }) => {
      if (totalAmount <= 0) return;

      csvRows.push({
        nombre: broker.profiles?.full_name || broker.name,
        tipo: broker.account_type?.toUpperCase() || 'NATURAL',
        cedula: broker.national_id || '',
        banco: broker.bank_name || 'BANCO GENERAL',
        cuenta: broker.account_number || '',
        monto: totalAmount.toFixed(2),
        correo: broker.profiles?.email || '',
        descripcion: 'AJUSTE COMISION',
      });
    });

    return { ok: true as const, data: csvRows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al generar CSV',
    };
  }
}

/**
 * Confirmar pago de ajustes
 * Marca como pagados y registra en preliminar de base de datos
 */
export async function actionConfirmAdjustmentsPaid(claimIds: string[]) {
  try {
    const supabase = getSupabaseAdmin();

    // Confirmar pago usando RPC
    const { error } = await supabase.rpc('confirm_claims_paid', {
      p_claim_ids: claimIds,
    });

    if (error) throw error;

    // Obtener información de los claims pagados para crear preliminares
    const { data: paidClaims, error: claimsError } = await supabase
      .from('comm_item_claims')
      .select(`
        id,
        broker_id,
        comm_items (
          id,
          policy_number,
          insured_name,
          gross_amount,
          insurer_id
        )
      `)
      .in('id', claimIds);

    if (claimsError) {
      console.error('Error fetching paid claims:', claimsError);
    }

    // Crear registros preliminares para cada cliente único
    if (paidClaims && paidClaims.length > 0) {
      const preliminaryRecords: any[] = [];
      const uniqueClients = new Map<string, any>();

      paidClaims.forEach((claim: any) => {
        const item = claim.comm_items;
        if (!item) return;

        // Usar policy_number como clave única para evitar duplicados
        const key = `${item.policy_number}-${claim.broker_id}`;
        
        if (!uniqueClients.has(key)) {
          uniqueClients.set(key, {
            client_name: item.insured_name || '',
            policy_number: item.policy_number || '',
            insurer_id: item.insurer_id || null,
            broker_id: claim.broker_id,
            renewal_date: null, // Broker debe completar
            migrated: false,
            source: 'adjustments_paid',
            notes: 'Cliente registrado desde ajuste pagado. Por favor complete la información faltante.',
          });
        }
      });

      // Insertar registros preliminares
      if (uniqueClients.size > 0) {
        const { error: insertError } = await supabase
          .from('temp_client_import')
          .insert(Array.from(uniqueClients.values()));

        if (insertError) {
          console.error('Error creating preliminary records:', insertError);
          // No fallar la operación completa si esto falla
        }
      }

      // Crear notificaciones para los brokers
      const brokerIds = Array.from(new Set(paidClaims.map((c: any) => c.broker_id)));
      
      for (const brokerId of brokerIds) {
        const brokerClaims = paidClaims.filter((c: any) => c.broker_id === brokerId);
        const clientCount = new Set(brokerClaims.map((c: any) => c.comm_items?.policy_number)).size;

        // Crear notificación
        await supabase.from('notifications').insert({
          broker_id: brokerId,
          notification_type: 'commission',
          title: 'Ajustes Pagados - Acción Requerida',
          body: `Se han pagado ${brokerClaims.length} ajuste(s) con ${clientCount} cliente(s). Por favor completa la información en Base de Datos Preliminar.`,
          target: '/db?tab=preliminary',
          meta: { link: '/db?tab=preliminary', read: false }
        });
      }
    }

    revalidatePath('/(app)/commissions');
    revalidatePath('/(app)/db');

    return { 
      ok: true as const,
      message: `${claimIds.length} ajuste(s) confirmado(s) como pagado(s) y registrados en preliminar`
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al confirmar pago',
    };
  }
}

/**
 * Obtener ajustes en cola para siguiente quincena
 * Para integración con nueva quincena
 */
export async function actionGetQueuedAdjustments() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('get_queued_claims_for_fortnight');

    if (error) throw error;

    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al obtener ajustes en cola',
    };
  }
}

/**
 * Marcar ajustes en cola como incluidos en quincena
 * Se llama al finalizar creación de quincena
 */
export async function actionMarkAdjustmentsInFortnight(
  claimIds: string[],
  fortnightId: string
) {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('comm_item_claims')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString(),
        fortnight_id: fortnightId,
      })
      .in('id', claimIds);

    if (error) throw error;

    revalidatePath('/(app)/commissions');

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al marcar ajustes en quincena',
    };
  }
}

/**
 * Obtener datos del broker actual
 * Incluye porcentaje de comisión
 */
export async function actionGetCurrentBroker() {
  try {
    const { brokerId } = await getAuthContext();
    if (!brokerId) {
      return { ok: false as const, error: 'Usuario no es un broker' };
    }

    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from('brokers')
      .select(`
        id,
        name,
        percent_default,
        profiles!p_id (
          full_name,
          email
        )
      `)
      .eq('id', brokerId)
      .single();

    if (error) throw error;

    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al obtener broker',
    };
  }
}

/**
 * Get available periods (years, months, fortnights) that have closed fortnights
 */
export async function actionGetAvailablePeriods() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener todas las quincenas cerradas
    const { data: fortnights, error } = await supabase
      .from('fortnights')
      .select('period_start, period_end')
      .eq('status', 'PAID')
      .order('period_start', { ascending: false });

    if (error) throw error;

    if (!fortnights || fortnights.length === 0) {
      return {
        ok: true as const,
        data: {
          years: [],
          months: [],
          fortnights: []
        }
      };
    }

    // Extraer años, meses y quincenas únicas
    const yearsSet = new Set<number>();
    const monthsSet = new Set<string>(); // formato: "YYYY-MM"
    const fortnightsSet = new Set<string>(); // formato: "YYYY-MM-Q"

    fortnights.forEach(f => {
      const startDate = new Date(f.period_start);
      const year = startDate.getUTCFullYear();
      const month = startDate.getUTCMonth() + 1;
      const day = startDate.getUTCDate();
      const fortnight = day <= 15 ? '1' : '2';

      yearsSet.add(year);
      monthsSet.add(`${year}-${month}`);
      fortnightsSet.add(`${year}-${month}-${fortnight}`);
    });

    return {
      ok: true as const,
      data: {
        years: Array.from(yearsSet).sort((a, b) => b - a),
        months: Array.from(monthsSet).sort().reverse(),
        fortnights: Array.from(fortnightsSet).sort().reverse()
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al obtener períodos disponibles',
    };
  }
}

/**
 * Get detailed broker commissions with policies grouped by insurer
 * INCLUDES ASSA codes for the broker
 */
export async function actionGetBrokerCommissionDetails(fortnightId: string, brokerId?: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener assa_code del broker si existe
    let assaCode: string | null = null;
    if (brokerId) {
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('assa_code')
        .eq('id', brokerId)
        .single();
      
      assaCode = brokerData?.assa_code || null;
      console.log('[actionGetBrokerCommissionDetails] Broker:', brokerId, 'ASSA Code:', assaCode);
    }
    
    // Buscar DIRECTAMENTE en fortnight_details (NO en comm_items)
    // porque fortnight_details tiene la info correcta de assa_code
    let detailsQuery = supabase
      .from('fortnight_details')
      .select(`
        id,
        policy_number,
        client_name,
        commission_raw,
        percent_applied,
        commission_calculated,
        broker_id,
        insurer_id,
        is_assa_code,
        assa_code,
        brokers ( id, name, email, percent_default, assa_code ),
        insurers ( id, name )
      `)
      .eq('fortnight_id', fortnightId);

    // Filtrar por broker_id O assa_code (igual que actionGetYTDCommissions)
    if (brokerId) {
      if (assaCode) {
        console.log('[actionGetBrokerCommissionDetails] Filtrando por broker_id O assa_code:', assaCode);
        detailsQuery = detailsQuery.or(`broker_id.eq.${brokerId},assa_code.eq.${assaCode}`);
      } else {
        console.log('[actionGetBrokerCommissionDetails] Filtrando solo por broker_id');
        detailsQuery = detailsQuery.eq('broker_id', brokerId);
      }
    }

    const { data: commItems, error: ciError } = await detailsQuery;

    if (ciError) throw ciError;

    console.log('[actionGetBrokerCommissionDetails] Items encontrados:', commItems?.length || 0);
    if (commItems && commItems.length > 0) {
      console.log('[actionGetBrokerCommissionDetails] Sample items:', commItems.slice(0, 3).map(i => ({
        policy: i.policy_number,
        is_assa: i.is_assa_code,
        assa_code: i.assa_code,
        commission: i.commission_calculated
      })));
    }

    // Group by broker
    const brokerMap = new Map<string, any>();

    (commItems || []).forEach((item: any) => {
      if (!item.brokers) return;

      const bId = item.broker_id;
      if (!brokerMap.has(bId)) {
        brokerMap.set(bId, {
          broker_id: bId,
          broker_name: item.brokers.name,
          broker_email: item.brokers.email,
          percent_default: item.brokers.percent_default,
          insurers: new Map<string, any>(),
          assa_codes: [], // Códigos ASSA separados
          total_gross: 0,
          total_net: 0,
        });
      }

      const broker = brokerMap.get(bId);
      
      // Si es código ASSA, agregarlo a la lista separada
      if (item.is_assa_code) {
        broker.assa_codes.push({
          policy_number: item.policy_number,
          assa_code: item.assa_code,
          client_name: item.client_name,
          commission_raw: item.commission_raw,
          percent_applied: item.percent_applied,
          commission_calculated: item.commission_calculated,
          net_amount: item.commission_calculated,
        });
        broker.total_gross += Number(item.commission_raw) || 0;
        broker.total_net += Number(item.commission_calculated) || 0;
      } else {
        // Pólizas regulares por aseguradora
        const insurerId = item.insurer_id;
        const insurerName = item.insurers?.name || 'Desconocido';

        if (!broker.insurers.has(insurerId)) {
          broker.insurers.set(insurerId, {
            insurer_id: insurerId,
            insurer_name: insurerName,
            policies: [],
            total_gross: 0,
          });
        }

        const insurer = broker.insurers.get(insurerId);
        const grossAmount = Number(item.commission_raw) || 0;
        const percentage = Number(item.percent_applied) || 0;
        const netAmount = Number(item.commission_calculated) || 0;

        insurer.policies.push({
          policy_number: item.policy_number,
          insured_name: item.client_name,
          gross_amount: grossAmount,
          percentage: percentage,
          net_amount: netAmount,
        });

        insurer.total_gross += grossAmount;
        broker.total_gross += grossAmount;
        broker.total_net += netAmount;
      }
    });

    // Format response
    const result = Array.from(brokerMap.values()).map(broker => ({
      broker_id: broker.broker_id,
      broker_name: broker.broker_name,
      broker_email: broker.broker_email,
      percent_default: broker.percent_default,
      total_gross: broker.total_gross,
      total_net: broker.total_net,
      insurers: Array.from(broker.insurers.values()).map((ins: any) => ({
        insurer_id: ins.insurer_id,
        insurer_name: ins.insurer_name,
        total_gross: ins.total_gross,
        policies: ins.policies.sort((a: any, b: any) => b.gross_amount - a.gross_amount),
      })).sort((a: any, b: any) => b.total_gross - a.total_gross),
      assa_codes: broker.assa_codes || [], // Incluir códigos ASSA
    })).sort((a, b) => b.total_net - a.total_net);

    console.log('[actionGetBrokerCommissionDetails] Result brokers:', result.length);
    if (result.length > 0 && result[0] && result[0].assa_codes && result[0].assa_codes.length > 0) {
      const firstBroker = result[0];
      console.log('[actionGetBrokerCommissionDetails] Broker con ASSA codes:', {
        broker: firstBroker.broker_name,
        assa_count: firstBroker.assa_codes.length,
        assa_total: firstBroker.assa_codes.reduce((sum: number, a: any) => sum + a.commission_calculated, 0)
      });
    }

    return { ok: true as const, data: result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al obtener detalles de comisiones',
    };
  }
}

// ========================================
// DRAFT UNIDENTIFIED ITEMS (Zona de trabajo)
// ========================================

/**
 * Obtener items sin identificar de la zona de trabajo (draft)
 */
export async function actionGetDraftUnidentified(fortnightId: string): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await (supabase as any)
      .from('draft_unidentified_items')
      .select(`
        id,
        policy_number,
        insured_name,
        commission_raw,
        temp_assigned_broker_id,
        temp_assigned_at,
        created_at,
        insurers ( id, name ),
        brokers ( id, name )
      `)
      .eq('fortnight_id', fortnightId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[actionGetDraftUnidentified] Error:', error);
      return { ok: false, error: 'Error al cargar sin identificar' };
    }

    return { ok: true, data: data || [] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error inesperado',
    };
  }
}

/**
 * Identificar temporalmente un cliente en zona de trabajo
 * NUEVO: Al identificar, inserta inmediatamente en comm_items para que aparezca en listado del corredor
 */
export async function actionTempIdentifyClient(itemId: string, brokerId: string): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = getSupabaseAdmin();

    // 1. Obtener el item completo
    const { data: item, error: fetchError } = await (supabase as any)
      .from('draft_unidentified_items')
      .select('*, brokers!temp_assigned_broker_id(*)')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      console.error('[actionTempIdentifyClient] Error obteniendo item:', fetchError);
      return { ok: false, error: 'Item no encontrado' };
    }

    // 2. Obtener percent_default del broker
    const { data: broker } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', brokerId)
      .single();

    const percent = broker?.percent_default || 1.0;
    const grossAmount = item.commission_raw * percent;

    // 3. Insertar en comm_items (como si el parser lo hubiera identificado)
    const { error: commInsertError } = await supabase
      .from('comm_items')
      .insert({
        import_id: item.import_id,
        insurer_id: item.insurer_id,
        policy_number: item.policy_number,
        gross_amount: grossAmount,
        insured_name: item.insured_name || 'UNKNOWN',
        raw_row: item.raw_row,
        broker_id: brokerId,
      });

    if (commInsertError) {
      console.error('[actionTempIdentifyClient] Error insertando en comm_items:', commInsertError);
      return { ok: false, error: 'Error al insertar comisión' };
    }

    console.log(`[actionTempIdentifyClient] ✅ Item insertado en comm_items para broker ${brokerId}`);

    // 4. Marcar como identificado en draft
    const { error: updateError } = await (supabase as any)
      .from('draft_unidentified_items')
      .update({
        temp_assigned_broker_id: brokerId,
        temp_assigned_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[actionTempIdentifyClient] Error actualizando draft:', updateError);
      // No fallar, ya insertamos en comm_items
    }

    // 5. Recalcular totales de la quincena para actualizar listado del corredor
    await actionRecalculateFortnight(item.fortnight_id);

    // NOTA: No usar revalidatePath aquí - interfiere con recalculationKey
    // El componente se recarga automáticamente cuando onUpdate() incrementa recalculationKey
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error inesperado',
    };
  }
}

/**
 * Regresar cliente a sin identificar en zona de trabajo
 * NUEVO: Al desidentificar, elimina de comm_items para que no aparezca en listado del corredor
 */
export async function actionTempUnidentifyClient(itemId: string): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = getSupabaseAdmin();

    // 1. Obtener el item para saber qué eliminar de comm_items
    const { data: item, error: fetchError } = await (supabase as any)
      .from('draft_unidentified_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      console.error('[actionTempUnidentifyClient] Error obteniendo item:', fetchError);
      return { ok: false, error: 'Item no encontrado' };
    }

    // 2. Eliminar de comm_items (por import_id + policy_number + broker)
    if (item.temp_assigned_broker_id) {
      const { error: deleteError } = await supabase
        .from('comm_items')
        .delete()
        .eq('import_id', item.import_id)
        .eq('policy_number', item.policy_number)
        .eq('broker_id', item.temp_assigned_broker_id);

      if (deleteError) {
        console.error('[actionTempUnidentifyClient] Error eliminando de comm_items:', deleteError);
        return { ok: false, error: 'Error al eliminar comisión' };
      }

      console.log(`[actionTempUnidentifyClient] ✅ Item eliminado de comm_items`);
    }

    // 3. Marcar como no identificado en draft
    const { error: updateError } = await (supabase as any)
      .from('draft_unidentified_items')
      .update({
        temp_assigned_broker_id: null,
        temp_assigned_at: null,
      })
      .eq('id', itemId);

    if (updateError) {
      console.error('[actionTempUnidentifyClient] Error actualizando draft:', updateError);
      return { ok: false, error: 'Error al actualizar estado' };
    }

    // 4. Recalcular totales de la quincena para actualizar listado del corredor
    await actionRecalculateFortnight(item.fortnight_id);

    // NOTA: No usar revalidatePath aquí - interfiere con recalculationKey
    // El componente se recarga automáticamente cuando onUpdate() incrementa recalculationKey
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error inesperado',
    };
  }
}
