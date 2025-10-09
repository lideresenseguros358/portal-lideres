# 📄 Mejoras al PDF de Pagos Pendientes

## 🎯 Objetivo
Mejorar el PDF de pagos pendientes para incluir información bancaria detallada y notas, facilitando el proceso de pago.

---

## ✅ Mejoras Implementadas

### 1. **Nueva Estructura de Columnas**

#### Columnas Anteriores:
| Cliente | Póliza | Aseguradora | Propósito | Referencias | Monto |
|---------|--------|-------------|-----------|-------------|-------|

#### Columnas Nuevas:
| Cliente/Corredor | Tipo | Póliza/Aseg. | Referencias | **Cuenta Bancaria** | **Notas** | Monto |
|------------------|------|--------------|-------------|---------------------|-----------|-------|

---

### 2. **Información Bancaria Detallada**

#### Para **Devoluciones a Clientes:**
```
💳 DEVOLUCIÓN A CLIENTE
Cuenta: 1234567890
Titular: NOMBRE DEL CLIENTE
```

#### Para **Devoluciones a Corredores:**
```
🏦 DEVOLUCIÓN A CORREDOR
Corredor: Nombre del Corredor
Cuenta: 0987654321
Banco: Banco General
Tipo: Cuenta de Ahorros
```

#### Para **Pólizas u Otros:**
```
— (No aplica)
```

---

### 3. **Sistema de Metadata en Notes**

Los datos bancarios se guardan en el campo `notes` como JSON:

```typescript
{
  notes: "Texto de notas del usuario",
  devolucion_tipo: "cliente" | "corredor",
  cuenta_banco: "1234567890",          // Si es cliente
  broker_id: "uuid-del-corredor",      // Si es corredor
  broker_cuenta: "0987654321",         // Guardado para referencia
  source: "advance_external",          // Si viene de adelanto
  advance_id: "uuid-del-adelanto"      // Si viene de adelanto
}
```

---

### 4. **Carga Automática de Datos de Corredores**

Cuando se genera el PDF:
1. Se extraen todos los `broker_id` de los pagos seleccionados
2. Se consulta la tabla `brokers` para obtener:
   - Nombre del corredor
   - Número de cuenta (`bank_account_no` o `numero_cuenta`)
   - Nombre del banco (`bank_name`)
   - Tipo de cuenta (`account_type`)
3. Se muestra la información completa en el PDF

---

### 5. **Estilos y Formato Mejorados**

#### Optimizaciones:
- ✅ Fuente más pequeña (11px body, 9-10px en tabla) para más espacio
- ✅ `page-break-inside: avoid` en filas para evitar cortes
- ✅ Información bancaria con etiquetas coloridas
- ✅ Notas en cursiva y gris para diferenciar
- ✅ Referencias en fuente monospace para legibilidad
- ✅ Emojis para identificación visual rápida

#### Códigos de Color:
| Elemento | Color | Uso |
|----------|-------|-----|
| Headers | `#010139` (Azul oscuro) | Encabezados principales |
| Labels | `#8AAA19` (Oliva) | Etiquetas de sección |
| Montos | `#8AAA19` (Oliva) | Cantidades a pagar |
| Notas | `#666` (Gris) | Texto secundario |
| Alertas | `#e74c3c` (Rojo), `#f39c12` (Naranja) | Advertencias |

---

### 6. **Estados y Advertencias**

El PDF muestra diferentes estados según la información disponible:

#### ✅ **Datos Completos:**
```html
<div class="label">🏦 DEVOLUCIÓN A CORREDOR</div>
<div>
  Corredor: Juan Pérez
  Cuenta: 1234567890
  Banco: Banco General
  Tipo: Ahorro
</div>
```

#### ⚠️ **Datos Incompletos:**
```html
<div class="label">💰 DEVOLUCIÓN</div>
<div style="color: #f39c12;">
  ⚠️ Datos bancarios pendientes
</div>
```

#### ❌ **Error de Datos:**
```html
<div class="label">🏦 DEVOLUCIÓN A CORREDOR</div>
<div style="color: #e74c3c;">
  ⚠️ Datos del corredor no disponibles
</div>
```

---

## 🔧 Cambios Técnicos

### **1. Server Action: `actionCreatePendingPayment`**

**Archivo:** `src/app/(app)/checks/actions.ts`

**Cambios:**
- Agregados parámetros opcionales:
  - `devolucion_tipo?: 'cliente' | 'corredor'`
  - `cuenta_banco?: string`
  - `broker_id?: string`
  - `broker_cuenta?: string`

- Toda la información se guarda como JSON en el campo `notes`:

