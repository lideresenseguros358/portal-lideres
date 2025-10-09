# 📋 Feature: Sistema de Vencimiento de Carnets

## 📋 Descripción
Sistema completo para gestionar la fecha de vencimiento del carnet de corredores con recordatorios automáticos 60 días antes del vencimiento.

---

## 🎯 Funcionalidades Implementadas

### **1. Nueva Columna en Base de Datos**
- ✅ Campo `carnet_expiry_date` en tabla `brokers` (tipo DATE, nullable)
- ✅ Puede ser NULL (no todos los corredores tienen carnet)
- ✅ Si es NULL, no genera recordatorios

### **2. Interfaz de Edición**
- ✅ Campo de fecha en página de detalle del corredor
- ✅ Solo editable por Master
- ✅ Indicador visual de días restantes
- ✅ Alertas de color según urgencia:
  - 🔴 **Rojo:** Carnet vencido
  - 🟠 **Naranja:** ≤ 30 días
  - 🟢 **Verde:** > 30 días

### **3. Sistema de Recordatorios**
- ✅ Detecta carnets que vencen en 60 días o menos
- ✅ Notifica a Master (ve todos los carnets)
- ✅ Notifica a cada corredor (solo su propio carnet)
- ✅ Ordenados por urgencia (más próximos primero)

### **4. Alertas Visuales**
- ✅ Componente `CarnetExpiryAlerts` reutilizable
- ✅ Se puede integrar en Dashboard, Header o cualquier página
- ✅ Alertas desechables (guardadas en localStorage)
- ✅ Enlaces directos para actualizar el carnet

---

## 📁 Archivos Creados/Modificados

### **Nuevos Archivos:**

1. **`docs/sql-add-carnet-column.sql`**
   - SQL para agregar columna a la base de datos

2. **`src/components/brokers/CarnetExpiryAlerts.tsx`**
   - Componente de alertas visuales
   - 162 líneas

### **Archivos Modificados:**

1. **`src/components/brokers/BrokerDetailClient.tsx`**
   - Agregado campo de edición de carnet
   - Indicador visual de días restantes
   - Líneas modificadas: 46, 289-320

2. **`src/app/(app)/brokers/actions.ts`**
   - Agregado campo a lista de nullable fields
   - Nueva función `actionGetExpiringCarnets`
   - Líneas modificadas: 165, 447-501

---

## 🗄️ Configuración de Base de Datos

### **Paso 1: Ejecutar SQL**

```sql
-- Agregar columna carnet_expiry_date
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS carnet_expiry_date DATE NULL;

-- Agregar comentario
COMMENT ON COLUMN brokers.carnet_expiry_date IS 
  'Fecha de vencimiento del carnet del corredor. 
   Se enviará recordatorio 60 días antes del vencimiento.';
```

**Ejecutar en:** Supabase Dashboard > SQL Editor

### **Paso 2: Verificar**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'brokers' AND column_name = 'carnet_expiry_date';
```

**Resultado esperado:**
```
column_name          | data_type | is_nullable
---------------------|-----------|-------------
carnet_expiry_date   | date      | YES
```

---

## 🎨 Interfaz de Usuario

### **Página de Edición de Corredor**

```tsx
{/* Carnet Expiry Date */}
<div>
  <label>
    <FaCalendar className="text-[#8AAA19]" />
    Vencimiento Carnet
  </label>
  <input
    type="date"
    value={formData.carnet_expiry_date}
    onChange={(e) => setFormData({ ...formData, carnet_expiry_date: e.target.value })}
    disabled={!isEditing}
  />
  
  {/* Indicador de días */}
  <p className="text-xs text-gray-500 mt-1">
    {diffDays < 0 && (
      <span className="text-red-600 font-semibold">
        ⚠️ Carnet vencido hace {Math.abs(diffDays)} días
      </span>
    )}
    {diffDays >= 0 && diffDays <= 60 && (
      <span className="text-orange-600 font-semibold">
        ⚠️ Vence en {diffDays} días
      </span>
    )}
    {diffDays > 60 && (
      <span className="text-green-600">
        ✓ Vence en {diffDays} días
      </span>
    )}
  </p>
