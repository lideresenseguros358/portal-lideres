# 🚧 Progreso de Implementación - Sistema de Ajustes

## ✅ Completado (Paso 1-3)

### 1. **SQL - Campos y Funciones** ✅
**Archivo:** `docs/sql-update-comm-item-claims.sql`

**Cambios en BD:**
- ✅ Agregados campos a `comm_item_claims`:
  - `payment_type` TEXT ('now' | 'next_fortnight')
  - `paid_date` TIMESTAMP
  - `rejection_reason` TEXT
  - `fortnight_id` UUID

**Funciones SQL creadas:**
- ✅ `get_claims_reports_grouped()` - Agrupa reportes por broker
- ✅ `approve_claims_and_create_preliminary()` - Aprueba y crea preliminares
- ✅ `reject_claims()` - Rechaza claims
- ✅ `confirm_claims_paid()` - Confirma pago
- ✅ `get_queued_claims_for_fortnight()` - Obtiene ajustes en cola

**Vista creada:**
- ✅ `v_claims_full` - Vista con cálculos completos

---

### 2. **Utils - Funciones de Cálculo** ✅
**Archivo:** `src/lib/commissions/adjustments-utils.ts`

**Funciones creadas:**
- ✅ `calculateBrokerCommission()` - Calcula monto bruto
- ✅ `getBrokerPercent()` - Obtiene % del broker
- ✅ `calculateSelectionTotals()` - Totales de selección
- ✅ `groupClaimsByBroker()` - Agrupa por broker
- ✅ `formatCurrency()` - Formato moneda
- ✅ `formatPercent()` - Formato porcentaje
- ✅ `generateAdjustmentsCSVData()` - Datos para CSV
- ✅ `convertToCSV()` - Convierte a string CSV
- ✅ `downloadCSV()` - Descarga archivo
- ✅ `validateBrokerBankData()` - Valida datos bancarios
- ✅ `getClaimStatusBadge()` - Badge de estado

---

### 3. **Backend - Acciones** ✅
**Archivo:** `src/app/(app)/commissions/actions.ts` (líneas 2180-2538)

**Acciones creadas:**

#### Broker:
- ✅ `actionSubmitClaimsReport(itemIds)` - Enviar reporte

#### Master:
- ✅ `actionGetClaimsReports(status?)` - Obtener reportes
- ✅ `actionApproveClaimsReports(claimIds, paymentType)` - Aprobar
- ✅ `actionRejectClaimsReports(claimIds, reason?)` - Rechazar
- ✅ `actionGetAdjustmentsCSVData(claimIds)` - Datos CSV
- ✅ `actionConfirmAdjustmentsPaid(claimIds)` - Confirmar pago

#### Integración Quincenas:
- ✅ `actionGetQueuedAdjustments()` - Obtener cola
- ✅ `actionMarkAdjustmentsInFortnight(claimIds, fortnightId)` - Marcar en quincena

---

## 🔄 En Progreso (Paso 4-8)

### 4. **Frontend - Broker** 🔄
**Archivo a modificar:** `src/components/commissions/broker/BrokerPendingTab.tsx`

**Cambios necesarios:**
- [ ] Agregar selección múltiple (checkbox)
- [ ] Panel de totales con cálculos
- [ ] Mostrar: Crudo → % → Bruto
- [ ] Botón "Enviar Reporte"
- [ ] Actualizar pestaña "Ajustes Reportados"

**Estructura aproximada:**
```tsx
// Estado
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
const [broker, setBroker] = useState<BrokerInfo | null>(null);

// Cálculos
const totals = useMemo(() => {
  const items = pendingItems.filter(i => selectedItems.has(i.id));
  return calculateSelectionTotals(items, broker);
}, [selectedItems, pendingItems, broker]);

// UI
<SelectionPanel totals={totals} />
<PendingTable 
  items={pendingItems}
  selected={selectedItems}
  onToggle={handleToggle}
/>
<Button onClick={handleSubmit}>Enviar Reporte</Button>
```

---

### 5. **Frontend - Master** 🔄
**Archivo a modificar:** `src/components/commissions/AdjustmentsTab.tsx`

**Tab "Identificados" - Cambios necesarios:**
- [ ] Vista de reportes agrupados por broker
- [ ] Selección múltiple de reportes
- [ ] Detalles expandibles
- [ ] Botones batch: Aprobar, Rechazar
- [ ] Dropdown: "Pagar Ya" / "Siguiente Quincena"
- [ ] Generación CSV
- [ ] Botón "Confirmar Pago"

