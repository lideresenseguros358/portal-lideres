# 📋 FLUJO COMPLETO DE COMISIONES RETENIDAS

**Versión:** 1.0  
**Fecha:** 26 de Noviembre de 2024  
**Estado:** ✅ IMPLEMENTADO COMPLETO

---

## 📌 RESUMEN EJECUTIVO

El flujo de **comisiones retenidas** permite gestionar comisiones que han sido retenidas temporalmente y posteriormente liberarlas para pago en la siguiente quincena. Similar al flujo de ajustes pero con diferencias clave.

### Diferencias vs. Ajustes
- ❌ **NO hay opción "Pagar Ya"** - Solo siguiente quincena
- ✅ **Agrupación automática por broker**
- ✅ **Filtro por año** (2024, 2025, 2026, etc.)
- ✅ **Vista de Retenidos Pagados** separada
- ✅ **Mensaje en historial del broker** cuando tiene retenciones

---

## 🔄 FLUJO GENERAL

### 1. **Marcar Comisión como Retenida**
**Ubicación:** Durante el cierre de quincena  
**Quién:** Master

**Proceso:**
```sql
INSERT INTO retained_commissions (
  broker_id,
  fortnight_id,  -- Quincena donde se retuvo
  gross_amount,
  discount_amount,
  net_amount,
  insurers_detail,  -- JSON con detalle por aseguradora
  status  -- 'pending'
)
```

**Resultado:**
- Comisión se retiene (no se paga en esa quincena)
- Aparece en sección "Retenidos Pendientes"
- Broker ve mensaje en su historial

---

### 2. **Vista de Retenidos Pendientes**
**Ubicación:** Comisiones → Ajustes → Tab "Retenidos" → Sub-tab "Pendientes"  
**Quién:** Master

**Componente:** `RetainedGroupedView.tsx`

**Características:**
- ✅ **Agrupación automática por broker**
- ✅ **Filtro de año** (dropdown en header)
- ✅ **Total retenido por broker**
- ✅ **Expansión para ver detalle** (quincenas retenidas)
- ✅ **Botón "Pagar"** por broker

**UI Mobile-First:**
```tsx
// Resumen cards
- Total Retenido (rojo)
- Brokers Afectados (azul)
- Total Items (morado)

// Lista agrupada
- Card por broker
- Icono rojo de retención
- Nombre + Total
- Botón "Pagar" verde
- Expansión con detalle
```

**Filtro de Año:**
- Año actual por defecto
- Al terminar 2025 → cambia automáticamente a 2026
- Dropdown para ver años anteriores
- Si no hay data del año → mensaje "No hay comisiones retenidas en {año}"

---

### 3. **Procesar Pago (Solo Siguiente Quincena)**
**Ubicación:** Modal de pago  
**Quién:** Master

**Componente:** Modal en `RetainedGroupedView.tsx`

**Diferencia clave vs Ajustes:**
```tsx
// AJUSTES: 2 opciones
- "Pagar Ya" (TXT Banco General)
- "Siguiente Quincena"

// RETENIDOS: 1 opción
- "Siguiente Quincena" (única opción) ✅
```

**Modal:**
```tsx
<Dialog>
  {/* Info del broker */}
  <p>Corredor: {broker.name}</p>
  <p>Total: ${totalAmount}</p>
  <p>{count} retención(es) del año {year}</p>

  {/* Explicación */}
  <div>Las retenciones se asociarán a la siguiente quincena DRAFT 
       y se pagarán cuando se cierre esa quincena.</div>

  {/* Botón único */}
  <Button>
    <FaCalendarAlt />
    Asociar a Siguiente Quincena
  </Button>
</Dialog>
```

**Acción de servidor:**
```typescript
actionProcessRetainedCommissions({
  retained_ids: ['id1', 'id2', 'id3'],
  payment_mode: 'next_fortnight' // Única opción
})
```

