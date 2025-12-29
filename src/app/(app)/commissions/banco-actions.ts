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

export type BankTransferStatus = 'SIN_CLASIFICAR' | 'PENDIENTE' | 'REPORTADO' | 'PAGADO';
export type TransferType = 'REPORTE' | 'BONO' | 'OTRO' | 'PENDIENTE';
export type GroupTemplate = 'NORMAL' | 'ASSA_CODIGOS';
export type GroupStatus = 'EN_PROCESO' | 'PAGADO';

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

    // VALIDACIÓN: Si tipo es OTRO, requiere nota interna
    if (updates.transferType === 'OTRO' && !updates.notesInternal?.trim()) {
      return { ok: false, error: 'El tipo OTRO requiere una nota interna obligatoria' };
    }

    const supabase = await getSupabaseServer();

    const updateData: any = {};
    if (updates.insurerAssignedId !== undefined) updateData.insurer_assigned_id = updates.insurerAssignedId;
    if (updates.transferType !== undefined) updateData.transfer_type = updates.transferType;
    if (updates.notesInternal !== undefined) updateData.notes_internal = updates.notesInternal;
    
    // LÓGICA AUTOMÁTICA DE STATUS:
    // - Si tipo es REPORTE o BONO → status = REPORTADO automáticamente
    // - Si tipo es OTRO → permitir cambio manual de status (usa updates.status si viene)
    // - Si no viene transferType, usa el status que venga
    if (updates.transferType === 'REPORTE' || updates.transferType === 'BONO') {
      updateData.status = 'REPORTADO';
      console.log(`[BANCO] Cambiando status a REPORTADO automáticamente (tipo: ${updates.transferType})`);
    } else if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    const { error } = await supabase
      .from('bank_transfers_comm')
      .update(updateData)
      .eq('id', transferId);

    if (error) {
      console.error('[BANCO] Error actualizando transferencia:', error);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    // NO revalidar - dejar que el componente actualice su estado local
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionUpdateBankTransfer:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 4.1 ACTUALIZAR TRANSFERENCIAS DE GRUPO EN MASA
// ============================================

export async function actionUpdateGroupTransfers(
  groupId: string,
  updates: {
    insurerAssignedId?: string;
    transferType?: TransferType;
  }
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // 1. Verificar que el grupo no esté PAGADO
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

    // 2. Obtener IDs de todas las transferencias del grupo
    const { data: groupTransfers } = await supabase
      .from('bank_group_transfers')
      .select('transfer_id')
      .eq('group_id', groupId);

    if (!groupTransfers || groupTransfers.length === 0) {
      return { ok: false, error: 'El grupo no tiene transferencias' };
    }

    const transferIds = groupTransfers.map(gt => gt.transfer_id);

    // 3. Actualizar todas las transferencias del grupo
    const updateData: any = {};
    if (updates.insurerAssignedId !== undefined) {
      updateData.insurer_assigned_id = updates.insurerAssignedId || null;
    }
    if (updates.transferType !== undefined) {
      updateData.transfer_type = updates.transferType;
      
      // LÓGICA AUTOMÁTICA DE STATUS EN MASA:
      // - Si tipo es REPORTE o BONO → status = REPORTADO automáticamente
      if (updates.transferType === 'REPORTE' || updates.transferType === 'BONO') {
        updateData.status = 'REPORTADO';
        console.log(`[BANCO] Cambiando status de ${transferIds.length} transfers a REPORTADO (tipo: ${updates.transferType})`);
      }
    }

    const { error } = await supabase
      .from('bank_transfers_comm')
      .update(updateData)
      .in('id', transferIds);

    if (error) {
      console.error('[BANCO] Error actualizando transferencias del grupo:', error);
      return { ok: false, error: 'Error al actualizar transferencias' };
    }

    revalidatePath('/commissions');
    console.log(`[BANCO] ✅ ${transferIds.length} transferencias del grupo actualizadas`);
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionUpdateGroupTransfers:', error);
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
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No autenticado' };
    }

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
      console.error('[BANCO] Error creando grupo:', error.message);
      return { ok: false, error: `Error al crear grupo: ${error.message || 'desconocido'}` };
    }

    // NO revalidar aquí - dejar que el componente padre lo haga al final
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

    // Obtener transferencias PENDIENTES que NO tienen vínculos permanentes
    const { data, error } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (id, start_date, end_date),
        bank_transfer_imports!left (id, is_temporary)
      `)
      .eq('status', 'PENDIENTE')
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

    // Obtener grupos EN_PROCESO que NO tienen vínculos permanentes
    // Y que NO son del corte actual (son históricos)
    const { data, error } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_imports!left (id, is_temporary),
        bank_group_transfers!left (id, bank_transfers_comm!inner(cutoff_id))
      `)
      .eq('status', 'EN_PROCESO')
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

    // PRIMERO: Obtener IDs de transferencias que están agrupadas
    const { data: groupedTransferIds, error: groupedError } = await supabase
      .from('bank_group_transfers')
      .select('transfer_id');
    
    if (groupedError) {
      console.error('[BANCO] Error obteniendo transferencias agrupadas:', groupedError);
      return { ok: false, error: 'Error al cargar transferencias agrupadas' };
    }
    
    const groupedIds = new Set((groupedTransferIds || []).map((gt: any) => gt.transfer_id));
    console.log('[BANCO] 🔍 DEBUG: Transferencias agrupadas (IDs):', Array.from(groupedIds));

    // SEGUNDO: Obtener TODAS las transferencias que NO están PAGADAS
    const { data: transfers, error: transfersError } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (start_date, end_date),
        bank_transfer_imports!left (id, is_temporary)
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

    console.log('[BANCO] 🔍 DEBUG: Total transferencias obtenidas:', transfers?.length);
    console.log('[BANCO] 🔍 DEBUG: Total grupos obtenidos:', groups?.length);
    console.log('[BANCO] 🔍 DEBUG: Total IDs agrupados:', groupedIds.size);

    // Filtrar transferencias que:
    // 1. NO están en grupos (usando Set de IDs agrupados)
    // 2. NO tienen NINGÚN import (temporal o permanente - una vez usada desaparece)
    const transfersNotInGroups = (transfers || []).filter((t: any) => {
      const imports = t.bank_transfer_imports || [];
      
      // Si está en un grupo (verificar con Set de IDs), no mostrar
      if (groupedIds.has(t.id)) {
        console.log(`[BANCO] ❌ Excluir transfer ${t.id} - está en grupo`);
        return false;
      }
      
      // Si tiene CUALQUIER import (temporal o permanente), no mostrar
      if (imports.length > 0) {
        console.log(`[BANCO] ❌ Excluir transfer ${t.id} - tiene ${imports.length} imports`);
        return false;
      }
      
      console.log(`[BANCO] ✅ Incluir transfer ${t.id} - disponible`);
      return true;
    });

    // Filtrar grupos que NO tienen NINGÚN import (temporal o permanente)
    const availableGroups = (groups || []).filter((g: any) => {
      const imports = g.bank_group_imports || [];
      
      // Si tiene CUALQUIER import (temporal o permanente), no mostrar
      // Una vez seleccionado para un import, desaparece del dropdown
      if (imports.length > 0) {
        console.log(`[BANCO] ❌ Excluir grupo ${g.id} (${g.name}) - tiene ${imports.length} imports`);
        return false;
      }
      
      console.log(`[BANCO] ✅ Incluir grupo ${g.id} (${g.name}) - disponible`);
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

    // Marcar como REPORTADO temporalmente (se revertirá si se descarta)
    const { error } = await supabase
      .from('bank_transfers_comm')
      .update({ status: 'REPORTADO' })
      .eq('id', transferId);

    if (error) {
      console.error('[BANCO] Error al actualizar transferencia:', error);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    console.log(`[BANCO] ✅ Transferencia ${transferId} marcada como REPORTADO (temporal)`);
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionMarkTransferAsReportedTemporary:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 16. ELIMINAR GRUPO BANCARIO
// ============================================

export async function actionDeleteBankGroup(groupId: string): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Verificar si el grupo tiene transferencias pagadas
    const { data: group, error: groupError } = await (supabase as any)
      .from('bank_groups')
      .select('status')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      console.error('[BANCO] Error obteniendo grupo:', groupError);
      return { ok: false, error: 'Grupo no encontrado' };
    }

    if (group.status === 'PAGADO') {
      return { ok: false, error: 'No se puede eliminar un grupo con transferencias pagadas' };
    }

    // Eliminar relaciones grupo-transferencias (CASCADE debería hacerlo, pero lo hacemos explícito)
    const { error: relError } = await (supabase as any)
      .from('bank_group_transfers')
      .delete()
      .eq('group_id', groupId);

    if (relError) {
      console.error('[BANCO] Error eliminando relaciones:', relError);
      return { ok: false, error: 'Error al eliminar relaciones del grupo' };
    }

    // Eliminar grupo
    const { error: deleteError } = await (supabase as any)
      .from('bank_groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      console.error('[BANCO] Error eliminando grupo:', deleteError);
      return { ok: false, error: 'Error al eliminar grupo' };
    }

    revalidatePath('/commissions');
    console.log(`[BANCO] ✅ Grupo ${groupId} eliminado`);
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionDeleteBankGroup:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 17. ELIMINAR TRANSFERENCIA BANCARIA
// ============================================

export async function actionDeleteBankTransfer(transferId: string): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Verificar si la transferencia está pagada y obtener cutoff_id
    const { data: transfer, error: transferError } = await supabase
      .from('bank_transfers_comm')
      .select('status, cutoff_id')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      return { ok: false, error: 'Transferencia no encontrada' };
    }

    if (transfer.status === 'PAGADO') {
      return { ok: false, error: 'No se puede eliminar una transferencia pagada (vinculada a quincena cerrada)' };
    }

    const cutoffId = transfer.cutoff_id;

    // Eliminar anotaciones asociadas (si existen)
    const { error: annotationsError } = await (supabase as any)
      .from('bank_transfer_annotations')
      .delete()
      .eq('transfer_id', transferId);

    if (annotationsError) {
      console.error('[BANCO] Error eliminando anotaciones:', annotationsError);
      // No fallamos por esto, continuamos
    }

    // Eliminar relación con grupo (si existe)
    const { error: groupRelError } = await (supabase as any)
      .from('bank_group_transfers')
      .delete()
      .eq('transfer_id', transferId);

    if (groupRelError) {
      console.error('[BANCO] Error eliminando relación con grupo:', groupRelError);
      // No fallamos por esto, continuamos
    }

    // Eliminar transferencia
    const { error: deleteError } = await supabase
      .from('bank_transfers_comm')
      .delete()
      .eq('id', transferId);

    if (deleteError) {
      console.error('[BANCO] Error eliminando transferencia:', deleteError);
      return { ok: false, error: 'Error al eliminar transferencia' };
    }

    // Verificar si quedan transferencias en el corte
    if (cutoffId) {
      const { data: remainingTransfers, error: checkError } = await supabase
        .from('bank_transfers_comm')
        .select('id')
        .eq('cutoff_id', cutoffId)
        .limit(1);

      if (!checkError && remainingTransfers && remainingTransfers.length === 0) {
        // No quedan transferencias, eliminar el corte
        const { error: cutoffDeleteError } = await supabase
          .from('bank_cutoffs')
          .delete()
          .eq('id', cutoffId);

        if (cutoffDeleteError) {
          console.error('[BANCO] Error eliminando corte vacío:', cutoffDeleteError);
        } else {
          console.log(`[BANCO] ✅ Corte ${cutoffId} eliminado (sin transferencias)`);
        }
      }
    }

    revalidatePath('/commissions');
    console.log(`[BANCO] ✅ Transferencia ${transferId} eliminada con sus anotaciones`);
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionDeleteBankTransfer:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 15. INCLUIR TRANSFERENCIA PENDIENTE EN QUINCENA ACTUAL
// ============================================

export async function actionIncludeTransferInCurrentFortnight(
  transferId: string,
  currentCutoffId: string,
  transferType: TransferType,
  insurerId: string
): Promise<ActionResult<{ groupId: string }>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No autenticado' };
    }

    // 1. Obtener la transferencia original
    const { data: transfer, error: transferError } = await supabase
      .from('bank_transfers_comm')
      .select('*, bank_cutoffs:cutoff_id(id, start_date, end_date)')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      return { ok: false, error: 'Transferencia no encontrada' };
    }

    if (transfer.status !== 'PENDIENTE') {
      return { ok: false, error: 'Solo se pueden incluir transferencias PENDIENTE' };
    }

    // 2. Actualizar la transferencia con tipo y aseguradora
    const { error: updateError } = await supabase
      .from('bank_transfers_comm')
      .update({
        transfer_type: transferType,
        insurer_assigned_id: insurerId,
        status: transferType === 'REPORTE' || transferType === 'BONO' ? 'REPORTADO' : 'PENDIENTE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (updateError) {
      console.error('[BANCO] Error actualizando transferencia:', updateError);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    // 3. Buscar o crear grupo "Transferencias de otras quincenas" en el corte actual
    let { data: currentGroup, error: groupError } = await supabase
      .from('bank_groups')
      .select('*')
      .eq('cutoff_id', currentCutoffId)
      .eq('name', 'Transferencias de otras quincenas')
      .maybeSingle();

    if (groupError && groupError.code !== 'PGRST116') {
      console.error('[BANCO] Error buscando grupo:', groupError);
      return { ok: false, error: 'Error al buscar grupo' };
    }

    // Crear grupo si no existe
    if (!currentGroup) {
      const { data: newGroup, error: createGroupError } = await supabase
        .from('bank_groups')
        .insert({
          name: 'Transferencias de otras quincenas',
          cutoff_id: currentCutoffId,
          insurer_id: insurerId,
          group_template: 'NORMAL',
          status: 'EN_PROCESO',
          total_amount: 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (createGroupError || !newGroup) {
        console.error('[BANCO] Error creando grupo:', createGroupError);
        return { ok: false, error: 'Error al crear grupo' };
      }

      currentGroup = newGroup;
    }

    // 4. Agregar transferencia al grupo del corte actual
    const { error: addError } = await supabase
      .from('bank_group_transfers')
      .insert({
        group_id: currentGroup.id,
        transfer_id: transferId,
      });

    if (addError) {
      console.error('[BANCO] Error agregando transferencia al grupo:', addError);
      return { ok: false, error: 'Error al agregar transferencia al grupo' };
    }

    // 5. Actualizar total del grupo
    const { error: updateGroupError } = await supabase
      .from('bank_groups')
      .update({
        total_amount: (currentGroup.total_amount || 0) + transfer.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentGroup.id);

    if (updateGroupError) {
      console.error('[BANCO] Error actualizando total del grupo:', updateGroupError);
    }

    // 6. Si la transferencia tiene corte original, crear/actualizar grupo "Pagados en otras quincenas"
    if (transfer.cutoff_id && transfer.cutoff_id !== currentCutoffId) {
      let { data: originalGroup, error: origGroupError } = await supabase
        .from('bank_groups')
        .select('*')
        .eq('cutoff_id', transfer.cutoff_id)
        .eq('name', 'Pagados en otras quincenas')
        .maybeSingle();

      if (origGroupError && origGroupError.code !== 'PGRST116') {
        console.error('[BANCO] Error buscando grupo original:', origGroupError);
      }

      // Crear grupo en corte original si no existe
      if (!originalGroup) {
        const { data: newOrigGroup, error: createOrigGroupError } = await supabase
          .from('bank_groups')
          .insert({
            name: 'Pagados en otras quincenas',
            cutoff_id: transfer.cutoff_id,
            insurer_id: insurerId,
            group_template: 'NORMAL',
            status: 'EN_PROCESO',
            total_amount: 0,
            created_by: user.id,
          })
          .select()
          .single();

        if (!createOrigGroupError && newOrigGroup) {
          originalGroup = newOrigGroup;
        }
      }

      // Agregar transferencia al grupo del corte original
      if (originalGroup) {
        await supabase
          .from('bank_group_transfers')
          .insert({
            group_id: originalGroup.id,
            transfer_id: transferId,
          });

        // Actualizar total del grupo original
        await supabase
          .from('bank_groups')
          .update({
            total_amount: (originalGroup.total_amount || 0) + transfer.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', originalGroup.id);
      }
    }

    revalidatePath('/commissions');
    return { ok: true, data: { groupId: currentGroup.id } };
  } catch (error) {
    console.error('[BANCO] Error en actionIncludeTransferInCurrentFortnight:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}
