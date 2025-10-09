import { NextResponse } from 'next/server';
import { createClientWithPolicy } from '@/lib/db/clients';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { clientData, policyData } = body;

    if (!clientData || !policyData) {
      return NextResponse.json(
        { error: 'Faltan datos de cliente o póliza' },
        { status: 400 }
      );
    }

    // Crear cliente con póliza
    const newClient = await createClientWithPolicy(clientData, policyData);

    return NextResponse.json({ 
      success: true, 
      client: newClient 
    });
  } catch (error: any) {
    console.error('Error en API /api/clients:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear cliente y póliza' },
      { status: 500 }
    );
  }
}