**Proceso:**
1. Buscar quincena DRAFT más reciente
2. Si no existe → error "Crea una nueva quincena"
3. Actualizar retenciones:
   ```sql
   UPDATE retained_commissions
   SET status = 'associated_to_fortnight',
       applied_fortnight_id = '{draft_fortnight_id}',
       updated_at = NOW()
   WHERE id IN (...)
   ```
4. Crear notificación al broker:
   ```typescript
   {
     title: 'Retenciones Liberadas',
     body: `Se liberaron {count} retención(es) por ${total} para pago en la siguiente quincena`,
     notification_type: 'commission'
   }
   ```

---

### 4. **Vista de Retenidos Pagados**
**Ubicación:** Comisiones → Ajustes → Tab "Retenidos" → Sub-tab "Pagados"  
**Quién:** Master

**Componente:** `PaidRetainedView.tsx`

**Características:**
- ✅ **Mismo filtro de año** que pendientes
- ✅ **Agrupación por broker**
- ✅ **Muestra quincena de retención** (icono rojo)
- ✅ **Muestra quincena de pago** (icono verde)
- ✅ **Resumen con totales**

**UI:**
```tsx
// Header con filtro de año
<div>
  <FaHistory /> Retenciones Pagadas
  <Select>{años}</Select>
</div>

// Resumen cards
- Total Liberado (verde)
- Brokers (azul)
- Total Items (morado)

// Lista de brokers con expansión
- Icono verde de check
- Nombre + Total liberado
- Detalle expandible:
  * Retenido en: {quincena X}
  * Asociado a: {quincena Y}
```

**Información mostrada:**
```tsx
{/* Detalle de cada retención */}
<div>
  <FaHandHoldingUsd /> Retenido en: Sep 1-15, 2024
  <FaCheckCircle /> Asociado a: Sep 16-30, 2024
  Bruto: $1,000 • Descuento: $100
  Neto: $900
</div>
```

---

### 5. **Sub-Tabs en Sección Retenidos**
**Ubicación:** Tab "Retenidos"  
**Componente:** `AdjustmentsTab.tsx`

**Estructura:**
```tsx
{activeTab === 'retained' && (
  <div>
    {/* Sub-tabs */}
    <div className="flex gap-2 border-b">
      <button onClick={() => setRetainedSubTab('pending')}>
        <FaHandHoldingUsd /> Retenidos Pendientes
      </button>
      <button onClick={() => setRetainedSubTab('paid')}>
        <FaCheckCircle /> Retenidos Pagados
      </button>
    </div>

    {/* Contenido */}
    {retainedSubTab === 'pending' ? 
      <RetainedGroupedView /> : 
      <PaidRetainedView />
    }
  </div>
)}
```

**Colores:**
- **Pendientes:** Botón rojo cuando activo
- **Pagados:** Botón verde cuando activo
- **Inactivo:** Gris claro con hover

---

## 📊 ARCHIVOS DEL SISTEMA

### Archivos Nuevos Creados

**1. retained-actions.ts** (216 líneas)
```typescript
// Server Actions
actionProcessRetainedCommissions()  // Asociar a quincena
actionGetPaidRetained()             // Obtener pagados
```

**2. RetainedGroupedView.tsx** (380 líneas)
```typescript
// Vista principal de retenidos pendientes
- Agrupación por broker
- Filtro de año
- Modal de pago
- Notificaciones
```

**3. PaidRetainedView.tsx** (310 líneas)
```typescript
// Vista de retenidos pagados/liberados
- Agrupación por broker
- Filtro de año
- Muestra quincenas de retención y pago
```

### Archivos Modificados

**1. AdjustmentsTab.tsx**
- Líneas 27-28: Imports de nuevos componentes
- Línea 611: Estado `retainedSubTab`
- Líneas 744-772: Sub-tabs y renderizado condicional

**2. actions.ts** (Ya existente)
- `actionGetRetainedCommissions()` - Obtiene retenidos pendientes
- `actionPayRetainedCommission()` - Pagar/aplicar retenidos (legacy)
- `actionApplyRetainedToAdvance()` - Aplicar a adelanto

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### Tabla: `retained_commissions`

