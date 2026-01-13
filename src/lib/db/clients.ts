import { z } from 'zod';
import { getSupabaseServer, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase/server';
import { getInsurerSlug, normalizePolicyNumber } from '@/lib/utils/policy-number';

type ClientRow = Tables<"clients">;
type ClientIns = TablesInsert<"clients">;
type ClientUpd = TablesUpdate<"clients">;

// ===== Zod =====
export const ClientInsertSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  national_id: z.string().trim().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  birth_date: z.string().min(1, 'Fecha de nacimiento requerida'),
  active: z.boolean().default(true),
  broker_id: z.string().uuid().optional(),
})
export const ClientUpdateSchema = ClientInsertSchema.partial()

export const PolicyInsertSchema = z.object({
  policy_number: z.string().min(1, 'Número de póliza requerido'),
  insurer_id: z.string().uuid('Aseguradora requerida'),
  ramo: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  renewal_date: z.string().min(1, 'Fecha de renovación requerida').nullable(),
  status: z.enum(['ACTIVA', 'VENCIDA', 'CANCELADA']).default('ACTIVA'),
});

// ===== Helpers internos =====
function toInsertPayload(brokerId: string, parsed: z.infer<typeof ClientInsertSchema>): ClientIns {
  // Nota: birth_date causa error de TypeScript hasta que se ejecute el SQL y se regeneren tipos
  return {
    broker_id: brokerId,
    name: parsed.name,
    national_id: parsed.national_id || undefined,
    email: parsed.email || undefined,
    phone: parsed.phone || undefined,
    birth_date: parsed.birth_date,
    active: parsed.active ?? true,
  } as ClientIns;
}

function toUpdatePayload(parsed: z.infer<typeof ClientUpdateSchema>): ClientUpd {
  const payload: any = {}; // Usar any temporalmente hasta regenerar tipos
  if (parsed.name !== undefined) payload.name = parsed.name;
  if (parsed.national_id !== undefined) payload.national_id = parsed.national_id || undefined;
  if (parsed.email !== undefined) payload.email = parsed.email || undefined;
  if (parsed.phone !== undefined) payload.phone = parsed.phone || undefined;
  if (parsed.birth_date !== undefined) payload.birth_date = parsed.birth_date;
  if (parsed.active !== undefined) payload.active = parsed.active;
  if (parsed.broker_id !== undefined) payload.broker_id = parsed.broker_id;
  return payload as ClientUpd;
}

// ===== CRUD =====
export async function listClients(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await getSupabaseServer()
  const { q = '', page = 1, pageSize = 20 } = opts
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from('clients').select('*', { count: 'exact' })
  if (q) {
    query = query.or(`name.ilike.%${q}%,national_id.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%` )
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw new Error(`Error listando clientes: ${error.message}` )
  return { data: data ?? [], count: count ?? 0, page, pageSize }
}

export async function getClient(clientId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const brokerId = user?.id
  
  let query = supabase
    .from('clients')
    .select(`
      *,
      policies (*)
    `)
    .eq('id', clientId)
    
  if (brokerId) {
    query = query.eq('broker_id', brokerId)
  }
  
  const { data: client, error } = await query.single<ClientRow>()
  if (error) throw new Error(`Error obteniendo cliente: ${error.message}`)
  if (!client) return null

  const { data: policies, error: pErr } = await supabase
    .from('policies')
    .select('*')
    .eq('client_id', clientId)
    
  if (pErr) throw new Error(`Error pólizas: ${pErr.message}` )

  return { ...client, policies: policies ?? [] }
}

export async function createClient(rawData: unknown) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const parsed = ClientInsertSchema.parse(rawData)

  const brokerId = parsed.broker_id ?? user?.id
  if (!brokerId) throw new Error('No se encontró broker asociado para el cliente')

  const payload = toInsertPayload(brokerId, parsed)

  const { data, error } = await supabase
    .from('clients')
    .insert([payload] satisfies ClientIns[])
    .select()
  if (error) throw new Error(`Error creando cliente: ${error.message}` )

  return data
}

