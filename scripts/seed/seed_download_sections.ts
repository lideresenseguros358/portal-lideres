/**
 * Script para poblar download_sections con trámites para todas las aseguradoras
 * 
 * Crea automáticamente las secciones de trámites para cada aseguradora activa:
 * - Emision
 * - Renovacion
 * - Endoso
 * - Cancelacion
 * - Reclamos
 * - Otros
 * 
 * Para cada tipo de póliza: auto, salud, vida, hogar, comercial
 * 
 * Ejecutar: npx ts-node scripts/seed/seed_download_sections.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Definir todos los trámites/secciones disponibles
const TRAMITES = [
  { name: 'Requisitos', slug: 'requisitos' },
  { name: 'Formularios', slug: 'formularios' },
  { name: 'Anexos', slug: 'anexos' },
  { name: 'Guías', slug: 'guias' },
  { name: 'Otros', slug: 'otros' },
];

// Definir tipos de póliza - Generales
const POLICY_TYPES_GENERALES = [
  { type: 'auto', name: 'Auto' },
  { type: 'incendio', name: 'Incendio' },
  { type: 'multipoliza', name: 'Multipóliza' },
  { type: 'rc', name: 'Responsabilidad Civil' },
  { type: 'fianzas', name: 'Fianzas' },
  { type: 'flotas', name: 'Flotas' },
  { type: 'car', name: 'CAR' },
  { type: 'casco_marino', name: 'Casco Marino' },
  { type: 'casco_aereo', name: 'Casco Aéreo' },
  { type: 'transporte', name: 'Transporte' },
  { type: 'carga', name: 'Carga' },
  { type: 'otros', name: 'Otros' },
];

// Definir tipos de póliza - Personas
const POLICY_TYPES_PERSONAS = [
  { type: 'vida_assa', name: 'VIDA ASSA' },
  { type: 'vida', name: 'Vida (otras)' },
  { type: 'salud', name: 'Salud' },
  { type: 'ap', name: 'Accidentes Personales' },
  { type: 'colectivos', name: 'Colectivos' },
];

async function main() {
  console.log('🚀 Iniciando creación de secciones de descargas...\n');

  try {
    // 1. Obtener todas las aseguradoras activas
    const { data: insurers, error: insurersError } = await supabase
      .from('insurers')
      .select('id, name, active')
      .eq('active', true)
      .order('name');

    if (insurersError) {
      throw new Error(`Error obteniendo aseguradoras: ${insurersError.message}`);
    }

    if (!insurers || insurers.length === 0) {
      console.log('⚠️  No se encontraron aseguradoras activas');
      return;
    }

    console.log(`✅ Encontradas ${insurers.length} aseguradoras activas:\n`);
    insurers.forEach(ins => console.log(`   - ${ins.name}`));
    console.log('');

    let totalCreated = 0;
    let totalSkipped = 0;

    // 2. Para cada aseguradora, crear todas las secciones
    for (const insurer of insurers) {
      console.log(`📁 Procesando ${insurer.name}...`);

      // Procesar tipos de póliza GENERALES
      for (const policyType of POLICY_TYPES_GENERALES) {
        for (const tramite of TRAMITES) {
          const sectionName = `${tramite.name}`;
          
          // Verificar si ya existe
          const { data: existing } = await supabase
            .from('download_sections')
            .select('id')
            .eq('insurer_id', insurer.id)
            .eq('policy_type', policyType.type)
            .eq('name', sectionName)
            .eq('scope', 'generales')
            .single();

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Crear la sección
          const { error: insertError } = await supabase
            .from('download_sections')
            .insert({
              insurer_id: insurer.id,
              name: sectionName,
              policy_type: policyType.type,
              scope: 'generales',
              display_order: TRAMITES.indexOf(tramite) + 1,
            });

          if (insertError) {
            console.error(`   ❌ Error creando "${sectionName}" (${policyType.name}): ${insertError.message}`);
          } else {
            totalCreated++;
          }
        }
      }

      // Procesar tipos de póliza PERSONAS
      for (const policyType of POLICY_TYPES_PERSONAS) {
        for (const tramite of TRAMITES) {
          const sectionName = `${tramite.name}`;
          
          // Verificar si ya existe
          const { data: existing } = await supabase
            .from('download_sections')
            .select('id')
            .eq('insurer_id', insurer.id)
            .eq('policy_type', policyType.type)
            .eq('name', sectionName)
            .eq('scope', 'personas')
            .single();

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Crear la sección
          const { error: insertError } = await supabase
            .from('download_sections')
            .insert({
              insurer_id: insurer.id,
              name: sectionName,
              policy_type: policyType.type,
              scope: 'personas',
              display_order: TRAMITES.indexOf(tramite) + 1,
            });

          if (insertError) {
            console.error(`   ❌ Error creando "${sectionName}" (${policyType.name}): ${insertError.message}`);
          } else {
            totalCreated++;
          }
        }
      }

      console.log(`   ✅ Completado para ${insurer.name}\n`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Secciones creadas: ${totalCreated}`);
    console.log(`   ⏭️  Secciones existentes (omitidas): ${totalSkipped}`);
    console.log(`   📁 Aseguradoras procesadas: ${insurers.length}`);
    console.log('═══════════════════════════════════════\n');

    console.log('🎉 ¡Proceso completado exitosamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Ir a /downloads en el portal');
    console.log('   2. Seleccionar aseguradora');
    console.log('   3. Seleccionar tipo de póliza');
    console.log('   4. Seleccionar trámite');
    console.log('   5. Subir PDF del trámite');

  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error no controlado:', error);
    process.exit(1);
  });
