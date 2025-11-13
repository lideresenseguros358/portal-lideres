# 📋 INSTRUCCIONES PARA BULK IMPORT DE CLIENTES Y PÓLIZAS

## 🎯 Objetivo

Cargar masivamente clientes y pólizas desde Excel/CSV a la base de datos, usando el email del broker como identificador.

---

## 📝 Formato de Datos Requeridos

### Campos OBLIGATORIOS (⚠️ Requeridos)

1. **client_name** - Nombre completo del cliente
2. **policy_number** - Número de póliza (debe ser único)
3. **broker_email** - Email del corredor asignado
4. **insurer_name** - Nombre de la aseguradora (debe coincidir con el nombre en la BD)
5. **start_date** - Fecha de inicio (formato: YYYY-MM-DD)
6. **renewal_date** - Fecha de renovación (formato: YYYY-MM-DD)

### Campos OPCIONALES (✨ Se pueden llenar después)

7. **ramo** - Tipo de póliza (AUTO, VIDA, SALUD, etc.)
8. **national_id** - Cédula/Pasaporte/RUC del cliente
9. **email** - Email del cliente
10. **phone** - Teléfono del cliente

---

## 📊 PASO 1: Preparar Excel/CSV

### Formato de Excel Recomendado

| client_name | policy_number | broker_email | insurer_name | ramo | start_date | renewal_date | national_id | email | phone |
|-------------|---------------|--------------|--------------|------|------------|--------------|-------------|-------|-------|
| JUAN PÉREZ GÓMEZ | POL-2024-001 | broker1@example.com | ASSA | AUTO | 2024-01-15 | 2025-01-15 | 8-123-4567 | juan@example.com | 6000-0000 |
| MARÍA GONZÁLEZ | POL-2024-002 | broker2@example.com | MAPFRE | VIDA | 2024-02-01 | 2025-02-01 | E-8-123456 | maria@example.com | 6100-0000 |
| CARLOS RODRÍGUEZ | POL-2024-003 | broker1@example.com | FEDPA | SALUD | 2024-03-10 | 2025-03-10 | 2-345-6789 | carlos@example.com | 6200-0000 |

**IMPORTANTE:**
- Las fechas deben estar en formato: `YYYY-MM-DD` (ejemplo: 2024-01-15)
- Los nombres de aseguradoras deben coincidir EXACTAMENTE con los de la base de datos
- Los emails de brokers deben existir en la plataforma

---

## 🔧 PASO 2: Obtener Datos de Referencia

Antes de hacer el import, necesitas verificar los valores válidos:

### 2.1. Obtener Lista de Aseguradoras

```sql
SELECT * FROM get_insurers_for_import();
```

Esto te dará:
- ✅ Nombres exactos de aseguradoras que puedes usar
- ✅ IDs internos
- ✅ Estado activo/inactivo

**Ejemplo de resultado:**
```
insurer_name | insurer_id | active
-------------|------------|-------
ASSA         | uuid-123   | true
MAPFRE       | uuid-456   | true
FEDPA        | uuid-789   | true
```

### 2.2. Obtener Lista de Brokers

```sql
SELECT * FROM get_brokers_for_import();
```

Esto te dará:
- ✅ Nombres de brokers
- ✅ Emails para usar en el import
- ✅ IDs internos

**Ejemplo de resultado:**
```
broker_name      | broker_email           | broker_id | active
-----------------|------------------------|-----------|-------
Juan Broker      | juan@broker.com        | uuid-111  | true
María Corredora  | maria@corredora.com    | uuid-222  | true
```

---

## 🚀 PASO 3: Convertir Excel a JSON

### Opción A: Usar Herramienta Online

1. Ve a: https://www.convertcsv.com/csv-to-json.htm
2. Copia los datos de Excel
3. Pega en el convertidor
4. Selecciona formato JSON Array
5. Copia el resultado

### Opción B: Usar Python (si tienes instalado)

```python
import pandas as pd
import json

# Leer Excel
df = pd.read_excel('clientes.xlsx')

# Convertir fechas a string formato YYYY-MM-DD
df['start_date'] = pd.to_datetime(df['start_date']).dt.strftime('%Y-%m-%d')
df['renewal_date'] = pd.to_datetime(df['renewal_date']).dt.strftime('%Y-%m-%d')

# Convertir a JSON
json_data = df.to_json(orient='records', indent=2)

# Guardar
with open('import_data.json', 'w') as f:
    f.write(json_data)

print("JSON generado en: import_data.json")
```

### Ejemplo de JSON Resultante:

```json
[
  {
    "client_name": "JUAN PÉREZ GÓMEZ",
    "policy_number": "POL-2024-001",
    "broker_email": "broker1@example.com",
    "insurer_name": "ASSA",
    "ramo": "AUTO",
    "start_date": "2024-01-15",
    "renewal_date": "2025-01-15",
    "national_id": "8-123-4567",
    "email": "juan@example.com",
    "phone": "6000-0000"
  },
  {
    "client_name": "MARÍA GONZÁLEZ",
    "policy_number": "POL-2024-002",
    "broker_email": "broker2@example.com",
    "insurer_name": "MAPFRE",
    "ramo": "VIDA",
    "start_date": "2024-02-01",
    "renewal_date": "2025-02-01",
    "national_id": "E-8-123456",
    "email": "maria@example.com",
    "phone": "6100-0000"
  }
]
```

---

## ⚡ PASO 4: Ejecutar el Bulk Import

### En Supabase SQL Editor:

1. Ve a: **SQL Editor** en Supabase Dashboard
2. Pega el JSON que preparaste en el paso 3
3. Ejecuta la siguiente query:

