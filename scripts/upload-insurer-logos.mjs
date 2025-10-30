/**
 * Script para subir logos de aseguradoras a Supabase Storage
 * Ejecutar: node scripts/upload-insurer-logos.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeo de nombres de archivo a nombres en BD
const INSURER_NAME_MAP = {
  'ASSA': 'ASSA',
  'IFS': 'IFS',
  'WW MEDICAL': 'WWMEDICAL',
  'acerta': 'Acerta',
  'aliado': 'Aliado',
  'ancon': 'ANCON',
  'assistcard': 'AssistCard',
  'banesco seguros': 'BANESCO',
  'fedpa': 'FEDPA',
  'general de seguros': 'GENERAL',
  'internacional': 'Internacional',
  'mapfre': 'MAPFRE',
  'mb': 'MB',
  'mercantil': 'Mercantil',
  'optima': 'OPTIMA',
  'palig': 'Palig',
  'regional': 'Regional',
  'sura': 'SURA',
  'vivir': 'Vivir'
};

async function uploadLogo(filePath, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(fileName);
    const fileNameWithoutExt = path.basename(fileName, fileExt);
    
    // Nombre limpio para storage (sin espacios, lowercase)
    const storageFileName = `${fileNameWithoutExt.toLowerCase().replace(/\s+/g, '-')}${fileExt}`;
    
    // Upload a storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('insurer-logos')
      .upload(storageFileName, fileBuffer, {
        contentType: 'image/png',
        upsert: true, // Reemplaza si ya existe
      });

    if (uploadError) {
      console.error(`  ❌ Error subiendo ${fileName}:`, uploadError.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('insurer-logos')
      .getPublicUrl(storageFileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`  ❌ Error procesando ${fileName}:`, error.message);
    return null;
  }
}

async function updateInsurerLogo(insurerName, logoUrl) {
  const { data, error } = await supabase
    .from('insurers')
    .update({ logo_url: logoUrl })
    .ilike('name', `%${insurerName}%`)
    .select();

  if (error) {
    console.error(`  ❌ Error actualizando BD para ${insurerName}:`, error.message);
    return false;
  }

  if (!data || data.length === 0) {
    console.warn(`  ⚠️  No se encontró aseguradora con nombre similar a: ${insurerName}`);
    return false;
  }

  return true;
}

async function main() {
  console.log('🚀 Iniciando carga de logos de aseguradoras...\n');

  const logosDir = path.join(__dirname, '..', 'public', 'aseguradoras');
  
  if (!fs.existsSync(logosDir)) {
    console.error(`❌ No se encontró el directorio: ${logosDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(logosDir).filter(f => f.endsWith('.png'));
  
  console.log(`📁 Encontrados ${files.length} logos\n`);

  let uploaded = 0;
  let updated = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(logosDir, file);
    const fileNameWithoutExt = path.basename(file, '.png');
    const insurerName = INSURER_NAME_MAP[fileNameWithoutExt] || fileNameWithoutExt;

    console.log(`📤 Procesando: ${file}`);
    console.log(`   Aseguradora: ${insurerName}`);

    // Upload to storage
    const logoUrl = await uploadLogo(filePath, file);
    
    if (logoUrl) {
      console.log(`   ✅ Subido a storage`);
      uploaded++;

      // Update database
      const success = await updateInsurerLogo(insurerName, logoUrl);
      if (success) {
        console.log(`   ✅ Base de datos actualizada`);
        console.log(`   🔗 URL: ${logoUrl}`);
        updated++;
      }
    } else {
      failed++;
    }

    console.log('');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN:');
  console.log(`   Total archivos: ${files.length}`);
  console.log(`   ✅ Subidos a storage: ${uploaded}`);
  console.log(`   ✅ BD actualizada: ${updated}`);
  console.log(`   ❌ Fallidos: ${failed}`);
  console.log('='.repeat(60));

  if (updated === files.length) {
    console.log('\n🎉 ¡Todos los logos fueron subidos y actualizados correctamente!');
  } else if (updated > 0) {
    console.log('\n⚠️  Algunos logos no pudieron ser procesados. Revisa los errores arriba.');
  } else {
    console.log('\n❌ No se pudo procesar ningún logo. Verifica la configuración.');
  }
}

main().catch(console.error);
