-- =====================================================
-- DESACTIVAR TRIGGER INCORRECTO DE COMISIONES
-- =====================================================
-- El trigger update_clients_policies_from_commissions está AL REVÉS
-- 
-- FLUJO CORRECTO:
-- policies (broker_id) → SE CONSULTA → comm_items (obtiene broker_id)
--
-- FLUJO INCORRECTO (trigger):
-- comm_items (broker_id) → ACTUALIZA → policies (broker_id) ❌
--
-- SOLUCIÓN: Eliminar el trigger porque el flujo es:
-- 1. Pólizas ya tienen broker_id cuando se crean
-- 2. Import CONSULTA policies para identificar broker
-- 3. NO se debe actualizar policies desde comisiones
-- =====================================================

-- Eliminar el trigger
DROP TRIGGER IF EXISTS trg_update_clients_policies_from_comm ON comm_items;

-- Eliminar la función del trigger
DROP FUNCTION IF EXISTS update_clients_policies_from_commissions();

-- Eliminar la función batch (no se usa)
DROP FUNCTION IF EXISTS batch_update_clients_policies_from_commissions();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver que el trigger ya no existe
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_update_clients_policies_from_comm';
-- Debe retornar 0 filas

-- Ver que la función ya no existe
SELECT 
  proname as function_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'update_clients_policies_from_commissions';
-- Debe retornar 0 filas

-- =====================================================
-- DOCUMENTACIÓN DEL FLUJO CORRECTO
-- =====================================================

/*
FLUJO REAL DEL SISTEMA DE COMISIONES:

1. CREACIÓN DE PÓLIZA (en /db):
   - Cliente se crea con broker_id
   - Póliza se crea con broker_id Y percent_override (opcional)
   - policies.broker_id ya está asignado desde el inicio

2. IMPORT DE REPORTE (en /commissions):
   a) Parseo del archivo
      - Se extraen: policy_number, commission_amount (RAW)
   
   b) Identificación de broker
      - SELECT * FROM policies WHERE policy_number IN (...)
      - Se OBTIENE el broker_id de policies
      - NO se actualiza nada
   
   c) Separación de items
      - Con broker → comm_items (con broker_id)
      - Sin broker → pending_items (sin broker_id)
   
   d) Cálculo de comisión
      - Busca: policy.percent_override || broker.percent_default
      - Calcula: commission_raw × (percent / 100)
      - Resultado: gross_amount para el broker

3. GENERACIÓN DE QUINCENA:
   - Agrupa comm_items por broker_id
   - Suma gross_amount por broker
   - Aplica adelantos/descuentos
   - Genera fortnight_broker_totals

POLÍTICAS NO CAMBIA NUNCA DESPUÉS DE LA CREACIÓN.
EL IMPORT SOLO CONSULTA, NO ACTUALIZA.

POR ESO EL TRIGGER ESTABA MAL Y CAUSABA EL ERROR.
*/

-- =====================================================
-- RESUMEN
-- =====================================================

/*
✅ TRIGGER ELIMINADO: trg_update_clients_policies_from_comm
✅ FUNCIÓN ELIMINADA: update_clients_policies_from_commissions()
✅ FUNCIÓN BATCH ELIMINADA: batch_update_clients_policies_from_commissions()

RAZÓN:
- El flujo es policies → comm_items (CONSULTA)
- No es comm_items → policies (ACTUALIZACIÓN)
- El trigger intentaba escribir en policies.updated_at (no existe)
- El trigger causaba error 42703 en imports

RESULTADO:
- Imports funcionarán correctamente
- No habrá intentos de actualizar policies
- El flujo es más claro y correcto
- Elimina la columna updated_at inexistente

EJECUTAR EN SUPABASE SQL EDITOR:
1. Copiar todo este archivo
2. Pegar en SQL Editor
3. Run (F5)
4. Probar import de nueva quincena
5. ✅ Debe funcionar sin errores
*/
