# CORRECCIÓN CRÍTICA: Problema de Zona Horaria en Fechas

## Problema Identificado

Las fechas en el portal estaban cambiando de día debido a la conversión automática a UTC cuando se usaba `.toISOString()`.

### Ejemplo del Problema:

```typescript
// ❌ INCORRECTO - Causa cambio de fecha
// Usuario en Panamá (UTC-5) ingresa fecha: 2024-12-04

const date = new Date(); // En Panamá: 2024-12-04 22:00:00-05:00
const dateString = date.toISOString().split('T')[0]; 
// Result: "2024-12-05" ❌ (convirtió a UTC: 2024-12-05 03:00:00Z)
```

**Impacto:**
- ✅ Usuario ingresa: 4 de diciembre
- ❌ Sistema guarda: 5 de diciembre
- ❌ Diferencia de 1 día en fechas de inicio/renovación/nacimiento

## Causa Raíz

### JavaScript y Zonas Horarias

1. `new Date()` crea un Date object con la hora local del sistema
2. `.toISOString()` convierte a UTC (Coordinated Universal Time)
3. Panamá está en UTC-5, entonces:
   - 22:00 en Panamá (UTC-5) = 03:00 del día siguiente en UTC
   - Esto causa que la fecha cambie de día

### Código Problemático Encontrado:

```typescript
// ❌ Múltiples lugares en el código
new Date().toISOString().split('T')[0]

// ❌ Usados en:
- ClientPolicyWizard.tsx (línea 48)
- PreliminaryClientsTab.tsx (línea 66)
- RegisterPaymentWizard.tsx (múltiples líneas)
- EditPaymentModal.tsx
- optiseguro.service.ts (línea 390)
- quotes.service.ts (línea 268)
- renewals.ts (líneas 30, 71, 133, 247)
- Y muchos más...
```

## Solución Implementada

### Archivo Creado: `src/lib/utils/dates.ts`

Utilidades para manejar fechas **SIN conversión de zona horaria**.

### Funciones Principales:

#### 1. `getTodayLocalDate()` - Reemplaza `new Date().toISOString().split('T')[0]`

```typescript
// ✅ CORRECTO - Usa fecha local
import { getTodayLocalDate } from '@/lib/utils/dates';

const today = getTodayLocalDate(); // "2024-12-04" (fecha local correcta)
```

**Implementación:**
```typescript
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

#### 2. `formatLocalDate(date)` - Convierte Date a string sin UTC

```typescript
// ✅ CORRECTO
const date = new Date(2024, 11, 4); // Mes 11 = diciembre (0-indexed)
const dateString = formatLocalDate(date); // "2024-12-04"
```

#### 3. `addDaysToLocalDate(dateString, days)` - Suma/resta días

```typescript
// ✅ Suma 30 días a una fecha
const today = "2024-12-04";
const future = addDaysToLocalDate(today, 30); // "2025-01-03"

// ✅ Resta 7 días
const past = addDaysToLocalDate(today, -7); // "2024-11-27"
```

#### 4. `addOneYearToDate(dateString)` - Para renovaciones

```typescript
// ✅ Suma 1 año (para fecha de renovación)
const startDate = "2024-12-04";
const renewalDate = addOneYearToDate(startDate); // "2025-12-04"
```

#### 5. `formatDateForDisplay(dateString)` - Formato dd/mm/yyyy

```typescript
// ✅ Para mostrar en UI
const date = "2024-12-04";
const display = formatDateForDisplay(date); // "04/12/2024"
```

#### 6. `extractDateOnly(dateOrTimestamp)` - Limpia timestamps

```typescript
// ✅ Maneja tanto fechas como timestamps
extractDateOnly("2024-12-04") // "2024-12-04"
extractDateOnly("2024-12-04T22:00:00.000Z") // "2024-12-04"
extractDateOnly(null) // null
```

## Migración del Código

### Patrón 1: Obtener Fecha de Hoy

```typescript
// ❌ ANTES
const today = new Date().toISOString().split('T')[0];

// ✅ DESPUÉS
import { getTodayLocalDate } from '@/lib/utils/dates';
const today = getTodayLocalDate();
```

### Patrón 2: Fecha Futura/Pasada

```typescript
// ❌ ANTES
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);
const futureISO = futureDate.toISOString().split('T')[0];

// ✅ DESPUÉS
import { getFutureDateLocal } from '@/lib/utils/dates';
const futureDate = getFutureDateLocal(30);
```

### Patrón 3: Fecha de Renovación (+ 1 año)

```typescript
// ❌ ANTES
const startDate = new Date(editForm.start_date);
const renewalDate = new Date(startDate);
renewalDate.setFullYear(startDate.getFullYear() + 1);
const renewalDateStr = renewalDate.toISOString().split('T')[0];

