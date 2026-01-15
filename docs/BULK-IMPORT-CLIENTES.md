# Sistema de Importación Masiva de Clientes y Pólizas

Sistema completo para importar múltiples clientes y sus pólizas desde archivos CSV con agrupación automática y actualización inteligente.

## 🚀 Características Principales

### 1. **Agrupación Automática de Pólizas**
Si el mismo cliente aparece en múltiples filas del CSV (identificado por cédula o nombre), el sistema:
- ✅ Agrupa automáticamente todas sus pólizas
- ✅ Crea un solo cliente en la base de datos
- ✅ Asocia todas las pólizas a ese cliente

**Ejemplo en CSV:**
```csv
client_name,national_id,email,phone,birth_date,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email
Juan Pérez,8-123-4567,juan@email.com,6000-0000,1985-05-20,POL-001,ASSA,AUTO,2024-01-15,2025-01-15,ACTIVA,broker@ejemplo.com
Juan Pérez,8-123-4567,,,,,POL-002,AIG,VIDA,2024-02-01,2025-02-01,ACTIVA,broker@ejemplo.com
```

**Resultado:** 
- 1 cliente creado (Juan Pérez)
- 2 pólizas asociadas a ese cliente

### 2. **Actualización Inteligente de Datos Faltantes**
Si un cliente ya existe en la base de datos, el sistema actualiza **solo los campos vacíos**:

**Escenario:**
- BD tiene: `Juan Pérez` sin cédula, sin email, sin teléfono
- CSV trae: `Juan Pérez, 8-123-4567, juan@email.com, 6000-0000`

**Resultado:**
- ✅ Se actualiza cédula → `8-123-4567`
- ✅ Se actualiza email → `juan@email.com`
- ✅ Se actualiza teléfono → `6000-0000`
- ✅ Se crea la nueva póliza del CSV

**NO se sobrescribe** información que ya existe en BD.

### 3. **Detección de Duplicados**
El sistema busca clientes existentes en este orden:

1. **Por cédula** (prioritario) - Si el CSV trae cédula, busca por cédula
2. **Por nombre** (secundario) - Si no hay cédula o no se encontró, busca por nombre exacto

### 4. **Validaciones Automáticas**
- ✅ Verifica que el broker (por email) exista en el sistema
- ✅ Verifica que la aseguradora exista (por nombre exacto)
- ✅ Previene creación de pólizas duplicadas (mismo número)
- ✅ Valida campos obligatorios por fila

## 📋 Estructura del CSV

### ⚠️ IMPORTANTE: Todas las Columnas Son OBLIGATORIAS

**Excepto:** Solo la columna `notas` es opcional.

### Columnas del CSV

1. **client_name** - Nombre completo del cliente
2. **national_id** - Cédula o RUC (obligatorio)
3. **email** - Email del cliente (obligatorio)
4. **phone** - Teléfono del cliente (obligatorio)
5. **birth_date** - Fecha de nacimiento en formato YYYY-MM-DD (obligatorio)
6. **policy_number** - Número único de la póliza (obligatorio)
7. **insurer_name** - Nombre exacto de la aseguradora (obligatorio - ver lista abajo)
8. **ramo** - Tipo de póliza: AUTO, VIDA, INCENDIO, etc. (obligatorio)
9. **start_date** - Fecha de inicio de vigencia YYYY-MM-DD (obligatorio)
10. **renewal_date** - Fecha de renovación YYYY-MM-DD (obligatorio)
11. **status** - Estado: ACTIVA, VENCIDA o CANCELADA (obligatorio)
12. **broker_email** - Email del broker asignado (obligatorio)
13. **notas** - Notas adicionales sobre la póliza (OPCIONAL)

### 🔴 Sistema de Clientes Preliminares

Si **falta alguno** de estos 4 datos del cliente:
- `national_id`
- `email`
- `phone`
- `birth_date`

El cliente se marcará como **PRELIMINAR** (active = false) hasta que se complete toda su información.

## 🎯 Casos de Uso

### Caso 1: Cliente Nuevo con Múltiples Pólizas

