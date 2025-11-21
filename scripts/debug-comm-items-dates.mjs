/**
 * Debug de fechas en comm_items
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function debug() {
  console.log('\n🔍 DEBUG DE FECHAS EN COMM_ITEMS\n');

  // 1. Obtener quincena
  const { data: fortnight } = await supabase
    .from('fortnights')
    .select('id, period_start, period_end')
    .eq('status', 'PAID')
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  console.log(`📅 Quincena:`);
  console.log(`   ID: ${fortnight.id}`);
  console.log(`   Start: ${fortnight.period_start}`);
  console.log(`   End: ${fortnight.period_end}\n`);

  // 2. Ver fechas de comm_items recientes
  const { data: items } = await supabase
    .from('comm_items')
    .select('id, policy_number, created_at, broker_id')
    .not('broker_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📦 Últimos 10 comm_items:\n`);
  items?.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.policy_number}`);
    console.log(`   created_at: ${item.created_at}`);
    console.log(`   broker_id: ${item.broker_id}\n`);
  });

  // 3. Contar items en el rango
  const { count: countExact } = await supabase
    .from('comm_items')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${fortnight.period_start}T00:00:00`)
    .lte('created_at', `${fortnight.period_end}T23:59:59`)
    .not('broker_id', 'is', null);

  console.log(`\n📊 Comm_items en rango con hora:`);
  console.log(`   ${fortnight.period_start}T00:00:00`);
  console.log(`   ${fortnight.period_end}T23:59:59`);
  console.log(`   Count: ${countExact || 0}\n`);

  // 4. Intentar con fechas más amplias
  const monthStart = `2025-11-01T00:00:00`;
  const monthEnd = `2025-11-30T23:59:59`;
  
  const { count: countMonth } = await supabase
    .from('comm_items')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)
    .not('broker_id', 'is', null);

  console.log(`📊 Comm_items en todo noviembre:`);
  console.log(`   ${monthStart} → ${monthEnd}`);
  console.log(`   Count: ${countMonth || 0}\n`);

  // 5. Ver importación asociada
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('id, period_label, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (imports && imports.length > 0) {
    const imp = imports[0];
    console.log(`📥 Última importación:`);
    console.log(`   ID: ${imp.id}`);
    console.log(`   Period Label: ${imp.period_label}`);
    console.log(`   Created: ${imp.created_at}\n`);

    // Ver items de esta importación
    const { count: impCount } = await supabase
      .from('comm_items')
      .select('id', { count: 'exact', head: true })
      .eq('import_id', imp.id)
      .not('broker_id', 'is', null);

    console.log(`   Items con broker: ${impCount || 0}`);
  }
}

debug().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