export async function searchClients(term?: string, broker_id?: string | null, limit?: number) {
  const supabase = await getSupabaseServer();
  let query = supabase.from('clients').select('*', { count: 'exact' })
  if (term) {
    query = query.or(`name.ilike.%${term}%,national_id.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%` )
  }
  if (broker_id) {
    query = query.eq('broker_id', broker_id)
  }
  if (limit) {
    query = query.limit(limit)
  }
  const { data, error, count } = await query
  if (error) throw new Error(`Error buscando clientes: ${error.message}` )
  return { data: data ?? [], count: count ?? 0 }
}

export async function updateClient(clientId: string, input: z.infer<typeof ClientUpdateSchema>) {
  const parsed = ClientUpdateSchema.parse(input)
  const supabase = await getSupabaseServer()
  
  const { data: current } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single<ClientRow>()

  if (!current) throw new Error('Cliente no encontrado')

  const payload = toUpdatePayload(parsed)

  const { data, error } = await supabase
    .from('clients')
    .update(payload satisfies ClientUpd)
    .eq('id', clientId)
    .select()
    .single<ClientRow>()
  if (error) throw new Error(`Error actualizando cliente: ${error.message}` )

  return data
}

export async function createClientWithPolicy(clientData: unknown, policyData: unknown) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const clientParsed = ClientInsertSchema.parse(clientData);
  const policyParsed = PolicyInsertSchema.parse(policyData);

  const brokerId = clientParsed.broker_id ?? user?.id;
  if (!brokerId) throw new Error('No se encontró broker asociado para el cliente');

  const clientPayload = toInsertPayload(brokerId, clientParsed);

  console.log('[FECHA DEBUG - API] Payload de cliente antes de insertar:', {
    birth_date: clientPayload.birth_date,
    birth_date_type: typeof clientPayload.birth_date
  });

  // Create client
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert(clientPayload)
    .select()
    .single<ClientRow>();

  if (clientError) throw new Error(`Error creando cliente: ${clientError.message}`);
  if (!newClient) throw new Error('Fallo al crear el cliente');

  // Create policy
  let policyNumber = policyParsed.policy_number;
  if (policyParsed.insurer_id && policyParsed.policy_number) {
    const { data: insurer } = await supabase
      .from('insurers')
      .select('name')
      .eq('id', policyParsed.insurer_id)
      .single();

    const insurerSlug = getInsurerSlug(String((insurer as any)?.name || ''));
    if (insurerSlug === 'univivir') {
      const digits = String(policyParsed.policy_number).match(/\d+/g) || [];
      const ramo = digits.length >= 3 ? (digits[1] || '') : (digits[0] || '');
      const poliza = digits.length >= 3 ? (digits[2] || '') : (digits[1] || '');
      policyNumber = normalizePolicyNumber('univivir', ['01', ramo, poliza]);
    }
  }

  const policyPayload = {
    ...policyParsed,
    policy_number: policyNumber,
    client_id: newClient.id,
    broker_id: brokerId,
  };

  console.log('[FECHA DEBUG - API] Payload de póliza antes de insertar:', {
    start_date: policyPayload.start_date,
    renewal_date: policyPayload.renewal_date,
    start_date_type: typeof policyPayload.start_date,
    renewal_date_type: typeof policyPayload.renewal_date
  });

  const { error: policyError } = await supabase.from('policies').insert(policyPayload);

  if (policyError) {
    // Rollback client creation if policy creation fails
    await supabase.from('clients').delete().eq('id', newClient.id);
    throw new Error(`Error creando póliza: ${policyError.message}`);
  }

  return newClient;
}

export async function deleteClient(clientId: string) {
  const supabase = await getSupabaseServer()

  // Borrar pólizas vinculadas (histórico de comisiones se mantiene por diseño)
  const { error: polErr } = await supabase.from('policies').delete().eq('client_id', clientId)
  if (polErr) throw new Error(`Error borrando pólizas: ${polErr.message}` )

  const { data, error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .select()
    .single<ClientRow>()
  if (error) throw new Error(`Error borrando cliente: ${error.message}` )
  return data
}
