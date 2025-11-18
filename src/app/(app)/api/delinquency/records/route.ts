import { NextRequest, NextResponse } from 'next/server';
import { actionGetDelinquencyRecords } from '@/app/(app)/delinquency/actions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const insurerId = searchParams.get('insurerId') || undefined;
    const brokerId = searchParams.get('brokerId') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await actionGetDelinquencyRecords({
      insurerId,
      brokerId,
      search,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener registros' },
      { status: 500 }
    );
  }
}
