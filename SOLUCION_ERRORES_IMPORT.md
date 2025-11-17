# 🔧 SOLUCIÓN DE ERRORES EN BULK IMPORT

## Problemas Encontrados

### 1. Error de Ambigüedad SQL ✅ CORREGIDO

**Error:** `column reference "policy_number" is ambiguous`

**Causa:** El alias `p` se usaba tanto para `profiles` como para `policies`, causando ambigüedad.

**Solución Aplicada:**

```sql
-- ❌ ANTES (línea 120):
IF EXISTS (SELECT 1 FROM policies p WHERE p.policy_number = v_policy_number) THEN

-- ✅ DESPUÉS (línea 120):
IF EXISTS (SELECT 1 FROM policies pol WHERE pol.policy_number = v_policy_number) THEN
```

### 2. Emails de Brokers No Encontrados ⚠️ REQUIERE VERIFICACIÓN

**Error:** `ERROR: Broker no encontrado con email: [email]`

**Causa:** Los emails en los datos del import no coinciden con los emails reales de los brokers en la base de datos.

**Emails problemáticos encontrados:**
- ediscastillo@lideresenseguros.com
- kathrinaguirre@lideresenseguros.com
- angelicaramos@lideresenseguros.com
- soniaarenas@lideresenseguros.com
- lissethvergara@lideresenseguros.com
- ruthmejia@lideresenseguros.com
- stheysivejarano@lideresenseguros.com
- josemanuel@lideresenseguros.com
- ivettemartinez@lideresenseguros.com
- itzycandanedo@lideresenseguros.com
- elizabetharce@lideresenseguros.com
- kattiaberguido@lideresenseguros.com
- veronicahenriquez@lideresenseguros.com
- leormanhudgson@lideresenseguros.com
- luzgonzalez@lideresenseguros.com
- keniagonzalez@lideresenseguros.com
- hericka@lideresenseguros.com
- sebastianachiari@lideresenseguros.com
- ricardojimenez@lideresenseguros.com
- jazmincamilo@lideresenseguros.com

## Pasos para Solucionar

### PASO 1: Actualizar la Función SQL ✅

```sql
-- 1. Ejecuta el contenido completo de BULK_IMPORT_CLIENTES.sql en Supabase SQL Editor
-- Esto recreará la función con la corrección de ambigüedad
```

### PASO 2: Verificar Emails de Brokers 🔍

```sql
-- 2. Ejecuta VERIFICAR_EMAILS_BROKERS.sql en Supabase SQL Editor
-- Esto te mostrará:
--   a) Todos los brokers activos con sus emails reales
--   b) Cuáles de los emails buscados existen y cuáles no
--   c) Emails similares que podrían ser las versiones correctas
```

### PASO 3: Opciones para Corregir los Emails

**Opción A: Actualizar los Datos del Import (RECOMENDADO)**

Si los brokers tienen emails diferentes en la base de datos:

1. Ejecuta `VERIFICAR_EMAILS_BROKERS.sql` para obtener los emails correctos
2. Haz un find & replace en tu archivo de datos Excel/CSV:
   - Reemplaza `ediscastillo@lideresenseguros.com` por el email correcto
   - Repite para cada email problemático
3. Regenera el JSON y vuelve a ejecutar el import

**Opción B: Crear los Brokers Faltantes**

Si estos brokers deberían existir pero no están en el sistema:

```sql
-- Ejemplo para crear un broker faltante
-- NOTA: Primero debes crear el usuario en Auth y obtener su UUID

-- 1. Crear profile
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'UUID_DEL_AUTH_USER',
  'ediscastillo@lideresenseguros.com',
  'EDIS CASTILLO',
  'broker'
);

-- 2. Crear broker
INSERT INTO brokers (p_id, name, email, active)
VALUES (
  'UUID_DEL_AUTH_USER',
  'EDIS CASTILLO',
  'ediscastillo@lideresenseguros.com',
  true
);
```

**Opción C: Usar un Email Genérico Temporal**

Si quieres importar los datos rápidamente y asignar brokers después:

```sql
-- Crea un broker genérico "SIN ASIGNAR"
-- Luego usa ese email en todos los registros problemáticos
-- Después puedes actualizar las pólizas con:

UPDATE policies
SET broker_id = 'UUID_DEL_BROKER_CORRECTO'
WHERE broker_id = 'UUID_DEL_BROKER_GENERICO';
```

### PASO 4: Re-ejecutar el Import

```sql
-- Una vez corregidos los emails, ejecuta:
SELECT * FROM bulk_import_clients_policies($$
[... tu JSON con emails corregidos ...]
$$::jsonb);
```

## Verificación de Resultados

Después del import, verifica:

