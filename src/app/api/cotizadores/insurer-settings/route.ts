import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

// Never cache this route — settings must always reflect the latest master toggle
export const dynamic = 'force-dynamic';

/**
 * GET /api/cotizadores/insurer-settings
 * Returns all cotizador insurer settings (public)
 */
async function handleGET() {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        } as any,
      }
    );

    const { data, error } = await supabase
      .from('cotizador_insurer_settings')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, settings: data || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('Failed to fetch insurer settings:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cotizadores/insurer-settings?slug=xxx
 * Update insurer setting (master-only)
 * Body: { tp_activo?: boolean, cc_activo?: boolean }
 */
async function handlePATCH(request: NextRequest) {
  try {
    // Check authentication and master role
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any) {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              request.cookies.set(name, value)
            );
          },
        } as any,
      }
    );

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check master role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (!profile || profile.role?.toLowerCase() !== 'master') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: only master users can edit insurers' },
        { status: 403 }
      );
    }

    // Get slug from query params
    const slug = request.nextUrl.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Missing slug parameter' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tp_activo, cc_activo } = body;

    const updateData: any = {};
    if (tp_activo !== undefined) updateData.tp_activo = tp_activo;
    if (cc_activo !== undefined) updateData.cc_activo = cc_activo;
    updateData.updated_at = new Date().toISOString();

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cotizador_insurer_settings')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Update failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      setting: data,
    });
  } catch (err: any) {
    console.error('Failed to update insurer setting:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleGET();
}

export async function PATCH(request: NextRequest) {
  return handlePATCH(request);
}
