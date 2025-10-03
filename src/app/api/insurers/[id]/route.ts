import { NextRequest, NextResponse } from 'next/server';
import { getInsurer } from '@/lib/db/insurers';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const insurer = await getInsurer(id);
    
    return NextResponse.json(insurer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
