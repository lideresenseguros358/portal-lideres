# 🚀 BULK IMPORT DE CLIENTES Y PÓLIZAS

## 📋 RESUMEN

Sistema completo para importar masivamente clientes y pólizas a la base de datos, bypasseando RLS mediante `SECURITY DEFINER`.

---

## ✅ ESTADO

- ✅ Función SQL `bulk_import_clients_policies()` **LISTA**
- ✅ Scripts de conversión Excel/CSV → JSON **LISTOS**
- ✅ Documentación completa **LISTA**
- ✅ Alineado con `database.types.ts` **100%**

---

## 🎯 MÉTODO RECOMENDADO: EXCEL/CSV

### Paso 1: Prepara tu archivo Excel

Crea un archivo Excel (.xlsx) o CSV (.csv) con **ESTAS COLUMNAS EXACTAS**:

| Nombre Columna | Requerido | Ejemplo | Notas |
|----------------|-----------|---------|-------|
| `client_name` | ✅ SÍ | JUAN PÉREZ GONZÁLEZ | MAYÚSCULAS |
| `national_id` | ❌ No | 8-123-4567 | Cédula/RUC/Pasaporte |
| `email` | ❌ No | juan@email.com | Email del cliente |
| `phone` | ❌ No | 6000-0000 | Teléfono |
| `policy_number` | ✅ SÍ | POL-2024-001 | ÚNICO (sin duplicados) |
| `insurer_name` | ✅ SÍ | ASSA | MAYÚSCULAS, debe existir en BD |
| `ramo` | ❌ No | AUTO | Tipo de póliza |
| `start_date` | ✅ SÍ | 15/01/2025 | Fecha inicio |
| `renewal_date` | ✅ SÍ | 15/01/2026 | Fecha renovación |
| `broker_email` | ✅ SÍ | broker@email.com | DEBE existir en BD |
| `percent_override` | ❌ No | 0.94 | Comisión (0.94 = 94%) |

**Ejemplo de Excel:**

| client_name | national_id | email | phone | policy_number | insurer_name | ramo | start_date | renewal_date | broker_email | percent_override |
|-------------|-------------|-------|-------|---------------|--------------|------|------------|--------------|--------------|------------------|
| JUAN PÉREZ | 8-123-4567 | juan@email.com | 6000-0000 | POL-001 | ASSA | AUTO | 15/01/2025 | 15/01/2026 | broker@email.com | 0.94 |
| MARÍA LÓPEZ | | | | POL-002 | FEDPA | VIDA | 20/02/2025 | 20/02/2026 | broker@email.com | 1.0 |

### Paso 2: Instala Python y pandas

```bash
# Verifica Python
python --version

# Instala pandas y openpyxl
pip install pandas openpyxl
```

### Paso 3: Ejecuta el script de conversión

```bash
cd C:\Users\Samud\portal-lideres\scripts
python excel_to_bulk_import.py C:\ruta\a\tu\archivo.xlsx
```

**Output:**
- `archivo_IMPORT.json` → JSON formateado (para revisar)
- `archivo_IMPORT_COMPACT.json` → JSON compacto (para SQL)

### Paso 4: Revisa el JSON generado

Abre `archivo_IMPORT.json` y verifica que todo se vea correcto:

```json
[
  {
    "client_name": "JUAN PÉREZ",
    "national_id": "8-123-4567",
    "email": "juan@email.com",
    "phone": "6000-0000",
    "policy_number": "POL-001",
    "insurer_name": "ASSA",
    "ramo": "AUTO",
    "start_date": "2025-01-15",
    "renewal_date": "2026-01-15",
    "broker_email": "broker@email.com",
    "percent_override": 0.94
  }
]
```

### Paso 5: Ejecuta el bulk import en Supabase

**5.1. Instala las funciones SQL (SOLO UNA VEZ)**

En Supabase SQL Editor, ejecuta todo el contenido de:
```
BULK_IMPORT_CLIENTES.sql
```

**5.2. Verifica brokers y aseguradoras**

```sql
-- Ver brokers disponibles
SELECT * FROM get_brokers_for_import()
ORDER BY broker_name;

-- Ver aseguradoras disponibles
SELECT * FROM get_insurers_for_import()
ORDER BY insurer_name;
```

**¿Falta algún broker?** Créalo primero en `/brokers`

**Aseguradoras que debes usar (EXACTAS):**
- `ASSA`
- `FEDPA`
- `MAPFRE`
- `SURA`
- `ANCON`
- `MB SEGUROS`

**5.3. Ejecuta el import**

```sql
-- PRUEBA CON UNA PÓLIZA PRIMERO
SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "JUAN PÉREZ",
    "policy_number": "POL-001",
    "insurer_name": "ASSA",
    "start_date": "2025-01-15",
    "renewal_date": "2026-01-15",
    "broker_email": "broker@email.com",
    "ramo": "AUTO",
    "percent_override": 0.94
  }
]'::jsonb);
```

**Resultado esperado:**

| success | row_number | client_name | policy_number | message | client_id | policy_id |
|---------|------------|-------------|---------------|---------|-----------|-----------|
| true | 1 | JUAN PÉREZ | POL-001 | ✅ Cliente y póliza creados | uuid-... | uuid-... |

**5.4. Si la prueba es exitosa, ejecuta el import completo**

```sql
-- Copia y pega el contenido de archivo_IMPORT_COMPACT.json
SELECT * FROM bulk_import_clients_policies('[... PEGA AQUÍ TODO EL JSON ...]'::jsonb);
```

### Paso 6: Verifica los resultados

