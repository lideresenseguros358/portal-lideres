# 🚀 EJECUTAR BULK UPLOAD DE COMISIONES

**Quincena:** 1-15 Noviembre 2025 (CERRADA/PAID)  
**Total:** 692 comisiones  
**Monto bruto:** $7,747.32

---

## ⚡ EJECUCIÓN RÁPIDA

```bash
cd c:\Users\Samud\portal-lideres
node scripts/execute-bulk-upload.mjs
```

**¡Eso es todo!** El script:
- ✅ Carga variables de `.env.local` automáticamente
- ✅ Procesa las 692 comisiones en lotes de 50
- ✅ Crea quincena CERRADA
- ✅ Calcula comisiones netas con porcentajes correctos
- ✅ Aplica regla VIDA-ASSA (100%)
- ✅ Muestra progreso en tiempo real

---

## 📊 QUÉ VAS A VER

```
🚀 BULK UPLOAD DE COMISIONES - Primera Quincena Nov 2025

═══════════════════════════════════════════════════════

✅ Variables de entorno cargadas desde .env.local

📄 Leyendo CSV...
   ✅ 692 filas cargadas

📚 Cargando datos de referencia...
   ✅ 15 aseguradoras
   ✅ 45 brokers

📅 Creando quincena (1-15 Nov 2025)...
   ✅ Quincena creada: abc-123-def

📦 Creando importación...
   ✅ Import creado: xyz-456-ghi
   💰 Total bruto: $7747.32

🔄 Procesando 692 comisiones en lotes de 50...

📦 Lote 1/14 (50 filas)...
   ✅ Progreso: 7.2%

📦 Lote 2/14 (50 filas)...
   ✅ Progreso: 14.5%

... (continúa hasta 100%)

📊 Actualizando totales por broker...
   ✅ 12 brokers actualizados

═══════════════════════════════════════════════════════
✅ BULK UPLOAD COMPLETADO
═══════════════════════════════════════════════════════

📊 RESUMEN:
   Total procesadas:     692
   ✅ Exitosas:          639
   ❌ Errores:           0
   ⚠️  No identificados:  53

📦 NUEVOS REGISTROS:
   Clientes creados:     450
   Pólizas creadas:      480

🔥 ESPECIALES:
   VIDA en ASSA (100%):  100

💰 TOTALES POR BROKER:
   1. Ana Maria Rodriguez
      Pólizas: 150 | Bruto: $2,500.00 | Neto: $75.00
   2. Carlos Garcia
      Pólizas: 120 | Bruto: $1,800.00 | Neto: $54.00
   ...

═══════════════════════════════════════════════════════
```

---

## 🔍 VERIFICACIÓN EN SUPABASE

Después de ejecutar, puedes verificar en Supabase:

### **1. Ver Quincena Creada**
```sql
SELECT * FROM fortnights 
WHERE period_start = '2025-11-01' 
  AND period_end = '2025-11-15';
```

### **2. Ver Totales por Broker**
```sql
SELECT 
  b.name,
  b.email,
  fbt.gross_amount,
  fbt.net_amount,
  (SELECT COUNT(*) 
   FROM comm_items ci 
   WHERE ci.broker_id = b.id 
     AND ci.import_id IN (
       SELECT id FROM comm_imports 
       WHERE period_label IN (
         SELECT id FROM fortnights 
         WHERE period_start = '2025-11-01'
       )
     )
  ) as num_polizas
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
WHERE fbt.fortnight_id IN (
  SELECT id FROM fortnights 
  WHERE period_start = '2025-11-01'
)
ORDER BY fbt.net_amount DESC;
```

### **3. Ver Comisiones Sin Identificar**
```sql
SELECT 
  policy_number,
  insured_name,
  gross_amount,
  (raw_row->>'broker_email') as email_original
FROM comm_items
WHERE broker_id IS NULL
  AND import_id IN (
    SELECT id FROM comm_imports 
    WHERE period_label IN (
      SELECT id FROM fortnights 
      WHERE period_start = '2025-11-01'
    )
  )
ORDER BY gross_amount DESC;
```