// ✅ DESPUÉS
import { addOneYearToDate } from '@/lib/utils/dates';
const renewalDate = addOneYearToDate(editForm.start_date);
```

### Patrón 4: Max/Min en Inputs

```typescript
// ❌ ANTES
<input 
  type="date" 
  max={new Date().toISOString().split('T')[0]}
/>

// ✅ DESPUÉS
import { getMaxDateForInput } from '@/lib/utils/dates';
<input 
  type="date" 
  max={getMaxDateForInput()}
/>
```

### Patrón 5: Validación de Fechas

```typescript
// ✅ NUEVO - Validar formato
import { isValidDateString } from '@/lib/utils/dates';

if (!isValidDateString(formData.birth_date)) {
  setError('Fecha inválida');
  return;
}
```

## Archivos que Requieren Actualización

### Prioridad ALTA (afectan base de datos):

1. **src/components/db/ClientPolicyWizard.tsx**
   - Línea 48: `const today = new Date().toISOString().split('T')[0];`
   - Línea 653-661: Cálculo de fecha de renovación

2. **src/components/db/PreliminaryClientsTab.tsx**
   - Línea 66: `const today = new Date().toISOString().split('T')[0];`
   - Línea 30-33: Cálculo de renovación

3. **src/lib/is/optiseguro.service.ts**
   - Línea 390: `start_date: new Date().toISOString().split('T')[0]`

4. **src/lib/is/quotes.service.ts**
   - Línea 268: `start_date: new Date().toISOString().split('T')[0]`

5. **src/lib/notifications/renewals.ts**
   - Línea 30: `const todayISO = today.toISOString().split('T')[0];`
   - Línea 71: `const futureISO = futureDate.toISOString().split('T')[0];`
   - Línea 133: `const futureISO = futureDate.toISOString().split('T')[0];`
   - Línea 247: `const sixtyDaysAgoISO = sixtyDaysAgo.toISOString().split('T')[0];`

### Prioridad MEDIA (afectan UI/UX):

6. **src/components/checks/RegisterPaymentWizard.tsx**
   - Línea 74, 122, 606, 649, 664, 670, 737, 1232, 1271

7. **src/components/checks/EditPaymentModal.tsx**
   - Línea 106, 114, 341

8. **src/components/db/ClientForm.tsx**
   - Línea 77: `created_at: new Date().toISOString()`

9. **src/components/delinquency/ImportTab.tsx**
   - Línea 20: `const today = new Date().toISOString().split('T')[0];`

### Prioridad BAJA (solo display):

10. **src/components/quotes/ThirdPartyIssuanceForm.tsx**
    - Línea 293, 591: `max={new Date().toISOString().split('T')[0]}`

11. **src/components/commissions/AddAdvanceModal.tsx**
    - Línea 332: `min={new Date().toISOString().split('T')[0]}`

12. **src/components/db/DatabaseTabs.tsx**
    - Línea 341, 468: Nombres de archivo con fecha

13. **src/components/commissions/NewFortnightTab.tsx**
    - Línea 348, 388: Nombres de archivo con fecha

## Ejemplo de Migración Completa

### Archivo: `ClientPolicyWizard.tsx`

#### ANTES:
```typescript
const [formData, setFormData] = useState<FormData>({
  // ...
});
const today = new Date().toISOString().split('T')[0];

// Al cambiar start_date
onChange={(e) => {
  setFormData({ ...formData, start_date: e.target.value });
  if (!formData.renewal_date) {
    const startDate = new Date(e.target.value);
    const renewalDate = new Date(startDate);
    renewalDate.setFullYear(startDate.getFullYear() + 1);
    const renewalDateStr = renewalDate.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, renewal_date: renewalDateStr }));
  }
}}
```

#### DESPUÉS:
```typescript
import { getTodayLocalDate, addOneYearToDate } from '@/lib/utils/dates';

const [formData, setFormData] = useState<FormData>({
  // ...
});
const today = getTodayLocalDate(); // ✅ Fecha local

// Al cambiar start_date
onChange={(e) => {
  setFormData({ ...formData, start_date: e.target.value });
  if (!formData.renewal_date && e.target.value) {
    const renewalDate = addOneYearToDate(e.target.value); // ✅ Simple y correcto
    setFormData(prev => ({ ...prev, renewal_date: renewalDate }));
  }
}}
```

## Ventajas de la Nueva Implementación

### 1. **Sin Conversión UTC**
- ✅ Las fechas se mantienen en zona horaria local
- ✅ No hay cambio de día por diferencia horaria
- ✅ Lo que el usuario ingresa es lo que se guarda

### 2. **Código Más Limpio**
```typescript
// Antes: 5 líneas
const startDate = new Date(editForm.start_date);
const renewalDate = new Date(startDate);
renewalDate.setFullYear(startDate.getFullYear() + 1);
const renewalDateStr = renewalDate.toISOString().split('T')[0];
setFormData({ renewal_date: renewalDateStr });

