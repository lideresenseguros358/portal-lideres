# ✅ MEJORAS EN REPORTES DE COMISIONES

**Fecha:** 24 de noviembre, 2025

---

## 📋 MEJORAS IMPLEMENTADAS:

### **1. REPORTE COMPLETO - Tabla Resumen** ✅

**ANTES:**
| Corredor | Bruto | Neto |
|----------|-------|------|

**AHORA:**
| Corredor | % | Bruto | Neto | Desc. | Pagado | Ret. |
|----------|---|-------|------|-------|--------|------|

**Columnas agregadas:**
- ✅ **%**: Porcentaje de comisión aplicado
- ✅ **Desc.**: Total de descuentos (adelantos)
- ✅ **Pagado**: Total neto menos descuentos (lo que realmente se paga)
- ✅ **Ret.**: Indicador si la comisión está retenida (SÍ/NO)

**Alineación visual:** ✅ Corregida - Todas las columnas numéricas alineadas a la derecha

---

### **2. REPORTE COMPLETO - Detalle por Broker** ✅

**Información agregada:**

#### **A. Sección de Totales:**
```
Total Bruto: $5,000.00
Total Neto (sin desc.): $750.00

DESCUENTOS:
- Adelanto Quincena Anterior: -$100.00
- Préstamo Personal: -$50.00
Total Descuentos: -$150.00
_________________________________
TOTAL PAGADO: $600.00

⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO (si aplica)
```

#### **B. Detalles de Descuentos:**
- ✅ Descripción específica de cada descuento
- ✅ Monto de cada descuento
- ✅ Total de descuentos
- ✅ Cálculo final de total pagado

#### **C. Indicador de Retención:**
- ✅ Alerta visual si la comisión fue retenida
- ✅ Mensaje claro: "RETENCIÓN APLICADA - PENDIENTE DE PAGO"

---

### **3. REPORTE EXCEL COMPLETO** ✅

#### **Hoja "Resumen":**

**ANTES:**
```
Corredor | Email | Bruto | Neto
```

**AHORA:**
```
Corredor | Email | % | Bruto | Neto | Descuentos | Total Pagado | Retenido
```

#### **Hojas Individuales por Broker:**

**Información agregada:**
```
NOMBRE BROKER
Email: broker@email.com
Período: Q1 - nov. 2025
Porcentaje: 15%

[Detalle de aseguradoras y pólizas]

RESUMEN
Total Bruto: $5,000.00
Total Neto (sin desc.): $750.00

DESCUENTOS:
- Adelanto Quincena Anterior: -$100.00
- Préstamo Personal: -$50.00
Total Descuentos: -$150.00

TOTAL PAGADO: $600.00

⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO (si aplica)
```

---

### **4. ESTRUCTURA DE DATOS** ✅

#### **Endpoint `/api/commissions/fortnight-export`:**

**Campos agregados a cada broker:**
```typescript
{
  broker_id: string,
  broker_name: string,
  broker_email: string,
  percent_default: number,
  total_gross: number,
  total_net: number,
  discounts_json: {
    adelantos: [
      {
        description: string,  // "Adelanto Quincena Anterior"
        amount: number        // 100.00
      }
    ],
    total: number            // 150.00
  },
  is_retained: boolean,      // ✅ NUEVO
  insurers: [...]
}
```

---

## 📊 EJEMPLOS VISUALES:

### **PDF - Tabla Resumen:**
```
┌──────────────────┬────┬───────────┬───────────┬──────────┬───────────┬─────┐
│ Corredor         │ %  │ Bruto     │ Neto      │ Desc.    │ Pagado    │ Ret.│
├──────────────────┼────┼───────────┼───────────┼──────────┼───────────┼─────┤
│ Juan Pérez       │ 15%│ $5,000.00 │ $750.00   │ $150.00  │ $600.00   │ NO  │
│ María López      │ 20%│ $3,000.00 │ $600.00   │ $0.00    │ $600.00   │ SÍ  │
│ Carlos Sánchez   │ 18%│ $4,500.00 │ $810.00   │ $200.00  │ $610.00   │ NO  │
└──────────────────┴────┴───────────┴───────────┴──────────┴───────────┴─────┘
```

### **PDF - Detalle de Broker:**
```
═══════════════════════════════════════════════════════
                    JUAN PÉREZ
             juan@email.com | Q1 - nov. 2025
═══════════════════════════════════════════════════════

[Aseguradoras y Pólizas...]

───────────────────────────────────────────────────────
Total Bruto:                                 $5,000.00
Total Neto (sin desc.):                        $750.00

DESCUENTOS:
- Adelanto Quincena Anterior:                 -$100.00
- Préstamo Personal:                           -$50.00
Total Descuentos:                             -$150.00

───────────────────────────────────────────────────────
TOTAL PAGADO:                                  $600.00
```

