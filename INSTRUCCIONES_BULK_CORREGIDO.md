# INSTRUCCIONES PARA BULK IMPORT CORREGIDO

## Problemas Identificados en el Script Actual

### 1. ❌ Nombres sin Normalizar
Los nombres de clientes tienen caracteres especiales que causan errores:
- `ALVARO AURELIO ARCIA NU�EZ` → Debe ser `ALVARO AURELIO ARCIA NUNEZ`
- `MATEO PATI�O MARTINEZ` → Debe ser `MATEO PATINO MARTINEZ`

### 2. ✅ Cálculo de Porcentajes (CORRECTO)
El script SÍ está obteniendo correctamente el `percent_default` de cada broker:
```sql
ELSIF v_broker_id IS NOT NULL THEN
  SELECT percent_default INTO v_percentage FROM brokers WHERE id = v_broker_id;
```

**IMPORTANTE**: Si los cálculos están mal, el problema NO está en el script, sino en la configuración de los brokers en la base de datos. Verificar que cada broker tenga su `percent_default` configurado correctamente.

### 3. ✅ Lógica ASSA + VIDA (CORRECTO)
El script correctamente aplica 100% (1.0) a pólizas de VIDA en ASSA:
```sql
v_is_vida_assa := (insurer_name = 'ASSA' AND policy_type = 'VIDA');
IF v_is_vida_assa THEN
  v_percentage := 1.0; -- 100% para VIDA en ASSA
```

## Solución: Regenerar el Script con Normalización

### PASO 1: Ejecutar Función de Normalización

Ejecutar el archivo `normalize-names-function.sql` en Supabase SQL Editor para crear la función `normalize_name()`.

### PASO 2: Verificar Configuración de Brokers

Antes de regenerar el bulk, verificar que TODOS los brokers tengan su porcentaje configurado:

```sql
-- Ver brokers sin porcentaje configurado
SELECT 
  id,
  name,
  email,
  percent_default,
  CASE 
    WHEN percent_default IS NULL THEN '❌ SIN CONFIGURAR'
    WHEN percent_default = 0 THEN '⚠️ CONFIGURADO EN 0%'
    ELSE '✅ OK'
  END as estado
FROM brokers
WHERE active = true
ORDER BY name;
```

**Configurar porcentajes faltantes:**
```sql
-- Ejemplo: Configurar 70% para un broker específico
UPDATE brokers
SET percent_default = 0.70
WHERE email = 'broker@example.com';
```

### PASO 3: Modificar el Script TypeScript Generador

El script Node.js que genera el bulk debe modificarse para normalizar nombres:

**Archivo a modificar**: (buscar el script que genera `bulk-upload-comisiones.sql`)

**Agregar función de normalización:**
```typescript
function normalizeClientName(name: string): string {
  if (!name) return '';
  
  let normalized = name.trim().toUpperCase();
  
  // Reemplazar acentos y ñ
  const accents: Record<string, string> = {
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
    'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
    'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
    'Ñ': 'N'
  };
  
  for (const [char, replacement] of Object.entries(accents)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  // Eliminar caracteres especiales (solo A-Z, 0-9, espacios)
  normalized = normalized.replace(/[^A-Z0-9 ]/g, '');
  
  // Comprimir espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}
```

**Usar la función al generar INSERT de clientes:**
```typescript
const clientName = normalizeClientName(row.clientName);

sqlLines.push(`
  INSERT INTO clients (name, broker_id, active, created_at)
  VALUES ('${clientName}', ...)`);
```

### PASO 4: Regenerar el Script Bulk

```bash
# Ejecutar el script generador con los datos del CSV
node scripts/generate-bulk-import.js --input comisiones-nov-2025.csv --output bulk-upload-comisiones-CORREGIDO.sql
```

### PASO 5: Verificar el Script Generado