// Después: 1 línea
setFormData({ renewal_date: addOneYearToDate(editForm.start_date) });
```

### 3. **Consistencia**
- ✅ Todas las fechas se manejan de la misma manera
- ✅ Funciones reutilizables en todo el proyecto
- ✅ Fácil de mantener y testear

### 4. **Type-Safe**
- ✅ TypeScript valida tipos de entrada/salida
- ✅ JSDoc completo con ejemplos
- ✅ Retornos consistentes (string en formato YYYY-MM-DD)

## Testing

### Casos de Prueba:

```typescript
import { 
  getTodayLocalDate, 
  addDaysToLocalDate, 
  addOneYearToDate,
  formatLocalDate,
  daysDifference
} from '@/lib/utils/dates';

// Test 1: Fecha de hoy
const today = getTodayLocalDate();
console.log('Hoy:', today); // "2024-12-04"

// Test 2: Suma de días
const future = addDaysToLocalDate(today, 30);
console.log('30 días después:', future); // "2025-01-03"

// Test 3: Renovación (+ 1 año)
const startDate = "2024-12-04";
const renewalDate = addOneYearToDate(startDate);
console.log('Renovación:', renewalDate); // "2025-12-04"

// Test 4: Diferencia de días
const days = daysDifference("2024-12-04", "2024-12-31");
console.log('Días hasta fin de año:', days); // 27

// Test 5: Format Date object
const date = new Date(2024, 11, 4); // Diciembre 4, 2024
const formatted = formatLocalDate(date);
console.log('Formateada:', formatted); // "2024-12-04"
```

## Reglas de Oro

### ✅ SIEMPRE:
1. Usar `getTodayLocalDate()` para obtener fecha de hoy
2. Usar `addDaysToLocalDate()` para operaciones con días
3. Usar `addOneYearToDate()` para renovaciones
4. Usar `formatLocalDate()` para convertir Date a string
5. Guardar fechas en BD como strings "YYYY-MM-DD" sin hora

### ❌ NUNCA:
1. Usar `new Date().toISOString().split('T')[0]`
2. Usar `toISOString()` para fechas date-only
3. Incluir hora/timestamp en fechas de start_date, renewal_date, birth_date
4. Confiar en conversión automática UTC

## Impacto en Base de Datos

### Campos Afectados:

- **policies.start_date** - Fecha inicio de póliza
- **policies.renewal_date** - Fecha renovación
- **clients.birth_date** - Fecha de nacimiento
- **brokers.birth_date** - Fecha de nacimiento corredor
- **user_requests.fecha_nacimiento** - Fecha nacimiento solicitud
- **pending_payments.date** - Fecha de pago
- **bank_transfers.date** - Fecha de transferencia

### Tipo de Dato en BD:

```sql
-- Todos estos campos son tipo DATE (no TIMESTAMP)
ALTER TABLE policies 
  ALTER COLUMN start_date TYPE DATE;
  
ALTER TABLE policies 
  ALTER COLUMN renewal_date TYPE DATE;
  
ALTER TABLE clients 
  ALTER COLUMN birth_date TYPE DATE;
```

PostgreSQL/Supabase maneja DATE como string "YYYY-MM-DD" sin hora, lo cual es perfecto para nuestro caso.

## Verificación

### Antes de Desplegar:

```bash
# 1. Verificar TypeScript
npm run typecheck

# 2. Buscar usos de toISOString pendientes
grep -r "toISOString().split" src/

# 3. Buscar new Date() seguido de setDate
grep -r "setDate.*getDate" src/

# 4. Verificar imports
grep -r "from '@/lib/utils/dates'" src/
```

### Después de Desplegar:

1. Crear nuevo cliente con fecha de nacimiento → Verificar que se guarda correcta
2. Crear nueva póliza con start_date → Verificar que renewal_date se calcula correcta
3. Verificar notificaciones de renovación (30, 7, 0 días)
4. Verificar sistema de pagos/cheques con fechas
5. Verificar preliminares en base de datos

## Status de Migración

### ✅ Completado:
- [x] Archivo `dates.ts` creado con todas las utilidades
- [x] Documentación completa (este archivo)
- [x] TypeScript errors corregidos
- [ ] Migración de archivos (pendiente)
- [ ] Testing en staging
- [ ] Deploy a producción

### 📋 Siguiente Paso:

Actualizar los archivos de prioridad ALTA uno por uno, testeando después de cada cambio.

## Soporte

Si encuentras problemas con fechas después de esta migración:

1. Verificar que el archivo esté usando `import from '@/lib/utils/dates'`
2. Verificar que NO esté usando `.toISOString().split('T')[0]`
3. Verificar que las fechas en BD sean strings "YYYY-MM-DD" (sin hora)
4. Verificar zona horaria del navegador (debe ser America/Panama o UTC-5)

**Nota final:** Esta corrección es CRÍTICA para la integridad de los datos. Todas las fechas futuras deben usar las nuevas utilidades para evitar discrepancias de zona horaria.
