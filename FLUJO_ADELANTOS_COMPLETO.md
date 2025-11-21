# 📋 FLUJO COMPLETO DE ADELANTOS - DOCUMENTACIÓN

## 🎯 RESUMEN DEL SISTEMA

El sistema maneja dos tipos de adelantos:
1. **Adelantos Normales**: Una sola vez, se eliminan cuando están pagados
2. **Adelantos Recurrentes**: Se resetean automáticamente al pagar, con filtro por quincena (Q1/Q2)

---

## 📊 1. CREAR ADELANTO NORMAL

### Flujo:
```
Usuario → Click "Agregar Adelanto" → Llenar formulario → Guardar
```

### Proceso Backend:
- **Función**: `actionAddAdvance()`
- **Validación**: Monto > 0, broker válido
- **Creación**: Inserta en tabla `advances`
- **Campos**:
  - `broker_id`: ID del corredor
  - `amount`: Monto del adelanto
  - `reason`: Motivo
  - `status`: 'PENDING'
  - `is_recurring`: false
  - `recurrence_id`: null

### Estado Final:
✅ Adelanto aparece en **Deudas Activas**

---

## 🔁 2. CREAR ADELANTO RECURRENTE

### Flujo:
```
Usuario → Click "Agregar Adelanto" → Toggle "Recurrente" → Seleccionar Q1 o Q2 → Guardar
```

### Proceso Backend:
- **Función**: `actionCreateAdvanceRecurrence()`
- **Paso 1**: Crear configuración en `advance_recurrences`
  - `broker_id`
  - `amount`: Monto original
  - `reason`: Razón (debe incluir "Q1" o "Q2")
  - `frequency`: 'biweekly'
  - `is_active`: true
  
- **Paso 2**: Crear adelanto(s) en `advances`
  - Si Q1 → 1 adelanto con reason "...(Recurrente Q1)"
  - Si Q2 → 1 adelanto con reason "...(Recurrente Q2)"
  - Si Ambos → 2 adelantos (uno Q1, uno Q2)
  - Campos adicionales:
    - `is_recurring`: true
    - `recurrence_id`: ID de la configuración
    - `status`: 'PENDING'

### Estado Final:
✅ Adelanto(s) aparece(n) en **Deudas Activas**
✅ Badge: 🔁 RECURRENTE Q1 o Q2

---

## 💰 3. PAGAR ADELANTO NORMAL

### Flujo:
```
Usuario → Click "Pago Externo" → Seleccionar adelantos → Asignar montos → Confirmar
```

### Proceso Backend:
- **Función**: `actionApplyAdvancePayment()`
- **Paso 1**: Validar adelanto existe
- **Paso 2**: Crear registro en `advance_logs`
  - `advance_id`
  - `amount`: Monto pagado
  - `payment_type`: 'cash' o 'transfer'
  
- **Paso 3**: Actualizar adelanto
  - `amount`: amount - pago
  - `status`: 
    - Si `newAmount <= 0` → 'PAID'
    - Si `newAmount > 0` → 'PARTIAL'

- **Paso 4**: Si es transferencia, registrar en `payment_details` para historial banco

### Estados:
- **Pago Parcial**: 
  - Status: 'PARTIAL'
  - Aparece en **Deudas Activas** con monto restante
  
- **Pago Completo**:
  - Status: 'PAID'
  - Desaparece de **Deudas Activas**
  - Aparece en **Descuentos** (agrupado por fecha de pago)

---

## 🔄 4. PAGAR ADELANTO RECURRENTE

### Flujo:
```
Usuario → Click "Pago Externo" → Solo ve adelantos de quincena actual → Asignar montos → Confirmar
```

### Filtro de Quincena:
```javascript
const day = new Date().getDate();
const currentQuincena = day >= 16 ? 'Q1' : 'Q2';

// Si Q1 (16-31): Solo muestra adelantos con "Q1" en reason
// Si Q2 (01-15): Solo muestra adelantos con "Q2" en reason
```

### Proceso Backend:
- **Función**: `actionApplyAdvancePayment()`
- **Paso 1**: Crear registro en `advance_logs` (igual que normal)

- **Paso 2**: Si es pago parcial:
  - `amount`: amount - pago
  - `status`: 'PARTIAL'
  - Permanece en **Deudas Activas**

