/**
 * CRON: IS DT Reference Price Updater
 * ====================================
 * Genera cotizaciones de referencia para planes DT de Internacional (IS)
 * y almacena los precios en app_settings.
 * 
 * Corre 1x/día después del token refresh (is-token corre a las 11 UTC).
 * Solo actualiza app_settings si el precio cambió.
 * 
 * Key: "is_dt_reference_prices"
 * Value: { basic: { price, idCotizacion, coverages, ... }, premium: {...}, updatedAt, ... }
 * 
 * vercel.json: { "path": "/api/cron/is-dt-reference", "schedule": "30 11 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getISDefaultEnv } from '@/lib/is/config';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 45;

const SETTINGS_KEY = 'is_dt_reference_prices';

// Reference vehicle (same as third-party route)
const REF_VEHICLE = {
  codTipoDoc: 1,
  nroDoc: '8-000-0000',
  nroNit: '8-000-0000',
  nombre: 'COTIZACION',
  apellido: 'WEB',
  telefono: '60000000',
  correo: 'cotizacion@web.com',
  codMarca: 156,       // Toyota
  codModelo: 2563,     // Toyota model
  anioAuto: String(new Date().getFullYear()),
  sumaAseg: '0',       // DT = 0
  codPlanCoberturaAdic: 0,
  codGrupoTarifa: 20,  // PARTICULAR
  codProvincia: 8,
  fecNacimiento: '01/01/1990',
};

const PLAN_SOAT = 306;
const PLAN_INTERMEDIO = 307;

interface CoverageItem {
  code: string;
  name: string;
  limit: string;
  prima: number;
}

interface PlanSnapshot {
  price: number;
  idCotizacion: string;
  coverages: CoverageItem[];
  fromApi: true;
}

async function quotePlan(codPlan: number, env: 'development' | 'production'): Promise<PlanSnapshot | null> {
  try {
    const r = await generarCotizacionAuto({ ...REF_VEHICLE, codPlanCobertura: codPlan }, env);
    if (!r.success || !r.idCotizacion) {
      console.warn(`[IS DT Ref] Cotización falló plan ${codPlan}:`, r.error);
      return null;
    }

    const price = r.primaTotal ?? 0;

    const cob = await obtenerCoberturasCotizacion(r.idCotizacion, 1, env);
    const coverages: CoverageItem[] = [];
    if (cob.success && cob.data?.Table?.length) {
      for (const c of cob.data.Table) {
        coverages.push({
          code: String(c.COD_AMPARO ?? ''),
          name: c.COBERTURA ?? '',
          limit: c.LIMITES ?? '',
          prima: parseFloat(String(c.PRIMA1).replace(/,/g, '')) || 0,
        });
      }
    }

    const finalPrice = price > 0 ? price : coverages.reduce((s, c) => s + c.prima, 0);
    return { price: Math.round(finalPrice * 100) / 100, idCotizacion: r.idCotizacion, coverages, fromApi: true };
  } catch (e: any) {
    console.error(`[IS DT Ref] Error plan ${codPlan}:`, e.message);
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getISDefaultEnv();
  console.log(`[IS DT Ref] Starting reference quote update (env=${env})...`);

  // 1. Generate reference quotes in parallel
  const [basic, premium] = await Promise.all([
    quotePlan(PLAN_SOAT, env),
    quotePlan(PLAN_INTERMEDIO, env),
  ]);

  if (!basic && !premium) {
    console.error('[IS DT Ref] Both quotes failed — keeping existing prices');
    return NextResponse.json({ success: false, error: 'Both reference quotes failed', env });
  }

  // 2. Read current stored prices
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  const prev = (existing?.value as any) ?? {};
  const prevBasicPrice = prev?.basic?.price ?? 0;
  const prevPremiumPrice = prev?.premium?.price ?? 0;

  // 3. Build new value — keep previous if one plan failed
  const newValue = {
    basic: basic ?? prev?.basic ?? null,
    premium: premium ?? prev?.premium ?? null,
    updatedAt: new Date().toISOString(),
    env,
    changed: false as boolean,
    changes: [] as string[],
  };

  // Detect changes
  if (basic && basic.price !== prevBasicPrice) {
    newValue.changed = true;
    newValue.changes.push(`basic: $${prevBasicPrice} → $${basic.price}`);
  }
  if (premium && premium.price !== prevPremiumPrice) {
    newValue.changed = true;
    newValue.changes.push(`premium: $${prevPremiumPrice} → $${premium.price}`);
  }

  // 4. Upsert into app_settings
  const { error: upsertError } = await supabase
    .from('app_settings')
    .upsert({ key: SETTINGS_KEY, value: newValue }, { onConflict: 'key' });

  if (upsertError) {
    console.error('[IS DT Ref] Upsert error:', upsertError.message);
    return NextResponse.json({ success: false, error: upsertError.message });
  }

  const summary = {
    success: true,
    env,
    basicPrice: newValue.basic?.price ?? null,
    premiumPrice: newValue.premium?.price ?? null,
    changed: newValue.changed,
    changes: newValue.changes,
    timestamp: newValue.updatedAt,
  };

  console.log('[IS DT Ref]', newValue.changed ? '🔄 Prices changed:' : '✅ No change:', JSON.stringify(summary));

  return NextResponse.json(summary);
}
