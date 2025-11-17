# 🚀 GUÍA BULK IMPORT - PASO A PASO

## ⚠️ PROBLEMA DETECTADO

Tus datos tienen **un problema crítico de formato**:
- Los datos NO están en columnas claramente delimitadas
- Muchos campos están fusionados o tienen espacios inconsistentes
- El broker_email y commission están al final de cada línea

## ✅ SOLUCIÓN RECOMENDADA

### Opción 1: Usar Excel/CSV (MÁS FÁCIL)

**Paso 1:** Convierte tus datos a Excel con columnas claramente separadas:

| client_name | national_id | email | phone | policy_number | insurer_name | ramo | start_date | renewal_date | broker_email | percent_override |
|-------------|-------------|-------|-------|---------------|--------------|------|------------|--------------|--------------|------------------|
| ALEXIS CONCEPCION ALVEO GONZALEZ | | | | 12B34565 | ASSA | ACCIDENTES PERSONALES | 2025-06-02 | 2026-06-02 | luciaydanna@gmail.com | 1 |

**Paso 2:** Exporta como CSV

**Paso 3:** Usa https://www.convertcsv.com/csv-to-json.htm para convertir a JSON

**Paso 4:** Ejecuta el SQL

---

### Opción 2: Script Python Automático

**Paso 1:** Guarda TODOS tus datos en un archivo

```bash
# Guarda tus datos completos en:
C:\Users\Samud\portal-lideres\DATOS_IMPORT_RAW.txt
```

**Paso 2:** Ejecuta el script Python

```bash
cd C:\Users\Samud\portal-lideres\scripts
python parse_bulk_data.py
```

**Paso 3:** Revisa el output

```bash
# Se creará:
C:\Users\Samud\portal-lideres\DATOS_IMPORT.json
```

**Paso 4:** Copia el JSON y ejecuta en Supabase

---

## 📋 FORMATO JSON REQUERIDO

```json
[
  {
    "client_name": "ALEXIS CONCEPCION ALVEO GONZALEZ",
    "national_id": null,
    "email": null,
    "phone": null,
    "policy_number": "12B34565",
    "insurer_name": "ASSA",
    "ramo": "ACCIDENTES PERSONALES",
    "start_date": "2025-06-02",
    "renewal_date": "2026-06-02",
    "broker_email": "luciaydanna@gmail.com",
    "percent_override": 1.0
  }
]
```

---

## 🔧 CAMPOS REQUERIDOS

### ✅ OBLIGATORIOS (6)
1. **client_name** - Nombre completo del cliente (MAYÚSCULAS)
2. **policy_number** - Número de póliza (ÚNICO, sin duplicados)
3. **insurer_name** - Nombre de aseguradora (debe coincidir exacto)
4. **broker_email** - Email del broker (debe existir en la BD)
5. **start_date** - Fecha inicio formato YYYY-MM-DD
6. **renewal_date** - Fecha renovación formato YYYY-MM-DD

### 📝 OPCIONALES (5)
7. **national_id** - Cédula/Pasaporte/RUC
8. **email** - Email del cliente
9. **phone** - Teléfono del cliente
10. **ramo** - Tipo de póliza (AUTO, VIDA, SALUD, etc.)
11. **percent_override** - Porcentaje de comisión (ej: 0.94 para 94%)

---

## 🏢 ASEGURADORAS DISPONIBLES

Ejecuta esto en Supabase para ver las aseguradoras:

```sql
SELECT * FROM get_insurers_for_import();
```

**Nombres que debes usar (EXACTOS):**
- ASSA
- FEDPA
- MAPFRE
- SURA
- ANCON
- MB SEGUROS

⚠️ **IMPORTANTE:** Los nombres deben coincidir EXACTAMENTE (mayúsculas/minúsculas)

---

## 👥 BROKERS DISPONIBLES

Ejecuta esto en Supabase para ver los brokers y sus emails:

```sql
SELECT * FROM get_brokers_for_import();
```

Los emails de los brokers que detecté en tus datos:
- luciaydanna@gmail.com
- luisquiros@lideresenseguros.com
- (y muchos más...)

⚠️ **IMPORTANTE:** El broker DEBE existir en la BD con ese email

---

## 🔄 EJECUTAR EL IMPORT

### En Supabase SQL Editor:

