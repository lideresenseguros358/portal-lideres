#!/usr/bin/env node
/**
 * BULK IMPORT COMPLETO Y CORRECTO
 * - Plantilla comisiones
 * - Códigos ASSA huérfanos
 * - Reportes por aseguradora
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalizar texto: quitar acentos y ñ
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N');
}

async function limpiarDatos() {
  console.log('\n🗑️  LIMPIANDO DATOS EXISTENTES...\n');
  
  await supabase.from('fortnight_broker_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_item_claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pending_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('fortnights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('✅ Datos limpiados\n');
}

async function getCatalogos() {
  const { data: insurers } = await supabase.from('insurers').select('id, name');
  const insurerMap = new Map();
  (insurers || []).forEach(ins => {
    insurerMap.set(normalizar(ins.name).toUpperCase(), ins.id);
    insurerMap.set(ins.name.toUpperCase(), ins.id);
  });
  
  const { data: brokers } = await supabase.from('brokers').select('id, email, name, assa_code');
  const brokerMap = new Map();
  const brokerByAssaCode = new Map();
  let lissaBrokerId = null;
  
  (brokers || []).forEach(b => {
    if (b.email) {
      brokerMap.set(b.email.toLowerCase().trim(), b.id);
      // Identificar LISSA
      if (b.email.toLowerCase().trim() === 'contacto@lideresenseguros.com') {
        lissaBrokerId = b.id;
      }
    }
    if (b.assa_code) {
      brokerByAssaCode.set(b.assa_code.trim(), b.id);
    }
  });
  
  console.log(`✅ ${insurerMap.size} aseguradoras, ${brokerMap.size} brokers`);
  console.log(`✅ LISSA broker ID: ${lissaBrokerId}\n`);
  console.log('Aseguradoras disponibles:', Array.from(new Set(insurers?.map(i => i.name))).slice(0, 10));
  
  return { insurerMap, brokerMap, brokerByAssaCode, lissaBrokerId };
}

async function importarReportes(insurerMap) {
  console.log('\n📊 IMPORTANDO REPORTES DE ASEGURADORAS...\n');
  
  const csvPath = path.join(process.cwd(), 'public', 'total_reportes_por_aseguradora.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return;
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    trim: true
  });
  
  let imported = 0;
  
  for (const record of records) {
    const insurerNameOriginal = (record[0] || '').trim();
    const insurerName = insurerNameOriginal.toUpperCase();
    const amount = parseFloat(record[1] || 0);
    
    if (!insurerName || !amount) continue;
    
    // Intentar con ambos: normalizado y sin normalizar
    let insurerId = insurerMap.get(insurerName);
    if (!insurerId) {
      insurerId = insurerMap.get(normalizar(insurerName));
    }
    
    if (!insurerId) {
      console.log(`⚠️  Aseguradora no encontrada: '${insurerName}' (original: '${insurerNameOriginal}')`);
      console.log('   Disponibles:', Array.from(insurerMap.keys()).slice(0, 5));
      continue;
    }
    
    const { error } = await supabase
      .from('comm_imports')
      .insert({
        insurer_id: insurerId,
        period_label: 'Q1 - Nov. 2025',
        total_amount: amount
      });
    
    if (error) {
      console.error(`❌ Error: ${insurerName}`, error.message);
    } else {
      console.log(`✅ ${insurerName.padEnd(20)} $${amount.toFixed(2)}`);
      imported++;
    }
  }
  
  console.log(`\n✅ Reportes importados: ${imported}/${records.length}\n`);
}

async function importarComisiones(insurerMap, brokerMap) {
  console.log('\n💰 IMPORTANDO COMISIONES DE PÓLIZAS...\n');
  
  const csvPath = path.join(process.cwd(), 'public', 'plantilla_comisiones_quincena.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return;
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    quote: '"',           // Maneja comillas para nombres con comas
    escape: '"'
  });
  
  console.log(`📄 Total registros: ${records.length}\n`);
  
  // Crear import genérico
  const { data: importRecord, error: importError } = await supabase
    .from('comm_imports')
    .insert({
      insurer_id: Array.from(insurerMap.values())[0],
      period_label: 'Bulk Import - Q1 Nov 2025',
      total_amount: 0
    })
    .select()
    .single();
  
  if (importError) {
    console.error('❌ Error creando import:', importError);
    return;
  }
  
  let withBroker = 0;
  let pending = 0;
  let errors = 0;
  
  for (const record of records) {
    try {
      const policyNumber = (record.policy_number || '').trim();
      const clientName = normalizar(record.client_name || '');
      const insurerNameOriginal = (record.insurer_name || '').trim();
      const insurerName = insurerNameOriginal.toUpperCase();
      const brokerEmail = (record.broker_email || '').toLowerCase().trim();
      const amount = parseFloat(record.commission_amount || 0);
      
      if (!policyNumber || !amount) {
        errors++;
        continue;
      }
      
      // Intentar match de aseguradora
      let insurerId = insurerMap.get(insurerName);
      if (!insurerId) {
        insurerId = insurerMap.get(normalizar(insurerName));
      }
      
      if (!insurerId) {
        console.log(`⚠️  Aseguradora no encontrada: '${insurerName}' para póliza ${policyNumber}`);
        errors++;
        continue;
      }
      
      const brokerId = brokerEmail ? brokerMap.get(brokerEmail) : null;
      
      if (brokerId) {
        // Con broker → comm_items
        const { error } = await supabase
          .from('comm_items')
          .insert({
            import_id: importRecord.id,
            broker_id: brokerId,
            policy_number: policyNumber,
            insured_name: clientName,
            insurer_id: insurerId,
            gross_amount: amount
          });
        
        if (error) {
          console.error(`❌ comm_items: ${policyNumber}`, error.message);
          errors++;
        } else {
          withBroker++;
          if (withBroker % 100 === 0) {
            console.log(`✅ Con broker: ${withBroker}...`);
          }
        }
      } else {
        // Sin broker → pending_items
        const { error } = await supabase
          .from('pending_items')
          .insert({
            import_id: importRecord.id,
            policy_number: policyNumber,
            insured_name: clientName,
            insurer_id: insurerId,
            commission_raw: amount,
            status: 'open'
          });
        
        if (error) {
          console.error(`❌ pending: ${policyNumber}`, error.message);
          errors++;
        } else {
          pending++;
          if (pending % 20 === 0) {
            console.log(`⏳ Pendientes: ${pending}...`);
          }
        }
      }
    } catch (err) {
      errors++;
    }
  }
  
  console.log(`\n✅ Con broker: ${withBroker}`);
  console.log(`⏳ Pendientes: ${pending}`);
  console.log(`❌ Errores: ${errors}\n`);
}

async function importarCodigosASSA(insurerMap, brokerByAssaCode, lissaBrokerId) {
  console.log('\n🔢 IMPORTANDO CÓDIGOS ASSA A SUS BROKERS...\n');
  
  const csvPath = path.join(process.cwd(), 'public', 'plantilla_codigos_assa.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return;
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });
  
  // Códigos a excluir
  const codigosExcluir = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];
  
  console.log(`📄 Total códigos en CSV: ${records.length}`);
  console.log(`🚫 Códigos a excluir: ${codigosExcluir.join(', ')}\n`);
  
  if (!lissaBrokerId) {
    console.error('❌ No se encontró LISSA (contacto@lideresenseguros.com)');
    return;
  }
  
  // Buscar ASSA
  let assaId = insurerMap.get('ASSA');
  if (!assaId) {
    assaId = insurerMap.get(normalizar('ASSA'));
  }
  if (!assaId) {
    for (const [key, id] of insurerMap.entries()) {
      if (key.includes('ASSA')) {
        assaId = id;
        break;
      }
    }
  }
  
  if (!assaId) {
    console.error('❌ No se encontró ASSA en la BD');
    return;
  }
  
  // Crear import para códigos ASSA
  const { data: importRecord, error: importError } = await supabase
    .from('comm_imports')
    .insert({
      insurer_id: assaId,
      period_label: 'Códigos ASSA - Q1 Nov 2025',
      total_amount: 0
    })
    .select()
    .single();
  
  if (importError) {
    console.error('❌ Error creando import:', importError);
    return;
  }
  
  let imported = 0;
  let skipped = 0;
  let huerfanos = 0;
  let errors = 0;
  
  for (const record of records) {
    try {
      const code = (record.assa_code || '').trim();
      const amount = parseFloat(record.commission_amount || 0);
      
      if (!code || !amount) {
        errors++;
        continue;
      }
      
      // Excluir códigos específicos
      if (codigosExcluir.includes(code)) {
        console.log(`🚫 Excluido: ${code}`);
        skipped++;
        continue;
      }
      
      // Buscar broker por código ASSA
      const brokerId = brokerByAssaCode.get(code);
      
      if (brokerId) {
        // Insertar en comm_items con monto al 100%
        const { error } = await supabase
          .from('comm_items')
          .insert({
            import_id: importRecord.id,
            broker_id: brokerId,
            policy_number: code,
            insured_name: `Código ASSA: ${code}`,
            insurer_id: assaId,
            gross_amount: amount  // 100% del monto
          });
        
        if (error) {
          console.error(`❌ ${code}:`, error.message);
          errors++;
        } else {
          imported++;
          if (imported % 10 === 0) {
            console.log(`✅ Códigos asignados: ${imported}...`);
          }
        }
      } else {
        // Sin broker asignado → pending
        const { error } = await supabase
          .from('pending_items')
          .insert({
            import_id: importRecord.id,
            policy_number: code,
            insured_name: `Código ASSA: ${code}`,
            insurer_id: assaId,
            commission_raw: amount,
            status: 'open'
          });
        
        if (error) {
          console.error(`❌ pending ${code}:`, error.message);
          errors++;
        } else {
          huerfanos++;
        }
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Códigos asignados a brokers: ${imported}`);
  console.log(`⏳ Huérfanos (sin broker): ${huerfanos}`);
  console.log(`🚫 Excluidos: ${skipped}`);
  console.log(`❌ Errores: ${errors}\n`);
}

async function crearQuincenaYCalcularTotales() {
  console.log('\n📅 CREANDO QUINCENA Y CALCULANDO TOTALES...\n');
  
  // 1. Crear quincena cerrada (Q1 Nov 2025: 1-15 Nov)
  const { data: fortnight, error: fortnightError } = await supabase
    .from('fortnights')
    .insert({
      period_start: '2025-11-01',
      period_end: '2025-11-15',
      status: 'PAID',
      notify_brokers: false
    })
    .select()
    .single();
  
  if (fortnightError) {
    console.error('❌ Error creando quincena:', fortnightError);
    return null;
  }
  
  console.log(`✅ Quincena creada: ${fortnight.id}`);
  
  // 2. Actualizar todos los comm_imports para usar el fortnight_id
  const { error: updateError } = await supabase
    .from('comm_imports')
    .update({ period_label: fortnight.id })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (updateError) {
    console.error('❌ Error actualizando imports:', updateError);
    return null;
  }
  
  console.log('✅ Imports actualizados con fortnight_id');
  
  // 3. Obtener todos los comm_items con broker y calcular totales
  const { data: items, error: itemsError } = await supabase
    .from('comm_items')
    .select('broker_id, gross_amount')
    .not('broker_id', 'is', null);
  
  if (itemsError) {
    console.error('❌ Error obteniendo items:', itemsError);
    return null;
  }
  
  // 4. Agrupar por broker
  const brokerTotals = {};
  (items || []).forEach(item => {
    const brokerId = item.broker_id;
    if (!brokerTotals[brokerId]) {
      brokerTotals[brokerId] = { gross: 0, count: 0 };
    }
    brokerTotals[brokerId].gross += Number(item.gross_amount) || 0;
    brokerTotals[brokerId].count += 1;
  });
  
  console.log(`\n✅ Calculados totales para ${Object.keys(brokerTotals).length} brokers`);
  
  // 5. Insertar totales
  const totalsToInsert = Object.entries(brokerTotals).map(([brokerId, totals]) => ({
    fortnight_id: fortnight.id,
    broker_id: brokerId,
    gross_amount: totals.gross,
    net_amount: totals.gross,
    discounts_json: { adelantos: [], total: 0 }
  }));
  
  const { error: totalsError } = await supabase
    .from('fortnight_broker_totals')
    .insert(totalsToInsert);
  
  if (totalsError) {
    console.error('❌ Error insertando totales:', totalsError);
    return null;
  }
  
  console.log(`✅ Totales por broker insertados: ${totalsToInsert.length}`);
  console.log('\n📊 Detalle por broker:');
  
  // Mostrar resumen
  for (const [brokerId, totals] of Object.entries(brokerTotals).slice(0, 5)) {
    console.log(`   - ${brokerId.substring(0, 8)}...: $${totals.gross.toFixed(2)} (${totals.count} items)`);
  }
  if (Object.keys(brokerTotals).length > 5) {
    console.log(`   ... y ${Object.keys(brokerTotals).length - 5} brokers más`);
  }
  
  return fortnight;
}

async function main() {
  console.log('🚀 BULK IMPORT COMPLETO\n');
  console.log('='.repeat(60));
  
  try {
    await limpiarDatos();
    
    const { insurerMap, brokerMap, brokerByAssaCode, lissaBrokerId } = await getCatalogos();
    
    await importarReportes(insurerMap);
    await importarComisiones(insurerMap, brokerMap);
    await importarCodigosASSA(insurerMap, brokerByAssaCode, lissaBrokerId);
    
    // CREAR QUINCENA Y CALCULAR TOTALES
    const fortnight = await crearQuincenaYCalcularTotales();
    
    console.log('='.repeat(60));
    console.log('✅ IMPORTACIÓN COMPLETADA\n');
    
    // Verificar
    const { count: commCount } = await supabase.from('comm_items').select('*', { count: 'exact', head: true });
    const { count: pendingCount } = await supabase.from('pending_items').select('*', { count: 'exact', head: true });
    const { count: importsCount } = await supabase.from('comm_imports').select('*', { count: 'exact', head: true });
    const { count: totalsCount } = await supabase.from('fortnight_broker_totals').select('*', { count: 'exact', head: true });
    
    console.log('📊 RESULTADO FINAL:\n');
    console.log(`   comm_items (con broker):    ${commCount || 0}`);
    console.log(`   pending_items (sin broker): ${pendingCount || 0}`);
    console.log(`   comm_imports (reportes):    ${importsCount || 0}`);
    console.log(`   fortnight_broker_totals:    ${totalsCount || 0}`);
    console.log('');
    
    if (fortnight) {
      console.log(`🎉 Quincena Q1 Nov 2025 creada: ${fortnight.id}`);
      console.log(`   Estado: ${fortnight.status}`);
      console.log(`   Período: ${fortnight.period_start} a ${fortnight.period_end}`);
    }
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
