/**
 * Genera SQL para bulk upload de comisiones
 * Salida: bulk-upload-comisiones.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '..', 'public', 'plantilla_comisiones_quincena.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'bulk-upload-comisiones.sql');

// Leer CSV
const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

console.log('📄 Procesando CSV...');
console.log(`   Total filas: ${lines.length - 1}`);

// Parsear filas
const rows = lines.slice(1).map((line, idx) => {
  const values = line.split(',');
  const row = {};
  headers.forEach((header, i) => {
    row[header.trim()] = values[i]?.trim() || '';
  });
  row._rowNum = idx + 2;
  return row;
});

// Función para escapar strings SQL
function escapeSql(str) {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

// Función para parsear fecha
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return 'NULL';
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return 'NULL';
  const [day, month, year] = parts;
  if (!day || !month || !year) return 'NULL';
  return `'${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}'`;
}

// Generar SQL
let sql = `-- =====================================================
-- BULK UPLOAD COMISIONES - Primera Quincena Nov 2025
-- Generado: ${new Date().toISOString()}
-- Total comisiones: ${rows.length}
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREAR QUINCENA CERRADA (Primera quincena Nov 2025)
-- =====================================================

INSERT INTO fortnights (period_start, period_end, status, notify_brokers, created_at)
VALUES ('2025-11-01', '2025-11-15', 'PAID', false, NOW())
RETURNING id;

-- Guardar el ID en una variable (debes reemplazar 'FORTNIGHT_ID_AQUI' con el ID real)
-- O usar: WITH fortnight_created AS (INSERT INTO fortnights ... RETURNING id)

DO $$
DECLARE
  v_fortnight_id UUID;
  v_import_id UUID;
  v_client_id UUID;
  v_policy_id UUID;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_percentage NUMERIC;
  v_net_amount NUMERIC;
  v_is_vida_assa BOOLEAN;
BEGIN

  -- Obtener ID de quincena recién creada
  SELECT id INTO v_fortnight_id 
  FROM fortnights 
  WHERE period_start = '2025-11-01' AND period_end = '2025-11-15' 
  ORDER BY created_at DESC 
  LIMIT 1;

  RAISE NOTICE 'Quincena ID: %', v_fortnight_id;

  -- =====================================================
  -- 2. CREAR COMM_IMPORT (agrupado por primera aseguradora)
  -- =====================================================
  
  -- Buscar primera aseguradora válida del CSV
  SELECT id INTO v_insurer_id FROM insurers WHERE UPPER(name) = 'ASSA' LIMIT 1;
  
  INSERT INTO comm_imports (period_label, insurer_id, total_amount, is_life_insurance, created_at)
  VALUES (v_fortnight_id, v_insurer_id, ${rows.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0).toFixed(2)}, false, NOW())
  RETURNING id INTO v_import_id;

  RAISE NOTICE 'Import ID: %', v_import_id;

`;

// Generar INSERT para cada comisión
rows.forEach((row, idx) => {
  const policyNumber = row.policy_number;
  const clientName = row.client_name;
  const insurerName = row.insurer_name.toUpperCase();
  const brokerEmail = row.broker_email?.toLowerCase() || '';
  const policyType = row.policy_type?.toUpperCase() || '';
  const grossAmount = parseFloat(row.commission_amount) || 0;
  const startDate = parseDate(row.start_date);
  const renewalDate = parseDate(row.renewal_date);

  sql += `
  -- =====================================================
  -- FILA ${idx + 1}/${rows.length}: ${policyNumber} - ${clientName}
  -- =====================================================
  
  -- Buscar aseguradora
  SELECT id INTO v_insurer_id FROM insurers WHERE UPPER(name) = ${escapeSql(insurerName)} LIMIT 1;
  
  IF v_insurer_id IS NULL THEN
    RAISE WARNING 'Aseguradora no encontrada: ${insurerName} (fila ${row._rowNum})';
  END IF;

  -- Buscar broker por email
  v_broker_id := NULL;
  ${brokerEmail ? `SELECT id INTO v_broker_id FROM brokers WHERE LOWER(email) = ${escapeSql(brokerEmail)} LIMIT 1;` : '-- Sin broker email'}
  
  -- Determinar porcentaje
  v_is_vida_assa := (${escapeSql(insurerName)} = 'ASSA' AND ${escapeSql(policyType)} = 'VIDA');
  
  IF v_is_vida_assa THEN
    v_percentage := 1.0; -- 100% para VIDA en ASSA
  ELSIF v_broker_id IS NOT NULL THEN
    SELECT percent_default INTO v_percentage FROM brokers WHERE id = v_broker_id;
  ELSE
    v_percentage := 0; -- Sin broker = 0%
  END IF;
  
  v_net_amount := ${grossAmount} * v_percentage;

  -- Buscar póliza existente
  SELECT id, client_id INTO v_policy_id, v_client_id 
  FROM policies 
  WHERE policy_number = ${escapeSql(policyNumber)}
  LIMIT 1;

  IF v_policy_id IS NOT NULL THEN
    -- Póliza existe: actualizar
    UPDATE policies SET
      broker_id = COALESCE(v_broker_id, broker_id),
      insurer_id = COALESCE(v_insurer_id, insurer_id),
      start_date = COALESCE(${startDate}, start_date),
      renewal_date = COALESCE(${renewalDate}, renewal_date),
      percent_override = CASE WHEN v_is_vida_assa THEN 1.0 ELSE percent_override END
    WHERE id = v_policy_id;
    
    RAISE NOTICE 'Póliza actualizada: ${policyNumber}';
  ELSE
    -- Póliza NO existe: crear cliente y póliza
    
    -- Crear cliente
    INSERT INTO clients (name, broker_id, active, created_at)
    VALUES (${escapeSql(clientName)}, COALESCE(v_broker_id, (SELECT id FROM brokers LIMIT 1)), true, NOW())
    RETURNING id INTO v_client_id;
    
    -- Crear póliza
    INSERT INTO policies (
      policy_number, client_id, broker_id, insurer_id, 
      start_date, renewal_date, percent_override, status, created_at
    )
    VALUES (
      ${escapeSql(policyNumber)}, v_client_id, COALESCE(v_broker_id, (SELECT id FROM brokers LIMIT 1)), v_insurer_id,
      ${startDate}, ${renewalDate}, CASE WHEN v_is_vida_assa THEN 1.0 ELSE NULL END, 'ACTIVA', NOW()
    )
    RETURNING id INTO v_policy_id;
    
    RAISE NOTICE 'Cliente y póliza creados: ${policyNumber}';
  END IF;

  -- Crear comm_item
  INSERT INTO comm_items (
    import_id, policy_number, insured_name, insurer_id, broker_id, gross_amount, raw_row, created_at
  )
  VALUES (
    v_import_id, 
    ${escapeSql(policyNumber)}, 
    ${escapeSql(clientName)}, 
    v_insurer_id, 
    v_broker_id,
    ${grossAmount},
    jsonb_build_object(
      'policy_type', ${escapeSql(policyType)},
      'percentage_applied', v_percentage,
      'net_amount', v_net_amount,
      'is_vida_assa', v_is_vida_assa,
      'broker_email', ${escapeSql(brokerEmail)}
    ),
    NOW()
  );
`;
});

sql += `
  -- =====================================================
  -- 3. ACTUALIZAR FORTNIGHT_BROKER_TOTALS
  -- =====================================================
  
  -- Insertar o actualizar totales por broker
  INSERT INTO fortnight_broker_totals (fortnight_id, broker_id, gross_amount, net_amount, discounts_json, created_at)
  SELECT 
    v_fortnight_id,
    ci.broker_id,
    SUM(ci.gross_amount),
    SUM((ci.raw_row->>'net_amount')::NUMERIC),
    '{}'::jsonb,
    NOW()
  FROM comm_items ci
  WHERE ci.import_id = v_import_id
    AND ci.broker_id IS NOT NULL
  GROUP BY ci.broker_id
  ON CONFLICT (fortnight_id, broker_id) 
  DO UPDATE SET
    gross_amount = EXCLUDED.gross_amount,
    net_amount = EXCLUDED.net_amount;

  -- =====================================================
  -- RESUMEN
  -- =====================================================
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BULK UPLOAD COMPLETADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Quincena ID: %', v_fortnight_id;
  RAISE NOTICE 'Import ID: %', v_import_id;
  RAISE NOTICE 'Total comisiones: ${rows.length}';
  RAISE NOTICE '========================================';
  
  -- Mostrar resumen por broker
  FOR v_broker_id IN 
    SELECT DISTINCT broker_id FROM comm_items WHERE import_id = v_import_id AND broker_id IS NOT NULL
  LOOP
    RAISE NOTICE 'Broker ID: % | Comisiones: % | Neto: %',
      v_broker_id,
      (SELECT COUNT(*) FROM comm_items WHERE import_id = v_import_id AND broker_id = v_broker_id),
      (SELECT SUM((raw_row->>'net_amount')::NUMERIC) FROM comm_items WHERE import_id = v_import_id AND broker_id = v_broker_id);
  END LOOP;
  
  -- Sin identificar
  RAISE NOTICE 'Sin identificar: %', (SELECT COUNT(*) FROM comm_items WHERE import_id = v_import_id AND broker_id IS NULL);

END $$;

COMMIT;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver quincena creada
SELECT * FROM fortnights WHERE period_start = '2025-11-01' AND period_end = '2025-11-15';

-- Ver totales por broker
SELECT 
  b.name,
  fbt.gross_amount,
  fbt.net_amount,
  (SELECT COUNT(*) FROM comm_items ci WHERE ci.broker_id = b.id AND ci.import_id IN (SELECT id FROM comm_imports WHERE period_label IN (SELECT id FROM fortnights WHERE period_start = '2025-11-01'))) as num_comisiones
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
WHERE fbt.fortnight_id IN (SELECT id FROM fortnights WHERE period_start = '2025-11-01')
ORDER BY fbt.net_amount DESC;

-- Ver comisiones sin identificar
SELECT policy_number, insured_name, gross_amount
FROM comm_items
WHERE broker_id IS NULL
  AND import_id IN (SELECT id FROM comm_imports WHERE period_label IN (SELECT id FROM fortnights WHERE period_start = '2025-11-01'))
LIMIT 20;
`;

// Guardar SQL
fs.writeFileSync(OUTPUT_FILE, sql, 'utf-8');

console.log('\n✅ SQL generado exitosamente!');
console.log(`📄 Archivo: ${OUTPUT_FILE}`);
console.log(`\n📊 Estadísticas:`);
console.log(`   Total comisiones: ${rows.length}`);
console.log(`   Con broker: ${rows.filter(r => r.broker_email).length}`);
console.log(`   Sin broker: ${rows.filter(r => !r.broker_email).length}`);
console.log(`   VIDA en ASSA: ${rows.filter(r => r.insurer_name.toUpperCase() === 'ASSA' && r.policy_type?.toUpperCase() === 'VIDA').length}`);
console.log(`\n🚀 Para ejecutar:`);
console.log(`   1. Abre Supabase SQL Editor`);
console.log(`   2. Copia el contenido de bulk-upload-comisiones.sql`);
console.log(`   3. Ejecuta el script`);