```sql
SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "ALEXIS CONCEPCION ALVEO GONZALEZ",
    "policy_number": "12B34565",
    "insurer_name": "ASSA",
    "ramo": "ACCIDENTES PERSONALES",
    "start_date": "2025-06-02",
    "renewal_date": "2026-06-02",
    "broker_email": "luciaydanna@gmail.com",
    "percent_override": 1.0
  },
  {
    "client_name": "OTRO CLIENTE",
    "policy_number": "POL-002",
    "insurer_name": "FEDPA",
    "start_date": "2025-01-15",
    "renewal_date": "2026-01-15",
    "broker_email": "otro@broker.com"
  }
]'::jsonb);
```

---

## 📊 RESULTADO DEL IMPORT

La función retorna una tabla con el resultado de cada fila:

| success | row_number | client_name | policy_number | message | client_id | policy_id |
|---------|------------|-------------|---------------|---------|-----------|-----------|
| true | 1 | ALEXIS... | 12B34565 | ✅ Cliente y póliza creados | uuid-123 | uuid-456 |
| false | 2 | OTRO... | POL-002 | ❌ Broker no encontrado | null | null |

---

## ⚠️ ERRORES COMUNES

### 1. "Broker not found"
- El email del broker NO existe en la BD
- Verifica con `SELECT * FROM get_brokers_for_import();`

### 2. "Insurer not found"
- El nombre de la aseguradora NO coincide
- Verifica con `SELECT * FROM get_insurers_for_import();`

### 3. "Policy number already exists"
- Ya existe una póliza con ese número
- Usa un número único

### 4. "Client already exists"
- El cliente ya existe (por cédula o nombre)
- ✅ Esto es OK - reutilizará el cliente existente
- Solo creará la nueva póliza

---

## 🎯 VALIDACIÓN DE DATOS ANTES DE IMPORTAR

**1. Verificar emails de brokers únicos:**

```python
import json
with open('DATOS_IMPORT.json') as f:
    data = json.load(f)

emails = set(r['broker_email'] for r in data)
print(f"Brokers únicos: {len(emails)}")
for email in sorted(emails):
    count = sum(1 for r in data if r['broker_email'] == email)
    print(f"  - {email}: {count} pólizas")
```

**2. Verificar números de póliza únicos:**

```python
policy_numbers = [r['policy_number'] for r in data]
duplicates = [p for p in set(policy_numbers) if policy_numbers.count(p) > 1]
if duplicates:
    print(f"⚠️  Pólizas duplicadas: {duplicates}")
else:
    print("✅ Todos los números de póliza son únicos")
```

**3. Verificar fechas válidas:**

```python
import re
invalid = []
for r in data:
    if r['start_date'] and not re.match(r'^\d{4}-\d{2}-\d{2}$', r['start_date']):
        invalid.append((r['policy_number'], 'start_date', r['start_date']))
    if r['renewal_date'] and not re.match(r'^\d{4}-\d{2}-\d{2}$', r['renewal_date']):
        invalid.append((r['policy_number'], 'renewal_date', r['renewal_date']))

if invalid:
    print(f"⚠️  Fechas inválidas: {len(invalid)}")
    for pol, field, date in invalid[:10]:
        print(f"  - {pol} {field}: {date}")
```

---

## 🎉 DESPUÉS DEL IMPORT

**Verificar clientes creados:**

```sql
SELECT 
  c.name,
  c.national_id,
  COUNT(p.id) as num_policies,
  MAX(p.created_at) as last_policy_created
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
GROUP BY c.id, c.name, c.national_id
ORDER BY c.created_at DESC;
```

**Verificar pólizas creadas:**

```sql
SELECT 
  p.policy_number,
  c.name as client,
  i.name as insurer,
  b.name as broker,
  p.ramo,
  p.start_date,
  p.renewal_date,
  p.percent_override
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

---

## 📞 ¿NECESITAS AYUDA?

Si encuentras errores:

1. **Copia el mensaje de error exacto**
2. **Indica qué línea falló (row_number)**
3. **Muestra los datos de esa fila**

Y te ayudaré a corregirlo.

---

## 🚦 ESTADO ACTUAL

- ✅ Función SQL `bulk_import_clients_policies()` creada
- ✅ Script Python para parsing creado
- ✅ Archivo `BULK_IMPORT_CLIENTES.sql` disponible
- ✅ Instrucciones detalladas en `INSTRUCCIONES_BULK_IMPORT.md`
- ⏳ **PENDIENTE:** Procesar y ejecutar tus datos completos

**Siguiente paso:** Prepara tus datos en formato correcto y ejecuta el import.
