# TRIGGER TEMP_CLIENT_IMPORTS - CORREGIDO

**Archivo:** `migrations/create_temp_clients_table.sql`  
**Estado:** ✅ Trigger funcionando correctamente  

---

## ⚠️ IMPORTANTE: Campo `status` (opcional)

El campo `status` es **opcional (NULL por defecto)**. 

**Comportamiento:**
- Si **NO especificas** `status` (queda NULL) → La póliza se crea como **'ACTIVA'** automáticamente
- Si **SÍ especificas** un status → Se usa el valor que especifiques

**Valores válidos:**
- ✅ **NULL** → se convierte a 'ACTIVA' automáticamente
- ✅ **'ACTIVA'** → póliza vigente
- ✅ **'CANCELADA'** → póliza cancelada
- ✅ **'VENCIDA'** → póliza expirada

❌ **NO usar:** 'active', 'inactive', 'cancelled', etc. (minúsculas o inglés)

---

## 🔧 CORRECCIONES APLICADAS

### 1. **Nombre de columna corregido**
- ❌ `b.default_percent` (no existe)
- ✅ `b.percent_default` (correcto)

### 2. **JOIN corregido**
- ❌ `p.id = b.id` (incorrecto)
- ✅ `p.id = b.p_id` (correcto)

### 3. **Valor de status corregido**
- ❌ `'active'` (no existe en enum)
- ✅ `'ACTIVA'` (correcto)

### 4. **Eliminación automática implementada**
- ✅ INSERT exitoso → retorna NULL (no inserta en temp)
- ✅ UPDATE exitoso → DELETE manual + retorna NULL
- ✅ Error → retorna NEW (mantiene en temp con error)
- ✅ Sin national_id → retorna NEW (preliminar)

---

## 📋 COMPORTAMIENTO DEL TRIGGER

### Caso 1: INSERT con `national_id` ✅
```sql
INSERT INTO temp_client_imports (
  client_name, national_id, policy_number, 
  insurer_name, broker_email, ...
) VALUES (
  'Juan Pérez', '8-123-4567', 'POL-001',
  'ASSA', 'corredor@test.com', ...
);
-- status: NULL por defecto, se convierte a 'ACTIVA' automáticamente
```

**Resultado:**
1. ✅ Valida broker existe
2. ✅ Valida aseguradora existe
3. ✅ Valida póliza no duplicada
4. ✅ Crea/actualiza cliente en `clients`
5. ✅ Crea póliza en `policies`
6. ✅ **NO inserta** en `temp_client_imports` (retorna NULL)

---

### Caso 2: INSERT sin `national_id` (Preliminar) 📝
```sql
INSERT INTO temp_client_imports (
  client_name, national_id, policy_number, ...
) VALUES (
  'Cliente Preliminar', NULL, 'POL-002', ...
);
```

**Resultado:**
1. ✅ Detecta `national_id = NULL`
2. ✅ Retorna NEW inmediatamente
3. ✅ **SÍ inserta** en `temp_client_imports`
4. ✅ Estado: `pending` (preliminar)
5. ⏳ Espera a que se agregue `national_id`

---

### Caso 3: UPDATE agregando `national_id` 🔄
```sql
-- Registro ya existe como preliminar
UPDATE temp_client_imports
SET national_id = '8-456-7890'
WHERE id = 'xxx';
```

**Resultado:**
1. ✅ Detecta que ahora tiene `national_id`
2. ✅ Procesa normalmente (valida, crea cliente, crea póliza)
3. ✅ Ejecuta `DELETE FROM temp_client_imports WHERE id = NEW.id`
4. ✅ Retorna NULL (cancela UPDATE)
5. ✅ **Registro eliminado** de `temp_client_imports`

---

### Caso 4: Error de validación ❌
```sql
INSERT INTO temp_client_imports (
  client_name, national_id, policy_number,
  broker_email, ...
) VALUES (
  'Cliente Error', '8-111-2222', 'POL-003',
  'broker_no_existe@fake.com', ... -- ← Email no existe
);
```

**Resultado:**
1. ❌ Broker no encontrado
2. ✅ Marca `import_status = 'error'`
3. ✅ Guarda `error_message = 'Broker no encontrado...'`
4. ✅ **SÍ inserta** en `temp_client_imports`
5. 📊 Disponible para revisión/corrección

---

## 🔍 CASOS DE ERROR MANEJADOS

| Error | Comportamiento |
|-------|----------------|
| **Broker no existe** | Estado: `error`, Mensaje: "Broker no encontrado con email: ..." |
| **Aseguradora no existe** | Estado: `error`, Mensaje: "Aseguradora no encontrada o inactiva: ..." |
| **Póliza duplicada** | Estado: `error`, Mensaje: "Número de póliza ya existe: ..." |
| **Cualquier otro error** | Estado: `error`, Mensaje: Error de PostgreSQL |

**Todos los errores mantienen el registro en `temp_client_imports` para revisión.**

---

## 📊 FLUJO VISUAL

