import { Metadata } from "next";

import MasterDashboard from "@/components/dashboard/MasterDashboard";
import BrokerDashboard from "@/components/dashboard/BrokerDashboard";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "LISSA | Dashboard",
};

type DashboardRole = "master" | "broker";

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Next.js app router should already guard this, but keep safe fallback.
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: DashboardRole | null }>();

  const role = (profile?.role ?? "broker") as DashboardRole;

  if (role === "master") {
    return <MasterDashboard userId={user.id} />;
  }

  return <BrokerDashboard userId={user.id} />;
}