```sql
-- Ver clientes recién creados
SELECT 
  c.name,
  c.national_id,
  c.email,
  COUNT(p.id) as num_policies
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
GROUP BY c.id
ORDER BY c.created_at DESC
LIMIT 20;

-- Ver pólizas recién creadas
SELECT 
  p.policy_number,
  c.name as client,
  i.name as insurer,
  b.name as broker,
  p.ramo,
  p.start_date,
  p.renewal_date,
  p.percent_override,
  p.status
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC
LIMIT 20;
```

---

## 📊 TIPOS DE RESULTADO

### ✅ ÉXITO - Cliente y póliza creados
```
success = true
message = "✅ Cliente y póliza creados exitosamente"
```

### ✅ ÉXITO - Cliente existente, solo póliza nueva
```
success = true
message = "✅ Cliente existente encontrado (por cédula), póliza creada"
```

### ❌ ERROR - Broker no encontrado
```
success = false
message = "❌ Broker con email 'xxx@example.com' no encontrado"
```

**Solución:** Verifica que el broker exista con ese email en la BD

### ❌ ERROR - Aseguradora no encontrada
```
success = false
message = "❌ Aseguradora 'XXX' no encontrada"
```

**Solución:** Verifica el nombre exacto (MAYÚSCULAS)

### ❌ ERROR - Póliza duplicada
```
success = false
message = "❌ Ya existe una póliza con número 'POL-001'"
```

**Solución:** Usa un número de póliza único o verifica si es duplicado real

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### El script Python falla

**Instala dependencias:**
```bash
pip install pandas openpyxl
```

### Columnas no reconocidas

El script intenta detectar automáticamente nombres de columnas en español e inglés:
- `nombre`, `cliente`, `client_name` → `client_name`
- `cédula`, `cedula`, `national_id` → `national_id`
- `aseguradora`, `insurer_name` → `insurer_name`
- etc.

**Si no funciona:** Renombra las columnas en Excel a los nombres exactos de la tabla anterior

### Fechas mal parseadas

El script acepta estos formatos:
- `DD/MM/YYYY` → 15/01/2025 ✅
- `DD/MM/YY` → 15/01/25 ✅
- `YYYY-MM-DD` → 2025-01-15 ✅

**Si una fecha falla:** Cámbiala a formato `DD/MM/YYYY` en Excel

### Import falla con error de sintaxis SQL

**Verifica que:**
1. El JSON esté bien formateado (sin comas al final)
2. Todas las comillas dobles estén cerradas
3. Los valores `null` sean exactamente `null` (sin comillas)

---

## 📁 ARCHIVOS DEL SISTEMA

| Archivo | Descripción |
|---------|-------------|
| `BULK_IMPORT_CLIENTES.sql` | Funciones SQL (ejecutar en Supabase) |
| `scripts/excel_to_bulk_import.py` | Conversión Excel → JSON (recomendado) |
| `scripts/parse_bulk_data.py` | Conversión TXT → JSON |
| `scripts/parse_bulk_import.mjs` | Conversión TXT → JSON (Node.js) |
| `INSTRUCCIONES_BULK_IMPORT.md` | Guía detallada completa |
| `GUIA_BULK_IMPORT_PASO_A_PASO.md` | Pasos específicos |
| `RESUMEN_EJECUTIVO_TU_BULK_IMPORT.md` | Resumen para tus datos |
| `EJEMPLO_JSON_FINAL.json` | Ejemplo de JSON correcto |
| `README_BULK_IMPORT.md` | Este archivo |

---

## 🎯 CAMPOS EN DATABASE.TYPES.TS

### Tabla `clients`
```typescript
{
  name: string              // ← client_name (requerido)
  national_id: string | null  // ← national_id (opcional)
  email: string | null        // ← email (opcional)
  phone: string | null        // ← phone (opcional)
  broker_id: string          // ← resuelto por broker_email
  active: boolean            // ← default: true
  created_at: string         // ← automático
  id: string                 // ← generado automáticamente
}
```

### Tabla `policies`
```typescript
{
  policy_number: string        // ← policy_number (requerido, único)
  client_id: string           // ← resuelto automáticamente
  broker_id: string           // ← resuelto por broker_email
  insurer_id: string          // ← resuelto por insurer_name
  ramo: string | null         // ← ramo (opcional)
  start_date: string | null   // ← start_date (opcional)
  renewal_date: string | null // ← renewal_date (opcional)
  percent_override: number | null  // ← percent_override (opcional)
  status: policy_status_enum  // ← default: 'ACTIVE'
  notas: string | null        // ← null por defecto
  created_at: string          // ← automático
  id: string                  // ← generado automáticamente
}
```

---

## 🔐 SEGURIDAD

### Función con SECURITY DEFINER
La función `bulk_import_clients_policies()` usa `SECURITY DEFINER` para:
- ✅ Bypass completo de RLS (Row Level Security)
- ✅ Permitir importación masiva sin restricciones
- ⚠️ Solo usuarios Master deben ejecutarla

### SET search_path = public
Previene ataques de search_path injection

---

## ⚠️ IMPORTANTE

### Antes de importar en producción
1. ✅ Haz backup de la base de datos
2. ✅ Prueba con 5-10 registros primero
3. ✅ Verifica que todos los brokers existan
4. ✅ Verifica que todas las aseguradoras existan
5. ✅ Verifica que no haya números de póliza duplicados

### Detección de duplicados
El sistema:
- ✅ Busca clientes por `national_id` O por `name`
- ✅ Si encuentra uno, lo reutiliza (no crea duplicado)
- ✅ Solo crea la nueva póliza asociada
- ❌ NO permite pólizas con el mismo `policy_number`

---

## 🎉 ¡LISTO!

Tienes todo lo necesario para el bulk import. Cualquier duda, revisa los archivos de documentación listados arriba.

**¡Éxito con tu importación masiva!** 🚀
