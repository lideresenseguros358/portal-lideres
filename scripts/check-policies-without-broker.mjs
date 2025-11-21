/**
 * Verifica pólizas creadas sin broker
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
  console.log('\n🔍 VERIFICANDO PÓLIZAS Y COMISIONES SIN BROKER\n');

  // 1. Pólizas creadas recientemente sin broker
  const { data: policies, count: policiesCount } = await supabase
    .from('policies')
    .select('policy_number, created_at', { count: 'exact' })
    .is('broker_id', null)
    .gte('created_at', '2025-11-21T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📋 Pólizas sin broker (creadas hoy): ${policiesCount || 0}\n`);
  
  if (policies && policies.length > 0) {
    console.log('Primeras 10:\n');
    policies.forEach(p => {
      console.log(`  - ${p.policy_number} (${p.created_at})`);
    });
  }

  // 2. Comisiones de la última importación
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!imports) {
    console.log('\n❌ No se encontró import');
    return;
  }

  console.log(`\n\n📦 Último import: ${imports.id}\n`);

  // 3. Ver si hay comm_items vinculadas a pólizas sin broker
  const { data: itemsWithNullBroker, count: nullCount } = await supabase
    .from('comm_items')
    .select(`
      policy_number,
      insured_name,
      gross_amount,
      broker_id,
      raw_row
    `, { count: 'exact' })
    .eq('import_id', imports.id)
    .is('broker_id', null);

  console.log(`💰 Comm_items sin broker_id: ${nullCount || 0}\n`);

  if (itemsWithNullBroker && itemsWithNullBroker.length > 0) {
    console.log('Todas las comisiones sin broker:\n');
    itemsWithNullBroker.forEach(item => {
      console.log(`  - ${item.policy_number} | ${item.insured_name}`);
      console.log(`    Monto: $${parseFloat(item.gross_amount).toFixed(2)}`);
      console.log(`    Email CSV: "${item.raw_row?.broker_email || ''}"\n`);
    });
  }

  // 4. Ver pólizas que tienen broker pero el email del CSV estaba vacío
  console.log(`\n🔍 Buscando comisiones donde el CSV no tenía email pero SÍ tienen broker asignado...\n`);
  
  const { data: itemsWithBrokerButNoEmail } = await supabase
    .from('comm_items')
    .select(`
      policy_number,
      insured_name,
      broker_id,
      raw_row,
      brokers(email, name)
    `)
    .eq('import_id', imports.id)
    .not('broker_id', 'is', null)
    .limit(692);

  let foundWithEmptyEmail = 0;
  
  itemsWithBrokerButNoEmail?.forEach(item => {
    const csvEmail = item.raw_row?.broker_email || '';
    if (!csvEmail || csvEmail.trim() === '') {
      foundWithEmptyEmail++;
      if (foundWithEmptyEmail <= 10) {
        console.log(`  ${foundWithEmptyEmail}. ${item.policy_number}`);
        console.log(`     CSV email: "${csvEmail}"`);
        console.log(`     Broker asignado: ${item.brokers?.email}\n`);
      }
    }
  });

  console.log(`\n📊 Total con broker asignado pero CSV sin email: ${foundWithEmptyEmail}`);
}

check().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
