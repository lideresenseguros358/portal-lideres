# FLUJO COMPLETO DE AJUSTES - SISTEMA DE COMISIONES

## 📋 RESUMEN DEL FLUJO

El sistema de ajustes maneja comisiones no identificadas a través de 3 etapas principales:
1. **Sin Identificar** - Comisiones pendientes de asignar
2. **Identificados** - Reportes aprobados pendientes de pago
3. **Pagados** - Historial de ajustes pagados

---

## 🔄 ETAPA 1: SIN IDENTIFICAR

### Para MASTER:
**Acciones disponibles:**
- ✅ **Asignar Corredor** - Asigna directamente la comisión a un corredor
- ⏰ **Auto-asignación (>90 días)** - Items mayores a 90 días se asignan automáticamente a `contacto@lideresenseguros.com`

**Proceso:**
1. Master ve lista de comisiones sin identificar
2. Selecciona la póliza
3. Click en "Asignar Corredor"
4. Selecciona el corredor del dropdown
5. Sistema automáticamente:
   - Asigna el `broker_id` al `pending_item`
   - Migra a `comm_items`
   - Mueve el item fuera de "Sin Identificar"

### Para BROKER:
**Acciones disponibles:**
- ✅ **Marcar como Mío** - Marca la comisión como suya

**Proceso:**
1. Broker ve lista de comisiones sin identificar
2. Selecciona items con checkbox
3. Ve cálculo automático con su porcentaje de comisión
4. Click en "Enviar Reporte"
5. Sistema crea:
   - Registro en `comm_item_claims` con `status='pending'`
   - Agrupa múltiples items en un solo reporte
6. Reporte aparece en "Identificados" para revisión de Master

**Nota:** No hay opciones de "Pagar Ahora" o "Próxima Quincena" en esta etapa.

---

## 💰 ETAPA 2: IDENTIFICADOS (Claims/Reportes)

### Solo para MASTER:

**Vista:**
- Lista de reportes agrupados por corredor
- Muestra total bruto y total comisión por reporte

**Acciones disponibles:**

#### 1. **Aceptar Seleccionados**
Dropdown con 2 opciones:

##### A) **Pagar Ya**
```
Flujo:
1. Master selecciona reportes
2. Click "Aceptar Seleccionados" → "Pagar Ya"
3. Sistema aprueba claims (status='approved')
4. Muestra botón "Descargar ACH"
5. Master descarga archivo ACH (Banco General)
6. Master realiza transferencias en banco
7. Master regresa y click "Confirmar Pagado"
8. Sistema:
   - Marca claims como paid (status='paid')
   - Crea registros en temp_client_import (preliminar)
   - Envía notificación a cada broker
   - Notificación incluye link a /db?tab=preliminary
```

##### B) **Pagar en Siguiente Quincena**
```
Flujo:
1. Master selecciona reportes
2. Click "Aceptar Seleccionados" → "Pagar en Siguiente Quincena"
3. Sistema marca claims como queued_next_fortnight
4. Al crear siguiente quincena:
   - Se incluyen automáticamente estos ajustes
   - Se marcan como pagados en esa quincena
   - Se ejecuta mismo flujo de confirmación
```

#### 2. **Rechazar**
```
Flujo:
1. Master selecciona reportes
2. Click "Rechazar"
3. Ingresa razón de rechazo (opcional)
4. Sistema marca claims como rejected
5. Items regresan a "Sin Identificar"
```

---

## 📊 ETAPA 3: PAGADOS

### Registro Automático en Preliminar:

Cuando Master confirma pago (`actionConfirmAdjustmentsPaid`):

```typescript
Para cada claim pagado:
1. Extrae información del cliente:
   - client_name (insured_name)
   - policy_number
   - insurer_id
   - broker_id

2. Crea registro en temp_client_import:
   {
     client_name: string,
     policy_number: string,
     insurer_id: uuid,
     broker_id: uuid,
     renewal_date: null,  // Broker debe completar
     migrated: false,
     source: 'adjustments_paid',
     notes: 'Cliente registrado desde ajuste pagado...'
   }

3. Agrupa por póliza única para evitar duplicados

4. Crea notificación para cada broker:
   {
     type: 'adjustment_paid',
     title: 'Ajustes Pagados - Acción Requerida',
     message: 'Se han pagado X ajuste(s) con Y cliente(s)...',
     link: '/db?tab=preliminary'
   }
```