Buscar en el nuevo script ejemplos de nombres normalizados:
```sql
-- ✅ CORRECTO
INSERT INTO clients (name, ...) VALUES ('ALVARO AURELIO ARCIA NUNEZ', ...)

-- ❌ INCORRECTO (si aún aparece así, revisar el generador)
INSERT INTO clients (name, ...) VALUES ('ALVARO AURELIO ARCIA NU�EZ', ...)
```

### PASO 6: Ejecutar el Script Corregido

1. **Backup primero:**
```sql
-- Crear backup de tablas críticas
CREATE TABLE clients_backup AS SELECT * FROM clients;
CREATE TABLE policies_backup AS SELECT * FROM policies;
CREATE TABLE comm_items_backup AS SELECT * FROM comm_items;
```

2. **Ejecutar script corregido** en Supabase SQL Editor

3. **Verificar resultados:**
```sql
-- Verificar que no haya caracteres especiales
SELECT 
  id, 
  name
FROM clients
WHERE name ~ '[^A-Z0-9 ]'  -- Busca caracteres que NO sean A-Z, 0-9 o espacio
ORDER BY name;

-- Debe retornar 0 filas
```

## Verificación de Porcentajes

### Verificar que los cálculos sean correctos:

```sql
-- Ver items con sus porcentajes aplicados
SELECT 
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount,
  ci.raw_row->>'percentage_applied' as porcentaje_aplicado,
  ci.raw_row->>'net_amount' as monto_neto_calculado,
  ci.raw_row->>'broker_email' as broker_email,
  b.percent_default as porcentaje_configurado_broker,
  CASE 
    WHEN ci.raw_row->>'is_vida_assa' = 'true' THEN '100% (VIDA+ASSA)'
    ELSE CONCAT((b.percent_default * 100)::text, '% (Broker)')
  END as porcentaje_esperado
FROM comm_items ci
LEFT JOIN brokers b ON b.id = ci.broker_id
ORDER BY ci.policy_number
LIMIT 50;
```

### Si los porcentajes están mal:

**Causa 1: Broker sin percent_default configurado**
```sql
-- Solución: Configurar el porcentaje
UPDATE brokers
SET percent_default = 0.70  -- 70% por ejemplo
WHERE id = 'broker-id-aqui';
```

**Causa 2: Lógica VIDA+ASSA no aplicada**
- Verificar que el campo `policy_type` en el CSV tenga exactamente el valor `'VIDA'`
- Verificar que el `insurer_name` sea exactamente `'ASSA'`

## Archivos Creados

1. ✅ `normalize-names-function.sql` - Función SQL de normalización
2. ✅ `INSTRUCCIONES_BULK_CORREGIDO.md` - Este documento
3. ⏳ Script generador modificado (pendiente)
4. ⏳ `bulk-upload-comisiones-CORREGIDO.sql` (pendiente regenerar)

## Checklist Final

- [ ] Función `normalize_name()` creada en BD
- [ ] Todos los brokers tienen `percent_default` configurado
- [ ] Script generador modificado para normalizar nombres
- [ ] Nuevo script bulk generado
- [ ] Backup de tablas realizado
- [ ] Script ejecutado exitosamente
- [ ] Verificación: 0 nombres con caracteres especiales
- [ ] Verificación: Porcentajes aplicados correctamente
- [ ] UI responsive verificada en mobile

## Soporte

Si después de estos pasos los cálculos aún están incorrectos:

1. **Enviar query de verificación:**
```sql
SELECT 
  b.name as broker,
  b.email,
  b.percent_default,
  COUNT(ci.id) as total_items,
  SUM(ci.gross_amount) as total_bruto,
  SUM((ci.raw_row->>'net_amount')::numeric) as total_neto_calculado
FROM brokers b
LEFT JOIN comm_items ci ON ci.broker_id = b.id
GROUP BY b.id, b.name, b.email, b.percent_default
ORDER BY b.name;
```

2. **Identificar broker con problema específico**

3. **Verificar configuración individual**
