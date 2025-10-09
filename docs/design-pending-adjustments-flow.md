# 🔄 Sistema Completo de Pendientes Sin Identificar

## 📋 Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: BROKER SELECCIONA Y REPORTA                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Broker ve pendientes sin identificar                        │
│ 2. Selecciona múltiples (checkbox)                             │
│ 3. Ve cálculo en tiempo real:                                  │
│    - Monto Crudo (de importación)                              │
│    - % Override/Default del broker                             │
│    - Monto Bruto = Crudo × % Broker                           │
│    - TOTAL BRUTO (suma de todos)                              │
│ 4. Puede deseleccionar (vuelve a mostrar monto crudo)         │
│ 5. Click "Enviar Reporte" → Crea agrupación                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: MASTER REVISA REPORTES                                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. Master ve reportes agrupados por broker                     │
│ 2. Cada grupo muestra:                                         │
│    - Broker name                                                │
│    - Total Bruto                                               │
│    - Cantidad de items                                         │
│    - Expandible con detalle de cada item                       │
│ 3. Puede seleccionar múltiples reportes (checkbox)            │
│ 4. Opciones:                                                    │
│    a) ACEPTAR (individual o múltiple)                          │
│    b) RECHAZAR (individual o múltiple)                         │
│    c) EDITAR (solo individual)                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: MASTER PROCESA ACEPTADOS                               │
├─────────────────────────────────────────────────────────────────┤
│ Al ACEPTAR:                                                     │
│ 1. Crear registro en temp_client_import por cada item          │
│ 2. Cambiar status a "approved"                                 │
│ 3. Mostrar opciones:                                           │
│    A) PAGAR YA                                                  │
│    B) PAGAR EN SIGUIENTE QUINCENA                              │
└─────────────────────────────────────────────────────────────────┘
                     ↓                    ↓
         ┌───────────────────┐  ┌───────────────────┐
         │   OPCIÓN A:       │  │   OPCIÓN B:       │
         │   PAGAR YA        │  │   SIGUIENTE       │
         └───────────────────┘  └───────────────────┘
                     ↓                    ↓
    ┌────────────────────────────┐  ┌────────────────────────┐
    │ 1. Genera CSV bancario     │  │ 1. Status: "queued"    │
    │ 2. Descarga automática     │  │ 2. Espera borrador     │
    │ 3. Master va al banco      │  │ 3. Al crear quincena:  │
    │ 4. Click "Confirmar Pago"  │  │    - Suma al bruto     │
    │ 5. Status: "paid"          │  │    - Aparece en items  │
    │ 6. paid_date = now()       │  │    - Status: "paid"    │
    │ 7. → Ajustes Pagados       │  │ 4. → Ajustes Pagados   │
    └────────────────────────────┘  └────────────────────────┘
```

---

## 🎯 Componentes a Modificar/Crear

### 1. **BrokerPendingTab.tsx** (Modificar)
- ✅ Ya existe
- ❌ Agregar selección múltiple
- ❌ Agregar cálculo de comisiones
- ❌ Agregar botón "Enviar Reporte"
- ❌ Mostrar items seleccionados con totales

### 2. **AdjustmentsTab.tsx - Vista Master** (Modificar)
- ✅ Ya existe
- ❌ Modificar "Identificados" tab para mostrar reportes agrupados
- ❌ Agregar selección múltiple de reportes
- ❌ Agregar botones: Aceptar, Rechazar, Editar
- ❌ Mostrar detalles expandibles

### 3. **Nuevas Acciones en actions.ts**
```typescript
// Broker
actionSubmitClaimsReport(itemIds: string[]) → Enviar reporte

