import { NextRequest, NextResponse } from 'next/server';
import { listMappingRules } from '@/lib/db/insurers';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const targetField = request.nextUrl.searchParams.get('targetField') || undefined;
    
    const rules = await listMappingRules(id, targetField);
    
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
