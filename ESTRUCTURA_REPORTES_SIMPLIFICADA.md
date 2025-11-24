# ✅ ESTRUCTURA SIMPLIFICADA DE REPORTES DE COMISIONES

**Fecha:** 24 de noviembre, 2025

---

## 📊 NUEVA DEFINICIÓN DE TÉRMINOS:

### **BRUTO**
Comisión con porcentaje aplicado (ej: $1,000 × 15% = $150)
- Es lo que el broker gana de comisión
- Se calcula: Monto Aseguradora × Porcentaje del Broker

### **DESCUENTOS**
Adelantos y descuentos aplicados al broker
- Adelantos de quincenas anteriores
- Préstamos
- Otros descuentos

### **NETO**
Total a pagar al broker después de descuentos
- Se calcula: Bruto - Descuentos
- Es el monto real que recibe el broker

---

## 📋 TABLA RESUMEN (TODOS LOS BROKERS):

### **Estructura:**
```
┌─────────────────────┬──────────┬──────────┬──────────┐
│ Corredor            │ Bruto    │ Desc.    │ Neto     │
├─────────────────────┼──────────┼──────────┼──────────┤
│ Juan Pérez          │ $750.00  │ $150.00  │ $600.00  │
│ María López         │ $600.00  │ $0.00    │ $600.00  │
│ Carlos Sánchez      │ $810.00  │ $200.00  │ $610.00  │
└─────────────────────┴──────────┴──────────┴──────────┘
```

**Anchos de columna:**
- Corredor: 100px
- Bruto: 30px
- Desc.: 30px
- Neto: 30px
- **Total: 190px** ✅ Cabe perfectamente en PDF

---

## 📄 DETALLE POR BROKER (PÁGINAS INDIVIDUALES):

### **Estructura:**
```
═══════════════════════════════════════════════════════
                    JUAN PÉREZ
             juan@email.com | Q1 - nov. 2025
═══════════════════════════════════════════════════════

[ASEGURADORAS Y PÓLIZAS...]

ASSA                                                $500.00
Póliza       Cliente             Bruto    %    Neto
AUTO-123     Cliente A          $1,500   15%   $225
AUTO-456     Cliente B          $1,000   15%   $150

MAPFRE                                              $250.00
Póliza       Cliente             Bruto    %    Neto
VIDA-789     Cliente C          $2,000   15%   $300

───────────────────────────────────────────────────────
Total Bruto:                                     $750.00

DESCUENTOS APLICADOS:
• Adelanto Quincena Anterior                    $100.00
• Préstamo Personal                              $50.00

Total Descuentos:                                $150.00
───────────────────────────────────────────────────────
TOTAL NETO:                                      $600.00
```

---

## 💡 CÁLCULO MATEMÁTICO:

### **Ejemplo completo:**

**Pólizas del Broker:**
```
Póliza AUTO-123: Prima $10,000 × 15% = $1,500 (bruto)
Póliza VIDA-789: Prima $5,000  × 15% = $750  (bruto)
```

**Comisión con porcentaje aplicado (BRUTO):**
```
$1,500 + $750 = $2,250
```

**Descuentos aplicados:**
```
- Adelanto quincena anterior: $500
- Préstamo personal: $100
Total Descuentos: $600
```

**Total a pagar (NETO):**
```
$2,250 - $600 = $1,650
```

**Fórmula:**
```
NETO = BRUTO - DESCUENTOS
```

---

## 📊 REPORTE PDF COMPLETO:

### **Página 1 - Resumen General:**

```
LÍDERES EN SEGUROS
Reporte de Comisiones - Q1 - nov. 2025

TOTALES GENERALES
Total Importado: $50,000.00
Total Pagado a Corredores (Neto): $7,500.00
Ganancia Oficina: $42,500.00

RESUMEN POR CORREDOR

┌─────────────────────┬──────────┬──────────┬──────────┐
│ Corredor            │ Bruto    │ Desc.    │ Neto     │
├─────────────────────┼──────────┼──────────┼──────────┤
│ Juan Pérez          │ $750.00  │ $150.00  │ $600.00  │
│ María López         │ $600.00  │ $0.00    │ $600.00  │
│ Carlos Sánchez      │ $810.00  │ $200.00  │ $610.00  │
└─────────────────────┴──────────┴──────────┴──────────┘
```

### **Páginas 2+ - Detalle por Broker:**

Cada broker tiene su propia página con:
1. **Header**: Nombre, email, período
2. **Aseguradoras y Pólizas**: Agrupadas por aseguradora
3. **Resumen**:
   - Total Bruto
   - Descuentos Aplicados (detallados con descripción)
   - Total Descuentos (sumatoria)
   - Total Neto
4. **Alerta**: Si hay retención aplicada

---

## 📊 REPORTE EXCEL:

