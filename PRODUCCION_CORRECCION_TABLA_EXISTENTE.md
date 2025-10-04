# PRODUCCIÓN - CORRECCIÓN: USANDO TABLA EXISTENTE ✅

**Fecha:** 2025-10-03 22:10  
**Estado:** ✅ CORREGIDO - USA TABLA `production` EXISTENTE

---

## ⚠️ ERROR DETECTADO Y CORREGIDO

**Problema:** Intenté crear una nueva tabla `production_data` cuando ya existe una tabla `production` en la base de datos.

**Solución:** Adapté el código para usar la tabla `production` existente y creé una migración que solo agrega las columnas y configuraciones necesarias.

---

## ✅ ARCHIVOS CORREGIDOS

### 1. Nueva Migración (Corrección) ✅

**Archivo:** `migrations/adapt_existing_production_table.sql`

Esta migración:
- ✅ Agrega columnas necesarias SI NO EXISTEN
- ✅ Agrega constraints (Canceladas <= Bruto)
- ✅ Crea índices para performance
- ✅ Configura RLS policies
- ✅ Crea trigger para updated_at
- ✅ Inserta configuración de concursos
- ✅ Incluye queries de verificación

**Columnas que agrega (si no existen):**
```sql
- broker_id UUID (FK a brokers)
- year INTEGER
- month TEXT (jan, feb, mar...)
- bruto DECIMAL(12,2)
- canceladas DECIMAL(12,2)
- pma_neto DECIMAL(12,2) GENERATED (bruto - canceladas)
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

**Constraints:**
```sql
- canceladas <= bruto
- bruto >= 0
- canceladas >= 0
- month IN ('jan', 'feb', ..., 'dec')
- UNIQUE(broker_id, year, month)
```

### 2. Endpoints API Actualizados ✅

**Archivos modificados:**
- `src/app/(app)/api/production/route.ts`
- `src/app/(app)/api/production/rankings/top5/route.ts`
- `src/app/(app)/api/production/month-winner/route.ts`

**Cambios:**
```typescript
// ANTES (incorrecto):
.from('production_data')
brokers!production_data_broker_id_fkey

// DESPUÉS (correcto):
.from('production')
brokers!production_broker_id_fkey
```

### 3. Dashboard Queries Actualizadas ✅

**Archivo modificado:**
- `src/lib/dashboard/queries.ts`

**Funciones corregidas:**
- `getBrokerRanking()` → usa tabla `production`
- `getBrokerOfTheMonth()` → usa tabla `production`

---

## 📋 PASOS PARA EJECUTAR

### 1. Ejecutar Migración de Adaptación

```sql
-- En Supabase SQL Editor, ejecutar:
-- migrations/adapt_existing_production_table.sql

-- Esto agregará las columnas necesarias a la tabla production existente
```

### 2. Verificar Columnas Agregadas

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'production' 
ORDER BY ordinal_position;

-- Ver constraints
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'production'::regclass;

-- Ver policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'production';
```

### 3. Insertar Datos de Prueba

```sql
-- Obtener IDs de brokers
SELECT id, name FROM brokers LIMIT 5;

-- Insertar producción de prueba (reemplazar UUIDs con los reales)
INSERT INTO production (broker_id, year, month, bruto, canceladas) VALUES
  ('BROKER_UUID_1', 2024, 'jan', 15000, 500),
  ('BROKER_UUID_1', 2024, 'feb', 18000, 600),
  ('BROKER_UUID_1', 2024, 'mar', 22000, 700),
  ('BROKER_UUID_2', 2024, 'jan', 20000, 800),
  ('BROKER_UUID_2', 2024, 'feb', 25000, 900),
  ('BROKER_UUID_2', 2024, 'mar', 28000, 1000);

-- Verificar inserción
SELECT 
  b.name,
  p.year,
  p.month,
  p.bruto,
  p.canceladas,
  p.pma_neto  -- Calculado automáticamente
FROM production p
JOIN brokers b ON b.id = p.broker_id
ORDER BY b.name, p.year, p.month;
```