**CSV:**
```csv
client_name,national_id,email,phone,birth_date,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email
María García,E-8-12345,maria@email.com,6100-0000,1990-08-15,POL-003,MAPFRE,AUTO,2024-03-10,2025-03-10,ACTIVA,broker@ejemplo.com
María García,E-8-12345,,,,,POL-004,ASSA,VIDA,2024-04-01,2025-04-01,ACTIVA,broker@ejemplo.com
María García,E-8-12345,,,,,POL-005,AIG,INCENDIO,2024-05-01,2025-05-01,ACTIVA,broker@ejemplo.com
```

**Resultado:**
- ✅ 1 cliente: María García (con todos los datos de la primera fila)
- ✅ 3 pólizas asociadas

### Caso 2: Cliente Existente - Completar Datos

**Estado en BD:**
```
Cliente: Pedro López (sin cédula, sin email, sin teléfono)
```

**CSV:**
```csv
client_name,national_id,email,phone,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email
Pedro López,8-999-8888,pedro@email.com,6200-0000,POL-006,AIG,AUTO,2024-06-01,2025-06-01,ACTIVA,broker@ejemplo.com
```

**Resultado:**
- ✅ Cliente actualizado: Pedro López (ahora CON cédula, email y teléfono)
- ✅ Nueva póliza POL-006 creada

### Caso 3: Cliente Preliminar (Sin Cédula)

**CSV:**
```csv
client_name,national_id,email,phone,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email
Ana Rodríguez,,,6300-0000,POL-007,ASSA,AUTO,2024-07-01,2025-07-01,ACTIVA,broker@ejemplo.com
```

**Resultado:**
- ✅ Cliente creado sin cédula (preliminar)
- ✅ Póliza POL-007 creada
- ⚠️ Más tarde, si se importa nuevamente con cédula, se actualizará

## 📥 Cómo Usar el Sistema

### Desde la Interfaz Web

1. **Ir a Base de Datos**
   - Navegar a `/db` en el portal

2. **Abrir Modal de Importación**
   - Click en botón "Importar CSV"

3. **Descargar Plantilla**
   - Click en "Descargar plantilla CSV"
   - Esto descarga `/public/plantilla_clientes.csv` con ejemplos

4. **Preparar tu Archivo**
   - Completar con tus datos
   - Asegurar que nombres de aseguradoras coincidan exactamente
   - Verificar que emails de brokers sean correctos

5. **Importar**
   - Seleccionar archivo CSV
   - Ver preview (primeras 5 filas)
   - Confirmar importación
   - Ver resultados (éxitos y errores)

### Ejemplo de Plantilla

Ver archivo: `public/plantilla_clientes.csv`

```csv
client_name,national_id,email,phone,birth_date,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email,percent_override
Juan Pérez,8-123-4567,juan.perez@email.com,6000-0000,1985-05-20,POL-2024-001,ASSA,AUTO,2024-01-15,2025-01-15,ACTIVA,broker@lideresenseguros.com,
Juan Pérez,8-123-4567,,,,,POL-2024-002,AIG,VIDA,2024-02-01,2025-02-01,ACTIVA,broker@lideresenseguros.com,
María García,E-8-12345,maria.garcia@email.com,6100-0000,1990-08-15,POL-2024-003,MAPFRE,INCENDIO,2024-03-10,2025-03-10,ACTIVA,broker@lideresenseguros.com,
```

## ⚙️ Flujo Técnico

### 1. Lectura del CSV
```typescript
// Parse con PapaParse
Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => { /* ... */ }
});
```

### 2. Agrupación por Cliente
```typescript
// Agrupa por cédula o nombre
const groups = groupByClient(rows);

// Ejemplo:
{
  "8-123-4567": [row1, row2, row3],  // Juan con 3 pólizas
  "E-8-12345": [row4],                // María con 1 póliza
  "PEDRO LOPEZ": [row5, row6]         // Pedro sin cédula, 2 pólizas
}
```

### 3. Procesamiento por Grupo
Para cada grupo:
```typescript
1. Buscar broker por email
2. Buscar cliente existente (por cédula → por nombre)
3. Si existe:
   - Actualizar solo campos vacíos
4. Si no existe:
   - Crear nuevo cliente
5. Para cada póliza del grupo:
   - Validar aseguradora
   - Verificar que póliza no exista
   - Crear póliza asociada al cliente
```

