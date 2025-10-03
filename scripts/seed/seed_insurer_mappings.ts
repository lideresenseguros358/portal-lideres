import { config } from "dotenv";

config({ path: ".env.local" });

import { getSupabaseAdmin } from "@/supabase/admin";
import type { Strategy } from "../../src/lib/types/importing";
import type { Tables, TablesInsert } from "../../src/lib/database.types";

const VALID_FIELDS = [
  "policy",
  "insured",
  "commission",
  "amount",
  "status",
  "days",
] as const;

type ValidField = (typeof VALID_FIELDS)[number];

const REQUIRED_TARGETS: ValidField[] = [
  "policy",
  "insured",
  "commission",
  "amount",
  "status",
  "days",
];

const BASE_ALIASES: Record<ValidField, string[]> = {
  policy: ["poliza", "póliza", "policy", "no. póliza", "nro póliza"],
  insured: ["asegurado", "nombre asegurado", "cliente", "titular"],
  commission: ["comision", "comisión", "total comisión", "honorarios"],
  days: ["días", "dias", "days", "dias mora", "dias atraso"],
  amount: ["monto", "amount", "importe", "saldo"],
  status: ["status", "estado", "estatus"],
};

const STRATEGY_VALUES: readonly Strategy[] = [
  "by_alias",
  "first_non_zero",
  "penultimate",
  "extract_numeric",
  "custom",
];

const DEFAULT_STRATEGY: Record<ValidField, Strategy> = {
  policy: "by_alias",
  insured: "by_alias",
  commission: "extract_numeric",
  days: "extract_numeric",
  amount: "extract_numeric",
  status: "by_alias",
};

const normField = (value: unknown): ValidField | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (VALID_FIELDS as readonly string[]).includes(normalized)
    ? (normalized as ValidField)
    : null;
};

const normAliases = (input: unknown): string[] => {
  if (!input) return [];
  const values = Array.isArray(input) ? input : [input];
  return values
    .map((alias) => String(alias ?? "").trim())
    .filter(Boolean);
};

const normStrategy = (value: unknown, fallback?: Strategy | null): Strategy | null => {
  if (typeof value === "string" && (STRATEGY_VALUES as readonly string[]).includes(value)) {
    return value as Strategy;
  }
  if (fallback && (STRATEGY_VALUES as readonly string[]).includes(fallback)) {
    return fallback;
  }
  return null;
};

type MappingInsert = TablesInsert<"insurer_mappings">;
type MappingRuleInsert = TablesInsert<"insurer_mapping_rules">;
type MappingOptions = MappingInsert["options"];

const ensureOptions = (value: unknown): MappingOptions =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as MappingOptions)
    : ({} as MappingOptions);

const DEFAULT_OPTIONS: MappingOptions = {
  commission_groups: [
    [
      "Honorarios Profesionales (Monto)",
      "Honorarios Profesionales",
      "Monto",
    ],
    ["Vida 1er. Año", "Vida Primer Año"],
  ],
} as MappingOptions;

type InsurerRow = Tables<"insurers">;

const createAdminClient = () => getSupabaseAdmin();

async function upsertMapping(insurer: Pick<InsurerRow, "id" | "name">) {
  const db = createAdminClient();
  const mappingPayload: MappingInsert = {
    insurer_id: insurer.id,
    policy_strategy: normStrategy(DEFAULT_STRATEGY.policy, DEFAULT_STRATEGY.policy) ?? DEFAULT_STRATEGY.policy,
    insured_strategy:
      normStrategy(DEFAULT_STRATEGY.insured, DEFAULT_STRATEGY.insured) ?? DEFAULT_STRATEGY.insured,
    commission_strategy:
      normStrategy(DEFAULT_STRATEGY.commission, DEFAULT_STRATEGY.commission) ?? DEFAULT_STRATEGY.commission,
    options: ensureOptions(DEFAULT_OPTIONS),
    active: true,
  };

  const { error } = await db
    .from("insurer_mappings")
    .upsert(mappingPayload, { onConflict: "insurer_id" });

  if (error) {
    throw new Error(
      `Failed to upsert insurer_mappings for ${insurer.name} (${insurer.id}): ${error.message}`
    );
  }
}

function buildRulePayload(insurerId: string) {
  return REQUIRED_TARGETS.map((target) => ({
    insurer_id: insurerId,
    target_field: target,
    aliases: Array.from(new Set(BASE_ALIASES[target].map((alias) => alias.trim()))),
    strategy: DEFAULT_STRATEGY[target],
    notes: null,
  }));
}

async function replaceRules(insurer: Pick<InsurerRow, "id" | "name">) {
  const db = createAdminClient();
  const incomingRules = buildRulePayload(insurer.id);

  const { error: deleteError } = await db
    .from("insurer_mapping_rules")
    .delete()
    .eq("insurer_id", insurer.id);

  if (deleteError) {
    throw new Error(
      `Failed to clear existing insurer_mapping_rules for ${insurer.name} (${insurer.id}): ${deleteError.message}`
    );
  }

  let inserted = 0;
  const skipped: string[] = [];

  for (const rule of incomingRules) {
    const field = normField(rule.target_field);
    if (!field) {
      skipped.push(
        `[seed] Skipping rule with invalid target_field="${rule.target_field}" for insurer=${insurer.name}`
      );
      continue;
    }

    const payload: MappingRuleInsert = {
      insurer_id: rule.insurer_id,
      target_field: field,
      aliases: normAliases(rule.aliases),
      strategy: normStrategy(rule.strategy, DEFAULT_STRATEGY[field]) ?? DEFAULT_STRATEGY[field],
      notes: rule.notes ?? null,
    };

    const { error } = await db.from("insurer_mapping_rules").insert(payload);

    if (error) {
      console.error("[seed] rule insert failure", {
        insurer: insurer.name,
        payload,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      console.error(
        `[seed] rule insert failure message: ${error.message} | details: ${error.details} | hint: ${error.hint} | code: ${error.code}`
      );
      throw new Error(
        `Failed to upsert mapping rule ${field} for insurer ${insurer.name} (${insurer.id}): ${error.message}`
      );
    }

    inserted += 1;
  }

  if (skipped.length) {
  }

  return inserted;
}

async function main() {
  const db = createAdminClient();
  const { data: insurers, error } = await db
    .from("insurers")
    .select("id, name")
    .eq("active", true);

  if (error) {
    throw new Error(`Unable to load active insurers: ${error.message}`);
  }

  const activeInsurers = insurers ?? [];
  if (activeInsurers.length === 0) {
    console.warn("No active insurers found. Nothing to seed.");
    console.log("DONE seed_insurer_mappings");
    return;
  }

  let rulesTotal = 0;

  for (const insurer of activeInsurers) {
    await upsertMapping(insurer);
    try {
      rulesTotal += await replaceRules(insurer);
    } catch (error) {
      console.error(`[seed] Failed while processing insurer ${insurer.name} (${insurer.id})`, error);
      throw error;
    }
  }

  console.table([
    { metric: "active_insurers", value: activeInsurers.length },
    { metric: "rules_per_insurer", value: REQUIRED_TARGETS.length },
    { metric: "rules_total", value: rulesTotal },
  ]);

  console.log("DONE seed_insurer_mappings");
}

main().catch((error) => {
  console.error("[seed] fatal error", error);
  try {
    console.error("[seed] error details", JSON.stringify(error, null, 2));
  } catch (stringifyError) {
    console.error("[seed] unable to stringify error", stringifyError);
  }
  process.exit(1);
});
