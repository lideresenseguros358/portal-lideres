# ✅ LISTO PARA IMPORTAR

## ✅ Problema Resuelto

**Error corregido:** La tabla `clients` y `policies` NO tienen columna `updated_at`, solo `created_at`.

**Cambios aplicados en BULK_IMPORT_CLIENTES.sql:**
- ❌ Eliminado `updated_at` de UPDATE clients
- ❌ Eliminado `updated_at` de INSERT clients  
- ❌ Eliminado `updated_at` de INSERT policies

---

## 🚀 PASOS PARA IMPORTAR (EN ORDEN)

### 1️⃣ Actualizar la Función en Supabase

```sql
-- En Supabase SQL Editor:
-- 1. Copia TODO el contenido de: BULK_IMPORT_CLIENTES.sql
-- 2. Pega en Supabase SQL Editor
-- 3. Ejecuta
-- ✅ Verifica que diga "CREATE FUNCTION" success
```

### 2️⃣ Crear Aseguradora Faltante (Si es necesaria)

Vi que tienes 6 pólizas de **"MB SEGUROS"** que fallan porque esa aseguradora no existe.

**Opción A:** Crear la aseguradora

```sql
-- Ejecuta en Supabase:
INSERT INTO insurers (name, active)
VALUES ('MB SEGUROS', true);
```

**Opción B:** Cambiar esas pólizas a otra aseguradora en tu CSV

Si MB SEGUROS no debe existir, edita tu CSV y cambia esas 6 pólizas a otra aseguradora (ASSA, MAPFRE, etc).

### 3️⃣ Ejecutar el Bulk Import

```sql
-- En Supabase SQL Editor:
-- 1. Copia TODO el contenido de: EJECUTAR_IMPORT.sql
-- 2. Pega en Supabase
-- 3. Ejecuta
-- ⏱️ Espera 30-60 segundos
-- ✅ Revisa los resultados
```

---

## 📊 Resumen de tu Import

- **Total registros:** 2,737 pólizas
- **Brokers únicos:** 69
- **Aseguradoras:** ANCON, ASSA, FEDPA, MAPFRE, MB SEGUROS, SURA
- **Tamaño JSON:** 670 KB

### ⚠️ Pólizas con MB SEGUROS (6 registros)

Estas fallarán si MB SEGUROS no existe:
- MAXILIANO DAVID PEREZ ANDERSON (policy: 51026)
- MIÑOSO ARIAS GONZALEZ (policy: 58978)
- NORBERTO INIQUIÑAPI VILLALAZ ARIAS (policy: 61287)
- OSIRIS EVA ARCHIBOLD JONES (policy: 76668)
- MELISSA SHECK ORTIZ (policy: 79414)
- ANA MARIA JONES MORALES (policy: 81555)

**Decisión:** ¿Crear MB SEGUROS o cambiar estas 6 pólizas a otra aseguradora?

---

## ✅ Verificación Post-Import

Después de ejecutar el import:

```sql
-- Ver cuántas se importaron exitosamente
SELECT 
  COUNT(*) FILTER (WHERE success = true) as exitosas,
  COUNT(*) FILTER (WHERE success = false) as fallidas,
  COUNT(*) as total
FROM (
  SELECT * FROM bulk_import_clients_policies('tu json aqui'::jsonb)
) results;

-- Ver clientes recién creados
SELECT COUNT(*) 
FROM clients 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Ver pólizas recién creadas  
SELECT COUNT(*) 
FROM policies 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## 🎯 Checklist Final

- [ ] 1. Actualizar función SQL en Supabase (BULK_IMPORT_CLIENTES.sql)
- [ ] 2. Decidir sobre MB SEGUROS (crear o cambiar pólizas)
- [ ] 3. Ejecutar EJECUTAR_IMPORT.sql en Supabase
- [ ] 4. Verificar resultados
- [ ] 5. ¡Celebrar! 🎉

---

## 💡 Si Aparecen Errores

**"Broker no encontrado":**
- Ese broker no existe en tu BD
- Ejecuta `VERIFICAR_BROKERS_DEL_CSV.sql` para ver quiénes faltan
- Créalos desde `/brokers` en tu app

**"Aseguradora no encontrada":**
- Esa aseguradora no existe
- Créala con INSERT INTO insurers (name, active) VALUES ('NOMBRE', true)

**"Póliza ya existe":**
- Ese policy_number ya está en la BD
- Es un duplicado, la función lo salta automáticamente

**Otros errores:**
- Copia el mensaje completo y revisa el formato de los datos

---

## 📞 Siguiente Paso

**Ejecuta PASO 1 ahora:**
```sql
-- Copia BULK_IMPORT_CLIENTES.sql completo
-- Pégalo en Supabase SQL Editor
-- Ejecuta
```

**Luego decide sobre MB SEGUROS y ejecuta PASO 3**
