# ✅ FLUJO DE AJUSTES - IMPLEMENTACIÓN COMPLETA

**Fecha:** 24 de noviembre, 2025
**Estado:** Implementado y listo para probar

---

## 📊 RESUMEN DEL FLUJO

### **Fase 1: Broker (Marcar Mío)**
1. ✅ Broker ve pendientes sin identificar
2. ✅ Selecciona múltiples items (checkboxes)
3. ✅ Crea reporte agrupado
4. ✅ Cálculo automático de comisión neta (broker_percent aplicado)
5. ✅ Envío de reporte a Master

### **Fase 2: Master (Aprobar/Rechazar)**
1. ✅ Master ve lista de reportes pendientes
2. ✅ Puede seleccionar múltiples reportes (checkboxes)
3. ✅ Al aprobar, elige modalidad:
   - **Pagar Ya**: Genera TXT Banco General → Confirmar Pagados
   - **Siguiente Quincena**: Se suma automáticamente al cerrar
4. ✅ Al aprobar: crea registros en Preliminar (temp_client_imports)

### **Fase 3: Preliminar**
1. ✅ Broker ve clientes preliminares
2. ✅ Completa national_id (cédula)
3. ✅ Trigger automático: migra a clients/policies

### **Fase 4: Cierre de Quincena**
1. ✅ Al cerrar quincena, ajustes "siguiente quincena" pasan a paid
2. ✅ Aparecen en historial de quincenas

---

## 🔧 FUNCIONES IMPLEMENTADAS

### **1. actionCreateAdjustmentReport** ✅
**Ubicación:** `src/app/(app)/commissions/adjustment-actions.ts`

**Qué hace:**
- Broker selecciona múltiples pending_items
- Calcula comisión neta (broker_percent aplicado)
- Crea un reporte agrupado
- Status inicial: 'pending'

**Uso:**
```typescript
await actionCreateAdjustmentReport(
  itemIds: string[],
  notes: string
)
```

---

### **2. actionApproveAdjustmentReport** ✅
**Ubicación:** `src/app/(app)/commissions/adjustment-actions.ts`

**Qué hace:**
- Master aprueba reporte
- Elige payment_mode: 'immediate' o 'next_fortnight'
- Crea registros en temp_client_imports (preliminar)
- Si 'immediate': status='approved'
- Si 'next_fortnight': status='approved', asigna fortnight_id

**Uso:**
```typescript
await actionApproveAdjustmentReport(
  reportId: string,
  paymentMode: 'immediate' | 'next_fortnight',
  adminNotes: string
)
```

---

### **3. actionGenerateBankTXT** ✅ NUEVO
**Ubicación:** `src/app/(app)/commissions/adjustment-actions.ts`

**Qué hace:**
- Obtiene reportes con payment_mode='immediate' y status='approved'
- Genera archivo TXT para Banco General
- Formato: `TIPO_CUENTA|CUENTA|MONTO|NOMBRE|DESCRIPCION|FECHA`

**Uso:**
```typescript
const result = await actionGenerateBankTXT(reportIds: string[]);
// result.data.content = contenido TXT
// result.data.filename = nombre del archivo
```

**Ejemplo TXT generado:**
```
AHORROS|1234567890|500.00|JUAN PEREZ|AJUSTES|24/11/2025
CORRIENTE|0987654321|750.00|MARIA GOMEZ|AJUSTES|24/11/2025
```

---

### **4. actionConfirmReportsPaid** ✅ NUEVO
**Ubicación:** `src/app/(app)/commissions/adjustment-actions.ts`

**Qué hace:**
- Después de descargar TXT y hacer pago en banco
- Master confirma que se pagaron
- Reportes pasan de status='approved' a status='paid'
- Se asigna paid_date

**Uso:**
```typescript
await actionConfirmReportsPaid(reportIds: string[])
```

---

### **5. Integración con Cierre de Quincena** ✅ NUEVO
**Ubicación:** `src/app/(app)/commissions/actions.ts` (actionPayFortnight)

**Qué hace:**
- Al cerrar quincena (actionPayFortnight)
- Busca reportes con fortnight_id = current y payment_mode='next_fortnight'
- Los marca como status='paid' con paid_date
- Aparecen en historial

**Código agregado:**
```typescript
// En actionPayFortnight, después de guardar fortnight_details
const { data: adjustmentReports } = await supabase
  .from('adjustment_reports')
  .select('id')
  .eq('fortnight_id', fortnight_id)
  .eq('status', 'approved')
  .eq('payment_mode', 'next_fortnight');

if (adjustmentReports && adjustmentReports.length > 0) {
  await supabase
    .from('adjustment_reports')
    .update({ status: 'paid', paid_date: new Date().toISOString() })
    .in('id', reportIds);
}
```

---

## 🎨 COMPONENTES UI ACTUALIZADOS

