# ✅ FLUJO DE AJUSTES 100% COMPLETO

**Fecha:** 24 de noviembre, 2025
**Estado:** 🎉 **COMPLETADO AL 100%**

---

## 🎯 IMPLEMENTACIÓN COMPLETA

### **✅ 1. NOTIFICACIONES** 
**Cuando broker envía reporte**

**Ubicación:** `src/app/(app)/commissions/adjustment-actions.ts`

```typescript
// En actionCreateAdjustmentReport
// Después de crear el reporte

// Obtener usuarios Master
const { data: masterProfiles } = await supabase
  .from('profiles')
  .select('id, email, full_name')
  .eq('role', 'master');

// Crear notificación para cada Master
const notifications = masterProfiles.map((master: any) => ({
  user_id: master.id,
  title: 'Nuevo Reporte de Ajustes',
  message: `${brokerName} ha enviado un reporte de ajustes con ${pendingItems.length} item(s) por un total de $${totalBrokerCommission.toFixed(2)}`,
  type: 'adjustment_report',
  data: JSON.stringify({
    report_id: report.id,
    broker_id: brokerId,
    broker_name: brokerName,
    items_count: pendingItems.length,
    total_amount: totalBrokerCommission
  })
}));

await supabase.from('notifications').insert(notifications);
```

**Resultado:**
- ✅ Master recibe notificación inmediata
- ✅ Aparece en campanita del sistema
- ✅ Incluye detalles del reporte

---

### **✅ 2. DESCARGAS PDF/XLSX**
**De reportes pagados**

**Archivos creados:**
- `src/lib/commissions/adjustment-pdf.ts`
- `src/lib/commissions/adjustment-xlsx.ts`

**Funciones disponibles:**
```typescript
import { downloadAdjustmentPDF } from '@/lib/commissions/adjustment-pdf';
import { downloadAdjustmentXLSX } from '@/lib/commissions/adjustment-xlsx';

// Uso:
downloadAdjustmentPDF(report); // Genera y descarga PDF
downloadAdjustmentXLSX(report); // Genera y descarga Excel
```

**Contenido del PDF:**
- Header con logo/título
- Información del reporte (broker, fechas, modalidad de pago)
- Tabla con items (póliza, cliente, aseguradora, montos)
- Total general
- Footer con fecha de generación

**Contenido del Excel:**
- Hoja con información general
- Tabla de items detallada
- Formato numérico para montos
- Total calculado

---

### **✅ 3. HISTORIAL DE QUINCENAS**
**Mostrar ajustes con detalles completos**

#### **3.1 Backend - Cálculo de Totales**
**Modificado:** `src/app/api/commissions/fortnight-export/route.ts`

**Lógica implementada:**
```typescript
// 1. Obtener ajustes aprobados para esta quincena
const { data: adjustmentReports } = await supabase
  .from('adjustment_reports')
  .select(`
    id, broker_id, total_amount,
    brokers!inner(id, name, email, percent_default),
    adjustment_report_items!inner(
      id, commission_raw, broker_commission,
      pending_items!inner(
        policy_number, insured_name, insurer_id,
        insurers!inner(id, name)
      )
    )
  `)
  .eq('fortnight_id', fortnightId)
  .eq('status', 'approved')
  .eq('payment_mode', 'next_fortnight');

// 2. Procesar ajustes y agregarlos al total bruto
(adjustmentReports || []).forEach((report: any) => {
  const broker = brokerMap.get(report.broker_id);
  
  (report.adjustment_report_items || []).forEach((item: any) => {
    const brokerCommission = Number(item.broker_commission);
    
    // ✅ SUMAR AL TOTAL BRUTO DEL BROKER
    broker.total_gross += brokerCommission;
    broker.total_net += brokerCommission;
    
    // ✅ AGRUPAR POR ASEGURADORA
    adjustments.insurers.set(insurerId, {
      insurer_id: insurerId,
      insurer_name: insurerName,
      items: [...],
      total: brokerCommission
    });
  });
});

// 3. El total bruto ahora incluye:
// - Comisiones de reportes importados
// - Ajustes aprobados para esta quincena
// LUEGO se aplican descuentos de adelantos
// RESULTADO: Total neto después de descuentos
```

**Flujo correcto:**
```
Total Bruto = Importados + Ajustes
Total con Descuentos = Total Bruto - Adelantos
Total Neto = Total con Descuentos
```

---

#### **3.2 Frontend - Vista en Nueva Quincena**

**Cuando se abre una nueva quincena:**
1. ✅ Ajustes aprobados con `payment_mode='next_fortnight'` aparecen automáticamente
2. ✅ Se muestran en **sección separada "AJUSTES"**
3. ✅ Agrupados por aseguradora (igual que reportes regulares)
4. ✅ Cada cliente muestra:
   - Póliza
   - Nombre
   - Monto crudo (prima)
   - Porcentaje del broker
   - Comisión neta calculada
5. ✅ Se suman al total bruto ANTES de adelantos

