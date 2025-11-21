/**
 * Simula exactamente la query que hace la UI
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

async function testQuery() {
  console.log('\n🧪 SIMULANDO QUERY EXACTA DE LA UI\n');
  
  const year = 2025;
  const month = 11; // Noviembre
  const fortnightNum = 1; // Primera quincena

  // Simular exactamente lo que hace actionGetClosedFortnights
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = new Date(Date.UTC(year, month - 1, lastDay)).toISOString().split('T')[0];

  console.log('📅 Parámetros:');
  console.log(`   year: ${year}`);
  console.log(`   month: ${month}`);
  console.log(`   fortnight: ${fortnightNum}`);
  console.log(`   startDate: "${startDate}"`);
  console.log(`   endDate: "${endDate}"\n`);

  let query = supabase
    .from('fortnights')
    .select(`
      *,
      fortnight_broker_totals (
        *,
        brokers ( name )
      )
    `)
    .eq('status', 'PAID')
    .gte('period_start', startDate)
    .lte('period_end', endDate);

  if (fortnightNum === 1) {
    const q1End = new Date(Date.UTC(year, month - 1, 15)).toISOString().split('T')[0];
    console.log(`   Filtro Q1: period_start <= "${q1End}"\n`);
    query = query.lte('period_start', q1End);
  }

  const { data: fortnights, error } = await query.order('period_start', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Resultado: ${fortnights?.length || 0} quincenas\n`);

  if (fortnights && fortnights.length > 0) {
    fortnights.forEach(f => {
      console.log(`📦 Quincena: ${f.id}`);
      console.log(`   Período: ${f.period_start} → ${f.period_end}`);
      console.log(`   Status: ${f.status}`);
      console.log(`   Broker totals: ${f.fortnight_broker_totals?.length || 0}\n`);
      
      if (f.fortnight_broker_totals && f.fortnight_broker_totals.length > 0) {
        console.log('   Top 5 brokers:');
        f.fortnight_broker_totals
          .slice(0, 5)
          .forEach((bt, idx) => {
            console.log(`     ${idx + 1}. ${bt.brokers?.name || 'N/A'} - $${parseFloat(bt.net_amount).toFixed(2)}`);
          });
        console.log('');
      }
    });
  }

  // Ahora verificar comm_items para calcular totales
  if (fortnights && fortnights.length > 0) {
    const f = fortnights[0];
    console.log('\n🔍 Verificando comm_items para calcular totales...\n');
    
    const { data: commItems } = await supabase
      .from('comm_items')
      .select('gross_amount, insurer_id, insurers(name), created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    console.log(`   Total comm_items en período: ${commItems?.length || 0}`);
    
    if (commItems && commItems.length > 0) {
      const total = commItems.reduce((sum, item) => sum + (parseFloat(item.gross_amount) || 0), 0);
      console.log(`   Total bruto: $${total.toFixed(2)}\n`);
    }
  }
}

testQuery().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
