import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';

/**
 * Lightweight endpoint that returns ONLY client IDs for "Select All" functionality.
 * Much faster than export-all since it doesn't fetch full client/policy data.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchQuery, filters } = await request.json();
    
    const supabase = await getSupabaseServer();
    const { role, brokerId } = await getAuthContext();
    
    // Obtener broker de LISSA (Oficina)
    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    const lissaBrokerId = lissaBroker?.id;
    
    // Si hay filtros de póliza, buscar client_ids que tienen pólizas que coinciden
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
        return NextResponse.json({ ok: true, ids: [] });
      }
    } else if (filters?.month !== undefined) {
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
          return NextResponse.json({ ok: true, ids: [] });
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
    
    // Query solo IDs — mucho más liviano
    let query = supabase
      .from("clients")
      .select('id, broker_id, brokers(id, active)')
      .order("name", { ascending: true });
    
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
        return NextResponse.json({ ok: true, ids: [] });
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
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching client IDs for select-all:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    
    let ids = (data || []).map((c: any) => c.id);
    
    // Si es LISSA, filtrar para mostrar sus clientes + clientes de brokers inactivos
    if (role === 'broker' && brokerId === lissaBrokerId && data) {
      ids = data
        .filter((client: any) => {
          return client.broker_id === lissaBrokerId || 
                 (client.brokers && client.brokers.active === false);
        })
        .map((c: any) => c.id);
    }
    
    return NextResponse.json({ ok: true, ids });
  } catch (error) {
    console.error('Error in select-all-ids route:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