**Ejemplo visual:**
```
┌─────────────────────────────────────────┐
│ BROKER: Juan Pérez                      │
│ Total Bruto: $15,500 (incluye ajustes) │
│ Adelantos: -$2,000                      │
│ Total Neto: $13,500                     │
└─────────────────────────────────────────┘

┌─ ⚠️ AJUSTES ───────────────────────────┐
│ Total Ajustes: $2,500                   │
│                                          │
│ 🏢 MAPFRE (Ajustes)                     │
│   ├─ Póliza: 12345 - María López       │
│   │  $5,000 → 15% → $750                │
│   └─ Póliza: 67890 - Carlos Ruiz       │
│      $10,000 → 15% → $1,500             │
│   Total: $2,250                          │
│                                          │
│ 🏢 ASSA (Ajustes)                       │
│   └─ Póliza: 11111 - Ana Torres        │
│      $1,500 → 15% → $250                │
│   Total: $250                            │
└──────────────────────────────────────────┘

┌─ ASEGURADORAS REGULARES ───────────────┐
│ (reportes importados normalmente)       │
└──────────────────────────────────────────┘
```

---

#### **3.3 Frontend - Vista en Historial**
**Modificado:** `src/components/commissions/FortnightDetailView.tsx`

**Características:**
- ✅ Sección "AJUSTES" con fondo ámbar/naranja (se distingue visualmente)
- ✅ Agrupado por aseguradora
- ✅ Lista de clientes con detalle completo:
  - Póliza y nombre
  - Monto crudo → Porcentaje → Comisión neta
- ✅ Total de ajustes por aseguradora
- ✅ Total general de ajustes del broker
- ✅ Se suma al total bruto (ya incluido en cálculo)

**Código implementado:**
```tsx
{broker.adjustments && broker.adjustments.total > 0 && (
  <div className="mb-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl">
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg font-bold text-amber-800">⚠️ AJUSTES</span>
      <Badge className="bg-amber-600 text-white">
        {formatCurrency(broker.adjustments.total)}
      </Badge>
    </div>

    {/* Ajustes por Aseguradora */}
    {broker.adjustments.insurers.map((adjInsurer: any) => (
      <div className="border border-amber-200 bg-white rounded-lg">
        {/* Header de Aseguradora */}
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 p-3">
          <h4>{adjInsurer.insurer_name}</h4>
          <span>{formatCurrency(adjInsurer.total)}</span>
        </div>

        {/* Lista de Clientes */}
        {adjInsurer.items.map((item: any) => (
          <div className="flex justify-between p-2">
            <div>
              <p>{item.policy_number}</p>
              <p>{item.insured_name}</p>
            </div>
            <div>
              <p>${item.commission_raw.toFixed(2)}</p>
              <p>{item.percentage}% → ${item.broker_commission.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
)}
```

---

## 📊 RESUMEN DEL FLUJO COMPLETO

### **Escenario: Ajustes en "Siguiente Quincena"**

#### **Día 1: Broker solicita ajuste**
```
1. Broker marca 3 clientes
2. Envía reporte de ajustes
3. Total: $4,500 neto
```

#### **Día 2: Master aprueba**
```
1. Master recibe notificación ✅
2. Revisa reporte
3. Elige "Siguiente Quincena"
4. Status: 'approved', payment_mode='next_fortnight'
5. Se asigna a próxima quincena DRAFT
6. Se crean registros en preliminar ✅
```

#### **Día 5: Nueva Quincena Abierta**
```
NUEVA QUINCENA - VISTA MASTER

┌─ BROKER: Juan Pérez ───────────────┐
│                                     │
│ 📊 RESUMEN                          │
│ Total Importado: $25,000           │
│ Total Ajustes: $4,500 ✅           │
│ ────────────────────                │
│ Total Bruto: $29,500               │
│ Adelantos: -$3,000                 │
│ ────────────────────                │
│ Total Neto: $26,500                │
│                                     │
│ ⚠️ AJUSTES                         │
│ ├─ MAPFRE: $3,500                  │
│ │  ├─ Cliente A: $1,500            │
│ │  └─ Cliente B: $2,000            │
│ └─ ASSA: $1,000                    │
│    └─ Cliente C: $1,000            │
│                                     │
│ 🏢 REPORTES REGULARES              │
│ └─ (importados normalmente)        │
└─────────────────────────────────────┘
```

#### **Día 15: Cierre de Quincena**
```
1. Master click "Cerrar y Pagar"
2. Sistema calcula:
   - Total Bruto (incluye ajustes) ✅
   - Aplica adelantos
   - Calcula Total Neto
3. Reportes de ajustes pasan a status='paid' ✅
4. Se genera TXT bancario
5. Se paga a brokers
```

