# CAMBIO: CANCELADAS MENSUALES → CANCELADAS ANUALES

## 📋 RESUMEN DEL CAMBIO

**ANTES:** Las canceladas se ingresaban mes a mes en la matriz de producción.

**DESPUÉS:** Las canceladas se ingresan una sola vez al año mediante un input único al final de cada fila de broker.

**FÓRMULA:** `Acumulado Neto = Acumulado Bruto - Canceladas del Año`

---

## ✅ CAMBIOS COMPLETADOS

### 1. **SQL de Limpieza Creado**
**Archivo:** `CLEANUP_CANCELADAS_MENSUALES.sql`

Este script:
- Limpia todas las canceladas mensuales (pone en 0)
- Mantiene intacto el campo `canceladas_ytd` (Year-To-Date)
- Incluye verificaciones antes y después de la limpieza
- Tiene comentarios detallados de cada paso

**IMPORTANTE:** Ejecutar este SQL antes de desplegar los cambios de UI.

### 2. **Modal Mensual Actualizado**
**Archivo:** `src/components/production/MonthInputModal.tsx`

Cambios:
- ✅ Eliminado parámetro `canceladas` de la interfaz
- ✅ Eliminado estado `canceladas` del componente
- ✅ Eliminado campo de input de canceladas del formulario
- ✅ Eliminado `canceladas` del resumen del modal
- ✅ Actualizada función `onSave` para no incluir canceladas

**Resultado:** El modal mensual ahora solo pide:
- Cifra Bruta del Mes
- Número de Pólizas
- Persistencia (%)

### 3. **ProductionMatrixMaster Actualizado**
**Archivo:** `src/components/production/ProductionMatrixMaster.tsx`

Cambios:
- ✅ Eliminado parámetro `canceladas` de `handleMonthSave`
- ✅ Eliminado `canceladas` del body del request al API
- ✅ Eliminado `canceladas` de la actualización del estado local
- ✅ Eliminado prop `initialCanceladas` del componente `MonthInputModal`

---

## 🚧 CAMBIOS PENDIENTES

### 4. **Agregar Input Anual de Canceladas en la UI**

**Ubicación:** Componentes de matriz de producción (Master y Broker)

**Necesita:**
- Agregar columna "Canceladas del Año" al final de cada fila
- Input editable inline (similar a como se edita meta personal)
- Guardar valor en `canceladas_ytd` por broker/año
- Mostrar en la columna de totales YTD

**Ejemplo de UI:**
```
| Broker | Ene | Feb | ... | Dic | Bruto YTD | Canceladas Año | Neto YTD |
|--------|-----|-----|-----|-----|-----------|----------------|----------|
| Juan   | 100 | 200 | ... | 150 | 5,000     | [input: 500]   | 4,500    |
```

### 5. **Actualizar Cálculo de Neto YTD**

**Archivos a modificar:**
- `src/components/production/ProductionMatrix.tsx`
- `src/components/production/ProductionMatrixMaster.tsx`

**Cambio en función `calculateYTD`:**
```typescript
// ANTES
const calculateYTD = (months: any, canceladasYTD: number) => {
  const brutoYTD = MONTHS.reduce((sum, m) => sum + (months[m.key]?.bruto || 0), 0);
  const netoYTD = brutoYTD - canceladasYTD; // Ya está correcto
  return { brutoYTD, netoYTD };
};
```

Este cálculo ya está correcto, solo necesita que el input de `canceladasYTD` venga del input anual.

### 6. **Actualizar API de Producción**

**Archivo:** `src/app/api/production/route.ts`

**Cambios necesarios:**
- Eliminar manejo de `canceladas` en el endpoint PUT para meses individuales
- Agregar/actualizar endpoint para guardar `canceladas_ytd` anual
- Asegurar que el GET devuelva `canceladas_ytd` por broker/año

### 7. **Actualizar Tipos e Interfaces**

**Archivos a revisar:**
- Interfaces de `BrokerProduction`
- Interfaces de `MonthData`
- Tipos en el API

**Cambio en MonthData:**
```typescript
// ANTES
interface MonthData {
  bruto: number;
  num_polizas: number;
  canceladas: number;  // ❌ ELIMINAR
  persistencia: number | null;
}

// DESPUÉS
interface MonthData {
  bruto: number;
  num_polizas: number;
  persistencia: number | null;
}
```

