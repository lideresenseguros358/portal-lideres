# ANÁLISIS COMPLETO: FLUJO DE NUEVA QUINCENA Y BULK IMPORT

## FECHA: 2025-01-24

## PROBLEMA PRINCIPAL

El bulk import y el flujo de nueva quincena tienen múltiples problemas que impiden que funcionen correctamente:

1. **NO se guarda el detalle completo** de cada cliente/póliza cuando se cierra la quincena
2. **Se borran datos importantes** al cerrar la quincena
3. **No existe tabla de historial** para guardar el detalle de quincenas cerradas
4. **Clientes duplicados** por múltiples bulks
5. **Políticas sin crear** - algunos clientes tienen 0 pólizas

## TABLAS ACTUALES (database.types.ts)

### 1. `fortnights` - Quincenas
```typescript
{
  id: string
  period_start: string
  period_end: string
  status: 'DRAFT' | 'PAID'
  notify_brokers: boolean
  created_at: string
  created_by: string | null
}
```

### 2. `comm_imports` - Reportes importados
```typescript
{
  id: string
  insurer_id: string
  period_label: string
  total_amount: number | null  // ← CRÍTICO: Total del reporte
  uploaded_by: string | null
  is_life_insurance: boolean | null
  created_at: string
}
```

### 3. `comm_items` - Items de comisiones (con broker identificado)
```typescript
{
  id: string
  import_id: string
  broker_id: string | null
  policy_number: string
  insured_name: string | null
  insurer_id: string
  gross_amount: number  // ← Comisión calculada con porcentaje
  raw_row: Json | null
  created_at: string
}
```

### 4. `pending_items` - Items sin identificar
```typescript
{
  id: string
  policy_number: string
  insured_name: string | null
  insurer_id: string | null
  commission_raw: number  // ← Monto SIN porcentaje aplicado
  fortnight_id: string | null
  import_id: string | null
  status: string  // 'open', 'assigned', etc.
  assigned_broker_id: string | null
  assigned_by: string | null
  assignment_notes: string | null
  action_type: string | null  // 'pay_next' para siguiente quincena
  created_at: string
  updated_at: string
}
```

### 5. `fortnight_broker_totals` - Totales por broker
```typescript
{
  id: string
  fortnight_id: string
  broker_id: string
  gross_amount: number  // Total bruto
  net_amount: number  // Total neto (después de descuentos)
  discounts_json: Json  // { adelantos: [...], total: number }
  is_retained: boolean | null  // Si el pago fue retenido
  bank_snapshot: Json | null
  created_at: string
}
```

### 6. `policies` - Pólizas
```typescript
{
  id: string
  policy_number: string
  broker_id: string
  client_id: string
  insurer_id: string
  ramo: string | null  // 'VIDA', 'AUTO', etc.
  percent_override: number | null  // Porcentaje especial (ej: ASSA VIDA = 1.0)
  start_date: string | null
  renewal_date: string | null
  status: 'active' | 'inactive' | 'cancelled'
  notas: string | null
  created_at: string
}
```

### 7. `clients` - Clientes
```typescript
{
  id: string
  name: string
  broker_id: string
  national_id: string | null
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
}
```

### 8. `brokers` - Corredores
```typescript
{
  id: string
  name: string
  email: string | null
  assa_code: string | null
  percent_default: number | null  // Porcentaje por defecto (ej: 0.85 = 85%)
  // ... otros campos bancarios
}
```

## TABLA FALTANTE: `fortnight_details` ⚠️

**NECESITAMOS** esta tabla para guardar el detalle de cada póliza/cliente pagada en cada quincena:

```sql
CREATE TABLE fortnight_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fortnight_id UUID NOT NULL REFERENCES fortnights(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  insurer_id UUID NOT NULL REFERENCES insurers(id),
  policy_id UUID REFERENCES policies(id),
  client_id UUID REFERENCES clients(id),
  
  -- Datos del cliente/póliza
  policy_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  ramo TEXT,
  
  -- Montos y cálculos
  commission_raw NUMERIC NOT NULL,  -- Monto original del reporte
  percent_applied NUMERIC NOT NULL,  -- Porcentaje aplicado (0.85, 1.0, etc.)
  commission_calculated NUMERIC NOT NULL,  -- commission_raw * percent_applied
  
  -- Metadata
  is_assa_code BOOLEAN DEFAULT FALSE,  -- TRUE si es código ASSA
  assa_code TEXT,  -- Código ASSA si aplica
  source_import_id UUID REFERENCES comm_imports(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_fortnight_policy UNIQUE(fortnight_id, policy_number, broker_id)
);

CREATE INDEX idx_fortnight_details_fortnight ON fortnight_details(fortnight_id);
CREATE INDEX idx_fortnight_details_broker ON fortnight_details(broker_id);
CREATE INDEX idx_fortnight_details_insurer ON fortnight_details(insurer_id);
```

## FLUJO CORRECTO DE NUEVA QUINCENA

### 1. IMPORTACIÓN DE REPORTES

**Archivos:**
- `total_reportes_por_aseguradora.csv` (aseguradora, total_amount)
- `plantilla_comisiones_quincena.csv` (policy_number, client_name, broker_email, insurer_name, policy_type, commission_amount, start_date, renewal_date)
- `plantilla_codigos_assa.csv` (assa_code, commission_amount)

**Proceso:**
1. Crear quincena (status = 'DRAFT')
2. Importar cada reporte por aseguradora → `comm_imports` con `total_amount`
3. Parsear CSV de comisiones:
   - Si tiene broker → `comm_items` con comisión calculada (raw * percent)
   - Si NO tiene broker → `pending_items` con `commission_raw`
4. Importar códigos ASSA → `comm_items` al 100%
   - Asignados → al broker correspondiente
   - Huérfanos → a LISSA (ganancia oficina)

**Cálculo de porcentaje:**
```javascript
let percentToUse = 1.0;

// 1. Si es VIDA + ASSA → 100% SIEMPRE
if (policyType === 'VIDA' && insurerName === 'ASSA') {
  percentToUse = 1.0;
  // Guardar en policies.percent_override = 1.0
}
// 2. Si la póliza tiene percent_override → usar ese
else if (policy.percent_override != null) {
  percentToUse = policy.percent_override;
}
// 3. Si no, usar percent_default del broker
else {
  percentToUse = broker.percent_default || 1.0;
}

const grossAmount = commissionRaw * percentToUse;
```

### 2. CORREDORES Y DESCUENTOS

**Vista de corredores:**
```
┌─────────────────────────────────────────────────────────────┐
│ Corredor A                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   ASSA:           $1,200.00                                │
│   SURA:           $  500.00                                │
│   VIVIR:          $  300.00                                │
│   ────────────────────────────────                         │
│   Total Bruto:    $2,000.00                                │
│   Descuentos:     $  200.00                                │
│   ════════════════════════════                             │
│   Neto a Pagar:   $1,800.00                                │
│                                                            │
│   [Retener] [Descontar]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Botón "Descontar":**
- Abre modal con deudas activas del corredor
- Permite aplicar múltiples descuentos
- Actualiza `fortnight_broker_totals.discounts_json`
- Recalcula neto en tiempo real

**Botón "Retener":**
- Marca `fortnight_broker_totals.is_retained = true`
- Al cerrar quincena → se guarda en `ajustes` sección "Retenidos"
- Da opciones: "Pagar ya" o "Pagar en siguiente quincena"

### 3. GENERAR TXT BANCO GENERAL

**Criterios:**
- Incluir SOLO brokers con `net_amount > 0.00` AND `is_retained = false`
- Formato ACH de Banco General
- Una línea por broker

### 4. CERRAR QUINCENA (Botón "Pagado")

**CRÍTICO:** Al cerrar quincena, NO borrar nada. Solo:

1. Cambiar `fortnights.status = 'PAID'`

2. **GUARDAR DETALLE COMPLETO** en `fortnight_details`:
```sql
-- Para cada comm_item de esta quincena
INSERT INTO fortnight_details (
  fortnight_id,
  broker_id,
  insurer_id,
  policy_id,
  client_id,
  policy_number,
  client_name,
  ramo,
  commission_raw,
  percent_applied,
  commission_calculated,
  is_assa_code,
  assa_code,
  source_import_id
)
SELECT 
  ci.fortnight_id,
  ci.broker_id,
  ci.insurer_id,
  p.id AS policy_id,
  p.client_id,
  ci.policy_number,
  ci.insured_name,
  p.ramo,
  -- Calcular commission_raw (reverso del cálculo)
  ci.gross_amount / COALESCE(p.percent_override, b.percent_default, 1.0) AS commission_raw,
  COALESCE(p.percent_override, b.percent_default, 1.0) AS percent_applied,
  ci.gross_amount AS commission_calculated,
  -- Detectar si es código ASSA
  CASE WHEN ci.policy_number LIKE 'PJ750%' THEN TRUE ELSE FALSE END AS is_assa_code,
  CASE WHEN ci.policy_number LIKE 'PJ750%' THEN ci.policy_number ELSE NULL END AS assa_code,
  ci.import_id