</div>
```

### **Vista del Campo:**

**Sin fecha:**
```
┌────────────────────────────────┐
│ Vencimiento Carnet             │
│ [________________]             │
│ Sin fecha de vencimiento       │
└────────────────────────────────┘
```

**Con fecha (válido):**
```
┌────────────────────────────────┐
│ Vencimiento Carnet             │
│ [2025-12-31____]               │
│ ✓ Vence en 85 días             │
└────────────────────────────────┘
```

**Con fecha (urgente):**
```
┌────────────────────────────────┐
│ Vencimiento Carnet             │
│ [2025-10-25____]               │
│ ⚠️ Vence en 16 días             │
└────────────────────────────────┘
```

**Con fecha (vencido):**
```
┌────────────────────────────────┐
│ Vencimiento Carnet             │
│ [2025-09-01____]               │
│ ⚠️ Carnet vencido hace 38 días  │
└────────────────────────────────┘
```

---

## 🔔 Sistema de Alertas

### **Función: `actionGetExpiringCarnets`**

```typescript
export async function actionGetExpiringCarnets(
  userRole?: 'master' | 'broker', 
  brokerId?: string
)
```

**Parámetros:**
- `userRole`: 'master' o 'broker'
- `brokerId`: ID del broker (requerido si es rol broker)

**Retorna:**
```typescript
{
  ok: true,
  data: [
    {
      id: string,
      name: string,
      email: string,
      carnet_expiry_date: string,
      daysUntilExpiry: number,
      status: 'expired' | 'critical' | 'warning'
    }
  ]
}
```

**Estados:**
- **`expired`**: Carnet ya vencido (días < 0)
- **`critical`**: Vence en 30 días o menos
- **`warning`**: Vence en 31-60 días

### **Lógica de Filtrado:**

```typescript
// 1. Solo carnets activos
.eq('active', true)

// 2. Solo carnets con fecha
.not('carnet_expiry_date', 'is', null)

// 3. Si es broker, solo su carnet
if (userRole === 'broker') {
  .eq('id', brokerId)
}

// 4. Solo dentro de 60 días o vencidos
.filter(broker => broker.daysUntilExpiry <= 60)

// 5. Ordenar por urgencia
.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
```

---

## 🖼️ Componente de Alertas

### **Uso: `CarnetExpiryAlerts`**

```tsx
import CarnetExpiryAlerts from '@/components/brokers/CarnetExpiryAlerts';

// En Dashboard o Header
<CarnetExpiryAlerts 
  userRole={userRole} 
  brokerId={brokerId} 
/>
```

**Props:**
- `userRole`: 'master' | 'broker' (requerido)
- `brokerId`: string | null (requerido si es broker)

### **Características:**

1. **Carga Automática:**
   - Se ejecuta en `useEffect`
   - Llama a `actionGetExpiringCarnets`

2. **Alertas Desechables:**
   - Click en ✕ para descartar
   - Se guarda en `localStorage`
   - Persiste entre sesiones

3. **Diseño Responsive:**
   - Mobile: Stack vertical
   - Desktop: Información más detallada

4. **Estados Visuales:**
   - 🔴 Rojo: Vencido
   - 🟠 Naranja: Crítico (≤30 días)
   - 🟡 Amarillo: Advertencia (31-60 días)

### **Vista del Componente:**

**Alerta Vencida (Rojo):**
```
┌─────────────────────────────────────────────┐
│ 🚨 ⚠️ Carnet Vencido                    ✕ │
│                                             │
│ JUAN PÉREZ (juan@example.com)              │
│ Vencido hace 15 días                        │
│ Fecha de vencimiento: 24 de septiembre      │
│                                             │
│ [Actualizar Carnet →]                       │
└─────────────────────────────────────────────┘
```

**Alerta Crítica (Naranja):**
```
┌─────────────────────────────────────────────┐
│ 🔶 ⚠️ Carnet por Vencer (Urgente)       ✕ │
│                                             │
│ MARÍA GONZÁLEZ (maria@example.com)          │
│ Vence en 20 días                            │
│ Fecha de vencimiento: 29 de octubre         │
│                                             │
│ [Actualizar Carnet →]                       │
└─────────────────────────────────────────────┘
```

**Alerta Advertencia (Amarillo):**
```
┌─────────────────────────────────────────────┐
│ 📋 ⚠️ Carnet por Vencer                 ✕ │
│                                             │
│ CARLOS RODRÍGUEZ (carlos@example.com)       │
│ Vence en 45 días                            │
│ Fecha de vencimiento: 23 de noviembre       │
│                                             │
│ [Actualizar Carnet →]                       │
└─────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo

