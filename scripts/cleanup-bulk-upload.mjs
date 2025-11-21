/**
 * Limpia el bulk upload anterior para poder re-ejecutar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
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

async function cleanup() {
  console.log('\n🧹 LIMPIANDO BULK UPLOAD ANTERIOR\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Buscar quincena
  console.log('🔍 Buscando quincena Nov 2025...');
  const { data: fortnights } = await supabase
    .from('fortnights')
    .select('id')
    .eq('period_start', '2025-11-01')
    .eq('period_end', '2025-11-15');

  if (!fortnights || fortnights.length === 0) {
    console.log('   ℹ️  No se encontró quincena anterior');
    return;
  }

  const fortnightIds = fortnights.map(f => f.id);
  console.log(`   ✅ Encontradas ${fortnightIds.length} quincenas\n`);

  // 2. Buscar imports
  console.log('🔍 Buscando importaciones...');
  const { data: imports } = await supabase
    .from('comm_imports')
    .select('id')
    .in('period_label', fortnightIds);

  const importIds = imports?.map(i => i.id) || [];
  console.log(`   ✅ Encontradas ${importIds.length} importaciones\n`);

  // 3. Eliminar comm_items
  if (importIds.length > 0) {
    console.log('🗑️  Eliminando comm_items...');
    const { error: itemsError, count } = await supabase
      .from('comm_items')
      .delete()
      .in('import_id', importIds)
      .select('*', { count: 'exact', head: true });

    if (itemsError) {
      console.error('   ❌ Error:', itemsError.message);
    } else {
      console.log(`   ✅ ${count || 0} comm_items eliminados\n`);
    }
  }

  // 4. Eliminar comm_imports
  if (importIds.length > 0) {
    console.log('🗑️  Eliminando comm_imports...');
    const { error: importsError } = await supabase
      .from('comm_imports')
      .delete()
      .in('id', importIds);

    if (importsError) {
      console.error('   ❌ Error:', importsError.message);
    } else {
      console.log(`   ✅ ${importIds.length} imports eliminados\n`);
    }
  }

  // 5. Eliminar fortnight_broker_totals
  console.log('🗑️  Eliminando fortnight_broker_totals...');
  const { error: totalsError, count: totalsCount } = await supabase
    .from('fortnight_broker_totals')
    .delete()
    .in('fortnight_id', fortnightIds)
    .select('*', { count: 'exact', head: true });

  if (totalsError) {
    console.error('   ❌ Error:', totalsError.message);
  } else {
    console.log(`   ✅ ${totalsCount || 0} totales eliminados\n`);
  }

  // 6. Eliminar fortnights
  console.log('🗑️  Eliminando quincenas...');
  const { error: fortnightsError } = await supabase
    .from('fortnights')
    .delete()
    .in('id', fortnightIds);

  if (fortnightsError) {
    console.error('   ❌ Error:', fortnightsError.message);
  } else {
    console.log(`   ✅ ${fortnightIds.length} quincenas eliminadas\n`);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ LIMPIEZA COMPLETADA');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('💡 Ahora puedes ejecutar: node scripts/execute-bulk-upload.mjs\n');
}

cleanup().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
