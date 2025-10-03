import { env, printEnvSummary } from "@/env";
printEnvSummary();
import { getSupabaseAdmin } from "../../src/lib/supabase/admin";
import type { Tables } from "../../src/lib/database.types";

const VALID_FIELDS = [
  "policy",
  "insured",
  "commission",
  "days",
  "amount",
  "status",
] as const;

function checkEnv() {
  const keys: (keyof NodeJS.ProcessEnv)[] = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  console.log("=== Checking Environment Variables ===");
  let allSet = true;
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      console.log(`[OK] ${key} is set.`);
    } else {
      console.error(`[FAIL] ${key} is NOT set.`);
      allSet = false;
    }
  }
  if (!allSet) {
    throw new Error("One or more critical environment variables are missing.");
  }
  console.log("====================================\n");
}

async function main() {
  checkEnv();

  console.log("Instantiating Supabase admin client...");
  const db = getSupabaseAdmin();
  console.log("Supabase admin client instantiated successfully.");

  const { data: insurers, error: insurersError } = await db
    .from("insurers")
    .select("id")
    .eq("active", true);

  if (insurersError) {
    throw insurersError;
  }

  const activeCount = insurers?.length ?? 0;

  const { data: mappings, error: mappingsError } = await db
    .from("insurer_mappings")
    .select("insurer_id");

  if (mappingsError) {
    throw mappingsError;
  }

  const mappingCount = mappings?.length ?? 0;

  const { data: rules, error: rulesError } = await db
    .from("insurer_mapping_rules")
    .select("target_field");

  if (rulesError) {
    throw rulesError;
  }

  const fieldCounts = VALID_FIELDS.reduce<Record<typeof VALID_FIELDS[number], number>>(
    (acc, field) => {
      acc[field] = 0;
      return acc;
    },
    {} as Record<typeof VALID_FIELDS[number], number>
  );

  let invalid = 0;

  (rules ?? []).forEach((rule) => {
    const key = (rule.target_field ?? "").toLowerCase() as typeof VALID_FIELDS[number];
    if (key && key in fieldCounts) {
      fieldCounts[key] += 1;
    } else {
      invalid += 1;
    }
  });

  const { data: brand, error: brandError } = await db
    .from("app_settings")
    .select("key")
    .eq("key", "brand.colors")
    .limit(1);
  if (brandError) throw brandError;
  if (!brand || brand.length === 0) {
    throw new Error("Missing brand.colors setting");
  }

  console.log("=== VERIFY STEP 3 ===");
  console.table([
    { metric: "active_insurers", value: activeCount },
    { metric: "mapping_headers", value: mappingCount },
    { metric: "rules_total", value: rules?.length ?? 0 },
    { metric: "invalid_rules", value: invalid },
  ]);

  console.table(
    Object.entries(fieldCounts).map(([field, value]) => ({
      target_field: field,
      count: value,
    }))
  );

  if (invalid > 0) {
    console.warn(`Found ${invalid} invalid rules. Please review seed inputs.`);
  }

  console.log("OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
