/**
 * Script para probar el bulk upload de comisiones
 * Uso: node scripts/upload-bulk-commissions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || 'http://localhost:3000';
const CSV_FILE = path.join(__dirname, '..', 'public', 'plantilla_comisiones_quincena.csv');

async function uploadCSV() {
  console.log('🚀 BULK UPLOAD DE COMISIONES - Primera Quincena Nov 2025\n');

  // Verificar que existe el archivo
  if (!fs.existsSync(CSV_FILE)) {
    console.error('❌ No se encontró el archivo CSV:', CSV_FILE);
    process.exit(1);
  }

  console.log('📄 Archivo CSV:', CSV_FILE);
  
  // Leer archivo
  const fileBuffer = fs.readFileSync(CSV_FILE);
  const fileBlob = new Blob([fileBuffer], { type: 'text/csv' });
  
  // Crear FormData
  const formData = new FormData();
  formData.append('file', fileBlob, 'plantilla_comisiones_quincena.csv');

  console.log('\n📤 Subiendo a:', `${API_URL}/api/commissions/bulk-upload`);
  console.log('⏳ Procesando...\n');

  try {
    const response = await fetch(`${API_URL}/api/commissions/bulk-upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }

    // Mostrar resumen
    console.log('✅ PROCESAMIENTO COMPLETADO\n');
    console.log('📊 RESUMEN:');
    console.log(`   Total filas:      ${result.summary.total}`);
    console.log(`   ✅ Exitosas:      ${result.summary.success}`);
    console.log(`   ❌ Errores:       ${result.summary.errors}`);
    console.log(`   ⚠️  No identificados: ${result.summary.unidentified}`);
    
    console.log(`\n🆔 IDs Creados:`);
    console.log(`   Quincena:  ${result.fortnight_id}`);
    console.log(`   Import:    ${result.import_id}`);

    // Mostrar primeras 10 procesadas
    console.log('\n📋 PRIMERAS 10 COMISIONES PROCESADAS:\n');
    result.processed.slice(0, 10).forEach((p, i) => {
      const status = p.status === 'success' ? '✅' : p.status === 'unidentified' ? '⚠️' : '❌';
      console.log(`${i + 1}. ${status} ${p.policy_number} - ${p.client_name}`);
      console.log(`   Broker: ${p.broker_name || 'SIN IDENTIFICAR'} (${p.broker_email || 'N/A'})`);
      console.log(`   Bruto: $${p.gross_amount.toFixed(2)} | Neto: $${p.net_amount.toFixed(2)} (${(p.percentage_applied * 100).toFixed(1)}%)`);
      if (p.is_vida_assa) console.log(`   🔥 VIDA ASSA - 100% aplicado`);
      if (p.error_message) console.log(`   Error: ${p.error_message}`);
      console.log('');
    });

    // Contar comisiones VIDA en ASSA
    const vidaAssaCount = result.processed.filter(p => p.is_vida_assa).length;
    const totalNet = result.processed.reduce((sum, p) => sum + p.net_amount, 0);
    const totalGross = result.processed.reduce((sum, p) => sum + p.gross_amount, 0);

    console.log('💰 TOTALES:');
    console.log(`   Monto Bruto:  $${totalGross.toFixed(2)}`);
    console.log(`   Monto Neto:   $${totalNet.toFixed(2)}`);
    console.log(`   VIDA ASSA:    ${vidaAssaCount} pólizas (100%)`);

    // Brokers únicos
    const uniqueBrokers = new Set(
      result.processed
        .filter(p => p.broker_email)
        .map(p => p.broker_email)
    );

    console.log(`\n👥 BROKERS ÚNICOS: ${uniqueBrokers.size}`);
    uniqueBrokers.forEach(email => {
      const brokerRows = result.processed.filter(p => p.broker_email === email);
      const brokerNet = brokerRows.reduce((sum, p) => sum + p.net_amount, 0);
      const brokerName = brokerRows[0]?.broker_name || email;
      console.log(`   ${brokerName}: ${brokerRows.length} pólizas - $${brokerNet.toFixed(2)}`);
    });

    // Sin identificar
    const unidentified = result.processed.filter(p => p.status === 'unidentified');
    if (unidentified.length > 0) {
      console.log(`\n⚠️  COMISIONES SIN IDENTIFICAR (${unidentified.length}):`);
      unidentified.forEach(p => {
        console.log(`   ${p.policy_number} - ${p.client_name} - $${p.gross_amount.toFixed(2)}`);
      });
      console.log('\n💡 Estas comisiones aparecerán en la sección de AJUSTES');
    }

    // Errores
    const errors = result.processed.filter(p => p.status === 'error');
    if (errors.length > 0) {
      console.log(`\n❌ ERRORES (${errors.length}):`);
      errors.forEach(p => {
        console.log(`   Fila ${p.row_number}: ${p.error_message}`);
      });
    }

    console.log('\n✅ Upload completado exitosamente!');
    console.log(`\n🔗 Ver en: ${API_URL}/commissions`);

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar
uploadCSV();
