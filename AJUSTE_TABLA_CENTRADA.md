# ✅ AJUSTE - TABLA DE RESUMEN CENTRADA

**Fecha:** 24 de noviembre, 2025

---

## 🎯 OBJETIVO:

Centrar la tabla de "Resumen por Corredor" en el PDF del reporte completo con márgenes iguales a izquierda y derecha.

---

## 📊 PROBLEMA ANTERIOR:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Tabla de Resumen                                 │
│  ┌──────────┬────────┬────────┬────────┐          │
│  │ Corredor │ Bruto  │ Desc.  │ Neto   │          │
│  └──────────┴────────┴────────┴────────┘          │
│                                           ↑        │
│                                    Margen grande   │
└────────────────────────────────────────────────────┘
```

**Problema:**
- ✅ Margen izquierdo: 14px
- ❌ Margen derecho: Muy grande (tabla no centrada)

---

## ✅ SOLUCIÓN IMPLEMENTADA:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│           Tabla de Resumen                        │
│      ┌──────────┬────────┬────────┬────────┐      │
│      │ Corredor │ Bruto  │ Desc.  │ Neto   │      │
│      └──────────┴────────┴────────┴────────┘      │
│      ↑                                     ↑       │
│   Margen                               Margen      │
│   igual                                igual       │
└────────────────────────────────────────────────────┘
```

---

## 🔧 CÁLCULO MATEMÁTICO:

```typescript
// Dimensiones de la página
const pageWidth = 210mm (tamaño A4)

// Anchos de columnas
const columnWidths = {
  Corredor: 90,
  Bruto: 25,
  Desc: 25,
  Neto: 25
}

// Ancho total de la tabla
const tableWidth = 90 + 25 + 25 + 25 = 165

// Margen para centrar
const marginHorizontal = (210 - 165) / 2 = 22.5

// Resultado: márgenes iguales de ~22.5mm a cada lado
```

---

## 📝 CÓDIGO IMPLEMENTADO:

```typescript
// Calcular ancho total y centrar la tabla
const tableWidth = 165; // Total: 90 + 25 + 25 + 25
const marginHorizontal = (pageWidth - tableWidth) / 2;

autoTable(doc, {
  startY: yPos,
  head: [['Corredor', 'Bruto', 'Desc.', 'Neto']],
  body: brokersTableData,
  theme: 'striped',
  styles: { fontSize: 9, cellPadding: 3, halign: 'left' },
  headStyles: { fillColor: primaryColor, fontSize: 9, halign: 'center' },
  columnStyles: {
    0: { cellWidth: 90 },               // Corredor
    1: { halign: 'right', cellWidth: 25 },  // Bruto
    2: { halign: 'right', cellWidth: 25 },  // Desc.
    3: { halign: 'right', cellWidth: 25 },  // Neto
  },
  margin: { left: marginHorizontal, right: marginHorizontal },
});
```

---

## 📐 ANCHOS DE COLUMNA:

| Columna | Ancho | Alineación | Contenido |
|---------|-------|------------|-----------|
| Corredor | 90mm | Izquierda | Nombre del broker |
| Bruto | 25mm | Derecha | Monto con % aplicado |
| Desc. | 25mm | Derecha | Total descuentos |
| Neto | 25mm | Derecha | Monto a pagar |

**Total:** 165mm
**Página:** 210mm (A4)
**Márgenes:** 22.5mm cada lado

---

## ✅ VENTAJAS DEL AJUSTE:

1. **Centrado perfecto:**
   - Márgenes iguales a izquierda y derecha
   - Tabla visualmente balanceada

2. **Anchos optimizados:**
   - Corredor: 90mm (suficiente para nombres)
   - Montos: 25mm cada uno (compacto pero legible)

3. **Estética mejorada:**
   - Tabla más profesional
   - Mejor uso del espacio
   - Más fácil de leer

---

## 🧪 VERIFICACIÓN:

### **Para probar:**
```bash
npm run dev
```

1. Ve a **Historial de Quincenas**
2. Selecciona una quincena cerrada
3. Click en **"Descargar"** → **"PDF"**
4. Verifica en la página 1:
   - ✅ Tabla está centrada
   - ✅ Márgenes iguales a izquierda y derecha
   - ✅ Las 4 columnas son visibles
   - ✅ Nombres de brokers completos
   - ✅ Montos alineados a la derecha

### **Aspecto visual:**
```
═══════════════════════════════════════════════════════
                  LÍDERES EN SEGUROS
              Reporte de Comisiones - Q1 2025
═══════════════════════════════════════════════════════

TOTALES GENERALES
...

               Resumen por Corredor

      ┌────────────────┬──────────┬──────────┬──────────┐
      │ Corredor       │ Bruto    │ Desc.    │ Neto     │
      ├────────────────┼──────────┼──────────┼──────────┤
      │ Juan Pérez     │ $750.00  │ $150.00  │ $600.00  │
      │ María López    │ $600.00  │   $0.00  │ $600.00  │
      │ Carlos Sánchez │ $810.00  │ $200.00  │ $610.00  │
      └────────────────┴──────────┴──────────┴──────────┘
           ↑                                          ↑
        Margen                                    Margen
        igual                                     igual
```

---

## 📁 ARCHIVO MODIFICADO:

**`src/lib/commission-export-utils.ts`**
- Función: `exportCompleteReportToPDF`
- Sección: Tabla de resumen por corredor
- Cambios:
  - ✅ Cálculo de `marginHorizontal` dinámico
  - ✅ Anchos de columna ajustados (90, 25, 25, 25)
  - ✅ Márgenes centrados automáticamente

---

## 🎨 ANTES vs AHORA:

### **ANTES:**
```
Margen izq: 14mm
Tabla: 190mm
Margen der: ~6mm  ❌ (desbalanceado)
```

### **AHORA:**
```
Margen izq: 22.5mm  ✅
Tabla: 165mm
Margen der: 22.5mm  ✅ (perfectamente centrado)
```

---

## ✅ RESULTADO:

La tabla de resumen ahora está **perfectamente centrada** en el PDF con:
- ✅ Márgenes iguales a izquierda y derecha
- ✅ Ancho optimizado para contenido
- ✅ Mejor apariencia visual
- ✅ Más profesional

---

**¡La tabla ahora se ve balanceada y centrada!** 📊✨
