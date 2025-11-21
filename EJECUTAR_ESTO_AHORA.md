# 🚀 EJECUTAR ESTO AHORA - CORRECCIÓN FINAL

## ✅ Resumen de Correcciones

### 1. **Normalización de Nombres** ✅ CORREGIDO
**Problema:** Guiones se eliminaban
**Solución:** Guiones ahora se convierten en espacios

**Ejemplos:**
- `"González-López"` → `"GONZALEZ LOPEZ"` ✅
- `"Juan-Carlos"` → `"JUAN CARLOS"` ✅
- `"María José"` → `"MARIA JOSE"` ✅

### 2. **Códigos ASSA al 100%** ✅ CORREGIDO
**Problema:** Solo VIDA en ASSA iba al 100%
**Solución:** Ahora también los códigos ASSA asignados a cada broker van al 100%

**Lógica:**
1. **VIDA en ASSA** → 100%
2. **Póliza coincide con `broker.assa_code` en ASSA** → 100%
3. **Otros casos** → Aplicar `percent_default` del broker

---

## 📁 Archivos Creados

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `normalize-names-CORREGIDO.sql` | Función SQL con guiones→espacios | ✅ Listo |
| `bulk-template-CORREGIDO.sql` | Template con lógica correcta | ✅ Listo |
| `CORRECCION_FINAL_NORMALIZACION_Y_CODIGOS.md` | Documentación completa | ✅ Listo |
| `EJECUTAR_ESTO_AHORA.md` | Esta guía | ✅ Listo |

---

## 🎯 PASOS A EJECUTAR

### **PASO 1: Normalizar Nombres Existentes** (5 min)

#### 1.1 Abrir Supabase SQL Editor

#### 1.2 Ejecutar función de normalización
```sql
-- Copiar y pegar de: normalize-names-CORREGIDO.sql (líneas 7-35)
CREATE OR REPLACE FUNCTION normalize_name(text_input TEXT)
RETURNS TEXT AS $$
...
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 1.3 Probar la función
```sql
-- Verificar que funciona correctamente
SELECT normalize_name('González-López');
-- Debe retornar: GONZALEZ LOPEZ
```

#### 1.4 Ver cuántos clientes necesitan corrección
```sql
SELECT COUNT(*) as total_con_caracteres_especiales
FROM clients
WHERE name != normalize_name(name);
```

#### 1.5 Crear backup y actualizar
```sql
-- BACKUP
DROP TABLE IF EXISTS clients_backup_names;
CREATE TABLE clients_backup_names AS 
SELECT id, name, created_at, NOW() as backup_date
FROM clients;

-- ACTUALIZAR (con transacción)
BEGIN;

UPDATE clients 
SET name = normalize_name(name)
WHERE name != normalize_name(name);

-- Ver resultado
SELECT COUNT(*) as actualizados FROM clients_backup_names cb
JOIN clients c ON c.id = cb.id WHERE c.name != cb.name;

-- Si todo bien: COMMIT;
COMMIT;
```

#### 1.6 Verificar
```sql
-- Debe retornar 0
SELECT COUNT(*) FROM clients WHERE name != normalize_name(name);
```

---

### **PASO 2: Verificar Códigos ASSA de Brokers** (2 min)

```sql
-- Ver qué brokers tienen códigos ASSA asignados
SELECT 
  b.id,
  b.name,
  b.email,
  b.assa_code,
  b.percent_default,
  CASE 
    WHEN b.assa_code IS NULL THEN '❌ Sin código ASSA'
    ELSE '✅ Tiene código: ' || b.assa_code
  END as estado
FROM brokers b
WHERE b.active = true
ORDER BY b.name;
```

**Resultado esperado:**
- Ver lista de brokers
- Identificar cuáles tienen `assa_code` asignado
- Esos códigos irán al 100% en ASSA

---

### **PASO 3: Regenerar Bulk Import** ⚠️ IMPORTANTE

El archivo `bulk-upload-comisiones.sql` actual está **INCORRECTO**.

Debe regenerarse con:
1. ✅ Nombres normalizados (guiones→espacios)
2. ✅ Lógica de códigos ASSA al 100%

#### Opciones:

**OPCIÓN A: Modificar script generador TypeScript**

1. Buscar el script que genera el bulk (probablemente en `/scripts/`)
2. Agregar la función `normalizeClientName()` del template
3. Agregar la función `shouldApply100Percent()` del template
4. Regenerar el bulk

**OPCIÓN B: Hacerlo manualmente** (si el CSV es pequeño)

Usar el template `bulk-template-CORREGIDO.sql` como base y adaptar.

---

## 🔍 Verificación de Cálculos

### Después de ejecutar el bulk, verificar:

```sql
-- Ver ejemplos de comisiones con porcentajes aplicados
SELECT 
  ci.policy_number,
  ci.insured_name,
  i.name as aseguradora,
  ci.gross_amount,
  ci.raw_row->>'percentage_applied' as porcentaje,
  ci.raw_row->>'net_amount' as neto,
  ci.raw_row->>'is_assa_100' as es_assa_100,
  ci.raw_row->>'broker_assa_code' as codigo_assa_broker,
  b.name as broker,
  b.percent_default as porcentaje_default_broker
FROM comm_items ci
LEFT JOIN insurers i ON i.id = ci.insurer_id
LEFT JOIN brokers b ON b.id = ci.broker_id
WHERE i.name = 'ASSA'
ORDER BY ci.policy_number
LIMIT 50;
```

### Casos esperados:

| Caso | Aseguradora | Tipo | Póliza | Código Broker | % Aplicado |
|------|-------------|------|--------|---------------|------------|
| VIDA | ASSA | VIDA | 12B34565 | PJ750-4 | 100% |
| Código ASSA | ASSA | AUTO | PJ750-4 | PJ750-4 | 100% |
| Otra póliza | ASSA | AUTO | 14B57241 | PJ750-4 | 70% (default) |
| Otra aseguradora | FEDPA | - | cualquiera | - | 70% (default) |

---

## ✅ Checklist

- [ ] Función `normalize_name()` creada en BD
- [ ] Función probada (guiones → espacios)
- [ ] Backup de clientes creado
- [ ] Nombres de clientes actualizados
- [ ] Verificado: 0 clientes pendientes normalizar
- [ ] Revisados códigos ASSA de brokers
- [ ] Script generador TypeScript modificado
- [ ] Bulk regenerado con correcciones
- [ ] Bulk ejecutado en Supabase
- [ ] Verificados cálculos de porcentajes
- [ ] ✅ TODO CORRECTO

---

## 📞 Si algo falla

### Revertir nombres:
```sql
BEGIN;
UPDATE clients c
SET name = cb.name
FROM clients_backup_names cb
WHERE c.id = cb.id AND c.name != cb.name;
COMMIT;
```

### Verificar un broker específico:
```sql
SELECT 
  ci.*,
  b.name as broker,
  b.assa_code,
  b.percent_default
FROM comm_items ci
JOIN brokers b ON b.id = ci.broker_id
WHERE b.email = 'amariar23@gmail.com'
LIMIT 20;
```

---

## 🎯 Resultado Final

Después de ejecutar todo:
1. ✅ Nombres sin ñ, sin acentos, guiones convertidos en espacios
2. ✅ VIDA en ASSA al 100%
3. ✅ Códigos ASSA de brokers al 100%
4. ✅ Resto de pólizas con percent_default correcto
5. ✅ Base de datos lista para producción

**¡Listo para usar!** 🚀
