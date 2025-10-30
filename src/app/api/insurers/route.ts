import { NextRequest, NextResponse } from 'next/server';
import { listInsurers } from '@/lib/db/insurers';

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const insurers = await listInsurers(includeInactive);
    
    return NextResponse.json({
      success: true,
      insurers: insurers
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}
