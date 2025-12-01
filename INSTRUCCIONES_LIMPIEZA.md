# 🧹 INSTRUCCIONES PARA LIMPIEZA DE AJUSTES

## 🎯 OBJETIVO
Resetear el sistema de ajustes a estado inicial (cero) para empezar correctamente con el flujo corregido.

---

## 📋 OPCIÓN 1: LIMPIEZA COMPLETA (RECOMENDADA)

### **¿Cuándo usar?**
- Hay pocos reportes y puedes rehacerlos
- Quieres empezar desde cero
- Los datos actuales tienen muchos errores

### **Pasos:**

1. **Abrir Supabase SQL Editor:**
   - Ve a tu proyecto en Supabase
   - Click en "SQL Editor"
   - Click en "New query"

2. **Copiar y ejecutar este script:**

```sql
BEGIN;

-- Eliminar todos los reportes y sus ítems
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;

-- Resetear todos los pending_items a estado inicial
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE status IN ('in_review', 'approved', 'rejected');

COMMIT;
```

3. **Verificar resultado:**

```sql
-- Todos los pending_items deben estar en 'open' y sin assigned_broker_id
SELECT 
  policy_number,
  insured_name,
  commission_raw,
  status,
  assigned_broker_id
FROM pending_items
WHERE status != 'open' OR assigned_broker_id IS NOT NULL;
-- Debe devolver 0 filas

-- No debe haber reportes
SELECT COUNT(*) FROM adjustment_reports;
-- Debe devolver 0
```

4. **Resultado esperado:**
   - ✅ Todos los ítems aparecen en "Sin Identificar"
   - ✅ No hay reportes en "Reportados" ni "Identificados"
   - ✅ Sistema listo para empezar de nuevo

---

## 📋 OPCIÓN 2: SOLO CORREGIR CÁLCULOS

### **¿Cuándo usar?**
- Tienes reportes importantes que NO quieres borrar
- Solo necesitas corregir los montos (0.08 → 8.20)

### **Pasos:**

1. **Ver qué está mal:**

```sql
SELECT 
  ar.id as report_id,
  b.name as broker_name,
  b.percent_default,
  ari.commission_raw,
  ari.broker_commission as actual,
  (ari.commission_raw * b.percent_default) as correcto,
  ar.total_amount
FROM adjustment_report_items AS ari
INNER JOIN adjustment_reports AS ar ON ari.report_id = ar.id
INNER JOIN brokers AS b ON ar.broker_id = b.id
ORDER BY ar.created_at DESC;
```

2. **Corregir todos los cálculos:**

```sql
BEGIN;

-- Recalcular broker_commission en items
UPDATE adjustment_report_items AS ari
SET broker_commission = ari.commission_raw * b.percent_default
FROM adjustment_reports AS ar
INNER JOIN brokers AS b ON ar.broker_id = b.id
WHERE ari.report_id = ar.id;

-- Recalcular total_amount en reportes
UPDATE adjustment_reports AS ar
SET total_amount = (
  SELECT COALESCE(SUM(broker_commission), 0)
  FROM adjustment_report_items
  WHERE report_id = ar.id
);

COMMIT;
```

3. **Verificar resultado:**

```sql
SELECT 
  ar.id,
  b.name as broker,
  b.percent_default as porcentaje,
  ar.total_amount as total_reporte,
  CASE 
    WHEN ar.total_amount = (
      SELECT COALESCE(SUM(broker_commission), 0)
      FROM adjustment_report_items
      WHERE report_id = ar.id
    ) THEN '✅ CORRECTO'
    ELSE '❌ DESCUADRADO'
  END as estado
FROM adjustment_reports ar
INNER JOIN brokers b ON ar.broker_id = b.id
ORDER BY ar.created_at DESC;
```

---

## 📋 OPCIÓN 3: LIBERAR ITEMS ATRAPADOS

### **¿Cuándo usar?**
- Hay ítems que marcaste pero NO enviaste como reporte
- Están atrapados con `status='in_review'` sin reporte asociado

### **Pasos:**

1. **Ver ítems atrapados:**

