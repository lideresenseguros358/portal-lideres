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

// Normalizar texto: quitar acentos, ñ, y convertir guiones en espacios
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/-/g, ' ');              // Guiones → espacios
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
  
  const { data: brokers } = await supabase.from('brokers').select('id, email, name, assa_code, percent_default');
  const brokerMap = new Map();
  const brokerByAssaCode = new Map();
  const brokerPercents = new Map();
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
    // Guardar percent_default
    brokerPercents.set(b.id, b.percent_default || 1.0);
  });
  
  console.log(`✅ ${insurerMap.size} aseguradoras, ${brokerMap.size} brokers`);
  console.log(`✅ LISSA broker ID: ${lissaBrokerId}\n`);
  console.log('Aseguradoras disponibles:', Array.from(new Set(insurers?.map(i => i.name))).slice(0, 10));
  
  return { insurerMap, brokerMap, brokerByAssaCode, brokerPercents, lissaBrokerId };
}

async function importarReportes(insurerMap, fortnightId) {
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
        period_label: fortnightId,
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
  
  // Calcular total de reportes
  let totalReportes = 0;
  for (const record of records) {
    const amount = parseFloat(record[1] || 0);
    if (amount) totalReportes += amount;
  }
  console.log(`💰 Total sum reportes: $${totalReportes.toFixed(2)}\n`);
  
  return totalReportes;
}

