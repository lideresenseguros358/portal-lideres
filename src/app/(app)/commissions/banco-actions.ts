'use server';

/**
 * Acciones del servidor para el módulo BANCO (Conciliación bancaria)
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';
import { revalidatePath } from 'next/cache';
import { normalizeDescription } from '@/lib/banco/bancoParser';
import type { BankTransferCommRow } from '@/lib/banco/bancoParser';

// ============================================
// TIPOS
// ============================================

export type BankTransferStatus = 'SIN_CLASIFICAR' | 'PENDIENTE' | 'OK_CONCILIADO' | 'PAGADO';
export type TransferType = 'REPORTE' | 'BONO' | 'OTRO' | 'PENDIENTE';
export type GroupTemplate = 'NORMAL' | 'ASSA_CODIGOS';
export type GroupStatus = 'EN_PROCESO' | 'OK_CONCILIADO' | 'PAGADO';

interface ActionResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ============================================
// 1. IMPORTAR CORTE BANCARIO
// ============================================

export async function actionImportBankCutoff(
  startDate: string,
  endDate: string,
  notes: string,
  transfers: BankTransferCommRow[]
): Promise<ActionResult<{ cutoffId: string; imported: number; skipped: number }>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado. Solo usuarios MASTER pueden importar cortes bancarios.' };
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No autenticado' };
    }

    // 1. Crear el corte bancario
    const { data: cutoff, error: cutoffError } = await supabase
      .from('bank_cutoffs')
      .insert({
        start_date: startDate,
        end_date: endDate,
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (cutoffError) {
      if (cutoffError.code === '23505') { // Unique constraint violation
        return { ok: false, error: 'Ya existe un corte con estas fechas' };
      }
      console.error('[BANCO] Error creando corte:', cutoffError);
      return { ok: false, error: 'Error al crear corte bancario' };
    }

    // 2. Obtener referencias existentes para evitar duplicados
    console.log('[BANCO] Verificando duplicados...');
    const references = transfers.map(t => t.reference_number);
    const { data: existingTransfers, error: checkError } = await supabase
      .from('bank_transfers_comm')
      .select('reference_number')
      .in('reference_number', references);

    if (checkError) {
      console.error('[BANCO] ❌ Error verificando duplicados:', checkError);
      if (checkError.code === '42P01') {
        return { ok: false, error: 'TABLA NO EXISTE: Ejecuta la migración SQL primero. Ver: supabase/migrations/20241217_banco_conciliacion.sql' };
      }
    }

    const existingRefs = new Set(existingTransfers?.map(t => t.reference_number) || []);
    console.log('[BANCO] Referencias duplicadas encontradas:', existingRefs.size);

    // 3. Filtrar transferencias nuevas
    const newTransfers = transfers.filter(t => !existingRefs.has(t.reference_number));
    console.log('[BANCO] Transferencias nuevas a insertar:', newTransfers.length);
    console.log('[BANCO] Transferencias duplicadas omitidas:', transfers.length - newTransfers.length);

    if (newTransfers.length === 0) {
      console.log('[BANCO] ⚠️ No hay transferencias nuevas para insertar');
      return {
        ok: true,
        data: {
          cutoffId: cutoff.id,
          imported: 0,
          skipped: transfers.length,
        },
      };
    }

    // 4. Insertar transferencias nuevas
    console.log('[BANCO] Insertando', newTransfers.length, 'transferencias...');
    const transfersToInsert = newTransfers.map(t => ({
      cutoff_id: cutoff.id,
      date: t.date,
      reference_number: t.reference_number,
      description_raw: t.description,
      amount: t.credit,
      status: 'SIN_CLASIFICAR' as BankTransferStatus,
      transfer_type: 'PENDIENTE' as TransferType,
    }));

    console.log('[BANCO] Muestra de datos a insertar:', JSON.stringify(transfersToInsert[0], null, 2));

    const { error: insertError } = await supabase
      .from('bank_transfers_comm')
      .insert(transfersToInsert);

    if (insertError) {
      console.error('[BANCO] ❌ Error insertando transferencias - Código:', insertError.code);
      console.error('[BANCO] ❌ Error insertando transferencias - Mensaje:', insertError.message);
      console.error('[BANCO] ❌ Error completo:', JSON.stringify(insertError, null, 2));
      if (insertError.code === '42P01') {
        return { ok: false, error: 'TABLA NO EXISTE: Ejecuta la migración SQL primero. Ver: supabase/migrations/20241217_banco_conciliacion.sql' };
      }
      return { ok: false, error: `Error al importar transferencias: ${insertError.message}` };
    }

    console.log('[BANCO] ✅ Transferencias insertadas exitosamente');
    revalidatePath('/commissions');

    console.log('[BANCO] 🎉 Importación completada - Nuevas:', newTransfers.length, 'Duplicadas:', transfers.length - newTransfers.length);

    return {
      ok: true,
      data: {
        cutoffId: cutoff.id,
        imported: newTransfers.length,
        skipped: transfers.length - newTransfers.length,
      },
    };
  } catch (error: any) {
    console.error('[BANCO] ❌ Error CRÍTICO en actionImportBankCutoff:', error);
    console.error('[BANCO] ❌ Stack:', error.stack);
    return { ok: false, error: `Error inesperado: ${error.message}` };
  }
}

// ============================================
// 2. OBTENER CORTES BANCARIOS
// ============================================

export async function actionGetBankCutoffs(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    let query = supabase
      .from('bank_cutoffs')
      .select('*')
      .order('end_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('end_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('start_date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[BANCO] Error obteniendo cortes:', error);
      return { ok: false, error: 'Error al cargar cortes' };
    }

    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('[BANCO] Error en actionGetBankCutoffs:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 3. OBTENER TRANSFERENCIAS DE UN CORTE
// ============================================

export async function actionGetBankTransfers(filters?: {
  cutoffId?: string;
  status?: string;
  insurerId?: string;
  search?: string;
}): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    let query = supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (start_date, end_date),
        bank_transfer_imports (id),
        bank_group_transfers!left (group_id)
      `);

    if (filters?.cutoffId) {
      query = query.eq('cutoff_id', filters.cutoffId);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.insurerId) {
      query = query.eq('insurer_assigned_id', filters.insurerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[BANCO] Error obteniendo transferencias:', error);
      return { ok: false, error: 'Error al cargar transferencias' };
    }

    let transfers = data || [];

    // Filtrar por búsqueda en el cliente
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      transfers = transfers.filter(t =>
        t.reference_number?.toLowerCase().includes(searchLower) ||
        t.description_raw?.toLowerCase().includes(searchLower) ||
        t.notes_internal?.toLowerCase().includes(searchLower)
      );
    }

    // Ordenar alfabéticamente por descripción
    transfers = transfers.sort((a, b) => {
      const descA = (a.description_raw || '').toLowerCase();
      const descB = (b.description_raw || '').toLowerCase();
      return descA.localeCompare(descB);
    });

    return { ok: true, data: transfers };
  } catch (error) {
    console.error('[BANCO] Error en actionGetBankTransfers:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 4. ACTUALIZAR TRANSFERENCIA (Clasificar)
// ============================================

export async function actionUpdateBankTransfer(
  transferId: string,
  updates: {
    insurerAssignedId?: string;
    transferType?: TransferType;
    notesInternal?: string;
    status?: BankTransferStatus;
  }
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    const updateData: any = {};
    if (updates.insurerAssignedId !== undefined) updateData.insurer_assigned_id = updates.insurerAssignedId;
    if (updates.transferType !== undefined) updateData.transfer_type = updates.transferType;
    if (updates.notesInternal !== undefined) updateData.notes_internal = updates.notesInternal;
    if (updates.status !== undefined) updateData.status = updates.status;

    const { error } = await supabase
      .from('bank_transfers_comm')
      .update(updateData)
      .eq('id', transferId);

    if (error) {
      console.error('[BANCO] Error actualizando transferencia:', error);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionUpdateBankTransfer:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 5. CREAR GRUPO BANCARIO
// ============================================

export async function actionCreateBankGroup(
  name: string,
  template: GroupTemplate,
  insurerId: string,
  isLifeInsurance?: boolean
): Promise<ActionResult<{ groupId: string }>> {
  try {
    console.log('[BANCO] actionCreateBankGroup llamada con:', { name, template, insurerId, isLifeInsurance });
    
    const { role } = await getAuthContext();
    if (role !== 'master') {
      console.log('[BANCO] Acceso denegado - rol:', role);
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[BANCO] Usuario no autenticado');
      return { ok: false, error: 'No autenticado' };
    }

    console.log('[BANCO] Usuario autenticado:', user.id);
    console.log('[BANCO] Insertando grupo con datos:', {
      name,
      group_template: template,
      insurer_id: insurerId,
      is_life_insurance: isLifeInsurance,
      status: 'EN_PROCESO',
      total_amount: 0,
      created_by: user.id,
    });

    const { data: group, error } = await supabase
      .from('bank_groups')
      .insert({
        name,
        group_template: template,
        insurer_id: insurerId,
        is_life_insurance: isLifeInsurance,
        status: 'EN_PROCESO',
        total_amount: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[BANCO] Error creando grupo:', error);
      console.error('[BANCO] Detalles del error:', JSON.stringify(error, null, 2));
      return { ok: false, error: `Error al crear grupo: ${error.message || 'desconocido'}` };
    }

    console.log('[BANCO] Grupo creado exitosamente:', group.id);

    revalidatePath('/commissions');
    return { ok: true, data: { groupId: group.id } };
  } catch (error) {
    console.error('[BANCO] Error en actionCreateBankGroup:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 6. AGREGAR TRANSFERENCIA A GRUPO
// ============================================

export async function actionAddTransferToGroup(
  groupId: string,
  transferId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Verificar que el grupo no esté PAGADO
    const { data: group } = await supabase
      .from('bank_groups')
      .select('status')
      .eq('id', groupId)
      .single();

    if (!group) {
      return { ok: false, error: 'Grupo no encontrado' };
    }

    if (group.status === 'PAGADO') {
      return { ok: false, error: 'No se puede modificar un grupo PAGADO' };
    }

    // Verificar que la transferencia no esté en otro grupo
    const { data: existing } = await supabase
      .from('bank_group_transfers')
      .select('id')
      .eq('transfer_id', transferId)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: 'La transferencia ya pertenece a otro grupo' };
    }

    // Agregar transferencia al grupo
    const { error: insertError } = await supabase
      .from('bank_group_transfers')
      .insert({
        group_id: groupId,
        transfer_id: transferId,
      });

    if (insertError) {
      console.error('[BANCO] Error agregando transferencia a grupo:', insertError);
      return { ok: false, error: 'Error al agregar transferencia al grupo' };
    }

    // Recalcular total del grupo
    await supabase.rpc('calculate_bank_group_total', { p_group_id: groupId });

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionAddTransferToGroup:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 7. REMOVER TRANSFERENCIA DE GRUPO
// ============================================

export async function actionRemoveTransferFromGroup(
  transferId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener el grupo de la transferencia
    const { data: groupTransfer } = await supabase
      .from('bank_group_transfers')
      .select('group_id, bank_groups!inner(status)')
      .eq('transfer_id', transferId)
      .single();

    if (!groupTransfer) {
      return { ok: false, error: 'Transferencia no encontrada en ningún grupo' };
    }

    const groupStatus = (groupTransfer as any).bank_groups?.status;
    if (groupStatus === 'PAGADO') {
      return { ok: false, error: 'No se puede modificar un grupo PAGADO' };
    }

    // Remover transferencia del grupo
    const { error } = await supabase
      .from('bank_group_transfers')
      .delete()
      .eq('transfer_id', transferId);

    if (error) {
      console.error('[BANCO] Error removiendo transferencia:', error);
      return { ok: false, error: 'Error al remover transferencia del grupo' };
    }

    // Recalcular total del grupo
    await supabase.rpc('calculate_bank_group_total', { p_group_id: groupTransfer.group_id });

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionRemoveTransferFromGroup:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 8. OBTENER GRUPOS BANCARIOS
// ============================================

export async function actionGetBankGroups(filters?: {
  status?: string;
  insurerId?: string;
  fortnightId?: string;
}): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    let query = supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        fortnights:fortnight_paid_id (id, period_start, period_end),
        bank_group_imports (id)
      `);

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.insurerId) {
      query = query.eq('insurer_id', filters.insurerId);
    }

    if (filters?.fortnightId) {
      query = query.eq('fortnight_paid_id', filters.fortnightId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[BANCO] Error obteniendo grupos:', error);
      return { ok: false, error: 'Error al cargar grupos' };
    }

    // Obtener transferencias de cada grupo
    const groupsWithTransfers = await Promise.all(
      (data || []).map(async (group) => {
        const { data: transfers } = await supabase
          .from('bank_group_transfers')
          .select('transfer_id, bank_transfers_comm!inner(*)')
          .eq('group_id', group.id);

        return {
          ...group,
          transfers: transfers || [],
        };
      })
    );

    // Ordenar alfabéticamente por nombre
    const sortedGroups = groupsWithTransfers.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return { ok: true, data: sortedGroups };
  } catch (error) {
    console.error('[BANCO] Error en actionGetBankGroups:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 9. MARCAR GRUPOS COMO PAGADOS (al cerrar quincena)
// ============================================

export async function actionMarkGroupsAsPaid(
  groupIds: string[],
  fortnightId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Actualizar grupos a PAGADO
    const { error: groupError } = await supabase
      .from('bank_groups')
      .update({
        status: 'PAGADO',
        fortnight_paid_id: fortnightId,
        paid_at: new Date().toISOString(),
      })
      .in('id', groupIds);

    if (groupError) {
      console.error('[BANCO] Error marcando grupos como pagados:', groupError);
      return { ok: false, error: 'Error al marcar grupos como pagados' };
    }

    // Obtener todas las transferencias de estos grupos
    const { data: groupTransfers } = await supabase
      .from('bank_group_transfers')
      .select('transfer_id')
      .in('group_id', groupIds);

    if (groupTransfers && groupTransfers.length > 0) {
      const transferIds = groupTransfers.map(gt => gt.transfer_id);

      // Actualizar transferencias a PAGADO
      const { error: transferError } = await supabase
        .from('bank_transfers_comm')
        .update({ status: 'PAGADO' })
        .in('id', transferIds);

      if (transferError) {
        console.error('[BANCO] Error marcando transferencias como pagadas:', transferError);
      }
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionMarkGroupsAsPaid:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 10. OBTENER ÚLTIMO CORTE
// ============================================

export async function actionGetLastCutoff(): Promise<ActionResult<{ endDate: string; suggestedStart: string; suggestedEnd: string } | null>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    const { data } = await supabase
      .from('bank_cutoffs')
      .select('end_date')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return { ok: true, data: null };
    }

    // Calcular fechas sugeridas (rango de 15 días)
    const lastEndDate = new Date(data.end_date);
    const suggestedStart = new Date(lastEndDate);
    suggestedStart.setDate(suggestedStart.getDate() + 1);

    const suggestedEnd = new Date(suggestedStart);
    suggestedEnd.setDate(suggestedEnd.getDate() + 14); // +14 días para completar 15 días de rango

    return {
      ok: true,
      data: {
        endDate: data.end_date,
        suggestedStart: suggestedStart.toISOString().split('T')[0] as string,
        suggestedEnd: suggestedEnd.toISOString().split('T')[0] as string,
      },
    };
  } catch (error) {
    console.error('[BANCO] Error en actionGetLastCutoff:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 10. AUTO-ASIGNAR ASEGURADORA DESDE NUEVA QUINCENA
// ============================================

/**
 * Auto-asignar aseguradora a transferencia bancaria desde Nueva Quincena
 * Se llama cuando se importa un reporte vinculado a una transferencia sin aseguradora
 */
