# 📋 Sistema de Clientes Preliminares

## 📋 Descripción General

Sistema completo para gestionar clientes preliminares con datos incompletos, provenientes principalmente de "Pendientes Sin Identificar" de comisiones. Los clientes se mantienen en una tabla temporal (`temp_client_import`) hasta completar todos los campos obligatorios, momento en el cual se migran automáticamente a la base de datos principal (`clients` y `policies`).

---

## 🎯 Problema que Resuelve

### **Situación Actual:**

1. **Pendientes Sin Identificar** en comisiones contienen:
   - ✅ Nombre del cliente (extraído del reporte)
   - ✅ Número de póliza (extraído del reporte)
   - ✅ Aseguradora (extraída del reporte)
   - ✅ Broker asignado (extraído del reporte)
   - ❌ **Fecha de renovación** (NO disponible en el reporte)

2. **Resultado:**
   - ❌ No se pueden crear directamente en `clients`/`policies` por falta de fecha renovación
   - ❌ Quedan "flotando" sin calcular comisiones
   - ❌ No aparecen en reportes de morosidad
   - ❌ Datos incompletos impiden procesamiento

### **Solución Implementada:**

1. ✅ Los pendientes sin identificar se registran en `temp_client_import`
2. ✅ Se completan los datos faltantes desde la interfaz
3. ✅ Al agregar la fecha de renovación → **Migración automática** vía trigger
4. ✅ Cliente migrado calcula comisiones y aparece en reportes

---

## 🗄️ Arquitectura de Base de Datos

### **Tabla: `temp_client_import`**

```sql
CREATE TABLE temp_client_import (
  id UUID PRIMARY KEY,
  
  -- Datos del cliente
  client_name TEXT,                    -- Obligatorio para migración
  national_id TEXT,                    -- Opcional
  email TEXT,                          -- Opcional
  phone TEXT,                          -- Opcional
  
  -- Datos de la póliza
  policy_number TEXT,                  -- Obligatorio para migración
  ramo TEXT,                           -- Opcional
  insurer_id UUID,                     -- Obligatorio para migración
  start_date DATE,                     -- Opcional
  renewal_date DATE,                   -- ⚠️ CRÍTICO - Típicamente faltante
  status TEXT DEFAULT 'ACTIVA',
  
  -- Asignación
  broker_id UUID,                      -- Obligatorio para migración
  
  -- Metadata
  source TEXT,                         -- 'unidentified_pending', 'manual'
  source_id UUID,                      -- ID del pending original
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  migrated_at TIMESTAMPTZ,
  migrated BOOLEAN DEFAULT false,
  
  -- IDs creados tras migración
  client_id UUID,
  policy_id UUID,
  
  notes TEXT
);
```

### **Campos Obligatorios para Migración:**

| Campo | Descripción | Típicamente Disponible |
|-------|-------------|------------------------|
| `client_name` | Nombre del cliente | ✅ Desde reporte |
| `policy_number` | Número de póliza | ✅ Desde reporte |
| `insurer_id` | Aseguradora | ✅ Desde reporte |
| `broker_id` | Corredor | ✅ Desde reporte |
| `renewal_date` | Fecha renovación | ❌ **FALTA** - Usuario debe completar |

### **Campos Opcionales:**

- `national_id` - Cédula/RUC
- `email` - Email del cliente
- `phone` - Teléfono
- `ramo` - Tipo de seguro
- `start_date` - Fecha inicio
- `notes` - Notas adicionales

---

## ⚙️ Triggers y Funciones Automáticas

### **1. Trigger de Migración Automática**

```sql
CREATE TRIGGER trigger_migrate_temp_client
  AFTER INSERT OR UPDATE ON temp_client_import
  FOR EACH ROW
  EXECUTE FUNCTION check_temp_client_complete();
```