```typescript
const metadata: any = {
  notes: payment.notes || null,
};

if (payment.advance_id) {
  metadata.source = 'advance_external';
  metadata.advance_id = payment.advance_id;
}

if (payment.devolucion_tipo) {
  metadata.devolucion_tipo = payment.devolucion_tipo;
  if (payment.devolucion_tipo === 'cliente' && payment.cuenta_banco) {
    metadata.cuenta_banco = payment.cuenta_banco;
  } else if (payment.devolucion_tipo === 'corredor') {
    metadata.broker_id = payment.broker_id || null;
    metadata.broker_cuenta = payment.broker_cuenta || null;
  }
}

// Guardar como JSON
notes: JSON.stringify(metadata)
```

### **2. Componente: `PendingPaymentsTab`**

**Archivo:** `src/components/checks/PendingPaymentsTab.tsx`

**Cambios:**

1. **Import de Supabase Client:**
   ```typescript
   import { supabaseClient } from '@/lib/supabase/client';
   ```

2. **Función `handleDownloadPDF` ahora es async:**
   ```typescript
   const handleDownloadPDF = async () => {
     // Cargar datos de corredores
     const brokersData = await supabaseClient()
       .from('brokers')
       .select('id, name, bank_account_no, numero_cuenta, bank_name, account_type')
       .in('id', Array.from(brokerIds));
     
     // Generar PDF con datos completos
   }
   ```

3. **Helpers para extraer metadata:**
   ```typescript
   const getPaymentMetadata = (payment: any) => {
     try {
       if (typeof payment.notes === 'string') {
         return JSON.parse(payment.notes);
       }
       return {};
     } catch {
       return {};
     }
   };
   
   const getPaymentNotes = (payment: any) => {
     const metadata = getPaymentMetadata(payment);
     return metadata.notes || '';
   };
   ```

4. **Construcción dinámica de información bancaria:**
   - Detecta tipo de devolución
   - Busca datos en `brokersMap` si es corredor
   - Muestra cuenta bancaria si es cliente
   - Maneja estados de error y datos faltantes

### **3. Wizard: `RegisterPaymentWizard`**

**Archivo:** `src/components/checks/RegisterPaymentWizard.tsx`

**Sin cambios necesarios:** Ya envía todos los campos de `formData` al servidor, incluyendo:
- `devolucion_tipo`
- `cuenta_banco`
- `broker_id`
- `broker_cuenta`

---

## 📊 Ejemplo de Uso

### **Crear Pago con Devolución a Cliente:**
1. Usuario llena formulario:
   - Cliente: "MARIA GONZALEZ"
   - Tipo: "Devolución"
   - Devolución a: "Cliente"
   - Cuenta banco: "1234567890"
   - Notas: "Cancelación de póliza"
   
2. Se guarda en DB:
   ```json
   {
     "notes": "Cancelación de póliza",
     "devolucion_tipo": "cliente",
     "cuenta_banco": "1234567890"
   }
   ```

3. PDF muestra:
   ```
   💳 DEVOLUCIÓN A CLIENTE
   Cuenta: 1234567890
   Titular: MARIA GONZALEZ
   
   Notas: Cancelación de póliza
   ```

### **Crear Pago con Devolución a Corredor:**
1. Usuario llena formulario:
   - Cliente: "JUAN PEREZ" (nombre del corredor)
   - Tipo: "Devolución"
   - Devolución a: "Corredor"
   - Corredor: [Selecciona de dropdown]
   - Notas: "Comisión devuelta por error"
   
2. Se guarda en DB:
   ```json
   {
     "notes": "Comisión devuelta por error",
     "devolucion_tipo": "corredor",
     "broker_id": "uuid-123",
     "broker_cuenta": "0987654321"
   }
   ```

3. PDF consulta DB y muestra:
   ```
   🏦 DEVOLUCIÓN A CORREDOR
   Corredor: Juan Pérez
   Cuenta: 0987654321
   Banco: Banco General
   Tipo: Cuenta de Ahorros
   
   Notas: Comisión devuelta por error
   ```

---

## ✅ Verificación

- ✅ `npm run typecheck` - Sin errores de tipos
- ✅ Datos bancarios se guardan correctamente en metadata
- ✅ PDF se genera con información completa
- ✅ Carga automática de datos de corredores
- ✅ Estilos optimizados para impresión
- ✅ Compatibilidad con pagos existentes (retrocompatible)

---

## 🎯 Beneficios

1. **📋 Información Completa:** Toda la info necesaria para procesar pagos en un solo documento
2. **🏦 Datos Bancarios:** Cuentas, bancos y tipos de cuenta claramente identificados
3. **📝 Notas Visibles:** Contexto adicional siempre disponible
4. **🎨 Formato Profesional:** PDF listo para usar en procesos bancarios
5. **⚡ Automatización:** Carga automática de datos de corredores desde la BD
6. **✅ Trazabilidad:** Metadata completa guardada en cada pago

---

**Última actualización:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros
