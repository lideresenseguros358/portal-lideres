/**
 * Prueba la función actionGetPendingItems
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

async function testPending() {
  console.log('\n🧪 PROBANDO PENDING ITEMS\n');

  // 1. pending_items
  const { data: pendingData } = await supabase
    .from('pending_items')
    .select('*', { count: 'exact' })
    .eq('status', 'open');

  console.log(`📋 pending_items (status=open): ${pendingData?.length || 0}`);

  // 2. comm_items sin broker
  const { data: commData } = await supabase
    .from('comm_items')
    .select('*', { count: 'exact' })
    .is('broker_id', null);

  console.log(`💰 comm_items (broker_id=null): ${commData?.length || 0}\n`);

  if (commData && commData.length > 0) {
    console.log('Primeras 5 comm_items sin broker:\n');
    commData.slice(0, 5).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.policy_number} | ${item.insured_name}`);
      console.log(`   Monto: $${parseFloat(item.gross_amount).toFixed(2)}`);
      console.log(`   Creado: ${item.created_at}\n`);
    });
  }

  const total = (pendingData?.length || 0) + (commData?.length || 0);
  console.log(`\n✅ Total pendientes que debería mostrar la UI: ${total}`);
}

testPending().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