### Vista de Reportes Pagados:

**Funcionalidades:**
- ✅ Lista de ajustes pagados agrupados
- ✅ Descargar PDF del reporte
- ✅ Descargar Excel del reporte
- ✅ Ver detalle de clientes incluidos

**Estructura del Reporte:**
```
Reporte de Ajustes Pagados
━━━━━━━━━━━━━━━━━━━━━━━━
Corredor: [Nombre]
Fecha de Pago: [Fecha]
Total Items: X
Total Comisión: $XXX.XX

Detalle por Cliente:
┌─────────────┬────────────────┬──────────┬─────────┐
│ Póliza      │ Cliente        │ Bruto    │ Neto    │
├─────────────┼────────────────┼──────────┼─────────┤
│ POL-001     │ Cliente A      │ $100.00  │ $80.00  │
│ POL-002     │ Cliente B      │ $150.00  │ $120.00 │
└─────────────┴────────────────┴──────────┴─────────┘
```

---

## 🔔 NOTIFICACIONES A BROKERS

### Cuándo se envían:

1. **Ajuste Pagado** (automático al confirmar pago)
```json
{
  "type": "adjustment_paid",
  "title": "Ajustes Pagados - Acción Requerida",
  "message": "Se han pagado 5 ajuste(s) con 3 cliente(s). Por favor completa la información en Base de Datos Preliminar.",
  "link": "/db?tab=preliminary",
  "read": false
}
```

### Qué debe hacer el Broker:

1. Click en notificación → Va a `/db?tab=preliminary`
2. Ve lista de clientes registrados desde ajustes
3. Para cada cliente, completa:
   - ✅ Nombre del cliente (si falta)
   - ✅ Número de póliza (si falta)
   - ✅ Aseguradora (si falta)
   - ✅ **Fecha de renovación** (REQUERIDA)
   - ✅ Información adicional

4. Click "Migrar a Base de Datos Formal"
5. Cliente se registra oficialmente en sistema

---

## 🗄️ BASE DE DATOS PRELIMINAR

### Tabla: `temp_client_import`

**Campos:**
```sql
id: uuid
client_name: text
policy_number: text
insurer_id: uuid (FK → insurers)
broker_id: uuid (FK → brokers)
renewal_date: date
migrated: boolean (default: false)
source: text ('adjustments_paid', 'manual', etc.)
notes: text
created_at: timestamptz
```

**Flujo de Migración:**
```
1. Broker completa información faltante
2. Sistema valida campos requeridos:
   ✓ client_name
   ✓ policy_number
   ✓ insurer_id
   ✓ renewal_date

3. Si está completo:
   - Crea registro en tabla clients
   - Crea registro en tabla policies
   - Marca temp_client_import.migrated = true

4. Si falta información:
   - Muestra mensaje con campos faltantes
   - Mantiene en preliminar
```

---

## 📱 INTERFAZ DE USUARIO

### Tabs de Ajustes:

```
┌─────────────────────────────────────────┐
│  [Sin Identificar] [Identificados]      │
│  [Retenidos]       [Pagados]            │
└─────────────────────────────────────────┘
```

**Sin Identificar:**
- Header: "X pólizas pendientes de asignar"
- Vista: Cards responsivas (mobile-first)
- Acciones: 
  - Master: Botón "Asignar Corredor" (gradiente azul)
  - Broker: Botón "Marcar Mío" (gradiente verde)

**Identificados:**
- Header: "X reportes pendientes de aprobación"
- Vista: Cards agrupados por broker
- Acciones:
  - Botón "Aceptar Seleccionados" (verde)
  - Dropdown: Pagar Ya / Próxima Quincena
  - Botón "Rechazar" (rojo)
  - Botón "Descargar ACH" (azul)
  - Botón "Confirmar Pagado" (verde)

**Pagados:**
- Header: "Historial de ajustes pagados"
- Vista: Cards con reportes completos
- Acciones:
  - Botón "Descargar PDF"
  - Botón "Descargar Excel"

---

## 🎨 BRANDING

### Colores Corporativos:

**Azul Marino (Primario):**
```css
from-[#010139] to-[#020270]
```
Usado en:
- Botón "Asignar Corredor" (Master)
- Botón "Descargar ACH"
- Headers principales

**Verde (Secundario):**
```css
from-[#8AAA19] to-[#7a9617]
```
Usado en:
- Botón "Marcar Mío" (Broker)
- Botón "Enviar Reporte" (Broker)
- Botón "Aceptar Seleccionados" (Master)