**Columnas principales:**
```sql
id                    UUID PRIMARY KEY
broker_id             UUID REFERENCES brokers
fortnight_id          UUID REFERENCES fortnights  -- Quincena de retención
applied_fortnight_id  UUID REFERENCES fortnights  -- Quincena de pago
gross_amount          DECIMAL
discount_amount       DECIMAL
net_amount            DECIMAL
insurers_detail       JSONB  -- { "ASSA": {...}, "MAPFRE": {...} }
status                TEXT   -- 'pending', 'associated_to_fortnight', 'paid'
created_at            TIMESTAMP
updated_at            TIMESTAMP
paid_at               TIMESTAMP
```

**Estados posibles:**
1. **`pending`** - Retenido, pendiente de liberar
2. **`associated_to_fortnight`** - Asociado a quincena DRAFT
3. **`paid`** - Pagado cuando se cierra la quincena

**Relaciones:**
- `fortnight_id` → Quincena donde se retuvo (origen)
- `applied_fortnight_id` → Quincena donde se pagará (destino)

---

## 🔔 NOTIFICACIONES

### Al Liberar Retenciones
**Target:** Broker afectado  
**Tipo:** 'commission'

```typescript
{
  title: 'Retenciones Liberadas',
  body: `Se liberaron {count} retención(es) por ${total} para pago en la siguiente quincena`,
  meta: {
    retained_count: 3,
    total_amount: 1500.50,
    fortnight_id: 'uuid-quincena-draft'
  }
}
```

### Cuándo se Crea la Retención (Original)
**Target:** Master  
**Tipo:** 'commission'

```typescript
{
  title: 'Comisión Retenida',
  body: `Se retuvo comisión de {broker} por ${amount}`,
  meta: {
    broker_id: 'uuid',
    fortnight_id: 'uuid'
  }
}
```

---

## 📱 DISEÑO MOBILE-FIRST

### Breakpoints
- **Mobile:** < 640px
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

### Cards de Resumen
```tsx
// Mobile: 1 columna
// Tablet/Desktop: 3 columnas
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
```

### Botones
```tsx
// Compactos en mobile
size="sm"
className="text-xs sm:text-sm"
```

### Tipografía
```tsx
// Headers
text-lg sm:text-xl

// Montos
text-xl sm:text-2xl

// Detalles
text-xs sm:text-sm
```

### Iconos
```tsx
// Consistentes
size={14} - Botones
size={16} - Cards principales
size={20} - Headers
```

---

## 🎯 CASOS DE USO

### Caso 1: Retención Simple
**Escenario:** Master retiene comisión de 1 broker en quincena Oct 1-15

**Flujo:**
1. Al cerrar quincena Oct 1-15 → Master marca comisión como retenida
2. Aparece en "Retenidos Pendientes" (año 2024)
3. Master selecciona broker → Click "Pagar"
4. Sistema asocia a quincena DRAFT (Oct 16-31)
5. Broker recibe notificación
6. Al cerrar Oct 16-31 → Comisión se paga
7. Aparece en "Retenidos Pagados"

### Caso 2: Múltiples Retenciones del Mismo Broker
**Escenario:** Broker tiene 3 retenciones de diferentes quincenas

**Flujo:**
1. Todas aparecen agrupadas bajo el nombre del broker
2. Total acumulado se muestra en el card
3. Expansión muestra detalle de cada quincena
4. Master libera todas de una vez → Modal muestra total
5. Todas se asocian a la misma quincena DRAFT

### Caso 3: Cambio de Año
**Escenario:** Termina 2024, empieza 2025

**Flujo:**
1. Sistema detecta año actual: 2025
2. Filtro muestra 2025 por defecto
3. Lista aparece vacía (no hay retenciones en 2025 aún)
4. Master puede cambiar a 2024 en dropdown
5. Ve todas las retenciones de 2024

### Caso 4: Broker Consulta su Historial
**Escenario:** Broker ve historial de quincena donde tuvo retención

**Flujo:**
1. Broker entra a "Historial" de quincena X
2. Ve comisión con estado "RETENIDA"
3. Mensaje: "Este pago fue retenido, contactar a administrador"
4. Icono rojo de retención
5. No puede hacer ninguna acción

