import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/db/context';
import { ClientWithPolicies } from '@/types/db';

export async function POST(request: NextRequest) {
  try {
    const { searchQuery } = await request.json();
    
    const supabase = await getSupabaseServer();
    const { role, brokerId } = await getAuthContext();
    
    // Obtener broker de LISSA (Oficina)
    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    const lissaBrokerId = lissaBroker?.id;
    
    // Buscar en pólizas si hay búsqueda
    let clientIds: string[] = [];
    if (searchQuery && searchQuery.trim()) {
      const { data: policiesMatching } = await supabase
        .from("policies")
        .select("client_id")
        .or(`notas.ilike.%${searchQuery}%,policy_number.ilike.%${searchQuery}%`);
      
      if (policiesMatching && policiesMatching.length > 0) {
        clientIds = [...new Set(policiesMatching.map(p => p.client_id))];
      }
    }
    
    // Query SIN límite de paginación - carga TODOS los clientes
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
      `)
      .order("name", { ascending: true });
      // NO aplicar .range() aquí - queremos TODOS los clientes
    
    // Aplicar filtros de rol
    if (role === 'broker' && brokerId && brokerId !== lissaBrokerId) {
      query = query.eq('broker_id', brokerId);
    }
    
    // Aplicar búsqueda
    if (searchQuery && searchQuery.trim()) {
      if (clientIds.length > 0) {
        query = query.or(`name.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,id.in.(${clientIds.join(',')})`);
      } else {
        query = query.or(`name.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error loading all clients for export:", error);
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
    
    console.log(`[EXPORT-ALL] Returning ${clients.length} clients for export`);
    
    return NextResponse.json({ ok: true, clients });
  } catch (error) {
    console.error('Error in export-all route:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