### **4. Ver Pólizas VIDA en ASSA (100%)**
```sql
SELECT 
  policy_number,
  insured_name,
  gross_amount,
  (raw_row->>'net_amount')::NUMERIC as net_amount,
  (raw_row->>'percentage_applied')::NUMERIC * 100 as percentage
FROM comm_items
WHERE (raw_row->>'is_vida_assa')::BOOLEAN = true
  AND import_id IN (
    SELECT id FROM comm_imports 
    WHERE period_label IN (
      SELECT id FROM fortnights 
      WHERE period_start = '2025-11-01'
    )
  )
ORDER BY gross_amount DESC
LIMIT 20;
```

---

## ⚙️ CONFIGURACIÓN

El script usa estas variables de `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

Si no existen, verás este error:
```
❌ Faltan variables de entorno:
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY

💡 Crea un archivo .env.local con estas variables
```

---

## 🔥 REGLAS ESPECIALES

### **VIDA en ASSA = 100%**
```javascript
if (insurer === 'ASSA' && policy_type === 'VIDA') {
  percentage = 1.0;  // 100%
  net_amount = gross_amount × 1.0;
}
```

**Ejemplo:**
```
Póliza: 12B34565
Cliente: ALEXIS CONCEPCION ALVEO GONZALEZ
Aseguradora: ASSA
Tipo: VIDA
Bruto: $22.7

→ Porcentaje: 100%
→ Neto: $22.70
```

### **Broker Por Email**
```javascript
// Si existe en BD
broker = brokers.find(b => b.email === 'amariar23@gmail.com');
percentage = broker.percent_default; // Ej: 0.03 = 3%

// Si NO existe
broker_id = NULL;
→ Va a sección AJUSTES
```

### **Pólizas Existentes**
```javascript
// Busca por policy_number
existingPolicy = await supabase
  .from('policies')
  .select()
  .eq('policy_number', '12B34565')
  .single();

if (existingPolicy) {
  // ACTUALIZA la póliza existente
  await supabase.from('policies').update({...});
} else {
  // CREA cliente + póliza nuevos
  await supabase.from('clients').insert({...});
  await supabase.from('policies').insert({...});
}
```

---

## 🛑 SI HAY ERRORES

### **Error: Aseguradora no encontrada**
```
⚠️  Fila 23: Aseguradora no encontrada: XYZ
```
**Solución:** Verifica que el nombre en el CSV coincida con la BD

### **Error: Broker no encontrado**
```
⚠️  Broker no encontrado: email@example.com
```
**Solución:** La comisión se crea con `broker_id = NULL` (va a Ajustes)

### **Error de conexión**
```
❌ Error: fetch failed
```
**Solución:** Verifica tu conexión a internet y las credenciales de Supabase

---

## 📝 DESPUÉS DE EJECUTAR

1. **Verifica en Supabase** que la quincena se creó
2. **Revisa los totales** por broker
3. **Asigna comisiones no identificadas** desde la sección Ajustes
4. **Notifica a los brokers** (si aplica)

---

## 🔄 SI NECESITAS RE-EJECUTAR

Para limpiar y volver a ejecutar:

```sql
-- 1. Eliminar comisiones
DELETE FROM comm_items 
WHERE import_id IN (
  SELECT id FROM comm_imports 
  WHERE period_label IN (
    SELECT id FROM fortnights 
    WHERE period_start = '2025-11-01'
  )
);

-- 2. Eliminar importación
DELETE FROM comm_imports 
WHERE period_label IN (
  SELECT id FROM fortnights 
  WHERE period_start = '2025-11-01'
);

-- 3. Eliminar totales
DELETE FROM fortnight_broker_totals 
WHERE fortnight_id IN (
  SELECT id FROM fortnights 
  WHERE period_start = '2025-11-01'
);

-- 4. Eliminar quincena
DELETE FROM fortnights 
WHERE period_start = '2025-11-01' 
  AND period_end = '2025-11-15';
```

Luego ejecuta de nuevo:
```bash
node scripts/execute-bulk-upload.mjs
```

---

**🎯 ¿Listo? Ejecuta `node scripts/execute-bulk-upload.mjs` y listo! 🚀**
