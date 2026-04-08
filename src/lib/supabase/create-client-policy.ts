/**
 * Shared utility: find-or-create client + policy in Supabase after a successful emission.
 * Used by REGIONAL and ANCON emission routes (FEDPA and IS have their own implementations).
 *
 * Broker is always portal@lideresenseguros.com.
 * Client is matched by national_id + broker_id (upsert-style: existing client is reused).
 * A new policy record is always created.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface CreateClientPolicyInput {
  /** ilike pattern to find insurer, e.g. '%REGIONAL%' or '%ANCON%' */
  insurerPattern: string;
  /** Cédula, pasaporte, or RUC — used as dedup key */
  national_id: string;
  /** Full name */
  name: string;
  email?: string;
  phone?: string;
  /** ISO yyyy-mm-dd */
  birth_date?: string;
  policy_number: string;
  ramo?: string;
  notas?: string;
  /** ISO yyyy-mm-dd */
  start_date?: string;
  /** ISO yyyy-mm-dd */
  renewal_date?: string;
  /** Optional broker ID override (master users only) */
  overrideBrokerId?: string;
}

export interface CreateClientPolicyResult {
  clientId?: string;
  policyId?: string;
  error?: string;
}

/** Convert dd/mm/yyyy → yyyy-mm-dd. Returns undefined if format is unrecognised. */
export function parseDdMmYyyy(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Try ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return undefined;
}

export async function crearClienteYPoliza(
  input: CreateClientPolicyInput
): Promise<CreateClientPolicyResult> {
  const logPrefix = `[crearClienteYPoliza ${input.insurerPattern}]`;
  try {
    const supabase = getSupabaseAdmin();

    // 1. Find broker (override if provided, else default to portal@)
    let broker_id = input.overrideBrokerId;

    if (!broker_id) {
      const { data: broker } = await supabase
        .from('brokers')
        .select('id')
        .eq('email', 'portal@lideresenseguros.com')
        .single();

      if (!broker) {
        throw new Error('Broker portal@lideresenseguros.com no encontrado');
      }
      broker_id = broker.id;
    }

    // 2. Find insurer
    const { data: insurer } = await supabase
      .from('insurers')
      .select('id')
      .ilike('name', input.insurerPattern)
      .single();

    if (!insurer) {
      throw new Error(`Aseguradora con patrón ${input.insurerPattern} no encontrada`);
    }
    const insurer_id = insurer.id;

    // 3. Find or create client by national_id
    let clientId: string | undefined;

    if (input.national_id) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('national_id', input.national_id)
        .eq('broker_id', broker_id)
        .single();

      clientId = existing?.id;
    }

    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          broker_id,
          name: input.name,
          national_id: input.national_id || undefined,
          email: input.email || undefined,
          phone: input.phone || undefined,
          active: true,
          ...(input.birth_date ? { birth_date: input.birth_date } : {}),
        })
        .select('id')
        .single();

      if (clientError) throw clientError;
      clientId = newClient?.id;
      console.log(`${logPrefix} Cliente creado:`, { clientId, name: input.name });
    } else {
      console.log(`${logPrefix} Cliente existente:`, { clientId });
    }

    // 4. Create policy
    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert({
        broker_id,
        client_id: clientId,
        insurer_id,
        policy_number: input.policy_number,
        ramo: input.ramo || 'AUTO',
        status: 'ACTIVA',
        ...(input.start_date ? { start_date: input.start_date } : {}),
        ...(input.renewal_date ? { renewal_date: input.renewal_date } : {}),
        ...(input.notas ? { notas: input.notas } : {}),
      })
      .select('id')
      .single();

    if (policyError) throw policyError;

    console.log(`${logPrefix} Póliza creada:`, {
      policyId: newPolicy?.id,
      policy_number: input.policy_number,
    });

    return { clientId, policyId: newPolicy?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${logPrefix} Error:`, msg);
    return { error: msg };
  }
}