async function importarComisiones(insurerMap, brokerMap, brokerPercents) {
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
      const clientNameRaw = (record.client_name || '').trim();
      const clientNameNormalized = normalizar(clientNameRaw).toUpperCase();
      const insurerNameOriginal = (record.insurer_name || '').trim();
      const insurerName = insurerNameOriginal.toUpperCase();
      const brokerEmail = (record.broker_email || '').toLowerCase().trim();
      const policyType = (record.policy_type || '').trim().toUpperCase();
      const commissionRaw = parseFloat(record.commission_amount || 0);
      const startDate = record.start_date || null;
      const renewalDate = record.renewal_date || null;
      
      if (!policyNumber || !commissionRaw) {
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
      
      if (!brokerId) {
        // Sin broker → pending_items
        const { error } = await supabase
          .from('pending_items')
          .insert({
            import_id: importRecord.id,
            policy_number: policyNumber,
            insured_name: clientNameNormalized,
            insurer_id: insurerId,
            commission_raw: commissionRaw,
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
        continue;
      }
      
      // CREAR/ACTUALIZAR CLIENTE (NORMALIZADO)
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientNameNormalized)
        .eq('broker_id', brokerId)
        .single();
      
      let clientId = existingClient?.id;
      
      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: clientNameNormalized,
            broker_id: brokerId
          })
          .select('id')
          .single();
        
        if (!clientError && newClient) {
          clientId = newClient.id;
        }
      } else {
        // Actualizar nombre si tiene caracteres especiales
        if (clientNameRaw !== clientNameNormalized) {
          await supabase
            .from('clients')
            .update({ name: clientNameNormalized })
            .eq('id', clientId);
        }
      }
      
      if (!clientId) {
        console.error(`❌ No se pudo crear/obtener cliente para ${policyNumber}`);
        errors++;
        continue;
      }
      
      // CREAR/ACTUALIZAR PÓLIZA
      const { data: existingPolicy } = await supabase
        .from('policies')
        .select('id, percent_override')
        .eq('policy_number', policyNumber)
        .single();
      
      let policyId = existingPolicy?.id;
      let percentOverride = existingPolicy?.percent_override;
      
      // DETERMINAR PORCENTAJE
      let percentToUse = 1.0;
      
      // Si es VIDA + ASSA → 100%
      if (policyType === 'VIDA' && insurerName === 'ASSA') {
        percentToUse = 1.0;
        percentOverride = 1.0;
      } else if (percentOverride != null) {
        percentToUse = percentOverride;
      } else {
        percentToUse = brokerPercents.get(brokerId) || 1.0;
      }
      
      if (!policyId) {
        // Crear nueva póliza
        const policyPayload = {
          policy_number: policyNumber,
          broker_id: brokerId,
          client_id: clientId,
          insurer_id: insurerId,
          ramo: policyType || null,
          start_date: startDate,
          renewal_date: renewalDate,
          status: 'active'
        };
        
        // Solo agregar percent_override si es VIDA ASSA
        if (policyType === 'VIDA' && insurerName === 'ASSA') {
          policyPayload.percent_override = 1.0;
        }
        
        const { data: newPolicy, error: policyError } = await supabase
          .from('policies')
          .insert(policyPayload)
          .select('id')
          .single();
        
        if (!policyError && newPolicy) {
          policyId = newPolicy.id;
        }
      } else {
        // Actualizar póliza existente si es VIDA ASSA
        if (policyType === 'VIDA' && insurerName === 'ASSA' && percentOverride !== 1.0) {
          await supabase
            .from('policies')
            .update({ percent_override: 1.0 })
            .eq('id', policyId);
        }
      }
      
      if (!policyId) {
        console.error(`❌ No se pudo crear/obtener póliza ${policyNumber}`);
        errors++;
        continue;
      }
      
      // CALCULAR COMISIÓN
      const grossAmount = commissionRaw * percentToUse;
      
      // Insertar comm_item
      const { error } = await supabase
        .from('comm_items')
        .insert({
          import_id: importRecord.id,
          broker_id: brokerId,
          policy_number: policyNumber,
          insured_name: clientNameNormalized,
          insurer_id: insurerId,
          gross_amount: grossAmount
        });
      
      if (error) {
        console.error(`❌ comm_items: ${policyNumber}`, error.message);
        errors++;
      } else {
        withBroker++;
        if (withBroker % 100 === 0) {
          console.log(`✅ Con broker: ${withBroker} (${(percentToUse * 100).toFixed(0)}% aplicado)...`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
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
        // Sin broker asignado → LISSA (ganancia oficina)
        const { error } = await supabase
          .from('comm_items')
          .insert({
            import_id: importRecord.id,
            broker_id: lissaBrokerId,
            policy_number: code,
            insured_name: `Código ASSA Huérfano: ${code}`,
            insurer_id: assaId,
            gross_amount: amount  // 100%
          });
        
        if (error) {
          console.error(`❌ huérfano ${code}:`, error.message);
          errors++;
        } else {
          huerfanos++;
          console.log(`🏢 Código huérfano a LISSA: ${code} ($${amount.toFixed(2)})`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Códigos asignados a brokers: ${imported}`);
  console.log(`🏢 Códigos huérfanos a LISSA (ganancia oficina): ${huerfanos}`);
  console.log(`🚫 Excluidos: ${skipped}`);
  console.log(`❌ Errores: ${errors}\n`);
}

async function actualizarItemsYCalcularTotales(fortnightId, totalReportes) {
  console.log('\n📊 CALCULANDO TOTALES...\n');
  
  // 1. Actualizar pending_items con fortnight_id
  const { error: updatePendingError } = await supabase
    .from('pending_items')
    .update({ fortnight_id: fortnightId })
    .is('fortnight_id', null);
  
  if (updatePendingError) {
    console.error('❌ Error actualizando pending_items:', updatePendingError);
  } else {
    console.log('✅ pending_items actualizados con fortnight_id');
  }
  
  // 2. Obtener todos los comm_items con broker y calcular totales
  const { data: items, error: itemsError } = await supabase
    .from('comm_items')
    .select('broker_id, gross_amount')
    .not('broker_id', 'is', null);
  
  if (itemsError) {
    console.error('❌ Error obteniendo items:', itemsError);
    return null;
  }
  
  // 3. Agrupar por broker
  const brokerTotals = {};
  let totalCommItems = 0;
  
  (items || []).forEach(item => {
    const brokerId = item.broker_id;
    const amount = Number(item.gross_amount) || 0;
    
    if (!brokerTotals[brokerId]) {
      brokerTotals[brokerId] = { gross: 0, count: 0 };
    }
    brokerTotals[brokerId].gross += amount;
    brokerTotals[brokerId].count += 1;
    totalCommItems += amount;
  });
  
  console.log(`\n✅ Calculados totales para ${Object.keys(brokerTotals).length} brokers`);
  
  // 4. Insertar totales
  const totalsToInsert = Object.entries(brokerTotals).map(([brokerId, totals]) => ({
    fortnight_id: fortnightId,
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
  
  // VERIFICACIÓN DE TOTALES Y GANANCIA OFICINA
  console.log(`\n💰 VERIFICACIÓN DE TOTALES:`);
  console.log(`   Total reportes aseguradoras:  $${(totalReportes || 0).toFixed(2)}`);
  console.log(`   Total brokers (con %):        $${totalCommItems.toFixed(2)}`);
  
  const gananciaOficina = (totalReportes || 0) - totalCommItems;
  console.log(`   🏢 Ganancia Oficina:           $${gananciaOficina.toFixed(2)}`);
  
  // Obtener total de LISSA para verificar
  const lissaBrokerId = 'd681a368-ac31-49a9-84cc-1e28b63c2d47';
  const lissaTotal = brokerTotals[lissaBrokerId]?.gross || 0;
  console.log(`   ✅ LISSA (códigos huérfanos):   $${lissaTotal.toFixed(2)}`);
  console.log(`   ℹ️  Diferencia por %:           $${(gananciaOficina - lissaTotal).toFixed(2)}\n`);
  
  return { brokerTotals, totalCommItems, totalReportes, gananciaOficina };
}

async function main() {
  console.log('🚀 BULK IMPORT COMPLETO\n');
  console.log('='.repeat(60));
  
  try {
    await limpiarDatos();
    
    const { insurerMap, brokerMap, brokerByAssaCode, brokerPercents, lissaBrokerId } = await getCatalogos();
    
    // CREAR QUINCENA PRIMERO
    console.log('\n📅 CREANDO QUINCENA...\n');
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
      throw fortnightError;
    }
    
    console.log(`✅ Quincena creada: ${fortnight.id}`);
    console.log(`   Período: ${fortnight.period_start} a ${fortnight.period_end}`);
    console.log(`   Estado: ${fortnight.status}\n`);
    
    // Importar todo con fortnight_id
    const totalReportes = await importarReportes(insurerMap, fortnight.id);
    await importarComisiones(insurerMap, brokerMap, brokerPercents);
    await importarCodigosASSA(insurerMap, brokerByAssaCode, lissaBrokerId);
    
    // ACTUALIZAR ITEMS Y CALCULAR TOTALES
    const totalsResult = await actualizarItemsYCalcularTotales(fortnight.id, totalReportes);
    
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
