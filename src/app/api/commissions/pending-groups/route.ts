import { NextResponse } from 'next/server';
import { getPendingGroups } from '@/lib/commissions/rules';

export async function GET() {
  try {
    const groups = await getPendingGroups();
    return NextResponse.json(groups);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
