# 🧹 PASOS PARA LIMPIAR SUPABASE - SISTEMA DE AJUSTES

## 📋 PASO 1: VER QUÉ TABLAS TIENES

### **1.1 Abrir Supabase SQL Editor**
1. Ve a tu proyecto en Supabase
2. En el menú lateral, click en **"SQL Editor"**
3. Click en **"New query"**

### **1.2 Ejecutar esta query:**

```sql
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%adjustment%' 
    OR table_name LIKE '%report%'
  )
ORDER BY table_name;
```

### **1.3 Ver resultado:**

**✅ RESULTADO CORRECTO (solo estas dos):**
```
adjustment_report_items
adjustment_reports
```

**❌ SI VES MÁS TABLAS (están duplicadas):**
```
adjustment_report_items       ✅ Esta es correcta
adjustment_reports            ✅ Esta es correcta
adjustments_report_items      ❌ DUPLICADA (con S)
adjustments_reports           ❌ DUPLICADA (con S)
```

---

## 📋 PASO 2: VERIFICAR CONTENIDO DE TABLAS

### **2.1 Ver cuántos reportes hay:**

```sql
SELECT 
  'adjustment_reports' as tabla,
  COUNT(*) as cantidad
FROM adjustment_reports
UNION ALL
SELECT 
  'adjustment_report_items' as tabla,
  COUNT(*) as cantidad
FROM adjustment_report_items;
```

**Resultado:**
```
adjustment_reports: X reportes
adjustment_report_items: Y items
```

### **2.2 Ver pending_items con problemas:**

```sql
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN assigned_broker_id IS NOT NULL THEN 1 END) as items_con_broker,
  COUNT(CASE WHEN status != 'open' THEN 1 END) as items_no_open
FROM pending_items;
```

**Resultado esperado DESPUÉS de limpieza:**
```
total_items: 100 (o el total que tengas)
items_con_broker: 0
items_no_open: 0
```

---

## 📋 PASO 3: LIMPIEZA COMPLETA DE DATOS

### **3.1 Ejecutar limpieza:**

```sql
BEGIN;

-- Borrar todos los reportes
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;

-- Resetear todos los pending_items
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL;

COMMIT;
```

### **3.2 Verificar limpieza:**

```sql
-- Debe mostrar 0 reportes
SELECT COUNT(*) FROM adjustment_reports;

-- Debe mostrar 0 items de reportes
SELECT COUNT(*) FROM adjustment_report_items;

-- Debe mostrar 0 items con broker asignado
SELECT COUNT(*) FROM pending_items 
WHERE assigned_broker_id IS NOT NULL;
```

**Resultado esperado:**
```
0
0
0
```

---

## 📋 PASO 4: ELIMINAR TABLAS DUPLICADAS

### **4.1 SI en el PASO 1 viste tablas duplicadas:**

**⚠️ IMPORTANTE:** Solo ejecutar si confirmaste que son duplicadas y no se usan.

```sql
-- Si existe adjustments_report_items (con S):
DROP TABLE IF EXISTS adjustments_report_items CASCADE;

-- Si existe adjustments_reports (con S):
DROP TABLE IF EXISTS adjustments_reports CASCADE;

-- Si existe adjustment_items (sin report):
DROP TABLE IF EXISTS adjustment_items CASCADE;
```

### **4.2 Verificar eliminación:**

```sql
-- Volver a ejecutar query del PASO 1
SELECT 
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%adjustment%' 
    OR table_name LIKE '%report%'
  )
ORDER BY table_name;
```

**Resultado esperado (solo estas dos):**
```
adjustment_report_items
adjustment_reports
```

---

## 📋 PASO 5: VERIFICACIÓN FINAL

### **5.1 Ver estructura de pending_items:**

```sql
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pending_items'
ORDER BY ordinal_position;
```

**Debe incluir:**
```
id
policy_number
insured_name
commission_raw
status
assigned_broker_id  ✅ Esta columna debe existir
insurer_id
fortnight_id
created_at
...
```

### **5.2 Ver primeros 10 pending_items:**

```sql
SELECT 
  policy_number,
  insured_name,
  commission_raw,
  status,
  assigned_broker_id
FROM pending_items
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
policy_number | status | assigned_broker_id
ABC-001       | open   | NULL
ABC-002       | open   | NULL
ABC-003       | open   | NULL
...
```

Todos deben tener:
- ✅ status = 'open'
- ✅ assigned_broker_id = NULL

---

## 📋 PASO 6: PROBAR EN LA APP

### **6.1 Refrescar la app:**
- Presiona **F5** en el navegador

