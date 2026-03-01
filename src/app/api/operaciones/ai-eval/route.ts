import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — AI Evaluation API
// GET ?case_id=X        → latest evaluation for a case
// GET ?user_id=X&from=&to= → effectiveness summary for user
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('case_id');
    const userId = searchParams.get('user_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Single case evaluation
    if (caseId) {
      const { data: evaluation } = await supabase
        .from('ops_ai_evaluations')
        .select('*')
        .eq('case_id', caseId)
        .order('evaluated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({ evaluation: evaluation || null });
    }

    // User effectiveness summary for a period
    if (userId && from && to) {
      // Get all evaluations for this user's urgencies in range
      const { data: evals } = await supabase
        .from('ops_ai_evaluations')
        .select('effectiveness_score, final_sentiment_label, final_sentiment_score, evaluated_at')
        .in('case_id',
          supabase
            .from('ops_cases')
            .select('id')
            .eq('assigned_master_id', userId)
            .eq('case_type', 'urgencia')
        )
        .gte('evaluated_at', `${from}T00:00:00`)
        .lte('evaluated_at', `${to}T23:59:59`)
        .order('evaluated_at', { ascending: true });

      const rows = evals || [];
      const total = rows.length;

      if (total === 0) {
        return NextResponse.json({
          summary: {
            total_evaluated: 0,
            effectiveness_avg: 0,
            negative_count: 0,
            neutral_count: 0,
            positive_count: 0,
            negative_pct: 0,
          },
          daily: [],
        });
      }

      const effAvg = rows.reduce((s: number, r: any) => s + (r.effectiveness_score || 0), 0) / total;
      const negCount = rows.filter((r: any) => r.final_sentiment_label === 'negative').length;
      const neuCount = rows.filter((r: any) => r.final_sentiment_label === 'neutral').length;
      const posCount = rows.filter((r: any) => r.final_sentiment_label === 'positive').length;

      // Group by date for trend
      const byDate: Record<string, { scores: number[]; count: number }> = {};
      for (const r of rows) {
        const d = (r.evaluated_at || '').slice(0, 10);
        if (!byDate[d]) byDate[d] = { scores: [], count: 0 };
        byDate[d].scores.push(r.effectiveness_score || 0);
        byDate[d].count++;
      }

      const daily = Object.entries(byDate).map(([date, v]) => ({
        date,
        avg_effectiveness: Math.round((v.scores.reduce((a, b) => a + b, 0) / v.count) * 10) / 10,
        count: v.count,
      }));

      return NextResponse.json({
        summary: {
          total_evaluated: total,
          effectiveness_avg: Math.round(effAvg * 10) / 10,
          negative_count: negCount,
          neutral_count: neuCount,
          positive_count: posCount,
          negative_pct: Math.round((negCount / total) * 100),
        },
        daily,
      });
    }

    return NextResponse.json({ error: 'case_id or (user_id + from + to) required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
