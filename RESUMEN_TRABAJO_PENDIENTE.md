# RESUMEN DE TRABAJO PENDIENTE
**Fecha:** 2025-10-03 00:49
**Estado:** REQUIERE SESIONES MÚLTIPLES

## ALCANCE DEL TRABAJO

Este documento lista **TODAS** las correcciones solicitadas que requieren implementación completa.

---

## 🔴 CRÍTICO - COMISIONES

### 1. Eliminación de Reportes
**Estado:** ⚠️ Parcialmente implementado
- [x] Función `actionDeleteImport` existe
- [ ] No elimina automáticamente en UI
- [ ] Falta revalidación visual
- [ ] `actionDeleteDraft` agregado pero no conectado

**Archivos afectados:**
- `src/app/(app)/commissions/actions.ts` ✅ Funciones agregadas
- `src/components/commissions/ImportedReportsList.tsx` - Conectar UI
- `src/components/commissions/NewFortnightTab.tsx` - Botón eliminar borrador

### 2. Agrupación por NOMBRE (no póliza)
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Modificar `actionRecalculateFortnight` para agrupar por `insured_name`
- [ ] Sumar items duplicados del mismo cliente
- [ ] Mantener separación por número de póliza como secundario

**Lógica requerida:**
```sql
GROUP BY insured_name, policy_number
SUM(gross_amount) as total_client
```

### 3. Tabla Preliminar temp_clients
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Crear migración SQL para `temp_clients`
- [ ] Modificar `actionUploadImport` para detectar clientes sin cédula
- [ ] Insertar en temp_clients si no tiene national_id
- [ ] Trigger: temp_clients → clients/policies al completar cédula
- [ ] UI: formulario para broker completar datos

**Esquema temp_clients:**
```sql
CREATE TABLE temp_clients (
  id UUID PRIMARY KEY,
  broker_id UUID REFERENCES brokers(id),
  policy_number TEXT,
  insured_name TEXT,
  national_id TEXT, -- NULL hasta que broker complete
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  status TEXT -- 'pending', 'completed'
);
```

### 4. Cálculo Comisión Bruta por Corredor
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Obtener % default de `brokers.commission_percentage`
- [ ] Verificar override en `broker_insurer_overrides`
- [ ] Aplicar: `comisión_reporte × % = comisión_bruta_corredor`
- [ ] Guardar en `fortnight_broker_totals.gross_amount`

### 5. Mostrar NETO en Tablas
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Calcular: NETO = BRUTO - ADELANTOS
- [ ] Columna `net_amount` en `fortnight_broker_totals`
- [ ] UI: Mostrar NETO como valor principal
- [ ] Preview: NETO destacado, bruto/descuentos en detalle

**Componentes a modificar:**
- `BrokerTotals.tsx` - Agregar columna NETO
- `PreviewTab.tsx` - NETO como principal
- `YearToDateTab.tsx` - Totales NETO

### 6. CSV Banco General
**Estado:** ⚠️ Función existe, no conectada
- [x] `actionExportBankCsv` creada
- [ ] Conectar botón en UI
- [ ] Excluir brokers con neto ≤ 0
- [ ] Descargar archivo .csv

### 7. Botón "Pagado"
**Estado:** ⚠️ Función existe, revisar
- [x] `actionPayFortnight` existe
- [ ] Verificar cambio status DRAFT → PAID
- [ ] Mover datos a preview automáticamente
- [ ] Notificaciones a brokers

### 8. Adelantos Filtrados por Corredor
**Estado:** ✅ IMPLEMENTADO
- [x] `actionGetAdvances` filtra por broker_id
- [ ] VERIFICAR en UI que se aplica correctamente
- [ ] Vista Master: dropdown seleccionar broker
- [ ] Vista Broker: solo sus adelantos

### 9. Validación Adelantos
**Estado:** ❌ NO IMPLEMENTADO
- [ ] No permitir descontar > comisión bruta
- [ ] Validación en frontend
- [ ] Validación en backend
- [ ] Mensaje de error claro

### 10. Gráficas - Total Corredores
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Mostrar "Total Corredores" en gráfica
- [ ] No solo "Total Oficina 100%"
- [ ] Calcular: Total Oficina = Reportes - Comisiones Corredores

### 11. ASSA - 3 Columnas Comisión
**Estado:** ❌ NO IMPLEMENTADO COMPLETAMENTE
- [ ] Migración: agregar campos a `insurers`
  - `commission_column_1`
  - `commission_column_2`
  - `commission_column_3`
