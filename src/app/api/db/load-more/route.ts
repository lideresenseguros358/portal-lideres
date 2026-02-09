import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';
import { ClientWithPolicies } from '@/types/db';

interface LoadMoreBody {
  offset: number;
  limit: number;
  searchQuery?: string;
  filters?: {
    broker?: string;
    insurer?: string;
    ramo?: string;
    month?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: LoadMoreBody = await request.json();
    const { offset, limit, searchQuery, filters } = body;
    
    const supabase = await getSupabaseServer();
    const { role, brokerId } = await getAuthContext();
    
    // Obtener broker de LISSA (Oficina)
    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    const lissaBrokerId = lissaBroker?.id;
    
    const hasServerFilters = !!(filters?.broker || filters?.insurer || filters?.ramo || filters?.month !== undefined);
    
    // Si hay filtros de póliza (insurer, ramo, month), buscar client_ids que tienen pólizas que coinciden
    let filterClientIds: string[] | null = null;
    if (filters?.insurer || filters?.ramo || filters?.month !== undefined) {
      let policyQuery = supabase.from("policies").select("client_id");
      
      if (filters.insurer) {
        policyQuery = policyQuery.eq('insurer_id', filters.insurer);
      }
      if (filters.ramo) {
        policyQuery = policyQuery.ilike('ramo', filters.ramo);
      }
      
      const { data: matchingPolicies } = await policyQuery;
      
      if (matchingPolicies && matchingPolicies.length > 0) {
        let policyClientIds = [...new Set(matchingPolicies.map(p => p.client_id))];
        
        // Filtro de mes se aplica post-query ya que requiere parsear la fecha
        if (filters.month !== undefined) {
          const monthStr = String(filters.month + 1).padStart(2, '0');
          const { data: monthPolicies } = await supabase
            .from("policies")
            .select("client_id, renewal_date")
            .not('renewal_date', 'is', null);
          
          if (monthPolicies) {
            const monthClientIds = new Set(
              monthPolicies
                .filter(p => {
                  if (!p.renewal_date) return false;
                  const parts = p.renewal_date.split('-');
                  return parts[1] === monthStr;
                })
                .map(p => p.client_id)
            );
            policyClientIds = policyClientIds.filter(id => monthClientIds.has(id));
          }
        }
        
        filterClientIds = policyClientIds;
      } else {
        // No hay pólizas que coincidan con los filtros → 0 resultados
        return NextResponse.json({ ok: true, clients: [], totalFiltered: 0 });
      }
    } else if (filters?.month !== undefined) {
      // Solo filtro de mes sin insurer/ramo
      const monthStr = String(filters.month + 1).padStart(2, '0');
      const { data: monthPolicies } = await supabase
        .from("policies")
        .select("client_id, renewal_date")
        .not('renewal_date', 'is', null);
      
      if (monthPolicies) {
        filterClientIds = [...new Set(
          monthPolicies
            .filter(p => {
              if (!p.renewal_date) return false;
              const parts = p.renewal_date.split('-');
              return parts[1] === monthStr;
            })
            .map(p => p.client_id)
        )];
        
        if (filterClientIds.length === 0) {
          return NextResponse.json({ ok: true, clients: [], totalFiltered: 0 });
        }
      }
    }
    
    // Buscar en pólizas si hay búsqueda de texto
    let searchClientIds: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      const { data: policiesMatching } = await supabase
        .from("policies")
        .select("client_id")
        .or(`notas.ilike.%${searchQuery}%,policy_number.ilike.%${searchQuery}%`);
      
      if (policiesMatching && policiesMatching.length > 0) {
        searchClientIds = [...new Set(policiesMatching.map(p => p.client_id))];
      }
    }
    
    let query = supabase
      .from("clients")
      .select(`
        *,
        policies (
          id,
          policy_number,
          insurer_id,
          ramo,
          start_date,
          renewal_date,
          status,
          notas,
          percent_override,
          insurers (
            id,
            name,
            active
          )
        ),
        brokers (
          id,
          name,
          active
        )
      `, { count: 'exact' })
      .order("name", { ascending: true });
    
    // Aplicar paginación solo si NO hay filtros server-side activos
    // Con filtros activos, cargamos todo y paginamos en el response
    if (!hasServerFilters) {
      query = query.range(offset, offset + limit - 1);
    }
    
    // Aplicar filtros de rol
    if (role === 'broker' && brokerId && brokerId !== lissaBrokerId) {
      query = query.eq('broker_id', brokerId);
    }
    
    // Filtro de broker (master view)
    if (filters?.broker && role === 'master') {
      query = query.eq('broker_id', filters.broker);
    }
    
    // Filtro por client_ids de pólizas que coinciden
    if (filterClientIds !== null) {
      if (filterClientIds.length === 0) {
        return NextResponse.json({ ok: true, clients: [], totalFiltered: 0 });
      }
      query = query.in('id', filterClientIds);
    }
    
    // Aplicar búsqueda de texto
    if (searchQuery && searchQuery.trim()) {
      if (searchClientIds.length > 0) {
        query = query.or(`name.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,id.in.(${searchClientIds.join(',')})`);
      } else {
        query = query.or(`name.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Error loading more clients:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    
    let filteredData = data || [];
    
    // Si es LISSA, filtrar para mostrar sus clientes + clientes de brokers inactivos
    if (role === 'broker' && brokerId === lissaBrokerId && filteredData) {
      filteredData = filteredData.filter((client: any) => {
        return client.broker_id === lissaBrokerId || 
               (client.brokers && client.brokers.active === false);
      });
    }
    
    const clients = filteredData.map((client: any) => ({
      ...client,
      policies: client.policies ? [client.policies].flat() : [],
      brokers: client.brokers || null
    })) as ClientWithPolicies[];
    
    // Si hay filtros activos y cargamos todo, aplicar paginación en el response
    if (hasServerFilters) {
      const totalFiltered = clients.length;
      const paginatedClients = clients.slice(offset, offset + limit);
      return NextResponse.json({ ok: true, clients: paginatedClients, totalFiltered });
    }
    
    return NextResponse.json({ ok: true, clients, totalFiltered: count || clients.length });
  } catch (error) {
    console.error('Error in load-more route:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
