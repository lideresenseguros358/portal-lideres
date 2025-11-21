/**
 * Procesa comisiones adicionales por código ASSA
 * Lee plantilla_codigos_assa.csv y asigna 100% de comisión a cada broker según su código
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Variables de entorno cargadas\n');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_FILE = path.join(__dirname, '..', 'public', 'plantilla_codigos_assa.csv');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Códigos EXCLUIDOS (no se asignan a nadie)
const EXCLUDED_CODES = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];

// Email para códigos sin asignar
const UNASSIGNED_EMAIL = 'contacto@lideresenseguros.com';

// Leer CSV de códigos ASSA
function parseAssaCodesCSV() {
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return parsed.data.map((row, idx) => ({
    ...row,
    _rowNum: idx + 2,
  }));
}

async function main() {
  console.log('\n🔥 BULK UPLOAD - COMISIONES POR CÓDIGO ASSA\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Leer CSV de códigos ASSA
  console.log('📄 Leyendo CSV de códigos ASSA...');
  const rows = parseAssaCodesCSV();
  console.log(`   ✅ ${rows.length} códigos cargados\n`);

  // 2. Buscar la quincena de noviembre 2025
  console.log('🔍 Buscando quincena Nov 2025...');
  const { data: fortnights } = await supabase
    .from('fortnights')
    .select('id')
    .eq('period_start', '2025-11-01')
    .eq('period_end', '2025-11-15')
    .single();

  if (!fortnights) {
    console.error('❌ No se encontró la quincena');
    return;
  }

  const fortnightId = fortnights.id;
  console.log(`   ✅ Quincena: ${fortnightId}\n`);

  // 3. Cargar brokers con código ASSA
  console.log('📚 Cargando brokers con código ASSA...');
  const { data: allBrokers } = await supabase
    .from('brokers')
    .select('id, email, assa_code, name');

  const brokersByCode = new Map();
  const brokersByEmail = new Map();
  
  allBrokers.forEach(b => {
    if (b.assa_code && b.assa_code.trim() !== '') {
      brokersByCode.set(b.assa_code.trim().toUpperCase(), b);
    }
    if (b.email) {
      brokersByEmail.set(b.email.toLowerCase().trim(), b);
    }
  });

  console.log(`   ✅ ${brokersByCode.size} brokers con código ASSA`);
  console.log(`   ✅ ${allBrokers.length} brokers totales\n`);

  // 4. Buscar broker para códigos sin asignar
  const unassignedBroker = brokersByEmail.get(UNASSIGNED_EMAIL.toLowerCase());
  if (!unassignedBroker) {
    console.error(`❌ No se encontró broker: ${UNASSIGNED_EMAIL}`);
    return;
  }
  console.log(`   ✅ Broker sin asignar: ${UNASSIGNED_EMAIL}\n`);

  // 5. Buscar import de la quincena
  console.log('🔍 Buscando importación de la quincena...');
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('id')
    .eq('period_label', fortnightId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!imports) {
    console.error('❌ No se encontró importación');
    return;
  }

  const importId = imports.id;
  console.log(`   ✅ Import: ${importId}\n`);

  // 6. Buscar aseguradora ASSA
  console.log('🔍 Buscando aseguradora ASSA...');
  const { data: assaInsurer } = await supabase
    .from('insurers')
    .select('id')
    .ilike('name', '%ASSA%')
    .limit(1)
    .single();

  if (!assaInsurer) {
    console.error('❌ No se encontró aseguradora ASSA');
    return;
  }

  const assaInsurerId = assaInsurer.id;
  console.log(`   ✅ ASSA ID: ${assaInsurerId}\n`);

  // 7. Procesar cada código ASSA del CSV
  console.log('🔄 Procesando códigos ASSA...\n');

  let processed = 0;
  let excluded = 0;
  let unassigned = 0;
  let errors = 0;
  const brokerTotals = new Map();

  for (const row of rows) {
    const assaCode = row.assa_code?.trim().toUpperCase();
    const grossAmount = parseFloat(row.commission_amount) || 0;

    if (!assaCode) {
      console.log(`   ⚠️  Fila ${row._rowNum}: Sin código ASSA`);
      errors++;
      continue;
    }

    // Verificar si está en la lista de excluidos
    if (EXCLUDED_CODES.includes(assaCode)) {
      console.log(`   🚫 ${assaCode}: EXCLUIDO (no se asigna a nadie)`);
      excluded++;
      continue;
    }

    // Buscar broker por código
    let targetBroker = brokersByCode.get(assaCode);
    let isUnassigned = false;
    
    if (!targetBroker) {
      // Código sin asignar → contacto@lideresenseguros.com
      console.log(`   ⚠️  ${assaCode}: Sin broker → ${UNASSIGNED_EMAIL}`);
      targetBroker = unassignedBroker;
      unassigned++;
      isUnassigned = true;
    } else {
      console.log(`   ✅ ${assaCode}: ${targetBroker.email} ($${grossAmount.toFixed(2)})`);
    }

    // Crear comisión con 100% para el broker del código
    const netAmount = grossAmount; // 100%

    const newCommItem = {
      broker_id: targetBroker.id,
      import_id: importId,
      insurer_id: assaInsurerId,
      policy_number: assaCode, // Usamos el código ASSA como "póliza"
      insured_name: `COMISIÓN CÓDIGO ${assaCode}`,
      gross_amount: grossAmount,
      raw_row: {
        source: 'assa_code_bulk',
        assa_code: assaCode,
        percentage_applied: 1.0,
        net_amount: netAmount,
        is_unassigned: isUnassigned,
        insurer_name: 'ASSA',
        policy_type: 'VIDA',
      },
    };

    const { error: insertError } = await supabase
      .from('comm_items')
      .insert(newCommItem);

    if (insertError) {
      console.error(`   ❌ Error en ${assaCode}:`, insertError.message);
      errors++;
    } else {
      processed++;
      
      // Acumular totales por broker
      const brokerId = targetBroker.id;
      if (!brokerTotals.has(brokerId)) {
        brokerTotals.set(brokerId, {
          email: targetBroker.email,
          name: targetBroker.name,
          gross: 0,
          net: 0,
          count: 0,
        });
      }
      
      const totals = brokerTotals.get(brokerId);
      totals.gross += grossAmount;
      totals.net += netAmount;
      totals.count++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ PROCESAMIENTO COMPLETADO');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`📊 RESUMEN:`);
  console.log(`   Total códigos CSV:    ${rows.length}`);
  console.log(`   ✅ Procesados:        ${processed}`);
  console.log(`   🚫 Excluidos:         ${excluded} (PJ750, PJ750-1, PJ750-6, PJ750-9)`);
  console.log(`   ⚠️  Sin asignar:      ${unassigned} (→ ${UNASSIGNED_EMAIL})`);
  console.log(`   ❌ Errores:           ${errors}\n`);

  console.log(`💰 TOTALES POR BROKER:\n`);
  const sortedBrokers = Array.from(brokerTotals.entries())
    .sort((a, b) => b[1].net - a[1].net);

  sortedBrokers.forEach(([brokerId, totals], idx) => {
    console.log(`${idx + 1}. ${totals.email}`);
    console.log(`   Nombre: ${totals.name}`);
    console.log(`   Códigos: ${totals.count} | Bruto: $${totals.gross.toFixed(2)} | Neto: $${totals.net.toFixed(2)}\n`);
  });

  // 8. Actualizar fortnight_broker_totals
  console.log('📊 Actualizando totales de la quincena...\n');
  
  for (const [brokerId, totals] of brokerTotals.entries()) {
    // Buscar si ya existe un registro
    const { data: existing } = await supabase
      .from('fortnight_broker_totals')
      .select('id, gross_amount, net_amount')
      .eq('fortnight_id', fortnightId)
      .eq('broker_id', brokerId)
      .single();

    if (existing) {
      // Actualizar sumando los nuevos montos
      await supabase
        .from('fortnight_broker_totals')
        .update({
          gross_amount: parseFloat(existing.gross_amount) + totals.gross,
          net_amount: parseFloat(existing.net_amount) + totals.net,
        })
        .eq('id', existing.id);
    } else {
      // Crear nuevo registro
      await supabase
        .from('fortnight_broker_totals')
        .insert({
          fortnight_id: fortnightId,
          broker_id: brokerId,
          gross_amount: totals.gross,
          net_amount: totals.net,
          discounts_json: {},
          is_retained: false,
        });
    }
  }

  console.log('   ✅ Totales actualizados\n');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
