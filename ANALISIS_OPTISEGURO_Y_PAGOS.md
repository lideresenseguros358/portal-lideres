# 🔍 ANÁLISIS: OptiSeguro (Incendio/Contenido) y Sistema de Pagos IS

**Fecha:** Octubre 31, 2025  
**Estado:** 🔍 ANÁLISIS Y PLANIFICACIÓN

---

## ❓ INFORMACIÓN REQUERIDA

### 1. OptiSeguro (Incendio y Contenido)

**Preguntas:**

1. ¿Tienes la documentación de la API de OptiSeguro de INTERNACIONAL?
2. ¿Los endpoints son similares a los de Auto o son diferentes?
3. ¿OptiSeguro maneja:
   - Incendio?
   - Contenido?
   - Ambos en la misma API?

**Endpoints que necesitaríamos:**
```
¿/api/optiseguro/cotizar?
¿/api/optiseguro/emitir?
¿/api/optiseguro/catalogos?
```

---

### 2. Sistema de Pago con Tarjeta

**Preguntas:**

1. ¿INTERNACIONAL tiene su propia pasarela de pago?
2. ¿Cuál es el endpoint para procesar pagos?
3. ¿Qué datos requiere la API de pago?
4. ¿Retorna algún PDF de la póliza automáticamente?

**Endpoint posible:**
```
POST /api/payment/process
```

---

## 📊 ESTADO ACTUAL

### ✅ LO QUE TENEMOS:

**APIs de AUTO configuradas:**
```typescript
// En /lib/is/config.ts
IS_ENDPOINTS = {
  // Catálogos Auto
  MARCAS: '/api/cotizaemisorauto/getmarcas',
  MODELOS: '/api/cotizaemisorauto/getmodelos',
  
  // Cotización Auto
  GENERAR_COTIZACION: '/api/cotizaemisorauto/getgenerarcotizacion',
  COBERTURAS_COTIZACION: '/api/cotizaemisorauto/getcoberturascotizacion',
  
  // Emisión Auto
  EMISION: '/api/cotizaemisorauto/getemision',
  
  // Pago (placeholder)
  PAYMENT: '/api/payment/process', // ⚠️ A confirmar
}
```

**Componente de Captura de Tarjeta:**
```typescript
// /components/is/CreditCardInput.tsx
- ✅ Captura número, nombre, banco, expiración, CVV
- ✅ Validación de Luhn
- ✅ Detecta Visa/Mastercard
- ✅ Animación 3D flip
- ❌ NO está conectado a pasarela de pago
- ❌ Solo retorna un "token" simulado
```

---

## 🎯 LO QUE NECESITAMOS IMPLEMENTAR

### OPCIÓN A: Si INTERNACIONAL tiene APIs de OptiSeguro

**Endpoints necesarios:**

1. **Cotización Incendio/Contenido:**
```typescript
POST /api/optiseguro/cotizar
{
  tipo: 'incendio' | 'contenido',
  suma_asegurada: number,
  direccion_inmueble: string,
  tipo_construccion: string,
  // ... otros datos
}
```

2. **Emisión Incendio/Contenido:**
```typescript
POST /api/optiseguro/emitir
{
  id_cotizacion: string,
  datos_cliente: {...},
  datos_pago: {...},
}
```

3. **Procesamiento de Pago:**
```typescript
POST /api/payment/process
{
  token: string,           // Del CreditCardInput
  amount: number,
  currency: 'USD',
  policy_id: string,
  customer_data: {...}
}

Retorna:
{
  success: boolean,
  transaction_id: string,
  pdf_url?: string         // PDF de la póliza
}
```

---

### OPCIÓN B: Si NO tienen APIs separadas

**Alternativa:**
- Usar el mismo endpoint de AUTO pero con parámetros diferentes
- ¿El plan de cobertura determina el tipo de seguro?
- ¿Hay un plan específico para Incendio/Contenido?

---

## 🔧 COMPONENTES QUE NECESITAMOS MODIFICAR/CREAR

### Si tenemos las APIs de OptiSeguro:

**1. Crear servicios para Incendio/Contenido:**
```typescript
// /lib/is/optiseguro.service.ts
export async function cotizarIncendio(data: IncendioRequest)
export async function cotizarContenido(data: ContenidoRequest)
export async function emitirIncendio(data: EmisionIncendioRequest)
export async function emitirContenido(data: EmisionContenidoRequest)
```

**2. Crear endpoints API:**
```
/app/api/is/incendio/quote/route.ts
/app/api/is/incendio/emitir/route.ts
/app/api/is/contenido/quote/route.ts
/app/api/is/contenido/emitir/route.ts
```

**3. Modificar formularios:**
```
/components/cotizadores/FormIncendio.tsx
/components/cotizadores/FormContenido.tsx
```

