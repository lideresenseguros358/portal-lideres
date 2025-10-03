# 📋 FLUJO COMPLETO DE CHEQUES - ESPECIFICACIÓN TÉCNICA

## 🎯 OBJETIVO
Sistema completo de gestión de pagos y transferencias bancarias con dos pestañas principales:
1. **Historial de Banco** - Todas las transferencias reflejadas en el banco
2. **Pagos Pendientes** - Gestión de pagos que requieren procesamiento

---

## 📊 PESTAÑA 1: HISTORIAL DE BANCO

### Funcionalidad Principal
- Mostrar TODAS las transferencias del banco
- Importar archivos CSV del banco
- Depurar duplicados al importar (mantener registros viejos, agregar solo nuevos)
- Mostrar transferencias con su estado: disponible, parcialmente usado, agotado, pagado
- Expandir fila para ver detalles de pagos asociados

### Campos de Transferencia
```typescript
interface BankTransfer {
  id: string;
  date: Date;
  reference_number: string;  // Referencia bancaria
  transaction_code: string;  // Código de transacción
  description: string;
  amount: number;            // Monto total de la transferencia
  used_amount: number;       // Monto ya utilizado
  remaining_amount: number;  // Monto restante (amount - used_amount)
  status: 'available' | 'partial' | 'exhausted' | 'paid';
  payment_details: PaymentDetail[];  // Detalles de pagos asociados
}

interface PaymentDetail {
  id: string;
  payment_id: string;        // ID del pago pendiente
  policy_number?: string;
  insurer_name?: string;
  client_name?: string;
  purpose: string;           // 'poliza' | 'devolucion' | 'otro'
  amount_used: number;       // Cuánto de esta transferencia se usó
  paid_at: Date;
}
```

### Mapeo de Columnas CSV Banco General
Según el pantallazo proporcionado:
- **Fecha** → `date`
- **Referencia** → `reference_number` (ej: 1132498389, 1135480908)
- **Transacción** → `transaction_code` (ej: 2627)
- **Descripción** → `description` (ej: "BANCA MOVIL TRANSFERENCIA DE RICARDO RATCLIFF VALDES...")
- **Débito** → ignorar (siempre vacío en transferencias recibidas)
- **Crédito** → `amount` (ej: $115.00, $110.30)
- **Saldo total** → ignorar (no necesario)

### Lógica de Importación
```typescript
1. Usuario selecciona archivo CSV del banco
2. Parsear CSV con mapeo correcto de columnas
3. Para cada fila del CSV:
   a. Buscar si reference_number ya existe en DB
   b. Si existe → SKIP (mantener registro viejo)
   c. Si NO existe → INSERT nuevo registro
4. Mostrar resumen: X nuevos, Y duplicados ignorados
5. Actualizar UI automáticamente
```

### UI del Historial
- Tabla expandible con columnas: Fecha | Referencia | Descripción | Monto | Usado | Disponible | Estado
- Estado con badges de color:
  - `available` (verde): Monto completo disponible
  - `partial` (amarillo): Parcialmente usado
  - `exhausted` (gris): Monto agotado
  - `paid` (azul): Asociado a pago confirmado
- Click en fila → expande para mostrar payment_details
- Filtros: por fecha, por estado, búsqueda por referencia

---

## 💳 PESTAÑA 2: PAGOS PENDIENTES

### Funcionalidad Principal
- Registrar nuevos pagos pendientes via wizard
- Permitir guardar sin referencia (marcado en rojo)
- Validar referencias contra historial de banco
- Seleccionar múltiples pagos para procesar
- Descargar PDF de pagos seleccionados
- Marcar como pagados → actualizar historial banco

### Campos de Pago Pendiente
```typescript
interface PendingPayment {
  id: string;
  created_at: Date;
  policy_number?: string;
  insurer_name?: string;
  client_name: string;
  purpose: 'poliza' | 'devolucion' | 'otro';
  amount_to_pay: number;           // Monto a pagar a aseguradora
  payment_references: PaymentReference[];  // Puede tener múltiples referencias
  total_received: number;          // Suma de todas las referencias
  status: 'pending' | 'paid';
  can_be_paid: boolean;            // true si todas las referencias existen en banco
  notes?: string;
}

interface PaymentReference {
  id: string;
  reference_number: string;
  date: Date;
  amount: number;
  exists_in_bank: boolean;         // Validación contra historial
  amount_to_use: number;           // Cuánto de esta referencia usar
  remaining_after: number;         // Cuánto queda después de usar
}
```

### Wizard de Nuevo Pago Pendiente

#### Paso 1: Información Básica
- Cliente (obligatorio)
- Tipo: Póliza | Devolución | Otro
- Si es Póliza:
  - Número de póliza
  - Aseguradora (dropdown)