- **Paso 3**: Si es pago completo (`newAmount <= 0`):
  - **NO marca como PAID**
  - Busca configuración en `advance_recurrences`
  - **RESETEA** adelanto:
    - `amount`: Monto original de configuración
    - `status`: 'PENDING'
  - **Permanece en Deudas Activas**
  - Historial de pagos se mantiene en `advance_logs`

### Ventajas:
✅ Adelanto siempre visible en **Deudas Activas**
✅ Historial completo de pagos accesible
✅ No se duplica (mismo ID)
✅ Se resetea automáticamente

---

## 🗑️ 5. ELIMINAR ADELANTO NORMAL

### Flujo:
```
Usuario → Click "Eliminar" → Confirmar
```

### Proceso Backend:
- **Función**: `actionDeleteAdvance()`
- **Validación**: Verificar si tiene historial de pagos

**Caso A: Sin historial de pagos**
- Eliminar de tabla `advances`
- Mensaje: "Adelanto eliminado"

**Caso B: Con historial de pagos**
- Cambiar status a 'PAID'
- Monto = 0
- Mensaje: "Adelanto movido a Deudas Saldadas (tiene historial)"
- Aparece en **Descuentos**

---

## 🗑️ 6. ELIMINAR ADELANTO RECURRENTE

### Flujo:
```
Usuario → Click "Eliminar" → Confirmar
```

### Proceso Backend:
- **Función**: `actionDeleteAdvance()`
- **Validación**: Detecta `is_recurring = true`

**Acción:**
- Eliminar de tabla `advances` (sin importar historial)
- Mensaje: "Adelanto recurrente eliminado"
- **NO se recrea automáticamente** (sync-recurrences desactivado)

**Nota:** Si quieres recrearlo, debes crear uno nuevo manualmente desde la configuración.

---

## 📊 7. VISUALIZACIÓN EN TABS

### Tab "Deudas Activas"
**Muestra:**
- Adelantos con `status = 'PENDING'` o `'PARTIAL'`
- **Adelantos recurrentes**: SIEMPRE visibles (sin importar status)
- Filtro: `amount > 0` para no recurrentes
- Agrupados por corredor
- Ordenados: Recurrentes primero, luego normales

**Columnas:**
- Motivo (con badge 🔁 RECURRENTE Q1/Q2)
- Monto
- Fecha de creación
- Acciones: Ver Historial, Eliminar

### Tab "Descuentos"
**Muestra:**
- Adelantos con `total_paid > 0` (calculado desde `advance_logs`)
- Agrupados por **fecha de pago** (último pago)
- **NO por status**, sino por si tienen pagos registrados

**Agrupación:**
```javascript
// Extrae fecha YYYY-MM-DD directamente (sin conversiones de zona horaria)
const dateKey = advance.last_payment_date.substring(0, 10);
// Formatea a DD/MM/YYYY
const [year, month, day] = dateKey.split('-');
const dateDisplay = `${day}/${month}/${year}`;
```

**Columnas:**
- Fecha de pago (header expandible)
- Motivo
- Monto pagado (de `advance_logs`)
- Acciones: Ver Historial

---

## 📈 8. HISTORIAL DE PAGOS

### Función:
- Muestra todos los pagos registrados en `advance_logs` para un adelanto
- Incluye:
  - Fecha de pago
  - Monto
  - Tipo (efectivo/transferencia)
  - Quincena (si aplica)

### Accesible desde:
- **Deudas Activas**: Click en ícono historial
- **Descuentos**: Click en ícono historial

---

## 🔍 9. TOTALES Y CÁLCULOS

### Total Deudas Activas:
```javascript
// Suma de adelantos PENDING + PARTIAL con amount > 0
const totalPending = advances
  .filter(a => (a.status === 'pending' || a.status === 'partial') && a.amount > 0)
  .reduce((sum, a) => sum + a.amount, 0);
```

### Total Descuentos:
```javascript
// Suma de total_paid desde advance_logs
const totalPaid = advanceLogs
  .reduce((sum, log) => sum + log.amount, 0);
```

---

## ⚠️ 10. PROBLEMAS CONOCIDOS Y SOLUCIONES

### ❌ Problema: Duplicados de adelantos recurrentes
**Causa:** sync-recurrences creaba adelantos automáticamente
**Solución:** Desactivado sync automático