#### **Después: Historial**
```
HISTORIAL - QUINCENA 15-30 NOV

┌─ BROKER: Juan Pérez ───────────────┐
│ Pagado: $26,500                    │
│                                     │
│ [Expandir] ▼                        │
│                                     │
│ ⚠️ AJUSTES ($4,500)                │
│ ├─ MAPFRE                          │
│ │  ├─ 12345 - Cliente A            │
│ │  │  $10,000 → 15% → $1,500       │
│ │  └─ 67890 - Cliente B            │
│ │     $15,000 → 15% → $2,000       │
│ └─ ASSA                            │
│    └─ 11111 - Cliente C            │
│       $7,500 → 15% → $1,000        │
│                                     │
│ 🏢 MAPFRE (Regular)                │
│ └─ (reportes normales)             │
│                                     │
│ Total Bruto: $29,500               │
│ Adelantos: -$3,000                 │
│ Total Neto: $26,500 ✅             │
└─────────────────────────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### **Notificaciones:**
- ✅ `src/app/(app)/commissions/adjustment-actions.ts` (línea 137-175)

### **Descargas:**
- ✅ `src/lib/commissions/adjustment-pdf.ts` (nuevo)
- ✅ `src/lib/commissions/adjustment-xlsx.ts` (nuevo)

### **Backend - Cálculo:**
- ✅ `src/app/api/commissions/fortnight-export/route.ts` (líneas 47-203)

### **Frontend - UI:**
- ✅ `src/components/commissions/FortnightDetailView.tsx` (líneas 1-15, 20-43, 329-378)

---

## ✅ CHECKLIST FINAL

### **Funcionalidades Core:**
- [x] Broker marca "mío" con selección múltiple
- [x] Master asigna con selección múltiple
- [x] Crear reporte agrupado
- [x] Cálculo automático neto (broker_percent)
- [x] Aprobar/Editar/Rechazar reportes
- [x] Modal pagar ya / siguiente quincena
- [x] Generar TXT Banco General
- [x] Confirmar reportes pagados
- [x] Integración con cierre de quincena
- [x] Creación de preliminar al aprobar
- [x] Trigger auto-migración preliminar

### **Funcionalidades Adicionales:**
- [x] **Notificaciones a Master** ✅ NUEVO
- [x] **Descargas PDF/XLSX** ✅ NUEVO
- [x] **Ajustes en Nueva Quincena** ✅ NUEVO
- [x] **Ajustes en Historial** ✅ NUEVO
- [x] **Sección separada visualmente** ✅ NUEVO
- [x] **Agrupado por aseguradora** ✅ NUEVO
- [x] **Detalle de clientes completo** ✅ NUEVO
- [x] **Suma al total bruto** ✅ NUEVO
- [x] **Aplicación de adelantos correcta** ✅ NUEVO

---

## 🧪 TESTING

### **Test 1: Notificaciones**
```
1. Login como Broker
2. Crear reporte de ajustes
3. Enviar
4. Logout, Login como Master
5. ✅ Verificar notificación en campanita
6. ✅ Click en notificación → ir a reporte
```

### **Test 2: PDF/XLSX**
```
1. Login como Master
2. Ir a reportes pagados
3. Seleccionar un reporte
4. Click "Descargar PDF"
5. ✅ Verificar PDF con todos los detalles
6. Click "Descargar Excel"
7. ✅ Verificar Excel con formato correcto
```

### **Test 3: Ajustes en Nueva Quincena**
```
1. Crear reporte de ajustes
2. Master aprueba con "Siguiente Quincena"
3. Ir a "Nueva Quincena"
4. ✅ Verificar sección "AJUSTES" visible
5. ✅ Ver clientes agrupados por aseguradora
6. ✅ Verificar que total bruto incluye ajustes
7. Cerrar quincena
8. ✅ Verificar que se aplicaron adelantos correctamente
```

### **Test 4: Historial Completo**
```
1. Ir a "Historial de Quincenas"
2. Expandir una quincena cerrada
3. Expandir un broker
4. ✅ Ver sección "AJUSTES" con fondo ámbar
5. ✅ Ver aseguradoras de ajustes
6. ✅ Ver clientes con detalle (póliza, nombre, montos, %)
7. ✅ Verificar totales correctos
8. ✅ Descargar reporte completo
```

---

## 🎉 ESTADO FINAL

**FLUJO DE AJUSTES: 100% COMPLETO** ✅

### **Implementado:**
1. ✅ Modo selección automático (Broker y Master)
2. ✅ Crear/Editar/Aprobar/Rechazar reportes
3. ✅ Modalidades de pago (Ya / Siguiente Quincena)
4. ✅ TXT Banco General
5. ✅ Confirmar pagados
6. ✅ Integración con cierre de quincena
7. ✅ Preliminar y auto-migración
8. ✅ **Notificaciones** 🆕
9. ✅ **Descargas PDF/XLSX** 🆕
10. ✅ **Visualización en Nueva Quincena** 🆕
11. ✅ **Visualización en Historial** 🆕
12. ✅ **Cálculo correcto de totales** 🆕

---

**Documentación completa:**
- `FLUJO_AJUSTES_FINAL.md` - Flujo básico
- `FLUJO_AJUSTES_100_COMPLETO.md` - Este documento (100%)

**Próximo paso:** 🚀 **DEPLOY A PRODUCCIÓN**