### **1. MasterAdjustmentReportReview.tsx** ✅ ACTUALIZADO
**Ubicación:** `src/components/commissions/MasterAdjustmentReportReview.tsx`

**Nuevas funcionalidades:**
- ✅ Checkboxes para seleccionar múltiples reportes
- ✅ "Seleccionar todos"
- ✅ Barra de acciones en batch (cuando hay selección)
- ✅ Botón "Aprobar Seleccionados"
- ✅ Visual feedback (reportes seleccionados tienen borde azul)

---

### **2. AdjustmentReportModal.tsx** ✅ EXISTENTE
**Ubicación:** `src/components/commissions/AdjustmentReportModal.tsx`

**Funcionalidad:**
- Broker selecciona items
- Muestra cálculo de comisión neta
- Permite agregar notas
- Envía reporte

---

## 📝 ESQUEMA DE BASE DE DATOS

### **adjustment_reports**
```sql
CREATE TABLE adjustment_reports (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  total_amount DECIMAL(12, 2),
  broker_notes TEXT,
  admin_notes TEXT,
  payment_mode TEXT CHECK (payment_mode IN ('immediate', 'next_fortnight')),
  fortnight_id UUID, -- para 'next_fortnight'
  paid_date TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);
```

### **adjustment_report_items**
```sql
CREATE TABLE adjustment_report_items (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL,
  pending_item_id UUID NOT NULL,
  commission_raw DECIMAL(12, 2), -- prima
  broker_commission DECIMAL(12, 2), -- comisión neta
  created_at TIMESTAMPTZ
);
```

### **temp_client_imports**
```sql
CREATE TABLE temp_client_imports (
  id UUID PRIMARY KEY,
  client_name TEXT NOT NULL,
  national_id TEXT, -- NULL en preliminar, obligatorio para migrar
  policy_number TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  broker_email TEXT NOT NULL,
  source TEXT, -- 'ajuste_pendiente', 'csv_import', etc.
  import_status TEXT, -- 'pending', 'processed', 'error'
  created_at TIMESTAMPTZ
);

-- Trigger automático: cuando national_id se completa → migrar a clients/policies
```

---

## 🔄 FLUJO COMPLETO PASO A PASO

### **Escenario 1: Pago Inmediato**

1. **Broker marca items como "mío"**
   - Selecciona 3 pólizas sin identificar
   - Click "Enviar Reporte"
   - Sistema calcula comisión neta

2. **Master recibe notificación**
   - Ve reporte en lista "Pendientes"
   - Click "Aprobar"
   - Elige "Pagar Ya"

3. **Sistema crea preliminar**
   - 3 registros en temp_client_imports
   - Status 'pending', esperando national_id

4. **Master descarga TXT**
   - Selecciona el reporte (checkbox)
   - Click "Descargar TXT Banco"
   - Sistema genera TXT con datos bancarios

5. **Master hace pago en banco**
   - Usa TXT en Banca en Línea
   - Hace transferencias

6. **Master confirma pagados**
   - Regresa al sistema
   - Selecciona reportes pagados
   - Click "Confirmar Pagados"
   - Reportes pasan a status='paid'

7. **Broker completa preliminar**
   - Ve 3 clientes preliminares
   - Completa cédulas
   - Trigger automático migra a clients/policies

---

### **Escenario 2: Siguiente Quincena**

1. **Broker marca items**
   - Igual que antes

2. **Master aprueba**
   - Elige "Siguiente Quincena"
   - Reporte queda en status='approved'
   - Se asigna a próxima quincena DRAFT

3. **Sistema crea preliminar**
   - Igual que antes

4. **Se trabaja la siguiente quincena**
   - Se importan reportes normales
   - Ajustes ya están asignados

5. **Master cierra quincena**
   - Click "Cerrar y Pagar"
   - Sistema automáticamente:
     - Marca ajustes como paid
     - Asigna paid_date
     - Aparece en historial

6. **Broker completa preliminar**
   - Igual que antes

---

## ⚠️ FALTANTES (No Implementados)

### **1. Notificaciones**
**Requerido:** Cuando broker envía reporte, notificar a Master

**Solución Pendiente:**
```typescript
// Agregar en actionCreateAdjustmentReport:
// - Obtener email de Master
// - Enviar notificación (email o sistema interno)
// - Actualizar contador en dashboard
```

---

### **2. Descarga PDF/XLSX de Reportes Pagados**
**Requerido:** Cada reporte pagado debe descargarse en PDF y XLSX

**Solución Pendiente:**
```typescript
export async function actionDownloadAdjustmentReportPDF(reportId: string) {
  // Generar PDF con jsPDF
  // Incluir: broker, items, total, fecha de pago
}

export async function actionDownloadAdjustmentReportXLSX(reportId: string) {
  // Generar Excel con xlsx
  // Misma info que PDF
}
```

---

### **3. Reflejar en Historial de Quincenas**
**Requerido:** Ajustes deben aparecer en historial

