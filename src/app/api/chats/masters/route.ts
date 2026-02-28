/**
 * GET /api/chats/masters — List all master users for chat assignment
 * Master-only endpoint.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function isMaster(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await sb
      .from('profiles').select('role').eq('id', user.id).single();
    return profile?.role === 'master';
  } catch { return false; }
}

export async function GET() {
  if (!(await isMaster())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const { data: masters, error } = await sb
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('role', 'master')
      .order('full_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: (masters || []).map(m => ({
        id: m.id,
        name: m.full_name || m.email || 'Master',
        email: m.email || '',
        avatar_url: m.avatar_url || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
