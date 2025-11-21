# 🚀 BULK UPLOAD DE COMISIONES - SQL DIRECTO

**Quincena:** 1-15 Noviembre 2025 (CERRADA/PAID)

---

## 📊 ESTADÍSTICAS DEL CSV

```
✅ Total comisiones:     692
👥 Con broker asignado:  639 (92.3%)
⚠️  Sin broker:          53 (7.7%)
🔥 VIDA en ASSA:         100 pólizas (100% comisión automática)
💰 Monto bruto total:    $7,747.32
```

---

## 📄 ARCHIVOS GENERADOS

1. **`bulk-upload-comisiones.sql`** (61,027 líneas)
   - Script SQL completo para ejecutar directamente en Supabase
   - Procesa las 692 comisiones del CSV
   - Crea quincena, importación, clientes, pólizas y comisiones

2. **`scripts/generate-bulk-sql.mjs`**
   - Script para regenerar el SQL si modificas el CSV

---

## 🚀 CÓMO EJECUTAR

### **Opción 1: Desde Supabase Dashboard (RECOMENDADO)**

1. **Abre Supabase**
   - Ve a https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Abre SQL Editor**
   - Click en "SQL Editor" en el menú lateral
   - Click en "New Query"

3. **Copia el SQL**
   - Abre `bulk-upload-comisiones.sql`
   - Copia TODO el contenido (Ctrl+A, Ctrl+C)
   - Pega en el editor de Supabase

4. **Ejecuta**
   - Click en "Run" o presiona F5
   - Espera ~30-60 segundos (son 692 comisiones)

5. **Revisa los NOTICES**
   - En el panel de resultados verás:
     - Quincena ID creada
     - Import ID creado
     - Total de comisiones procesadas
     - Resumen por broker
     - Comisiones sin identificar

---

### **Opción 2: Desde psql (CLI)**

```bash
# Conectar a tu base de datos
psql postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]

# Ejecutar el script
\i bulk-upload-comisiones.sql
```

---

## 📋 QUÉ HACE EL SCRIPT

### **1. Crea la Quincena CERRADA**
```sql
INSERT INTO fortnights (period_start, period_end, status, notify_brokers)
VALUES ('2025-11-01', '2025-11-15', 'PAID', false);
```

### **2. Crea el Import**
```sql
INSERT INTO comm_imports (period_label, insurer_id, total_amount)
VALUES (fortnight_id, assa_id, 7747.32);
```

### **3. Por CADA comisión (692 veces):**

#### a) **Busca Aseguradora**
```sql
SELECT id FROM insurers WHERE UPPER(name) = 'ASSA';
```

#### b) **Busca Broker por Email**
```sql
SELECT id FROM brokers WHERE LOWER(email) = 'amariar23@gmail.com';
```

#### c) **Determina Porcentaje**
```sql
-- Si es VIDA en ASSA → 100%
IF (insurer = 'ASSA' AND policy_type = 'VIDA') THEN
  percentage = 1.0;
ELSE
  percentage = broker.percent_default;
END IF;
```

#### d) **Busca/Crea Póliza**
```sql
-- Si existe: actualiza
UPDATE policies SET broker_id = ..., start_date = ...;

-- Si NO existe: crea cliente + póliza
INSERT INTO clients (name, broker_id) VALUES (...);
INSERT INTO policies (policy_number, client_id, ...) VALUES (...);
```

#### e) **Crea Comisión**
```sql
INSERT INTO comm_items (
  import_id, policy_number, insured_name, 
  broker_id, gross_amount, raw_row
) VALUES (...);
```

### **4. Actualiza Totales por Broker**
```sql
INSERT INTO fortnight_broker_totals (fortnight_id, broker_id, gross_amount, net_amount)
SELECT fortnight_id, broker_id, SUM(gross), SUM(net)
FROM comm_items
GROUP BY broker_id;
```

---

## ✅ VERIFICACIÓN

### **Al final del script se ejecutan automáticamente:**

#### 1. **Ver Quincena Creada**
```sql
SELECT * FROM fortnights 
WHERE period_start = '2025-11-01' 
  AND period_end = '2025-11-15';
```

#### 2. **Ver Totales por Broker**
```sql
SELECT b.name, fbt.gross_amount, fbt.net_amount, COUNT(*) as num_comisiones
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
WHERE fbt.fortnight_id = ...
ORDER BY fbt.net_amount DESC;
```

#### 3. **Ver Comisiones Sin Identificar (primeras 20)**
```sql
SELECT policy_number, insured_name, gross_amount
FROM comm_items
WHERE broker_id IS NULL
LIMIT 20;
```

---

## 🔍 CÁLCULO DE COMISIONES

### **Ejemplo 1: VIDA en ASSA (100%)**
```
Póliza: 12B34565
Cliente: ALEXIS CONCEPCION ALVEO GONZALEZ
Aseguradora: ASSA
Tipo: VIDA
Monto bruto: $22.7

✅ Porcentaje: 100% (regla VIDA-ASSA)
💰 Comisión neta: $22.7 × 1.0 = $22.70
```

