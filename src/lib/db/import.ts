
import { z } from "zod";
import { getSupabaseServer, type Tables, type TablesInsert } from "@/lib/supabase/server";
import { getAuthContext } from "./context";

type PolicyIns = TablesInsert<"policies">;
type PolicyRow = Tables<"policies">;

const CsvRowSchema = z.object({
  client_id: z.string().uuid(),
  insurer_id: z.string().uuid(),
  policy_number: z.string().min(3).transform((s) => s.trim()),
  ramo: z.string().min(1),
  start_date: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  status: z.enum(["ACTIVA", "CANCELADA", "VENCIDA"]).optional(),
  percent_override: z.number().optional().nullable(),
});

export type ImportRow = z.infer<typeof CsvRowSchema>;

export async function importPolicies(rows: ImportRow[]) {
  const supabase = await getSupabaseServer();
  const ctx = await getAuthContext();

  const { data: existing, error: exErr } = await supabase
    .from("policies")
    .select("policy_number")
    .returns<Pick<PolicyRow, "policy_number">[]>();
  if (exErr) throw new Error(`Error cargando existentes: ${exErr.message}`);
  const existingSet = new Set(existing?.map(r => r.policy_number) ?? []);

  const errors: { row: ImportRow; error: string }[] = [];
  const validRows: PolicyIns[] = [];

  for (const row of rows) {
    const parsed = CsvRowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({
        row,
        error: parsed.error.issues.map((e) => e.message).join(", "),
      });
      continue;
    }

    if (existingSet.has(parsed.data.policy_number)) {
      errors.push({ row, error: `Duplicado policy_number: ${parsed.data.policy_number}` });
      continue;
    }

    const payload: PolicyIns = {
      broker_id: ctx.brokerId as string,
      client_id: parsed.data.client_id,
      insurer_id: parsed.data.insurer_id,
      policy_number: parsed.data.policy_number,
      ramo: parsed.data.ramo,
      start_date: parsed.data.start_date || undefined,
      renewal_date: parsed.data.renewal_date || undefined,
      status: parsed.data.status,
      percent_override: parsed.data.percent_override || undefined,
    };

    validRows.push(payload);
    existingSet.add(parsed.data.policy_number);
  }

  let inserted: PolicyRow[] = [];
  if (validRows.length > 0) {
    const { data, error } = await supabase
      .from("policies")
      .insert(validRows satisfies PolicyIns[])
      .select()
      .returns<PolicyRow[]>();
    if (error) throw new Error(`Error en la inserción masiva: ${error.message}`);
    inserted = data ?? [];
  }

  return { inserted, errors };
}
