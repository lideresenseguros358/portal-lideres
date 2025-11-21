# ACTUALIZACIÓN DE REPORTES DE ASEGURADORAS

## 📊 RESUMEN DE CAMBIOS IMPLEMENTADOS

He reorganizado completamente el sistema de comisiones para que use los reportes REALES de las aseguradoras y calcule correctamente los totales de oficina.

---

## ✅ CAMBIOS EN CÓDIGO IMPLEMENTADOS

### 1. **Backend (actions.ts)**

**Cambios en `actionGetClosedFortnights`:**

```typescript
// ANTES: Calculaba desde comm_items
const total_imported = commItems.reduce(...);
const total_paid_gross = brokerTotals.reduce((sum, bt) => sum + bt.gross_amount, 0);

// AHORA: Usa reportes reales y netos
const total_imported = (commImports || []).reduce((sum, imp) => sum + imp.total_amount, 0);
const total_paid_net = brokerTotals.reduce((sum, bt) => sum + bt.net_amount, 0);
const total_office_profit = total_imported - total_paid_net;
```

**Nueva estructura de `totalsByInsurer`:**
```typescript
{
  name: string;
  total: number;        // Reporte real de aseguradora
  paid: number;         // Lo pagado a corredores
  office_total: number; // Ganancia oficina (total - paid)
}
```

### 2. **Frontend (PreviewTab.tsx)**

- ✅ Actualizada interface `FortnightData`
- ✅ Eliminada constante `INSURER_REPORT_AMOUNTS`
- ✅ Eliminada función `generateInsurerReports`
- ✅ Tabla simplificada usando datos del backend
- ✅ Contador "Total Pagado a Corredores" muestra neto

### 3. **Exportación (commission-export-utils.ts)**

- ✅ PDF: Usa `total_paid_net` en lugar de `total_paid_gross`
- ✅ Excel: Usa `total_paid_net` en lugar de `total_paid_gross`
- ✅ Labels actualizados: "Total Pagado a Corredores (Neto)"

---

## 🗄️ PASO CRÍTICO: ACTUALIZAR BASE DE DATOS

### **Script Creado:** `scripts/update-insurer-reports.mjs`

Este script insertará/actualizará los reportes reales en la tabla `comm_imports`:

```javascript
const INSURER_REPORTS = {
  'ASSA': 4108.37,
  'SURA': 1244.54,
  'VIVIR': 424.53,
  'INTERNACIONAL': 1043.01,
  'FEDPA': 1754.25,
  'ANCON': 1295.97,
  'BANESCO': 36.65,
  'REGIONAL': 511.92,
  'OPTIMA': 172.59,
  'ACERTA': 89.39,
};
```

### **Cómo Ejecutar:**

1. **Asegúrate de tener las variables de entorno:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Ejecutar:**
   ```bash
   node scripts/update-insurer-reports.mjs
   ```

3. **El script hará:**
   - Buscar cada aseguradora por nombre
   - Crear/actualizar registro en `comm_imports`
   - Asociar al período de la última quincena cerrada

---

## 📈 CÓMO FUNCIONAN LOS CÁLCULOS AHORA

### **1. Total Comisiones Importadas**
```typescript
// Suma de reportes REALES de comm_imports
const total_imported = commImports.reduce((sum, imp) => sum + imp.total_amount, 0);
```
**Esperado:** $10,681.22 (suma de todos los reportes que diste)

### **2. Total Pagado a Corredores**
```typescript
// Suma de montos NETOS pagados
const total_paid_net = brokerTotals.reduce((sum, bt) => sum + bt.net_amount, 0);
```
**Esperado:** El total NETO después de descuentos que se pagó a brokers

### **3. Ganancia Oficina**
```typescript
// Diferencia: Reportes - Pagado Neto
const total_office_profit = total_imported - total_paid_net;
```

**Incluye:**
- ✅ Comisiones de `contacto@lideresenseguros.com` (broker oficina)
- ✅ Códigos de ASSA huérfanos
- ✅ Diferencia entre reportes y lo pagado

---

## 📊 TABLA POR ASEGURADORA

### **Columnas:**

| Columna | Descripción | Origen |
|---------|-------------|--------|
| **Total Reporte** | Monto que reportó la aseguradora | `comm_imports.total_amount` |
| **Pagado a Corredores** | Lo que se pagó en comisiones | Suma de `comm_items.gross_amount` |
| **Total Oficina** | Ganancia de oficina | `Total Reporte - Pagado` |
| **% Oficina** | Porcentaje de ganancia | `(Total Oficina / Total Reporte) × 100` |

