# RESUMEN CORRECCIONES URGENTES
**Fecha:** 2025-10-03 02:45  
**Estado:** EN PROGRESO

---

## ✅ COMPLETADO

### 1. SQL Brokers - Campos Bancarios ✅
**Archivo:** `migrations/fix_brokers_bank_fields.sql`
```sql
ALTER TABLE public.brokers 
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT CHECK (tipo_cuenta IN ('Ahorro', 'Corriente')),
ADD COLUMN IF NOT EXISTS numero_cuenta TEXT,
ADD COLUMN IF NOT EXISTS numero_cedula TEXT,
ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
```
**Acción:** EJECUTAR ESTE SQL

### 2. CSV Banco General - Headers Correctos ✅
**Archivo:** `src/lib/commissions/bankCsv.ts`
- Formato: `"Tipo de cuenta","Numero de cuenta","Numero de cedula o identificacion","Nombre completo","Monto","Concepto de pago"`
- Ejemplo: `"Ahorro","040012345678","8-123-4567","Ana Pérez López","1250.75","Pago comisiones quincena"`

### 3. Adelantos - Filtro por Año ✅
**Archivo:** `src/app/(app)/commissions/actions.ts`
- `actionGetAdvances` ahora filtra por año correctamente
- Logs agregados para debugging

### 4. Etiquetas Filtrar - Diseño Arreglado ✅
**Archivo:** `src/components/db/DatabaseTabs.tsx`
- Iconos alineados correctamente con texto
- `display: inline-flex` + `gap: 8px`

### 5. Import .xls - Aseguradoras ✅
**Archivo:** `src/components/commissions/ImportForm.tsx`
- `accept=".csv,.xlsx,.xls,.pdf,.jpg,.png"`

---

## 🔴 BUGS CRÍTICOS QUE REQUIEREN ATENCIÓN INMEDIATA

### 6. Request Auth - FALTA WIZARD 3 PASOS
**Problema:** Formulario actual es simple, no es wizard
**Solución Necesaria:**
- Crear `src/app/new-user/wizard-request.tsx`
- Paso 1: Email + Contraseña
- Paso 2: Datos personales (cedula, fecha_nac, telefono, licencia)
- Paso 3: Datos bancarios (nuevos campos)
- Checkbox "ayuda llenar" para no repetir cedula

### 7. Ajustes - FALTA CSV + PAGADOS
**Problema:** No hay botones para CSV ni Marcar Pagados
**Solución Necesaria:**
- Componente ajustes debe tener:
  - Botón "Descargar CSV Banco" (usa buildBankCsv)
  - Botón "Marcar como Pagados" (mueve a pagados)

### 8. Eliminar Imports/Borrador - NO FUNCIONA
**Problema:** Botones llaman actions pero no eliminan
**Debug Necesario:**
- `actionDeleteImport` se ejecuta OK
- `actionDeleteDraft` se ejecuta OK
- Problema puede ser en revalidatePath o refresh de datos
**Solución Temporal:** Agregar `window.location.reload()` después de eliminar

### 9. Adelantos - NO SE MUESTRAN
**Problema:** action trae datos pero componente no renderiza
**Debug Necesario:**
- Verificar en `AdvancesTab.tsx` que `allAdvances` tiene datos
- Console.log en línea 51: `console.log('Advances loaded:', data)`
- Verificar que `groupedData` no está vacío

### 10. Pendientes Sin Identificar - NO APARECEN
**Problema:** Después de importar, no se muestran items sin broker
**Causa Probable:** Query no filtra `broker_id IS NULL`
**Solución:**
```typescript
.from('comm_items')
.select('*')
.is('broker_id', null)  // ← AGREGAR ESTO
.eq('fortnight_id', fortnightId)
```

### 11. Cheques Import - NO DETECTA
**Problema:** parseBankHistoryXLSX funciona pero preview no aparece
**Debug:** Ver `ImportBankHistoryModal.tsx` línea 41-50
**Solución:** Verificar que `transfers.length > 0` antes de setPreview

### 12. Registro Pagos - NO FUNCIONA
**Problema:** Wizard de pagos pendientes no registra
**Causa:** Actions existen pero componente no las llama correctamente

### 13. Dashboard Broker - GRÁFICAS DESALINEADAS
**Problema:** ASSA y Convivio tienen tamaños diferentes
**Solución:** Usar mismo height en ambos componentes

### 14. Trigger temp_client_imports - NO COPIA
**Problema:** No migra datos de temp a clients/policies
**Causa Probable:**
- `broker_email` no válido
- `insurer_name` no existe
- Trigger AFTER no elimina (ya fue arreglado en sesión anterior)

---

## 📋 ACCIONES INMEDIATAS REQUERIDAS

### PARA EL USUARIO:
1. **EJECUTAR SQL:** `migrations/fix_brokers_bank_fields.sql`
2. **Completar datos bancarios** de brokers existentes en Supabase
3. **Probar eliminación** de imports/borrador en comisiones
4. **Verificar adelantos** aparecen en pantalla
5. **Revisar pendientes** sin identificar después de import

### PARA DESARROLLADOR:
1. Crear wizard request auth (3 pasos)
2. Agregar botones CSV + Pagados en ajustes
3. Fix eliminación (agregar reload temporal)
4. Fix pendientes query (broker_id IS NULL)
5. Fix dashboard gráficas (mismo height)
6. Debugging exhaustivo de cada action con console.logs

---

## 🔧 ARCHIVOS MODIFICADOS EN ESTA SESIÓN

1. ✅ `migrations/fix_brokers_bank_fields.sql` (NUEVO)
2. ✅ `src/lib/commissions/bankCsv.ts` (CSV headers)
3. ✅ `src/app/(app)/commissions/actions.ts` (filtro año adelantos)
4. ✅ `src/components/db/DatabaseTabs.tsx` (etiquetas diseño)
5. ✅ `src/components/commissions/ImportForm.tsx` (.xls support)

---

## ⚠️ NOTA CRÍTICA

Los bugs #6-#14 requieren implementación completa. No son simples arreglos de CSS.

**Prioridad Máxima:**
1. Wizard Request Auth (requiere componente nuevo completo)
2. Ajustes CSV/Pagados (requiere modificar componente ajustes)
3. Fix eliminación (debugging profundo necesario)
4. Pendientes sin identificar (fix query)

**Tiempo Estimado:** 3-4 horas más de trabajo continuo

---

## 🎯 PARA SIGUIENTE SESIÓN

- Implementar wizard request completo
- Componente ajustes con CSV/Pagados
- Debugging sistemático de cada bug con console.logs
- Testing exhaustivo de cada funcionalidad
- Verificación con `npm run build`

---

*Generado: 2025-10-03 02:45*
