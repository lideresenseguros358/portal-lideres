// src/lib/db/policies.ts

import { z } from 'zod';
import { getSupabaseServer, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase/server';
import { getAuthContext } from './context';
import { getInsurerSlug, normalizePolicyNumber } from '@/lib/utils/policy-number';

type PolicyRow = Tables<'policies'>;
type PolicyIns = TablesInsert<'policies'>;
type PolicyUpd = TablesUpdate<'policies'>;

export const PolicyInsertSchema = z.object({
  client_id: z.string().uuid(),
  insurer_id: z.string().uuid(),
  policy_number: z.string().min(3).transform((s) => s.trim()),
  ramo: z.string().min(1),
  start_date: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  status: z.enum(['ACTIVA', 'CANCELADA', 'VENCIDA']).optional(),
  percent_override: z.number().optional().nullable(),
  broker_id: z.string().uuid().optional(),
});
export const PolicyUpdateSchema = PolicyInsertSchema.partial();

function toInsert(payload: z.infer<typeof PolicyInsertSchema>, brokerId: string): PolicyIns {
  return {
    broker_id: brokerId,
    client_id: payload.client_id,
    insurer_id: payload.insurer_id,
    policy_number: payload.policy_number,
    ramo: payload.ramo,
    start_date: payload.start_date || undefined,
    renewal_date: payload.renewal_date || undefined,
    status: payload.status,
    percent_override: payload.percent_override || undefined,
  };
}

function toUpdate(payload: z.infer<typeof PolicyUpdateSchema>): PolicyUpd {
  const update: PolicyUpd = {};
  if (payload.broker_id !== undefined) update.broker_id = payload.broker_id;
  if (payload.client_id !== undefined) update.client_id = payload.client_id;
  if (payload.insurer_id !== undefined) update.insurer_id = payload.insurer_id;
  if (payload.policy_number !== undefined) update.policy_number = payload.policy_number;
  if (payload.ramo !== undefined) update.ramo = payload.ramo;
  if (payload.start_date !== undefined) update.start_date = payload.start_date || undefined;
  if (payload.renewal_date !== undefined) update.renewal_date = payload.renewal_date || undefined;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.percent_override !== undefined) update.percent_override = payload.percent_override || undefined;
  return update;
}

export async function listPolicies(params: { clientId?: string } = {}) {
  const supabase = await getSupabaseServer();
  let query = supabase.from('policies').select('*');
  if (params.clientId) query = query.eq('client_id', params.clientId);
  const { data, error } = await query.returns<PolicyRow[]>();
  if (error) throw new Error(`Error listando pólizas: ${error.message}`);
  return data ?? [];
}

export async function createPolicy(rawData: unknown) {
  const supabase = await getSupabaseServer();
  const ctx = await getAuthContext();
  const parsed = PolicyInsertSchema.parse(rawData);

  const brokerId = ctx.role === 'master' ? parsed.broker_id ?? ctx.brokerId : ctx.brokerId;
  if (!brokerId) throw new Error('No se encontró broker asociado para la póliza');

  // Normalizar policy_number según aseguradora (server-side)
  let normalizedParsed = parsed;
  if (parsed.insurer_id && parsed.policy_number) {
    const { data: insurer } = await supabase
      .from('insurers')
      .select('name')
      .eq('id', parsed.insurer_id)
      .single();

    const insurerSlug = getInsurerSlug(String((insurer as any)?.name || ''));
    if (insurerSlug === 'univivir') {
      const digits = String(parsed.policy_number).match(/\d+/g) || [];
      const ramo = digits.length >= 3 ? (digits[1] || '') : (digits[0] || '');
      const poliza = digits.length >= 3 ? (digits[2] || '') : (digits[1] || '');
      const normalized = normalizePolicyNumber('univivir', ['01', ramo, poliza]);
      normalizedParsed = { ...parsed, policy_number: normalized };
    }
  }

  const payload = toInsert(normalizedParsed, brokerId);

  const { data, error } = await supabase
    .from('policies')
    .insert([payload] satisfies PolicyIns[])
    .select()
    .single<PolicyRow>();
  if (error) throw new Error(`Error creando póliza: ${error.message}`);
  return data;
}

export async function updatePolicy(policyId: string, rawData: unknown) {
  const supabase = await getSupabaseServer();
  const ctx = await getAuthContext();
  const parsed = PolicyUpdateSchema.parse(rawData);

  if (ctx.role !== 'master') {
    delete (parsed as Record<string, unknown>).broker_id;
  }

  // Normalizar policy_number según aseguradora (server-side)
  const parsedAny = parsed as any;
  if (parsedAny.policy_number && (parsedAny.insurer_id || true)) {
    const { data: current } = await supabase
      .from('policies')
      .select('insurer_id')
      .eq('id', policyId)
      .single();

    const insurerId = String(parsedAny.insurer_id || (current as any)?.insurer_id || '');
    if (insurerId) {
      const { data: insurer } = await supabase
        .from('insurers')
        .select('name')
        .eq('id', insurerId)
        .single();

      const insurerSlug = getInsurerSlug(String((insurer as any)?.name || ''));
      if (insurerSlug === 'univivir') {
        const digits = String(parsedAny.policy_number).match(/\d+/g) || [];
        const ramo = digits.length >= 3 ? (digits[1] || '') : (digits[0] || '');
        const poliza = digits.length >= 3 ? (digits[2] || '') : (digits[1] || '');
        parsedAny.policy_number = normalizePolicyNumber('univivir', ['01', ramo, poliza]);
      }
    }
  }

  const payload = toUpdate(parsedAny);

  const { data, error } = await supabase
    .from('policies')
    .update(payload satisfies PolicyUpd)
    .eq('id', policyId)
    .select()
    .single<PolicyRow>();
  if (error) throw new Error(`Error actualizando póliza: ${error.message}`);
  return data;
}

export async function deletePolicy(policyId: string) {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('policies')
    .delete()
    .eq('id', policyId)
    .select()
    .single<PolicyRow>();
  if (error) throw new Error(`Error borrando póliza: ${error.message}`);
  return data;
}