FROM comm_items ci
LEFT JOIN policies p ON ci.policy_number = p.policy_number
LEFT JOIN brokers b ON ci.broker_id = b.id
WHERE ci.fortnight_id = :fortnight_id
```

3. **MANTENER** `comm_items` (NO borrar)
4. **MANTENER** `comm_imports` (NO borrar, incluye total_amount)
5. Crear logs de adelantos aplicados
6. Mover retenidos a `ajustes`
7. Notificar brokers

## VISTA DE HISTORIAL DE QUINCENA

Al abrir una quincena cerrada, debe mostrar:

```
┌─────────────────────────────────────────────────────────────┐
│ QUINCENA: 1-15 Noviembre 2025                              │
│ Estado: PAGADA                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                            │
│ TOTALES GENERALES:                                         │
│   Total Reportes:      $10,681.22                         │
│   Total Corredores:    $ 8,950.50                         │
│   Ganancia Oficina:    $ 1,730.72                         │
│                                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                            │
│ CORREDORES PAGADOS (3)                                     │
│                                                            │
│ ▼ Juan Pérez                                               │
│   ┌─────────────────────────────────────────────────┐     │
│   │ ASSA                         $1,500.00          │     │
│   │   • Cliente A - POL-001      $  800.00 (85%)   │     │
│   │   • Cliente B - POL-002      $  700.00 (85%)   │     │
│   │ SURA                         $  500.00          │     │
│   │   • Cliente C - POL-003      $  500.00 (85%)   │     │
│   │ Códigos ASSA                 $  300.00          │     │
│   │   • PJ750-10                 $  150.00 (100%)  │     │
│   │   • PJ750-11                 $  150.00 (100%)  │     │
│   ├─────────────────────────────────────────────────┤     │
│   │ Total Bruto:    $2,300.00                      │     │
│   │ Descuentos:     $  200.00                      │     │
│   │ Neto Pagado:    $2,100.00                      │     │
│   └─────────────────────────────────────────────────┘     │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

**Datos vienen de:**
- `fortnight_details` - Detalle de cada póliza
- `fortnight_broker_totals` - Totales y descuentos
- `comm_imports` - Total por reporte (mantenido)

## AJUSTES Y "MÍO"

### Sin Identificar

**Agrupación:** Por `policy_number`

**Regla 90 días:** 
- Si han pasado 90 días y nadie lo reclama → asignar automáticamente a "Oficina"
- Crear pending_item con assigned_broker_id = LISSA_ID

**Botón "Mío" (broker):**
1. Crea `comm_item_claims` con:
   - `status = 'pending'`
   - `broker_id = broker que lo reporta`
   - `comm_item_id = item reportado`

2. Master revisa y aprueba/rechaza
3. Si aprueba, opciones:
   - **"Pagar ya"** → Genera CSV separado, marca como pagado
   - **"Pagar en siguiente quincena"** → Marca `payment_type = 'next_fortnight'`

### Pagar en Siguiente Quincena

Al crear nueva quincena, buscar:
```sql
SELECT * FROM pending_items 
WHERE action_type = 'pay_next' 
AND status = 'assigned'
```

