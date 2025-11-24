# 🔄 REVISIÓN COMPLETA DEL FLUJO DE AJUSTES

**Fecha:** 24 de noviembre, 2025
**Objetivo:** Verificar y completar el flujo completo de ajustes desde la perspectiva de broker y master

---

## 📋 FLUJO REQUERIDO POR EL USUARIO

### **Vista Broker:**
1. ✅ Ver comisiones sin identificar (pending_items)
2. ✅ Botón "Marcar Mío" - seleccionar varios items
3. ✅ Crear reporte agrupado con cálculo de comisión neta (broker_percent aplicado)
4. ⚠️ Al enviar: notificación a Master "Nuevo reporte de ajustes de [Broker]"

### **Vista Master:**
1. ✅ Botón "Asignar" a broker específico
2. ✅ Ver reportes enviados por brokers
3. ✅ Aprobar/Rechazar reportes
4. ✅ Al aprobar, elegir:   - "Pagar Ya" → marcar como paid inmediatamente
   - "Siguiente Quincena" → status 'approved', asignar a fortnight DRAFT
5. ⚠️ Seleccionar múltiples reportes para aprobar en batch
6. ❌ Descargar TXT Banco General para "Pagar Ya"
7. ❌ Confirmar reportes como pagados después de descargar TXT
8. ✅ Cuando se cierra quincena, reportes "siguiente quincena" pasan a paid

### **Preliminar:**
9. ✅ Al aprobar ajuste, crear registro en temp_client_imports
10. ✅ Trigger automático: cuando national_id se completa → migrar a clients/policies
11. ✅ Broker puede completar info desde vista preliminar

### **Reportes:**
12. ❌ Descargar PDF/XLSX de reportes pagados

---

## ✅ LO QUE YA FUNCIONA

### **1. Esquema de Base de Datos**
```sql
-- adjustment_reports
- id, broker_id, status, total_amount
- payment_mode: 'immediate' | 'next_fortnight'
- fortnight_id (para siguiente quincena)
- paid_date, reviewed_by

-- adjustment_report_items
- report_id, pending_item_id
- commission_raw, broker_commission ✅

-- temp_client_imports
- Trigger automático para migración ✅
```

### **2. Actions Implementadas**
- ✅ `actionCreateAdjustmentReport` - Broker crea reporte
- ✅ `actionApproveAdjustmentReport` - Master aprueba con modo pago
- ✅ `actionRejectAdjustmentReport` - Master rechaza
- ✅ `actionGetAdjustmentReports` - Obtiene reportes

### **3. Componentes UI**
- ✅ `AdjustmentReportModal` - Broker selecciona y envía
- ✅ `MasterAdjustmentReportReview` - Master aprueba/rechaza
- ✅ `PreliminaryClientsTab` - Vista preliminar

---

## ❌ LO QUE FALTA IMPLEMENTAR

### **1. Notificaciones**
**Requerimiento:** Cuando broker envía reporte, notificar a Master

**Solución:**
```typescript
// En actionCreateAdjustmentReport, después de crear el reporte:
// 1. Obtener email de Master
// 2. Enviar notificación (email o sistema interno)
// 3. Actualizar contador en dashboard de Master
```

### **2. Selección Múltiple en Master**
**Requerimiento:** Master puede seleccionar varios reportes para aprobar en batch

**Solución:**
- Agregar checkboxes en lista de reportes
- Botón "Aprobar Seleccionados"
- Modal con opción de pago para todos

### **3. Generación de TXT Banco General**
**Requerimiento:** Para reportes con "Pagar Ya", generar archivo TXT Banco General

**Formato TXT:**
```
BROKER_ID|NOMBRE_COMPLETO|TIPO_CUENTA|CUENTA|MONTO|DESCRIPCION|FECHA
broker1|Juan Perez|AHORROS|1234567890|500.00|AJUSTES|24/11/2025
```