// Master
actionGetClaimsReports() → Obtener reportes agrupados
actionApproveClaimsReports(reportIds: string[], paymentType: 'now' | 'next')
actionRejectClaimsReports(reportIds: string[], reason?: string)
actionGenerateAdjustmentsCSV(reportIds: string[])
actionConfirmAdjustmentsPaid(reportIds: string[])
```

---

## 💾 Estructura de Datos

### **comm_item_claims** (Tabla Existente)
```sql
id                UUID PRIMARY KEY
comm_item_id      UUID REFERENCES comm_items(id) UNIQUE
broker_id         UUID REFERENCES brokers(id)
status            TEXT -- 'pending', 'approved', 'rejected', 'paid', 'queued'
created_at        TIMESTAMP
resolved_at       TIMESTAMP
resolved_by       UUID REFERENCES profiles(id)
payment_type      TEXT -- 'now', 'next_fortnight' (AGREGAR)
paid_date         TIMESTAMP (AGREGAR)
rejection_reason  TEXT (AGREGAR)
```

### **Campos a Agregar:**
```sql
ALTER TABLE comm_item_claims 
ADD COLUMN payment_type TEXT,
ADD COLUMN paid_date TIMESTAMP,
ADD COLUMN rejection_reason TEXT;
```

---

## 🧮 Cálculos de Comisión

### **Fórmula:**
```
Monto Crudo = comm_items.gross_amount (de importación)
% Broker = brokers.percent_override ?? brokers.default_percent
Monto Bruto = Monto Crudo × (% Broker / 100)
```

### **Ejemplo:**
```
Item 1: $1,000 (crudo) × 25% = $250 (bruto)
Item 2: $800 (crudo) × 25% = $200 (bruto)
Item 3: $1,200 (crudo) × 25% = $300 (bruto)
─────────────────────────────────────────────
TOTAL: $3,000 (crudo)      $750 (bruto) ← Este es el pago
```

---

## 📊 UI - Vista Broker

### **Pendientes Sin Identificar:**
```
┌──────────────────────────────────────────────────────────┐
│ PENDIENTES SIN IDENTIFICAR                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Items Seleccionados: 3                                  │
│ Total Crudo: $3,000.00                                  │
│ Total Bruto: $750.00 (25%)                              │
│                                                          │
│ [Enviar Reporte]  [Limpiar Selección]                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [ ] POL-001  Cliente A  ASSA    $1,000  →  $250        │
│ [✓] POL-002  Cliente B  MAPFRE  $800    →  $200        │
│ [✓] POL-003  Cliente C  FEDPA   $1,200  →  $300        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### **Mis Solicitudes (Ajustes Reportados):**
```
┌──────────────────────────────────────────────────────────┐
│ AJUSTES REPORTADOS                                       │
├──────────────────────────────────────────────────────────┤
│ ⏱️ Reporte #1 - 3 items - $750.00 - Esperando          │
│ ✅ Reporte #2 - 2 items - $500.00 - Aprobado (Pagar ya)│
│ ❌ Reporte #3 - 1 item  - $100.00 - Rechazado           │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 UI - Vista Master

### **Tab: Identificados (Reportes de Brokers):**
```
┌──────────────────────────────────────────────────────────────┐
│ REPORTES DE AJUSTES DE BROKERS                              │
├──────────────────────────────────────────────────────────────┤
│ Seleccionados: 2 reportes - Total: $1,250.00               │
│                                                              │
│ [Aceptar Seleccionados ▼]  [Rechazar]                      │
│  └─ Pagar Ya                                                │
│  └─ Siguiente Quincena                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [✓] 🔽 Juan Pérez - $750.00 - 3 items - Reporte #1         │
│      ├─ POL-001 Cliente A  $1,000 × 25% = $250             │
│      ├─ POL-002 Cliente B  $800 × 25% = $200               │
│      └─ POL-003 Cliente C  $1,200 × 25% = $300             │
│                                                              │
│ [✓] 🔽 María López - $500.00 - 2 items - Reporte #2        │
│      ├─ POL-004 Cliente D  $1,500 × 20% = $300             │
│      └─ POL-005 Cliente E  $1,000 × 20% = $200             │
│                                                              │
│ [ ] 🔽 Pedro García - $300.00 - 1 item - Reporte #3        │
│      └─ POL-006 Cliente F  $1,200 × 25% = $300             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### **Flujo de Acciones:**
```
1. Master selecciona reportes
2. Click "Aceptar Seleccionados" → Dropdown aparece
3. Opción A: "Pagar Ya"
   → Genera CSV inmediatamente
   → Descarga CSV
   → Botón "Confirmar Pago" aparece
   
4. Opción B: "Siguiente Quincena"
   → Cambia status a "queued"
   → Espera creación de borrador
   → Al crear quincena, suma al bruto
```

---

## 💳 CSV Bancario para Ajustes

### **Formato (Igual que Nueva Quincena):**
```csv
NOMBRE,TIPO,CEDULA,BANCO,CUENTA,MONTO,CORREO,DESCRIPCION
JUAN PEREZ,NATURAL,8-888-8888,BANCO GENERAL,04-99-99-999999,750.00,juan@example.com,AJUSTE COMISION
MARIA LOPEZ,JURIDICO,1234567-1-123456,BANCO GENERAL,04-88-88-888888,500.00,maria@example.com,AJUSTE COMISION
```

### **Validaciones:**
- ✅ Excluir montos $0.00
- ✅ Usar datos de `brokers` table
- ✅ account_type: 'NATURAL' o 'JURIDICO'
- ✅ bank_name, account_number, national_id

---

## 🔗 Integración con temp_client_import

### **Al Aceptar Reporte:**
```typescript
for (const item of claimItems) {
  // Crear registro preliminar
  await supabase.from('temp_client_import').insert({
    client_name: item.insured_name,
    policy_number: item.policy_number,
    insurer_id: item.insurer_id,
    broker_id: item.broker_id,
    source: 'adjustment',
    source_id: item.id,
    // Campos que faltan para completar:
    // - national_id (requerido)
    // - renewal_date (requerido)
  });
}
```

### **Beneficios:**
1. Broker ve en "Clientes Preliminares"
2. Aviso: "Faltan datos para completar registro"
3. Al completar → Migra a clients y policies
4. Cliente queda registrado para futuras comisiones

---