- Monto a pagar (obligatorio)

#### Paso 2: Referencias de Transferencias
**Checkbox: "Pagos Múltiples"**
- Si NO activo:
  - Una sola referencia
  - Campos: Referencia, Fecha, Monto
  - Validar contra banco (verde ✓ / rojo ✗)
  
- Si activo:
  - Botón "+ Agregar Referencia"
  - Múltiples referencias con mismo formato
  - Mostrar suma total de referencias
  - Validar que `sum(referencias) >= amount_to_pay`

**Validación Crítica:**
```typescript
// Reglas:
1. El monto a pagar NO puede ser mayor que la suma de referencias
2. Si es menor, mostrar "Remanente disponible: $X.XX"
3. Cada referencia se valida contra historial_banco
4. Si referencia NO existe → marcar en ROJO pero permitir guardar
5. Si referencia existe → marcar en VERDE
```

#### Paso 3: División de Pago (Opcional)
**Checkbox: "Dividir transferencia en múltiples pagos"**

Si una SOLA referencia debe cubrir MÚLTIPLES propósitos:
- Referencia: 1132498389 ($115.00)
- División:
  - Póliza ABC: $100.00 (a aseguradora)
  - Devolución: $15.00 (devolver a cliente)
  
Campos por división:
- Tipo: Póliza | Devolución | Otro
- Póliza (si aplica)
- Monto
- Mostrar suma vs monto de referencia

**Validación:**
```typescript
sum(divisiones) <= reference.amount
```

#### Paso 4: Confirmación
- Resumen completo
- Tabla de referencias con montos
- Tabla de pagos/divisiones
- Total recibido vs Total a pagar
- Remanente (si existe)

### Lógica de Selección y Pago

```typescript
1. Usuario selecciona pagos pendientes (checkboxes)
2. Click "Descargar PDF"
   → Genera PDF con: Cliente, Póliza, Monto, Referencias
3. Usuario realiza pagos en banco
4. Click "Marcar como Pagados"
5. Para cada pago seleccionado:
   a. Validar que TODAS sus referencias existen en historial_banco
   b. Si alguna NO existe → ERROR "Actualizar historial primero"
   c. Si todas existen:
      - UPDATE historial_banco: 
        * used_amount += payment.amount_to_use
        * remaining_amount = amount - used_amount
        * status = calcular según remaining
        * Agregar payment_detail
      - UPDATE pending_payment: status = 'paid'
6. Refresh ambas pestañas automáticamente
```

### Casos de Uso Complejos

#### Caso 1: Cliente transfirió de MÁS
```
Transferencia: $500
Póliza a pagar: $450
Remanente: $50 (crear como "Devolución pendiente")
```

#### Caso 2: Cliente transfirió de MENOS (múltiples refs)
```
Transferencia 1: $200
Transferencia 2: $150
Total: $350
Póliza a pagar: $350 ✓
```

#### Caso 3: Una transferencia, múltiples destinos
```
Transferencia: $1000
División:
- Póliza A: $400
- Póliza B: $300
- Devolución: $300
Total usado: $1000 (agotado)
```

#### Caso 4: Pago parcial con remanente
```
Transferencia: $600
Póliza a pagar: $450
Usar: $450
Remanente en transferencia: $150 (queda disponible)
```

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### Tabla: bank_transfers
```sql
CREATE TABLE bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  reference_number TEXT NOT NULL UNIQUE,
  transaction_code TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  used_amount NUMERIC(12,2) DEFAULT 0,
  remaining_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount - used_amount) STORED,
  status TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN used_amount = 0 THEN 'available'
      WHEN used_amount < amount THEN 'partial'
      WHEN used_amount >= amount THEN 'exhausted'
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_transfers_ref ON bank_transfers(reference_number);
CREATE INDEX idx_bank_transfers_status ON bank_transfers(status);
```

### Tabla: pending_payments
```sql
CREATE TABLE pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_name TEXT NOT NULL,
  policy_number TEXT,
  insurer_name TEXT,
  purpose TEXT NOT NULL, -- 'poliza' | 'devolucion' | 'otro'
  amount_to_pay NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'paid'
  can_be_paid BOOLEAN DEFAULT false,
  notes TEXT,
  paid_at TIMESTAMPTZ
);
```

### Tabla: payment_references
```sql
CREATE TABLE payment_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES pending_payments(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  amount_to_use NUMERIC(12,2) NOT NULL,
  exists_in_bank BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: payment_details
```sql
CREATE TABLE payment_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transfer_id UUID REFERENCES bank_transfers(id),
  payment_id UUID REFERENCES pending_payments(id),
  policy_number TEXT,
  insurer_name TEXT,
  client_name TEXT,
  purpose TEXT NOT NULL,
  amount_used NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 FLUJO COMPLETO PASO A PASO