**Implementar:**
```typescript
export async function actionGenerateBankTXT(reportIds: string[]) {
  // 1. Obtener reportes aprobados con payment_mode='immediate'
  // 2. Obtener datos bancarios de brokers
  // 3. Generar contenido TXT
  // 4. Retornar para descarga
}
```

### **4. Confirmar Pagados**
**Requerimiento:** Después de descargar TXT, confirmar que se pagaron

**Flujo:**
1. Master descarga TXT (reportes quedan en status 'approved', payment_mode='immediate')
2. Master hace pago en banco
3. Master regresa y clickea "Confirmar Pagados"
4. Reportes pasan a status 'paid' con paid_date

**Implementar:**
```typescript
export async function actionConfirmReportsPaid(reportIds: string[]) {
  // UPDATE adjustment_reports
  // SET status = 'paid', paid_date = NOW()
  // WHERE id = ANY(reportIds) AND payment_mode = 'immediate'
}
```

### **5. Integración con Cierre de Quincena**
**Requerimiento:** Al cerrar quincena, reportes "siguiente quincena" pasan a paid

**Implementar en `actionPayFortnight`:**
```typescript
// Cuando se cierra quincena:
// 1. Obtener reportes aprobados con fortnight_id = current_fortnight
// 2. Marcar como paid
// 3. Actualizar paid_date
```

### **6. Descarga PDF/XLSX de Reportes Pagados**
**Requerimiento:** Cada reporte pagado debe poder descargarse en PDF y XLSX

**Implementar:**
```typescript
export async function actionDownloadAdjustmentReportPDF(reportId: string) {
  // Generar PDF con:
  // - Datos del broker
  // - Lista de items
  // - Total
  // - Fecha de pago
}

export async function actionDownloadAdjustmentReportXLSX(reportId: string) {
  // Generar Excel con mismo contenido
}
```

### **7. Reflejar en Historial de Quincenas**
**Requerimiento:** Ajustes deben aparecer en historial de quincenas

**Implementar:**
- En `actionGetClosedFortnights`: incluir ajustes de la quincena
- En `FortnightDetailView`: mostrar sección de ajustes

---

## 🔧 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Funcionalidad Crítica** ⭐
1. ✅ Selección múltiple de reportes (Master)
2. ✅ Generación de TXT Banco General
3. ✅ Confirmar reportes como pagados
4. ✅ Integración con cierre de quincena

### **Fase 2: Mejoras UX**
5. ✅ Notificaciones al enviar reporte
6. ✅ Descarga PDF/XLSX de reportes

### **Fase 3: Integración Completa**
7. ✅ Reflejar ajustes en historial
8. ✅ Vista consolidada de ajustes por broker

---

## 📊 ESTADO ACTUAL

| Componente | Estado | Prioridad |
|------------|--------|-----------|
| Marcar Mío (Broker) | ✅ Funciona | - |
| Crear Reporte Agrupado | ✅ Funciona | - |
| Asignar (Master) | ✅ Funciona | - |
| Aprobar/Rechazar | ✅ Funciona | - |
| Selección Múltiple | ❌ Falta | 🔴 Alta |
| TXT Banco General | ❌ Falta | 🔴 Alta |
| Confirmar Pagados | ❌ Falta | 🔴 Alta |
| Cierre Quincena Integration | ❌ Falta | 🔴 Alta |
| Notificaciones | ❌ Falta | 🟡 Media |
| PDF/XLSX Reports | ❌ Falta | 🟡 Media |
| Historial Quincenas | ❌ Falta | 🟢 Baja |
| Preliminar | ✅ Funciona | - |
| Trigger Auto-migración | ✅ Funciona | - |

---

## 🎯 PRÓXIMOS PASOS

1. **Crear componente de selección múltiple para Master**
2. **Implementar generación de TXT Banco General**
3. **Agregar flujo de confirmación de pagos**
4. **Integrar con cierre de quincena**
5. **Agregar notificaciones**
6. **Implementar descarga de reportes**

---

**Archivo de seguimiento:** `REVISION_FLUJO_AJUSTES_2025.md`
