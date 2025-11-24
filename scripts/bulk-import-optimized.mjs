#!/usr/bin/env node
/**
 * BULK IMPORT OPTIMIZADO - QUINCENA COMPLETA
 * 
 * FLUJO CORRECTO:
 * 1. Importar reportes por aseguradora (total_amount)
 * 2. Importar comisiones de clientes (calcular con % del broker)
 * 3. Importar códigos ASSA (100% para cada broker/LISSA)
 * 4. Calcular totales por broker
 * 5. GUARDAR DETALLE en fortnight_details
 * 
 * NO BORRA:
 * - clients (reutiliza existentes)
 * - policies (reutiliza existentes)
 * - comm_items (se mantienen para historial)
 * - comm_imports (se mantienen con total_amount)
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

// Normalizar texto: quitar acentos, ñ, convertir guiones en espacios
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/-/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function limpiarDatosQuincena() {
  console.log('\n🗑️  LIMPIANDO DATOS DE QUINCENA...\n');
  
  // SOLO limpiar datos de la quincena, NO clients ni policies
  await supabase.from('fortnight_details').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('fortnight_broker_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_item_claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pending_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comm_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('fortnights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('✅ Datos de quincena limpiados (clients y policies intactos)\n');
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
  const brokerNames = new Map();
  let lissaBrokerId = null;
  
  (brokers || []).forEach(b => {
    if (b.email) {
      brokerMap.set(b.email.toLowerCase().trim(), b.id);
      if (b.email.toLowerCase().trim() === 'contacto@lideresenseguros.com') {
        lissaBrokerId = b.id;
      }
    }
    if (b.assa_code) {
      brokerByAssaCode.set(b.assa_code.trim(), b.id);
    }
    brokerPercents.set(b.id, b.percent_default || 1.0);
    brokerNames.set(b.id, b.name);
  });
  
  console.log(`✅ ${insurerMap.size} aseguradoras, ${brokerMap.size} brokers`);
  console.log(`✅ LISSA broker ID: ${lissaBrokerId}\n`);
  
  return { insurerMap, brokerMap, brokerByAssaCode, brokerPercents, brokerNames, lissaBrokerId };
}

async function importarReportes(insurerMap, fortnightId) {
  console.log('\n📊 IMPORTANDO REPORTES DE ASEGURADORAS...\n');
  
  const csvPath = path.join(process.cwd(), 'public', 'total_reportes_por_aseguradora.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return { imports: [], totalReportes: 0 };
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    trim: true
  });
  
  let imported = 0;
  let totalReportes = 0;
  const importsCreated = [];
  
  for (const record of records) {
    const insurerNameOriginal = (record[0] || '').trim();
    const insurerName = insurerNameOriginal.toUpperCase();
    const amount = parseFloat(record[1] || 0);
    
    if (!insurerName || !amount) continue;
    
    let insurerId = insurerMap.get(insurerName);
    if (!insurerId) {
      insurerId = insurerMap.get(normalizar(insurerName));
    }
    
    if (!insurerId) {
      console.log(`⚠️  Aseguradora no encontrada: '${insurerName}'`);
      continue;
    }
    
    const { data: importRecord, error } = await supabase
      .from('comm_imports')
      .insert({
        insurer_id: insurerId,
        period_label: fortnightId,
        total_amount: amount
      })
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error: ${insurerName}`, error.message);
    } else {
      console.log(`✅ ${insurerName.padEnd(20)} $${amount.toFixed(2)}`);
      imported++;
      totalReportes += amount;
      importsCreated.push({
        id: importRecord.id,
        insurer_id: insurerId,
        insurer_name: insurerName,
        total_amount: amount
      });
    }
  }
  
  console.log(`\n✅ Reportes importados: ${imported}/${records.length}`);
  console.log(`💰 Total reportes: $${totalReportes.toFixed(2)}\n`);
  
  return { imports: importsCreated, totalReportes };
}

async function importarComisiones(insurerMap, brokerMap, brokerPercents, fortnightId, importsCreated) {
  console.log('\n💰 IMPORTANDO COMISIONES DE PÓLIZAS...\n');
  
  // Crear mapa de insurer_id → import_id
  const insurerToImportMap = new Map();
  importsCreated.forEach(imp => {
    insurerToImportMap.set(imp.insurer_id, imp.id);
  });
  
  const csvPath = path.join(process.cwd(), 'public', 'plantilla_comisiones_quincena.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return { commItems: [], pendingItems: [] };
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    quote: '"',
    escape: '"'
  });
  
  console.log(`📄 Total registros: ${records.length}\n`);
  
  const commItems = [];
  const pendingItems = [];
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
      
      let insurerId = insurerMap.get(insurerName);
      if (!insurerId) {
        insurerId = insurerMap.get(normalizar(insurerName));
      }
      
      if (!insurerId) {
        errors++;
        continue;
      }
      
      const brokerId = brokerEmail ? brokerMap.get(brokerEmail) : null;
      
      if (!brokerId) {
        // Sin broker → pending_items
        pendingItems.push({
          policy_number: policyNumber,
          insured_name: clientNameNormalized,
          insurer_id: insurerId,
          commission_raw: commissionRaw,
          fortnight_id: fortnightId,
          status: 'open'
        });
        pending++;
        if (pending % 20 === 0) {
          console.log(`⏳ Pendientes: ${pending}...`);
        }
        continue;
      }
      
      // CREAR/ACTUALIZAR CLIENTE
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientNameNormalized)
        .eq('broker_id', brokerId)
        .single();
      
      let clientId = existingClient?.id;
      
      if (!clientId) {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({ name: clientNameNormalized, broker_id: brokerId })
          .select('id')
          .single();
        
        if (newClient) clientId = newClient.id;
      }
      
      if (!clientId) {
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
      
      // CONDICIÓN ESPECIAL: VIDA + ASSA → 100%
      if (policyType === 'VIDA' && insurerName === 'ASSA') {
        percentToUse = 1.0;
        percentOverride = 1.0;
      } else if (percentOverride != null) {
        percentToUse = percentOverride;
      } else {
        percentToUse = brokerPercents.get(brokerId) || 1.0;
      }
      
      if (!policyId) {
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
        
        if (policyType === 'VIDA' && insurerName === 'ASSA') {
          policyPayload.percent_override = 1.0;
        }
        
        const { data: newPolicy } = await supabase
          .from('policies')
          .insert(policyPayload)
          .select('id')
          .single();
        
        if (newPolicy) policyId = newPolicy.id;
      } else if (policyType === 'VIDA' && insurerName === 'ASSA' && percentOverride !== 1.0) {
        await supabase
          .from('policies')
          .update({ percent_override: 1.0 })
          .eq('id', policyId);
      }
      
      if (!policyId) {
        errors++;
        continue;
      }
      
      // CALCULAR COMISIÓN
      const grossAmount = commissionRaw * percentToUse;
      
      // Obtener import_id para esta aseguradora
      const importId = insurerToImportMap.get(insurerId);
      
      // Guardar para comm_items
      commItems.push({
        broker_id: brokerId,
        policy_number: policyNumber,
        policy_id: policyId,
        client_id: clientId,
        client_name: clientNameNormalized,
        insurer_id: insurerId,
        insurer_name: insurerName,
        ramo: policyType,
        commission_raw: commissionRaw,
        percent_applied: percentToUse,
        gross_amount: grossAmount,
        import_id: importId, // ← Agregado
        created_at: '2025-11-15T23:59:59.000Z'
      });
      
      withBroker++;
      if (withBroker % 100 === 0) {
        console.log(`✅ Con broker: ${withBroker}...`);
      }
      
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Con broker: ${withBroker}`);
  console.log(`⏳ Pendientes: ${pending}`);
  console.log(`❌ Errores: ${errors}\n`);
  
  return { commItems, pendingItems };
}

async function importarCodigosASSA(insurerMap, brokerByAssaCode, lissaBrokerId, importsCreated) {
  console.log('\n🔢 IMPORTANDO CÓDIGOS ASSA...\n');
  
  const csvPath = path.join(process.cwd(), 'public', 'plantilla_codigos_assa.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠️  Archivo no encontrado');
    return { assaItems: [] };
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });
  
  const codigosExcluir = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];
  
  console.log(`📄 Total códigos: ${records.length}`);
  console.log(`🚫 Códigos a excluir: ${codigosExcluir.join(', ')}\n`);
  
  let assaId = insurerMap.get('ASSA') || insurerMap.get(normalizar('ASSA'));
  
  if (!assaId) {
    console.error('❌ No se encontró ASSA');
    return { assaItems: [] };
  }
  
  // Obtener import_id de ASSA
  const assaImport = importsCreated.find(imp => imp.insurer_id === assaId);
  const assaImportId = assaImport?.id;
  
  if (!assaImportId) {
    console.error('❌ No se encontró import de ASSA');
    return { assaItems: [] };
  }
  
  const assaItems = [];
  let imported = 0;
  let skipped = 0;
  let huerfanos = 0;
  
  for (const record of records) {
    const code = (record.assa_code || '').trim();
    const amount = parseFloat(record.commission_amount || 0);
    
    if (!code || !amount || codigosExcluir.includes(code)) {
      if (codigosExcluir.includes(code)) {
        console.log(`🚫 Excluido: ${code}`);
        skipped++;
      }
      continue;
    }
    
    const brokerId = brokerByAssaCode.get(code) || lissaBrokerId;
    const isHuerfano = !brokerByAssaCode.has(code);
    
    assaItems.push({
      broker_id: brokerId,
      policy_number: code,
      policy_id: null,
      client_id: null,
      client_name: isHuerfano ? `Código ASSA Huérfano: ${code}` : `Código ASSA: ${code}`,
      insurer_id: assaId,
      insurer_name: 'ASSA',
      ramo: null,
      commission_raw: amount,
      percent_applied: 1.0,
      gross_amount: amount,
      is_assa_code: true,
      assa_code: code,
      import_id: assaImportId, // ← Agregado
      created_at: '2025-11-15T23:59:59.000Z'
    });
    
    if (isHuerfano) {
      huerfanos++;
      console.log(`🏢 Huérfano a LISSA: ${code} ($${amount.toFixed(2)})`);
    } else {
      imported++;
      if (imported % 10 === 0) {
        console.log(`✅ Códigos asignados: ${imported}...`);
      }
    }
  }
  
  console.log(`\n✅ Códigos asignados: ${imported}`);
  console.log(`🏢 Huérfanos a LISSA: ${huerfanos}`);
  console.log(`🚫 Excluidos: ${skipped}\n`);
  
  return { assaItems };
}

async function insertarItems(commItems, assaItems, fortnightId) {
  console.log('\n💾 INSERTANDO ITEMS EN BASE DE DATOS...\n');
  
  const allItems = [...commItems, ...assaItems];
  
  // Insertar en comm_items
  for (const item of allItems) {
    const { error } = await supabase
      .from('comm_items')
      .insert({
        broker_id: item.broker_id,
        policy_number: item.policy_number,
        insured_name: item.client_name,
        insurer_id: item.insurer_id,
        gross_amount: item.gross_amount,
        import_id: item.import_id, // ← Agregado
        created_at: item.created_at
      });
    
    if (error) {
      console.error(`❌ Error insertando ${item.policy_number}:`, error.message);
    }
  }
  
  console.log(`✅ ${allItems.length} items insertados en comm_items\n`);
  
  return allItems;
}

async function insertarPendingItems(pendingItems) {
  if (pendingItems.length === 0) return;
  
  console.log('\n⏳ INSERTANDO PENDING ITEMS...\n');
  
  const { error } = await supabase
    .from('pending_items')
    .insert(pendingItems);
  
  if (error) {
    console.error('❌ Error insertando pending_items:', error);
  } else {
    console.log(`✅ ${pendingItems.length} pending_items insertados\n`);
  }
}

async function guardarDetalles(allItems, fortnightId) {
  console.log('\n📋 GUARDANDO DETALLE EN fortnight_details...\n');
  
  let insertados = 0;
  let duplicados = 0;
  
  for (const item of allItems) {
    const detail = {
      fortnight_id: fortnightId,
      broker_id: item.broker_id,
      insurer_id: item.insurer_id,
      policy_id: item.policy_id,
      client_id: item.client_id,
      policy_number: item.policy_number,
      client_name: item.client_name,
      ramo: item.ramo,
      commission_raw: item.commission_raw,
      percent_applied: item.percent_applied,
      commission_calculated: item.gross_amount,
      is_assa_code: item.is_assa_code || false,
      assa_code: item.assa_code || null
    };
    
    const { error } = await supabase
      .from('fortnight_details')
      .insert(detail);
    
    if (error) {
      if (error.code === '23505') {
        // Duplicado - saltear
        duplicados++;
      } else {
        console.error('❌ Error guardando detalle:', error);
      }
    } else {
      insertados++;
    }
    
    if ((insertados + duplicados) % 100 === 0) {
      console.log(`📊 Progreso: ${insertados} insertados, ${duplicados} duplicados...`);
    }
  }
  
  console.log(`✅ ${insertados} detalles guardados, ${duplicados} duplicados omitidos\n`);
}

async function calcularTotales(allItems, fortnightId) {
  console.log('\n📊 CALCULANDO TOTALES POR BROKER...\n');
  
  const brokerTotals = {};
  
  allItems.forEach(item => {
    const brokerId = item.broker_id;
    const amount = Number(item.gross_amount) || 0;
    
    if (!brokerTotals[brokerId]) {
      brokerTotals[brokerId] = { gross: 0, count: 0 };
    }
    brokerTotals[brokerId].gross += amount;
    brokerTotals[brokerId].count += 1;
  });
  
  const totalsToInsert = Object.entries(brokerTotals).map(([brokerId, totals]) => ({
    fortnight_id: fortnightId,
    broker_id: brokerId,
    gross_amount: totals.gross,
    net_amount: totals.gross,
    discounts_json: { adelantos: [], total: 0 }
  }));
  
  const { error } = await supabase
    .from('fortnight_broker_totals')
    .insert(totalsToInsert);
  
  if (error) {
    console.error('❌ Error insertando totales:', error);
    throw error;
  }
  
  console.log(`✅ Totales insertados para ${totalsToInsert.length} brokers\n`);
  
  return brokerTotals;
}

async function main() {
  console.log('🚀 BULK IMPORT OPTIMIZADO - QUINCENA COMPLETA\n');
  console.log('='.repeat(60));
  
  try {
    await limpiarDatosQuincena();
    
    const catalogos = await getCatalogos();
    
    // CREAR QUINCENA
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
    
    if (fortnightError) throw fortnightError;
    
    console.log(`✅ Quincena creada: ${fortnight.id}`);
    console.log(`   Período: ${fortnight.period_start} a ${fortnight.period_end}`);
    console.log(`   Estado: ${fortnight.status}\n`);
    
    // IMPORTAR TODO
    const { imports, totalReportes } = await importarReportes(catalogos.insurerMap, fortnight.id);
    const { commItems, pendingItems } = await importarComisiones(
      catalogos.insurerMap, 
      catalogos.brokerMap, 
      catalogos.brokerPercents, 
      fortnight.id,
      imports // ← Agregado
    );
    const { assaItems } = await importarCodigosASSA(
      catalogos.insurerMap, 
      catalogos.brokerByAssaCode, 
      catalogos.lissaBrokerId,
      imports // ← Agregado
    );
    
    // INSERTAR EN BD
    const allItems = await insertarItems(commItems, assaItems, fortnight.id);
    await insertarPendingItems(pendingItems);
    
    // GUARDAR DETALLE
    await guardarDetalles(allItems, fortnight.id);
    
    // CALCULAR TOTALES
    const brokerTotals = await calcularTotales(allItems, fortnight.id);
    
    const totalCommItems = Object.values(brokerTotals).reduce((sum, t) => sum + t.gross, 0);
    const gananciaOficina = totalReportes - totalCommItems;
    
    console.log('='.repeat(60));
    console.log('✅ IMPORTACIÓN COMPLETADA\n');
    console.log(`📊 RESUMEN FINAL:\n`);
    console.log(`   Total Reportes:         $${totalReportes.toFixed(2)}`);
    console.log(`   Total Corredores:       $${totalCommItems.toFixed(2)}`);
    console.log(`   Ganancia Oficina:       $${gananciaOficina.toFixed(2)}`);
    console.log(`   Items con broker:       ${allItems.length}`);
    console.log(`   Items sin broker:       ${pendingItems.length}`);
    console.log(`   Brokers con comisión:   ${Object.keys(brokerTotals).length}`);
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
