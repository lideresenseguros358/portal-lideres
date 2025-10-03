export type TargetField = 'policy' | 'insured' | 'commission' | 'status' | 'days' | 'amount';

export type Strategy =
  | 'aliases'
  | 'by_alias'
  | 'extract_numeric'
  | 'mixed_token'
  | 'first_nonzero'
  | 'penultimate'
  | 'custom'
  | 'first_non_zero';

export interface MappingRule {
  insurer_id: string;
  target_field: TargetField;
  aliases: string[];
  strategy: Strategy;
  notes?: string;
}

export interface NormalizedRow {
  policy?: string;
  insured?: string;
  commission?: number | null;
  status?: string | null;
  days?: number | null;
  amount?: number | null;
  raw?: Record<string, unknown>;
}

export interface NormalizedDelinquencyRow {
  policy?: string;
  insured?: string;
  days?: number | null;
  amount?: number | null;
  raw?: Record<string, unknown>;
}

export interface DelinquencyRule {
  insurer_id: string;
  target_field: DelinquencyTarget;
  aliases: string[];
  strategy?: Strategy;
  notes?: string | null;
}

export type DelinquencyTarget =
  | "balance"
  | "days"
  | "status"
  | "policy"
  | "insured";

export interface InsurerMapping {
  id: string;
  insurer_id: string;
  policy_strategy: Strategy;
  insured_strategy: Strategy;
  commission_strategy: Strategy;
  options: Record<string, unknown>;
  created_at: string;
}

export type RowObject = Record<string, unknown> | string[];
