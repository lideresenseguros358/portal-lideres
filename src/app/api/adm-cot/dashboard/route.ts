/**
 * ADM COT — Dashboard Metrics API
 * 
 * GET /api/adm-cot/dashboard?dateFrom=...&dateTo=...&insurer=...&ramo=...&region=...&device=...
 * 
 * Returns all dashboard data in a single response (cached server-side).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/adm-cot/dashboard-metrics';
import type { DashboardFilters } from '@/lib/adm-cot/dashboard-metrics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: DashboardFilters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      insurer: searchParams.get('insurer') || undefined,
      ramo: searchParams.get('ramo') || undefined,
      region: searchParams.get('region') || undefined,
      device: searchParams.get('device') || undefined,
    };

    const result = await getDashboardMetrics(filters);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('[ADM-COT DASHBOARD API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
