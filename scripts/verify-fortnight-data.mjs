/**
 * Verifica que los datos de la quincena estén correctos
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

async function verify() {
  console.log('\n🔍 VERIFICANDO DATOS DE QUINCENA NOV 2025\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Verificar quincena
  console.log('📅 1. Verificando quincena...');
  const { data: fortnight } = await supabase
    .from('fortnights')
    .select('*')
    .eq('period_start', '2025-11-01')
    .eq('period_end', '2025-11-15')
    .single();

  if (!fortnight) {
    console.log('   ❌ No se encontró la quincena\n');
    return;
  }

  console.log(`   ✅ Quincena encontrada:`);
  console.log(`      ID: ${fortnight.id}`);
  console.log(`      Estado: ${fortnight.status}`);
  console.log(`      Período: ${fortnight.period_start} a ${fortnight.period_end}\n`);

  // 2. Verificar importación
  console.log('📦 2. Verificando importación...');
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('*')
    .eq('period_label', fortnight.id);

  console.log(`   ✅ ${imports?.length || 0} importaciones encontradas\n`);

  // 3. Verificar comisiones
  console.log('💰 3. Verificando comisiones...');
  const { data: commItems } = await supabase
    .from('comm_items')
    .select('*, insurers(name), brokers(name, email)')
    .in('import_id', imports?.map(i => i.id) || []);

  console.log(`   ✅ Total comisiones: ${commItems?.length || 0}`);

  // Separar por fuente
  const csvComms = commItems?.filter(c => !c.raw_row?.source || c.raw_row.source !== 'assa_code_bulk') || [];
  const assaComms = commItems?.filter(c => c.raw_row?.source === 'assa_code_bulk') || [];

  console.log(`      - Del CSV: ${csvComms.length}`);
  console.log(`      - Códigos ASSA: ${assaComms.length}\n`);

  // 4. Totales por fuente
  const csvTotal = csvComms.reduce((sum, c) => sum + (parseFloat(c.gross_amount) || 0), 0);
  const assaTotal = assaComms.reduce((sum, c) => sum + (parseFloat(c.gross_amount) || 0), 0);
  const grandTotal = csvTotal + assaTotal;

  console.log('💵 4. Totales brutos:');
  console.log(`      CSV:          $${csvTotal.toFixed(2)}`);
  console.log(`      Códigos ASSA: $${assaTotal.toFixed(2)}`);
  console.log(`      ─────────────────────────`);
  console.log(`      TOTAL:        $${grandTotal.toFixed(2)}\n`);

  // 5. Verificar totales por broker
  console.log('👥 5. Verificando totales por broker...');
  const { data: brokerTotals } = await supabase
    .from('fortnight_broker_totals')
    .select('*, brokers(name, email)')
    .eq('fortnight_id', fortnight.id)
    .order('net_amount', { ascending: false });

  console.log(`   ✅ ${brokerTotals?.length || 0} brokers con comisiones\n`);

  console.log('   TOP 10 BROKERS POR NETO:\n');
  brokerTotals?.slice(0, 10).forEach((bt, idx) => {
    console.log(`   ${idx + 1}. ${bt.brokers?.email}`);
    console.log(`      Nombre: ${bt.brokers?.name}`);
    console.log(`      Bruto: $${parseFloat(bt.gross_amount).toFixed(2)} | Neto: $${parseFloat(bt.net_amount).toFixed(2)}\n`);
  });

  // 6. Verificar aseguradoras
  console.log('🏢 6. Comisiones por aseguradora:\n');
  const byInsurer = commItems?.reduce((acc, c) => {
    const insurer = c.insurers?.name || 'Desconocido';
    if (!acc[insurer]) acc[insurer] = { count: 0, total: 0 };
    acc[insurer].count++;
    acc[insurer].total += parseFloat(c.gross_amount) || 0;
    return acc;
  }, {});

  Object.entries(byInsurer || {})
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .forEach(([name, data]) => {
      console.log(`   ${name}:`);
      console.log(`      ${data.count} comisiones | Total: $${data.total.toFixed(2)}\n`);
    });

  // 7. Verificar comisiones sin broker (sin identificar)
  console.log('⚠️  7. Comisiones sin identificar:\n');
  const unidentified = commItems?.filter(c => !c.broker_id) || [];
  console.log(`   Total: ${unidentified.length} comisiones\n`);

  if (unidentified.length > 0) {
    console.log('   Primeras 5:\n');
    unidentified.slice(0, 5).forEach(c => {
      console.log(`   - ${c.policy_number} | ${c.insured_name}`);
      console.log(`     Monto: $${parseFloat(c.gross_amount).toFixed(2)}\n`);
    });
  }

  // 8. Verificar VIDA en ASSA con 100%
  console.log('🔥 8. Verificando regla VIDA en ASSA (100%):\n');
  const vidaAssa = csvComms.filter(c => 
    c.raw_row?.insurer_name === 'ASSA' && 
    c.raw_row?.policy_type === 'VIDA' &&
    c.raw_row?.is_vida_assa === true
  );

  console.log(`   ✅ ${vidaAssa.length} pólizas VIDA en ASSA encontradas`);
  
  if (vidaAssa.length > 0) {
    const sample = vidaAssa[0];
    console.log(`\n   Ejemplo:`);
    console.log(`      Póliza: ${sample.policy_number}`);
    console.log(`      Cliente: ${sample.insured_name}`);
    console.log(`      Bruto: $${parseFloat(sample.gross_amount).toFixed(2)}`);
    console.log(`      Porcentaje: ${(parseFloat(sample.raw_row.percentage_applied) * 100).toFixed(0)}%`);
    console.log(`      Neto: $${parseFloat(sample.raw_row.net_amount).toFixed(2)}\n`);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ VERIFICACIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════════\n');
}

verify().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
