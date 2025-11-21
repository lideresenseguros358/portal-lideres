#!/usr/bin/env node
/**
 * Script para actualizar los reportes de aseguradoras en comm_imports
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

// Montos reales de reportes por aseguradora
const INSURER_REPORTS = {
  'ASSA': 4108.37,
  'SURA': 1244.54,
  'VIVIR': 424.53,
  'INTERNACIONAL': 1043.01,
  'FEDPA': 1754.25,
  'ANCON': 1295.97,
  'BANESCO': 36.65,
  'REGIONAL': 511.92,
  'OPTIMA': 172.59,
  'ACERTA': 89.39,
};

async function updateInsurerReports() {
  console.log('📊 ACTUALIZANDO REPORTES DE ASEGURADORAS EN BD\n');
  console.log('='.repeat(60));

  try {
    // 1. Obtener todas las aseguradoras
    const { data: insurers, error: insurersError } = await supabase
      .from('insurers')
      .select('id, name');

    if (insurersError) throw insurersError;

    console.log(`\n✅ Encontradas ${insurers.length} aseguradoras en BD\n`);

    // 2. Mapear nombres a IDs
    const insurerMap = new Map();
    insurers.forEach(ins => {
      insurerMap.set(ins.name.toUpperCase(), ins.id);
    });

    // 3. Obtener la última quincena cerrada
    const { data: lastFortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('id, period_start, period_end')
      .eq('status', 'PAID')
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (fortnightError) {
      console.log('⚠️  No se encontró quincena cerrada, creando registros genéricos...');
    }

    const fortnightLabel = lastFortnight 
      ? `${new Date(lastFortnight.period_start).toLocaleDateString('es-PA')} - ${new Date(lastFortnight.period_end).toLocaleDateString('es-PA')}`
      : 'Noviembre 2024';

    console.log(`📅 Período: ${fortnightLabel}\n`);

    // 4. Actualizar o insertar reportes
    let updated = 0;
    let inserted = 0;
    let notFound = 0;

    for (const [insurerName, amount] of Object.entries(INSURER_REPORTS)) {
      const insurerId = insurerMap.get(insurerName);

      if (!insurerId) {
        console.log(`❌ ${insurerName.padEnd(20)} - No encontrada en BD`);
        notFound++;
        continue;
      }

      // Verificar si ya existe un reporte para esta aseguradora
      const { data: existing } = await supabase
        .from('comm_imports')
        .select('id, total_amount')
        .eq('insurer_id', insurerId)
        .eq('period_label', fortnightLabel)
        .maybeSingle();

      if (existing) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('comm_imports')
          .update({ 
            total_amount: amount,
            is_life_insurance: insurerName.includes('VIVIR')
          })
          .eq('id', existing.id);

        if (updateError) {
          console.log(`❌ ${insurerName.padEnd(20)} - Error al actualizar: ${updateError.message}`);
        } else {
          console.log(`✅ ${insurerName.padEnd(20)} ${amount.toFixed(2).padStart(12)} (actualizado)`);
          updated++;
        }
      } else {
        // Insertar nuevo
        const { error: insertError } = await supabase
          .from('comm_imports')
          .insert({
            insurer_id: insurerId,
            period_label: fortnightLabel,
            total_amount: amount,
            is_life_insurance: insurerName.includes('VIVIR')
          });

        if (insertError) {
          console.log(`❌ ${insurerName.padEnd(20)} - Error al insertar: ${insertError.message}`);
        } else {
          console.log(`✅ ${insurerName.padEnd(20)} ${amount.toFixed(2).padStart(12)} (nuevo)`);
          inserted++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`✅ Insertados: ${inserted}`);
    if (notFound > 0) {
      console.log(`⚠️  No encontrados: ${notFound}`);
    }
    console.log('='.repeat(60));

    // 5. Calcular total
    const total = Object.values(INSURER_REPORTS).reduce((sum, val) => sum + val, 0);
    console.log(`\n💰 TOTAL REPORTES: $${total.toFixed(2)}`);

    console.log('\n✅ Base de datos actualizada exitosamente\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

updateInsurerReports()
  .then(() => {
    console.log('🎉 Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
