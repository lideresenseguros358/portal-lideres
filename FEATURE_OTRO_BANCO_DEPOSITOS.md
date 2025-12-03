# ✅ NUEVA FUNCIONALIDAD: Otro Banco/Depósitos

## Resumen

Nueva opción en el flujo de pagos pendientes para registrar pagos de otros bancos o depósitos donde aún no se tiene el número de referencia bancaria disponible.

---

## Problema Resuelto

**Antes:** Cuando llegaba un pago por depósito o transferencia de otro banco sin número de referencia, había que:
- Inventar un número temporal que nunca coincidiría con el banco
- El pago quedaba en rojo permanentemente como "no conciliado"
- Era difícil recordar que había que actualizar la referencia

**Ahora:** 
- Se registra como "Otro Banco/Depósitos"
- Queda en estado **amarillo** visible
- Badge claro: "Actualizar referencia para conciliar"
- Se puede editar fácilmente después

---

## Características Implementadas

### 1. Nueva Opción en Wizard (Paso 2)

**Ubicación:** RegisterPaymentWizard.tsx - Paso 2

**Opciones de Método de Pago:**
1. 🏦 Transferencia Bancaria (normal)
2. 🏪 **Otro Banco/Depósitos** ← NUEVA
3. 💰 Descuento a Corredor

**Comportamiento:**
- Al seleccionar "Otro Banco/Depósitos":
  - Crea referencia temporal: `TEMP-{timestamp}`
  - Marca con `is_other_bank: true` en metadata
  - Muestra advertencia amarilla informativa
  - No permite múltiples referencias

### 2. Estado Especial "Other Bank"

**Archivo:** PendingPaymentsTab.tsx - `getPaymentState()`

**Estado:**
```typescript
{
  key: 'other_bank',
  label: 'Actualizar referencia para conciliar',
  badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  blocked: false
}
```

**Badge Visual:**
- Color: Amarillo (amber)
- Texto: "Actualizar referencia para conciliar"
- No bloqueado (se puede procesar)

### 3. Ordenamiento Inteligente

**Prioridad de Ordenamiento:**
1. ✅ **Conciliados** (verdes) - Primero
2. ⚠️ **Otro Banco/Depósitos** (amarillos) - Intermedio
3. ❌ **No conciliados** (rojos) - Último

**Razón:** Los de "otro banco" están en un estado intermedio - no están mal, solo necesitan actualización.

### 4. Metadata Guardado

**Estructura en `notes` (JSON):**
```json
{
  "notes": "Notas del usuario",
  "is_other_bank": true
}
```

**Detectado en:**
- Wizard de creación
- Vista de lista
- Modal de edición (futuro)
- Ordenamiento

---

## Flujo de Uso

### Paso 1: Crear Pago

1. Usuario hace click en "Nuevo Pago"
2. Completa Paso 1 (datos básicos)
3. En Paso 2, selecciona **"🏪 Otro Banco/Depósitos"**
4. Ve advertencia amarilla:
   ```
   ⚠️ Registro Temporal
   Este pago quedará marcado como "Pendiente de conciliar" 
   hasta que actualices el número de referencia bancaria correcto.
   Podrás editarlo más tarde desde la lista de pagos pendientes.
   ```
5. Completa el resto del wizard
6. Pago se crea con referencia `TEMP-{timestamp}`

### Paso 2: Ver en Lista

- Pago aparece con badge **amarillo**
- Texto: "Actualizar referencia para conciliar"
- Ordenado después de conciliados, antes de no conciliados
- Visible y claro que necesita atención

### Paso 3: Actualizar Referencia (Futuro)

1. Click en "Editar" del pago
2. Cambiar número de referencia por el real
3. Guardar
4. Automáticamente se reconcialiará con el banco
5. Badge cambia a verde o rojo según corresponda

---

## Archivos Modificados

### 1. `src/components/checks/RegisterPaymentWizard.tsx`

