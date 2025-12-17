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
export type GroupTemplate = 'NORMAL' | 'ASSA_CODIGOS' | 'ASSA_PJ750' | 'ASSA_PJ750_1' | 'ASSA_PJ750_6' | 'ASSA_PJ750_9';
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
    const references = transfers.map(t => t.reference_number);
    const { data: existingTransfers } = await supabase
      .from('bank_transfers_comm')
      .select('reference_number')
      .in('reference_number', references);

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
    const { error: insertError } = await supabase
      .from('bank_transfers_comm')
      .insert(
        newTransfers.map(t => ({
          cutoff_id: cutoff.id,
          date: t.date,
          reference_number: t.reference_number,
          description_raw: t.description,
          amount: t.credit,
          status: 'SIN_CLASIFICAR' as BankTransferStatus,
          transfer_type: 'PENDIENTE' as TransferType,
        }))
      );

    if (insertError) {
      console.error('[BANCO] Error insertando transferencias:', insertError);
      return { ok: false, error: 'Error al importar transferencias' };
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
  } catch (error) {
    console.error('[BANCO] Error en actionImportBankCutoff:', error);
    return { ok: false, error: 'Error inesperado al importar corte bancario' };
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
// 3. OBTENER TRANSFERENCIAS
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
        bank_cutoffs:cutoff_id (start_date, end_date)
      `)
      .order('date', { ascending: false });

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
      console.error('[BANCO] Error creando grupo:', error);
      return { ok: false, error: 'Error al crear grupo' };
    }

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
        fortnights:fortnight_paid_id (id, period_start, period_end)
      `)
      .order('created_at', { ascending: false });

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

    return { ok: true, data: groupsWithTransfers };
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

    // Calcular fechas sugeridas
    const lastEndDate = new Date(data.end_date);
    const suggestedStart = new Date(lastEndDate);
    suggestedStart.setDate(suggestedStart.getDate() + 1);

    const today = new Date();
    const suggestedEnd = new Date(today);
    suggestedEnd.setDate(suggestedEnd.getDate() - 1);

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
