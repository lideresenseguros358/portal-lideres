'use server';

// =====================================================
// SERVER ACTIONS - CATALOG MANAGEMENT
// =====================================================

import { getSupabaseServer } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/server';
import type { RamoCatalog, AseguradoraCatalog, TramiteCatalog, VacationConfig } from '@/lib/ticketing/types';

// =====================================================
// RAMOS CATALOG
// =====================================================

export async function actionGetRamosCatalog() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('ramos_catalog')
    .select('*')
    .order('display_order');

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as RamoCatalog[] };
}

export async function actionCreateRamo(ramo: Omit<TablesInsert<'ramos_catalog'>, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await getSupabaseServer();

  // Verificar que el usuario es master
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { data, error } = await supabase
    .from('ramos_catalog')
    .insert(ramo satisfies TablesInsert<'ramos_catalog'>)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function actionUpdateRamo(id: string, updates: TablesUpdate<'ramos_catalog'>) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { error } = await supabase
    .from('ramos_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// =====================================================
// ASEGURADORAS CATALOG
// =====================================================

export async function actionGetAseguradorasCatalog() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('aseguradoras_catalog')
    .select('*, insurers(name)')
    .order('display_order');

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as AseguradoraCatalog[] };
}

export async function actionCreateAseguradora(aseguradora: Omit<TablesInsert<'aseguradoras_catalog'>, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { data, error } = await supabase
    .from('aseguradoras_catalog')
    .insert(aseguradora satisfies TablesInsert<'aseguradoras_catalog'>)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function actionUpdateAseguradora(id: string, updates: TablesUpdate<'aseguradoras_catalog'>) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { error } = await supabase
    .from('aseguradoras_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// =====================================================
// TRAMITES CATALOG
// =====================================================

export async function actionGetTramitesCatalog() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('tramites_catalog')
    .select('*')
    .order('display_order');

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as TramiteCatalog[] };
}

export async function actionCreateTramite(tramite: Omit<TablesInsert<'tramites_catalog'>, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { data, error } = await supabase
    .from('tramites_catalog')
    .insert(tramite satisfies TablesInsert<'tramites_catalog'>)
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data };
}

export async function actionUpdateTramite(id: string, updates: TablesUpdate<'tramites_catalog'>) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar catálogos' };
  }

  const { error } = await supabase
    .from('tramites_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// =====================================================
// VACATION CONFIG
// =====================================================

export async function actionGetVacationConfig() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from('vacation_config')
    .select('*')
    .order('master_name');

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data as VacationConfig[] };
}

export async function actionUpdateVacationConfig(
  email: string,
  updates: TablesUpdate<'vacation_config'>
) {
  const supabase = await getSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'master') {
    return { ok: false, error: 'Solo los masters pueden modificar configuración de vacaciones' };
  }

  const { error } = await supabase
    .from('vacation_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('master_email', email);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Obtiene el master asignado según sección (considerando vacaciones)
 */
export async function actionGetAssignedMaster(section: string): Promise<{
  ok: boolean;
  email?: string;
  name?: string;
  error?: string;
}> {
  const supabase = await getSupabaseServer();

  // Determinar email base según sección
  let baseEmail: string;
  if (section === 'RAMOS_GENERALES') {
    baseEmail = 'yiraramos@lideresenseguros.com';
  } else if (section === 'VIDA_ASSA' || section === 'OTROS_PERSONAS') {
    baseEmail = 'lucianieto@lideresenseguros.com';
  } else {
    // Sin clasificar - asignar a Yira por defecto
    baseEmail = 'yiraramos@lideresenseguros.com';
  }

  // Verificar si está de vacaciones
  const { data: vacationConfig, error } = await supabase
    .from('vacation_config')
    .select('*')
    .eq('master_email', baseEmail)
    .single();

  if (error || !vacationConfig) {
    return { ok: true, email: baseEmail, name: baseEmail.split('@')[0] };
  }

  // Si está de vacaciones y tiene backup, usar backup
  if (vacationConfig.is_on_vacation && vacationConfig.backup_email && vacationConfig.auto_reassign) {
    return {
      ok: true,
      email: vacationConfig.backup_email,
      name: `Backup de ${vacationConfig.master_name}`,
    };
  }

  return {
    ok: true,
    email: baseEmail,
    name: vacationConfig.master_name,
  };
}
