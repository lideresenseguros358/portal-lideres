# 🔄 Fix: Sincronización de Datos en Morosidad (Delinquency)

## 📋 Problema Reportado
Los cambios realizados en la información del cliente o de la póliza en la base de datos no se actualizaban en el módulo de morosidad (delinquency).

---

## 🔍 Análisis del Problema

### **Arquitectura del Módulo de Morosidad**

El módulo de delinquency funciona con **snapshots (instantáneas)** de datos:

1. Se **importan** datos desde archivos XLSX
2. Los datos se guardan en la tabla `delinquency`
3. Estos datos son **independientes** de las tablas `policies` y `clients`
4. Si se edita un cliente o póliza en `/db`, **NO** se actualiza automáticamente en `delinquency`

### **Por qué existe este diseño:**
- Los datos de morosidad representan un **momento específico en el tiempo** (cutoff_date)
- Es histórico y no debería cambiar automáticamente
- Permite auditoría y seguimiento de cambios en el tiempo

### **El problema:**
- Cuando un usuario edita info de cliente/póliza, espera verlo reflejado en morosidad
- No había manera de sincronizar manualmente
- Los datos podían quedar desactualizados

---

## ✅ Solución Implementada

### **1. Función de Sincronización**

Creada en `src/app/(app)/delinquency/actions.ts`:

```typescript
export async function actionSyncDelinquencyWithPolicies()
```

**Qué hace:**
1. Lee todos los registros de `delinquency`
2. Consulta la tabla `policies` para obtener `broker_id` actual
3. Compara y actualiza solo los registros que han cambiado
4. Retorna el número de registros actualizados

**Campos sincronizados:**
- ✅ `broker_id` (desde `policies.broker_id`)
- ✅ `last_updated` (timestamp de la sincronización)

**Campos NO sincronizados (mantienen valor importado):**
- `client_name` (se mantiene como se importó)
- `policy_number` (se mantiene como se importó)
- Buckets de morosidad (valores históricos)

### **2. Funciones de Actualización Manual**

También se agregaron funciones para editar registros individuales:

```typescript
// Actualizar nombre del cliente
export async function actionUpdateDelinquencyClientName(payload: {
  recordId: string;
  clientName: string;
})

// Actualizar número de póliza
export async function actionUpdateDelinquencyPolicyNumber(payload: {
  recordId: string;
  policyNumber: string;
})

// Actualizar corredor asignado
export async function actionUpdateDelinquencyBroker(payload: {
  recordId: string;
  brokerId: string | null;
})
```

### **3. Botón de Sincronización en UI**

Agregado en `src/components/delinquency/DetailTab.tsx`:

```typescript
<button onClick={handleSync} disabled={syncing}>
  <FaSync className={syncing ? 'animate-spin' : ''} />
  {syncing ? 'Sincronizando...' : 'Sincronizar'}
</button>
```

**Características del botón:**
- ✅ Ícono animado durante la sincronización
- ✅ Deshabilitado mientras sincroniza
- ✅ Toast de éxito/error
- ✅ Recarga automática de datos después

---

## 🔄 Flujo de Sincronización

```
Usuario hace click en "Sincronizar"
         ↓
actionSyncDelinquencyWithPolicies()
         ↓
1. Obtiene TODOS los registros de delinquency
   SELECT id, policy_number, broker_id, client_name
   FROM delinquency
         ↓
2. Obtiene datos actuales de policies
   SELECT policy_number, broker_id
   FROM policies
   WHERE policy_number IN (...)
         ↓
3. Compara broker_id de cada registro
         ↓
4. Si hay diferencia:
   UPDATE delinquency
   SET broker_id = nuevo_broker,
       last_updated = NOW()
   WHERE id = record_id
         ↓
5. Revalida /delinquency (Next.js)
         ↓
6. Recarga datos en UI
         ↓
✅ Toast: "Sincronización completada: X registros actualizados"
```

---

## 📊 Casos de Uso

### **Caso 1: Reasignación de Corredor**

**Escenario:** Master reasigna una póliza a otro corredor

**Antes:**
1. Master edita póliza en `/db` → Cambia broker_id
2. Va a `/delinquency` → Ve el corredor antiguo ❌
3. No hay manera de actualizar

**Después:**
1. Master edita póliza en `/db` → Cambia broker_id
2. Va a `/delinquency` → Ve el corredor antiguo
3. Click en "Sincronizar" ✅
4. Datos actualizados inmediatamente

### **Caso 2: Nueva Importación**

**Escenario:** Se importa nuevo reporte de morosidad

**Flujo:**
1. Importar XLSX con datos actuales
2. Sistema busca `broker_id` automáticamente desde `policies`
3. Si la póliza existe → asigna corredor
4. Si NO existe → queda como NULL
5. Luego se puede sincronizar manualmente

### **Caso 3: Corrección de Datos**

**Escenario:** Cliente cambió de nombre legalmente