### **Ejemplo ASSA:**
```
Total Reporte:        $4,108.37  (del reporte real)
Pagado a Corredores:  $X,XXX.XX  (suma de comm_items)
────────────────────────────────
Total Oficina:        $X,XXX.XX  (diferencia)
% Oficina:            XX.X%      (en verde si ≥20%)
```

---

## ⚠️ IMPORTANTE - COMPLETAR CIERRE DE QUINCENA

### **Antes de ver los datos correctos, necesitas:**

1. ✅ **Ejecutar el script** `update-insurer-reports.mjs`
2. ✅ **Verificar que `comm_imports` tiene los datos**
3. ✅ **Asegurar que la quincena esté cerrada** (`status='PAID'`)
4. ✅ **Verificar que todos los brokers tengan sus totales** en `fortnight_broker_totals`

### **Consulta SQL para verificar:**

```sql
-- Ver reportes insertados
SELECT 
  i.name as aseguradora,
  ci.total_amount,
  ci.period_label,
  ci.created_at
FROM comm_imports ci
JOIN insurers i ON i.id = ci.insurer_id
ORDER BY ci.total_amount DESC;

-- Verificar quincenas cerradas
SELECT 
  id,
  period_start,
  period_end,
  status
FROM fortnights
WHERE status = 'PAID'
ORDER BY period_end DESC
LIMIT 5;
```

---

## 🎯 PRÓXIMOS PASOS

### **1. Ejecutar Script de Actualización**
```bash
node scripts/update-insurer-reports.mjs
```

### **2. Verificar en Supabase**
- Ir a tabla `comm_imports`
- Verificar que hay 10 registros con los montos correctos
- Verificar `period_label` corresponde a la quincena actual

### **3. Refrescar Historial**
- Ir a `/commissions` → Historial
- Los 3 contadores principales deberían mostrar valores correctos
- La tabla por aseguradora debe mostrar porcentajes en verde (>20%)

### **4. Revisar Acumulado (próximo paso)**
Una vez que los reportes estén en BD, revisar:
- `YTDTab.tsx` - Eliminar mocks de gráficas
- Conectar con datos reales de BD
- Mostrar cifras reales de brokers y empresa

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `src/app/(app)/commissions/actions.ts` | ✅ Modificado | Usa comm_imports, calcula netos |
| `src/components/commissions/PreviewTab.tsx` | ✅ Modificado | UI simplificada, sin mocks |
| `src/lib/commission-export-utils.ts` | ✅ Modificado | Exporta con netos |
| `scripts/update-insurer-reports.mjs` | ✅ Creado | Script para insertar reportes |
| `ACTUALIZACION_REPORTES_ASEGURADORAS.md` | ✅ Creado | Esta documentación |

---

## ❓ TROUBLESHOOTING

### **Problema: Contadores en 0**
**Solución:** Ejecutar el script de actualización

### **Problema: % Oficina negativos**
**Causa:** Falta el reporte de la aseguradora en `comm_imports`
**Solución:** Agregar el reporte al script y ejecutar

### **Problema: No aparecen datos**
**Causa:** La quincena no está cerrada o no tiene `fortnight_broker_totals`
**Solución:** Completar proceso de cierre de quincena

---

## 🎉 RESULTADO ESPERADO

**Después de ejecutar el script:**

```
┌────────────────────────────────────────┐
│  HISTORIAL DE QUINCENAS                │
├────────────────────────────────────────┤
│  Total Comisiones Importadas           │
│  $10,681.22                            │ ← Suma de reportes
├────────────────────────────────────────┤
│  Total Pagado a Corredores             │
│  $X,XXX.XX                             │ ← Neto pagado
├────────────────────────────────────────┤
│  Ganancia Oficina                      │
│  $X,XXX.XX                             │ ← Diferencia (positivo)
└────────────────────────────────────────┘

TOTAL OFICINA POR ASEGURADORA
┌──────────────┬─────────┬──────────┬─────────┬─────────┐
│ Aseguradora  │ Reporte │ Pagado   │ Oficina │ % Ofic  │
├──────────────┼─────────┼──────────┼─────────┼─────────┤
│ ASSA         │ 4108.37 │ XXXX.XX  │ XXXX.XX │ 25.3% ✅│
│ FEDPA        │ 1754.25 │ XXXX.XX  │ XXXX.XX │ 22.1% ✅│
│ ANCON        │ 1295.97 │ XXXX.XX  │ XXXX.XX │ 28.5% ✅│
│ ...          │ ...     │ ...      │ ...     │ ...     │
└──────────────┴─────────┴──────────┴─────────┴─────────┘
```

---

**📞 Contacto:** Si necesitas ayuda adicional, revisa los logs del script o verifica los datos en Supabase.
