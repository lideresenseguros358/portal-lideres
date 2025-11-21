#!/usr/bin/env node
/**
 * Script para probar la auto-asignación de items antiguos
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAutoAssign() {
  console.log('🔍 Verificando items pendientes antiguos...\n');

  // Buscar broker de oficina
  const { data: officeBroker, error: brokerError } = await supabase
    .from('brokers')
    .select('id, name, email')
    .eq('email', 'contacto@lideresenseguros.com')
    .single();

  if (brokerError || !officeBroker) {
    console.error('❌ No se encontró el broker de oficina');
    console.error(brokerError);
    return;
  }

  console.log('✅ Broker de oficina encontrado:');
  console.log(`   ID: ${officeBroker.id}`);
  console.log(`   Nombre: ${officeBroker.name}`);
  console.log(`   Email: ${officeBroker.email}\n`);

  // Buscar items pendientes sin asignar
  const { data: allPending, error: allError } = await supabase
    .from('pending_items')
    .select('id, policy_number, created_at, status, assigned_broker_id')
    .eq('status', 'open')
    .is('assigned_broker_id', null);

  if (allError) {
    console.error('❌ Error buscando items pendientes:', allError);
    return;
  }

  console.log(`📊 Total items pendientes sin asignar: ${allPending?.length || 0}\n`);

  if (!allPending || allPending.length === 0) {
    console.log('✅ No hay items pendientes sin asignar');
    return;
  }

  // Calcular antigüedad
  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  console.log(`📅 Fecha límite (90 días): ${ninetyDaysAgo.toLocaleDateString('es-PA')}\n`);

  let oldItemsCount = 0;
  const oldItems = [];

  allPending.forEach(item => {
    const createdDate = new Date(item.created_at);
    const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    
    console.log(`   Póliza: ${item.policy_number}`);
    console.log(`   Creado: ${createdDate.toLocaleDateString('es-PA')} (${daysDiff} días)`);
    
    if (createdDate < ninetyDaysAgo) {
      console.log(`   ⚠️  ANTIGUO - Debe asignarse automáticamente`);
      oldItemsCount++;
      oldItems.push(item);
    } else {
      console.log(`   ✅ Reciente`);
    }
    console.log('');
  });

  console.log(`\n📊 Resumen:`);
  console.log(`   Total pendientes: ${allPending.length}`);
  console.log(`   Items antiguos (>90 días): ${oldItemsCount}`);
  console.log(`   Items recientes: ${allPending.length - oldItemsCount}\n`);

  if (oldItemsCount > 0) {
    console.log(`⚠️  Hay ${oldItemsCount} item(s) que debería(n) asignarse automáticamente a:`);
    console.log(`   ${officeBroker.name} (${officeBroker.email})\n`);
    
    console.log('💡 Estos items se asignarán automáticamente cuando se cargue la UI de Ajustes\n');
  } else {
    console.log('✅ No hay items antiguos pendientes de auto-asignar\n');
  }
}

testAutoAssign()
  .then(() => {
    console.log('✅ Verificación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
