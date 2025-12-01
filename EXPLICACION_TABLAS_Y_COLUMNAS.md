# 📊 EXPLICACIÓN: TABLAS Y COLUMNAS DEL SISTEMA DE AJUSTES

## 🗂️ TABLAS CORRECTAS (SOLO ESTAS DOS)

### **1. `adjustment_reports`**
**Función:** Almacena los REPORTES de ajustes creados por brokers o master.

**Columnas principales:**
```sql
id                  UUID        -- ID único del reporte
broker_id           UUID        -- A quién pertenece el reporte (FK a brokers)
status              TEXT        -- Estado: 'pending', 'approved', 'rejected', 'paid'
total_amount        NUMERIC     -- Total del reporte (suma de comisiones)
broker_notes        TEXT        -- Notas del broker
admin_notes         TEXT        -- Notas del master
payment_mode        TEXT        -- 'immediate' o 'next_fortnight'
fortnight_id        UUID        -- ID de la quincena (si se pagó con quincena)
paid_date           TIMESTAMP   -- Fecha de pago
rejected_reason     TEXT        -- Razón de rechazo
reviewed_at         TIMESTAMP   -- Fecha de revisión
reviewed_by         UUID        -- Quién lo revisó
created_at          TIMESTAMP   -- Fecha de creación
updated_at          TIMESTAMP   -- Fecha de última actualización
```

**Ejemplo de registro:**
```
id: 'abc-123'
broker_id: 'broker-456'
status: 'pending'
total_amount: 820.00  (suma de todas las broker_commission de sus items)
broker_notes: 'Ajustes de noviembre'
created_at: '2025-11-27 10:00:00'
```

---

### **2. `adjustment_report_items`**
**Función:** Almacena los ÍTEMS individuales que pertenecen a cada reporte.

**Columnas principales:**
```sql
id                  UUID        -- ID único del ítem
report_id           UUID        -- A qué reporte pertenece (FK a adjustment_reports)
pending_item_id     UUID        -- Cuál póliza es (FK a pending_items)
commission_raw      NUMERIC     -- Monto bruto de esta póliza
broker_commission   NUMERIC     -- Comisión calculada (raw × percent_default)
created_at          TIMESTAMP   -- Fecha de creación
```

**Ejemplo de registro:**
```
id: 'item-789'
report_id: 'abc-123'  (pertenece al reporte abc-123)
pending_item_id: 'policy-001'  (la póliza específica)
commission_raw: 1000.00
broker_commission: 820.00  (1000 × 0.82)
created_at: '2025-11-27 10:00:00'
```

---

## ✅ RELACIÓN ENTRE TABLAS

```
adjustment_reports (1)  ←→  (N) adjustment_report_items
      ↓
Un reporte tiene muchos items

Ejemplo:
Reporte "abc-123"
  ├─ Item 1: Póliza A, $10.00 bruto → $8.20 comisión
  ├─ Item 2: Póliza B, $20.00 bruto → $16.40 comisión
  └─ Item 3: Póliza C, $30.00 bruto → $24.60 comisión
  
  Total del reporte: $49.20
```

---

## ❌ TABLAS DUPLICADAS QUE NO DEBEN EXISTIR

Si ves alguna de estas en Supabase, son **DUPLICADAS** y deben eliminarse:

- ❌ `adjustments_reports` (con S al final)
- ❌ `adjustments_report_items` (con S en adjustments)
- ❌ `adjustment_items` (sin el "report" en medio)
- ❌ Cualquier otra variación

**Solo deben existir:**
- ✅ `adjustment_reports`
- ✅ `adjustment_report_items`

---

## 📌 COLUMNA `assigned_broker_id` EN `pending_items`

### **¿Se usa o no?**
**SÍ SE USA** ✅ - Es FUNDAMENTAL para el flujo.

### **¿Para qué sirve?**

**1. Filtrar qué ve cada rol:**

**Master:**
```sql
SELECT * FROM pending_items 
WHERE status = 'open' 
  AND assigned_broker_id IS NULL  -- ✅ Solo sin asignar
```
→ Master ve pólizas que NO tienen broker asignado

**Broker:**
```sql
SELECT * FROM pending_items 
WHERE status = 'open' 
  AND assigned_broker_id = 'broker-456'  -- ✅ Solo las suyas
```
→ Broker solo ve pólizas asignadas a él

---

### **2. Se asigna al crear reporte:**

