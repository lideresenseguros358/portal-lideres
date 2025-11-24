# PLAN DE IMPLEMENTACIÓN - FLUJO DE NUEVA QUINCENA

## FECHA: 2025-01-24

## ARCHIVOS CREADOS ✅

### 1. Documentación
- ✅ `ANALISIS_FLUJO_QUINCENA.md` - Análisis completo del problema y solución
- ✅ `IMPLEMENTACION_PLAN.md` - Este archivo (plan de acción)

### 2. Migración SQL
- ✅ `migrations/20250124_create_fortnight_details.sql` - Nueva tabla para historial detallado

### 3. Scripts de Limpieza e Importación
- ✅ `scripts/clean-duplicate-clients.mjs` - Limpiar clientes duplicados
- ✅ `scripts/bulk-import-optimized.mjs` - Bulk import corregido con 3 CSVs

## PASOS DE IMPLEMENTACIÓN

### PASO 1: Ejecutar Migración SQL ⏳

```bash
# 1. Copiar contenido de migrations/20250124_create_fortnight_details.sql
# 2. Ir a Supabase Dashboard → SQL Editor
# 3. Pegar y ejecutar
# 4. Verificar: SELECT * FROM fortnight_details LIMIT 1;
```

**Qué hace:**
- Crea tabla `fortnight_details` con todos los campos necesarios
- Crea índices para performance
- Habilita RLS con políticas correctas
- Crea vista `fortnight_details_full` con joins
- Crea función `get_fortnight_summary(fortnight_id)` para resúmenes
- Añade trigger de validación de datos

**Resultado esperado:**
```sql
-- Debe retornar la estructura de la tabla
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fortnight_details';
```

---

### PASO 2: Regenerar Types de TypeScript ⏳

```bash
# Desde la raíz del proyecto
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts

# O si tienes configurado el Supabase CLI local
npx supabase gen types typescript --local > src/lib/database.types.ts
```

**Qué hace:**
- Agrega `fortnight_details` a los types
- Actualiza `database.types.ts` con la nueva estructura

**Verificación:**
```bash
npm run typecheck  # Debe pasar sin errores
```

---

### PASO 3: Limpiar Clientes Duplicados ⏳

```bash
# Desde la raíz del proyecto
node scripts/clean-duplicate-clients.mjs
```

**Qué hace:**
1. Busca clientes duplicados (mismo nombre + mismo broker)
2. Mantiene el cliente MÁS ANTIGUO de cada grupo
3. Reasigna todas las pólizas al cliente principal
4. Elimina los clientes duplicados

**Output esperado:**
```
🚀 LIMPIEZA DE CLIENTES DUPLICADOS

🔍 BUSCANDO CLIENTES DUPLICADOS...

📊 Total clientes: 500
🔄 Grupos duplicados: 23
❌ Clientes duplicados a eliminar: 45

...

✅ LIMPIEZA COMPLETADA

📊 RESUMEN FINAL:
   Grupos procesados:       23/23
   Duplicados eliminados:   45
   Pólizas reasignadas:     120
   Errores:                 0

✅ Base de datos limpia, no hay más duplicados!
```

---

### PASO 4: Ejecutar Bulk Import Optimizado ⏳

**Prerrequisitos:**
- Tener los 3 CSVs en `public/`:
  - `total_reportes_por_aseguradora.csv`
  - `plantilla_comisiones_quincena.csv`
  - `plantilla_codigos_assa.csv`

```bash
# Ejecutar el import
node scripts/bulk-import-optimized.mjs
```

**Qué hace:**
1. Limpia datos de quincena anterior (NO clients ni policies)
2. Crea nueva quincena (status = 'PAID')
3. Importa reportes con `total_amount`
4. Importa comisiones:
   - Crea/actualiza clientes (sin duplicar)
   - Crea/actualiza pólizas con `percent_override` correcto
   - Calcula comisión aplicando porcentaje
5. Importa códigos ASSA al 100%
6. **Guarda detalle completo en `fortnight_details`**
7. Calcula totales por broker
8. Inserta en `fortnight_broker_totals`

**Output esperado:**
```
🚀 BULK IMPORT OPTIMIZADO - QUINCENA COMPLETA

🗑️  LIMPIANDO DATOS DE QUINCENA...
✅ Datos de quincena limpiados (clients y policies intactos)

✅ 10 aseguradoras, 15 brokers
✅ LISSA broker ID: abc-123-def

📊 IMPORTANDO REPORTES DE ASEGURADORAS...
✅ ASSA                 $4108.37
✅ SURA                 $1244.54
...

💰 IMPORTANDO COMISIONES DE PÓLIZAS...
✅ Con broker: 450
⏳ Pendientes: 23
❌ Errores: 2

🔢 IMPORTANDO CÓDIGOS ASSA...
✅ Códigos asignados: 18
🏢 Huérfanos a LISSA: 3

💾 INSERTANDO ITEMS EN BASE DE DATOS...
✅ 471 items insertados en comm_items

📋 GUARDANDO DETALLE EN fortnight_details...
✅ 471 detalles guardados

📊 CALCULANDO TOTALES POR BROKER...
✅ Totales insertados para 15 brokers

✅ IMPORTACIÓN COMPLETADA

📊 RESUMEN FINAL:
   Total Reportes:         $10,681.22
   Total Corredores:       $ 8,950.50
   Ganancia Oficina:       $ 1,730.72
   Items con broker:       471
   Items sin broker:       23
   Brokers con comisión:   15
```

