'use server';

/**
 * Acciones del servidor para el módulo BANCO (Conciliación bancaria)
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';
import { revalidatePath } from 'next/cache';
import { normalizeDescription } from '@/lib/banco/bancoParser';
import type { BankTransferCommRow } from '@/lib/banco/bancoParser';
import { formatDateConsistent } from '@/lib/banco/dateHelpers';

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
      return { ok: false, error: 'Error al crear corte bancario' };
    }

    // 2. Obtener referencias existentes para evitar duplicados
    const references = transfers.map(t => t.reference_number);
    const { data: existingTransfers, error: checkError } = await supabase
      .from('bank_transfers_comm')
      .select('reference_number')
      .in('reference_number', references);

    if (checkError) {
      if (checkError.code === '42P01') {
        return { ok: false, error: 'TABLA NO EXISTE: Ejecuta la migración SQL primero. Ver: supabase/migrations/20241217_banco_conciliacion.sql' };
      }
    }

    const existingRefs = new Set(existingTransfers?.map(t => t.reference_number) || []);

    // 3. Filtrar transferencias nuevas
    const newTransfers = transfers.filter(t => !existingRefs.has(t.reference_number));

    if (newTransfers.length === 0) {
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
    const transfersToInsert = newTransfers.map(t => ({
      cutoff_id: cutoff.id,
      date: t.date,
      reference_number: t.reference_number,
      description_raw: t.description,
      amount: t.credit,
      status: 'PENDIENTE' as BankTransferStatus,
      transfer_type: 'PENDIENTE' as TransferType,
    }));

    const { error: insertError } = await supabase
      .from('bank_transfers_comm')
      .insert(transfersToInsert);

    if (insertError) {
      if (insertError.code === '42P01') {
        return { ok: false, error: 'TABLA NO EXISTE: Ejecuta la migración SQL primero. Ver: supabase/migrations/20241217_banco_conciliacion.sql' };
      }
      return { ok: false, error: `Error al importar transferencias: ${insertError.message}` };
    }

    revalidatePath('/commissions');

    return {
      ok: true,
      data: {
        cutoffId: cutoff.id,
        imported: newTransfers.length,
        skipped: transfers.length - newTransfers.length,
      },
    };
  } catch (error: any) {
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
      return { ok: false, error: 'Error al cargar cortes' };
    }

    // Filtrar solo cortes que tengan transferencias
    const cutoffsWithData = await Promise.all(
      (data || []).map(async (cutoff) => {
        const { count } = await supabase
          .from('bank_transfers_comm')
          .select('*', { count: 'exact', head: true })
          .eq('cutoff_id', cutoff.id);
        
        return { cutoff, hasData: (count || 0) > 0 };
      })
    );

    // Devolver solo los que tienen transferencias
    const validCutoffs = cutoffsWithData
      .filter(item => item.hasData)
      .map(item => item.cutoff);

    return { ok: true, data: validCutoffs };
  } catch (error) {
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

    // VALIDACIÓN: Si tipo es OTRO, requiere nota interna
    if (updates.transferType === 'OTRO' && !updates.notesInternal?.trim()) {
      return { ok: false, error: 'El tipo OTRO requiere una nota interna obligatoria' };
    }

    const updateData: any = {};
    if (updates.insurerAssignedId !== undefined) updateData.insurer_assigned_id = updates.insurerAssignedId;
    if (updates.transferType !== undefined) updateData.transfer_type = updates.transferType;
    if (updates.notesInternal !== undefined) updateData.notes_internal = updates.notesInternal;
    
    // LÓGICA AUTOMÁTICA DE STATUS:
    // - Si tipo es REPORTE o BONO → status = REPORTADO automáticamente
    // - Si tipo es PENDIENTE → status = PENDIENTE automáticamente
    // - Si tipo es OTRO → permitir cambio manual de status (usa updates.status si viene)
    // - Si no viene transferType, usa el status que venga
    if (updates.transferType === 'REPORTE' || updates.transferType === 'BONO') {
      updateData.status = 'REPORTADO';
    } else if (updates.transferType === 'PENDIENTE') {
      updateData.status = 'PENDIENTE';
    } else if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    const { error } = await supabase
      .from('bank_transfers_comm')
      .update(updateData)
      .eq('id', transferId);

    if (error) {
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    // NO revalidar - dejar que el componente actualice su estado local
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 4.1 MARCAR TRANSFERENCIAS COMO PAGADAS (MANUAL)
// ============================================

export async function actionMarkTransfersAsPaid(
  transferIds: string[],
  paymentDate: string,
  paymentNotes?: string,
  transferType?: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener transferencias actuales para preservar notas existentes y verificar tipos
    const { data: currentTransfers, error: fetchError } = await supabase
      .from('bank_transfers_comm')
      .select('id, notes_internal, transfer_type')
      .in('id', transferIds);

    if (fetchError) {
      return { ok: false, error: 'Error al obtener transferencias' };
    }

    // Formatear nota de pago
    const dateParts = paymentDate.split('-');
    let paymentNote = '';
    if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      const shortYear = year.slice(2);
      paymentNote = `Pagado manualmente - ${day}-${month}-${shortYear}`;
      if (paymentNotes?.trim()) {
        paymentNote += ` - ${paymentNotes}`;
      }
    }

    // Actualizar cada transferencia preservando notas existentes
    for (const transfer of currentTransfers || []) {
      const existingNotes = transfer.notes_internal || '';
      
      // Preservar marcador de inclusión si existe
      let newNote = paymentNote;
      if (existingNotes.includes('Incluida en corte:') || existingNotes.includes('🔗 Incluida en corte:')) {
        // Mantener nota de inclusión y agregar nota de pago
        newNote = `${existingNotes} | ${paymentNote}`;
      }

      // Determinar el tipo a asignar
      let finalTransferType = transfer.transfer_type;
      if (transfer.transfer_type === 'PENDIENTE' && transferType) {
        // Si el tipo actual es PENDIENTE y se proporcionó un tipo, usar el proporcionado
        finalTransferType = transferType as TransferType;
      }

      const { error: updateError } = await supabase
        .from('bank_transfers_comm')
        .update({
          status: 'PAGADO',
          transfer_type: finalTransferType,
          notes_internal: newNote,
        })
        .eq('id', transfer.id);

      if (updateError) {
        console.error(`Error actualizando transferencia ${transfer.id}:`, updateError);
        return { ok: false, error: 'Error al marcar como pagado' };
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 4.2 ACTUALIZAR TRANSFERENCIAS DE GRUPO EN MASA
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
      // - Si tipo es PENDIENTE → status = PENDIENTE automáticamente
      if (updates.transferType === 'REPORTE' || updates.transferType === 'BONO') {
        updateData.status = 'REPORTADO';
      } else if (updates.transferType === 'PENDIENTE') {
        updateData.status = 'PENDIENTE';
      }
    }

    const { error } = await supabase
      .from('bank_transfers_comm')
      .update(updateData)
      .in('id', transferIds);

    if (error) {
      return { ok: false, error: 'Error al actualizar transferencias' };
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 4.3 MARCAR GRUPO COMPLETO COMO PAGADO
// ============================================

export async function actionMarkGroupAsPaid(
  groupId: string,
  paymentDate: string,
  paymentNotes?: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // 1. Verificar que el grupo existe y no está PAGADO
    const { data: group } = await supabase
      .from('bank_groups')
      .select('status')
      .eq('id', groupId)
      .single();

    if (!group) {
      return { ok: false, error: 'Grupo no encontrado' };
    }

    if (group.status === 'PAGADO') {
      return { ok: false, error: 'Este grupo ya está marcado como PAGADO' };
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

    // 3. Formatear nota de pago
    const dateParts = paymentDate.split('-');
    let formattedNote = '';
    if (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2]) {
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      const shortYear = year.slice(2);
      formattedNote = `Pagado manualmente (grupo) - ${day}-${month}-${shortYear}`;
      if (paymentNotes?.trim()) {
        formattedNote += ` - ${paymentNotes}`;
      }
    }

    // 4. Marcar todas las transferencias del grupo como PAGADO
    const { error: transfersError } = await supabase
      .from('bank_transfers_comm')
      .update({
        status: 'PAGADO',
        notes_internal: formattedNote,
      })
      .in('id', transferIds);

    if (transfersError) {
      return { ok: false, error: 'Error al marcar transferencias como pagadas' };
    }

    // 5. Marcar el grupo como PAGADO
    const { error: groupError } = await supabase
      .from('bank_groups')
      .update({
        status: 'PAGADO',
      })
      .eq('id', groupId);

    if (groupError) {
      return { ok: false, error: 'Error al marcar grupo como pagado' };
    }

    return { ok: true };
  } catch (error) {
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
      return { ok: false, error: `Error al crear grupo: ${error.message || 'desconocido'}` };
    }

    // NO revalidar aquí - dejar que el componente padre lo haga al final
    return { ok: true, data: { groupId: group.id } };
  } catch (error) {
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
      return { ok: false, error: 'Error al agregar transferencia al grupo' };
    }

    // Recalcular total del grupo
    await supabase.rpc('calculate_bank_group_total', { p_group_id: groupId });

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 6.1 AGREGAR MÚLTIPLES TRANSFERENCIAS A GRUPO (BATCH)
// ============================================

export async function actionAddTransfersToGroupBatch(
  groupId: string,
  transferIds: string[]
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    if (transferIds.length === 0) {
      return { ok: false, error: 'No hay transferencias para agregar' };
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

    // Verificar que ninguna transferencia esté en otro grupo
    const { data: existing } = await supabase
      .from('bank_group_transfers')
      .select('transfer_id')
      .in('transfer_id', transferIds);

    if (existing && existing.length > 0) {
      const duplicates = existing.map(e => e.transfer_id);
      return { ok: false, error: `${duplicates.length} transferencia(s) ya pertenecen a otro grupo` };
    }

    // Insertar todas las relaciones en una sola query (BATCH)
    const records = transferIds.map(transferId => ({
      group_id: groupId,
      transfer_id: transferId,
    }));

    const { error: insertError } = await supabase
      .from('bank_group_transfers')
      .insert(records);

    if (insertError) {
      return { ok: false, error: 'Error al agregar transferencias al grupo' };
    }

    // Recalcular total del grupo una sola vez
    await supabase.rpc('calculate_bank_group_total', { p_group_id: groupId });

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
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
      return { ok: false, error: 'Error al remover transferencia del grupo' };
    }

    // Recalcular total del grupo
    await supabase.rpc('calculate_bank_group_total', { p_group_id: groupTransfer.group_id });

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
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
      return { ok: false, error: 'Error al cargar grupos' };
    }

    // Obtener transferencias de cada grupo y calcular total
    const groupsWithTransfers = await Promise.all(
      (data || []).map(async (group) => {
        const { data: transfers } = await supabase
          .from('bank_group_transfers')
          .select('transfer_id, bank_transfers_comm!inner(*)')
          .eq('group_id', group.id);

        // Calcular total dinámicamente
        const totalAmount = (transfers || []).reduce((sum, t) => {
          return sum + (t.bank_transfers_comm?.amount || 0);
        }, 0);

        return {
          ...group,
          transfers: transfers || [],
          total_amount: totalAmount, // Sobrescribir con valor calculado
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
        // Error silencioso
      }
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
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
      return { ok: true }; // No es error, simplemente ya tiene aseguradora
    }

    // Asignar aseguradora
    const { error } = await supabase
      .from('bank_transfers_comm')
      .update({ insurer_assigned_id: insurerId })
      .eq('id', transferId);

    if (error) {
      return { ok: false, error: 'Error al asignar aseguradora' };
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
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
      return { ok: true }; // No es error, simplemente ya tiene aseguradora
    }

    // Asignar aseguradora
    const { error } = await supabase
      .from('bank_groups')
      .update({ insurer_id: insurerId })
      .eq('id', groupId);

    if (error) {
      return { ok: false, error: 'Error al asignar aseguradora' };
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 11. OBTENER TRANSFERENCIAS PENDIENTES (TODOS LOS CORTES)
// ============================================
// IMPORTANTE: Solo muestra transferencias de cortes ANTERIORES al corte actual
// Esto evita que se muestren transferencias de cortes futuros en "Pendientes"

export async function actionGetPendingTransfersAllCutoffs(currentCutoffEndDate?: string): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener transferencias PENDIENTES que NO tienen vínculos permanentes
    // Si se proporciona currentCutoffEndDate, filtrar SOLO cortes ANTERIORES
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
      return { ok: false, error: 'Error al cargar transferencias pendientes' };
    }

    // Filtrar las que NO tienen imports permanentes
    // Y si hay fecha límite, SOLO mostrar transferencias de cortes ANTERIORES
    const pendingTransfers = (data || []).filter((t: any) => {
      const imports = t.bank_transfer_imports || [];
      const hasNoImports = imports.length === 0 || imports.every((imp: any) => imp.is_temporary === true);
      
      if (!hasNoImports) return false;
      
      // CRÍTICO: Si hay fecha de corte actual, solo mostrar transferencias de cortes ANTERIORES
      // Esto evita que pendientes muestre transferencias de cortes futuros
      if (currentCutoffEndDate && t.bank_cutoffs?.end_date) {
        const transferCutoffEnd = new Date(t.bank_cutoffs.end_date);
        const currentCutoffEnd = new Date(currentCutoffEndDate);
        
        // Solo incluir si el corte de la transferencia terminó ANTES del corte actual
        return transferCutoffEnd < currentCutoffEnd;
      }
      
      // Si no hay currentCutoffEndDate, incluir todas (backward compatibility)
      return true;
    });

    return { ok: true, data: pendingTransfers };
  } catch (error) {
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
      return { ok: false, error: 'Error al cargar transferencias agrupadas' };
    }
    
    const groupedIds = new Set((groupedTransferIds || []).map((gt: any) => gt.transfer_id));

    // SEGUNDO: Obtener SOLO las transferencias con status REPORTADO
    const { data: transfers, error: transfersError } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers:insurer_assigned_id (id, name),
        bank_cutoffs:cutoff_id (start_date, end_date),
        bank_transfer_imports!left (id, is_temporary)
      `)
      .eq('status', 'REPORTADO')
      .order('description_raw', { ascending: true }); // Orden alfabético

    if (transfersError) {
      return { ok: false, error: 'Error al cargar transferencias' };
    }

    // Obtener TODOS los grupos que NO están PAGADOS
    const { data: groups, error: groupsError } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_imports!left (id, is_temporary),
        group_template
      `)
      .neq('status', 'PAGADO')
      .order('name', { ascending: true }); // Orden alfabético

    if (groupsError) {
      return { ok: false, error: 'Error al cargar grupos' };
    }

    // Filtrar transferencias que:
    // 1. NO están en grupos (usando Set de IDs agrupados)
    // 2. NO tienen NINGÚN import (temporal o permanente - una vez usada desaparece)
    const transfersNotInGroups = (transfers || []).filter((t: any) => {
      const imports = t.bank_transfer_imports || [];
      
      // Si está en un grupo (verificar con Set de IDs), no mostrar
      if (groupedIds.has(t.id)) {
        return false;
      }
      
      // Si tiene CUALQUIER import (temporal o permanente), no mostrar
      if (imports.length > 0) {
        return false;
      }
      
      return true;
    });

    // Filtrar grupos que NO tienen NINGÚN import (temporal o permanente)
    const availableGroups = (groups || []).filter((g: any) => {
      const imports = g.bank_group_imports || [];
      
      // Si tiene CUALQUIER import (temporal o permanente), no mostrar
      // Una vez seleccionado para un import, desaparece del dropdown
      if (imports.length > 0) {
        return false;
      }
      
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

    // Obtener grupos del corte
    const { data, error } = await supabase
      .from('bank_groups')
      .select(`
        *,
        insurers:insurer_id (id, name),
        bank_group_transfers (
          id,
          bank_transfers_comm (
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
      .eq('cutoff_id', cutoffId)
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
    console.log('[INCLUDE] 🚀 Iniciando inclusión de transferencia:', { transferId, currentCutoffId, transferType, insurerId });
    
    const { role } = await getAuthContext();
    if (role !== 'master') {
      console.log('[INCLUDE] ❌ Acceso denegado - no es master');
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[INCLUDE] ❌ Usuario no autenticado');
      return { ok: false, error: 'No autenticado' };
    }

    // 1. Obtener la transferencia original
    console.log('[INCLUDE] 📝 Paso 1: Obteniendo transferencia...');
    const { data: transfer, error: transferError } = await supabase
      .from('bank_transfers_comm')
      .select('*, bank_cutoffs:cutoff_id(id, start_date, end_date)')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      console.log('[INCLUDE] ❌ Error obteniendo transferencia:', transferError);
      return { ok: false, error: 'Transferencia no encontrada' };
    }
    
    console.log('[INCLUDE] ✅ Transferencia obtenida:', { amount: transfer.amount, status: transfer.status });

    // Permitir incluir transferencias PENDIENTE o REPORTADO
    if (transfer.status !== 'PENDIENTE' && transfer.status !== 'REPORTADO') {
      return { ok: false, error: 'Solo se pueden incluir transferencias PENDIENTE o REPORTADO' };
    }

    // 2. Obtener información del corte destino para las notas
    console.log('[INCLUDE] 📝 Paso 2: Obteniendo corte destino...');
    const { data: targetCutoff, error: targetCutoffError } = await supabase
      .from('bank_cutoffs')
      .select('id, start_date, end_date')
      .eq('id', currentCutoffId)
      .single();

    if (targetCutoffError || !targetCutoff) {
      console.log('[INCLUDE] ❌ Error obteniendo corte destino:', targetCutoffError);
      return { ok: false, error: 'Error al obtener información del corte destino' };
    }
    console.log('[INCLUDE] ✅ Corte destino obtenido');

    // 3. Preparar nota de rastreo con ID del corte (más confiable que fechas)
    console.log('[INCLUDE] 📝 Paso 3: Preparando notas...');
    const targetCutoffLabel = `${formatDateConsistent(targetCutoff.start_date)} - ${formatDateConsistent(targetCutoff.end_date)}`;
    const originalNotes = transfer.notes_internal || '';
    // Guardar tanto el label legible como el ID para búsqueda confiable
    const trackingNote = `📌 Incluida en corte: ${targetCutoffLabel} [ID:${currentCutoffId}] (${formatDateConsistent(new Date().toISOString())})`;
    const updatedNotes = originalNotes 
      ? `${originalNotes}\n${trackingNote}` 
      : trackingNote;
    console.log('[INCLUDE] ✅ Notas preparadas:', updatedNotes);

    // 4. Actualizar la transferencia con tipo, aseguradora y notas de rastreo
    console.log('[INCLUDE] 📝 Paso 4: Actualizando transferencia...');
    const { error: updateError } = await supabase
      .from('bank_transfers_comm')
      .update({
        transfer_type: transferType,
        insurer_assigned_id: insurerId,
        status: transferType === 'REPORTE' || transferType === 'BONO' ? 'REPORTADO' : 'PENDIENTE',
        notes_internal: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (updateError) {
      console.log('[INCLUDE] ❌ Error actualizando transferencia:', updateError);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }
    console.log('[INCLUDE] ✅ Transferencia actualizada (mantiene su cutoff_id original)');

    // Nota: La transferencia MANTIENE su cutoff_id original
    // El rastreo de inclusión se hace mediante las notas internas
    // La query de transferencias incluidas busca por las notas con el label del corte

    console.log('[INCLUDE] 🎉 ÉXITO COMPLETO - Transferencia incluida correctamente');
    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.log('[INCLUDE] 💥 ERROR CATCH:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 16. OBTENER TRANSFERENCIAS INCLUIDAS DE OTROS CORTES
// ============================================

export async function actionGetIncludedTransfers(
  cutoffId: string
): Promise<ActionResult<any[]>> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    console.log('[BANCO] actionGetIncludedTransfers - cutoffId:', cutoffId);

    // Query SIMPLE: obtener TODAS las transferencias con "Incluida en corte:" en notes
    // Sin filtros complejos - dejar que el filtro en memoria lo maneje
    const { data: allTransfers, error } = await supabase
      .from('bank_transfers_comm')
      .select(`
        *,
        insurers!insurer_assigned_id(id, name),
        original_cutoff:bank_cutoffs!cutoff_id(id, start_date, end_date)
      `)
      .like('notes_internal', '%Incluida en corte:%')
      .order('date', { ascending: false });

    if (error) {
      console.error('[BANCO] Error obteniendo transferencias:', error);
      return { ok: false, error: 'Error al obtener transferencias incluidas' };
    }

    console.log(`[BANCO] Total transferencias con "Incluida en corte:": ${allTransfers?.length || 0}`);

    // Filtro SIMPLE en memoria (como hace Pendientes)
    const includedInThisCutoff = (allTransfers || []).filter((t: any) => {
      const notes = t.notes_internal || '';
      
      // Buscar si esta transferencia fue incluida en ESTE corte específico
      // Simplemente verificar si las notas contienen [ID:cutoffId]
      const hasThisCutoffId = notes.includes(`[ID:${cutoffId}]`);
      
      console.log(`[BANCO] Transfer ${t.reference_number} - has ID: ${hasThisCutoffId}, notes: ${notes.substring(0, 150)}`);
      
      return hasThisCutoffId;
    });

    console.log(`[BANCO] Transferencias incluidas en corte ${cutoffId}: ${includedInThisCutoff.length}`);

    // Transformar datos
    const result = includedInThisCutoff.map((t: any) => ({
      id: t.id,
      reference_number: t.reference_number,
      date: t.date,
      amount: t.amount,
      description_raw: t.description_raw,
      status: t.status,
      transfer_type: t.transfer_type,
      notes_internal: t.notes_internal,
      insurer_assigned: t.insurers,
      original_cutoff: t.original_cutoff,
      created_at: t.created_at,
      updated_at: t.updated_at
    }));

    return { ok: true, data: result };
  } catch (error) {
    console.error('[BANCO] Error en actionGetIncludedTransfers:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}

// ============================================
// 17. REVERTIR INCLUSIÓN DE TRANSFERENCIA
// ============================================

export async function actionRevertTransferInclusion(
  transferId: string
): Promise<ActionResult> {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Acceso denegado' };
    }

    const supabase = await getSupabaseServer();

    // 1. Obtener la transferencia
    const { data: transfer, error: transferError } = await supabase
      .from('bank_transfers_comm')
      .select('*, bank_cutoffs:cutoff_id(id, start_date, end_date)')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      return { ok: false, error: 'Transferencia no encontrada' };
    }

    // 2. Limpiar notas de inclusión (eliminar líneas que empiezan con 📌 Incluida en corte:)
    let cleanedNotes = transfer.notes_internal || '';
    const noteLines = cleanedNotes.split('\n');
    const filteredLines = noteLines.filter(line => !line.trim().startsWith('📌 Incluida en corte:'));
    cleanedNotes = filteredLines.join('\n').trim();

    // 3. Actualizar transferencia: limpiar notas, cambiar status a PENDIENTE, tipo a PENDIENTE
    const { error: updateError } = await supabase
      .from('bank_transfers_comm')
      .update({
        notes_internal: cleanedNotes || null,
        status: 'PENDIENTE',
        transfer_type: 'PENDIENTE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (updateError) {
      console.error('[BANCO] Error actualizando transferencia:', updateError);
      return { ok: false, error: 'Error al actualizar transferencia' };
    }

    // 4. Eliminar transferencia de todos los grupos
    const { data: groupTransfers, error: gtError } = await supabase
      .from('bank_group_transfers')
      .select('group_id')
      .eq('transfer_id', transferId);

    if (!gtError && groupTransfers && groupTransfers.length > 0) {
      // Eliminar relaciones
      await supabase
        .from('bank_group_transfers')
        .delete()
        .eq('transfer_id', transferId);

      // Recalcular totales de los grupos afectados
      for (const gt of groupTransfers) {
        await supabase.rpc('calculate_bank_group_total', { p_group_id: gt.group_id });
      }
    }

    revalidatePath('/commissions');
    return { ok: true };
  } catch (error) {
    console.error('[BANCO] Error en actionRevertTransferInclusion:', error);
    return { ok: false, error: 'Error inesperado' };
  }
}