```typescript
// Cuando se crea un reporte:
UPDATE pending_items 
SET 
  status = 'in_review',
  assigned_broker_id = 'broker-456'  // ✅ Se asigna
WHERE id IN ('policy-1', 'policy-2', ...)
```

---

### **3. Se libera al rechazar:**

```typescript
// Cuando master rechaza un reporte:
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL  // ✅ Se libera para reasignar
WHERE id IN ('policy-1', 'policy-2', ...)
```

---

## 🔄 FLUJO COMPLETO DE `assigned_broker_id`

### **Estado Inicial:**
```
pending_items:
├─ policy-1: status='open', assigned_broker_id=NULL
├─ policy-2: status='open', assigned_broker_id=NULL
└─ policy-3: status='open', assigned_broker_id=NULL

Master ve: policy-1, policy-2, policy-3 ✅
Broker ve: nada ✅
```

### **Broker crea reporte:**
```
1. Broker selecciona policy-1 y policy-2
2. Click "Enviar Reporte"
3. Se crea adjustment_reports con broker_id='broker-123'
4. Se actualizan pending_items:
   ├─ policy-1: status='in_review', assigned_broker_id='broker-123' ✅
   ├─ policy-2: status='in_review', assigned_broker_id='broker-123' ✅
   └─ policy-3: status='open', assigned_broker_id=NULL (no cambió)

Master ve: policy-3 ✅ (solo sin asignar)
Broker ve: nada ✅ (porque status='in_review', no 'open')
```

### **Master rechaza reporte:**
```
1. Master rechaza el reporte
2. Se actualizan pending_items:
   ├─ policy-1: status='open', assigned_broker_id=NULL ✅ (liberado)
   ├─ policy-2: status='open', assigned_broker_id=NULL ✅ (liberado)
   └─ policy-3: status='open', assigned_broker_id=NULL (igual)

Master ve: policy-1, policy-2, policy-3 ✅ (todas de nuevo)
Broker ve: nada ✅ (fueron liberadas)
```

---

## 🧹 LIMPIEZA NECESARIA

### **Problema actual:**
```sql
-- Hay items con assigned_broker_id que NO están en reportes
SELECT * FROM pending_items 
WHERE assigned_broker_id IS NOT NULL
  AND status = 'open';
```

Estos items están "atrapados" porque:
- Fueron asignados en el código viejo
- Nunca se creó un reporte
- No aparecen en ninguna lista

### **Solución:**
```sql
-- Resetear TODOS los pending_items
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL;
```

Esto hace que TODOS aparezcan en "Sin Identificar" para empezar de nuevo.

---

## 📊 RESUMEN VISUAL

```
┌─────────────────────────────────────────────────┐
│          SISTEMA DE AJUSTES                      │
└─────────────────────────────────────────────────┘

┌─────────────────┐
│ pending_items   │ (Pólizas sin identificar)
├─────────────────┤
│ id              │
│ policy_number   │
│ commission_raw  │
│ status          │ ← 'open', 'in_review', etc.
│ assigned_broker │ ← NULL o broker_id
└────────┬────────┘
         │
         │ Broker selecciona y crea reporte
         ↓
┌─────────────────────────┐
│ adjustment_reports      │ (Reporte del broker)
├─────────────────────────┤
│ id                      │
│ broker_id               │
│ status                  │ ← 'pending', 'approved', etc.
│ total_amount            │
└────────┬────────────────┘
         │
         │ Tiene muchos items
         ↓
┌────────────────────────────┐
│ adjustment_report_items    │ (Items del reporte)
├────────────────────────────┤
│ id                         │
│ report_id                  │ ← FK a adjustment_reports
│ pending_item_id            │ ← FK a pending_items
│ commission_raw             │
│ broker_commission          │
└────────────────────────────┘
```

---

## ✅ CONCLUSIÓN

**Tablas correctas:**
- ✅ `adjustment_reports` (reportes)
- ✅ `adjustment_report_items` (items de reportes)

**Columna `assigned_broker_id`:**
- ✅ SÍ se usa
- ✅ Es fundamental para filtrar
- ✅ Se asigna al crear reporte
- ✅ Se libera al rechazar

**Limpieza necesaria:**
1. ✅ Borrar todos los reportes (reset)
2. ✅ Resetear assigned_broker_id de todos los pending_items
3. ✅ Eliminar tablas duplicadas (si existen)

**Ejecutar:**
```sql
BEGIN;
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;
UPDATE pending_items SET status = 'open', assigned_broker_id = NULL;
COMMIT;
```
