/**
 * Script para parsear datos de bulk import y convertirlos a JSON
 * Formato esperado: texto con columnas de ancho fijo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para parsear una línea de datos
function parseLine(line) {
  // Quitar espacios extras y dividir por múltiples espacios
  const parts = line.trim().split(/\s{2,}/);
  
  if (parts.length < 10) {
    console.warn(`⚠️  Línea con pocos campos (${parts.length}):`, line.substring(0, 100));
    return null;
  }

  // Extraer campos
  const [
    client_name,
    national_id,
    email,
    phone,
    address, // ignorado por ahora
    policy_number,
    insurer_name,
    ramo,
    start_date,
    renewal_date,
    ...rest
  ] = parts;

  // Los últimos campos son broker_email y commission
  const broker_email = rest[rest.length - 2] || '';
  const commission = rest[rest.length - 1] || '';

  // Validar campos obligatorios
  if (!client_name || !policy_number || !insurer_name) {
    console.warn('⚠️  Falta client_name, policy_number o insurer_name:', line.substring(0, 100));
    return null;
  }

  if (!broker_email || !broker_email.includes('@')) {
    console.warn('⚠️  Falta broker_email válido:', line.substring(0, 100));
    return null;
  }

  // Parsear fechas (formato DD/MM/YY)
  function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    
    let [day, month, year] = parts;
    
    // Convertir año de 2 dígitos a 4 dígitos
    if (year.length === 2) {
      const yearNum = parseInt(year);
      // Si es mayor a 50, asumimos 1900s, sino 2000s
      year = yearNum > 50 ? `19${year}` : `20${year}`;
    }
    
    // Formato YYYY-MM-DD
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const start_date_parsed = parseDate(start_date);
  const renewal_date_parsed = parseDate(renewal_date);

  // Parsear commission percentage
  let percent_override = null;
  if (commission && commission !== '' && !isNaN(parseFloat(commission))) {
    percent_override = parseFloat(commission);
  }

  return {
    client_name: client_name.trim(),
    national_id: national_id && national_id.trim() !== '' ? national_id.trim() : null,
    email: email && email.trim() !== '' && email.includes('@') ? email.trim() : null,
    phone: phone && phone.trim() !== '' ? phone.trim() : null,
    policy_number: policy_number.trim(),
    insurer_name: insurer_name.trim().toUpperCase(),
    ramo: ramo && ramo.trim() !== '' ? ramo.trim() : null,
    start_date: start_date_parsed,
    renewal_date: renewal_date_parsed,
    broker_email: broker_email.trim().toLowerCase(),
    percent_override: percent_override,
  };
}

// Leer archivo de datos
const dataFile = path.join(__dirname, '..', 'DATOS_IMPORT.txt');

if (!fs.existsSync(dataFile)) {
  console.error('❌ No se encontró el archivo DATOS_IMPORT.txt');
  console.log('📝 Por favor, crea el archivo en la raíz del proyecto con los datos a importar.');
  process.exit(1);
}

console.log('📖 Leyendo archivo de datos...');
const rawData = fs.readFileSync(dataFile, 'utf-8');
const lines = rawData.split('\n').filter(line => line.trim() !== '');

console.log(`📊 Total de líneas: ${lines.length}`);

// Parsear líneas
const parsed = [];
let skipped = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Saltar línea de encabezado si existe
  if (i === 0 && line.includes('client_name')) {
    console.log('⏭️  Saltando línea de encabezado');
    continue;
  }
  
  const record = parseLine(line);
  if (record) {
    parsed.push(record);
  } else {
    skipped++;
  }
}

console.log(`✅ Registros parseados: ${parsed.length}`);
console.log(`⚠️  Registros omitidos: ${skipped}`);

// Agrupar por broker_email
const byBroker = {};
parsed.forEach(record => {
  if (!byBroker[record.broker_email]) {
    byBroker[record.broker_email] = [];
  }
  byBroker[record.broker_email].push(record);
});

console.log(`\n👥 Brokers únicos: ${Object.keys(byBroker).length}`);
Object.entries(byBroker).forEach(([email, records]) => {
  console.log(`   - ${email}: ${records.length} pólizas`);
});

// Aseguradoras únicas
const insurers = new Set(parsed.map(r => r.insurer_name));
console.log(`\n🏢 Aseguradoras únicas: ${insurers.size}`);
insurers.forEach(ins => console.log(`   - ${ins}`));

// Ramos únicos
const ramos = new Set(parsed.filter(r => r.ramo).map(r => r.ramo));
console.log(`\n📋 Ramos únicos: ${ramos.size}`);
ramos.forEach(ramo => console.log(`   - ${ramo}`));

// Guardar JSON
const outputFile = path.join(__dirname, '..', 'DATOS_IMPORT.json');
fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2), 'utf-8');
console.log(`\n💾 JSON guardado en: ${outputFile}`);

// Crear archivos por broker (opcional, para imports más pequeños)
const brokersDir = path.join(__dirname, '..', 'import_by_broker');
if (!fs.existsSync(brokersDir)) {
  fs.mkdirSync(brokersDir, { recursive: true });
}

Object.entries(byBroker).forEach(([email, records]) => {
  const filename = email.replace(/[^a-z0-9]/gi, '_') + '.json';
  const filepath = path.join(brokersDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(records, null, 2), 'utf-8');
});

console.log(`📂 Archivos por broker guardados en: ${brokersDir}`);

// Generar estadísticas
console.log('\n📊 ESTADÍSTICAS:');
console.log(`   Total registros: ${parsed.length}`);
console.log(`   Con national_id: ${parsed.filter(r => r.national_id).length}`);
console.log(`   Con email: ${parsed.filter(r => r.email).length}`);
console.log(`   Con phone: ${parsed.filter(r => r.phone).length}`);
console.log(`   Con ramo: ${parsed.filter(r => r.ramo).length}`);
console.log(`   Con start_date: ${parsed.filter(r => r.start_date).length}`);
console.log(`   Con renewal_date: ${parsed.filter(r => r.renewal_date).length}`);
console.log(`   Con percent_override: ${parsed.filter(r => r.percent_override !== null).length}`);

console.log('\n✅ Proceso completado!');
console.log('\n🔄 Siguiente paso:');
console.log('   1. Revisa el archivo DATOS_IMPORT.json');
console.log('   2. Ejecuta el bulk import en Supabase con:');
console.log('      SELECT * FROM bulk_import_clients_policies(\'[... contenido del JSON ...]\');');
