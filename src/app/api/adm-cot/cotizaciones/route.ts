/**
 * ADM COT — Cotizaciones Log API (paginated, filtered, Master-only)
 * 
 * GET /api/adm-cot/cotizaciones?page=1&pageSize=50&dateFrom=...&dateTo=...&insurer=...&ramo=...&status=...&region=...&device=...&search=...&quoteRef=...&policyNumber=...
 * 
 * Returns server-side paginated results with total count.
 * Security: requires authenticated Master user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function validateMaster(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only */ },
      },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return profile?.role === 'master';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Master-only access
    const isMaster = await validateMaster();
    if (!isMaster) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const offset = (page - 1) * pageSize;

    // Filters
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const insurer = searchParams.get('insurer') || undefined;
    const ramo = searchParams.get('ramo') || undefined;
    const status = searchParams.get('status') || undefined;
    const region = searchParams.get('region') || undefined;
    const device = searchParams.get('device') || undefined;
    const search = searchParams.get('search') || undefined;
    const quoteRef = searchParams.get('quoteRef') || undefined;
    const policyNumber = searchParams.get('policyNumber') || undefined;
    // Export mode: return ALL records matching filters (no pagination), up to 10k
    const exportMode = searchParams.get('export') === 'true';

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = sb
      .from('adm_cot_quotes')
      .select('*', { count: 'exact' });

    // Apply filters using indexed columns
    if (dateFrom) query = query.gte('quoted_at', dateFrom);
    if (dateTo) query = query.lte('quoted_at', dateTo + 'T23:59:59');
    if (insurer) query = query.eq('insurer', insurer);
    if (ramo) query = query.eq('ramo', ramo);
    if (status) query = query.eq('status', status);
    if (region) query = query.eq('region', region);
    if (device) query = query.eq('device', device);
    if (quoteRef) query = query.ilike('quote_ref', `%${quoteRef}%`);
    if (policyNumber) query = query.contains('quote_payload', { nro_poliza: policyNumber });

    // Global search: search across multiple fields
    if (search) {
      const s = search.trim();
      query = query.or(
        `client_name.ilike.%${s}%,cedula.ilike.%${s}%,email.ilike.%${s}%,quote_ref.ilike.%${s}%,ip_address.ilike.%${s}%`
      );
    }

    // Ordering
    query = query.order('quoted_at', { ascending: false });

    // Pagination (or export mode)
    if (exportMode) {
      query = query.limit(10000);
    } else {
      query = query.range(offset, offset + pageSize - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[ADM-COT COTIZACIONES] Query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: data ?? [],
        total: count ?? 0,
        page,
        pageSize: exportMode ? (data?.length ?? 0) : pageSize,
      },
    });
  } catch (error: any) {
    console.error('[ADM-COT COTIZACIONES] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