Y también:
```sql
SELECT * FROM comm_item_claims
WHERE status = 'approved'
AND payment_type = 'next_fortnight'
AND fortnight_id IS NULL
```

Estos se **inyectan** en la nueva quincena como un import virtual:
- Crear `comm_imports` con nota "Ajustes de quincena anterior"
- Crear `comm_items` calculando con percent del broker
- El detalle en historial muestra: "Ajuste de quincena XXX"

## LIMPIEZA DE DUPLICADOS

```sql
-- 1. Encontrar clientes duplicados (mismo nombre + mismo broker)
WITH duplicates AS (
  SELECT 
    name,
    broker_id,
    COUNT(*) as count,
    ARRAY_AGG(id ORDER BY created_at) as ids
  FROM clients
  GROUP BY name, broker_id
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- 2. Para cada grupo de duplicados:
--    - Mantener el MÁS ANTIGUO (primer ID)
--    - Reasignar pólizas de los duplicados al principal
--    - Eliminar duplicados

-- Ejemplo para un grupo:
UPDATE policies 
SET client_id = '{id_principal}'
WHERE client_id IN ('{id_dup1}', '{id_dup2}', ...);

DELETE FROM clients 
WHERE id IN ('{id_dup1}', '{id_dup2}', ...);
```

## BULK IMPORT CORREGIDO

Ver: `scripts/bulk-import-optimized.mjs` (próximo archivo)

**Flujo:**
1. Limpiar datos (comm_items, comm_imports, fortnights, fortnight_broker_totals, pending_items)
2. NO limpiar clients ni policies (para evitar duplicados)
3. Crear quincena con status='PAID'
4. Importar reportes con total_amount
5. Importar comisiones:
   - Buscar/crear clientes (normalizado, sin duplicar)
   - Buscar/crear pólizas con percent_override correcto
   - Calcular comisión con porcentaje
   - Insertar en comm_items
6. Importar códigos ASSA al 100%
7. Calcular totales por broker
8. **GUARDAR DETALLE en fortnight_details**
9. Actualizar pending_items con fortnight_id

## ARCHIVOS A MODIFICAR

1. **Crear migración:** `migrations/create_fortnight_details.sql`
2. **Regenerar types:** `database.types.ts`
3. **Modificar:** `src/app/(app)/commissions/actions.ts`
   - `actionPayFortnight` - Guardar detalle en fortnight_details
   - NO borrar comm_items ni comm_imports
4. **Crear:** `scripts/bulk-import-optimized.mjs`
5. **Crear:** `scripts/clean-duplicate-clients.mjs`
6. **Modificar:** Componente de historial de quincena para mostrar detalle
7. **Agregar:** Botones "Retener" y "Descontar" en lista de corredores

## VERIFICACIONES POST-IMPLEMENTACIÓN

```bash
# 1. Verificar que NO se borraron datos
SELECT COUNT(*) FROM comm_items WHERE fortnight_id = '{id}';  # Debe ser > 0
SELECT COUNT(*) FROM comm_imports WHERE period_label = '{id}';  # Debe ser > 0

# 2. Verificar que se guardó el detalle
SELECT COUNT(*) FROM fortnight_details WHERE fortnight_id = '{id}';  # Debe coincidir con comm_items

# 3. Verificar totales
SELECT 
  SUM(commission_calculated) as total_calculated,
  SUM(commission_raw) as total_raw
FROM fortnight_details 
WHERE fortnight_id = '{id}';

# 4. Verificar NO hay duplicados de clientes
SELECT name, broker_id, COUNT(*) 
FROM clients 
GROUP BY name, broker_id 
HAVING COUNT(*) > 1;

# 5. Verificar todas las pólizas tienen cliente
SELECT COUNT(*) FROM policies WHERE client_id IS NULL;  # Debe ser 0
```

## PRÓXIMOS PASOS

1. ✅ Crear tabla fortnight_details
2. ✅ Limpiar clientes duplicados
3. ✅ Modificar actionPayFortnight para guardar detalle
4. ✅ Crear bulk import optimizado
5. ✅ Probar con datos reales
6. ✅ Agregar botones Retener/Descontar
7. ✅ Implementar vista de historial detallado
