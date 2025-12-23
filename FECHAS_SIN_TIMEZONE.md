# Manejo de Fechas Sin Conversión de Zona Horaria

## Problema

Los inputs `type="date"` en HTML solo piden día/mes/año (NO hora), pero JavaScript convierte automáticamente por zona horaria al usar `new Date('YYYY-MM-DD')`, causando cambios de día incorrectos.

**Ejemplo:**
```javascript
// ❌ INCORRECTO - convierte por timezone
const date = new Date('1990-03-15');  // Puede mostrar 14 o 16 según zona horaria

// ✅ CORRECTO - fecha fija sin conversión
import { formatDateLongNoTimezone } from '@/lib/utils/dates';
formatDateLongNoTimezone('1990-03-15');  // "15 de marzo de 1990"
```

---

## Funciones Disponibles en `@/lib/utils/dates`

### **Para Guardar/Obtener Fechas:**

```typescript
// Fecha actual local (NO UTC)
getTodayLocalDate()  // "2024-12-23"

// Convertir Date a string sin UTC
formatLocalDate(new Date())  // "2024-12-23"

// Sumar/restar días
addDaysToLocalDate("2024-12-23", 7)  // "2024-12-30"

// Sumar 1 año (para renovaciones)
addOneYearToDate("2024-12-23")  // "2025-12-23"
```

### **Para Mostrar Fechas:**

```typescript
// Formato corto: dd/mm/yyyy
formatDateForDisplay("1990-03-15")  // "15/03/1990"

// Formato largo SIN timezone (USAR para birth_date, issue_date, etc.)
formatDateLongNoTimezone("1990-03-15")  // "15 de marzo de 1990"

// Formato largo CON timezone (usar solo para renewal_date, start_date de pólizas)
formatDateLongSpanish("1990-03-15")  // "15 de marzo de 1990" (con new Date())
```

### **Validación:**

```typescript
isValidDateString("1990-03-15")  // true
isValidDateString("invalid")     // false
```

---

## Cuándo Usar Cada Función

### **❌ NO usar `new Date()` para:**
- `birth_date` - Fecha de nacimiento
- `issue_date` - Fecha de emisión de documentos
- Cualquier fecha "date-only" (sin hora)

### **✅ Usar funciones sin timezone:**
```typescript
// Formatear para display
formatDateLongNoTimezone(client.birth_date)
formatDateForDisplay(client.birth_date)

// Obtener fecha actual
const today = getTodayLocalDate();
```

### **⚠️ Usar con precaución (solo para fechas con hora):**
```typescript
// Solo usar new Date() si la fecha incluye hora/timestamp
const eventDate = new Date('2024-12-23T15:30:00');
```

---

## Patrón de Uso en Componentes

### **1. Input de fecha:**
```tsx
import { getTodayLocalDate } from '@/lib/utils/dates';

const [formData, setFormData] = useState({
  birth_date: getTodayLocalDate()  // Valor inicial
});

<input
  type="date"
  value={formData.birth_date}
  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
  max={getTodayLocalDate()}  // Máximo = hoy
/>
```

### **2. Mostrar fecha:**
```tsx
import { formatDateLongNoTimezone } from '@/lib/utils/dates';

<p>{formatDateLongNoTimezone(client.birth_date)}</p>
// Resultado: "15 de marzo de 1990"
```

### **3. Guardar en API:**
```typescript
// API route
const updatePayload = {
  birth_date: body.birth_date?.trim() || null,  // String YYYY-MM-DD directo
};

// ❌ NO hacer:
// birth_date: new Date(body.birth_date).toISOString()  // INCORRECTO
```

---

## Archivos Ya Actualizados

✅ `src/lib/utils/dates.ts` - Funciones utilitarias creadas  
✅ `src/app/(app)/api/db/clients/[id]/route.ts` - API guarda fecha fija  
✅ `src/components/db/ClientDetailsModal.tsx` - Usa `formatDateLongNoTimezone`  
✅ `src/components/db/PreliminaryClientsTab.tsx` - Usa `formatDateForDisplay`  

---

## Archivos Pendientes de Actualizar

Todos los componentes con `type="date"` deben usar las funciones de `dates.ts`:

- `components/quotes/ThirdPartyIssuanceForm.tsx`
- `components/checks/RegisterPaymentWizard.tsx`
- `components/checks/EditPaymentModal.tsx`
- `components/delinquency/ImportTab.tsx`
- `components/cotizadores/FormAutoCoberturaCompleta.tsx`
- `components/db/ClientPolicyWizard.tsx`
- `components/db/ClientForm.tsx`
- `components/checks/BankHistoryTab.tsx`
- `components/commissions/PayAdvanceModal.tsx`
- Y todos los demás con inputs de fecha

---

## Regla de Oro

**NUNCA usar `new Date('YYYY-MM-DD')` para fechas date-only**

Siempre importar y usar funciones de `@/lib/utils/dates` que hacen parse manual sin conversión de timezone.