```sql
SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "JUAN PÉREZ GÓMEZ",
    "policy_number": "POL-2024-001",
    "broker_email": "broker1@example.com",
    "insurer_name": "ASSA",
    "ramo": "AUTO",
    "start_date": "2024-01-15",
    "renewal_date": "2025-01-15",
    "national_id": "8-123-4567",
    "email": "juan@example.com",
    "phone": "6000-0000"
  }
  -- ... más registros aquí
]'::jsonb);
```

**IMPORTANTE:** Reemplaza el contenido del array `[...]` con tu JSON completo.

---

## 📊 PASO 5: Interpretar Resultados

La función retorna una tabla con el resultado de cada fila:

| success | row_number | client_name | policy_number | message | client_id | policy_id |
|---------|------------|-------------|---------------|---------|-----------|-----------|
| true | 1 | JUAN PÉREZ GÓMEZ | POL-2024-001 | SUCCESS: Cliente y póliza creados | uuid-123 | uuid-456 |
| false | 2 | MARÍA GONZÁLEZ | POL-2024-002 | ERROR: Broker no encontrado con email: ... | NULL | NULL |
| true | 3 | CARLOS RODRÍGUEZ | POL-2024-003 | SUCCESS: Cliente y póliza creados | uuid-789 | uuid-abc |

### ✅ Éxito (success = true)
- Cliente y póliza creados correctamente
- `client_id` y `policy_id` contienen los IDs generados

### ❌ Error (success = false)
- El `message` explica qué salió mal
- Los IDs son NULL
- Corrige el error en tu Excel y vuelve a intentar SOLO esa fila

---

## 🔍 PASO 6: Verificar los Datos Cargados

```sql
-- Ver últimos clientes creados
SELECT 
  c.name,
  c.national_id,
  c.email,
  COUNT(p.id) as num_policies
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE c.created_at > NOW() - INTERVAL '1 hour'
GROUP BY c.id, c.name, c.national_id, c.email
ORDER BY c.created_at DESC;

-- Ver últimas pólizas creadas
SELECT 
  p.policy_number,
  c.name as client_name,
  i.name as insurer_name,
  b.name as broker_name,
  p.start_date,
  p.renewal_date,
  p.status
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
INNER JOIN insurers i ON p.insurer_id = i.id
INNER JOIN brokers b ON p.broker_id = b.id
WHERE p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

---

## 🛡️ Seguridad y RLS

La función `bulk_import_clients_policies` tiene **SECURITY DEFINER**, lo que significa:

- ✅ **Bypasea RLS** - Puede insertar datos sin restricciones
- ⚠️ **Solo Master puede ejecutar** - Asegúrate de tener rol Master
- 🔒 **Segura** - Valida todos los datos antes de insertar
- 📝 **Auditable** - Registra created_at/updated_at en todos los registros

---

## 💡 Características Especiales

### 1. Detección de Clientes Duplicados
- Si un cliente ya existe (por cédula o nombre exacto), NO crea duplicado
- Actualiza datos opcionales si vienen en el import (email, teléfono)
- Crea solo la nueva póliza para ese cliente existente

### 2. Validación de Pólizas
- Si una póliza ya existe, muestra error y NO la crea
- Esto evita duplicados de pólizas

### 3. Manejo de Errores
- Si una fila tiene error, NO detiene el proceso
- Continúa con las siguientes filas
- Retorna resultado detallado de cada fila

### 4. Campos Opcionales
- Los campos opcionales (cédula, email, teléfono, ramo) pueden estar vacíos
- Se pueden completar después manualmente desde la plataforma

---

## 📧 Formato de Datos que Necesito de Ti

Para que yo ejecute el bulk import por ti, envíame:

### Opción 1: Archivo Excel
- Archivo `.xlsx` con las columnas mencionadas arriba
- Yo lo convertiré a JSON y lo ejecutaré

### Opción 2: CSV
- Archivo `.csv` separado por comas
- Primera fila = nombres de columnas
- Yo lo convertiré a JSON y lo ejecutaré

### Opción 3: JSON (Si ya lo tienes)
- Archivo `.json` con el formato del ejemplo
- Lo ejecutaré directamente

### Opción 4: Pegar en Chat
- Si son pocos registros (< 50), puedes pegar los datos aquí
- Los formatearé y ejecutaré

---

## ⚠️ Validaciones Previas Importantes

Antes de enviarme los datos, verifica:

1. ✅ **Emails de brokers existen** - Ejecuta `get_brokers_for_import()`
2. ✅ **Nombres de aseguradoras coinciden** - Ejecuta `get_insurers_for_import()`
3. ✅ **Fechas en formato correcto** - YYYY-MM-DD
4. ✅ **Números de póliza únicos** - No deben existir ya
5. ✅ **Campos obligatorios completos** - Ver lista arriba

---

## 🔄 Actualizar Datos Después

Si necesitas completar datos faltantes después del import:

```sql
-- Actualizar datos de un cliente
UPDATE clients
SET 
  national_id = '8-123-4567',
  email = 'nuevo@email.com',
  phone = '6000-0000'
WHERE name = 'JUAN PÉREZ GÓMEZ';

-- Actualizar datos de una póliza
UPDATE policies
SET 
  ramo = 'AUTO',
  notas = 'Información adicional'
WHERE policy_number = 'POL-2024-001';
```

---

## 📞 ¿Listo para Cargar?

**Dime en qué formato tienes los datos y te ayudo a procesarlos:**

1. 📄 Excel (.xlsx)
2. 📝 CSV (.csv)
3. 🔤 JSON (.json)
4. 💬 Texto plano (para pocos registros)

**También necesito:**
- ¿Cuántos registros aproximadamente?
- ¿Los datos ya están completos o faltan campos opcionales?