### **Flujo 1: Master Configura Carnet**

```
Master → Página /brokers → Selecciona corredor
             ↓
       Click "Editar"
             ↓
    Ingresa fecha de vencimiento: 2025-12-31
             ↓
       Click "Guardar"
             ↓
UPDATE brokers SET carnet_expiry_date = '2025-12-31'
             ↓
✅ Fecha guardada
             ↓
Sistema calcula: 60 días antes = 2025-11-01
             ↓
A partir del 2025-11-01 → Muestra alerta
```

### **Flujo 2: Sistema Muestra Recordatorio**

```
Usuario accede al Dashboard
             ↓
ComponentDidMount → actionGetExpiringCarnets(userRole, brokerId)
             ↓
Query a DB: SELECT * FROM brokers 
            WHERE carnet_expiry_date IS NOT NULL
            AND active = true
             ↓
Calcular días restantes: (expiryDate - today) / 86400000
             ↓
Filtrar: daysUntilExpiry <= 60
             ↓
Ordenar: Por días ascendente (más urgente primero)
             ↓
Renderizar <CarnetExpiryAlerts>
             ↓
✅ Usuario ve alertas visuales con:
   - Nombre del corredor
   - Días restantes
   - Botón para actualizar
```

### **Flujo 3: Broker Ve Su Recordatorio**

```
Broker inicia sesión
             ↓
Dashboard carga con:
  <CarnetExpiryAlerts userRole="broker" brokerId={brokerId} />
             ↓
actionGetExpiringCarnets('broker', brokerId)
             ↓
Query filtrado: .eq('id', brokerId)
             ↓
Solo retorna el carnet del broker actual
             ↓
✅ Broker ve SOLO su propia alerta (si aplica)
```

---

## 📊 Casos de Uso

### **Caso 1: Corredor Sin Carnet**

**Acción:**
- Master edita corredor
- Deja campo de carnet vacío
- Guarda

**Resultado:**
```sql
UPDATE brokers 
SET carnet_expiry_date = NULL 
WHERE id = 'broker-id';
```

✅ No se generan recordatorios

### **Caso 2: Corredor Con Carnet Válido**

**Acción:**
- Master edita corredor
- Ingresa fecha: 2026-03-15
- Guarda

**Resultado:**
```sql
UPDATE brokers 
SET carnet_expiry_date = '2026-03-15' 
WHERE id = 'broker-id';
```

✅ Recordatorio se activa el 2026-01-14 (60 días antes)

### **Caso 3: Carnet Por Vencer**

**Escenario:**
- Hoy: 2025-10-09
- Carnet vence: 2025-11-25
- Días restantes: 47

**Resultado:**
- ✅ Alerta amarilla visible
- ✅ Status: 'warning'
- ✅ Mensaje: "Vence en 47 días"

### **Caso 4: Carnet Crítico**

**Escenario:**
- Hoy: 2025-10-09
- Carnet vence: 2025-10-30
- Días restantes: 21

**Resultado:**
- ✅ Alerta naranja visible
- ✅ Status: 'critical'
- ✅ Mensaje: "Vence en 21 días"

### **Caso 5: Carnet Vencido**

**Escenario:**
- Hoy: 2025-10-09
- Carnet vence: 2025-09-20
- Días restantes: -19

**Resultado:**
- ✅ Alerta roja visible
- ✅ Status: 'expired'
- ✅ Mensaje: "Vencido hace 19 días"

---

## 📍 Integración en la App

### **Opción 1: Dashboard (Recomendado)**

```tsx
// src/app/(app)/dashboard/page.tsx
import CarnetExpiryAlerts from '@/components/brokers/CarnetExpiryAlerts';

export default function DashboardPage() {
  const { user, role, brokerId } = useAuth();
  
  return (
    <div>
      {/* Alertas al inicio del dashboard */}
      <CarnetExpiryAlerts 
        userRole={role} 
        brokerId={brokerId} 
      />
      
      {/* Resto del dashboard */}
      ...
    </div>
  );
}
```

