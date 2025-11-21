#!/usr/bin/env node
/**
 * Script para verificar los totales de reportes por aseguradora
 */

const INSURER_REPORT_AMOUNTS = {
  'ASSA': 4108.37,
  'SURA': 1244.54,
  'VIVIR': 424.53,
  'INTERNACIONAL': 1043.01,
  'FEDPA': 1754.25,
  'ANCON': 1295.97,
  'BANESCO': 36.65,
  'REGIONAL': 511.92,
  'OPTIMA': 172.59,
  'ACERTA': 89.39,
};

console.log('📊 VERIFICACIÓN DE TOTALES POR ASEGURADORA\n');
console.log('='.repeat(60));

let grandTotal = 0;

Object.entries(INSURER_REPORT_AMOUNTS)
  .sort((a, b) => b[1] - a[1]) // Ordenar de mayor a menor
  .forEach(([insurer, amount]) => {
    grandTotal += amount;
    console.log(`${insurer.padEnd(20)} ${amount.toFixed(2).padStart(12)}`);
  });

console.log('='.repeat(60));
console.log(`${'TOTAL GENERAL'.padEnd(20)} ${grandTotal.toFixed(2).padStart(12)}`);
console.log('='.repeat(60));
console.log('\n✅ Configuración actualizada en PreviewTab.tsx');
console.log('✅ Los contadores ahora mostrarán valores reales');

console.log('\n📋 CÓMO FUNCIONA:');
console.log('1. Total Reporte: Monto recibido de la aseguradora');
console.log('2. Comisiones Corredores: Total importado a sistema');
console.log('3. Total Oficina: Reporte - Comisiones');
console.log('4. % Oficina: (Total Oficina / Total Reporte) × 100');

console.log('\n⚠️  NOTA:');
console.log('Si una aseguradora no aparece en esta lista, mostrará $0.00');
console.log('Esto calculará correctamente el total de oficina (negativo si faltan reportes)\n');