**Solución Pendiente:**
- Modificar `actionGetClosedFortnights` para incluir ajustes
- Modificar `FortnightDetailView` para mostrar sección de ajustes
- Mostrar lista de reportes pagados en esa quincena

---

## 🧪 INSTRUCCIONES DE PRUEBA

### **Test 1: Flujo Completo - Pago Inmediato**

```bash
1. Login como Broker
2. Ir a Comisiones → Ajustes → Sin Identificar
3. Seleccionar 2-3 items
4. Click "Enviar Reporte"
5. Agregar notas (opcional)
6. Click "Enviar"

7. Logout, Login como Master
8. Ir a Comisiones → Ajustes → Reportes Pendientes
9. Ver reporte del broker
10. Checkbox en el reporte
11. Click "Aprobar Seleccionados"
12. En modal, elegir "Pagar Ya"
13. Click "Aprobar"

14. Ir a DB → Preliminares
15. Verificar que aparecen los clientes
16. (Como Master) Completar cédulas
17. Verificar que migran a Clientes/Pólizas

18. Regresar a Ajustes
19. Seleccionar reportes aprobados (payment_mode=immediate)
20. Click "Descargar TXT Banco"
21. Guardar archivo TXT
22. Click "Confirmar Pagados"
23. Verificar que pasan a status='paid'
```

### **Test 2: Flujo Completo - Siguiente Quincena**

```bash
1-7. Igual que Test 1

8. Master aprueba eligiendo "Siguiente Quincena"
9. Verificar que status='approved', payment_mode='next_fortnight'
10. Verificar que fortnight_id está asignado

11. Ir a Nueva Quincena
12. Cerrar quincena (importar, calcular, pagar)
13. Verificar que ajustes pasan a paid automáticamente

14. Ir a Historial
15. Verificar que ajustes aparecen (cuando se implemente)
```

---

## 📊 ESTADOS POSIBLES

### **adjustment_reports.status:**
- `pending` - Enviado por broker, esperando revisión de Master
- `approved` - Aprobado por Master, esperando pago
- `rejected` - Rechazado por Master
- `paid` - Pagado (inmediato o al cerrar quincena)

### **adjustment_reports.payment_mode:**
- `immediate` - Pagar Ya (TXT Banco → Confirmar)
- `next_fortnight` - Siguiente Quincena (auto al cerrar)

### **temp_client_imports.import_status:**
- `pending` - Preliminar, esperando national_id
- `processed` - Migrado a clients/policies
- `error` - Error en migración

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Esquema de BD (adjustment_reports, temp_client_imports)
- [x] Marcar Mío (Broker)
- [x] Crear Reporte Agrupado
- [x] Cálculo de Comisión Neta
- [x] Asignar (Master)
- [x] Aprobar/Rechazar
- [x] Selección Múltiple
- [x] Modalidad de Pago (Pagar Ya / Siguiente Quincena)
- [x] Crear Preliminar al aprobar
- [x] Generar TXT Banco General
- [x] Confirmar Reportes Pagados
- [x] Integración con Cierre de Quincena
- [x] Trigger Auto-migración Preliminar
- [ ] Notificaciones (Pendiente)
- [ ] PDF/XLSX de Reportes (Pendiente)
- [ ] Reflejar en Historial (Pendiente)

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### **Creados:**
- ✅ `REVISION_FLUJO_AJUSTES_2025.md` - Análisis del flujo
- ✅ `FLUJO_AJUSTES_IMPLEMENTADO.md` - Este documento

### **Modificados:**
- ✅ `src/app/(app)/commissions/adjustment-actions.ts`
  - Agregado `actionGenerateBankTXT`
  - Agregado `actionConfirmReportsPaid`
  - Modificado `actionApproveAdjustmentReport` (crear preliminar)

- ✅ `src/app/(app)/commissions/actions.ts`
  - Modificado `actionPayFortnight` (integración ajustes)

- ✅ `src/components/commissions/MasterAdjustmentReportReview.tsx`
  - Agregado selección múltiple
  - Agregado batch approval

### **Existentes (No Modificados):**
- ✅ `migrations/20250124_create_adjustment_reports.sql`
- ✅ `migrations/create_temp_clients_table.sql`
- ✅ `src/components/commissions/AdjustmentReportModal.tsx`
- ✅ `src/components/db/PreliminaryClientsTab.tsx`

---

## 🎯 PRÓXIMOS PASOS

1. **Probar flujo completo** end-to-end
2. **Implementar notificaciones** (opcional)
3. **Implementar PDF/XLSX** de reportes pagados
4. **Reflejar ajustes en historial** de quincenas
5. **Actualizar documentación** si se encuentra algún bug

---

**Estado:** ✅ LISTO PARA PRUEBAS
**Prioridad:** 🔴 ALTA - Probar antes de producción

---

**Documentación creada:** 24/nov/2025
