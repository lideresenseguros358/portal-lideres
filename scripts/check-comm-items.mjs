/**
 * Verifica las comm_items para debug
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
  console.log('\n🔍 VERIFICANDO COMM_ITEMS\n');

  // 1. Buscar import
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!imports || imports.length === 0) {
    console.log('❌ No se encontró import');
    return;
  }

  const importData = imports[0];
  console.log(`📦 Import ID: ${importData.id}`);
  console.log(`   Fortnight: ${importData.period_label}`);
  console.log(`   Created: ${importData.created_at}\n`);

  // 2. Ver comm_items
  const { data: items, count } = await supabase
    .from('comm_items')
    .select('*', { count: 'exact' })
    .eq('import_id', importData.id);

  console.log(`💰 Total comm_items: ${count}\n`);

  // 3. Sin broker
  const withoutBroker = items?.filter(i => !i.broker_id) || [];
  console.log(`⚠️  Sin broker_id: ${withoutBroker.length}\n`);

  if (withoutBroker.length > 0) {
    console.log('Primeras 5 sin broker:\n');
    withoutBroker.slice(0, 5).forEach(i => {
      console.log(`- ${i.policy_number} | ${i.insured_name}`);
      console.log(`  Monto: $${parseFloat(i.gross_amount).toFixed(2)}`);
      console.log(`  broker_id: ${i.broker_id}`);
      console.log(`  Email CSV: ${i.raw_row?.broker_email || 'N/A'}\n`);
    });
  }

  // 4. Ver si tienen created_at
  const itemsWithoutCreatedAt = items?.filter(i => !i.created_at) || [];
  console.log(`⚠️  Sin created_at: ${itemsWithoutCreatedAt.length}\n`);

  // 5. Ver range de fechas
  if (items && items.length > 0) {
    const dates = items
      .map(i => i.created_at)
      .filter(d => d)
      .sort();
    
    console.log(`📅 Rango de fechas created_at:`);
    console.log(`   Primera: ${dates[0]}`);
    console.log(`   Última: ${dates[dates.length - 1]}\n`);
  }

  // 6. Verificar fortnight_broker_totals
  console.log(`\n👥 Verificando fortnight_broker_totals...\n`);
  const { data: totals } = await supabase
    .from('fortnight_broker_totals')
    .select('*, brokers(name, email)')
    .eq('fortnight_id', importData.period_label)
    .order('net_amount', { ascending: false })
    .limit(10);

  console.log(`Total brokers: ${totals?.length || 0}\n`);
  
  totals?.forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.brokers?.email}`);
    console.log(`   Bruto: $${parseFloat(t.gross_amount).toFixed(2)} | Neto: $${parseFloat(t.net_amount).toFixed(2)}\n`);
  });

  // 7. Verificar la query que usa la UI
  console.log(`\n🔍 Simulando query de la UI...\n`);
  
  const startDate = new Date(2025, 10, 1).toISOString(); // Nov = mes 10 (0-indexed)
  const endDate = new Date(2025, 11, 0, 23, 59, 59).toISOString();

  console.log(`   startDate: ${startDate}`);
  console.log(`   endDate: ${endDate}\n`);

  const { data: fortnights } = await supabase
    .from('fortnights')
    .select(`
      *,
      fortnight_broker_totals (
        *,
        brokers ( name )
      ),
      comm_imports ( * )
    `)
    .eq('status', 'PAID')
    .gte('period_start', startDate)
    .lte('period_end', endDate)
    .order('period_start', { ascending: false });

  console.log(`   Fortnights encontradas: ${fortnights?.length || 0}\n`);

  if (fortnights && fortnights.length > 0) {
    fortnights.forEach(f => {
      console.log(`   ✅ ${f.id}`);
      console.log(`      ${f.period_start} → ${f.period_end}`);
      console.log(`      Status: ${f.status}`);
      console.log(`      Broker totals: ${f.fortnight_broker_totals?.length || 0}`);
      console.log(`      Imports: ${f.comm_imports?.length || 0}\n`);
    });
  }
}

check().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
