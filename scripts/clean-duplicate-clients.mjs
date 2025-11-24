#!/usr/bin/env node
/**
 * LIMPIEZA DE CLIENTES DUPLICADOS
 * 
 * Este script identifica y elimina clientes duplicados en la base de datos:
 * - Agrupa por: nombre + broker_id
 * - Mantiene: El cliente MÁS ANTIGUO (created_at menor)
 * - Reasigna: Todas las pólizas de duplicados al cliente principal
 * - Elimina: Los clientes duplicados
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findDuplicates() {
  console.log('\n🔍 BUSCANDO CLIENTES DUPLICADOS...\n');
  
  const { data: allClients, error } = await supabase
    .from('clients')
    .select('id, name, broker_id, created_at, active')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error obteniendo clientes:', error);
    throw error;
  }
  
  // Agrupar por name + broker_id
  const groups = new Map();
  
  (allClients || []).forEach(client => {
    const key = `${client.name}-${client.broker_id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(client);
  });
  
  // Filtrar solo grupos con duplicados
  const duplicateGroups = Array.from(groups.entries())
    .filter(([key, clients]) => clients.length > 1)
    .map(([key, clients]) => ({
      key,
      name: clients[0].name,
      broker_id: clients[0].broker_id,
      count: clients.length,
      clients: clients.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }));
  
  console.log(`📊 Total clientes: ${allClients?.length || 0}`);
  console.log(`🔄 Grupos duplicados: ${duplicateGroups.length}`);
  console.log(`❌ Clientes duplicados a eliminar: ${duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0)}\n`);
  
  return duplicateGroups;
}

async function cleanDuplicateGroup(group) {
  const principal = group.clients[0];  // El más antiguo
  const duplicates = group.clients.slice(1);  // Los demás
  
  console.log(`\n📝 Cliente: ${group.name} (${group.count} duplicados)`);
  console.log(`   ✅ Principal (mantener): ${principal.id.substring(0, 8)} (${principal.created_at})`);
  
  let totalPoliciesReassigned = 0;
  
  // Para cada duplicado
  for (const dup of duplicates) {
    console.log(`   ❌ Duplicado: ${dup.id.substring(0, 8)} (${dup.created_at})`);
    
    // 1. Reasignar pólizas al principal
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('id, policy_number')
      .eq('client_id', dup.id);
    
    if (policiesError) {
      console.error(`      ❌ Error obteniendo pólizas:`, policiesError.message);
      continue;
    }
    
    if (policies && policies.length > 0) {
      console.log(`      🔄 Reasignando ${policies.length} pólizas...`);
      
      const { error: updateError } = await supabase
        .from('policies')
        .update({ client_id: principal.id })
        .eq('client_id', dup.id);
      
      if (updateError) {
        console.error(`      ❌ Error reasignando pólizas:`, updateError.message);
        continue;
      }
      
      totalPoliciesReassigned += policies.length;
      console.log(`      ✅ ${policies.length} pólizas reasignadas`);
    } else {
      console.log(`      ℹ️  Sin pólizas para reasignar`);
    }
    
    // 2. Eliminar cliente duplicado
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', dup.id);
    
    if (deleteError) {
      console.error(`      ❌ Error eliminando duplicado:`, deleteError.message);
    } else {
      console.log(`      ✅ Duplicado eliminado`);
    }
  }
  
  console.log(`   📊 Total pólizas reasignadas: ${totalPoliciesReassigned}`);
  
  return {
    principal_id: principal.id,
    duplicates_removed: duplicates.length,
    policies_reassigned: totalPoliciesReassigned
  };
}

async function main() {
  console.log('🚀 LIMPIEZA DE CLIENTES DUPLICADOS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Buscar duplicados
    const duplicateGroups = await findDuplicates();
    
    if (duplicateGroups.length === 0) {
      console.log('✅ No hay clientes duplicados. Base de datos limpia!\n');
      return;
    }
    
    console.log(`⚠️  ATENCIÓN: Se encontraron ${duplicateGroups.length} grupos de duplicados`);
    console.log('   Se mantendrá el cliente MÁS ANTIGUO de cada grupo');
    console.log('   Las pólizas se reasignarán automáticamente\n');
    
    // Mostrar primeros 5 ejemplos
    console.log('📋 PRIMEROS 5 EJEMPLOS:\n');
    duplicateGroups.slice(0, 5).forEach(group => {
      console.log(`   • ${group.name} (${group.count} duplicados)`);
    });
    console.log('');
    
    // 2. Procesar cada grupo
    let totalProcessed = 0;
    let totalDuplicatesRemoved = 0;
    let totalPoliciesReassigned = 0;
    let errors = 0;
    
    for (const group of duplicateGroups) {
      try {
        const result = await cleanDuplicateGroup(group);
        totalProcessed++;
        totalDuplicatesRemoved += result.duplicates_removed;
        totalPoliciesReassigned += result.policies_reassigned;
      } catch (err) {
        console.error(`❌ Error procesando grupo:`, err.message);
        errors++;
      }
    }
    
    // 3. Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ LIMPIEZA COMPLETADA\n');
    console.log(`📊 RESUMEN FINAL:\n`);
    console.log(`   Grupos procesados:       ${totalProcessed}/${duplicateGroups.length}`);
    console.log(`   Duplicados eliminados:   ${totalDuplicatesRemoved}`);
    console.log(`   Pólizas reasignadas:     ${totalPoliciesReassigned}`);
    console.log(`   Errores:                 ${errors}\n`);
    
    // 4. Verificación post-limpieza
    const duplicatesAfter = await findDuplicates();
    if (duplicatesAfter.length === 0) {
      console.log('✅ Base de datos limpia, no hay más duplicados!');
    } else {
      console.log(`⚠️  Aún quedan ${duplicatesAfter.length} grupos duplicados (revisar errores)`);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
