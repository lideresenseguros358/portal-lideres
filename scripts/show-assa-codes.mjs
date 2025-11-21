/**
 * Muestra los códigos ASSA asignados a brokers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function showAssaCodes() {
  console.log('\n🔍 CÓDIGOS ASSA EN BASE DE DATOS\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Obtener todos los brokers con código ASSA
  const { data: brokers, error } = await supabase
    .from('brokers')
    .select('id, name, email, assa_code')
    .order('assa_code', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const withCode = brokers.filter(b => b.assa_code && b.assa_code.trim() !== '');
  const withoutCode = brokers.filter(b => !b.assa_code || b.assa_code.trim() === '');

  console.log(`📊 BROKERS CON CÓDIGO ASSA: ${withCode.length}\n`);
  withCode.forEach((b, idx) => {
    console.log(`${idx + 1}. ${b.assa_code}`);
    console.log(`   Email: ${b.email}`);
    console.log(`   Nombre: ${b.name}\n`);
  });

  console.log(`\n⚠️  BROKERS SIN CÓDIGO ASSA: ${withoutCode.length}\n`);

  console.log('═══════════════════════════════════════════════════════\n');
}

showAssaCodes().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});