**4. Integrar CreditCardInput:**
```typescript
// En el flujo de emisión
const handlePayment = async (cardData) => {
  // 1. Tokenizar tarjeta con pasarela de IS
  const token = await tokenizarTarjeta(cardData);
  
  // 2. Procesar pago
  const payment = await procesarPago(token, amount);
  
  // 3. Emitir póliza
  const poliza = await emitirPoliza(quoteId, paymentId);
  
  // 4. Descargar PDF
  if (poliza.pdf_url) {
    descargarPDF(poliza.pdf_url);
  }
}
```

---

## 💳 INTEGRACIÓN DE PAGOS

### Estado Actual del CreditCardInput:

**LO QUE HACE:**
```typescript
// Captura datos de la tarjeta
const cardData = {
  number: '4111111111111111',
  name: 'JOHN DOE',
  expiry: '12/25',
  cvv: '123',
  bank: 'Banco General'
}

// Simula validación
onTokenReceived('FAKE_TOKEN', '1111', 'visa');
```

**LO QUE NECESITA:**
```typescript
// Tokenizar con API real de IS
const tokenResponse = await fetch('/api/is/payment/tokenize', {
  method: 'POST',
  body: JSON.stringify(cardData)
});

const { token, last4, brand } = await tokenResponse.json();

// Usar token real para pago
onTokenReceived(token, last4, brand);
```

---

## 📄 GENERACIÓN DE PDFs

### Opciones:

**OPCIÓN 1: IS genera el PDF**
```typescript
const emisionResult = await emitirPoliza(...);
if (emisionResult.pdf_url) {
  // Descargar PDF generado por IS
  window.open(emisionResult.pdf_url);
}
```

**OPCIÓN 2: Nosotros generamos el PDF**
```typescript
import { jsPDF } from 'jspdf';

const generarPDFPoliza = (datosPoliza) => {
  const doc = new jsPDF();
  
  // Según el ramo
  if (ramo === 'AUTO') generarPDFAuto(doc, datosPoliza);
  if (ramo === 'INCENDIO') generarPDFIncendio(doc, datosPoliza);
  if (ramo === 'CONTENIDO') generarPDFContenido(doc, datosPoliza);
  
  doc.save(`poliza-${nroPoliza}.pdf`);
}
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### FASE 1: Investigación (ACTUAL) 🔍

- [ ] Obtener documentación de OptiSeguro
- [ ] Confirmar endpoints disponibles
- [ ] Verificar API de pagos de IS
- [ ] Confirmar si generan PDFs

### FASE 2: Implementación Incendio ⏳

Si tenemos las APIs:
- [ ] Crear servicios de Incendio
- [ ] Crear endpoints API
- [ ] Modificar FormIncendio para usar API real
- [ ] Integrar cotización automática
- [ ] Integrar emisión

### FASE 3: Implementación Contenido ⏳

Similar a Incendio

### FASE 4: Integración de Pagos ⏳

- [ ] Conectar CreditCardInput con API de IS
- [ ] Tokenización real
- [ ] Procesamiento de pagos
- [ ] Manejo de errores de pago

### FASE 5: Generación de PDFs ⏳

- [ ] Verificar si IS los genera
- [ ] Si no, implementar generación propia
- [ ] Templates por ramo

---

## ❓ PREGUNTAS PARA EL USUARIO

1. **¿Tienes la documentación de la API de OptiSeguro de INTERNACIONAL?**
   - Necesitamos endpoints, parámetros, ejemplos

2. **¿INTERNACIONAL procesa pagos con tarjeta directamente?**
   - ¿Tienen pasarela propia?
   - ¿Usan terceros (Visa/Mastercard)?
   - ¿Qué datos requieren?

3. **¿La API de INTERNACIONAL retorna PDFs de las pólizas?**
   - ¿URL de descarga?
   - ¿Base64?
   - ¿Nosotros generamos?

4. **¿OptiSeguro es el nombre de la API o del producto?**
   - ¿Los endpoints son `/api/optiseguro/...`?
   - ¿O siguen siendo `/api/cotizaemiso[ramo]/...`?

---

## 🚀 SIGUIENTE PASO

**Por favor proporciona:**

1. Documentación de OptiSeguro (capturas de pantalla o PDF)
2. Documentación de la API de pagos de IS
3. Ejemplo de respuesta de emisión (para ver si incluye PDF)

Con esa información puedo proceder a implementar todo el flujo completo.

---

## 💡 NOTA

Si NO tienes la documentación de OptiSeguro, podemos:

1. **Mantener el flujo actual** (crear casos en BD para seguimiento manual)
2. **Usar solo el componente de tarjeta** como captura de datos
3. **Esperar la documentación** para integración completa

**Estado:** 🔍 ESPERANDO DOCUMENTACIÓN DE OPTISEGURO Y APIS DE PAGO
