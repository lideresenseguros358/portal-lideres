/**
 * ADM COT — Chat Admin API (Master-only)
 * 
 * GET  /api/adm-cot/chat?tab=conversations|tasks&...filters
 * POST /api/adm-cot/chat  { action: 'close_conversation' | 'resolve_task' | 'assign_task' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSb() { return createClient(supabaseUrl, supabaseServiceKey); }

async function getMasterUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return profile?.role === 'master' ? user.id : null;
  } catch { return null; }
}

// ═══════════════════════════════════════
// GET
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'conversations';
  const sb = getSb();

  try {
    switch (tab) {
      case 'conversations': {
        const status = searchParams.get('status') || undefined;
        const classification = searchParams.get('classification') || undefined;
        const isComplex = searchParams.get('is_complex') || undefined;
        const source = searchParams.get('source') || undefined;
        const search = searchParams.get('search') || undefined;
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;

        let q = sb.from('adm_cot_conversations').select('*', { count: 'exact' })
          .order('created_at', { ascending: false });
        if (status) q = q.eq('status', status);
        if (classification) q = q.eq('classification', classification);
        if (isComplex === 'true') q = q.eq('is_complex', true);
        if (isComplex === 'false') q = q.eq('is_complex', false);
        if (source) q = q.eq('source', source);
        if (dateFrom) q = q.gte('created_at', dateFrom + 'T00:00:00');
        if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
        if (search) q = q.or(`client_name.ilike.%${search}%,phone.ilike.%${search}%,cedula.ilike.%${search}%,email.ilike.%${search}%`);
        q = q.limit(200);

        const { data, error, count } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Summary
        const { data: allConvs } = await sb.from('adm_cot_conversations').select('status, is_complex');
        const summary = { open: 0, escalated: 0, closed: 0, complex: 0, total: 0 };
        (allConvs ?? []).forEach((c: any) => {
          summary.total++;
          if (c.status === 'OPEN') summary.open++;
          if (c.status === 'ESCALATED') summary.escalated++;
          if (c.status === 'CLOSED') summary.closed++;
          if (c.is_complex) summary.complex++;
        });

        return NextResponse.json({ success: true, data: { rows: data ?? [], total: count ?? 0, summary } });
      }

      case 'detail': {
        const convId = searchParams.get('id');
        if (!convId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { data: conv, error: convErr } = await sb.from('adm_cot_conversations')
          .select('*').eq('id', convId).single();
        if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

        const { data: messages } = await sb.from('adm_cot_messages')
          .select('*').eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        const { data: tasks } = await sb.from('adm_cot_tasks')
          .select('*').eq('conversation_id', convId)
          .order('created_at', { ascending: false });

        return NextResponse.json({
          success: true,
          data: { conversation: conv, messages: messages ?? [], tasks: tasks ?? [] },
        });
      }

      case 'tasks': {
        const taskStatus = searchParams.get('status') || undefined;
        let q = sb.from('adm_cot_tasks').select('*, adm_cot_conversations(client_name, phone, source, classification)')
          .order('created_at', { ascending: false });
        if (taskStatus) q = q.eq('status', taskStatus);
        q = q.limit(100);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: { tasks: data ?? [] } });
      }

      default:
        return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════
// POST
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = getSb();
  const body = await request.json();
  const { action, data } = body;

  try {
    switch (action) {
      case 'close_conversation': {
        const { conversation_id } = data;
        if (!conversation_id) return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
        const { error } = await sb.from('adm_cot_conversations').update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          closed_by: userId,
        }).eq('id', conversation_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'conversation_closed', entity_type: 'conversation', entity_id: conversation_id,
          user_id: userId,
        });
        return NextResponse.json({ success: true });
      }

      case 'resolve_task': {
        const { task_id } = data;
        if (!task_id) return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
        const { error } = await sb.from('adm_cot_tasks').update({
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        }).eq('id', task_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'task_resolved', entity_type: 'task', entity_id: task_id,
          user_id: userId,
        });
        return NextResponse.json({ success: true });
      }

      case 'assign_task': {
        const { task_id, assigned_to } = data;
        if (!task_id) return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
        const { error } = await sb.from('adm_cot_tasks').update({
          assigned_to: assigned_to || null,
          status: 'IN_PROGRESS',
        }).eq('id', task_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