### **Ejemplo 2: Póliza Normal con Broker (3%)**
```
Póliza: 06-55-1317797-2
Cliente: MONTALVO VILLEGAS RIASCO
Aseguradora: FEDPA
Broker: amariar23@gmail.com (percent_default = 0.03)
Monto bruto: $11.37

✅ Porcentaje: 3% (broker default)
💰 Comisión neta: $11.37 × 0.03 = $0.34
```

### **Ejemplo 3: Sin Broker (0%)**
```
Póliza: 14B30686
Cliente: NIDIA NORIS BATISTA
broker_email: (vacío)
Monto bruto: $2.1

⚠️  Porcentaje: 0% (sin broker)
💰 Comisión neta: $2.1 × 0 = $0.00
📋 Va a AJUSTES para asignación manual
```

---

## ⚠️ IMPORTANTES CONSIDERACIONES

### **1. El Script es IDEMPOTENTE (casi)**
- Si ejecutas 2 veces, creará 2 quincenas diferentes
- Para re-ejecutar, primero BORRA la quincena anterior:
  ```sql
  DELETE FROM comm_items WHERE import_id IN (
    SELECT id FROM comm_imports WHERE period_label IN (
      SELECT id FROM fortnights WHERE period_start = '2025-11-01'
    )
  );
  DELETE FROM comm_imports WHERE period_label IN (
    SELECT id FROM fortnights WHERE period_start = '2025-11-01'
  );
  DELETE FROM fortnight_broker_totals WHERE fortnight_id IN (
    SELECT id FROM fortnights WHERE period_start = '2025-11-01'
  );
  DELETE FROM fortnights WHERE period_start = '2025-11-01';
  ```

### **2. Transacción ATOMICA**
- Todo el script está en un `BEGIN...COMMIT`
- Si hay UN error, TODO se revierte
- Nada se guarda hasta el final

### **3. Pólizas Existentes**
- Si la póliza YA existe → se ACTUALIZA (no duplica)
- Si NO existe → crea cliente + póliza nuevos

### **4. Brokers No Encontrados**
- Si el email NO existe en `brokers` → `broker_id = NULL`
- Estas comisiones irán a **Ajustes** para asignación manual

---

## 📊 QUERIES ÚTILES POST-EJECUCIÓN

### **Total de Comisiones Netas por Broker**
```sql
SELECT 
  b.name,
  b.email,
  COUNT(*) as num_polizas,
  SUM(ci.gross_amount) as total_bruto,
  SUM((ci.raw_row->>'net_amount')::NUMERIC) as total_neto,
  AVG((ci.raw_row->>'percentage_applied')::NUMERIC) * 100 as porcentaje_promedio
FROM comm_items ci
JOIN brokers b ON b.id = ci.broker_id
WHERE ci.import_id IN (
  SELECT id FROM comm_imports 
  WHERE period_label IN (
    SELECT id FROM fortnights 
    WHERE period_start = '2025-11-01'
  )
)
GROUP BY b.id, b.name, b.email
ORDER BY total_neto DESC;
```

### **Comisiones VIDA en ASSA (100%)**
```sql
SELECT 
  policy_number,
  insured_name,
  gross_amount,
  (raw_row->>'net_amount')::NUMERIC as net_amount,
  (raw_row->>'broker_email') as broker_email
FROM comm_items
WHERE (raw_row->>'is_vida_assa')::BOOLEAN = true
  AND import_id IN (
    SELECT id FROM comm_imports 
    WHERE period_label IN (
      SELECT id FROM fortnights WHERE period_start = '2025-11-01'
    )
  )
ORDER BY gross_amount DESC;
```

### **Comisiones Sin Identificar**
```sql
SELECT 
  policy_number,
  insured_name,
  gross_amount,
  (raw_row->>'broker_email') as broker_email_original
FROM comm_items
WHERE broker_id IS NULL
  AND import_id IN (
    SELECT id FROM comm_imports 
    WHERE period_label IN (
      SELECT id FROM fortnights WHERE period_start = '2025-11-01'
    )
  )
ORDER BY gross_amount DESC;
```

---

## 🔄 REGENERAR EL SQL

Si modificas el CSV y necesitas regenerar el SQL:

```bash
cd c:\Users\Samud\portal-lideres
node scripts/generate-bulk-sql.mjs
```

Esto volverá a generar `bulk-upload-comisiones.sql` con los datos actualizados.

---

## 📝 NOTAS FINALES

- ✅ **Total de líneas SQL:** 61,027
- ⏱️ **Tiempo estimado:** 30-60 segundos
- 💾 **Espacio en BD:** ~500 KB (692 comisiones)
- 🔒 **Quincena:** CLOSED (PAID) - No modificable después

**¿Todo listo? Ejecuta el script en Supabase SQL Editor y listo! 🚀**
