#!/usr/bin/env node
/**
 * Script para verificar totales de comisiones y diagnóstico completo
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXPECTED_TOTAL = 10681.22;

async function verifyTotals() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DE COMISIONES\n');
  console.log('='.repeat(70));

  try {
    // 1. Verificar comm_imports
    console.log('\n📊 1. REPORTES DE ASEGURADORAS (comm_imports)');
    console.log('-'.repeat(70));
    
    const { data: imports, error: importsError } = await supabase
      .from('comm_imports')
      .select('total_amount, insurers(name), period_label')
      .order('total_amount', { ascending: false });

    if (importsError) {
      console.error('❌ Error:', importsError);
      return;
    }

    if (!imports || imports.length === 0) {
      console.log('⚠️  NO HAY REPORTES EN comm_imports');
      console.log('   Ejecuta: node scripts/update-insurer-reports.mjs\n');
      return;
    }

    let totalReported = 0;
    imports.forEach(imp => {
      totalReported += imp.total_amount || 0;
      console.log(`   ${(imp.insurers?.name || 'Desconocido').padEnd(20)} ${(imp.total_amount || 0).toFixed(2).padStart(12)}`);
    });

    console.log('-'.repeat(70));
    console.log(`   ${'TOTAL REPORTADO'.padEnd(20)} ${totalReported.toFixed(2).padStart(12)}`);
    console.log(`   ${'ESPERADO'.padEnd(20)} ${EXPECTED_TOTAL.toFixed(2).padStart(12)}`);
    
    if (Math.abs(totalReported - EXPECTED_TOTAL) < 0.01) {
      console.log('   ✅ Total correcto!\n');
    } else {
      console.log(`   ⚠️  Diferencia: ${(totalReported - EXPECTED_TOTAL).toFixed(2)}\n`);
    }

    // 2. Verificar broker LISSA
    console.log('\n👤 2. BROKER DE OFICINA (LISSA)');
    console.log('-'.repeat(70));
    
    const { data: lissa, error: lissaError } = await supabase
      .from('brokers')
      .select('id, name, email')
      .eq('email', 'contacto@lideresenseguros.com')
      .maybeSingle();

    if (lissaError || !lissa) {
      console.log('   ❌ Broker LISSA no encontrado');
      console.log('   Email esperado: contacto@lideresenseguros.com\n');
    } else {
      console.log(`   ✅ Encontrado: ${lissa.name}`);
      console.log(`   ID: ${lissa.id}`);
      console.log(`   Email: ${lissa.email}\n`);

      // 3. Comisiones de LISSA
      console.log('\n💰 3. COMISIONES DE LISSA');
      console.log('-'.repeat(70));
      
      const { data: lissaTotals, error: totalsError } = await supabase
        .from('fortnight_broker_totals')
        .select(`
          net_amount,
          gross_amount,
          fortnights(period_start, period_end, status)
        `)
        .eq('broker_id', lissa.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (totalsError || !lissaTotals || lissaTotals.length === 0) {
        console.log('   ⚠️  No hay comisiones registradas para LISSA');
      } else {
        lissaTotals.forEach(lt => {
          const fortnight = lt.fortnights;
          if (fortnight) {
            const start = new Date(fortnight.period_start).toLocaleDateString('es-PA');
            const end = new Date(fortnight.period_end).toLocaleDateString('es-PA');
            console.log(`   ${start} - ${end}`);
            console.log(`   Bruto: $${(lt.gross_amount || 0).toFixed(2).padStart(10)}  |  Neto: $${(lt.net_amount || 0).toFixed(2).padStart(10)}`);
            console.log(`   Estado: ${fortnight.status}`);
            console.log('');
          }
        });
      }
    }

    // 4. Quincenas cerradas
    console.log('\n📅 4. QUINCENAS CERRADAS');
    console.log('-'.repeat(70));
    
    const { data: fortnights, error: fortnightsError } = await supabase
      .from('fortnights')
      .select(`
        id,
        period_start,
        period_end,
        status,
        fortnight_broker_totals(count)
      `)
      .eq('status', 'PAID')
      .order('period_end', { ascending: false })
      .limit(3);

    if (fortnightsError || !fortnights || fortnights.length === 0) {
      console.log('   ⚠️  No hay quincenas cerradas');
    } else {
      fortnights.forEach(f => {
        const start = new Date(f.period_start).toLocaleDateString('es-PA');
        const end = new Date(f.period_end).toLocaleDateString('es-PA');
        const brokersCount = f.fortnight_broker_totals?.[0]?.count || 0;
        console.log(`   ${start} - ${end}`);
        console.log(`   Brokers: ${brokersCount}  |  Estado: ${f.status}`);
        console.log('');
      });
    }

    // 5. Totales por broker (últimos 5)
    console.log('\n👥 5. TOP BROKERS POR COMISIÓN NETA');
    console.log('-'.repeat(70));
    
    const { data: topBrokers, error: brokersError } = await supabase
      .from('fortnight_broker_totals')
      .select(`
        net_amount,
        gross_amount,
        brokers(name, email)
      `)
      .order('net_amount', { ascending: false })
      .limit(10);

    if (brokersError || !topBrokers || topBrokers.length === 0) {
      console.log('   ⚠️  No hay datos de brokers');
    } else {
      topBrokers.forEach(bt => {
        const broker = bt.brokers;
        if (broker) {
          const isLissa = broker.email === 'contacto@lideresenseguros.com' ? ' (OFICINA)' : '';
          console.log(`   ${(broker.name + isLissa).padEnd(30)} Neto: $${(bt.net_amount || 0).toFixed(2).padStart(10)}`);
        }
      });
      console.log('');
    }

    // 6. Cálculo esperado
    console.log('\n🎯 6. CÁLCULO ESPERADO DE GANANCIA OFICINA');
    console.log('-'.repeat(70));
    
    if (lissa && topBrokers) {
      const lissaTotal = topBrokers
        .filter(bt => bt.brokers?.email === 'contacto@lideresenseguros.com')
        .reduce((sum, bt) => sum + (bt.net_amount || 0), 0);
      
      const externalsTotal = topBrokers
        .filter(bt => bt.brokers?.email !== 'contacto@lideresenseguros.com')
        .reduce((sum, bt) => sum + (bt.net_amount || 0), 0);

      console.log(`   Total Reportado:              $${totalReported.toFixed(2).padStart(12)}`);
      console.log(`   - Pagado a Externos:          $${externalsTotal.toFixed(2).padStart(12)}`);
      console.log('   ' + '-'.repeat(45));
      console.log(`   = Ganancia Oficina:           $${(totalReported - externalsTotal).toFixed(2).padStart(12)}`);
      console.log('');
      console.log(`   Incluye:`);
      console.log(`     • Comisiones LISSA:         $${lissaTotal.toFixed(2).padStart(12)}`);
      console.log(`     • Huérfanos + Diferencia:   $${(totalReported - externalsTotal - lissaTotal).toFixed(2).padStart(12)}`);
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('✅ Diagnóstico completado\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

verifyTotals()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
