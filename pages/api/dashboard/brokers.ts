// pages/api/dashboard/broker.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

type Donut = { label: string; current: number; goal?: number; split?: number };
type ApiRes =
  | {
      ok: true;
      // KPIs
      lastFortnightAmount: number;
      morosidadOver60: number;
      pendingIdentify: number;
      convivio: Donut;
      assa: Donut;
      // Calendario
      calendar: { date: string; count: number; titleList: string[] }[];
      // Producción por mes del broker
      production: { month: number; total: number }[];
    }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiRes>
) {
  if (req.method !== 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // 1) Auth Bearer
    const { userClient, token } = userClientFromBearer(req);
    if (!userClient || !token) return res.status(401).json({ ok: false, error: 'No auth token' });

    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return res.status(401).json({ ok: false, error: 'No auth user' });
    const userId = userData.user.id;

    // 2) Perfil y broker_id
    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, broker_id')
      .eq('id', userId)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!profile || profile.role !== 'broker' || !profile.broker_id) {
      return res.status(403).json({ ok: false, error: 'Rol no permitido o broker_id faltante' });
    }
    const brokerId = String(profile.broker_id);
    const YEAR = new Date().getFullYear();

    // 3) Última quincena cerrada
    const { data: lastFt, error: fErr } = await supabaseAdmin
      .from('fortnights')
      .select('id, end_date, status')
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fErr) throw fErr;

    // 4) KPI: monto última quincena para este broker (neto si existe)
    let lastFortnightAmount = 0;
    if (lastFt?.id) {
      const { data: lastComm, error: lcErr } = await supabaseAdmin
        .from('commissions')
        .select('total_amount_net, total_amount, broker_id, fortnight_id')
        .eq('fortnight_id', lastFt.id)
        .eq('broker_id', brokerId)
        .maybeSingle();
      if (lcErr) throw lcErr;
      lastFortnightAmount = Number(
        lastComm?.total_amount_net ?? lastComm?.total_amount ?? 0
      );
    }

    // 5) Morosidad +60 (metrics_broker por broker, usar la última fila disponible)
    let morosidadOver60 = 0;
    let pendingIdentify = 0;
    {
      const { data: mb, error: mErr } = await supabaseAdmin
        .from('metrics_broker')
        .select('morosity_over_60, pending_identify, created_at, fortnight_id')
        .eq('broker_id', brokerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mErr) throw mErr;
      morosidadOver60 = Number(mb?.morosity_over_60 ?? 0);
      pendingIdentify = Number(mb?.pending_identify ?? 0);
    }

    // 6) Convivio y ASSA (si existen las tablas de progreso; si no, devolvemos ceros)
    //    Tablas sugeridas: convivio_progress(broker_id, current, goal, split) y assa_progress(broker_id, current, goal, split)
    const { data: conv, error: cvErr } = await supabaseAdmin
      .from('convivio_progress')
      .select('current, goal, split')
      .eq('broker_id', brokerId)
      .maybeSingle();
    if (cvErr && cvErr.code !== 'PGRST116') throw cvErr; // ignora si no existe

    const { data: assa, error: asErr } = await supabaseAdmin
      .from('assa_progress')
      .select('current, goal, split')
      .eq('broker_id', brokerId)
      .maybeSingle();
    if (asErr && asErr.code !== 'PGRST116') throw asErr;

    const convivio: Donut = {
      label: 'Convivio',
      current: Number(conv?.current ?? 0),
      goal: conv?.goal != null ? Number(conv.goal) : undefined,
      split: conv?.split != null ? Number(conv.split) : undefined,
    };
    const assaDonut: Donut = {
      label: 'Concurso ASSA',
      current: Number(assa?.current ?? 0),
      goal: assa?.goal != null ? Number(assa.goal) : undefined,
      split: assa?.split != null ? Number(assa.split) : undefined,
    };

    // 7) Calendario del mes (pueden ser eventos globales o por broker si tienes columna broker_id)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Si tu tabla events tiene broker_id, descomenta el .eq('broker_id', brokerId)
    const { data: events, error: eErr } = await supabaseAdmin
      .from('events')
      .select('date, title')
      .gte('date', monthStart.toISOString().slice(0, 10))
      .lt('date', monthEnd.toISOString().slice(0, 10))
      .order('date', { ascending: true });
      // .eq('broker_id', brokerId)

    if (eErr) throw eErr;

    const calendarMap = new Map<string, string[]>();
    for (const ev of events ?? []) {
      const d = String(ev.date).slice(0, 10);
      const prev = calendarMap.get(d) ?? [];
      prev.push(ev.title ?? '');
      calendarMap.set(d, prev);
    }
    const calendar = Array.from(calendarMap.entries()).map(([date, titleList]) => ({
      date,
      count: titleList.length,
      titleList,
    }));

    // 8) Producción mensual del broker (production_monthly con broker_id)
    const { data: pm, error: pmErr } = await supabaseAdmin
      .from('production_monthly')
      .select('month, amount, year, broker_id')
      .eq('year', YEAR)
      .eq('broker_id', brokerId);

    if (pmErr && pmErr.code !== 'PGRST116') throw pmErr;

    const byMonth: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;
    for (const r of pm ?? []) {
      const m = Number(r.month ?? 0);
      if (m >= 1 && m <= 12) byMonth[m] += Number(r.amount ?? 0);
    }
    const production = Object.entries(byMonth).map(([m, total]) => ({
      month: Number(m),
      total: Number(total ?? 0),
    }));

    return res.status(200).json({
      ok: true,
      lastFortnightAmount,
      morosidadOver60,
      pendingIdentify,
      convivio,
      assa: assaDonut,
      calendar,
      production,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
