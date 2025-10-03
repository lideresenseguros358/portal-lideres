import { NextResponse } from 'next/server';
import { getInsurerMapping } from '@/lib/db/insurers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const { id } = params;
    
    const mapping = await getInsurerMapping(id);
    
    return NextResponse.json(mapping || {});
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