**Comportamiento:**
- Se ejecuta cada vez que se **inserta** o **actualiza** un registro
- Verifica si todos los campos obligatorios están completos
- Si están completos → Llama a `migrate_temp_client_to_production()`
- **Migración totalmente automática**

### **2. Función de Validación**

```sql
CREATE FUNCTION check_temp_client_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_name IS NOT NULL 
     AND NEW.policy_number IS NOT NULL 
     AND NEW.insurer_id IS NOT NULL
     AND NEW.renewal_date IS NOT NULL  -- ← Campo crítico
     AND NEW.broker_id IS NOT NULL
     AND NEW.migrated = false
  THEN
    PERFORM migrate_temp_client_to_production(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **3. Función de Migración**

```sql
CREATE FUNCTION migrate_temp_client_to_production(temp_id UUID)
RETURNS void AS $$
DECLARE
  new_client_id UUID;
  new_policy_id UUID;
BEGIN
  -- 1. Verificar si cliente ya existe (por cédula o nombre)
  -- 2. Crear o actualizar cliente en tabla 'clients'
  -- 3. Crear póliza en tabla 'policies'
  -- 4. Marcar registro temporal como migrado
  -- 5. Guardar IDs creados para referencia
END;
$$ LANGUAGE plpgsql;
```

**Lógica de Migración:**

1. **Buscar cliente existente:**
   - Por `national_id` (si existe)
   - Por `name` (case-insensitive)
   
2. **Si existe:**
   - Actualizar datos (cédula, email, teléfono)
   - Usar ID existente
   
3. **Si NO existe:**
   - Crear nuevo cliente en `clients`
   - Obtener nuevo ID

4. **Crear póliza:**
   - Insertar en `policies`
   - Vincular con `client_id`
   
5. **Marcar como migrado:**
   ```sql
   UPDATE temp_client_import
   SET migrated = true,
       migrated_at = now(),
       client_id = new_client_id,
       policy_id = new_policy_id
   WHERE id = temp_id;
   ```

---

## 🔒 Row Level Security (RLS)

### **Master:**
```sql
-- Ver todos los clientes preliminares
CREATE POLICY "Master puede ver todos"
  ON temp_client_import FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Insertar/Actualizar/Eliminar todos
CREATE POLICY "Master puede gestionar todos"...
```

### **Broker:**
```sql
-- Solo ver sus propios clientes preliminares
CREATE POLICY "Broker puede ver sus clientes"
  ON temp_client_import FOR SELECT
  USING (broker_id = auth.uid());

-- Solo actualizar los suyos
CREATE POLICY "Broker puede actualizar sus clientes"
  ON temp_client_import FOR UPDATE
  USING (broker_id = auth.uid());
```

---

## 📱 Interfaz de Usuario

### **Nueva Pestaña en Base de Datos**

**Ubicación:** `/db?view=preliminary`

**Botones de Navegación:**
```
[CLIENTES] [PRELIMINARES] [ASEGURADORAS]
```

### **Banner de Advertencia**

```
⚠️ Clientes Preliminares - Datos Incompletos

Estos clientes están pendientes de completar información obligatoria.

• NO calculan comisiones hasta que sean migrados
• NO aparecen en reportes de morosidad
• NO están incluidos en la base de datos principal
• Se migrarán automáticamente al completar todos los campos
```

### **Vista de Lista**

Para cada cliente preliminar se muestra:

1. **Header:**
   - Nombre del cliente
   - Número de póliza
   - Botones: [Migrar] [Editar] [Eliminar]

2. **Alerta de Campos Faltantes:**
   ```
   ❌ Campos faltantes para migración:
   • Fecha de renovación
   • Aseguradora
   ```

3. **Formulario de Edición:**
   - Sección: Información del Cliente
     - Nombre *
     - Cédula/RUC
     - Email
     - Teléfono
   
   - Sección: Información de la Póliza
     - Número de Póliza *
     - Ramo
     - Aseguradora *
     - Corredor *
     - Fecha Inicio
     - Fecha Renovación * ← **Campo crítico**
   
   - Notas adicionales

4. **Estados:**
   - **Incompleto:** Muestra campos faltantes en rojo
   - **Completo:** Muestra botón "Migrar" verde
   - **Migrado:** Ya no aparece en la lista

---

## 🔄 Flujos de Trabajo

### **Flujo 1: Desde Pendientes Sin Identificar**

```
Comisiones → Pendientes Sin Identificar
              ↓
    Se detecta nuevo pending con:
    - Nombre: JUAN PÉREZ ✓
    - Póliza: POL-001 ✓
    - Aseguradora: ASSA ✓
    - Broker: broker-123 ✓
    - Fecha renovación: ❌ FALTA
              ↓
    actionCreateFromUnidentified()
              ↓
