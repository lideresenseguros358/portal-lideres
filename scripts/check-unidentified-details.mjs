/**
 * Verifica detalles de comisiones sin identificar
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
  console.log('\n🔍 VERIFICANDO COMISIONES SIN IDENTIFICAR\n');

  // Buscar import más reciente
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
  console.log(`📦 Import: ${importData.id}\n`);

  // Buscar comisiones específicas que deberían estar sin broker
  const testPolicies = [
    '1-30-678088',
    '14B30686',
    '02G29275',
    '03G14371',
    '15G5718'
  ];

  console.log('🔎 Verificando 5 pólizas que deberían estar sin broker:\n');

  for (const policyNum of testPolicies) {
    const { data: item } = await supabase
      .from('comm_items')
      .select('*, brokers(name, email), policies(broker_id)')
      .eq('import_id', importData.id)
      .eq('policy_number', policyNum)
      .single();

    if (item) {
      console.log(`  Póliza: ${policyNum}`);
      console.log(`    Cliente: ${item.insured_name}`);
      console.log(`    broker_id en comm_items: ${item.broker_id || 'NULL'}`);
      console.log(`    broker_id en policy: ${item.policies?.broker_id || 'N/A'}`);
      console.log(`    Broker asignado: ${item.brokers?.email || 'NULL'}`);
      console.log(`    Email CSV: ${item.raw_row?.broker_email || 'N/A'}\n`);
    } else {
      console.log(`  ❌ No encontrada: ${policyNum}\n`);
    }
  }

  // Contar total sin broker_id
  const { data: allItems, count } = await supabase
    .from('comm_items')
    .select('*', { count: 'exact' })
    .eq('import_id', importData.id)
    .is('broker_id', null);

  console.log(`\n📊 Total comm_items sin broker_id: ${count || 0}`);

  // Ver si alguna tiene broker en la policy
  if (allItems && allItems.length > 0) {
    console.log(`\nPrimeras 5:\n`);
    for (const item of allItems.slice(0, 5)) {
      const { data: policy } = await supabase
        .from('policies')
        .select('broker_id')
        .eq('policy_number', item.policy_number)
        .single();

      console.log(`  ${item.policy_number}: policy.broker_id = ${policy?.broker_id || 'NULL'}`);
    }
  }
}

check().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
