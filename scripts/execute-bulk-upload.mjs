/**
 * Ejecuta bulk upload de comisiones directamente en Supabase
 * Procesa el CSV en lotes para evitar límites de tamaño
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Variables de entorno cargadas desde .env.local\n');
}

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_FILE = path.join(__dirname, '..', 'public', 'plantilla_comisiones_quincena.csv');
const BATCH_SIZE = 50; // Procesar en lotes de 50

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Crea un archivo .env.local con estas variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Parsear fecha DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Leer y parsear CSV con papaparse (maneja campos con comas correctamente)
function parseCSV() {
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    console.error('❌ Errores parseando CSV:');
    parsed.errors.forEach(err => console.error(`   Fila ${err.row}: ${err.message}`));
  }

  return parsed.data.map((row, idx) => ({
    ...row,
    _rowNum: idx + 2,
  }));
}

async function main() {
  console.log('\n🚀 BULK UPLOAD DE COMISIONES - Primera Quincena Nov 2025\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Leer CSV
  console.log('📄 Leyendo CSV...');
  const rows = parseCSV();
  console.log(`   ✅ ${rows.length} filas cargadas\n`);

  // 2. Cargar datos de referencia
  console.log('📚 Cargando datos de referencia...');
  
  const { data: insurers } = await supabase.from('insurers').select('id, name');
  const { data: brokers } = await supabase.from('brokers').select('id, email, name, percent_default');
  
  if (!insurers || !brokers) {
    console.error('❌ Error cargando datos de referencia');
    process.exit(1);
  }

  // Crear mapas para búsqueda rápida
  const insurerMap = new Map(insurers.map(i => [i.name.toUpperCase(), i]));
  const brokerMap = new Map(brokers.map(b => [b.email?.toLowerCase(), b]));

  console.log(`   ✅ ${insurers.length} aseguradoras`);
  console.log(`   ✅ ${brokers.length} brokers\n`);

  // 3. Crear quincena CERRADA
  console.log('📅 Creando quincena (1-15 Nov 2025)...');
  
  const { data: fortnight, error: fortnightError } = await supabase
    .from('fortnights')
    .insert([{
      period_start: '2025-11-01',
      period_end: '2025-11-15',
      status: 'PAID',
      notify_brokers: false,
    }])
    .select()
    .single();

  if (fortnightError || !fortnight) {
    console.error('❌ Error creando quincena:', fortnightError);
    process.exit(1);
  }

  console.log(`   ✅ Quincena creada: ${fortnight.id}\n`);

  // 4. Crear comm_import
  console.log('📦 Creando importación...');
  
  const totalGross = rows.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);
  const firstInsurer = insurerMap.get('ASSA');

  const { data: commImport, error: importError } = await supabase
    .from('comm_imports')
    .insert([{
      period_label: fortnight.id,
      insurer_id: firstInsurer.id,
      total_amount: totalGross,
      is_life_insurance: false,
    }])
    .select()
    .single();

  if (importError || !commImport) {
    console.error('❌ Error creando importación:', importError);
    process.exit(1);
  }

  console.log(`   ✅ Import creado: ${commImport.id}`);
  console.log(`   💰 Total bruto: $${totalGross.toFixed(2)}\n`);

  // 5. Procesar comisiones en lotes
  console.log(`🔄 Procesando ${rows.length} comisiones en lotes de ${BATCH_SIZE}...\n`);

  let processed = 0;
  let successCount = 0;
  let errorCount = 0;
  let unidentifiedCount = 0;
  let newClientsCount = 0;
  let newPoliciesCount = 0;
  let vidaAssaCount = 0;

  const brokerTotals = new Map(); // broker_id -> { gross, net, count }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    console.log(`📦 Lote ${batchNum}/${totalBatches} (${batch.length} filas)...`);

    for (const row of batch) {
      try {
        const result = await processRow(
          row,
          supabase,
          insurerMap,
          brokerMap,
          commImport.id
        );

        if (result.success) {
          successCount++;
          if (result.isNewClient) newClientsCount++;
          if (result.isNewPolicy) newPoliciesCount++;
          if (result.isVidaAssa) vidaAssaCount++;

          // Acumular totales por broker
          if (result.brokerId) {
            const current = brokerTotals.get(result.brokerId) || { gross: 0, net: 0, count: 0 };
            current.gross += result.grossAmount;
            current.net += result.netAmount;
            current.count += 1;
            brokerTotals.set(result.brokerId, current);
          }
        } else if (result.unidentified) {
          unidentifiedCount++;
        } else {
          errorCount++;
          console.log(`   ⚠️  Fila ${row._rowNum}: ${result.error}`);
        }

        processed++;

      } catch (error) {
        errorCount++;
        console.log(`   ❌ Fila ${row._rowNum}: ${error.message}`);
      }
    }

    const progress = ((i + batch.length) / rows.length * 100).toFixed(1);
    console.log(`   ✅ Progreso: ${progress}%\n`);
  }

  // 6. Crear fortnight_broker_totals
  console.log('📊 Actualizando totales por broker...');

  for (const [brokerId, totals] of brokerTotals.entries()) {
    await supabase
      .from('fortnight_broker_totals')
      .insert([{
        fortnight_id: fortnight.id,
        broker_id: brokerId,
        gross_amount: totals.gross,
        net_amount: totals.net,
        discounts_json: {},
      }]);
  }

  console.log(`   ✅ ${brokerTotals.size} brokers actualizados\n`);

  // 7. Resumen final
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ BULK UPLOAD COMPLETADO');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📊 RESUMEN:');
  console.log(`   Total procesadas:     ${processed}`);
  console.log(`   ✅ Exitosas:          ${successCount}`);
  console.log(`   ❌ Errores:           ${errorCount}`);
  console.log(`   ⚠️  No identificados:  ${unidentifiedCount}\n`);

  console.log('📦 NUEVOS REGISTROS:');
  console.log(`   Clientes creados:     ${newClientsCount}`);
  console.log(`   Pólizas creadas:      ${newPoliciesCount}\n`);

  console.log('🔥 ESPECIALES:');
  console.log(`   VIDA en ASSA (100%):  ${vidaAssaCount}\n`);

  console.log('💰 TOTALES POR BROKER:');
  const brokerDetails = Array.from(brokerTotals.entries())
    .map(([brokerId, totals]) => {
      const broker = brokers.find(b => b.id === brokerId);
      return { name: broker?.name || brokerId, ...totals };
    })
    .sort((a, b) => b.net - a.net);

  brokerDetails.forEach((b, idx) => {
    console.log(`   ${idx + 1}. ${b.name}`);
    console.log(`      Pólizas: ${b.count} | Bruto: $${b.gross.toFixed(2)} | Neto: $${b.net.toFixed(2)}`);
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`🔗 Ver en: ${SUPABASE_URL.replace('.supabase.co', '').replace('https://', 'https://app.supabase.com/project/')}/editor`);
  console.log('═══════════════════════════════════════════════════════\n');
}

async function processRow(row, supabase, insurerMap, brokerMap, importId) {
  const policyNumber = row.policy_number;
  const clientName = row.client_name;
  const insurerName = row.insurer_name.toUpperCase();
  const brokerEmailOriginal = row.broker_email || ''; // Guardar original
  const brokerEmail = brokerEmailOriginal.toLowerCase().trim();
  const policyType = row.policy_type?.toUpperCase() || '';
  const grossAmount = parseFloat(row.commission_amount) || 0;
  const startDate = parseDate(row.start_date);
  const renewalDate = parseDate(row.renewal_date);

  // 1. Buscar aseguradora
  const insurer = insurerMap.get(insurerName);
  if (!insurer) {
    return { success: false, error: `Aseguradora no encontrada: ${insurerName}` };
  }

  // 2. Buscar broker
  let broker = null;
  let brokerId = null;
  
  if (brokerEmail) {
    broker = brokerMap.get(brokerEmail);
    if (broker) {
      brokerId = broker.id;
    }
  }

  // 3. Determinar porcentaje
  const isVidaAssa = insurerName === 'ASSA' && policyType === 'VIDA';
  let percentageApplied = 0;

  if (isVidaAssa) {
    percentageApplied = 1.0; // 100% para VIDA en ASSA
  } else if (broker) {
    percentageApplied = broker.percent_default || 0;
  }

  const netAmount = grossAmount * percentageApplied;

  // 4. Buscar póliza existente
  const { data: existingPolicy } = await supabase
    .from('policies')
    .select('id, client_id, broker_id')
    .eq('policy_number', policyNumber)
    .single();

  let policyId;
  let clientId;
  let isNewClient = false;
  let isNewPolicy = false;

  if (existingPolicy) {
    // Póliza existe: actualizar
    policyId = existingPolicy.id;
    clientId = existingPolicy.client_id;

    // IMPORTANTE: NO usar el broker de la póliza existente si el CSV no tiene email
    // La comisión debe quedar sin identificar (broker_id = null)
    // Solo actualizar los datos de la póliza si hay información nueva

    // Actualizar póliza
    const updates = {};
    if (brokerId) updates.broker_id = brokerId;
    if (startDate) updates.start_date = startDate;
    if (renewalDate) updates.renewal_date = renewalDate;
    if (isVidaAssa) updates.percent_override = 1.0;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('policies')
        .update(updates)
        .eq('id', policyId);
    }

  } else {
    // Póliza NO existe: crear cliente y póliza
    isNewClient = true;
    isNewPolicy = true;

    // Crear cliente
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert([{
        name: clientName,
        broker_id: brokerId, // Dejar en null si no hay broker
        active: true,
      }])
      .select()
      .single();

    if (clientError || !newClient) {
      return { success: false, error: `Error creando cliente: ${clientError?.message}` };
    }

    clientId = newClient.id;

    // Crear póliza
    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert([{
        policy_number: policyNumber,
        client_id: clientId,
        broker_id: brokerId, // Dejar en null si no hay broker
        insurer_id: insurer.id,
        start_date: startDate,
        renewal_date: renewalDate,
        percent_override: isVidaAssa ? 1.0 : null,
        status: 'ACTIVA',
      }])
      .select()
      .single();

    if (policyError || !newPolicy) {
      return { success: false, error: `Error creando póliza: ${policyError?.message}` };
    }

    policyId = newPolicy.id;
  }

  // 5. Crear comm_item
  const { error: itemError } = await supabase
    .from('comm_items')
    .insert([{
      import_id: importId,
      policy_number: policyNumber,
      insured_name: clientName,
      insurer_id: insurer.id,
      broker_id: brokerId, // null si no identificado
      gross_amount: grossAmount,
      raw_row: {
        policy_type: policyType,
        percentage_applied: percentageApplied,
        net_amount: netAmount,
        is_vida_assa: isVidaAssa,
        broker_email: brokerEmailOriginal, // Guardar email original del CSV
        insurer_name: insurerName,
        client_name: clientName,
      },
    }]);

  if (itemError) {
    return { success: false, error: `Error creando comm_item: ${itemError.message}` };
  }

  return {
    success: true,
    unidentified: !brokerId,
    isNewClient,
    isNewPolicy,
    isVidaAssa,
    brokerId,
    grossAmount,
    netAmount,
  };
}

// Ejecutar
main().catch(error => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