export async function actionAutoAssignInsurerToTransfer(
  transferId: string,
  insurerId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Verificar que la transferencia no tenga aseguradora asignada
    const { data: transfer } = await supabase
      .from('bank_transfers_comm')
      .select('insurer_assigned_id')
      .eq('id', transferId)
      .single();

    if (!transfer) {
      return { ok: false, error: 'Transferencia no encontrada' };
    }

    // Solo asignar si no tiene aseguradora
    if (transfer.insurer_assigned_id) {
      console.log(`[BANCO] Transferencia ${transferId} ya tiene aseguradora asignada`);
      return { ok: true }; // No es error, simplemente ya tiene aseguradora
    }

    // Asignar aseguradora
    const { error } = await supabase
      .from('bank_transfers_comm')
      .update({ insurer_assigned_id: insurerId })
      .eq('id', transferId);

    if (error) {
      console.error('[BANCO] Error auto-asignando aseguradora a transferencia:', error);
      return { ok: false, error: 'Error al asignar aseguradora' };
    }

    console.log(`[BANCO] ✅ Aseguradora ${insurerId} auto-asignada a transferencia ${transferId}`);
    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionAutoAssignInsurerToTransfer:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

/**
 * Auto-asignar aseguradora a grupo bancario desde Nueva Quincena
 * Se llama cuando se importa un reporte vinculado a un grupo sin aseguradora
 */
export async function actionAutoAssignInsurerToGroup(
  groupId: string,
  insurerId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Verificar que el grupo no tenga aseguradora asignada
    const { data: group } = await supabase
      .from('bank_groups')
      .select('insurer_id')
      .eq('id', groupId)
      .single();

    if (!group) {
      return { ok: false, error: 'Grupo no encontrado' };
    }

    // Solo asignar si no tiene aseguradora
    if (group.insurer_id) {
      console.log(`[BANCO] Grupo ${groupId} ya tiene aseguradora asignada`);
      return { ok: true }; // No es error, simplemente ya tiene aseguradora
    }

    // Asignar aseguradora
    const { error } = await supabase
      .from('bank_groups')
      .update({ insurer_id: insurerId })
      .eq('id', groupId);

    if (error) {
      console.error('[BANCO] Error auto-asignando aseguradora a grupo:', error);
      return { ok: false, error: 'Error al asignar aseguradora' };
    }

    console.log(`[BANCO] ✅ Aseguradora ${insurerId} auto-asignada a grupo ${groupId}`);
    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionAutoAssignInsurerToGroup:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 11. OBTENER TRANSFERENCIAS PENDIENTES (TODOS LOS CORTES)
// ============================================

export async function actionGetPendingTransfersAllCutoffs(): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener transferencias PENDIENTES u OK_CONCILIADO que NO tienen vínculos permanentes
    const { data, error } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (id, start_date, end_date),
        bank_transfer_imports!left (id, is_temporary)
      `)
      .in('status', ['PENDIENTE', 'OK_CONCILIADO'])
      .order('date', { ascending: false });

    if (error) {
      console.error('[BANCO] Error obteniendo transferencias pendientes:', error);
      return { ok: false, error: 'Error al cargar transferencias pendientes' };
    }

    // Filtrar las que NO tienen imports permanentes
    const pendingTransfers = (data || []).filter((t: any) => {
      const imports = t.bank_transfer_imports || [];
      // Incluir si NO tiene imports o SOLO tiene imports temporales
      return imports.length === 0 || imports.every((imp: any) => imp.is_temporary === true);
    });

    return { ok: true, data: pendingTransfers };
  } catch (error) {
    console.error('[BANCO] Error en actionGetPendingTransfersAllCutoffs:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 12. OBTENER GRUPOS PENDIENTES
// ============================================

export async function actionGetPendingGroupsAll(excludeCutoffId?: string): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener grupos EN_PROCESO u OK_CONCILIADO que NO tienen vínculos permanentes
    // Y que NO son del corte actual (son históricos)
    const { data, error } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_imports!left (id, is_temporary),
        bank_group_transfers!left (id, bank_transfers_comm!inner(cutoff_id))
      `)
      .in('status', ['EN_PROCESO', 'OK_CONCILIADO'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BANCO] Error obteniendo grupos pendientes:', error);
      return { ok: false, error: 'Error al cargar grupos pendientes' };
    }

    // Filtrar los que NO tienen imports permanentes Y NO son del corte actual
    const pendingGroups = (data || []).filter((g: any) => {
      const imports = g.bank_group_imports || [];
      const hasNoImports = imports.length === 0 || imports.every((imp: any) => imp.is_temporary === true);
      
      // Si excludeCutoffId está presente, excluir grupos de ese corte
      if (excludeCutoffId && g.bank_group_transfers && g.bank_group_transfers.length > 0) {
        const isFromCurrentCutoff = g.bank_group_transfers.some((gt: any) => 
          gt.bank_transfers_comm?.cutoff_id === excludeCutoffId
        );
        if (isFromCurrentCutoff) return false; // Excluir grupos del corte actual
      }
      
      return hasNoImports;
    });

    return { ok: true, data: pendingGroups };
  } catch (error) {
    console.error('[BANCO] Error en actionGetPendingGroupsAll:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 15. OBTENER TODAS LAS TRANSFERENCIAS Y GRUPOS DISPONIBLES PARA NUEVA QUINCENA
// ============================================

export async function actionGetAvailableForImport(): Promise<ActionResult<{
  transfers: any[];
  groups: any[];
}>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener TODAS las transferencias que NO están PAGADAS
    const { data: transfers, error: transfersError } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (start_date, end_date),
        bank_transfer_imports!left (id, is_temporary),
        bank_group_transfers!left (group_id)
      `)
      .neq('status', 'PAGADO')
      .order('description_raw', { ascending: true }); // Orden alfabético

    if (transfersError) {
      console.error('[BANCO] Error obteniendo transferencias disponibles:', transfersError);
      return { ok: false, error: 'Error al cargar transferencias' };
    }

    // Obtener TODOS los grupos que NO están PAGADOS
    const { data: groups, error: groupsError } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_imports!left (id, is_temporary)
      `)
      .neq('status', 'PAGADO')
      .order('name', { ascending: true }); // Orden alfabético

    if (groupsError) {
      console.error('[BANCO] Error obteniendo grupos disponibles:', groupsError);
      return { ok: false, error: 'Error al cargar grupos' };
    }

    // Filtrar transferencias que:
    // 1. NO están en grupos
    // 2. NO tienen imports permanentes (solo disponibles si no han sido importadas o solo tienen temporales)
    const transfersNotInGroups = (transfers || []).filter((t: any) => {
      const groupTransfers = t.bank_group_transfers || [];
      const imports = t.bank_transfer_imports || [];
      
      // Si está en un grupo, no mostrar
      if (groupTransfers.length > 0) return false;
      
      // Si tiene imports NO temporales, no mostrar (ya fue usada permanentemente)
      const hasPermanentImport = imports.some((imp: any) => !imp.is_temporary);
      if (hasPermanentImport) return false;
      
      return true;
    });

    // Filtrar grupos que NO tienen imports permanentes
    const availableGroups = (groups || []).filter((g: any) => {
      const imports = g.bank_group_imports || [];
      
      // Si tiene imports NO temporales, no mostrar (ya fue usada permanentemente)
      const hasPermanentImport = imports.some((imp: any) => !imp.is_temporary);
      if (hasPermanentImport) return false;
      
      return true;
    });

    return { 
      ok: true, 
      data: {
        transfers: transfersNotInGroups,
        groups: availableGroups
      }
    };
  } catch (error) {
    console.error('[BANCO] Error en actionGetAvailableForImport:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 13. OBTENER GRUPOS DE UN CORTE ESPECÍFICO
// ============================================

export async function actionGetBankGroupsByCutoff(cutoffId: string): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener grupos que tienen transferencias del corte actual
    const { data, error } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_transfers!inner (
          id,
          bank_transfers_comm!inner (
            id,
            cutoff_id,
            date,
            reference_number,
            description_raw,
            amount,
            status,
            transfer_type,
            insurer_assigned_id
          )
        )
      `)
      .eq('bank_group_transfers.bank_transfers_comm.cutoff_id', cutoffId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BANCO] Error obteniendo grupos del corte:', error);
      return { ok: false, error: 'Error al cargar grupos' };
    }

    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('[BANCO] Error en actionGetBankGroups:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 14. MARCAR TRANSFERENCIA COMO OK (TEMPORAL)
// ============================================

export async function actionMarkTransferAsOkTemporary(
  transferId: string,
  fortnightId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Actualizar status a OK_CONCILIADO (temporal, se revertirá si se descarta)
    const { error } = await supabase
      .from('bank_transfers_comm')
      .update({ status: 'OK_CONCILIADO' })
      .eq('id', transferId);

    if (error) {
      console.error('[BANCO] Error actualizando transferencia:', error);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    console.log(`[BANCO] ✅ Transferencia ${transferId} marcada como OK_CONCILIADO (temporal)`);
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionMarkTransferAsOkTemporary:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}