### **Hoja "Resumen":**

```
A                      B                   C        D        E
LÍDERES EN SEGUROS - REPORTE COMPLETO
Período:              Q1 - nov. 2025

TOTALES GENERALES
Total Importado:                          $50,000.00
Total Pagado:                              $7,500.00
Ganancia Oficina:                         $42,500.00

RESUMEN POR CORREDOR
Corredor              Email               Bruto    Desc.    Neto
Juan Pérez            juan@email.com      $750     $150     $600
María López           maria@email.com     $600     $0       $600
Carlos Sánchez        carlos@email.com    $810     $200     $610
```

### **Hojas Individuales:**

Una hoja por broker con:

```
JUAN PÉREZ
Email:                juan@email.com
Período:              Q1 - nov. 2025
Porcentaje:           15%

ASSA                                                $500.00
Póliza       Cliente             Bruto      %      Neto
AUTO-123     Cliente A          $1,500     15%     $225
AUTO-456     Cliente B          $1,000     15%     $150

RESUMEN
Total Bruto:                                        $750.00

DESCUENTOS APLICADOS:
• Adelanto Quincena Anterior                       $100.00
• Préstamo Personal                                 $50.00

Total Descuentos:                                   $150.00

TOTAL NETO:                                         $600.00
```

---

## 🔍 ORIGEN DE LOS DATOS:

### **1. Bruto (total_net del endpoint)**
```sql
SELECT total_net 
FROM fortnight_broker_totals
WHERE fortnight_id = ? AND broker_id = ?
```

### **2. Descuentos (discounts_json)**
```json
{
  "adelantos": [
    {
      "description": "Adelanto Quincena Anterior",
      "amount": 100.00
    },
    {
      "description": "Préstamo Personal",
      "amount": 50.00
    }
  ],
  "total": 150.00
}
```

### **3. Neto (calculado)**
```typescript
const neto = bruto - (discounts_json?.total || 0);
```

---

## ✅ VENTAJAS DE LA SIMPLIFICACIÓN:

| Aspecto | Mejora |
|---------|--------|
| Claridad | ✅ Solo 3 columnas fáciles de entender |
| Espacio | ✅ Cabe perfectamente en PDF (190px vs 210px disponibles) |
| Matemática | ✅ Fórmula simple: Neto = Bruto - Desc. |
| Descuentos | ✅ Detallados con descripción en página individual |
| Auditoría | ✅ Suma de descuentos coincide con columna Desc. |

---

## 🧪 VERIFICACIÓN:

### **En la tabla resumen:**
1. ✅ 3 columnas: Corredor, Bruto, Desc., Neto
2. ✅ La tabla NO se sale del PDF
3. ✅ Números alineados a la derecha

### **En el detalle del broker:**
1. ✅ Total Bruto visible
2. ✅ Lista de descuentos con descripción
3. ✅ Total Descuentos = suma de descuentos
4. ✅ Total Neto = Bruto - Descuentos
5. ✅ Alerta de retención si aplica

### **Verificación matemática:**
```
Para cada broker:
  Bruto (de tabla resumen) = Total Bruto (de detalle)
  Desc. (de tabla resumen) = Total Descuentos (de detalle)
  Neto (de tabla resumen) = Total Neto (de detalle)
  
Validación:
  Neto = Bruto - Desc. ✅
```

---

## 📝 ARCHIVOS MODIFICADOS:

1. ✅ **`src/lib/commission-export-utils.ts`**
   - `exportCompleteReportToPDF`: Tabla de 3 columnas
   - Detalle con descuentos listados
   - `exportCompleteReportToExcel`: Hoja resumen y hojas individuales
   - `exportBrokerToPDF` y `exportBrokerToExcel`: Actualizados

---

## 🚀 LISTO PARA PROBAR:

```bash
# 1. Reiniciar servidor
npm run dev

# 2. Ir a Historial de Quincenas
# 3. Descargar reporte completo (PDF o Excel)
# 4. Verificar:
#    - Tabla con 3 columnas
#    - Detalle de descuentos en página individual
#    - Matemática correcta
```

---

## 📊 COMPARACIÓN FINAL:

### **ANTES (Complejo):**
```
Corredor | % | Bruto | Neto | Desc. | Pagado | Ret.
(7 columnas, confuso, no cabía)
```

### **AHORA (Simple):**
```
Corredor | Bruto | Desc. | Neto
(3 columnas, claro, cabe perfecto)
```

**Detalle Individual:**
```
Total Bruto: $750.00

DESCUENTOS APLICADOS:
• Adelanto Quincena Anterior    $100.00
• Préstamo Personal              $50.00
Total Descuentos:               $150.00

TOTAL NETO:                     $600.00
```

---

✅ **ESTRUCTURA SIMPLIFICADA COMPLETADA**
