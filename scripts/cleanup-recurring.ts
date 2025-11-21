import { actionCleanupRecurringAdvances } from '../src/app/(app)/commissions/actions';

async function runCleanup() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 LIMPIEZA AUTOMÁTICA DE ADELANTOS RECURRENTES');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  const result = await actionCleanupRecurringAdvances();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESULTADO:');
  console.log('═══════════════════════════════════════════════════════');
  
  if (result.ok) {
    console.log('✅ Limpieza exitosa!');
    console.log('');
    console.log(`📦 Adelantos duplicados eliminados: ${result.deleted}`);
    console.log(`🔄 Adelantos reseteados: ${result.reset}`);
    console.log('');
    console.log(`💬 ${result.message}`);
  } else {
    console.error('❌ Error:', result.error);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  process.exit(result.ok ? 0 : 1);
}

runCleanup().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
