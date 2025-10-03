import { redirect } from "next/navigation";

import { getSupabaseServer } from "@/lib/supabase/server";

import MappingConfigurator from "./MappingConfigurator";
import { Database } from "@/lib/database.types";

type InsurerOption = {
  id: string;
  name: string;
};

type Role = Database["public"]["Enums"]["role_enum"];

export default async function MapeosPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== ("master" as Role)) {
    redirect("/");
  }

  const adminSupabase = await getSupabaseServer();
  const { data: insurers } = await adminSupabase
    .from("insurers")
    .select("id, name")
    .order("name", { ascending: true });

  const options: InsurerOption[] = (insurers ?? []).map((insurer) => ({
    id: insurer.id,
    name: insurer.name ?? "",
  }));

  return <MappingConfigurator insurers={options} />;
}