INSERT INTO temp_client_import (
  client_name = 'JUAN PÉREZ',
  policy_number = 'POL-001',
  insurer_id = 'assa-uuid',
  broker_id = 'broker-uuid',
  renewal_date = NULL,  -- ← Falta
  source = 'unidentified_pending'
)
              ↓
    ✅ Registro creado en preliminares
    ❌ NO migra (falta renewal_date)
              ↓
Master ve en /db?view=preliminary
              ↓
    Click "Editar"
              ↓
    Completa: renewal_date = '2025-12-31'
              ↓
    Click "Guardar"
              ↓
UPDATE temp_client_import
SET renewal_date = '2025-12-31'
              ↓
    ⚡ TRIGGER SE ACTIVA
              ↓
check_temp_client_complete()
    Verifica: todos los campos completos ✓
              ↓
migrate_temp_client_to_production()
              ↓
    1. Busca cliente existente
    2. Crea/actualiza en 'clients'
    3. Crea póliza en 'policies'
    4. Marca temp como migrated=true
              ↓
✅ Cliente migrado exitosamente
✅ Calcula comisiones
✅ Aparece en reportes
✅ Ya no está en preliminares
```

### **Flujo 2: Migración Manual (Completo)**

```
Usuario en /db?view=preliminary
              ↓
    Ve cliente con todos los datos ✓
              ↓
    Click botón "Migrar" (verde)
              ↓
    Confirma: "¿Migrar a base de datos?"
              ↓
actionTriggerMigration(id)
              ↓
CALL migrate_temp_client_to_production(id)
              ↓
    Migración inmediata
              ↓
✅ Cliente en base de datos principal
```

### **Flujo 3: Edición y Auto-Migración**

```
Cliente preliminar:
- Nombre: MARÍA GONZÁLEZ ✓
- Póliza: POL-002 ✓
- Aseguradora: FEDPA ✓
- Broker: ✓
- Fecha renovación: ❌ FALTA
              ↓
Master click "Editar"
              ↓
Agrega: renewal_date = '2025-06-15'
              ↓
Click "Guardar"
              ↓
    ⚡ TRIGGER automático
              ↓
✅ Migración automática al guardar
✅ Toast: "Cliente migrado automáticamente"
✅ Desaparece de preliminares
✅ Aparece en clientes principales
```

---

## 📊 Actions del Sistema

### **1. actionGetPreliminaryClients()**

**Propósito:** Obtener lista de clientes preliminares

**Lógica:**
```typescript
- Obtener role del usuario
- Si Master → Ver todos (migrated=false)
- Si Broker → Solo los suyos (broker_id = user.id)
- Calcular campos faltantes para cada registro
- Retornar con metad

ata:
  - missing_fields: string[]
  - is_complete: boolean
```

### **2. actionUpdatePreliminaryClient(id, updates)**

**Propósito:** Actualizar cliente preliminar

**Lógica:**
```typescript
- Normalizar datos (UPPERCASE, trim, null)
- UPDATE temp_client_import
- Si se completan todos los campos:
  → Trigger automático se activa
  → Migración automática
  → Toast: "Cliente migrado"
