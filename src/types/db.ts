import type { Tables } from '@/lib/supabase/server';

export interface ClientWithPolicies extends Tables<'clients'> {
  policies: Array<{
    id: string;
    policy_number: string;
    insurer_id: string;
    ramo: string | null;
    start_date: string | null;
    renewal_date: string | null;
    status: string;
    notas: string | null;
    percent_override: number | null;
    insurers: {
      id: string;
      name: string;
      active: boolean | null;
    } | null;
  }>;
  brokers: {
    id: string;
    name: string | null;
  } | null;
}

export interface InsurerWithCount extends Tables<'insurers'> {
  policyCount: number;
}