**Verde Oscuro (Confirmación):**
```css
from-green-600 to-green-700
```
Usado en:
- Botón "Confirmar Pagado"

**Rojo (Destructivo):**
```css
variant="destructive"
```
Usado en:
- Botón "Rechazar"

---

## ⚙️ CÁLCULOS Y LÓGICA

### Suma Correcta (Respetando Signos):

**Problema anterior:**
```typescript
// ❌ INCORRECTO
group.total_amount += Math.abs(item.gross_amount);
// Resultado: 65.35 + 65.36 = 130.71 (MALO)
```

**Solución actual:**
```typescript
// ✅ CORRECTO
group.total_amount += (Number(item.gross_amount) || 0);
// Resultado: 65.35 + (-65.36) = -0.01 (CORRECTO)
```

**Aplicado en:**
- `AdjustmentsTab.tsx` línea 105
- `BrokerPendingTab.tsx` líneas 89, 321

### Auto-asignación (>90 días):

```typescript
// Verificar items antiguos
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

// Buscar items pendientes sin asignar mayores a 90 días
const oldItems = await supabase
  .from('pending_items')
  .select('*')
  .eq('status', 'open')
  .is('assigned_broker_id', null)
  .lt('created_at', ninetyDaysAgo.toISOString());

// Asignar a broker de oficina
await supabase
  .from('pending_items')
  .update({ assigned_broker_id: officeBrokerId })
  .in('id', oldItemIds);

// Migrar automáticamente
await actionMigratePendingToCommItems(oldItemIds);
```

---

## 📁 ARCHIVOS MODIFICADOS

### Backend (Actions):
```
src/app/(app)/commissions/actions.ts
├─ actionGetPendingItems()
├─ actionClaimPendingItem()
├─ actionAutoAssignOldPendingItems()  ← NUEVO
├─ actionResolvePendingGroups()
├─ actionApproveClaimsReports()
├─ actionConfirmAdjustmentsPaid()  ← MODIFICADO
└─ actionGetClaimsReports()
```

### Frontend (Components):
```
src/components/commissions/
├─ AdjustmentsTab.tsx  ← REDISEÑADO
├─ MasterClaimsView.tsx  ← MEJORADO
├─ AssignBrokerDropdown.tsx  ← BRANDING
└─ broker/
   └─ BrokerPendingTab.tsx  ← ACTUALIZADO
```

### Utilidades:
```
scripts/
└─ test-auto-assign-old-items.mjs  ← NUEVO
```

---

## ✅ CHECKLIST DE FUNCIONALIDADES

### Sin Identificar:
- [x] Solo acción de asignar corredor (Master)
- [x] Botón "Marcar como Mío" (Broker)
- [x] Auto-asignación >90 días a oficina
- [x] Suma correcta respetando signos
- [x] UI mobile-first responsive
- [x] Branding corporativo aplicado
- [x] Eliminadas opciones de pago

### Identificados:
- [x] Aceptar con "Pagar Ya"
- [x] Aceptar con "Próxima Quincena"
- [x] Rechazar reportes
- [x] Descargar ACH (Banco General)
- [x] Confirmar pagado
- [x] Registro en preliminar al pagar
- [x] Notificación a brokers

### Pagados:
- [x] Vista de reportes pagados
- [x] Descargar PDF
- [x] Descargar Excel
- [x] Registro automático en preliminar
- [x] Notificación con link a BD

### Base de Datos Preliminar:
- [x] Recibe clientes de ajustes pagados
- [x] Broker completa información
- [x] Validación de campos requeridos
- [x] Migración a BD formal
- [x] Notificaciones activas

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Verificar que tabla `notifications` existe en BD
2. ✅ Verificar que RPC `confirm_claims_paid` existe
3. ✅ Probar flujo completo end-to-end
4. ✅ Validar permisos de brokers en BD preliminar
5. ✅ Documentar formato ACH Banco General

---

## 📞 SOPORTE

Para dudas o problemas con el flujo de ajustes:
1. Revisar este documento
2. Ejecutar script de prueba: `node scripts/test-auto-assign-old-items.mjs`
3. Verificar logs en consola de browser (F12)
4. Revisar notificaciones en sistema

---

**Última actualización:** 2025-01-21  
**Versión:** 2.0 - Flujo Completo Implementado
