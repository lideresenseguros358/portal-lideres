# SOLUCIÓN: Bulk Import de MB Seguros

## Problema Identificado

El CSV tiene registros con `insurer_name: "MB SEGUROS"` pero en Supabase la aseguradora está registrada como `"MB"` (sin "SEGUROS"), causando que el bulk import falle con el error:

```
ERROR: Aseguradora no encontrada: MB SEGUROS
```

## Solución Implementada

Se actualizó la función `bulk_import_clients_policies` para hacer **búsqueda flexible** de aseguradoras:

1. **Primera búsqueda**: Coincidencia exacta (mantiene compatibilidad)
2. **Segunda búsqueda**: Coincidencia parcial si no encuentra exacta

### Lógica de Búsqueda Parcial

```sql
-- Si CSV dice "MB SEGUROS" y BD tiene "MB" → ✅ ENCUENTRA
WHERE v_insurer_name LIKE '%' || UPPER(name) || '%'
-- Resultado: "MB SEGUROS" LIKE '%MB%' → true

-- Si CSV dice "MB" y BD tiene "MB SEGUROS" → ✅ ENCUENTRA  
WHERE UPPER(name) LIKE '%' || v_insurer_name || '%'
-- Resultado: "MB SEGUROS" LIKE '%MB%' → true
```

## Pasos para Ejecutar

### 1. Actualizar la función en Supabase

1. Ir a Supabase → SQL Editor
2. Abrir el archivo `ACTUALIZAR_BULK_IMPORT_MB.sql`
3. Copiar todo el contenido
4. Pegar en SQL Editor
5. Click en **Run** (o F5)

**Verificación esperada:**
- Debe mostrar las aseguradoras que contienen "MB"
- Debe mostrar la definición de la función actualizada

### 2. Verificar cómo está registrada MB

Ejecutar en SQL Editor:

```sql
SELECT id, name, active 
FROM insurers 
WHERE UPPER(name) LIKE '%MB%'
ORDER BY name;
```

**Resultado esperado:**
```
id                                    | name | active
--------------------------------------|------|-------
[uuid]                                | MB   | true
```

### 3. Preparar datos de MB Seguros

Filtrar del CSV `TODAS.csv` solo las filas donde `insurer_name = "MB SEGUROS"`:

**Opción A: Excel/Google Sheets**
- Abrir TODAS.csv
- Filtrar columna de aseguradora por "MB SEGUROS"
- Copiar filas filtradas
- Pegar en nuevo archivo `MB_SEGUROS.csv`

**Opción B: Herramienta online**
- Usar: https://www.convertcsv.com/csv-to-json.htm
- Filtrar por insurer_name = "MB SEGUROS"
- Convertir a JSON

### 4. Ejecutar el bulk import

En Supabase SQL Editor:

```sql
SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "CLIENTE 1",
    "policy_number": "MB-001",
    "broker_email": "email@broker.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2024-01-15",
    "renewal_date": "2025-01-15",
    "national_id": "8-123-4567",
    "email": "cliente@email.com",
    "phone": "6000-0000"
  },
  ... resto de registros MB SEGUROS ...
]'::jsonb);
```

### 5. Verificar resultados

La función retorna una tabla con:

| success | row_number | client_name | policy_number | message | client_id | policy_id |
|---------|------------|-------------|---------------|---------|-----------|-----------|
| true    | 1          | CLIENTE 1   | MB-001        | SUCCESS: Cliente y póliza creados | [uuid] | [uuid] |
| false   | 2          | CLIENTE 2   | MB-002        | ERROR: ... | null | null |

**Verificar:**
- ✅ Todas las filas con `success = true`
- ✅ `message` dice "SUCCESS: Cliente y póliza creados"
- ✅ `client_id` y `policy_id` tienen valores UUID

**Si hay errores:**
- ❌ `success = false`
- Revisar el `message` específico del error
- Corregir datos y reintentar esa fila

### 6. Validación final

```sql
-- Ver pólizas de MB recién creadas
SELECT 
  p.policy_number,
  c.name as client,
  i.name as insurer,
  b.name as broker,
  p.start_date,
  p.renewal_date
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE i.name = 'MB'
  AND p.created_at > NOW() - INTERVAL '1 hour'
ORDER BY p.created_at DESC;
```

## Beneficios de la Actualización

1. ✅ **Flexible**: "MB SEGUROS" → "MB" funciona automáticamente
2. ✅ **Retrocompatible**: Búsquedas exactas siguen funcionando
3. ✅ **Tolerante**: Acepta variaciones de nombres de aseguradoras
4. ✅ **Reutilizable**: Funciona para otras aseguradoras con nombres similares

**Ejemplos que ahora funcionan:**
- "ASSA COMPAÑÍA DE SEGUROS" → "ASSA" ✅
- "MAPFRE SEGUROS" → "MAPFRE" ✅
- "VIVIR SEGUROS S.A." → "VIVIR" ✅

## Notas Importantes

⚠️ **IMPORTANTE**: La búsqueda parcial solo se ejecuta si NO hay coincidencia exacta. Esto significa que si tienes dos aseguradoras:
- "MB"
- "MB SEGUROS"

La función preferirá siempre la coincidencia exacta primero.

📝 **RECOMENDACIÓN**: Para mayor consistencia en el futuro, considera:
1. Estandarizar nombres en la BD (decidir si usar "MB" o "MB SEGUROS")
2. O actualizar los CSVs para que coincidan exactamente con la BD

## Archivo de Referencia

- Script SQL: `ACTUALIZAR_BULK_IMPORT_MB.sql`
- Función original: `BULK_IMPORT_CLIENTES.sql` (también actualizada)

## Soporte

Si encuentras errores:
1. Copiar el mensaje completo del error
2. Verificar que la aseguradora existe en la BD
3. Verificar que el email del broker es correcto
4. Verificar que el número de póliza no existe ya