- Revalidar página
```

### **3. actionDeletePreliminaryClient(id)**

**Propósito:** Eliminar cliente preliminar

**Restricciones:**
- Solo Master puede eliminar
- Elimina registro de temp_client_import
- No afecta datos migrados (si ya migró)

### **4. actionTriggerMigration(id)**

**Propósito:** Forzar migración manual

**Uso:**
- Botón "Migrar" verde
- Solo disponible si `is_complete = true`
- Llama a función PostgreSQL directamente

### **5. actionCreateFromUnidentified(pendingData)**

**Propósito:** Crear desde pendientes sin identificar

**Parámetros:**
```typescript
{
  client_name: string,      // Desde reporte
  policy_number: string,    // Desde reporte
  insurer_id: string,       // Desde reporte
  broker_id: string,        // Desde reporte
  source_id?: string,       // ID del pending
  national_id?: string,     // Si disponible
  ramo?: string             // Si disponible
}
```

**Resultado:**
- Crea registro en `temp_client_import`
- `renewal_date` = NULL (usuario debe completar)
- Toast: "Complete la fecha de renovación para migrar"

---

## 🎨 Componente: PreliminaryClientsTab

**Ubicación:** `src/components/db/PreliminaryClientsTab.tsx`

**Props:**
```typescript
interface Props {
  insurers: any[];   // Para dropdown
  brokers: any[];    // Para dropdown
  userRole: string;  // 'master' o 'broker'
}
```

**Estados:**
```typescript
- preliminaryClients: any[]  // Lista
- editingId: string | null   // ID en edición
- editForm: any              // Datos del formulario
- saving: boolean            // Estado de guardado
```

**Funcionalidades:**
1. ✅ Lista todos los clientes preliminares
2. ✅ Muestra campos faltantes por cada uno
3. ✅ Permite editar in-line
4. ✅ Auto-migración al completar datos
5. ✅ Migración manual con botón
6. ✅ Eliminación (solo Master)
7. ✅ Responsive (mobile/desktop)

---

## 🧪 Casos de Uso

### **Caso 1: Pending → Preliminar → Migrado**

**Input:**
```json
{
  "client_name": "PEDRO MARTÍNEZ",
  "policy_number": "POL-003",
  "insurer_id": "assa-uuid",
  "broker_id": "broker-uuid",
  "renewal_date": null  // ← FALTA
}
```

**Proceso:**
1. Se crea en `temp_client_import`
2. Aparece en "PRELIMINARES" con alerta roja
3. Master edita y agrega: `renewal_date = '2025-10-15'`
4. Trigger automático migra a `clients`/`policies`
5. Ya no aparece en preliminares

**Output:**
```sql
-- clients table
INSERT INTO clients (name, broker_id) 
VALUES ('PEDRO MARTÍNEZ', 'broker-uuid');

-- policies table
INSERT INTO policies (
  client_id, policy_number, insurer_id, 
  renewal_date, broker_id
) VALUES (
  'new-client-uuid', 'POL-003', 'assa-uuid',
  '2025-10-15', 'broker-uuid'
);

-- temp_client_import
UPDATE temp_client_import
SET migrated = true,
    migrated_at = now(),
    client_id = 'new-client-uuid',
    policy_id = 'new-policy-uuid';
