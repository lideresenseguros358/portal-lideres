/**
 * INSURANCE LOOKUP — Query insurance_companies + Supabase policies/clients
 * =========================================================================
 * Provides lookup functions for:
 * - Insurance company contact info
 * - Client identity verification
 * - Policy details
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb() { return createClient(supabaseUrl, supabaseServiceKey); }

// ═══════════════════════════════════════
// Insurance company lookup
// ═══════════════════════════════════════

export interface InsuranceCompanyInfo {
  name: string;
  code: string;
  emergency_phone: string | null;
  customer_service_phone: string | null;
  whatsapp_number: string | null;
  website: string | null;
}

/**
 * Look up insurance company by name or code
 */
export async function lookupInsurer(nameOrCode: string): Promise<InsuranceCompanyInfo | null> {
  const sb = getSb();
  const normalized = nameOrCode.toUpperCase().trim();

  // Try by code first
  const { data: byCode } = await sb.from('insurance_companies')
    .select('name, code, emergency_phone, customer_service_phone, whatsapp_number, website')
    .eq('active', true)
    .ilike('code', normalized)
    .maybeSingle();

  if (byCode) return byCode;

  // Try by name (partial match)
  const { data: byName } = await sb.from('insurance_companies')
    .select('name, code, emergency_phone, customer_service_phone, whatsapp_number, website')
    .eq('active', true)
    .ilike('name', `%${nameOrCode}%`)
    .limit(1)
    .maybeSingle();

  return byName || null;
}

/**
 * Get all active insurance companies
 */
export async function getAllInsurers(): Promise<InsuranceCompanyInfo[]> {
  const sb = getSb();
  const { data } = await sb.from('insurance_companies')
    .select('name, code, emergency_phone, customer_service_phone, whatsapp_number, website')
    .eq('active', true)
    .order('name');
  return data || [];
}

/**
 * Format insurer contact info for chat response
 */
export function formatInsurerContact(info: InsuranceCompanyInfo): string {
  const lines = [`📋 ${info.name}`];
  if (info.emergency_phone) lines.push(`🚨 Emergencias: ${info.emergency_phone}`);
  if (info.customer_service_phone) lines.push(`📞 Atención al Cliente: ${info.customer_service_phone}`);
  if (info.whatsapp_number) lines.push(`💬 WhatsApp: ${info.whatsapp_number}`);
  if (info.website) lines.push(`🌐 Web: ${info.website}`);
  return lines.join('\n');
}

// ═══════════════════════════════════════
// Client verification
// ═══════════════════════════════════════

export interface ClientInfo {
  id: string;
  name: string;
  cedula: string;
  phone: string | null;
  email: string | null;
  region: string | null; // not in DB, kept for interface compat
}

/**
 * Look up client by cédula
 */
export async function lookupClientByCedula(cedula: string): Promise<ClientInfo | null> {
  const sb = getSb();
  const cleaned = cedula.replace(/[^0-9A-Za-z-]/g, '').trim();
  if (!cleaned) return null;

  // DB column is 'national_id', not 'cedula'
  // Try exact match first
  const { data: exact } = await sb.from('clients')
    .select('id, name, national_id, phone, email')
    .eq('active', true)
    .eq('national_id', cleaned)
    .limit(1)
    .maybeSingle();

  if (exact) return { id: exact.id, name: exact.name, cedula: exact.national_id || cleaned, phone: exact.phone, email: exact.email, region: null };

  // Try without dashes (e.g. "89321155" matches "8-932-1155")
  const noDashes = cleaned.replace(/-/g, '');
  const { data: fuzzy } = await sb.from('clients')
    .select('id, name, national_id, phone, email')
    .eq('active', true)
    .ilike('national_id', `%${noDashes.slice(-6)}%`)
    .limit(5);

  if (fuzzy?.length) {
    // Find the one whose national_id without dashes matches
    const match = fuzzy.find(c => (c.national_id || '').replace(/-/g, '') === noDashes);
    if (match) return { id: match.id, name: match.name, cedula: match.national_id || cleaned, phone: match.phone, email: match.email, region: null };
  }

  return null;
}

/**
 * Look up client by phone number
 */
export async function lookupClientByPhone(phone: string): Promise<ClientInfo | null> {
  const sb = getSb();
  // Normalize: remove whatsapp: prefix and non-digits
  const cleaned = phone.replace(/^whatsapp:/i, '').replace(/[^0-9+]/g, '').trim();
  if (!cleaned) return null;

  // Try exact match first
  const { data: exact } = await sb.from('clients')
    .select('id, name, national_id, phone, email')
    .eq('active', true)
    .eq('phone', cleaned)
    .limit(1)
    .maybeSingle();

  if (exact) return { id: exact.id, name: exact.name, cedula: exact.national_id || '', phone: exact.phone, email: exact.email, region: null };

  // Try matching last 8 digits
  const last8 = cleaned.slice(-8);
  if (last8.length >= 7) {
    const { data: partial } = await sb.from('clients')
      .select('id, name, national_id, phone, email')
      .eq('active', true)
      .ilike('phone', `%${last8}`)
      .limit(1)
      .maybeSingle();
    if (partial) return { id: partial.id, name: partial.name, cedula: partial.national_id || '', phone: partial.phone, email: partial.email, region: null };
  }

  return null;
}

// ═══════════════════════════════════════
// Policy lookup
// ═══════════════════════════════════════

export interface PolicyInfo {
  id: string;
  policy_number: string;
  ramo: string | null;
  insurer_name: string | null;
  status: string | null;
  start_date: string | null;
  renewal_date: string | null;
}

/**
 * Get policies for a client
 */
export async function lookupPoliciesByClientId(clientId: string): Promise<PolicyInfo[]> {
  const sb = getSb();
  // policies.insurer_id FK -> insurers.id
  const { data, error } = await sb.from('policies')
    .select('id, policy_number, ramo, status, start_date, renewal_date, insurers(name)')
    .eq('client_id', clientId)
    .order('renewal_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[LOOKUP] Error fetching policies:', error.message);
    return [];
  }
  if (!data) return [];

  return data.map((p: any) => ({
    id: p.id,
    policy_number: p.policy_number,
    ramo: p.ramo,
    insurer_name: p.insurers?.name || null,
    status: p.status,
    start_date: p.start_date,
    renewal_date: p.renewal_date,
  }));
}

/**
 * Look up a specific policy by number
 */
export async function lookupPolicyByNumber(policyNumber: string): Promise<PolicyInfo | null> {
  const sb = getSb();
  const { data } = await sb.from('policies')
    .select('id, policy_number, ramo, status, start_date, renewal_date, insurers(name)')
    .eq('policy_number', policyNumber.trim())
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    policy_number: data.policy_number,
    ramo: data.ramo,
    insurer_name: (data as any).insurers?.name || null,
    status: data.status,
    start_date: data.start_date,
    renewal_date: data.renewal_date,
  };
}
