import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServer, type TablesInsert } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

// ---- Aliases de tipos de inserción (coinciden con tu esquema) ----
type InsurerMappingInsert = TablesInsert<"insurer_mappings">;
type MappingRuleInsert     = TablesInsert<"insurer_mapping_rules">;
type DelinqRuleInsert      = TablesInsert<"insurer_delinquency_rules">;

// Json helper (evita errores con jsonb)
type Json = Database["public"]["Tables"]["insurer_mappings"]["Insert"]["options"];

// ---- Constantes/Enums que ya usas en el proyecto ----
const mappingFieldValues = [
  "policy",
  "insured",
  "commission",
  "status",
  "days",
  "amount",
  "balance",
] as const;

const strategyValues = [
  "by_alias",
  "first_non_zero",
  "penultimate",
  "extract_numeric",
  "custom",
] as const;

const delinquencyTargetValues = [
  "balance",
  "days",
  "status",
] as const;

// ---- Zod Schemas del payload ----
const Rule = z.object({
  target_field: z.enum(mappingFieldValues),
  aliases: z.array(z.string()).default([]),      // ← text[]
  strategy: z.enum(strategyValues).default("by_alias"),
  notes: z.string().nullable().optional(),
});

const DelinqRule = z.object({
  target_field: z.enum(delinquencyTargetValues),
  aliases: z.array(z.string()).default([]),      // ← text[]
});

const Header = z.object({
  policy_strategy: z.enum(strategyValues).default("by_alias"),
  insured_strategy: z.enum(strategyValues).default("by_alias"),
  commission_strategy: z.enum(strategyValues).default("by_alias"),
  options: z.record(z.string(), z.any()).default({}),   // ← jsonb
  active: z.boolean().default(true),
});

const PutBody = z.object({
  header: Header,
  rules: z.array(Rule).default([]),
  delinquency: z.array(DelinqRule).default([]),
});

// ---- Helpers de transformación a tipos Insert ----
function toRuleRows(
  insurerId: string,
  rules: z.infer<typeof Rule>[]
): MappingRuleInsert[] {
  return (rules ?? []).map((r) => ({
    insurer_id: insurerId,
    target_field: r.target_field,        // text
    aliases: r.aliases,                  // text[]
    strategy: r.strategy,                // text
    notes: r.notes || undefined,         // text | undefined
  }));
}

function toDelinqRows(
  insurerId: string,
  rows: z.infer<typeof DelinqRule>[]
): DelinqRuleInsert[] {
  return (rows ?? []).map((r) => ({
    insurer_id: insurerId,
    target_field: r.target_field,        // text (limitado a balance/days/status)
    aliases: r.aliases,                  // text[]
  }));
}

// ===================== GET =====================
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{insurerId: string }> }
): Promise<Response> {
  try {
    const {insurerId } = await context.params;
    const admin = getSupabaseAdmin();

    const body = PutBody.parse(await req.json());

    // 1) Header → shape EXACTO a Insert
    const headerRow: InsurerMappingInsert = {
      insurer_id: insurerId,
      policy_strategy: body.header.policy_strategy,
      insured_strategy: body.header.insured_strategy,
      commission_strategy: body.header.commission_strategy,
      options: (body.header.options ?? {}) as Json, // ← jsonb
      active: body.header.active ?? true,
    };

    const { error: upErr } = await admin
      .from("insurer_mappings")
      .upsert(headerRow, { onConflict: "insurer_id" });
    if (upErr) {
      return NextResponse.json(
        { message: "Failed to upsert insurer_mappings", error: upErr.message },
        { status: 500 }
      );
    }

    // 4) Snapshot final (opcional, útil para UI)
    const { data: mappingHeader } = await admin
      .from("insurer_mappings")
      .select("*")
      .eq("insurer_id", insurerId)
      .maybeSingle();

    const { data: rules } = await admin
      .from("insurer_mapping_rules")
      .select("*")
      .eq("insurer_id", insurerId)
      .order("target_field", { ascending: true });

    const { data: delinquencyRules } = await admin
      .from("insurer_delinquency_rules")
      .select("*")
      .eq("insurer_id", insurerId)
      .order("target_field", { ascending: true });
      
    return NextResponse.json({
      header: mappingHeader,
      rules: rules ?? [],
      delinquency: delinquencyRules ?? [],
    });
  } catch (err: any) {
    if (err?.issues) {
      // Zod error
      return NextResponse.json(
        { message: "Invalid request body", issues: err.issues },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update mapping", error: err?.message },
      { status: 500 }
    );
  }
}