**Estructura aproximada:**
```tsx
<ReportsView>
  <BatchActions 
    selected={selectedReports}
    onApprove={handleApprove}
    onReject={handleReject}
  />
  
  {reports.map(report => (
    <ReportCard 
      report={report}
      expandable
      selectable
    />
  ))}
</ReportsView>
```

---

### 6. **Generador CSV** 🔄
**Componente a crear:** `src/components/commissions/AdjustmentsCSVGenerator.tsx`

**Funcionalidad:**
- [ ] Botón "Descargar CSV"
- [ ] Validación de datos bancarios
- [ ] Advertencias si faltan datos
- [ ] Descarga automática
- [ ] Formato Banco General

---

### 7. **Integración temp_client_import** ✅
**Ya implementado en SQL:**
- La función `approve_claims_and_create_preliminary()` crea registros automáticamente
- Campos: `client_name`, `policy_number`, `insurer_id`, `broker_id`, `source='adjustment'`

**Pendiente:**
- [ ] Verificar que broker puede ver en "Clientes Preliminares"
- [ ] Mensaje de advertencia sobre datos faltantes

---

### 8. **Integración Nueva Quincena** 🔄
**Archivo a modificar:** `src/app/(app)/commissions/actions.ts` (función existente)

**En `actionCreateDraftFortnight()`:**
- [ ] Llamar `actionGetQueuedAdjustments()`
- [ ] Sumar montos al bruto de cada broker
- [ ] Llamar `actionMarkAdjustmentsInFortnight()`
- [ ] Mostrar notificación de ajustes incluidos

---

## 📋 Próximos Pasos

### **IMPORTANTE: Antes de Continuar**
1. ⚠️ **Ejecutar SQL en Supabase:**
   ```sql
   -- Ejecutar: docs/sql-update-comm-item-claims.sql
   ```

2. ⚠️ **Regenerar Types:**
   ```bash
   npm run supabase:types
   ```

### **Orden de Implementación:**
1. ✅ Ejecutar SQL
2. ✅ Regenerar types
3. 🔄 Implementar BrokerPendingTab mejorado
4. 🔄 Implementar AdjustmentsTab mejorado
5. 🔄 Crear CSV Generator
6. 🔄 Integrar con Nueva Quincena
7. ✅ Testing completo
8. ✅ Documentación

---

## 🧪 Testing Checklist

### **SQL y Backend:**
- [ ] SQL ejecutado sin errores
- [ ] Types regenerados
- [ ] Functions SQL funcionan
- [ ] Actions backend tipadas correctamente

### **Broker:**
- [ ] Puede seleccionar múltiples pendientes
- [ ] Ve cálculo de comisiones correcto
- [ ] Envía reporte exitosamente
- [ ] Ve reportes en "Ajustes Reportados"
- [ ] Ve estados actualizados (pending/approved/rejected)

### **Master:**
- [ ] Ve reportes agrupados por broker
- [ ] Puede expandir detalles
- [ ] Selecciona múltiples reportes
- [ ] Aprueba con "Pagar Ya" → Genera CSV
- [ ] Aprueba con "Siguiente Quincena" → En cola
- [ ] Rechaza con razón
- [ ] Descarga CSV correctamente
- [ ] Confirma pago → Mueve a pagados

### **Integración:**
- [ ] Claims aprobados crean preliminares
- [ ] Broker ve preliminares en DB
- [ ] Nueva quincena incluye ajustes en cola
- [ ] Ajustes en quincena suman al bruto
- [ ] Ajustes marcados como paid después de quincena

---

## 📊 Métricas de Implementación

| Componente | Líneas | Estado |
|------------|--------|--------|
| SQL | ~350 | ✅ Completo |
| Utils | ~450 | ✅ Completo |
| Actions | ~360 | ✅ Completo |
| BrokerPendingTab | ~800 | 🔄 Pendiente |
| AdjustmentsTab | ~600 | 🔄 Pendiente |
| CSV Generator | ~200 | 🔄 Pendiente |
| Integración Quincena | ~100 | 🔄 Pendiente |
| **TOTAL** | **~2,860** | **35% Completo** |

---

## 🎯 Decisiones Pendientes

1. **UI de Selección Múltiple:**
   - ¿Checkboxes individuales + "Seleccionar Todo"?
   - ¿Límite de items por reporte?

2. **Validación CSV:**
   - ¿Bloquear si faltan datos bancarios?
   - ¿O generar con advertencia?

3. **Notificaciones:**
   - ¿Email automático al aprobar/rechazar?
   - ¿Push notification en app?

4. **Permisos:**
   - ¿Solo Master puede confirmar pago?
   - ¿O permitir a Admin también?

---

**Última actualización:** 2025-10-09 16:10  
**Progreso general:** 35% ✅ 65% 🔄