```sql
-- Ver pólizas recién importadas
SELECT 
  p.policy_number,
  c.name as client,
  i.name as insurer,
  b.name as broker,
  p.start_date,
  p.created_at
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

## Scripts Disponibles

1. **BULK_IMPORT_CLIENTES.sql** - Función SQL con corrección de ambigüedad ✅
2. **VERIFICAR_EMAILS_BROKERS.sql** - Verifica emails de brokers en BD 🔍
3. **EJECUTAR_IMPORT.sql** - Import de 3,443 pólizas (requiere emails correctos)

## Comandos Útiles

```sql
-- Ver todos los brokers activos
SELECT * FROM get_brokers_for_import();

-- Ver todas las aseguradoras
SELECT * FROM get_insurers_for_import();

-- Contar pólizas por broker después del import
SELECT 
  b.name as broker,
  COUNT(p.id) as num_polizas
FROM brokers b
LEFT JOIN policies p ON p.broker_id = b.id AND p.created_at > NOW() - INTERVAL '1 hour'
GROUP BY b.id, b.name
ORDER BY num_polizas DESC;
```

## Resumen de Estado

- ✅ **Error SQL corregido:** Ambigüedad de `policy_number` solucionada
- ⚠️ **Emails pendientes:** ~20 emails de brokers no encontrados
- 🔄 **Acción requerida:** Verificar y corregir emails antes de re-ejecutar import

## Próximos Pasos

1. ✅ Aplicar corrección SQL (ejecutar BULK_IMPORT_CLIENTES.sql)
2. 🔍 Ejecutar VERIFICAR_EMAILS_BROKERS.sql
3. ✏️ Corregir emails en tus datos
4. ▶️ Re-ejecutar import con datos corregidos

---

## 📋 ORDEN CORRECTO DE EJECUCIÓN

### 1️⃣ ACTUALIZAR FUNCIÓN SQL
```bash
# En Supabase SQL Editor:
# 1. Abrir: BULK_IMPORT_CLIENTES.sql
# 2. Copiar TODO
# 3. Ejecutar en Supabase
# 4. Verificar: "CREATE FUNCTION" success
```

### 2️⃣ VERIFICAR BROKERS
```bash
# En Supabase SQL Editor:
# 1. Abrir: VERIFICAR_BROKERS_FALTANTES.sql
# 2. Ejecutar
# 3. Si aparecen resultados: crear esos brokers
# 4. Si NO aparece nada: ¡todos existen! ✅
```

### 3️⃣ EJECUTAR IMPORT
```bash
# En Supabase SQL Editor:
# 1. Abrir: EJECUTAR_IMPORT.sql
# 2. Copiar TODO (988 KB)
# 3. Ejecutar (puede tardar 30-60 segundos)
# 4. Revisar resultados
```

---

## 🎯 VERIFICACIÓN POST-IMPORT

Después de ejecutar el import, verifica:

```sql
-- Contar clientes importados
SELECT COUNT(*) FROM clients 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Contar pólizas importadas
SELECT COUNT(*) FROM policies 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Ver errores si los hubo
-- (Los verás en el resultado del EJECUTAR_IMPORT.sql)
SELECT * FROM bulk_import_clients_policies($$[...]$$::jsonb)
WHERE success = false;
```

---

## ⚠️ NOTAS IMPORTANTES

1. **La función SQL debe actualizarse PRIMERO** o seguirá dando el error de "policy_number ambiguous"
2. **Los brokers deben existir** antes de importar sus clientes
3. **El import NO borra datos existentes**, solo agrega nuevos
4. **Las pólizas duplicadas** (mismo policy_number) se saltarán automáticamente
5. **Los errores NO detienen el proceso**, cada fila se intenta importar independientemente

---

## 🆘 SI SIGUEN LOS ERRORES

Si después de seguir estos pasos sigues teniendo errores:

1. **Error de policy_number:** La función NO se actualizó. Vuelve a ejecutar `BULK_IMPORT_CLIENTES.sql`
2. **Error de broker:** Ese email NO existe en la tabla `brokers`. Verifica con `VERIFICAR_BROKERS_FALTANTES.sql`
3. **Otros errores:** Copia el mensaje completo del error y avísame

---

## ✅ CHECKLIST FINAL

- [ ] Actualizar función SQL (`BULK_IMPORT_CLIENTES.sql`)
- [ ] Verificar brokers faltantes (`VERIFICAR_BROKERS_FALTANTES.sql`)
- [ ] Crear brokers que faltan (si los hay)
- [ ] Ejecutar bulk import (`EJECUTAR_IMPORT.sql`)
- [ ] Verificar resultados en la app
- [ ] ¡Celebrar! 🎉