### 4. Respuesta
```typescript
{
  success: 5,  // 5 pólizas importadas exitosamente
  errors: [
    { row: 3, message: "Aseguradora no encontrada: XYZ" },
    { row: 7, message: "Póliza POL-999 ya existe" }
  ]
}
```

## 🔍 Validaciones y Errores

### Errores Comunes

**1. "Broker no encontrado"**
- **Causa:** Email del broker no existe en el sistema
- **Solución:** Verificar ortografía del email o crear el broker primero

**2. "Aseguradora no encontrada"**
- **Causa:** Nombre de aseguradora no coincide exactamente
- **Solución:** Usar nombres exactos (ASSA, AIG, MAPFRE, etc.)

**3. "Póliza ya existe"**
- **Causa:** Número de póliza duplicado
- **Solución:** Cambiar número de póliza o eliminar duplicado

**4. "client_name y broker_email son obligatorios"**
- **Causa:** Faltan campos obligatorios
- **Solución:** Completar campos en el CSV

## 📊 Estadísticas de Importación

Al finalizar, el sistema muestra:

```
✅ 10 registros importados exitosamente

⚠️ 2 errores encontrados:
  - Fila 5: Aseguradora no encontrada: SEGURO XYZ
  - Fila 8: Póliza POL-123 ya existe
```

## 🎨 Archivos del Sistema

### Frontend
- `src/components/db/ImportModal.tsx` - Modal de importación
- `src/app/(app)/db/import/page.tsx` - Página legacy (deprecada)

### Backend
- `src/app/api/db/import/route.ts` - Endpoint principal de importación

### Assets
- `public/plantilla_clientes.csv` - Plantilla de ejemplo

### Documentación
- `docs/BULK-IMPORT-CLIENTES.md` - Este documento

## 🚦 Estados de Póliza Válidos

Al importar, usar uno de estos valores en la columna `status`:
- `ACTIVA` - Póliza activa
- `VENCIDA` - Póliza vencida
- `CANCELADA` - Póliza cancelada

Si se deja vacío, por defecto será `ACTIVA`.

## 🔐 Seguridad

- ✅ Requiere autenticación de usuario
- ✅ Respeta permisos RLS de Supabase
- ✅ Valida todos los datos antes de insertar
- ✅ Previene duplicación de pólizas
- ✅ Transacciones atómicas por grupo de cliente

## 💡 Mejores Prácticas

### 1. **Preparación del CSV**
- Usar la plantilla oficial
- Completar máximo de datos posibles
- Incluir cédulas para evitar duplicados por nombre

### 2. **Nombres de Aseguradoras**
- Verificar ortografía exacta
- Usar mayúsculas (ASSA, no Assa)
- Consultar lista de aseguradoras en el sistema

### 3. **Agrupación de Pólizas**
- Usar la misma cédula para todas las pólizas de un cliente
- Completar todos los datos del cliente en la primera fila
- Dejar campos repetidos vacíos en filas siguientes

### 4. **Fechas**
- Usar formato ISO: YYYY-MM-DD
- Ejemplo: 2024-01-15 (no 15/01/2024)
- Asegurar que renewal_date > start_date

### 5. **Pruebas**
- Comenzar con pocas filas para probar
- Verificar resultados antes de importar todo
- Revisar mensajes de error detenidamente

## 🔄 Actualización vs Creación

| Escenario | Cliente en BD | CSV | Resultado |
|-----------|---------------|-----|-----------|
| Nuevo cliente | No existe | Datos completos | Cliente creado + pólizas |
| Cliente existe (cédula) | Existe con cédula | Misma cédula | Cliente actualizado + pólizas agregadas |
| Cliente existe (nombre) | Existe sin cédula | Mismo nombre | Cliente actualizado + pólizas agregadas |
| Actualizar datos | Tiene nombre | Nombre + cédula + email | Cédula y email agregados |

## 📞 Soporte

Si encuentras problemas:
1. Verificar formato del CSV (usar plantilla)
2. Revisar mensajes de error específicos
3. Confirmar que brokers y aseguradoras existan en el sistema
4. Verificar que números de póliza sean únicos

---

**Última actualización:** Enero 15, 2026  
**Versión:** 1.0.0
