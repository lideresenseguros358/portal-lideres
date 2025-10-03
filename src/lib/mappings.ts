import { getSupabaseServer } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "./database.types";
import type {
  DelinquencyRule,
  DelinquencyTarget,
  InsurerMapping,
  MappingRule,
  Strategy,
  TargetField,
} from "./types/importing";

export * from "./types/importing";

type InsurerRow = Tables<"insurers">;
type MappingRow = Tables<"insurer_mappings"> & { id?: string | null };
type MappingRuleRow = Tables<"insurer_mapping_rules">;
type DelinquencyRuleRow = Tables<"insurer_delinquency_rules">;

type MappingInsert = TablesInsert<"insurer_mappings">;
type MappingRuleInsert = TablesInsert<"insurer_mapping_rules">;
type DelinqRuleInsert = TablesInsert<"insurer_delinquency_rules">;
type MappingOptions = MappingInsert["options"];

export type InsurerInfo = Pick<InsurerRow, "id" | "name">;

export type MappingSnapshot = {
  insurer: InsurerInfo;
  mapping: InsurerMapping;
  rules: MappingRule[];
  delinquency: DelinquencyRule[];
};

const adminClient = async () => getSupabaseServer();

const STRATEGY_ALIASES: Record<string, Strategy> = {
  custom: "custom",
  extract_numeric: "extract_numeric",
  "extract-numeric": "extract_numeric",
  penultimate: "penultimate",
  first_non_zero: "first_non_zero",
  firstnonzero: "first_non_zero",
  "first-non-zero": "first_non_zero",
};

const DEFAULT_STRATEGY: Strategy = "by_alias";

const DEFAULT_RULE_STRATEGY: Record<TargetField, Strategy> = {
  policy: "by_alias",
  insured: "by_alias",
  commission: "extract_numeric",
  status: "by_alias",
  days: "extract_numeric",
  amount: "extract_numeric",
};

const DEFAULT_DELINQUENCY_STRATEGY: Record<DelinquencyTarget, Strategy> = {
  balance: "by_alias",
  days: "extract_numeric",
  status: "by_alias",
  policy: "by_alias",
  insured: "by_alias",
};

const MAPPING_TARGETS: TargetField[] = [
  "policy",
  "insured",
  "commission",
  "status",
  "days",
  "amount",
];

const DELINQUENCY_TARGETS: DelinquencyTarget[] = [
  "balance",
  "days",
  "status",
  "policy",
  "insured",
];

const normalizeStrategy = (value?: string | null, fallback: Strategy = DEFAULT_STRATEGY): Strategy => {
  if (!value) return fallback;
  const key = value.toLowerCase().replace(/\s|-/g, "_");
  return STRATEGY_ALIASES[key] ?? fallback;
};

const normalizeTargetField = (field: unknown): TargetField => {
  const key = String(field ?? "").toLowerCase() as TargetField;
  return MAPPING_TARGETS.includes(key) ? key : "policy";
};

const normalizeDelinquencyTarget = (field: unknown): DelinquencyTarget => {
  const key = String(field ?? "").toLowerCase() as DelinquencyTarget;
  return DELINQUENCY_TARGETS.includes(key) ? key : "balance";
};

const normalizeAliases = (aliases: unknown): string[] => {
  const list = Array.isArray(aliases)
    ? aliases
    : typeof aliases === "string"
    ? aliases.split(",")
    : [];

  const dedup = new Map<string, string>();
  list.forEach((value) => {
    if (value === null || value === undefined) return;
    const trimmed = String(value).trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!dedup.has(key)) {
      dedup.set(key, trimmed);
    }
  });
  return Array.from(dedup.values());
};

const normalizeNotes = (notes?: string | null): string | undefined => {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : undefined;
};

const toMappingRule = (row: MappingRuleRow): MappingRule => ({
  insurer_id: row.insurer_id,
  target_field: normalizeTargetField(row.target_field),
  aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
  strategy: normalizeStrategy(row.strategy),
  notes: normalizeNotes(row.notes ?? undefined),
});

const toDelinquencyRule = (row: DelinquencyRuleRow): DelinquencyRule => ({
  insurer_id: row.insurer_id,
  target_field: normalizeDelinquencyTarget(row.target_field),
  aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
  notes: undefined,
});

const toMappingInsert = (insurerId: string, mapping: InsurerMapping, overrides?: Partial<MappingInsert>): MappingInsert => ({
  insurer_id: insurerId,
  policy_strategy: normalizeStrategy(overrides?.policy_strategy ?? mapping.policy_strategy),
  insured_strategy: normalizeStrategy(overrides?.insured_strategy ?? mapping.insured_strategy),
  commission_strategy: normalizeStrategy(overrides?.commission_strategy ?? mapping.commission_strategy),
  options: (overrides?.options ?? mapping.options ?? {}) as MappingOptions,
  active: overrides?.active ?? true,
});