```sql
SELECT 
  pi.id,
  pi.policy_number,
  pi.insured_name,
  pi.commission_raw,
  pi.status,
  pi.assigned_broker_id,
  b.name as broker_name
FROM pending_items pi
LEFT JOIN brokers b ON pi.assigned_broker_id = b.id
WHERE pi.status = 'in_review'
  AND pi.id NOT IN (
    SELECT pending_item_id 
    FROM adjustment_report_items
  )
ORDER BY pi.created_at DESC;
```

2. **Liberar esos ítems:**

```sql
-- Resetear ítems que están en 'in_review' pero NO tienen reporte
UPDATE pending_items
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE status = 'in_review'
  AND id NOT IN (
    SELECT pending_item_id 
    FROM adjustment_report_items
  );
```

3. **Verificar:**
   - Refrescar app
   - Esos ítems deben aparecer en "Sin Identificar"

---

## 🗑️ ELIMINAR TABLAS DUPLICADAS (SI EXISTEN)

### **1. Verificar si existen tablas duplicadas:**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%adjustment%' 
    OR table_name LIKE '%report%'
  )
ORDER BY table_name;
```

### **2. Si ves tablas como:**
- `adjustments_report_items` (con S)
- `adjustments_reports` (con S)
- Cualquier variación duplicada

### **3. Eliminarlas:**

```sql
-- Solo ejecutar SI confirmaste que son duplicadas y están vacías
DROP TABLE IF EXISTS adjustments_report_items CASCADE;
DROP TABLE IF EXISTS adjustments_reports CASCADE;
```

**⚠️ IMPORTANTE:** Solo eliminar si estás SEGURO que son duplicadas.

---

## ✅ DESPUÉS DE LA LIMPIEZA

### **Verificación final:**

1. **En Supabase:**
   ```sql
   -- pending_items en estado inicial
   SELECT COUNT(*) FROM pending_items WHERE status = 'open';
   
   -- Sin reportes (si hiciste limpieza completa)
   SELECT COUNT(*) FROM adjustment_reports;
   ```

2. **En la app:**
   - Abrir pestaña "Sin Identificar"
   - Deben aparecer TODOS los ítems
   - Ninguno debe tener broker asignado
   - Pestaña "Reportados" vacía (si hiciste limpieza completa)

3. **Probar flujo:**
   - Click "Marcar Mío" o "Asignar Broker"
   - ✅ Modo selección se activa
   - ✅ Checkboxes aparecen
   - ✅ Sticky bar muestra cálculo correcto
   - ✅ Click "Cancelar" → no asigna nada
   - ✅ Click "Enviar Reporte" → crea reporte y actualiza BD

---

## 🎊 RESUMEN RÁPIDO

**Si quieres empezar de cero (RECOMENDADO):**
```sql
BEGIN;
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;
UPDATE pending_items SET status = 'open', assigned_broker_id = NULL
WHERE status IN ('in_review', 'approved', 'rejected');
COMMIT;
```

**Si solo quieres corregir cálculos:**
```sql
BEGIN;
UPDATE adjustment_report_items AS ari
SET broker_commission = ari.commission_raw * b.percent_default
FROM adjustment_reports AS ar
INNER JOIN brokers AS b ON ar.broker_id = b.id
WHERE ari.report_id = ar.id;

UPDATE adjustment_reports AS ar
SET total_amount = (
  SELECT COALESCE(SUM(broker_commission), 0)
  FROM adjustment_report_items
  WHERE report_id = ar.id
);
COMMIT;
```

**Si tienes ítems atrapados:**
```sql
UPDATE pending_items
SET status = 'open', assigned_broker_id = NULL
WHERE status = 'in_review'
  AND id NOT IN (SELECT pending_item_id FROM adjustment_report_items);
```

---

**🔴 DESPUÉS DE EJECUTAR SCRIPTS:**
1. Refrescar la app (F5)
2. Probar flujo completo
3. Verificar que cálculos sean correctos
4. Crear reporte de prueba

**📁 ARCHIVOS CREADOS:**
- `SCRIPT_LIMPIEZA_AJUSTES.sql` - Scripts completos con comentarios
- `SCRIPT_CORREGIR_CALCULOS.sql` - Solo corrección de cálculos
- `INSTRUCCIONES_LIMPIEZA.md` - Este archivo