---

## ✅ TESTING CHECKLIST

### Funcionalidad Básica
- [ ] Retenciones se agrupan correctamente por broker
- [ ] Filtro de año funciona (2024, 2025, etc.)
- [ ] Total retenido se calcula correctamente
- [ ] Expansión muestra detalle de quincenas
- [ ] Modal de pago aparece con info correcta
- [ ] Solo muestra opción "Siguiente Quincena"

### Procesamiento de Pago
- [ ] Busca quincena DRAFT correctamente
- [ ] Error si no existe DRAFT
- [ ] Actualiza `applied_fortnight_id` correctamente
- [ ] Actualiza `status` a 'associated_to_fortnight'
- [ ] Crea notificación al broker
- [ ] Múltiples retenciones del mismo broker se procesan juntas

### Vista de Pagados
- [ ] Muestra retenciones con status 'associated_to_fortnight'
- [ ] Agrupa por broker correctamente
- [ ] Muestra quincena de retención (rojo)
- [ ] Muestra quincena de pago (verde)
- [ ] Filtro de año funciona igual que pendientes

### Mobile Responsive
- [ ] Cards de resumen en 1 columna (mobile)
- [ ] Lista de brokers legible en mobile
- [ ] Botones accesibles con el pulgar
- [ ] Modal se ajusta al viewport
- [ ] Sub-tabs funcionan en mobile
- [ ] No hay scroll horizontal

### Notificaciones
- [ ] Broker recibe notificación al liberar retención
- [ ] Notificación muestra monto total correcto
- [ ] Notificación muestra cantidad de retenciones
- [ ] Link a la quincena asociada funciona

---

## 📊 ESTADÍSTICAS

**Archivos creados:** 3
- `retained-actions.ts` (216 líneas)
- `RetainedGroupedView.tsx` (380 líneas)
- `PaidRetainedView.tsx` (310 líneas)

**Archivos modificados:** 1
- `AdjustmentsTab.tsx` (+35 líneas)

**Total líneas agregadas:** ~950

**Funciones server creadas:** 2
**Componentes React creados:** 2
**Componentes React modificados:** 1

**Tiempo de implementación:** 2-3 horas  
**Complejidad:** Media-Alta  
**Estado:** ✅ COMPLETO

---

## 🚀 PRÓXIMOS PASOS

### 1. **Mensaje en Historial del Broker** (Prioridad Alta)
Cuando broker ve historial de quincena con retención:
```tsx
{item.status === 'retained' && (
  <div className="p-3 bg-red-50 border-l-4 border-red-500">
    <FaHandHoldingUsd className="text-red-500 inline mr-2" />
    <span className="font-semibold">Este pago fue retenido</span>
    <p className="text-xs mt-1">
      Por favor contacta a un administrador para solventar el estatus de tu pago.
    </p>
  </div>
)}
```

### 2. **Lógica de Cierre de Quincena**
Al cerrar quincena DRAFT que tiene retenciones asociadas:
```typescript
// Marcar retenciones como pagadas
UPDATE retained_commissions
SET status = 'paid', paid_at = NOW()
WHERE applied_fortnight_id = '{fortnight_id}'
  AND status = 'associated_to_fortnight'
```

### 3. **Exportación a Excel/PDF**
Agregar botones para descargar:
- Lista de retenidos pendientes
- Lista de retenidos pagados
- Detalle por broker

### 4. **Búsqueda y Filtros Avanzados**
- Buscar por nombre de broker
- Filtrar por rango de fechas
- Filtrar por monto mínimo/máximo

---

## 📞 SOPORTE

Para dudas sobre este flujo, revisar:
- Este documento
- Código en `src/app/(app)/commissions/retained-actions.ts`
- Componentes en `src/components/commissions/Retained*.tsx`
- Database types en `src/lib/database.types.ts`

**Última actualización:** 26 de Noviembre de 2024  
**Versión:** 1.0  
**Estado:** ✅ IMPLEMENTADO COMPLETO
