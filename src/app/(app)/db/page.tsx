import { Suspense } from "react";
import Link from "next/link";
import { FaPlus, FaFileImport } from "react-icons/fa";
import { getSupabaseServer } from "@/lib/supabase/server";
import DatabaseTabs from "@/components/db/DatabaseTabs";
import InlineSearchBar from "@/components/db/InlineSearchBar";
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

        {/* Compact Header Bar */}
        <div className="bg-gradient-to-r from-[#010139] via-[#020270] to-[#010139] rounded-2xl shadow-2xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Stats - Compact */}
            <div className="flex gap-3 sm:gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 min-w-[100px] sm:min-w-[120px] border border-white/20">
                <div className="text-2xl sm:text-3xl font-black text-white mb-0.5">{clients.length}</div>
                <div className="text-xs text-white/80 font-semibold uppercase">Clientes</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 min-w-[100px] sm:min-w-[120px] border border-white/20">
                <div className="text-2xl sm:text-3xl font-black text-white mb-0.5">{totalPolicies}</div>
                <div className="text-xs text-white/80 font-semibold uppercase">Pólizas</div>
              </div>
            </div>
            
            {/* Primary Action */}
            <Link 
              href="/db?modal=new-client" 
              scroll={false}
              className="group flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 font-semibold text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
            >
              <FaPlus className="text-base sm:text-lg" />
              <span>Nuevo Cliente</span>
            </Link>
          </div>
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6">
          <Suspense fallback={
            <div className="flex items-center gap-2 text-gray-400">
              <div className="animate-spin w-5 h-5 border-2 border-[#010139] border-t-transparent rounded-full"></div>
              <span>Cargando buscador...</span>
            </div>
          }>
            <InlineSearchBar initialQuery={searchQuery} />
          </Suspense>
        </div>

        {/* Secondary Actions Toolbar */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link 
              href="/db/import"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-[#8AAA19] hover:text-white transition-all duration-200 font-medium text-sm group flex-1 sm:flex-initial"
            >
              <FaFileImport className="text-base group-hover:text-white" />
              <span>Importar CSV</span>
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
