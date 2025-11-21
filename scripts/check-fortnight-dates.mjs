/**
 * Verifica fechas de la quincena y la query de la UI
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function check() {
  console.log('\n🔍 VERIFICANDO FECHAS DE QUINCENA Y QUERY DE UI\n');

  // 1. Ver la quincena
  const { data: fortnight } = await supabase
    .from('fortnights')
    .select('*')
    .eq('status', 'PAID')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!fortnight) {
    console.log('❌ No se encontró quincena');
    return;
  }

  console.log('📅 Quincena en BD:\n');
  console.log(`   ID: ${fortnight.id}`);
  console.log(`   period_start: "${fortnight.period_start}"`);
  console.log(`   period_end:   "${fortnight.period_end}"`);
  console.log(`   status: ${fortnight.status}\n`);

  // 2. Simular la query correcta (como debe hacer la UI)
  const year = 2025;
  const month = 11; // Noviembre

  // CORRECTO: Usar Date.UTC y solo fecha sin hora
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = new Date(Date.UTC(year, month - 1, lastDay)).toISOString().split('T')[0];

  console.log('🔍 Query correcta (como en actionGetClosedFortnights):\n');
  console.log(`   startDate: "${startDate}"`);
  console.log(`   endDate:   "${endDate}"\n`);

  const { data: found1 } = await supabase
    .from('fortnights')
    .select('id, period_start, period_end')
    .eq('status', 'PAID')
    .gte('period_start', startDate)
    .lte('period_end', endDate);

  console.log(`   Resultado: ${found1?.length || 0} quincenas encontradas\n`);

  if (found1 && found1.length > 0) {
    found1.forEach(f => {
      console.log(`   ✅ ${f.id}`);
      console.log(`      ${f.period_start} a ${f.period_end}\n`);
    });
  }

  // 3. Ver si la query con hora encuentra algo (incorrecta)
  const startDateWithTime = new Date(year, month - 1, 1).toISOString();
  const endDateWithTime = new Date(year, month, 0, 23, 59, 59).toISOString();

  console.log('❌ Query incorrecta (con hora local):\n');
  console.log(`   startDate: "${startDateWithTime}"`);
  console.log(`   endDate:   "${endDateWithTime}"\n`);

  const { data: found2 } = await supabase
    .from('fortnights')
    .select('id')
    .eq('status', 'PAID')
    .gte('period_start', startDateWithTime)
    .lte('period_end', endDateWithTime);

  console.log(`   Resultado: ${found2?.length || 0} quincenas encontradas\n`);

  // 4. Comparación
  console.log('💡 CONCLUSIÓN:\n');
  if (found1 && found1.length > 0) {
    console.log('   ✅ La query correcta (solo fecha) SÍ funciona');
    console.log('   ✅ La corrección en actionGetClosedFortnights está bien\n');
  } else {
    console.log('   ❌ Algo está mal con las fechas\n');
  }
}

check().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