### Escenario Completo de Ejemplo

**1. Importar Historial Banco (CSV)**
```csv
Fecha,Referencia,Transacción,Descripción,Débito,Crédito,Saldo
01-ago-2025,1132498389,2627,BANCA MOVIL TRANSFERENCIA DE RICARDO RATCLIFF,,$115.00,$1379.72
01-ago-2025,1135480908,2627,BANCA MOVIL TRANSFERENCIA DE RICARDO RATCLIFF,,$110.30,$1490.02
```
→ Se crean 2 registros en `bank_transfers` con status `available`

**2. Crear Pago Pendiente con Wizard**
- Cliente: Ricardo Ratcliff
- Tipo: Póliza
- Número: POL-2024-001
- Aseguradora: ASSA
- Monto a pagar: $100.00
- Referencias: 1132498389 ($115.00) ✓ (existe en banco)
- Usar: $100.00 de los $115.00
- Remanente: $15.00

→ Se crea registro en `pending_payments` con `can_be_paid = true`
→ Se crea registro en `payment_references`

**3. Seleccionar y Marcar como Pagado**
- Usuario selecciona el pago
- Click "Marcar como Pagado"
- Sistema UPDATE:
  - `bank_transfers` ref 1132498389:
    * `used_amount = 100.00`
    * `remaining_amount = 15.00`
    * `status = 'partial'`
  - Crea `payment_detail`:
    * `bank_transfer_id = 1132498389`
    * `payment_id = [pago_id]`
    * `amount_used = 100.00`
    * `purpose = 'poliza'`
  - `pending_payments`:
    * `status = 'paid'`
    * `paid_at = NOW()`

**4. Ver Historial Actualizado**
- Transferencia 1132498389 muestra:
  * Monto: $115.00
  * Usado: $100.00
  * Disponible: $15.00
  * Estado: PARCIAL (badge amarillo)
- Click expandir → muestra detalle:
  * Póliza POL-2024-001 - ASSA - $100.00 - Pagado 01/ago/2025

---

## 🎨 UI/UX MEJORADA

### Historial de Banco
- Tabla moderna con hover effects
- Badges de estado con colores corporativos
- Filas expandibles con animación suave
- Filtros flotantes arriba de la tabla
- Botón destacado "Importar Historial"

### Pagos Pendientes
- Cards en grid para pagos pendientes
- Badge rojo si falta referencia
- Badge verde si puede pagarse
- Checkbox de selección en cada card
- Botones flotantes: "Descargar PDF" | "Marcar Pagados"
- Wizard modal full-screen con steps visuales

### Wizard Mejorado
- 4 pasos con progress bar
- Validación en tiempo real
- Preview de montos y cálculos
- Alerts de advertencia para remanentes
- Confirmación final con resumen completo

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos
- [ ] Crear migrations para tablas nuevas
- [ ] Ejecutar en Supabase
- [ ] Regenerar types
- [ ] Verificar RLS policies

### Backend (Actions)
- [ ] `actionImportBankHistory` - Importar CSV con depuración
- [ ] `actionCreatePendingPayment` - Crear pago con wizard
- [ ] `actionMarkPaymentsAsPaid` - Procesar pagos múltiples
- [ ] `actionValidateReferences` - Validar referencias contra banco
- [ ] `actionGetBankHistory` - Obtener historial con filtros
- [ ] `actionGetPendingPayments` - Obtener pagos pendientes

### Frontend (Components)
- [ ] `ChecksMainClient.tsx` - Componente principal con tabs
- [ ] `BankHistoryTab.tsx` - Tab de historial con tabla expandible
- [ ] `PendingPaymentsTab.tsx` - Tab de pagos pendientes
- [ ] `ImportBankHistoryModal.tsx` - Modal de importación mejorado
- [ ] `RegisterPaymentWizard.tsx` - Wizard completo 4 pasos
- [ ] `PaymentCard.tsx` - Card individual de pago pendiente
- [ ] `ExpandableTransferRow.tsx` - Fila expandible de transferencia

### Testing
- [ ] Test: Importar CSV con duplicados
- [ ] Test: Crear pago sin referencia (guardar)
- [ ] Test: Crear pago con referencia válida (pagable)
- [ ] Test: Marcar múltiples pagos como pagados
- [ ] Test: Ver detalles en historial
- [ ] Test: Pagos múltiples referencias
- [ ] Test: División de transferencia
- [ ] Test: Validación de montos

---

**Autor:** Sistema Portal Líderes  
**Fecha:** 2025-10-02  
**Versión:** 1.0 Completa