- [ ] UI Config ASSA: 3 inputs para nombres de columnas
- [ ] Parser: sumar las 3 columnas = comisión total
- [ ] Lógica: Si insurer = 'ASSA', usar suma de 3 columnas

---

## 🔴 CRÍTICO - CHEQUES

### 1. Importación Historial Banco
**Estado:** ❌ NO FUNCIONA
- [ ] Preview no se muestra (detecta rows pero no renderiza)
- [ ] Revisar `ImportBankHistoryModal.tsx`
- [ ] Verificar parser de columnas
- [ ] Agregar soporte .xl (además de .xlsx)

### 2. Wizard Pagos Pendientes
**Estado:** ❌ NO REGISTRA
- [ ] No guarda en base de datos
- [ ] Z-index: wizard se corta con header
- [ ] Validación de formularios

---

## 🟡 IMPORTANTE - BASE DE DATOS

### 1. Dropdown Corredores (Vista Master)
**Estado:** ❌ NO APARECE
- [ ] Verificar query en `DatabaseTabs.tsx`
- [ ] Cargar lista de brokers activos
- [ ] Conectar con asignación

### 2. Triggers temp → clients/policies
**Estado:** ❌ NO SE ACTIVA
- [ ] Revisar trigger SQL
- [ ] Validar extracción de datos
- [ ] Borrado automático tras migración
- [ ] Logs para debug

---

## 🟢 BAJA PRIORIDAD - DASHBOARD

### 1. Alinear Gráficas
**Estado:** ❌ NO IMPLEMENTADO
- [ ] Gráficas ASSA/Convivio mismo tamaño que calendario
- [ ] Grid responsive

### 2. Mini Calendario
**Estado:** ❌ NO IMPLEMENTADO  
- [ ] Título centrado
- [ ] Navegación meses (< >)
- [ ] Mensaje "Sin eventos programados"
- [ ] Listar próximo evento

---

## 📋 ORDEN DE EJECUCIÓN RECOMENDADO

### SESIÓN 1 (2-3 horas)
1. ✅ Fix eliminación reportes + revalidación
2. ✅ Adelantos filtrados por corredor
3. ✅ CSV Banco + botón conectado
4. ✅ Cálculo NETO y mostrar en tablas

### SESIÓN 2 (2-3 horas)
5. Tabla preliminar temp_clients + triggers
6. Agrupación por nombre de cliente
7. Cálculo comisión bruta por %

### SESIÓN 3 (2-3 horas)
8. ASSA 3 columnas comisión
9. Cheques: importación historial
10. Cheques: wizard pagos

### SESIÓN 4 (1-2 horas)
11. DB: dropdown corredores
12. Dashboard: alinear gráficas
13. Validaciones y exclusiones

---

## ARCHIVOS PRINCIPALES A MODIFICAR

### Backend (Actions)
- ✅ `/src/app/(app)/commissions/actions.ts` - Funciones agregadas
- `/src/app/(app)/checks/actions.ts` - Fix imports/wizard
- `/src/app/(app)/db/actions.ts` - Dropdown corredores

### Componentes
- `/src/components/commissions/NewFortnightTab.tsx`
- `/src/components/commissions/BrokerTotals.tsx`
- `/src/components/commissions/AdvancesModal.tsx`
- `/src/components/commissions/ImportedReportsList.tsx`
- `/src/components/checks/ImportBankHistoryModal.tsx`
- `/src/components/checks/RegisterPaymentWizard.tsx`
- `/src/components/db/DatabaseTabs.tsx`

### Migraciones SQL
- `create_temp_clients_table.sql` (NUEVO)
- `update_assa_config.sql` (NUEVO)
- `fix_commissions_triggers.sql` (NUEVO)

---

## ESTIMACIÓN TOTAL
**Tiempo:** 8-10 horas de desarrollo
**Complejidad:** Alta
**Archivos a modificar:** ~20
**Migraciones SQL:** 3 nuevas
**Tests requeridos:** Extensivos

---

## NOTAS IMPORTANTES

1. **Typecheck SIEMPRE** antes de confirmar
2. **Build completo** al finalizar cada sesión
3. **Probar en navegador** cada funcionalidad
4. **Revalidación** en todas las mutaciones
5. **Filtrado por broker_id** en TODAS las queries de adelantos

---

## PRÓXIMOS PASOS INMEDIATOS

Debido al volumen extenso de trabajo, se recomienda:

1. **Priorizar los 4-5 items más críticos**
2. **Completarlos al 100%** con tests
3. **Hacer commit** de cambios funcionales
4. **Continuar** con siguiente bloque

¿Deseas que proceda con los items de SESIÓN 1 primero?