### **Opción 2: Header/Navbar**

```tsx
// src/components/layout/Header.tsx
import CarnetExpiryAlerts from '@/components/brokers/CarnetExpiryAlerts';

export default function Header() {
  return (
    <header>
      <nav>...</nav>
      
      {/* Alertas debajo del navbar */}
      <CarnetExpiryAlerts 
        userRole={userRole} 
        brokerId={brokerId} 
      />
    </header>
  );
}
```

### **Opción 3: Página de Brokers**

```tsx
// src/app/(app)/brokers/page.tsx
export default function BrokersPage() {
  return (
    <>
      {/* Alertas al inicio de la página */}
      <CarnetExpiryAlerts userRole="master" brokerId={null} />
      
      {/* Lista de corredores */}
      <BrokersListClient />
    </>
  );
}
```

---

## ✅ Verificación

### **Testing Checklist:**

**Base de Datos:**
- [ ] Ejecutar SQL para agregar columna
- [ ] Verificar que columna existe
- [ ] Verificar que es nullable

**Interfaz de Edición:**
- [ ] Campo visible en página de corredor
- [ ] Solo Master puede editar
- [ ] Guarda fecha correctamente
- [ ] Indicador de días funciona
- [ ] Colores correctos según urgencia

**Sistema de Recordatorios:**
- [ ] Master ve todos los carnets por vencer
- [ ] Broker ve solo su carnet
- [ ] Filtro de 60 días funciona
- [ ] Orden por urgencia correcto
- [ ] Carnets NULL no aparecen

**Alertas Visuales:**
- [ ] Se muestran en el dashboard
- [ ] Colores correctos (rojo/naranja/amarillo)
- [ ] Botón descartar funciona
- [ ] localStorage persiste descartados
- [ ] Link a actualizar corrector funciona

**Casos Especiales:**
- [ ] Sin fecha → No alerta
- [ ] Fecha lejana (>60 días) → No alerta
- [ ] Fecha próxima (≤60 días) → Alerta amarilla
- [ ] Fecha crítica (≤30 días) → Alerta naranja
- [ ] Fecha vencida → Alerta roja

---

## 🚀 Mejoras Futuras (Opcional)

### **1. Notificaciones por Email**

```typescript
// Crear cronjob diario
export async function sendCarnetExpiryEmails() {
  const { data: expiring } = await actionGetExpiringCarnets('master');
  
  for (const carnet of expiring) {
    await sendEmail({
      to: carnet.email,
      subject: `Recordatorio: Carnet vence en ${carnet.daysUntilExpiry} días`,
      body: `...`
    });
  }
}
```

### **2. Historial de Renovaciones**

```sql
CREATE TABLE carnet_history (
  id UUID PRIMARY KEY,
  broker_id UUID REFERENCES brokers(id),
  old_expiry_date DATE,
  new_expiry_date DATE,
  updated_by UUID,
  updated_at TIMESTAMP
);
```

### **3. Auto-Recordatorios Escalonados**

- 60 días antes: Primera alerta
- 30 días antes: Alerta crítica
- 7 días antes: Alerta urgente diaria
- Día del vencimiento: Alerta final

### **4. Dashboard de Master**

```tsx
// Vista resumida
<div>
  <h3>Carnets por Vencer</h3>
  <div>Vencidos: {expiredCount}</div>
  <div>Críticos: {criticalCount}</div>
  <div>Próximos: {warningCount}</div>
</div>
```

---

## 📝 Resumen

✅ **Columna creada:** `brokers.carnet_expiry_date` (DATE, nullable)  
✅ **Interfaz de edición:** Campo en página de corredor con indicadores visuales  
✅ **Sistema de recordatorios:** Detecta carnets dentro de 60 días  
✅ **Alertas visuales:** Componente reutilizable con 3 niveles de urgencia  
✅ **Filtrado inteligente:** Master ve todos, Broker ve solo el suyo  
✅ **UX mejorado:** Colores, íconos, enlaces directos

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Implementado - Requiere ejecutar SQL en Supabase