```

### **Caso 2: Cliente Existente**

**Escenario:**
- Cliente "JUAN PÉREZ" ya existe (cédula: 8-111-2222)
- Llega pending con nueva póliza para "JUAN PÉREZ"

**Proceso:**
1. Se crea preliminar
2. Master completa fecha renovación
3. Trigger detecta cliente existente por cédula
4. **NO crea nuevo cliente** ← Reutiliza existente
5. Solo crea nueva póliza
6. Vincula póliza al cliente existente

**Resultado:**
```sql
-- NO se crea nuevo cliente
-- Solo nueva póliza
INSERT INTO policies (
  client_id,  -- ← ID existente
  policy_number,
  ...
);
```

### **Caso 3: Sin Cédula**

**Input:**
```json
{
  "client_name": "MARÍA GONZÁLEZ",
  "national_id": null,  // ← Sin cédula
  "policy_number": "POL-004",
  "renewal_date": "2025-11-01"
}
```

**Resultado:**
- ✅ Cliente preliminar válido
- ✅ Puede migrar (cédula es opcional)
- ✅ Se crea en `clients` con `national_id = NULL`
- ⚠️ Búsqueda de duplicados solo por nombre

---

## ⚠️ Advertencias y Limitaciones

### **1. Mientras está en Preliminares:**

❌ **NO calcula comisiones**
- No aparece en cálculos de fortnights
- No se generan registros de comisiones
- Pendientes asociados quedan sin procesar

❌ **NO aparece en morosidad**
- Sin fecha de renovación válida
- No se puede calcular días de atraso
- No entra en reportes

❌ **NO está en base principal**
- No aparece en listado de clientes
- No se puede buscar normalmente
- Solo visible en pestaña "PRELIMINARES"

### **2. Campos Críticos:**

**`renewal_date`:**
- ⚠️ Típicamente el dato faltante
- ⚠️ Sin esta fecha NO se puede migrar
- ⚠️ Usuario debe obtenerla manualmente

**`policy_number`:**
- ⚠️ Debe ser único en el sistema
- ⚠️ Si ya existe → Error en migración
- ⚠️ Validar antes de migrar

### **3. Duplicados:**

La función de migración busca clientes existentes por:
1. `national_id` (si existe)
2. `name` (case-insensitive)

⚠️ **Riesgo:** Si no hay cédula y el nombre es similar (typo), puede crear duplicado.

**Mitigación:**
- Verificar antes de migrar
- Normalizar nombres (UPPERCASE, trim)
- Master debe revisar manualmente

---

## 📝 Archivos del Sistema

### **Base de Datos:**
- `docs/sql-temp-client-import-system.sql` - Schema completo + Triggers + RLS

### **Backend:**
- `src/app/(app)/db/preliminary-actions.ts` - Server Actions

### **Frontend:**
- `src/components/db/PreliminaryClientsTab.tsx` - UI Component
- `src/components/db/DatabaseTabs.tsx` - Integración de pestaña
- `src/app/(app)/db/page.tsx` - Página principal

### **Documentación:**
- `docs/feature-preliminary-clients-system.md` - Este archivo

---

## 🚀 Instalación y Configuración

### **Paso 1: Ejecutar SQL en Supabase**

```sql
-- Copiar todo el contenido de:
docs/sql-temp-client-import-system.sql

-- Ejecutar en: Supabase Dashboard > SQL Editor
```

### **Paso 2: Verificar Instalación**

```sql
-- Ver tabla creada
SELECT * FROM temp_client_import LIMIT 1;

-- Ver triggers
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'temp_client_import';

-- Ver RLS policies
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'temp_client_import';
```

### **Paso 3: Probar en UI**

1. Ir a `/db`
2. Click pestaña "PRELIMINARES"
3. Debería mostrar "No hay clientes preliminares"
4. Todo funcionando ✓

---

## ✅ Checklist de Verificación

- [ ] SQL ejecutado en Supabase
- [ ] Tabla `temp_client_import` existe
- [ ] Triggers creados correctamente
- [ ] RLS policies activas
- [ ] Pestaña "PRELIMINARES" visible en `/db`
- [ ] Master puede ver la pestaña
- [ ] Broker solo ve sus preliminares
- [ ] Formulario de edición funciona
- [ ] Migración automática al completar datos
- [ ] Botón "Migrar" funciona manualmente
- [ ] Campos faltantes se muestran correctamente
- [ ] Toast de éxito al migrar

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Implementado - Requiere ejecutar SQL
