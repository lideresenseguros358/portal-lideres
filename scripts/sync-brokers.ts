import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1) Brokers activos
  const { data: brokers, error } = await supabase.from("brokers").select("id, email, name").eq("active", true);
  if (error) throw error;

  for (const b of brokers) {
    if (!b.email) continue;

    // 2) Buscar si ya existe en profiles
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", b.email).single();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: crypto.randomUUID(), // genera uuid
        email: b.email,
        role: "broker",
        broker_id: b.id,
        full_name: b.name,
      });
    }
  }
}

main().catch(console.error);
