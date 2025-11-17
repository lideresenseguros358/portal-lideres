# 🚀 EJECUTAR BULK IMPORT - GUÍA RÁPIDA

## ✅ DATOS PROCESADOS

- **Total:** 3,443 pólizas
- **Brokers:** 80 únicos
- **Aseguradoras:** ASSA, FEDPA, ANCON, MAPFRE, SURA, MB SEGUROS
- **Archivo SQL generado:** `EJECUTAR_IMPORT.sql`

---

## 📋 PASOS PARA EJECUTAR (3 minutos)

### ✅ PASO 1: Instalar la función SQL (si no existe)

1. Ve a **Supabase → SQL Editor**
2. Ejecuta este comando para verificar:

```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'bulk_import_clients_policies'
);
```

**Si retorna `false`:**
- Abre el archivo: `BULK_IMPORT_CLIENTES.sql`
- Copia TODO el contenido
- Pega en Supabase SQL Editor
- Click **Run** (F5)
- Espera a que termine (crea la función)

**Si retorna `true`:**
- ✅ Continúa al Paso 2

---

### ✅ PASO 2: Verificar Brokers Principales

Ejecuta en Supabase SQL Editor:

```sql
SELECT email, name 
FROM brokers 
WHERE email IN (
    'samudiosegurospa@outlook.com',
    'yanitzajustiniani@lideresenseguros.com',
    'luisquiros@lideresenseguros.com',
    'kvseguros13@gmail.com',
    'minismei@hotmail.com',
    'soniaarenas@lideresenseguros.com',
    'didimosamudio@lideresenseguros.com'
)
ORDER BY email;
```

**Debe retornar 7 brokers.**

Si falta alguno:
- Créalo primero en la tabla `brokers`
- Asegúrate de usar el email EXACTO del listado

---

### ✅ PASO 3: Ejecutar el Import

**MÉTODO FÁCIL - Archivo SQL completo:**

1. **Abre el archivo:** `EJECUTAR_IMPORT.sql`
2. **Copia TODO** el contenido (Ctrl+A → Ctrl+C)
3. **Ve a Supabase → SQL Editor**
4. **Pega** el contenido (Ctrl+V)
5. **Click en Run** (o F5)
6. **Espera** (puede tomar 1-2 minutos)

**IMPORTANTE:** 
- El archivo ya tiene el JSON embebido
- Es un solo comando SELECT muy largo
- NO necesitas pegar el JSON manualmente

---

## 📊 Resultado Esperado

Verás una tabla con 3,443 filas como esta:

```
┌─────────┬────────────────────────────────────────┬─────────────────────────┐
│ status  │ message                                │ client_name             │
├─────────┼────────────────────────────────────────┼─────────────────────────┤
│ success │ Cliente y póliza creados correctamente │ BETZAIDA ETHEL CARR...  │
│ success │ Cliente y póliza creados correctamente │ CHRISTIAN NOVOA OVE...  │
│ warning │ Cliente creado, póliza ya existía      │ JESSICA RAQUEL CONC...  │
│ success │ Cliente y póliza creados correctamente │ CELINA ELIZABETH AB...  │
│ ...     │ ...                                    │ ...                     │
└─────────┴────────────────────────────────────────┴─────────────────────────┘
```

### Significado de status:

- ✅ **success** = Cliente y póliza creados correctamente
- ⚠️ **warning** = Cliente creado, pero la póliza ya existía (no se duplica)
- ❌ **error** = Falló (ver mensaje para saber por qué)

---

## 🔍 Verificar después del Import

### 1. Total de pólizas nuevas
```sql
SELECT COUNT(*) as total_polizas 
FROM policies;
```

### 2. Total de clientes nuevos
```sql
SELECT COUNT(*) as total_clientes 
FROM clients;
```

### 3. Pólizas por broker
```sql
SELECT 
    b.name,
    b.email,
    COUNT(p.id) as num_policies
FROM brokers b
LEFT JOIN policies p ON p.broker_id = b.id
GROUP BY b.id, b.name, b.email
ORDER BY num_policies DESC
LIMIT 10;
```

### 4. Pólizas por aseguradora
```sql
SELECT 
    i.name,
    COUNT(p.id) as num_policies
FROM insurers i
LEFT JOIN policies p ON p.insurer_id = i.id
GROUP BY i.id, i.name
ORDER BY num_policies DESC;
```

---

## ⚠️ Si aparecen ERRORES

### Error: "Broker not found with email: xxx@xxx.com"

**Causa:** El broker no existe en la tabla `brokers`