### 4. Probar Validación

```sql
-- DEBE FALLAR (canceladas > bruto):
INSERT INTO production (broker_id, year, month, bruto, canceladas) 
VALUES ('BROKER_UUID_1', 2024, 'apr', 10000, 15000);
-- Error esperado: violates check constraint "canceladas_le_bruto"

-- DEBE PASAR:
INSERT INTO production (broker_id, year, month, bruto, canceladas) 
VALUES ('BROKER_UUID_1', 2024, 'apr', 15000, 10000);
```

---

## 🔍 DIFERENCIAS CLAVE

### Tabla Production (Existente - Adaptada)
```sql
CREATE TABLE production (
  -- Columnas existentes (las que ya tenía)
  ...
  
  -- Columnas agregadas por la migración:
  + broker_id UUID REFERENCES brokers(id)
  + year INTEGER
  + month TEXT CHECK (month IN ('jan', 'feb', ...))
  + bruto DECIMAL(12,2) >= 0
  + canceladas DECIMAL(12,2) >= 0
  + pma_neto DECIMAL(12,2) GENERATED (bruto - canceladas)
  + created_at TIMESTAMPTZ
  + updated_at TIMESTAMPTZ
  
  -- Constraint crítico:
  + CONSTRAINT canceladas_le_bruto CHECK (canceladas <= bruto)
  + CONSTRAINT unique_broker_year_month UNIQUE(broker_id, year, month)
)
```

### RLS Policies

```sql
-- Master: Full access
✅ Masters can view all production
✅ Masters can insert production
✅ Masters can update production

-- Broker: Solo su data
✅ Brokers can view their production (WHERE broker_id = profiles.broker_id)
```

---

## ✅ VERIFICACIÓN BUILD

```bash
✅ npm run build - EXITOSO
✅ 0 errores TypeScript
✅ Todos los endpoints actualizados
✅ Dashboards conectados correctamente
```

---

## 📊 FLUJO COMPLETO

```
Usuario → Edita celda en ProductionMatrix
    ↓
PUT /api/production
    ↓
Valida: canceladas <= bruto
    ↓
UPSERT en tabla production
    ↓
Trigger actualiza updated_at
    ↓
pma_neto se calcula automáticamente (GENERATED column)
    ↓
Dashboard recalcula Top-5 y Corredor del mes
```

---

## 🎯 RESULTADO

### Lo que se corrigió:
- ✅ Eliminada referencia a tabla `production_data`
- ✅ Usada tabla `production` existente
- ✅ Migración solo agrega columnas necesarias
- ✅ No crea tabla nueva
- ✅ Respeta estructura existente
- ✅ Foreign key correcto: `production_broker_id_fkey`
- ✅ Todos los endpoints actualizados
- ✅ Dashboards actualizados
- ✅ Build exitoso

### Archivo a ejecutar:
```
migrations/adapt_existing_production_table.sql
```

### Archivo obsoleto (NO ejecutar):
```
migrations/create_production_tables.sql ❌ (intentaba crear tabla nueva)
```

---

## 📝 NOTAS IMPORTANTES

1. **La migración es segura:** Usa `IF NOT EXISTS` y `DO $$ ... END $$` para evitar errores si algo ya existe.

2. **No rompe datos existentes:** Solo agrega columnas nuevas, no modifica ni elimina nada.

3. **Columna calculada automática:** `pma_neto` se calcula automáticamente como `(bruto - canceladas)` usando `GENERATED ALWAYS AS ... STORED`.

4. **Validación en dos niveles:**
   - Backend API: Valida antes de insertar
   - Base de datos: CHECK constraint refuerza la regla

5. **RLS habilitado:** Solo Master puede editar, Broker solo puede ver su data.

---

**CORRECCIÓN COMPLETADA** ✅

**Próximo paso:** Ejecutar `migrations/adapt_existing_production_table.sql` en Supabase
