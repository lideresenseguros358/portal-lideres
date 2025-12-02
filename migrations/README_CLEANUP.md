# Script de Limpieza de Reportes Rechazados

## 📋 **PROPÓSITO**

Este script SQL elimina completamente los reportes rechazados y libera los items para que vuelvan a aparecer en "Sin Identificar".

## 🚀 **CÓMO EJECUTAR**

### **Opción 1: Desde Supabase Dashboard**

1. Ir a Supabase Dashboard → SQL Editor
2. Copiar y pegar el contenido de `cleanup_rejected_reports.sql`
3. Click en "Run"
4. Revisar los mensajes de NOTICE en la consola

### **Opción 2: Desde psql (Terminal)**

```bash
psql -h <host> -U postgres -d postgres -f migrations/cleanup_rejected_reports.sql
```

### **Opción 3: Desde código Node.js**

```javascript
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sql = fs.readFileSync('migrations/cleanup_rejected_reports.sql', 'utf8');

await supabase.rpc('exec_sql', { sql_string: sql });
```

## 🔍 **QUÉ HACE EL SCRIPT**

### **PASO 1: Restaurar Items**
```sql
UPDATE pending_items
SET status = 'open', assigned_broker_id = NULL
WHERE id IN (SELECT ... FROM reportes rechazados)
```
- Cambia items de reportes rechazados a status='open'
- Limpia assigned_broker_id para que estén disponibles
- Los items vuelven a aparecer en "Sin Identificar"

### **PASO 2: Eliminar Report Items**
```sql
DELETE FROM adjustment_report_items
WHERE report_id IN (SELECT ... reportes rechazados)
```
- Elimina las referencias en adjustment_report_items
- Previene errores de duplicados

### **PASO 3: Eliminar Reportes**
```sql
DELETE FROM adjustment_reports
WHERE status = 'rejected'
```
- Elimina completamente los reportes rechazados
- Como si nunca hubieran existido

### **PASO 4: Verificación**
- Muestra cuántos items fueron restaurados
- Muestra cuántos reportes fueron eliminados
- Verifica que no queden reportes rechazados

## 📊 **SALIDA ESPERADA**

```
NOTICE:  Items restaurados a "Sin Identificar": 15
NOTICE:  adjustment_report_items eliminados: 15
NOTICE:  Reportes rechazados eliminados: 3
NOTICE:  ========================================
NOTICE:  LIMPIEZA COMPLETADA
NOTICE:  ========================================
NOTICE:  Items disponibles en "Sin Identificar": 127
NOTICE:  Reportes rechazados restantes: 0
NOTICE:  Todos los reportes rechazados fueron eliminados exitosamente.
```

## ⚠️ **ADVERTENCIAS**

### **Importante:**
- ✅ Este script es **SEGURO** - solo afecta reportes rechazados
- ✅ Los reportes aprobados y pagados **NO** se tocan
- ✅ Se usa una transacción (BEGIN/COMMIT) - todo o nada
- ⚠️ **NO SE MANTIENE HISTORIAL** de reportes rechazados

### **Antes de ejecutar:**
1. Verificar que realmente quieres eliminar los rechazados
2. Si necesitas backup, hacer uno antes
3. Revisar que no hay reportes rechazados que necesites investigar

## 🔄 **CUÁNDO EJECUTAR**

### **Situaciones:**
1. **Después de rechazar reportes**: Liberar items para re-intento
2. **Mantenimiento periódico**: Limpiar reportes rechazados acumulados
3. **Resolución de errores**: "Items ya están en reporte" después de rechazo
4. **Limpieza general**: Optimizar la BD eliminando rechazados

### **Frecuencia recomendada:**
- **Automático**: Después de cada rechazo (ya implementado en código)
- **Manual**: Solo si hay reportes rechazados antiguos acumulados
- **Mantenimiento**: Mensual o cuando sea necesario

## ✅ **VERIFICACIÓN POST-EJECUCIÓN**

### **1. Verificar items en "Sin Identificar":**
```sql
SELECT COUNT(*) 
FROM pending_items 
WHERE status = 'open' AND assigned_broker_id IS NULL;
```

### **2. Verificar que no quedan rechazados:**
```sql
SELECT COUNT(*) 
FROM adjustment_reports 
WHERE status = 'rejected';
-- Debe ser 0
```

### **3. Verificar que no hay referencias huérfanas:**
```sql
SELECT COUNT(*) 
FROM adjustment_report_items ari
LEFT JOIN adjustment_reports ar ON ar.id = ari.report_id
WHERE ar.id IS NULL;
-- Debe ser 0
```

## 🎯 **RESULTADO ESPERADO**

Después de ejecutar el script:
- ✅ Items vuelven a "Sin Identificar"
- ✅ Brokers pueden reportarlos de nuevo
- ✅ No hay errores de "items duplicados"
- ✅ BD limpia sin reportes rechazados
- ✅ Sin referencias huérfanas

## 📝 **NOTAS ADICIONALES**

### **Sobre el flujo actual:**
- La función `actionRejectAdjustmentReport()` ya hace esta limpieza automáticamente
- Este script es para **limpiar rechazados antiguos** que quedaron antes de la actualización
- Una vez ejecutado, no debería ser necesario ejecutarlo de nuevo (a menos que haya acumulación)

### **Si hay errores:**
- El script usa transacciones - si falla, hace ROLLBACK automático
- Revisar logs para ver qué salió mal
- Contactar soporte si es necesario

## 🔒 **SEGURIDAD**

- ✅ Solo afecta status='rejected'
- ✅ No toca reportes pending, approved o paid
- ✅ No toca pending_items con otros status
- ✅ Transaccional - todo o nada
- ✅ Sin riesgo de pérdida de datos importantes
