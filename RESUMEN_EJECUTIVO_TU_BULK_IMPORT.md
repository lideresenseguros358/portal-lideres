# 📊 RESUMEN EJECUTIVO - TU BULK IMPORT

## 🎯 ESTADO ACTUAL

**Datos detectados:**
- ✅ Múltiples pólizas de diferentes aseguradoras
- ✅ Brokers identificados por email
- ✅ Fechas en formato DD/MM/YY
- ✅ Comisiones variables (0.5, 0.6, 0.7, 0.8, 0.94, 1.0)

**Aseguradoras detectadas:**
- ASSA
- FEDPA
- MAPFRE
- SURA
- ANCON
- MB SEGUROS

**Brokers detectados:**
- luciaydanna@gmail.com (mayoría de pólizas)
- luisquiros@lideresenseguros.com
- yanitzajustiniani@lideresenseguros.com
- soniaa0154@outlook.com
- (y muchos más...)

---

## ⚠️ PROBLEMA CRÍTICO CON TUS DATOS

Tu archivo de datos tiene **formato de texto con espacios**, lo cual es difícil de parsear automáticamente porque:

1. **Campos fusionados:** Algunos nombres tienen espacios variables
2. **Campos vacíos:** National_ID, email, phone a veces están vacíos
3. **Columnas no alineadas:** Los espacios no son consistentes

**EJEMPLO DE TU FORMATO:**
```
ALEXIS CONCEPCION ALVEO GONZALEZ                                                                                              12B34565                   ASSA                 ACCIDENTES PERSONALES  02/06/25  02/06/26   1 luciaydanna@gmail.com 1
```

---

## ✅ SOLUCIONES RECOMENDADAS

### Opción 1: LIMPIA MANUAL EN EXCEL (MÁS SEGURA) ⭐

**Paso 1:** Abre Excel y crea estas columnas:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| client_name | national_id | email | phone | policy_number | insurer_name | ramo | start_date | renewal_date | broker_email | percent_override |

**Paso 2:** Copia tus datos Y LIMPIA manualmente:
- Una fila por póliza
- Fechas en formato DD/MM/YYYY (Excel las reconoce)
- Broker email al final

**Paso 3:** Exporta como CSV

**Paso 4:** Convierte CSV a JSON: https://www.convertcsv.com/csv-to-json.htm

**Paso 5:** Ejecuta en Supabase (ver abajo)

---

### Opción 2: SCRIPT PYTHON SEMI-AUTOMÁTICO

Si tus datos están en un archivo .txt bien formateado:

**Paso 1:** Guarda TODOS tus datos aquí:
```
C:\Users\Samud\portal-lideres\DATOS_IMPORT_RAW.txt
```

**Paso 2:** Ejecuta el script:
```bash
cd C:\Users\Samud\portal-lideres\scripts
python parse_bulk_data.py
```

**Paso 3:** Revisa y corrige el JSON generado:
```
C:\Users\Samud\portal-lideres\DATOS_IMPORT.json
```

**Paso 4:** Ejecuta en Supabase

---

## 🔧 ANTES DE IMPORTAR

### 1. Verifica que las funciones SQL estén instaladas

Ejecuta en Supabase SQL Editor:

```sql
-- Instalar funciones
\i BULK_IMPORT_CLIENTES.sql
```

O copia y pega todo el contenido de `BULK_IMPORT_CLIENTES.sql`

### 2. Verifica brokers disponibles

```sql
SELECT * FROM get_brokers_for_import()
ORDER BY broker_name;
```

**¿Faltan brokers?** Créalos primero en `/brokers`

### 3. Verifica aseguradoras disponibles

```sql
SELECT * FROM get_insurers_for_import()
ORDER BY insurer_name;
```

**Nombres que debes usar (EXACTOS, MAYÚSCULAS):**
- `ASSA`
- `FEDPA`
- `MAPFRE`
- `SURA`
- `ANCON`
- `MB SEGUROS`

---

## 🚀 EJECUTAR EL IMPORT

### Ejemplo con UNA póliza (para probar):

```sql
SELECT * FROM bulk_import_clients_policies('[
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
]'::jsonb);
```

**Resultado esperado:**

| success | row_number | client_name | policy_number | message | client_id | policy_id |
|---------|------------|-------------|---------------|---------|-----------|-----------|
| true | 1 | ALEXIS CONCEPCION ALVEO GONZALEZ | 12B34565 | ✅ Cliente y póliza creados exitosamente | uuid-abc | uuid-def |

---

### Import MASIVO (múltiples pólizas):

```sql
SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "CLIENTE 1",
    "policy_number": "POL-001",
    "insurer_name": "ASSA",
    "start_date": "2025-01-15",
    "renewal_date": "2026-01-15",
    "broker_email": "luciaydanna@gmail.com",
    "ramo": "AUTO",
    "percent_override": 0.94
  },
  {
    "client_name": "CLIENTE 2",
    "national_id": "8-123-4567",
    "email": "cliente2@email.com",
    "phone": "6000-0000",
    "policy_number": "POL-002",
    "insurer_name": "FEDPA",
    "start_date": "2025-02-01",
    "renewal_date": "2026-02-01",
    "broker_email": "otro@broker.com",
    "ramo": "VIDA",
    "percent_override": 1.0
  }
]'::jsonb);
```

