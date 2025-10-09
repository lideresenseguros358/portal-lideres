import { Suspense } from "react";
import Link from "next/link";
import { FaPlus, FaSearch, FaFileImport } from "react-icons/fa";
import { getSupabaseServer } from "@/lib/supabase/server";
import DatabaseTabs from "@/components/db/DatabaseTabs";
import type { Tables } from "@/lib/supabase/server";
import type { ClientWithPolicies, InsurerWithCount } from "@/types/db";
import { getAuthContext } from "@/lib/db/context";

type PolicyRow = Tables<"policies">;
type BrokerRow = Tables<"brokers">;
type InsurerRow = Tables<"insurers">;
type ClientRow = Tables<"clients">;

async function getClientsWithPolicies(searchQuery?: string): Promise<ClientWithPolicies[]> {
  const supabase = await getSupabaseServer();
  
  let query = supabase
    .from("clients")
    .select(`
      *,
      policies (
        id,
        policy_number,
        insurer_id,
        ramo,
        renewal_date,
        status,
        insurers (
          id,
          name,
          active
        )
      ),
      brokers (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchQuery) {
    query = query.or('name.ilike.%' + searchQuery + '%,national_id.ilike.%' + searchQuery + '%,email.ilike.%' + searchQuery + '%');
  }

  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
  
  return (data || []).map((client: any) => ({
    ...client,
    policies: client.policies ? [client.policies].flat() : [],
    brokers: client.brokers || null
  })) as ClientWithPolicies[];
}

async function getInsurersWithPolicies(): Promise<InsurerWithCount[]> {
  const supabase = await getSupabaseServer();
  
  const { data: insurers } = await supabase
    .from("insurers")
    .select("*")
    .eq("active", true)
    .order("name");

  const { data: policyCounts } = await supabase
    .from("policies")
    .select("insurer_id, id")
    .returns<{ insurer_id: string; id: string }[]>();

  const countsMap = new Map<string, number>();
  (policyCounts || []).forEach(p => {
    const count = countsMap.get(p.insurer_id) || 0;
    countsMap.set(p.insurer_id, count + 1);
  });

  return (insurers || []).map((insurer: any) => ({
    ...insurer,
    policyCount: countsMap.get(insurer.id) || 0
  })) as InsurerWithCount[];
}

export default async function DatabasePage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; search?: string; client?: string; policy?: string }>
}) {
  const params = await searchParams;
  const activeTab = params.tab || "clients";
  const searchQuery = params.search || "";
  
  const { role, userId } = await getAuthContext();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Get brokers for preliminary clients tab
  const { data: brokers } = await supabase
    .from('brokers')
    .select('*, profiles!p_id(id, full_name, email)')
    .eq('active', true)
    .order('name');

  const [clients, insurers] = await Promise.all([
    getClientsWithPolicies(searchQuery),
    getInsurersWithPolicies()
  ]);

  const totalPolicies = clients.reduce((acc, c) => {
    return acc + (c.policies ? c.policies.length : 0);
  }, 0);

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">📊 Base de Datos</h1>
          <p className="text-gray-600 text-lg">Gestión inteligente de clientes, pólizas y aseguradoras</p>
        </div>

        {/* Stats Section */}
        <div className="mb-8">
          {/* Live Stats */}
          <div className="flex gap-4">
              <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-2xl shadow-2xl p-6 min-w-[140px] transform hover:scale-105 transition-all duration-300">
                <div className="text-4xl font-black text-white mb-1">{clients.length}</div>
                <div className="text-sm text-white/80 font-semibold uppercase tracking-wide">Clientes</div>
              </div>
              <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] rounded-2xl shadow-2xl p-6 min-w-[140px] transform hover:scale-105 transition-all duration-300">
                <div className="text-4xl font-black text-white mb-1">
                  {totalPolicies}
                </div>
                <div className="text-sm text-white/80 font-semibold uppercase tracking-wide">Pólizas</div>
              </div>
            </div>
        </div>

        <div className="mb-8">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Card */}
            <Link 
              href="/db?modal=search" 
              scroll={false}
              className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl p-5 transition-all duration-300 hover:-translate-y-1 border border-gray-200 hover:border-[#010139]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#010139] to-[#020270] flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <FaSearch className="text-white text-lg" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-[#010139] group-hover:text-[#8AAA19] transition-colors">Búsqueda Rápida</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Encuentra clientes y pólizas</p>
                </div>
              </div>
            </Link>

            {/* New Client Card */}
            <Link 
              href="/db?modal=new-client" 
              scroll={false}
              className="group relative bg-gradient-to-br from-[#010139] to-[#020270] rounded-xl shadow-lg hover:shadow-xl p-5 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-[#8AAA19] transition-colors shadow-md">
                  <FaPlus className="text-white text-lg" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white">Nuevo Cliente</h3>
                  <p className="text-white/80 text-xs mt-0.5">Crear cliente y póliza</p>
                </div>
              </div>
            </Link>

            {/* Import CSV Card */}
            <Link 
              href="/db/import"
              className="group relative bg-white rounded-xl shadow-lg hover:shadow-xl p-5 transition-all duration-300 hover:-translate-y-1 border border-gray-200 hover:border-[#8AAA19]"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#8AAA19] to-[#6d8814] flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <FaFileImport className="text-white text-lg" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-[#010139] group-hover:text-[#8AAA19] transition-colors">Importar CSV</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Carga masiva de datos</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Database Tabs Content */}
        <DatabaseTabs 
          activeTab={activeTab}
          clients={clients}
          insurers={insurers}
          brokers={brokers || []}
          searchQuery={searchQuery}
          role={role}
          userEmail={user?.email || ''}
        />
      </div>
    </div>
  );
}
