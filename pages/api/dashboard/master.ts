// pages/api/dashboard/master.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Usa tus variables ya definidas en /lib/supabase.ts si prefieres.
// Aquí lo hago inline para que el archivo sea autocontenido y fácil de pegar.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Cliente admin (para consultas del dashboard)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Crea un cliente “de usuario” inyectando el Bearer recibido
function userClientFromBearer(req: NextApiRequest) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return { userClient: null, token: null };

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { userClient, token };
}

type CalendarItem = { date: string; count: number; titleList: string[] };
type ApiRes =
  | {
      ok: true;
      pmaYearTotal: number;
      commissionsYearOffice: number;
      pendingIdentify: number;
      calendar: CalendarItem[];
      production: { month: number; total: number; goal?: number }[];
    }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiRes>
) {
  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // 1) Validar auth por Bearer
    const { userClient, token } = userClientFromBearer(req);
    if (!userClient || !token) return res.status(401).json({ ok: false, error: 'No auth token' });

    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return res.status(401).json({ ok: false, error: 'No auth user' });

    const userId = userData.user.id;

    // 2) Confirmar rol master en profiles
    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!profile || profile.role !== 'master') {
      return res.status(403).json({ ok: false, error: 'Rol no permitido' });
    }

    const YEAR = new Date().getFullYear();

    // 3) KPI: Producción anual total (PMA) (tabla: production_monthly)
    const { data: prodRows, error: pmErr } = await supabaseAdmin
      .from('production_monthly')
      .select('year, month, amount, goal')
      .eq('year', YEAR);

    if (pmErr) throw pmErr;
    const pmaYearTotal = (prodRows ?? []).reduce((a, r: any) => a + Number(r.amount ?? 0), 0);

    // 4) Comisión anual oficina (suma de commissions.total_amount del año)
    //    Si commissions no tiene campo 'year' y se usa fortnight_id => puedes
    //    reemplazar por un join/RPC. Aquí asumo columna year opcional.
    const { data: commRows, error: cErr } = await supabaseAdmin
      .from('commissions')
      .select('total_amount, created_at');

    if (cErr) throw cErr;
    const commissionsYearOffice = (commRows ?? [])
      .filter((r: any) => new Date(r.created_at).getFullYear() === YEAR)
      .reduce((a, r: any) => a + Number(r.total_amount ?? 0), 0);

    // 5) Pendiente identificar (última quincena cerrada en metrics_broker)
    const { data: lastFt, error: fErr } = await supabaseAdmin
      .from('fortnights')
      .select('id, end_date, status')
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fErr) throw fErr;

    let pendingIdentify = 0;
    if (lastFt?.id) {
      const { data: mets, error: mErr } = await supabaseAdmin
        .from('metrics_broker')
        .select('pending_identify')
        .eq('fortnight_id', lastFt.id);

      if (mErr) throw mErr;
      pendingIdentify = (mets ?? []).reduce((a, r: any) => a + Number(r.pending_identify ?? 0), 0);
    }

    // 6) Mini calendario (eventos del mes actual)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data: events, error: eErr } = await supabaseAdmin
      .from('events')
      .select('date, title')
      .gte('date', monthStart.toISOString().slice(0, 10))
      .lt('date', monthEnd.toISOString().slice(0, 10))
      .order('date', { ascending: true });

    if (eErr) throw eErr;

    const calendarMap = new Map<string, string[]>();
    for (const ev of events ?? []) {
      const d = String(ev.date).slice(0, 10);
      const prev = calendarMap.get(d) ?? [];
      prev.push(ev.title ?? '');
      calendarMap.set(d, prev);
    }
    const calendar: CalendarItem[] = Array.from(calendarMap.entries()).map(
      ([date, titleList]) => ({ date, count: titleList.length, titleList })
    );

    // 7) Producción por mes (12 slots)
    const byMonth: Record<number, { total: number; goal?: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, goal: undefined };
    for (const r of prodRows ?? []) {
      const m = Number(r.month ?? 0);
      if (m >= 1 && m <= 12) {
        byMonth[m].total += Number(r.amount ?? 0);
        if (r.goal != null) byMonth[m].goal = Number(r.goal);
      }
    }
    const production = Object.entries(byMonth).map(([m, v]) => ({
      month: Number(m),
      total: Number(v.total ?? 0),
      goal: v.goal,
    }));

    return res.status(200).json({
      ok: true,
      pmaYearTotal,
      commissionsYearOffice,
      pendingIdentify,
      calendar,
      production,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
