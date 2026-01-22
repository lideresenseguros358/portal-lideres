# INTEGRACIÓN DE CORREOS EN COMISIONES

## Ubicación donde integrar

Como no existe un sistema de hooks, debes agregar las llamadas manualmente donde se marquen quincenas como pagadas o se apliquen ajustes.

---

## 1. Al marcar quincena como PAID

**Buscar en el código donde se actualiza `status = 'PAID'` en la tabla `fortnights`**

Probablemente en algún endpoint como:
- `/api/commissions/fortnight-details/route.ts`
- O en algún componente que actualice el estado

**Agregar después del update:**

```typescript
import { notifyFortnightPaid } from '@/lib/email/commissions';

// Después de actualizar el status a PAID
const { data: updatedFortnight } = await supabase
  .from('fortnights')
  .update({ status: 'PAID', paid_date: new Date().toISOString() })
  .eq('id', fortnightId)
  .select()
  .single();

if (updatedFortnight) {
  // Enviar correo al broker
  try {
    await notifyFortnightPaid(fortnightId);
  } catch (emailError) {
    console.error('[COMMISSIONS] Error sending payment notification:', emailError);
    // No fallar la operación si el correo falla
  }
}
```

---

## 2. Al aplicar ajustes

**Buscar donde se crean ajustes o adelantos**

Probablemente en:
- `/api/commissions/advances/route.ts`
- O donde se procesen ajustes manuales

**Agregar después de crear el ajuste:**

```typescript
import { notifyAdjustmentPaid } from '@/lib/email/commissions';

// Después de crear el ajuste
const adjustmentData = {
  brokerId: 'broker-uuid',
  amount: 500,
  type: 'Adelanto', // o 'Ajuste', 'Descuento', etc.
  concept: 'Adelanto de quincena',
  description: 'Adelanto solicitado el 15/01/2026',
};

try {
  await notifyAdjustmentPaid(adjustmentData);
} catch (emailError) {
  console.error('[COMMISSIONS] Error sending adjustment notification:', emailError);
}
```

---

## 3. Búsqueda de archivos

Para encontrar dónde integrar, busca en el código:

```bash
# Buscar donde se actualiza status de fortnights
grep -r "status.*PAID" src/app/api/commissions/

# Buscar donde se crean ajustes o adelantos
grep -r "advances" src/app/api/commissions/
grep -r "adjustments" src/app/api/commissions/
```

---

## Ejemplo completo

```typescript
// En el endpoint que marca quincena como pagada
export async function POST(request: NextRequest) {
  const { fortnightId, brokerId } = await request.json();
  
  const supabase = await getSupabaseServer();
  
  // Marcar como pagada
  const { data: fortnight, error } = await supabase
    .from('fortnights')
    .update({ 
      status: 'PAID',
      paid_date: new Date().toISOString() 
    })
    .eq('id', fortnightId)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Enviar correo (NO bloquear si falla)
  notifyFortnightPaid(fortnightId).catch(err => {
    console.error('[COMMISSIONS] Email error:', err);
  });
  
  return NextResponse.json({ success: true, fortnight });
}
```

---

**Nota:** Los correos se envían de forma asíncrona y NO bloquean la operación principal. Si falla el envío de correo, la operación continúa normalmente.