## 📅 Integración con Nueva Quincena

### **Al Crear Borrador (si hay ajustes "queued"):**
```typescript
// En actionCreateDraftFortnight():

// 1. Obtener ajustes pendientes de pagar en siguiente quincena
const { data: queuedAdjustments } = await supabase
  .from('comm_item_claims')
  .select(`
    *,
    comm_items(*)
  `)
  .eq('status', 'approved')
  .eq('payment_type', 'next_fortnight');

// 2. Sumar al bruto de cada broker
for (const adj of queuedAdjustments) {
  const brokerTotal = totals.find(t => t.broker_id === adj.broker_id);
  if (brokerTotal) {
    brokerTotal.gross_amount += calculateBrokerAmount(adj.comm_items.gross_amount);
  }
}

// 3. Marcar como incluidos en quincena
await supabase
  .from('comm_item_claims')
  .update({ 
    status: 'paid',
    paid_date: new Date(),
    fortnight_id: newFortnightId // AGREGAR ESTE CAMPO
  })
  .in('id', queuedAdjustments.map(a => a.id));
```

---

## 🗂️ Estados de comm_item_claims

| Status | Descripción | Vista Broker | Vista Master |
|--------|-------------|--------------|--------------|
| **pending** | Reporte enviado, esperando revisión | Ajustes Reportados (⏱️) | Identificados (Pendiente) |
| **approved** | Aprobado, elegir pago | Ajustes Reportados (✅) | Aceptados (Pagar ya/Siguiente) |
| **rejected** | Rechazado por Master | Ajustes Reportados (❌) | Rechazados |
| **queued** | Aprobado, espera siguiente quincena | Ajustes Reportados (📅) | En cola |
| **paid** | Pagado (CSV descargado + confirmado) | Ajustes Pagados (✅) | Pagados |

---

## 🔔 Notificaciones

### **Broker recibe notificación cuando:**
1. ✅ Master aprueba su reporte
2. ❌ Master rechaza su reporte (con razón)
3. 💰 Ajuste confirmado como pagado
4. ⚠️ Faltan datos en cliente preliminar

### **Master recibe notificación cuando:**
1. 📋 Broker envía nuevo reporte de ajustes
2. 📊 Hay ajustes en cola para siguiente quincena (al crear borrador)

---

## ✅ Checklist de Implementación

### **SQL:**
- [ ] Agregar campos a `comm_item_claims`:
  - `payment_type TEXT`
  - `paid_date TIMESTAMP`
  - `rejection_reason TEXT`
  - `fortnight_id UUID REFERENCES fortnights(id)`

### **Backend (actions.ts):**
- [ ] `actionSubmitClaimsReport(itemIds: string[])`
- [ ] `actionGetClaimsReports()` 
- [ ] `actionApproveClaimsReports(reportIds, paymentType)`
- [ ] `actionRejectClaimsReports(reportIds, reason)`
- [ ] `actionGenerateAdjustmentsCSV(reportIds)`
- [ ] `actionConfirmAdjustmentsPaid(reportIds)`
- [ ] Modificar `actionCreateDraftFortnight` para incluir queued adjustments

### **Frontend - Broker:**
- [ ] Modificar `BrokerPendingTab.tsx`:
  - Selección múltiple (checkboxes)
  - Cálculo de comisiones en tiempo real
  - Panel de totales
  - Botón "Enviar Reporte"
- [ ] Actualizar "Ajustes Reportados" con nuevos estados

### **Frontend - Master:**
- [ ] Modificar `AdjustmentsTab.tsx` tab "Identificados":
  - Mostrar reportes agrupados por broker
  - Selección múltiple
  - Detalles expandibles
  - Botones: Aceptar, Rechazar
  - Dropdown: Pagar ya / Siguiente quincena
- [ ] Agregar generación y descarga de CSV
- [ ] Agregar botón "Confirmar Pago"

### **Componentes Nuevos:**
- [ ] `AdjustmentsReportCard.tsx` - Card de reporte agrupado
- [ ] `AdjustmentsBatchActions.tsx` - Acciones batch Master
- [ ] `AdjustmentsPaidTab.tsx` - Vista ajustes pagados mejorada

### **Utilities:**
- [ ] `calculateBrokerCommission(grossAmount, broker)` - Cálculo de %
- [ ] `generateAdjustmentsCSV(reports)` - Generar CSV bancario
- [ ] `groupClaimsByBroker(claims)` - Agrupar por broker

---

## 🚀 Orden de Implementación

1. **SQL** - Agregar campos necesarios
2. **Utils** - Funciones de cálculo
3. **Actions** - Backend logic
4. **BrokerPendingTab** - Vista broker
5. **AdjustmentsTab** - Vista master
6. **CSV Generator** - Generación bancaria
7. **Integration** - temp_client_import + fortnights
8. **Testing** - Verificación completa

---

**Diseño por:** Portal Líderes en Seguros  
**Fecha:** 2025-10-09  
**Estado:** 📋 Diseño Completado - Listo para Implementación