### ❌ Problema: Loop infinito al eliminar
**Causa:** sync recreaba el adelanto eliminado
**Solución:** sync-recurrences ahora verifica si ya existe adelanto antes de crear

### ❌ Problema: Fechas incorrectas en Descuentos
**Causa:** Conversión de zona horaria con `new Date()`
**Solución:** Usar `substring(0, 10)` directo en fecha ISO

---

## ✅ 11. VALIDACIONES Y REGLAS

### Regla 1: Adelantos recurrentes siempre en Deudas Activas
```javascript
if (a.is_recurring && a.recurrence_id) {
  return true; // Siempre visible
}
```

### Regla 2: Filtro de quincena al pagar
```javascript
const currentQuincena = day >= 16 ? 'Q1' : 'Q2';
// Solo muestra adelantos de la quincena actual
```

### Regla 3: No duplicar recurrence_id
```javascript
// sync-recurrences verifica:
if (existe adelanto con recurrence_id) {
  skip(); // No crear
}
```

### Regla 4: Historial siempre preservado
- `advance_logs` NUNCA se elimina
- Incluso al eliminar adelanto, logs permanecen

---

## 🚀 12. FUNCIONES ADMINISTRATIVAS

### Limpiar Duplicados:
```javascript
curl http://localhost:3001/commissions/recover-recurring?action=cleanup-duplicates
```
- Mantiene el más reciente por `recurrence_id`
- Elimina todos los demás

### Listar Adelantos Recurrentes:
```javascript
curl http://localhost:3001/commissions/recover-recurring?action=list
```
- Muestra todos los adelantos recurrentes
- Indica si hay duplicados

---

## 📝 13. RECOMENDACIONES

### ✅ Hacer:
- Siempre incluir "Q1" o "Q2" en razón de adelantos recurrentes
- Verificar fechas de pago sean correctas
- Revisar historial antes de eliminar

### ❌ No Hacer:
- No crear adelantos recurrentes manualmente (usar modal)
- No modificar `recurrence_id` directamente
- No eliminar registros de `advance_logs`

---

## 🔄 14. FLUJO COMPLETO VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│                    CREAR ADELANTO                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Normal                          Recurrente                  │
│    │                                  │                       │
│    ├─> advances                      ├─> advance_recurrences│
│    │   - is_recurring: false         │   - amount           │
│    │   - recurrence_id: null         │   - reason           │
│    │                                  │   - frequency        │
│    │                                  │                       │
│    │                                  ├─> advances           │
│    │                                  │   - is_recurring: true│
│    │                                  │   - recurrence_id    │
│    │                                  │                       │
│    └─────────────┬───────────────────┴──────────┐           │
│                  │                                │           │
│            DEUDAS ACTIVAS                         │           │
│            (status: PENDING)                      │           │
│                  │                                │           │
└──────────────────┼────────────────────────────────┼───────────┘
                   │                                │
                   ▼                                ▼
         ┌──────────────────┐          ┌──────────────────┐
         │   PAGAR NORMAL   │          │ PAGAR RECURRENTE │
         └──────────────────┘          └──────────────────┘
                   │                                │
                   ├─> advance_logs                ├─> advance_logs
                   │   - amount                    │   - amount
                   │   - payment_type              │   - payment_type
                   │                                │
                   ├─> Actualizar                  ├─> Si pago completo:
                   │   - amount -= pago            │     RESETEAR
                   │   - status: PARTIAL/PAID      │     - amount = original
                   │                                │     - status = PENDING
                   │                                │
                   ▼                                ▼
         ┌──────────────────┐          ┌──────────────────┐
         │ Si PAID:         │          │ SIEMPRE en       │
         │ → DESCUENTOS     │          │ DEUDAS ACTIVAS   │
         │                   │          │                   │
         │ Si PARTIAL:      │          │ Historial         │
         │ → DEUDAS ACTIVAS │          │ accesible         │
         └──────────────────┘          └──────────────────┘
```

---

## 📞 CONTACTO Y SOPORTE

Si encuentras problemas:
1. Revisar logs en consola del navegador
2. Verificar estructura de datos en Supabase
3. Usar endpoints administrativos para diagnóstico
4. Consultar esta documentación

---

**Última actualización**: 20 de Noviembre, 2025
**Versión**: 2.0