**Solución:**
```sql
-- Busca el broker
SELECT * FROM brokers WHERE email ILIKE '%xxx%';

-- Si no existe, créalo primero
INSERT INTO brokers (name, email, percent_default)
VALUES ('NOMBRE DEL BROKER', 'email@correcto.com', 0.8);

-- Luego vuelve a ejecutar el import
```

---

### Error: "Aseguradora no encontrada: XXX"

**Causa:** El nombre de la aseguradora no coincide exactamente

**Solución:**
```sql
-- Ver aseguradoras existentes
SELECT name FROM insurers ORDER BY name;

-- Verifica que existan:
-- ASSA, FEDPA, ANCON, MAPFRE, SURA, MB SEGUROS

-- Si falta alguna, créala:
INSERT INTO insurers (name, code)
VALUES ('MB SEGUROS', 'MB');
```

---

### Error: "column reference is ambiguous"

**Causa:** Versión vieja de la función SQL

**Solución:**
1. Abre `BULK_IMPORT_CLIENTES.sql`
2. Busca la línea 120
3. Verifica que diga: `WHERE p.policy_number = v_policy_number`
4. Si dice `WHERE policy_number = ...`, cambia a `WHERE p.policy_number = ...`
5. Vuelve a crear la función (ejecuta todo el SQL)

---

## 📈 Distribución de tus Datos

### Top 10 Brokers por Volumen:
1. samudiosegurospa@outlook.com - **932 pólizas** (27%)
2. yanitzajustiniani@lideresenseguros.com - **334 pólizas** (10%)
3. luisquiros@lideresenseguros.com - **277 pólizas** (8%)
4. didimosamudio@lideresenseguros.com - **227 pólizas** (7%)
5. kvseguros13@gmail.com - **220 pólizas** (6%) ← Karol ✅
6. soniaarenas@lideresenseguros.com - **151 pólizas** (4%)
7. lucianieto@lideresenseguros.com - **132 pólizas** (4%)
8. carlosfoot@lideresenseguros.com - **87 pólizas** (3%)
9. ediscastillo@lideresenseguros.com - **79 pólizas** (2%)
10. javiersamudio@lideresenseguros.com - **70 pólizas** (2%)

### Aseguradoras:
- ASSA: 1,526 pólizas (44%)
- FEDPA: 1,386 pólizas (40%)
- ANCON: 317 pólizas (9%)
- MAPFRE: 120 pólizas (3%)
- SURA: 80 pólizas (2%)
- MB SEGUROS: 14 pólizas (<1%)

### Tipos de Póliza:
- AUTO: 2,091 pólizas (61%)
- VIDA: 424 pólizas (12%)
- INCENDIO: 360 pólizas (10%)
- ACCIDENTES PERSONALES: 266 pólizas (8%)
- HOGAR: 101 pólizas (3%)
- OTROS: 200 pólizas (6%)

---

## 💡 Consejos

1. **No te preocupes por duplicados:** La función detecta automáticamente pólizas duplicadas por `policy_number` y no las vuelve a crear.

2. **Puedes ejecutar múltiples veces:** La función es **idempotente** (ejecutarla varias veces no duplica datos).

3. **Revisa los warnings:** Si ves muchos `warning` de "póliza ya existía", significa que ya habías importado esos datos antes.

4. **El proceso es seguro:** Usa `SECURITY DEFINER` para bypasear RLS, pero valida todos los datos antes de insertar.

5. **Backup antes:** Si quieres estar 100% seguro, haz un snapshot de tu BD antes de ejecutar.

---

## 🎯 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `EJECUTAR_IMPORT.sql` | **SQL completo listo para ejecutar** ⭐ |
| `BULK_IMPORT_CLIENTES.sql` | Función SQL (instalar primero) |
| `public\TODA_FINAL.csv` | CSV con emails de brokers corregidos |
| `public\TODA_FINAL_IMPORT.json` | JSON formateado (para revisar) |
| `public\TODA_FINAL_IMPORT_COMPACT.json` | JSON compacto (usado en el SQL) |
| `EJECUTAR_BULK_IMPORT.md` | Documentación detallada |

---

## 🚀 RESUMEN - 3 Pasos Rápidos

```
1. Verifica función SQL existe
   → Si no: ejecuta BULK_IMPORT_CLIENTES.sql

2. Verifica brokers principales existen
   → SELECT email FROM brokers WHERE email IN (...)

3. Ejecuta el import
   → Abre EJECUTAR_IMPORT.sql
   → Copia TODO
   → Pega en Supabase
   → Run (F5)
   → ¡Listo! 🎉
```

---

**¿Problemas?** Revisa los mensajes de error en la columna `message` de los resultados. Cada error te dice exactamente qué falta o qué corregir.

**¡Éxito!** 🎉 Deberías ver 3,443 registros procesados (entre success y warning).