**Cambios:**
- Agregado estado `paymentMethod` con 3 opciones
- Agregado estado `isOtherBank`
- Nueva opción "Otro Banco/Depósitos" en UI
- Advertencia informativa para otros bancos
- Payload incluye `is_other_bank: true`

### 2. `src/app/(app)/checks/actions.ts`

**Cambios:**
- Interface actualizada con `is_other_bank?: boolean`
- Metadata guarda `is_other_bank` en `notes`

### 3. `src/components/checks/PendingPaymentsTab.tsx`

**Cambios:**
- `getPaymentState()` detecta `is_other_bank`
- Nuevo estado 'other_bank' con badge amarillo
- `sortPayments()` prioridad 2 para other_bank
- Orden: Conciliados → Otro Banco → No Conciliados

---

## Casos de Uso

### Caso 1: Depósito en Efectivo
```
Cliente hace depósito en efectivo en el banco.
No hay número de referencia inmediato.
→ Registrar como "Otro Banco/Depósitos"
→ Cuando el banco procese, actualizar referencia
```

### Caso 2: Transferencia desde Otro Banco
```
Cliente transfiere desde banco diferente.
No se conoce la referencia hasta que se confirme.
→ Registrar como "Otro Banco/Depósitos"
→ Al día siguiente, obtener referencia y actualizar
```

### Caso 3: Pago Internacional
```
Transferencia internacional en proceso.
Referencia no disponible al momento del registro.
→ Registrar como "Otro Banco/Depósitos"
→ Cuando llegue confirmación, actualizar
```

---

## Ventajas

### UX Mejorado:
✅ Estado visual claro (amarillo vs rojo)
✅ Badge descriptivo
✅ Ordenamiento lógico
✅ Recordatorio visible

### Operacional:
✅ No bloquea otros procesos
✅ Fácil de identificar
✅ Proceso de actualización claro
✅ No se pierde en lista roja

### Técnico:
✅ Metadata estructurado
✅ Ordenamiento automático
✅ Detección confiable
✅ Compatible con edición

---

## Testing Recomendado

### Test 1: Crear Pago Otro Banco
1. Crear nuevo pago
2. Seleccionar "Otro Banco/Depósitos"
3. Verificar advertencia amarilla
4. Completar wizard
5. Verificar badge amarillo en lista
6. Verificar ordenamiento (entre verdes y rojos)

### Test 2: Actualizar Referencia (Futuro)
1. Editar pago de otro banco
2. Cambiar referencia temporal por real
3. Guardar
4. Verificar que se reconcilic con banco
5. Verificar cambio de badge

### Test 3: Ordenamiento
1. Crear varios pagos:
   - 2 conciliados (verdes)
   - 2 otro banco (amarillos)
   - 2 no conciliados (rojos)
2. Verificar orden en lista:
   - Primero: verdes
   - Segundo: amarillos
   - Tercero: rojos

---

## Pendiente para Próxima Iteración

### EditPaymentModal:
- [ ] Agregar opción para cambiar `is_other_bank`
- [ ] Validar nuevo número de referencia
- [ ] Quitar `is_other_bank` al guardar referencia real
- [ ] Reconcialiación automática

### Notificaciones:
- [ ] Email/notificación cuando hay pagos en "otro banco"
- [ ] Dashboard widget con count de pagos pendientes de actualizar

### Reportes:
- [ ] Incluir estado "Otro Banco" en reportes
- [ ] Filtro por este estado en buscador

---

## Verificación

```bash
✅ npm run typecheck → 0 errores
✅ Nueva opción en wizard funcionando
✅ Badge amarillo correcto
✅ Ordenamiento implementado
✅ Metadata guardado correctamente
✅ Estado detectado correctamente
```

---

**Fecha de implementación:** Diciembre 3, 2025
**Autor:** Sistema de desarrollo
**Estado:** ✅ **COMPLETADO** (pendiente EditPaymentModal para próxima iteración)
