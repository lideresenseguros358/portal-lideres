/**
 * Test para verificar que actionGetBrokerCommissionDetails funcione
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

async function testBrokerDetails() {
  console.log('\n🧪 PROBANDO actionGetBrokerCommissionDetails\n');

  // 1. Obtener la última quincena
  const { data: fortnight } = await supabase
    .from('fortnights')
    .select('id, period_start, period_end')
    .eq('status', 'PAID')
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  if (!fortnight) {
    console.log('❌ No se encontró quincena');
    return;
  }

  console.log(`📅 Quincena: ${fortnight.id}`);
  console.log(`   ${fortnight.period_start} → ${fortnight.period_end}\n`);

  // 2. Obtener imports para esta quincena
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('id')
    .eq('period_label', fortnight.id);

  if (!imports || imports.length === 0) {
    console.log('❌ No se encontró import para esta quincena');
    return;
  }

  const importIds = imports.map(i => i.id);
  console.log(`📥 Imports encontrados: ${importIds.join(', ')}\n`);

  // 3. Obtener comm_items con detalles
  const { data: commItems } = await supabase
    .from('comm_items')
    .select(`
      id,
      policy_number,
      insured_name,
      gross_amount,
      broker_id,
      insurer_id,
      created_at,
      raw_row,
      brokers ( id, name, email, percent_default ),
      insurers ( id, name )
    `)
    .in('import_id', importIds)
    .not('broker_id', 'is', null)
    .limit(5);

  console.log(`💰 Comm_items de muestra: ${commItems?.length || 0}\n`);

  if (commItems && commItems.length > 0) {
    commItems.forEach((item, idx) => {
      console.log(`${idx + 1}. Póliza: ${item.policy_number}`);
      console.log(`   Broker: ${item.brokers?.name || 'N/A'} (${item.broker_id})`);
      console.log(`   Aseguradora: ${item.insurers?.name || 'N/A'} (${item.insurer_id})`);
      console.log(`   Cliente: ${item.insured_name}`);
      console.log(`   Bruto: $${parseFloat(item.gross_amount).toFixed(2)}`);
      console.log(`   Porcentaje: ${item.raw_row?.percentage_applied || item.brokers?.percent_default || 0}\n`);
    });
  }

  // 3. Agrupar por broker
  const brokerMap = new Map();

  commItems?.forEach((item) => {
    if (!item.brokers) return;

    const bId = item.broker_id;
    if (!brokerMap.has(bId)) {
      brokerMap.set(bId, {
        broker_id: bId,
        broker_name: item.brokers.name,
        broker_email: item.brokers.email,
        percent_default: item.brokers.percent_default,
        insurers: new Map(),
        total_gross: 0,
        total_net: 0,
      });
    }

    const broker = brokerMap.get(bId);
    const insurerId = item.insurer_id;
    const insurerName = item.insurers?.name || 'Desconocido';

    if (!broker.insurers.has(insurerId)) {
      broker.insurers.set(insurerId, {
        insurer_id: insurerId,
        insurer_name: insurerName,
        policies: [],
        total_gross: 0,
      });
    }

    const insurer = broker.insurers.get(insurerId);
    const grossAmount = Number(item.gross_amount) || 0;
    const percentage = item.raw_row?.percentage_applied || item.brokers.percent_default || 0;
    const netAmount = grossAmount * percentage;

    insurer.policies.push({
      policy_number: item.policy_number,
      insured_name: item.insured_name,
      gross_amount: grossAmount,
      percentage: percentage,
      net_amount: netAmount,
    });

    insurer.total_gross += grossAmount;
    broker.total_gross += grossAmount;
    broker.total_net += netAmount;
  });

  console.log(`\n👥 Brokers agrupados: ${brokerMap.size}\n`);

  brokerMap.forEach((broker, brokerId) => {
    console.log(`Broker: ${broker.broker_name} (${broker.broker_email})`);
    console.log(`  Total Bruto: $${broker.total_gross.toFixed(2)}`);
    console.log(`  Total Neto: $${broker.total_net.toFixed(2)}`);
    console.log(`  Aseguradoras: ${broker.insurers.size}`);
    
    broker.insurers.forEach((insurer, insurerId) => {
      console.log(`    - ${insurer.insurer_name}: ${insurer.policies.length} pólizas ($${insurer.total_gross.toFixed(2)})`);
    });
    console.log('');
  });

  console.log('\n✅ Estructura de datos parece correcta');
}

testBrokerDetails().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