const toMappingRuleInsert = (insurerId: string, rule: MappingRule): MappingRuleInsert => ({
  insurer_id: insurerId,
  target_field: normalizeTargetField(rule.target_field),
  aliases: normalizeAliases(rule.aliases),
  strategy: normalizeStrategy(rule.strategy),
  notes: normalizeNotes(rule.notes) || undefined,
});

const toDelinquencyRuleInsert = (insurerId: string, rule: DelinquencyRule): DelinqRuleInsert => ({
  insurer_id: insurerId,
  target_field: normalizeDelinquencyTarget(rule.target_field),
  aliases: normalizeAliases(rule.aliases),
});

const fetchInsurer = async (insurerId: string): Promise<InsurerInfo> => {
  const { data, error } = await (await adminClient())
    .from("insurers")
    .select("id, name")
    .eq("id", insurerId)
    .maybeSingle<InsurerRow>();

  if (error) throw error;
  if (!data) {
    throw new Error(`Insurer with id ${insurerId} not found`);
  }

  return { id: data.id, name: data.name };
};

const fetchInsurerByName = async (name: string): Promise<InsurerInfo> => {
  const trimmed = name.trim();
  const attempts = [trimmed, trimmed.toUpperCase()];

  for (const value of attempts) {
    const { data } = await (await adminClient())
      .from("insurers")
      .select("id, name")
      .eq("name", value)
      .maybeSingle<InsurerRow>();
    if (data) return { id: data.id, name: data.name };
  }

  const { data } = await (await adminClient())
    .from("insurers")
    .select("id, name")
    .ilike("name", trimmed)
    .maybeSingle<InsurerRow>();

  if (!data) {
    throw new Error(`Insurer with name ${name} not found`);
  }

  return { id: data.id, name: data.name };
};

const fetchMappingRow = async (insurerId: string): Promise<InsurerMapping> => {
  const { data, error } = await (await adminClient())
    .from("insurer_mappings")
    .select("insurer_id, policy_strategy, insured_strategy, commission_strategy, options, created_at")
    .eq("insurer_id", insurerId)
    .maybeSingle<MappingRow>();

  if (error) throw error;

  if (data) {
    return {
      id: data.id ?? data.insurer_id,
      insurer_id: data.insurer_id,
      policy_strategy: normalizeStrategy(data.policy_strategy),
      insured_strategy: normalizeStrategy(data.insured_strategy),
      commission_strategy: normalizeStrategy(data.commission_strategy),
      options: (data.options as Record<string, unknown>) ?? {},
      created_at: data.created_at ?? new Date().toISOString(),
    };
  }

  return {
    id: insurerId,
    insurer_id: insurerId,
    policy_strategy: DEFAULT_STRATEGY,
    insured_strategy: DEFAULT_STRATEGY,
    commission_strategy: DEFAULT_STRATEGY,
    options: {},
    created_at: new Date().toISOString(),
  };
};

const fetchMappingRules = async (insurerId: string): Promise<MappingRule[]> => {
  const { data, error } = await (await adminClient())
    .from("insurer_mapping_rules")
    .select("insurer_id, target_field, aliases, strategy, notes")
    .eq("insurer_id", insurerId);

  if (error) throw error;
  return (data ?? []).map((row: any) => toMappingRule(row as MappingRuleRow));
};

const fetchDelinquencyRules = async (insurerId: string): Promise<DelinquencyRule[]> => {
  const { data, error } = await (await adminClient())
    .from("insurer_delinquency_rules")
    .select("insurer_id, target_field, aliases")
    .eq("insurer_id", insurerId);

  if (error) throw error;
  return (data ?? []).map((row: any) => toDelinquencyRule(row as DelinquencyRuleRow));
};

const mergeOptions = (
  previous: MappingOptions,
  incoming?: Record<string, unknown>
): MappingOptions => {
  const base =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : {};
  const addition = incoming ?? {};
  try {
    return JSON.parse(JSON.stringify({ ...base, ...addition })) as MappingOptions;
  } catch {
    return base as MappingOptions;
  }
};

const resolveRule = (
  insurerId: string,
  target: TargetField,
  rows: MappingRule[]
): MappingRule => {
  const match = rows.find((row) => row.target_field === target);
  if (match) {
    return {
      insurer_id: insurerId,
      target_field: target,
      aliases: match.aliases,
      strategy: normalizeStrategy(match.strategy, DEFAULT_RULE_STRATEGY[target]),
      notes: normalizeNotes(match.notes),
    };
  }

  return {
    insurer_id: insurerId,
    target_field: target,
    aliases: [],
    strategy: DEFAULT_RULE_STRATEGY[target],
    notes: undefined,
  };
};