### **Excel - Hoja Individual:**
```
A                      B            C       D     E
Juan Pérez
Email:                juan@email.com
Período:              Q1 - nov. 2025
Porcentaje:           15%

ASSA                                               $2,500.00
Póliza    Cliente         Bruto      %     Neto
AUTO-123  Cliente A      $1,500.00  15%   $225.00
AUTO-456  Cliente B      $1,000.00  15%   $150.00

RESUMEN
Total Bruto:                                 $5,000.00
Total Neto (sin desc.):                        $750.00

DESCUENTOS:
- Adelanto Quincena Anterior:                 -$100.00
- Préstamo Personal:                           -$50.00
Total Descuentos:                             -$150.00

TOTAL PAGADO:                                  $600.00

⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO
```

---

## 🔧 ARCHIVOS MODIFICADOS:

1. ✅ **`src/app/api/commissions/fortnight-export/route.ts`**
   - Obtiene `discounts_json` y `is_retained` desde `fortnight_broker_totals`
   - Incluye en respuesta de cada broker

2. ✅ **`src/lib/commission-export-utils.ts`**
   - **`exportCompleteReportToPDF`**: 
     - Tabla resumen con 7 columnas
     - Detalle de descuentos por broker
     - Indicador de retención
   - **`exportCompleteReportToExcel`**: 
     - Hoja resumen con 8 columnas
     - Hojas individuales con descuentos y retención

---

## 🧪 CÓMO PROBAR:

### **1. Reiniciar Servidor**
```bash
npm run dev
```

### **2. Ir a Historial de Quincenas**
1. **Comisiones** → **Historial de Quincenas**
2. Expande una quincena cerrada
3. Click **"Descargar"**
4. Selecciona **PDF** o **Excel**

### **3. Verificar en el Reporte**

#### **PDF - Página 1 (Resumen):**
- ✅ Tabla con 7 columnas alineadas
- ✅ Columna % muestra porcentaje
- ✅ Columna Desc. muestra descuentos
- ✅ Columna Pagado muestra neto final
- ✅ Columna Ret. muestra SÍ/NO

#### **PDF - Páginas de Detalle:**
- ✅ Sección "Total Bruto"
- ✅ Sección "Total Neto (sin desc.)"
- ✅ Sección "DESCUENTOS:" con lista
- ✅ Cada descuento con descripción y monto
- ✅ "Total Descuentos" sumado
- ✅ "TOTAL PAGADO" en verde
- ✅ Alerta de retención si aplica

#### **Excel - Hoja Resumen:**
- ✅ 8 columnas con headers claros
- ✅ Todos los datos de todos los brokers

#### **Excel - Hojas Individuales:**
- ✅ Porcentaje del broker en header
- ✅ Sección RESUMEN al final
- ✅ Sección DESCUENTOS con detalle
- ✅ TOTAL PAGADO calculado
- ✅ Alerta de retención si aplica

---

## 📝 NOTAS IMPORTANTES:

### **Descuentos:**
- Se obtienen desde `fortnight_broker_totals.discounts_json`
- Estructura: `{ adelantos: [{description, amount}], total: number }`
- Se muestran como lista detallada con descripción y monto
- Se restan del neto para calcular total pagado

### **Retención:**
- Se obtiene desde `fortnight_broker_totals.is_retained`
- Si es `true`, muestra alerta visual
- Indica que el pago está pendiente

### **Porcentaje:**
- Se obtiene desde `brokers.percent_default`
- Se muestra como % en reportes
- Útil para auditoría y verificación

### **Alineación Visual:**
- Columnas numéricas: Alineadas a la derecha
- Columnas de texto: Alineadas a la izquierda
- Columnas de porcentaje/indicadores: Centradas

---

## ✅ RESULTADO FINAL:

Los reportes ahora incluyen:

| Característica | Estado |
|----------------|--------|
| Tabla resumen con 7 columnas | ✅ |
| Porcentaje de comisión | ✅ |
| Descuentos detallados | ✅ |
| Total pagado calculado | ✅ |
| Indicador de retención | ✅ |
| Alineación visual correcta | ✅ |
| Sección de descuentos en detalle | ✅ |
| Alerta visual de retención | ✅ |

---

## 🚀 PRÓXIMAS MEJORAS (NO IMPLEMENTADAS):

> **Nota del usuario:** También mencionaste:
> - **Ajustes de quincenas anteriores**: Detallar de qué quincena viene un ajuste
> 
> Esto requeriría:
> 1. Agregar campo `adjustment_from_fortnight_id` en `comm_items` o `fortnight_details`
> 2. Mostrar en reportes: "Ajuste de Q2 - oct. 2024"
> 
> ¿Quieres que implemente esto también?

---

**Estado:** ✅ COMPLETADO
**Archivos:** 2 modificados
**Líneas:** ~150 líneas agregadas/modificadas
