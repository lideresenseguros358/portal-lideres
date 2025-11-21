#!/usr/bin/env node
/**
 * RECONSTRUIR TODA LA DATA DESDE LOS CSVs
 * Este script:
 * 1. Limpia los datos existentes
 * 2. Importa comisiones desde plantilla_comisiones_quincena.csv
 * 3. Importa códigos ASSA desde plantilla_codigos_assa.csv
 * 4. Importa reportes desde total_reportes_por_aseguradora.csv
 * 5. Crea las relaciones correctas
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

// Cargar .env.local
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Leer CSVs
const publicDir = path.join(process.cwd(), 'public');
const comisionesCSV = path.join(publicDir, 'plantilla_comisiones_quincena.csv');
const codigosCSV = path.join(publicDir, 'plantilla_codigos_assa.csv');
const reportesCSV = path.join(publicDir, 'total_reportes_por_aseguradora.csv');

async function limpiarDatos() {
  console.log('\n🗑️  LIMPIANDO DATOS EXISTENTES...\n');
  
  try {
    // Eliminar en orden correcto (por foreign keys)
    console.log('Eliminando fortnight_broker_totals...');
    await supabase.from('fortnight_broker_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Eliminando comm_item_claims...');
    await supabase.from('comm_item_claims').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Eliminando comm_items...');
    await supabase.from('comm_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Eliminando comm_imports...');
    await supabase.from('comm_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Eliminando pending_items...');
    await supabase.from('pending_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✅ Datos limpiados\n');
  } catch (error) {
    console.error('❌ Error limpiando:', error);
    throw error;
  }
}

async function obtenerAseguradoras() {
  const { data, error } = await supabase
    .from('insurers')
    .select('id, name');
  
  if (error) throw error;
  
  const map = new Map();
  data.forEach(ins => {
    map.set(ins.name.toUpperCase(), ins.id);
  });
  
  return map;
}

async function obtenerBrokers() {
  const { data, error } = await supabase
    .from('brokers')
    .select('id, name, email');
  
  if (error) throw error;
  
  return data;
}

async function importarReportes(insurerMap) {
  console.log('\n📊 IMPORTANDO REPORTES DE ASEGURADORAS...\n');
  
  if (!fs.existsSync(reportesCSV)) {
    console.log('⚠️  Archivo no encontrado:', reportesCSV);
    return;
  }
  
  const content = fs.readFileSync(reportesCSV, 'utf-8');
  const records = parse(content, {
    columns: false, // Sin encabezados
    skip_empty_lines: true,
    trim: true
  });
  
  let imported = 0;
  
  for (const record of records) {
    const insurerName = record[0]?.toUpperCase();
    const amount = parseFloat(record[1] || 0);
    
    if (!insurerName || !amount) continue;
    
    const insurerId = insurerMap.get(insurerName);
    if (!insurerId) {
      console.log(`⚠️  Aseguradora no encontrada: ${insurerName}`);
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
      console.error(`❌ Error importando ${insurerName}:`, error);
    } else {
      console.log(`✅ ${insurerName.padEnd(20)} $${amount.toFixed(2)}`);
      imported++;
    }
  }
  
  console.log(`\n✅ Reportes importados: ${imported}/${records.length}\n`);
}

async function importarComisiones(insurerMap, brokers) {
  console.log('\n💰 IMPORTANDO COMISIONES...\n');
  
  if (!fs.existsSync(comisionesCSV)) {
    console.log('⚠️  Archivo no encontrado:', comisionesCSV);
    return;
  }
  
  const content = fs.readFileSync(comisionesCSV, 'latin1');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  
  console.log(`📄 Total registros en CSV: ${records.length}\n`);
  
  // Crear un import genérico para todos
  const { data: importRecord, error: importError } = await supabase
    .from('comm_imports')
    .insert({
      insurer_id: Array.from(insurerMap.values())[0], // Primera aseguradora
      period_label: 'Q1 - Nov. 2025',
      total_amount: 0
    })
    .select()
    .single();
  
  if (importError) {
    console.error('❌ Error creando import:', importError);
    return;
  }
  
  console.log(`✅ Import creado: ${importRecord.id}\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    try {
      // Extraer datos del CSV (columnas reales)
      const policyNumber = record.policy_number || '';
      const clientName = record.client_name || '';
      const insurerName = (record.insurer_name || '').toUpperCase();
      const brokerEmail = record.broker_email || '';
      const grossAmount = parseFloat(record.commission_amount || 0);
      
      if (!policyNumber || !grossAmount) {
        skipped++;
        continue;
      }
      
      // Buscar aseguradora
      const insurerId = insurerMap.get(insurerName);
      if (!insurerId) {
        console.log(`⚠️  Aseguradora no encontrada: ${insurerName}`);
        skipped++;
        continue;
      }
      
      // Buscar broker por email
      let brokerId = null;
      if (brokerEmail) {
        const broker = brokers.find(b => b.email === brokerEmail);
        brokerId = broker?.id || null;
        if (!brokerId) {
          console.log(`⚠️  Broker no encontrado para email: ${brokerEmail}`);
        }
      }
      
      // Insertar como comm_item o pending_item
      if (brokerId) {
        const { error } = await supabase
          .from('comm_items')
          .insert({
            import_id: importRecord.id,
            broker_id: brokerId,
            policy_number: policyNumber,
            insured_name: clientName,
            insurer_id: insurerId,
            gross_amount: grossAmount
          });
        
        if (error) {
          console.error(`❌ Error: ${policyNumber}`, error.message);
          skipped++;
        } else {
          imported++;
          if (imported % 100 === 0) {
            console.log(`✅ Importados: ${imported}...`);
          }
        }
      } else {
        // Sin broker = pending
        const { error } = await supabase
          .from('pending_items')
          .insert({
            import_id: importRecord.id,
            policy_number: policyNumber,
            insured_name: clientName,
            insurer_id: insurerId,
            commission_raw: grossAmount,
            status: 'open'
          });
        
        if (error) {
          console.error(`❌ Error pending: ${policyNumber}`, error.message);
          skipped++;
        } else {
          imported++;
          if (imported % 100 === 0) {
            console.log(`✅ Importados: ${imported}...`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error procesando registro:', error);
      skipped++;
    }
  }
  
  console.log(`\n✅ Comisiones importadas: ${imported}`);
  console.log(`⚠️  Omitidos: ${skipped}\n`);
}

async function main() {
  console.log('🔄 RECONSTRUCCIÓN COMPLETA DE DATOS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Limpiar datos existentes
    await limpiarDatos();
    
    // 2. Obtener mapeos
    console.log('📋 Obteniendo catálogos...');
    const insurerMap = await obtenerAseguradoras();
    const brokers = await obtenerBrokers();
    console.log(`✅ ${insurerMap.size} aseguradoras, ${brokers.length} brokers\n`);
    
    // 3. Importar reportes
    await importarReportes(insurerMap);
    
    // 4. Importar comisiones
    await importarComisiones(insurerMap, brokers);
    
    console.log('='.repeat(60));
    console.log('✅ RECONSTRUCCIÓN COMPLETADA\n');
    
    // 5. Verificar
    console.log('📊 VERIFICACIÓN:\n');
    const { count: commCount } = await supabase.from('comm_items').select('*', { count: 'exact', head: true });
    const { count: pendingCount } = await supabase.from('pending_items').select('*', { count: 'exact', head: true });
    const { count: importsCount } = await supabase.from('comm_imports').select('*', { count: 'exact', head: true });
    
    console.log(`comm_items: ${commCount || 0}`);
    console.log(`pending_items: ${pendingCount || 0}`);
    console.log(`comm_imports: ${importsCount || 0}`);
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