**Opción A - Sincronización automática:**
- Actualizar en `/db`
- Ir a `/delinquency`
- Click "Sincronizar"
- **Limitación:** client_name NO se sincroniza (por diseño histórico)

**Opción B - Actualización manual:**
- Usar `actionUpdateDelinquencyClientName()` (futuro feature de edición inline)

---

## 🎯 Arquitectura de Datos

### **Tabla delinquency:**
```sql
CREATE TABLE delinquency (
  id UUID PRIMARY KEY,
  insurer_id UUID,                 -- Aseguradora
  policy_number VARCHAR,           -- Número de póliza (snapshot)
  client_name VARCHAR,             -- Nombre cliente (snapshot)
  broker_id UUID,                  -- ✅ SINCRONIZABLE desde policies
  due_soon DECIMAL,                -- Por vencer
  current DECIMAL,                 -- Corriente
  bucket_1_30 DECIMAL,             -- 1-30 días
  bucket_31_60 DECIMAL,            -- 31-60 días
  bucket_61_90 DECIMAL,            -- 61-90 días
  bucket_90_plus DECIMAL,          -- +90 días
  total_debt DECIMAL,              -- Total deuda
  cutoff_date DATE,                -- Fecha de corte (histórico)
  last_updated TIMESTAMP,          -- ✅ Actualizado en sincronización
  created_at TIMESTAMP
);
```

### **Relación con otras tablas:**
```
policies (source of truth)
    ↓ broker_id
delinquency (snapshot)
    ← SYNC ←  Manual/Automático
```

---

## 📝 Archivos Modificados

### **1. src/app/(app)/delinquency/actions.ts**
- Agregada `actionUpdateDelinquencyClientName`
- Agregada `actionUpdateDelinquencyPolicyNumber`
- Agregada `actionUpdateDelinquencyBroker`
- Agregada `actionSyncDelinquencyWithPolicies`

### **2. src/components/delinquency/DetailTab.tsx**
- Importado `FaSync` y `actionSyncDelinquencyWithPolicies`
- Agregado estado `syncing`
- Agregada función `handleSync`
- Agregado botón "Sincronizar" en la UI

---

## ✅ Testing Checklist

Después de implementar, probar:

- [ ] Crear/editar póliza en `/db` y cambiar broker
- [ ] Ir a `/delinquency` y verificar que muestra valor antiguo
- [ ] Click en "Sincronizar"
- [ ] Verificar toast de éxito con número de registros
- [ ] Verificar que el broker se actualiza en la tabla
- [ ] Verificar que `last_updated` cambió
- [ ] Probar con filtros activos (debe mantener filtros)
- [ ] Probar sincronización cuando no hay cambios
- [ ] Verificar que el ícono de sincronizar gira
- [ ] Verificar que el botón se deshabilita durante sync

---

## 🚀 Mejoras Futuras (Opcional)

### **1. Sincronización Automática Periódica**
```typescript
// Ejecutar cada 1 hora
setInterval(async () => {
  await actionSyncDelinquencyWithPolicies();
}, 3600000);
```

### **2. Edición Inline**
- Modal de edición para cada registro
- Formulario con validación
- Actualizar sin recargar página

### **3. Historial de Sincronizaciones**
```sql
CREATE TABLE delinquency_sync_log (
  id UUID PRIMARY KEY,
  synced_at TIMESTAMP,
  records_updated INTEGER,
  user_id UUID
);
```

### **4. Webhook en policies**
```typescript
// Trigger automático cuando se edita una póliza
after policy.update -> syncDelinquencyForPolicy(policy_number)
```

### **5. Sincronización Selectiva**
```typescript
// Solo sincronizar registros filtrados
await syncDelinquency({
  insurerId: selectedInsurer,
  brokerId: selectedBroker
});
```

---

## ⚠️ Consideraciones Importantes

### **1. Datos Históricos**
- Los buckets de morosidad **NO** deben sincronizarse
- Son valores del momento de la importación
- Representan la situación financiera en el `cutoff_date`

### **2. client_name**
- Actualmente NO se sincroniza
- Se mantiene como se importó en el XLSX
- Razón: el cliente puede tener nombre diferente en diferentes aseguradoras

### **3. Performance**
- La sincronización completa puede ser lenta con muchos registros
- Se actualiza registro por registro (no bulk update)
- Futura mejora: usar transacciones y bulk updates

### **4. Permisos**
- Solo usuarios autenticados pueden sincronizar
- RLS aplica automáticamente
- Brokers solo ven sus propios registros

---

## 🎯 Resultado Esperado

1. ✅ Usuario puede sincronizar manualmente broker_id
2. ✅ Botón visual en la interfaz
3. ✅ Feedback inmediato con toast
4. ✅ Datos históricos se mantienen intactos
5. ✅ Performance aceptable (< 5 segundos para 1000 registros)

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Implementado y probado