⚠️ **IMPORTANTE:** 
- Reemplaza `[...]` con tu JSON completo
- Todos los campos en formato correcto
- Fechas en YYYY-MM-DD
- Emails en minúsculas

---

## 📊 INTERPRETAR RESULTADOS

### ✅ ÉXITO
```
success = true
message = "✅ Cliente y póliza creados exitosamente"
client_id = uuid válido
policy_id = uuid válido
```

### ⚠️ CLIENTE YA EXISTE (OK - reutiliza)
```
success = true
message = "✅ Cliente existente encontrado, póliza creada"
client_id = uuid del cliente existente
policy_id = uuid nuevo
```

### ❌ ERROR - Broker no encontrado
```
success = false
message = "❌ Broker con email 'xxx@xxx.com' no encontrado"
client_id = null
policy_id = null
```

**Solución:** Crea el broker primero en la página de brokers

### ❌ ERROR - Aseguradora no encontrada
```
success = false
message = "❌ Aseguradora 'XXX' no encontrada"
client_id = null
policy_id = null
```

**Solución:** Verifica el nombre exacto con `SELECT * FROM get_insurers_for_import()`

### ❌ ERROR - Póliza duplicada
```
success = false
message = "❌ Ya existe una póliza con número 'POL-001'"
client_id = null
policy_id = null
```

**Solución:** Usa un número de póliza diferente o verifica si es un duplicado real

---

## 🎯 TIPS PARA TUS DATOS ESPECÍFICOS

### 1. Broker Principal: luciaydanna@gmail.com
**Debes verificar que exista:**
```sql
SELECT b.name, b.email, p.email as profile_email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(p.email) = 'luciaydanna@gmail.com';
```

Si no existe, créalo primero en la página de brokers.

### 2. Fechas con Año "72", "75", "79"
Las fechas como `14/07/72` se interpretarán como año 1972.
**Verifica que esto sea correcto** o cámbialas a formato completo: `14/07/2072`

### 3. Comisiones Variables
Detecté comisiones de: 0.5, 0.6, 0.7, 0.8, 0.94, 1.0
Estas se guardarán en `policies.percent_override`

**Para ver comisiones después del import:**
```sql
SELECT 
  c.name,
  p.policy_number,
  p.ramo,
  i.name as insurer,
  p.percent_override
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
WHERE p.created_at > NOW() - INTERVAL '1 day'
ORDER BY p.percent_override DESC;
```

### 4. Clientes Duplicados por Nombre
Si un cliente tiene múltiples pólizas, el sistema:
1. Busca si existe por `national_id` O por `name`
2. Si existe, reutiliza ese cliente
3. Solo crea la nueva póliza

**No hay problema con duplicados** - el sistema los maneja automáticamente.

---

## 📋 CHECKLIST ANTES DE IMPORTAR

- [ ] Funciones SQL instaladas (`BULK_IMPORT_CLIENTES.sql`)
- [ ] Brokers verificados (existen en BD con los emails correctos)
- [ ] Aseguradoras verificadas (nombres exactos)
- [ ] Datos en formato JSON correcto
- [ ] Fechas en formato YYYY-MM-DD
- [ ] Emails en minúsculas
- [ ] Probado con UNA póliza primero
- [ ] Backup de BD hecho (por si acaso)

---

## 🚨 SI ALGO SALE MAL

### Rollback Manual (eliminar registros recientes)

```sql
-- Ver últimas pólizas creadas
SELECT * FROM policies 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- SOLO SI NECESITAS ELIMINAR (CUIDADO)
DELETE FROM policies 
WHERE created_at > NOW() - INTERVAL '1 hour'
AND policy_number LIKE 'POL-%'; -- Ajusta el patrón

-- Ver últimos clientes creados
SELECT * FROM clients
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- SOLO SI NECESITAS ELIMINAR (CUIDADO)
DELETE FROM clients
WHERE created_at > NOW() - INTERVAL '1 hour'
AND name LIKE 'NOMBRE ESPECIFICO%'; -- Ajusta el patrón
```

⚠️ **PRECAUCIÓN:** Solo elimina si sabes exactamente qué estás haciendo

---

## 📞 PRÓXIMOS PASOS

1. **Elige tu método** (Excel manual o script Python)
2. **Prepara los datos** en formato JSON correcto
3. **Prueba con 1-5 pólizas** primero
4. **Revisa los resultados** de la prueba
5. **Si todo OK, ejecuta el bulk completo**
6. **Verifica los datos** importados

**¿Necesitas ayuda?**
- Muéstrame el mensaje de error exacto
- Indica qué row_number falló
- Comparte los datos de esa fila específica

---

## 📁 ARCHIVOS DISPONIBLES

- ✅ `BULK_IMPORT_CLIENTES.sql` - Funciones SQL
- ✅ `INSTRUCCIONES_BULK_IMPORT.md` - Guía detallada
- ✅ `GUIA_BULK_IMPORT_PASO_A_PASO.md` - Pasos específicos
- ✅ `scripts/parse_bulk_data.py` - Script Python
- ✅ `scripts/parse_bulk_import.mjs` - Script Node.js (alternativo)

---

## 🎉 ¡TODO LISTO!

Tienes todas las herramientas necesarias. Solo falta:
1. Preparar tus datos en formato correcto
2. Ejecutar el import
3. Verificar los resultados

**¡Éxito con tu bulk import!** 🚀