const resolveDelinquencyRule = (
  insurerId: string,
  target: DelinquencyTarget,
  rows: DelinquencyRule[]
): DelinquencyRule => {
  const match = rows.find((row) => row.target_field === target);
  if (match) {
    return {
      insurer_id: insurerId,
      target_field: target,
      aliases: match.aliases,
      strategy: DEFAULT_DELINQUENCY_STRATEGY[target],
      notes: undefined,
    };
  }

  return {
    insurer_id: insurerId,
    target_field: target,
    aliases: [],
    strategy: DEFAULT_DELINQUENCY_STRATEGY[target],
    notes: undefined,
  };
};

export const getMappingSnapshot = async (insurerId: string): Promise<MappingSnapshot> => {
  const [insurer, mappingRow, mappingRules, delinquencyRules] = await Promise.all([
    fetchInsurer(insurerId),
    fetchMappingRow(insurerId),
    fetchMappingRules(insurerId),
    fetchDelinquencyRules(insurerId),
  ]);

  const rules = MAPPING_TARGETS.map((target) => resolveRule(insurerId, target, mappingRules));
  const delinquency = DELINQUENCY_TARGETS.map((target) =>
    resolveDelinquencyRule(insurerId, target, delinquencyRules)
  );

  return {
    insurer,
    mapping: mappingRow,
    rules,
    delinquency,
  };
};

export const getMappingSnapshotByName = async (name: string) => {
  const insurer = await fetchInsurerByName(name);
  return getMappingSnapshot(insurer.id);
};

export const getInsurerConfigByName = async (name: string) => {
  const snapshot = await getMappingSnapshotByName(name);
  return {
    mapping: snapshot.mapping,
    rules: snapshot.rules,
  };
};

export const getInsurerDelinquencyConfigByName = async (name: string) => {
  const snapshot = await getMappingSnapshotByName(name);
  return {
    rules: snapshot.delinquency,
  };
};

export const listActiveInsurers = async (): Promise<InsurerInfo[]> => {
  const { data, error } = await (await adminClient())
    .from("insurers")
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.name }));
};

export const saveMappingBundle = async (
  insurerId: string,
  payload: {
    mapping?: Partial<Pick<InsurerMapping, "policy_strategy" | "insured_strategy" | "commission_strategy" | "options">>;
    rules: MappingRule[];
    delinquency: DelinquencyRule[];
  }
): Promise<MappingSnapshot> => {
  const snapshot = await getMappingSnapshot(insurerId);

  const headerInsert = toMappingInsert(insurerId, snapshot.mapping, {
    policy_strategy: payload.mapping?.policy_strategy,
    insured_strategy: payload.mapping?.insured_strategy,
    commission_strategy: payload.mapping?.commission_strategy,
    options: mergeOptions(
      snapshot.mapping.options as MappingOptions,
      payload.mapping?.options ?? undefined
    ),
  });

  const db = await (await adminClient());

  const { error: upsertError } = await db
    .from("insurer_mappings")
    .upsert(headerInsert, { onConflict: "insurer_id" });
  if (upsertError) {
    throw new Error(`Failed to upsert insurer_mappings: ${upsertError.message}`);
  }

  const { error: deleteRulesError } = await db
    .from("insurer_mapping_rules")
    .delete()
    .eq("insurer_id", insurerId);
  if (deleteRulesError) {
    throw new Error(`Failed to clear insurer_mapping_rules: ${deleteRulesError.message}`);
  }

  const ruleRows = payload.rules.map((rule) => toMappingRuleInsert(insurerId, rule));
  if (ruleRows.length > 0) {
    const { error: insertRulesError } = await db
      .from("insurer_mapping_rules")
      .insert(ruleRows);
    if (insertRulesError) {
      throw new Error(`Failed to insert insurer_mapping_rules: ${insertRulesError.message}`);
    }
  }

  const { error: deleteDelinqError } = await db
    .from("insurer_delinquency_rules")
    .delete()
    .eq("insurer_id", insurerId);
  if (deleteDelinqError) {
    throw new Error(`Failed to clear insurer_delinquency_rules: ${deleteDelinqError.message}`);
  }

  const delinquencyRows = payload.delinquency.map((rule) =>
    toDelinquencyRuleInsert(insurerId, rule)
  );
  if (delinquencyRows.length > 0) {
    const { error: insertDelinqError } = await db
      .from("insurer_delinquency_rules")
      .insert(delinquencyRows);
    if (insertDelinqError) {
      throw new Error(`Failed to insert insurer_delinquency_rules: ${insertDelinqError.message}`);
    }
  }

  return getMappingSnapshot(insurerId);
};