---

### PASO 5: Modificar actionPayFortnight ⏳

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Modificaciones necesarias:**

1. **NO borrar comm_items ni comm_imports**
   - Eliminar cualquier DELETE de estas tablas
   - Solo cambiar `status = 'PAID'` en fortnights

2. **Guardar detalle en fortnight_details**
   - Después de cambiar status a PAID
   - Antes de crear logs de adelantos

**Pseudocódigo:**
```typescript
export async function actionPayFortnight(fortnight_id: string) {
  // ... validaciones actuales ...
  
  // 1. Cambiar status a PAID
  await supabase
    .from('fortnights')
    .update({ status: 'PAID' })
    .eq('id', fortnight_id);
  
  // 2. NUEVO: Guardar detalle en fortnight_details
  const { data: commItems } = await supabase
    .from('comm_items')
    .select(`
      *,
      policies (id, percent_override, ramo, client_id),
      brokers (percent_default)
    `)
    .eq('fortnight_id', fortnight_id);
  
  const detailsToInsert = commItems.map(item => {
    const percentApplied = item.policies?.percent_override ?? 
                          item.brokers?.percent_default ?? 
                          1.0;
    const commissionRaw = item.gross_amount / percentApplied;
    
    return {
      fortnight_id,
      broker_id: item.broker_id,
      insurer_id: item.insurer_id,
      policy_id: item.policies?.id,
      client_id: item.policies?.client_id,
      policy_number: item.policy_number,
      client_name: item.insured_name,
      ramo: item.policies?.ramo,
      commission_raw: commissionRaw,
      percent_applied: percentApplied,
      commission_calculated: item.gross_amount,
      is_assa_code: item.policy_number.startsWith('PJ750'),
      assa_code: item.policy_number.startsWith('PJ750') ? item.policy_number : null,
      source_import_id: item.import_id
    };
  });
  
  await supabase
    .from('fortnight_details')
    .insert(detailsToInsert);
  
  // 3. Continuar con lógica actual (logs de adelantos, etc.)
  // ... resto del código ...
}
```

---

### PASO 6: Componente de Vista de Historial Detallado ⏳

**Nuevo componente:** `src/components/commissions/FortnightDetailView.tsx`

**Props:**
```typescript
interface FortnightDetailViewProps {
  fortnightId: string;
}
```

**Funcionalidad:**
- Obtiene datos de `fortnight_details` para la quincena
- Agrupa por broker
- Muestra detalle expandible por aseguradora
- Muestra códigos ASSA separados
- Calcula totales y ganancia oficina

**Diseño:**
```
┌─────────────────────────────────────────────────────────┐
│ QUINCENA: 1-15 Noviembre 2025                          │
│ Estado: PAGADA                                         │
├─────────────────────────────────────────────────────────┤
│ TOTALES GENERALES:                                     │
│   Total Reportes:      $10,681.22                     │
│   Total Corredores:    $ 8,950.50                     │
│   Ganancia Oficina:    $ 1,730.72                     │
├─────────────────────────────────────────────────────────┤
│ CORREDORES PAGADOS (15)                                │
│                                                        │
│ ▼ Juan Pérez                                           │
│   ┌─────────────────────────────────────────────┐     │
│   │ ASSA                        $1,500.00       │     │
│   │   • Cliente A - POL-001     $800.00 (85%)  │     │
│   │   • Cliente B - POL-002     $700.00 (85%)  │     │
│   │ SURA                        $  500.00       │     │
│   │   • Cliente C - POL-003     $500.00 (85%)  │     │
│   │ Códigos ASSA                $  300.00       │     │
│   │   • PJ750-10                $150.00 (100%) │     │
│   │   • PJ750-11                $150.00 (100%) │     │
│   ├─────────────────────────────────────────────┤     │
│   │ Total Bruto:    $2,300.00                  │     │
│   │ Descuentos:     $  200.00                  │     │
│   │ Neto Pagado:    $2,100.00                  │     │
│   └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

### PASO 7: Botones Retener y Descontar ⏳

**Ubicación:** En la lista de corredores durante la quincena DRAFT

**Botón "Retener":**
- Marca `fortnight_broker_totals.is_retained = true`
- Excluye del TXT bancario
- Al cerrar quincena → mueve a "Ajustes Retenidos"

**Botón "Descontar":**
- Abre modal con deudas activas del corredor
- Permite seleccionar múltiples adelantos
- Actualiza `discounts_json` en fortnight_broker_totals
- Recalcula neto en tiempo real
- Crea `advance_logs` al cerrar quincena

**Componente:** `src/components/commissions/BrokerPaymentActions.tsx`

---

### PASO 8: Flujo "Marcar como Mío" ⏳

**En pending_items:**
- Broker marca item como suyo
- Crea `comm_item_claims` con status = 'pending'
- Master revisa en "Ajustes → Identificados"
- Master aprueba/rechaza
- Si aprueba, opciones:
  - **"Pagar ya"** → Genera CSV especial, marca pagado
  - **"Pagar en siguiente quincena"** → Marca `payment_type = 'next_fortnight'`

**Al crear nueva quincena:**
- Busca `pending_items` con `action_type = 'pay_next'`
- Busca `comm_item_claims` con `payment_type = 'next_fortnight'` y sin fortnight_id
- Los inyecta en la nueva quincena como import virtual
- Calcula comisión con percent del broker
- Los items inyectados aparecen en el detalle

---

## VERIFICACIONES POST-IMPLEMENTACIÓN

### 1. Verificar Migración
```sql
-- Tabla creada
SELECT * FROM fortnight_details LIMIT 1;