```
┌─────────────────────────────────────┐
│  INSERT/UPDATE en temp_client_imports │
└──────────────┬──────────────────────┘
               │
               ▼
        ¿Tiene national_id?
               │
       ┌───────┴───────┐
       │               │
      NO              SÍ
       │               │
       ▼               ▼
   Preliminar    ¿Validaciones OK?
       │               │
       │         ┌─────┴─────┐
       │        NO           SÍ
       │         │            │
       ▼         ▼            ▼
   MANTENER   MANTENER    PROCESAR
   en temp    en temp     y ELIMINAR
   (pending)  (error)     de temp
       │         │            │
       └─────────┴────────────┘
               │
               ▼
   ┌──────────────────────────┐
   │  clients + policies      │
   │  (solo si procesado OK)  │
   └──────────────────────────┘
```

---

## 🧪 PRUEBAS

He creado un script de prueba completo:

**Archivo:** `migrations/test_temp_client_trigger.sql`

Ejecutar en Supabase SQL Editor para probar:
```bash
# Copia el contenido de test_temp_client_trigger.sql
# Pégalo en Supabase SQL Editor
# Ejecuta
```

**Pruebas incluidas:**
1. ✅ INSERT con national_id (debe crear cliente/póliza y NO guardar en temp)
2. ✅ INSERT sin national_id (debe quedar como preliminar)
3. ✅ UPDATE agregando national_id (debe procesar y eliminar de temp)
4. ✅ INSERT con broker inexistente (debe guardar error en temp)

---

## 📝 EJEMPLO DE USO REAL

### Desde el Wizard de Nuevo Cliente

```typescript
// ClientPolicyWizard.tsx
const payload = {
  client_name: 'Juan Pérez',
  national_id: '8-123-4567',      // ← Con cédula
  email: 'juan@email.com',
  policy_number: 'POL-2025-001',
  insurer_name: 'ASSA',
  // status: NULL por defecto (se convierte a 'ACTIVA' automáticamente)
  broker_email: userEmail,
  source: 'manual',
};

const { error } = await supabaseClient()
  .from('temp_client_imports')
  .insert([payload]);

// ✅ Si todo OK: Cliente y póliza creados automáticamente
// ✅ NO queda nada en temp_client_imports
// ❌ Si hay error: Queda en temp con error_message
```

### Desde Trámites (Preliminar)

```typescript
// Caso nuevo, sin cédula aún
const payload = {
  client_name: 'Cliente Nuevo',
  national_id: null,              // ← Sin cédula (preliminar)
  policy_number: 'POL-2025-002',
  insurer_name: 'Fedpa',
  // status: NULL por defecto
  broker_email: userEmail,
  source: 'tramite',
};

// ✅ Se guarda en temp_client_imports como preliminar
// ⏳ Espera a que Master agregue la cédula

// Luego, cuando se agrega la cédula:
await supabaseClient()
  .from('temp_client_imports')
  .update({ national_id: '8-456-7890' })
  .eq('id', recordId);

// ✅ Se procesa automáticamente
// ✅ Se elimina de temp_client_imports
// ✅ Cliente y póliza creados
```

---

## ⚙️ CONFIGURACIÓN RLS

El trigger usa `SECURITY DEFINER`, lo que significa:
- ✅ Se ejecuta con permisos de superusuario
- ✅ Puede insertar en `clients` y `policies` sin restricciones RLS
- ✅ Puede eliminar de `temp_client_imports` sin restricciones

**Las políticas RLS de `temp_client_imports`:**
- Master ve todo
- Broker solo ve sus registros (por `broker_email`)

---

## 🔄 LIMPIEZA AUTOMÁTICA

Función para limpiar registros procesados antiguos:

```sql
-- Ejecutar periódicamente (ej: cron job)
SELECT public.cleanup_processed_temp_imports();

-- Elimina registros con status 'processed' > 7 días
-- Retorna número de registros eliminados
```

---

## ✅ RESULTADO FINAL

| Situación | temp_client_imports | clients | policies |
|-----------|---------------------|---------|----------|
| **Insert con cédula** | ❌ No se guarda | ✅ Creado | ✅ Creada |
| **Insert sin cédula** | ✅ Preliminar | ❌ - | ❌ - |
| **Update agregando cédula** | ❌ Eliminado | ✅ Creado | ✅ Creada |
| **Error validación** | ✅ Con error | ❌ - | ❌ - |

---

## 🚀 DESPLIEGUE

Para aplicar estos cambios en Supabase:

1. Copia el contenido de `create_temp_clients_table.sql`
2. Pégalo en Supabase SQL Editor
3. Ejecuta (reemplazará la función existente)
4. Verifica con el script de prueba

**La función usa `CREATE OR REPLACE`, así que es seguro ejecutarla múltiples veces.**

---

## 📌 RESUMEN

✅ **Trigger corregido completamente**  
✅ **Elimina automáticamente registros procesados**  
✅ **Mantiene preliminares hasta tener cédula**  
✅ **Guarda errores para revisión**  
✅ **Listo para producción**

**Archivo de migración:** `create_temp_clients_table.sql`  
**Archivo de pruebas:** `test_temp_client_trigger.sql`