**Mantener en BrokerProduction:**
```typescript
interface BrokerProduction {
  broker_id: string;
  broker_name: string;
  months: { ... };
  canceladas_ytd: number; // ✅ MANTENER - Input anual
  // ...
}
```

### 8. **Actualizar ProductionMatrix (Vista Broker)**

**Archivo:** `src/components/production/ProductionMatrix.tsx`

Aplicar los mismos cambios que en ProductionMatrixMaster:
- Eliminar manejo de canceladas mensuales
- Agregar input anual de canceladas
- Actualizar handlers y estado

---

## 📊 ESTRUCTURA DE DATOS

### Base de Datos: Tabla `production`

```sql
-- Campos relevantes:
broker_id: string       -- ID del corredor
year: number           -- Año
month: number          -- Mes (1-12)
bruto: number          -- Cifra bruta del mes
num_polizas: number    -- Número de pólizas del mes
canceladas: number     -- ❌ LIMPIAR (poner en 0)
persistencia: number   -- Persistencia del mes (%)
```

### Campo Anual (NO está en tabla `production`)

El campo `canceladas_ytd` se calcula/almacena de forma diferente:
- Puede estar en una tabla separada de totales anuales
- O puede ser un campo agregado en el broker
- Necesita investigar dónde se almacena actualmente

**ACCIÓN REQUERIDA:** Verificar dónde se guarda `canceladas_ytd` actualmente.

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### Fase 1: Limpieza (COMPLETADA ✅)
1. ✅ Crear SQL de limpieza
2. ✅ Actualizar MonthInputModal
3. ✅ Actualizar ProductionMatrixMaster handlers

### Fase 2: UI del Input Anual (PENDIENTE 🚧)
1. Agregar columna "Canceladas del Año" en matriz
2. Crear input editable inline
3. Agregar handler para guardar canceladas anuales
4. Conectar con API

### Fase 3: API y Backend (PENDIENTE 🚧)
1. Actualizar endpoint PUT para eliminar canceladas mensuales
2. Crear/actualizar endpoint para canceladas anuales
3. Actualizar queries del GET

### Fase 4: Testing (PENDIENTE 🚧)
1. Ejecutar SQL de limpieza en base de datos
2. Probar input anual en UI
3. Verificar cálculos de Neto YTD
4. Probar en ambas vistas (Master y Broker)

### Fase 5: Deploy (PENDIENTE 🚧)
1. Build de producción
2. Git commit y push
3. Verificar en producción

---

## ⚠️ NOTAS IMPORTANTES

1. **NO ejecutar el SQL de limpieza hasta que toda la UI esté lista**
   - Primero completar todos los cambios de código
   - Luego ejecutar SQL
   - Luego desplegar

2. **Backup de base de datos**
   - Hacer backup antes de ejecutar el SQL de limpieza
   - Guardar los valores actuales de canceladas mensuales por si se necesitan

3. **Comunicación con usuarios**
   - Informar del cambio a los usuarios Master
   - Explicar que ahora las canceladas se ingresan una vez al año
   - Actualizar documentación/guías si existen

4. **Migración de datos existentes**
   - Si hay canceladas mensuales con valores, considerar:
     - ¿Sumarlas y ponerlas en canceladas_ytd?
     - ¿O simplemente limpiarlas?
   - Decisión pendiente del usuario

---

## 📝 ARCHIVOS MODIFICADOS HASTA AHORA

1. ✅ `CLEANUP_CANCELADAS_MENSUALES.sql` (CREADO)
2. ✅ `src/components/production/MonthInputModal.tsx` (MODIFICADO)
3. ✅ `src/components/production/ProductionMatrixMaster.tsx` (MODIFICADO)
4. ✅ `CAMBIOS_CANCELADAS_ANUALES.md` (ESTE ARCHIVO - CREADO)

---

## 🔄 PRÓXIMOS PASOS INMEDIATOS

1. **Agregar input anual de canceladas en la UI de la matriz**
2. **Actualizar el API para manejar canceladas anuales**
3. **Probar el flujo completo**
4. **Ejecutar SQL de limpieza**
5. **Build y deploy**

---

**Fecha de inicio:** 13 de enero de 2026
**Estado actual:** Fase 1 completada, iniciando Fase 2