-- Vista creada
SELECT * FROM fortnight_details_full LIMIT 1;

-- Función creada
SELECT * FROM get_fortnight_summary('fortnight_id_here');
```

### 2. Verificar Limpieza de Duplicados
```sql
-- NO debe retornar filas
SELECT name, broker_id, COUNT(*) 
FROM clients 
GROUP BY name, broker_id 
HAVING COUNT(*) > 1;
```

### 3. Verificar Bulk Import
```sql
-- Quincena creada
SELECT * FROM fortnights WHERE period_start = '2025-11-01';

-- Reportes con total_amount
SELECT 
  ci.period_label,
  i.name,
  ci.total_amount
FROM comm_imports ci
JOIN insurers i ON ci.insurer_id = i.id
ORDER BY i.name;

-- Items con broker
SELECT COUNT(*) FROM comm_items WHERE fortnight_id = 'fortnight_id_here';

-- Detalles guardados
SELECT COUNT(*) FROM fortnight_details WHERE fortnight_id = 'fortnight_id_here';

-- Totales por broker
SELECT 
  b.name,
  fbt.gross_amount,
  fbt.net_amount
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'fortnight_id_here'
ORDER BY fbt.gross_amount DESC;
```

### 4. Verificar NO se borraron datos
```sql
-- comm_items debe existir después de cerrar
SELECT COUNT(*) FROM comm_items WHERE fortnight_id = 'fortnight_id_here';  -- > 0

-- comm_imports debe existir
SELECT COUNT(*) FROM comm_imports WHERE period_label = 'fortnight_id_here';  -- > 0
```

### 5. Verificar Totales
```sql
-- Debe coincidir con el total de reportes
SELECT 
  (SELECT SUM(total_amount) FROM comm_imports WHERE period_label = 'fortnight_id_here') AS total_reportes,
  (SELECT SUM(gross_amount) FROM fortnight_broker_totals WHERE fortnight_id = 'fortnight_id_here') AS total_corredores,
  (SELECT SUM(total_amount) FROM comm_imports WHERE period_label = 'fortnight_id_here') - 
  (SELECT SUM(gross_amount) FROM fortnight_broker_totals WHERE fortnight_id = 'fortnight_id_here') AS ganancia_oficina;
```

---

## PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: "Table fortnight_details does not exist"
**Solución:** Ejecutar migración SQL en Supabase

### Problema 2: TypeScript errors en database.types.ts
**Solución:** Regenerar types después de ejecutar migración

### Problema 3: Bulk import falla en ASSA codes
**Solución:** Verificar que exista un broker con email 'contacto@lideresenseguros.com'

### Problema 4: Clientes siguen duplicados
**Solución:** Ejecutar `clean-duplicate-clients.mjs` nuevamente

### Problema 5: Totales no cuadran
**Solución:** Verificar que todas las pólizas tengan el `percent_override` correcto

---

## ORDEN DE EJECUCIÓN RECOMENDADO

1. ✅ Leer `ANALISIS_FLUJO_QUINCENA.md` (completo)
2. ⏳ Ejecutar migración SQL
3. ⏳ Regenerar types
4. ⏳ Ejecutar limpieza de duplicados
5. ⏳ Preparar CSVs en `public/`
6. ⏳ Ejecutar bulk import
7. ⏳ Modificar `actionPayFortnight`
8. ⏳ Crear componente de historial detallado
9. ⏳ Implementar botones Retener/Descontar
10. ⏳ Implementar flujo "Marcar como Mío"
11. ⏳ Probar todo el flujo end-to-end

---

## CONTACTO Y SOPORTE

Si algo falla durante la implementación:
1. Revisar logs de consola del script
2. Verificar datos en Supabase Dashboard
3. Revisar `ANALISIS_FLUJO_QUINCENA.md` para entender la lógica
4. Ejecutar queries de verificación arriba

**Próxima Actualización:** Después de ejecutar Paso 1-4, revisar y continuar con Paso 5-8.