### **6.2 Ir a pestaña "Sin Identificar":**
- ✅ Deben aparecer TODOS los items
- ✅ Ninguno debe tener broker asignado visible

### **6.3 Probar flujo completo:**

**Broker:**
1. Click "Marcar Mío" en una póliza
   - ✅ Modo selección se activa
   - ✅ Aparecen checkboxes
   - ✅ Sticky bar aparece
   
2. Seleccionar más pólizas
   - ✅ Total se actualiza en tiempo real
   
3. Click "Cancelar"
   - ✅ NO se asigna nada en BD
   - ✅ Modo selección se desactiva
   
4. Repetir pasos 1-2 y click "Enviar Reporte"
   - ✅ Se crea reporte
   - ✅ Items desaparecen de "Sin Identificar"
   - ✅ Aparecen en "Reportados"

**Master:**
1. Click "Asignar Corredor" en una póliza
   - ✅ Dropdown con brokers
   
2. Seleccionar broker del dropdown
   - ✅ Modo selección se activa
   - ✅ Sticky bar muestra broker seleccionado
   
3. Seleccionar más pólizas y click "Enviar"
   - ✅ Se crea reporte para ese broker
   - ✅ Items desaparecen de "Sin Identificar"
   - ✅ Aparecen en "Identificados"

---

## 🎯 RESUMEN DE CAMBIOS

### **Antes de limpieza:**
```
pending_items:
├─ policy-1: status='in_review', assigned_broker_id='broker-123'
├─ policy-2: status='open', assigned_broker_id='broker-456'
└─ policy-3: status='approved', assigned_broker_id='broker-789'

adjustment_reports: 5 reportes
adjustment_report_items: 25 items

Tablas duplicadas: adjustments_reports ❌
```

### **Después de limpieza:**
```
pending_items:
├─ policy-1: status='open', assigned_broker_id=NULL ✅
├─ policy-2: status='open', assigned_broker_id=NULL ✅
└─ policy-3: status='open', assigned_broker_id=NULL ✅

adjustment_reports: 0 reportes ✅
adjustment_report_items: 0 items ✅

Tablas duplicadas: NINGUNA ✅
```

---

## ⚡ SCRIPT TODO-EN-UNO

Si quieres hacer TODO de una vez, copia y ejecuta esto en Supabase SQL Editor:

```sql
-- ============================================
-- LIMPIEZA COMPLETA - EJECUTAR TODO JUNTO
-- ============================================

BEGIN;

-- 1. Borrar reportes
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;

-- 2. Resetear pending_items
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL;

COMMIT;

-- 3. Verificar
SELECT 
  'Reportes eliminados' as accion,
  COUNT(*) as cantidad
FROM adjustment_reports
UNION ALL
SELECT 
  'Items de reporte eliminados' as accion,
  COUNT(*) as cantidad
FROM adjustment_report_items
UNION ALL
SELECT 
  'Items con broker asignado' as accion,
  COUNT(*) as cantidad
FROM pending_items
WHERE assigned_broker_id IS NOT NULL
UNION ALL
SELECT 
  'Items sin status open' as accion,
  COUNT(*) as cantidad
FROM pending_items
WHERE status != 'open';

-- RESULTADO ESPERADO: Todos deben mostrar 0
```

---

## ❓ SI ALGO SALE MAL

### **Problema: Error al ejecutar DELETE**
**Solución:** Verificar que no haya otras tablas con FK a estas tablas.

### **Problema: Tablas duplicadas no se eliminan**
**Solución:** Ejecutar con CASCADE:
```sql
DROP TABLE IF EXISTS adjustments_report_items CASCADE;
```

### **Problema: Items no aparecen en "Sin Identificar"**
**Solución:** Verificar filtros en query:
```sql
SELECT * FROM pending_items 
WHERE status = 'open';
-- Deben aparecer todos
```

---

## ✅ CHECKLIST FINAL

Después de ejecutar TODO, verifica:

- [ ] Solo existen dos tablas: `adjustment_reports` y `adjustment_report_items`
- [ ] `adjustment_reports` tiene 0 registros
- [ ] `adjustment_report_items` tiene 0 registros
- [ ] Todos los `pending_items` tienen `status='open'`
- [ ] Todos los `pending_items` tienen `assigned_broker_id=NULL`
- [ ] App muestra todos los items en "Sin Identificar"
- [ ] Flujo de creación de reporte funciona correctamente
- [ ] Sticky bar muestra cálculos correctos

**¡SISTEMA 100% LIMPIO Y FUNCIONAL!** 🎉
