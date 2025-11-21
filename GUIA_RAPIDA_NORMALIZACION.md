# 🚀 GUÍA RÁPIDA: Normalizar Nombres en Base de Datos

## ⚠️ IMPORTANTE: Ejecutar el archivo correcto

**Archivo corregido:** `EJECUTAR_NORMALIZACION.sql`

El archivo anterior `FIX_EXISTING_NAMES.sql` ya fue actualizado pero usa este nuevo archivo simplificado.

---

## 📋 Pasos a Seguir (EN ORDEN)

### **PASO 1: Abrir Supabase SQL Editor**
1. Ir a tu proyecto en Supabase
2. Click en "SQL Editor" en el menú lateral
3. Abrir el archivo `EJECUTAR_NORMALIZACION.sql`

---

### **PASO 2: Crear la función normalize_name()**

**Ejecutar:** Sección 1 completa (líneas 7-35)

```sql
CREATE OR REPLACE FUNCTION normalize_name(text_input TEXT)
RETURNS TEXT AS $$
...
$$ LANGUAGE plpgsql IMMUTABLE;
```

✅ **Verificar:** Debe aparecer "Success. No rows returned"

**Luego ejecutar la verificación:**
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'normalize_name';
```

✅ **Debe mostrar:** 1 fila con `normalize_name | FUNCTION`

---

### **PASO 3: Probar la función**

**Ejecutar:** Sección 2 (ejemplos)

```sql
SELECT normalize_name('MATEO PATIÑO MARTINEZ');
```

✅ **Debe retornar:** `MATEO PATINO MARTINEZ`

---

### **PASO 4: Ver cuántos clientes necesitan corrección**

**Ejecutar:** Sección 3

```sql
SELECT COUNT(*) as total_con_caracteres_especiales
FROM clients
WHERE name != normalize_name(name);
```

📊 **Resultado esperado:** Número de clientes con ñ o acentos

---

### **PASO 5: Ver ejemplos de cambios**

**Ejecutar:** Sección 4

```sql
SELECT 
  id,
  name as nombre_actual,
  normalize_name(name) as nombre_normalizado
FROM clients
WHERE name != normalize_name(name)
LIMIT 30;
```

📋 **Revisar los cambios propuestos:**
- ¿Los nombres se ven correctos?
- ¿No se pierden datos importantes?

❌ **Si algo se ve mal:** DETENTE AQUÍ y revisa

✅ **Si todo se ve bien:** Continúa al siguiente paso

---

### **PASO 6: Crear BACKUP (CRÍTICO!)**

**Ejecutar:** Sección 5 completa

```sql
DROP TABLE IF EXISTS clients_backup_names;

CREATE TABLE clients_backup_names AS 
SELECT id, name, created_at, NOW() as backup_date
FROM clients;

SELECT COUNT(*) as total_respaldados FROM clients_backup_names;
```

✅ **Verificar:** Debe mostrar el número total de clientes respaldados

---

### **PASO 7: Actualizar nombres (CON CUIDADO!)**

**Ejecutar:** Todo el bloque BEGIN...COMMIT de Sección 6

```sql
BEGIN;

UPDATE clients 
SET name = normalize_name(name)
WHERE name != normalize_name(name);

SELECT COUNT(*) as actualizados
FROM clients c
INNER JOIN clients_backup_names cb ON c.id = cb.id
WHERE c.name != cb.name;

-- ¿Todo luce bien? SI → continúa
-- NO → ejecuta ROLLBACK; en lugar de COMMIT;

COMMIT;
```

⚠️ **IMPORTANTE:** 
- El `BEGIN;` inicia una transacción
- Puedes revisar los cambios ANTES de confirmar
- Si algo se ve mal, ejecuta `ROLLBACK;` para cancelar
- Si todo está bien, ejecuta `COMMIT;` para confirmar

---

### **PASO 8: Verificación Final**

**Ejecutar:** Sección 7

```sql
-- Debe retornar 0
SELECT COUNT(*) as pendientes_normalizar
FROM clients
WHERE name != normalize_name(name);
```

✅ **Debe retornar:** 0 (cero)

**Ver ejemplos de cambios:**
```sql
SELECT 
  cb.name as antes,
  c.name as despues
FROM clients_backup_names cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
LIMIT 20;
```

---

### **PASO 9: Verificar duplicados (OPCIONAL)**

**Ejecutar:** Sección 8

```sql
SELECT 
  name,
  COUNT(*) as cantidad
FROM clients
GROUP BY name
HAVING COUNT(*) > 1;
```

📊 Si hay duplicados, revisarlos manualmente (pueden ser clientes diferentes con nombres similares)

---

### **PASO 10: Estadísticas**

**Ejecutar:** Sección 9

```sql
SELECT 
  'Total clientes' as metrica,
  COUNT(*)::text as valor
FROM clients
...
```

📊 **Ver resumen completo** de la operación

---

## 🆘 Si algo salió mal

### **Revertir cambios:**

**Ejecutar:** Sección 10 (descomentarla primero)

```sql
BEGIN;

UPDATE clients c
SET name = cb.name
FROM clients_backup_names cb
WHERE c.id = cb.id AND c.name != cb.name;

SELECT COUNT(*) as revertidos FROM clients;

COMMIT;
```

Esto restaura los nombres originales desde el backup.

---

## ✅ Checklist Final

- [ ] Función `normalize_name()` creada
- [ ] Función probada exitosamente
- [ ] Visto cuántos clientes necesitan corrección
- [ ] Revisados ejemplos de cambios propuestos
- [ ] Backup creado exitosamente
- [ ] Nombres actualizados
- [ ] Verificación: 0 pendientes normalizar
- [ ] Ejemplos de cambios revisados
- [ ] Estadísticas revisadas
- [ ] ✅ TODO CORRECTO

---

## 📁 Archivos Disponibles

1. ✅ **`EJECUTAR_NORMALIZACION.sql`** ← **USAR ESTE** (versión simplificada)
2. ✅ **`GUIA_RAPIDA_NORMALIZACION.md`** ← Este archivo
3. ⚠️ `FIX_EXISTING_NAMES.sql` (ya corregido, pero usar el simplificado)
4. ✅ `normalize-names-function.sql` (solo la función, sin pasos adicionales)

---

## ⏱️ Tiempo estimado

- **Revisión y preparación:** 5-10 minutos
- **Ejecución:** 2-5 minutos
- **Verificación:** 2-3 minutos
- **TOTAL:** ~15 minutos

---

## 📞 Soporte

Si tienes dudas en cualquier paso:
1. **DETENTE** antes de ejecutar
2. Revisa los resultados de la consulta anterior
3. Verifica el backup antes de actualizar
4. Recuerda que puedes hacer ROLLBACK antes de COMMIT

---

## 🎯 Objetivo

Al finalizar, TODOS los nombres de clientes estarán:
- ✅ Sin ñ (Ñ → N)
- ✅ Sin acentos (Á,É,Í,Ó,Ú → A,E,I,O,U)
- ✅ Sin caracteres especiales
- ✅ Solo con A-Z, 0-9 y espacios
- ✅ En MAYÚSCULAS

**Listos para el bulk import y exportaciones ACH** 🚀
