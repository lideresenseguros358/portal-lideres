# 🗄️ GUÍA DE MIGRACIONES SQL - Portal Líderes

## ⚠️ ERROR ACTUAL

```
ERROR: 42710: policy "Masters pueden ver todo bank_transfers" for table "bank_transfers" already exists
```

**Causa:** `create_checks_tables.sql` ya fue ejecutado anteriormente.

---

## 📋 DIAGNÓSTICO RÁPIDO

Ejecuta este archivo primero para ver qué tienes:
```sql
migrations/VERIFICACION_COMPLETA.sql
```

Copia todo el contenido, pégalo en **Supabase SQL Editor** y ejecuta.

---

## 🎯 MIGRACIONES DISPONIBLES (5 archivos)

### 1️⃣ `create_checks_tables.sql` ✅ YA EJECUTADO
**Estado:** ERROR indica que ya existe  
**Acción:** ❌ NO ejecutar de nuevo

**Contiene:**
- Tablas: `bank_transfers`, `pending_payments`, `payment_references`, `payment_details`
- Funciones: `validate_payment_references()`, `update_can_be_paid()`
- Triggers y RLS policies

---

### 2️⃣ `create_pending_commissions_tables.sql` ⚠️ POR VERIFICAR
**Acción:** ✅ Ejecutar solo si VERIFICACION_COMPLETA.sql dice "FALTA"

**Contiene:**
- Tablas: `pending_items`, `pending_policy`
- Funciones: `assign_pending_to_office_after_3m()`, `get_pending_items_grouped()`
- Triggers y RLS policies

**Verificación:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('pending_items', 'pending_policy');
```

Si retorna vacío → **EJECUTAR**  
Si retorna ambas tablas → **SKIP**

---

### 3️⃣ `add_life_insurance_flag.sql` ⚠️ POR VERIFICAR
**Acción:** ✅ Ejecutar solo si VERIFICACION_COMPLETA.sql dice "FALTA"

**Contiene:**
- ALTER TABLE: `comm_imports.is_life_insurance BOOLEAN`

**Verificación:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'comm_imports' 
AND column_name = 'is_life_insurance';
```

Si retorna vacío → **EJECUTAR**  
Si retorna la columna → **SKIP**

---

### 4️⃣ `create_temp_clients_table.sql` ⚠️ POR VERIFICAR
**Acción:** ✅ Ejecutar solo si VERIFICACION_COMPLETA.sql dice "FALTA"

**Contiene:**
- Tabla: `temp_client_imports`
- Función: `process_temp_client_import()`, `cleanup_processed_temp_imports()`
- Triggers y RLS policies

**Verificación:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'temp_client_imports';
```

Si retorna vacío → **EJECUTAR**  
Si retorna la tabla → **SKIP**

---

### 5️⃣ `fix_temp_client_imports_trigger.sql` ⚠️ POR VERIFICAR
**Acción:** ✅ Ejecutar DESPUÉS de #4 (solo si #4 fue ejecutado)

**Contiene:**
- Función: `delete_processed_temp_import()`
- Trigger AFTER para auto-eliminación

**Verificación:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'delete_processed_temp_import';
```

Si retorna vacío → **EJECUTAR** (después de #4)  
Si retorna la función → **SKIP**

---

## 🚀 WORKFLOW RECOMENDADO

### PASO 1: Verificar estado actual
```bash
# En Supabase SQL Editor:
migrations/VERIFICACION_COMPLETA.sql
```

### PASO 2: Ejecutar según resultados

#### Si VERIFICACION_COMPLETA.sql dice TODO ✅:
```bash
# Nada que hacer, solo regenerar types:
npm run types
```

#### Si VERIFICACION_COMPLETA.sql dice que FALTA algo:
```bash
# Ejecutar solo los que dicen "❌ FALTA EJECUTAR":

# Ejemplo si falta #2:
migrations/create_pending_commissions_tables.sql

# Ejemplo si falta #3:
migrations/add_life_insurance_flag.sql

# Ejemplo si falta #4:
migrations/create_temp_clients_table.sql

# Ejemplo si falta #5 (DESPUÉS de #4):
migrations/fix_temp_client_imports_trigger.sql
```

### PASO 3: Regenerar types
```bash
npm run types
```

### PASO 4: Validar
```bash
npm run typecheck
npm run build
```

---

## 🔍 QUERIES DE VERIFICACIÓN INDIVIDUAL

### Verificar tablas de cheques (Migración #1)
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bank_transfers', 'pending_payments', 'payment_references', 'payment_details');
-- Debe retornar 4 filas
```

### Verificar tablas de comisiones pendientes (Migración #2)
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pending_items', 'pending_policy');
-- Debe retornar 2 filas
```

### Verificar columna is_life_insurance (Migración #3)
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'comm_imports' 
AND column_name = 'is_life_insurance';
-- Debe retornar: is_life_insurance | boolean
```

### Verificar temp_client_imports (Migración #4)
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'temp_client_imports';
-- Debe retornar: temp_client_imports
```

### Verificar todas las funciones
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'assign_pending_to_office_after_3m',
  'get_pending_items_grouped',
  'process_temp_client_import',
  'delete_processed_temp_import',
  'cleanup_processed_temp_imports',
  'validate_payment_references',
  'update_can_be_paid'
)
ORDER BY routine_name;
-- Debe retornar 7 filas
```

---

## ✅ RESULTADO ESPERADO FINAL

Cuando ejecutes `VERIFICACION_COMPLETA.sql` al final, debes ver:

```
=== RESUMEN FINAL ===
total_tablas_nuevas: 7
tablas_esperadas: 7
total_funciones: 7
funciones_esperadas: 7
```

**Si ves esto → TODO LISTO ✅**

Entonces solo ejecuta:
```bash
npm run types
```

---

## 🐛 SOLUCIÓN AL ERROR ACTUAL

El error `policy already exists` significa que **YA ejecutaste** `create_checks_tables.sql`.

**NO lo ejecutes de nuevo.** En su lugar:

1. Corre `VERIFICACION_COMPLETA.sql` para ver qué FALTA
2. Ejecuta solo las migraciones que digan "❌ FALTA EJECUTAR"
3. Regenera types con `npm run types`

---

## 📞 NECESITAS AYUDA?

Si `VERIFICACION_COMPLETA.sql` muestra resultados confusos, comparte el output y te digo exactamente qué ejecutar.
