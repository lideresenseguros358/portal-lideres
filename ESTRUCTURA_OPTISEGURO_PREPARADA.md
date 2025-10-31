# ✅ ESTRUCTURA OPTISEGURO Y PAGOS - LISTA PARA CONECTAR

**Fecha:** Octubre 31, 2025  
**Estado:** ✅ ESTRUCTURA COMPLETA - ESPERANDO APIs

---

## 🎯 LO QUE SE PREPARÓ

He creado toda la estructura necesaria para conectar las APIs de OptiSeguro (Incendio/Contenido) y el sistema de pagos de INTERNACIONAL cuando las recibas.

**TODO está listo para "enchufar" las APIs reales.**

---

## 📁 ARCHIVOS CREADOS

### 1. Servicios Base

**✅ `/src/lib/is/optiseguro.service.ts`**
- `cotizarIncendio()` - Cotización de Incendio
- `cotizarContenido()` - Cotización de Contenido
- `emitirIncendio()` - Emisión de Incendio
- `emitirContenido()` - Emisión de Contenido
- `crearClienteYPolizaOptiSeguro()` - Guardar en BD

**✅ `/src/lib/is/payment.service.ts`**
- `tokenizarTarjeta()` - Tokenizar tarjeta de crédito
- `procesarPago()` - Procesar pago con token
- `verificarPago()` - Verificar estado de pago
- `procesarPagoCompleto()` - Helper completo

---

### 2. Endpoints API

**✅ Incendio:**
- `POST /api/is/incendio/quote` - Cotizar
- `POST /api/is/incendio/emitir` - Emitir

**✅ Contenido:**
- `POST /api/is/contenido/quote` - Cotizar
- `POST /api/is/contenido/emitir` - Emitir

**✅ Pagos:**
- `POST /api/is/payment/process` - Procesar pago

---

## 🔌 CÓMO CONECTAR LAS APIs REALES

### PASO 1: Obtener Documentación

**Solicita a INTERNACIONAL:**
1. Documentación de OptiSeguro (Incendio/Contenido)
2. Documentación de API de pagos
3. Endpoints disponibles
4. Ejemplos de request/response
5. Códigos de error

---

### PASO 2: Actualizar Endpoints

**Archivo:** `/src/lib/is/optiseguro.service.ts`

**Busca:**
```typescript
const OPTISEGURO_ENDPOINTS = {
  COTIZAR_INCENDIO: '/api/optiseguro/incendio/cotizar', // Placeholder
  EMITIR_INCENDIO: '/api/optiseguro/incendio/emitir',   // Placeholder
  // ...
}
```

**Reemplaza con los endpoints reales:**
```typescript
const OPTISEGURO_ENDPOINTS = {
  COTIZAR_INCENDIO: '/api/cotizaopti/incendio/generar', // Real de IS
  EMITIR_INCENDIO: '/api/cotizaopti/incendio/emitir',   // Real de IS
  // ...
}
```

---

### PASO 3: Descomentar Código Real

**En cada función, busca:**
```typescript
// TODO: Descomentar cuando se tenga el endpoint real
/*
const response = await isPost<OptiSeguroResponse>(
  OPTISEGURO_ENDPOINTS.COTIZAR_INCENDIO,
  request,
  env
);
*/

// SIMULACIÓN TEMPORAL
console.warn('[IS OptiSeguro] ⚠️ USANDO DATOS SIMULADOS');
return { success: true, idCotizacion: `SIM-${Date.now()}` };
```

**Reemplaza con:**
```typescript
// Llamada REAL a la API
const response = await isPost<OptiSeguroResponse>(
  OPTISEGURO_ENDPOINTS.COTIZAR_INCENDIO,
  request,
  env
);

if (!response.success) {
  return { success: false, error: response.error };
}

return {
  success: true,
  idCotizacion: response.data?.idCotizacion,
  primaTotal: response.data?.primaTotal,
};
```

---

### PASO 4: Adaptar Interfaces

**Archivo:** `/src/lib/is/optiseguro.service.ts`

**Actualiza las interfaces según la documentación real:**

```typescript
export interface CotizacionIncendioRequest {
  // Adaptar campos según API real
  vcodtipodoc: number;
  vnrodoc: string;
  // ... agregar/quitar campos según necesites
}
```

**Campos que probablemente necesites:**
- Cliente: nombre, apellido, documento, teléfono, email
- Inmueble: dirección, tipo_construcción, año_construcción
- Cobertura: suma_asegurada, plan, deducible
- Seguridad: tiene_alarma, tiene_extintores, etc.

---

### PASO 5: Actualizar Sistema de Pagos

**Archivo:** `/src/lib/is/payment.service.ts`

**Busca:**
```typescript
const PAYMENT_ENDPOINTS = {
  TOKENIZE: '/api/payment/tokenize', // Placeholder
  PROCESS: '/api/payment/process',   // Placeholder
}
```

**Reemplaza con endpoints reales de IS:**
```typescript
const PAYMENT_ENDPOINTS = {
  TOKENIZE: '/api/pagos/tokenizar',  // Real de IS
  PROCESS: '/api/pagos/procesar',    // Real de IS
}
```

**Descomentar código:**
```typescript
// En tokenizarTarjeta() y procesarPago()
// Buscar y descomentar bloques marcados con TODO
```

---

## 🔧 INTEGRACIÓN CON FORMULARIOS

### Incendio

**Archivo a modificar:** `/src/components/cotizadores/FormIncendio.tsx`

**Agregar llamada a API:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Llamar API de cotización
  const quoteResponse = await fetch('/api/is/incendio/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vcodtipodoc: 1,
      vnrodoc: formData.cedula,
      vnombre: formData.nombreCompleto.split(' ')[0],
      vapellido: formData.nombreCompleto.split(' ').slice(1).join(' '),
      vtelefono: formData.telefono,
      vcorreo: formData.email,
      direccion: formData.direccion,
      suma_asegurada: formData.sumaAsegurada,
      tipo_construccion: formData.tipoConstruccion,
      anio_construccion: formData.anioConstruccion,
      tiene_alarma: formData.tieneAlarma,
      tiene_extintores: formData.tieneExtintores,
      environment: 'development',
    }),
  });
  
  const result = await quoteResponse.json();
  
  if (result.success) {
    // Guardar para emisión
    sessionStorage.setItem('incendioQuote', JSON.stringify({
      idCotizacion: result.idCotizacion,
      primaTotal: result.primaTotal,
      formData,
    }));
    
    // Ir a página de comparación o emisión
    router.push('/cotizadores/comparar');
  }
};
```

---

### Contenido

**Similar a Incendio, usar:** `/api/is/contenido/quote`

---

### Pago con Tarjeta

**Ya tienes el componente:** `/src/components/is/CreditCardInput.tsx`

**Integrarlo en el flujo de emisión:**

```typescript
import CreditCardInput from '@/components/is/CreditCardInput';

const [paymentToken, setPaymentToken] = useState('');
const [last4, setLast4] = useState('');

const handlePaymentSuccess = (token: string, last4: string, brand: string) => {
  setPaymentToken(token);
  setLast4(last4);
  toast.success(`Tarjeta ${brand} terminada en ${last4} validada`);
};

// En el JSX:
<CreditCardInput
  onTokenReceived={handlePaymentSuccess}
  onError={(error) => toast.error(error)}
  environment="development"
/>

// Al emitir:
const emisionResponse = await fetch('/api/is/incendio/emitir', {
  method: 'POST',
  body: JSON.stringify({
    vIdPv: quoteData.idCotizacion,
    paymentToken: paymentToken, // ← Token de la tarjeta
    // ... otros datos
  }),
});
```

---

## 📄 GENERACIÓN DE PDFs

### OPCIÓN 1: IS genera el PDF

**Si la API retorna PDF:**
```typescript
const emisionResult = await fetch('/api/is/incendio/emitir');
const data = await emisionResult.json();

if (data.pdfUrl) {
  // Abrir PDF en nueva pestaña
  window.open(data.pdfUrl, '_blank');
}

// O si viene en base64:
if (data.pdfBase64) {
  const blob = base64ToBlob(data.pdfBase64, 'application/pdf');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
```

---

### OPCIÓN 2: Generar PDF nosotros

**Crear:** `/src/lib/pdf-generator.ts`

```typescript
import { jsPDF } from 'jspdf';

export function generarPDFIncendio(datosPoliza: any) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('PÓLIZA DE INCENDIO', 105, 20, { align: 'center' });
  
  // Datos
  doc.setFontSize(12);
  doc.text(`Nº Póliza: ${datosPoliza.nroPoliza}`, 20, 40);
  doc.text(`Cliente: ${datosPoliza.cliente}`, 20, 50);
  doc.text(`Dirección: ${datosPoliza.direccion}`, 20, 60);
  doc.text(`Prima Anual: $${datosPoliza.prima}`, 20, 70);
  
  // Descargar
  doc.save(`poliza-${datosPoliza.nroPoliza}.pdf`);
}

// Similar para Contenido
export function generarPDFContenido(datosPoliza: any) {
  // ...
}
```

**Usar en emisión:**
```typescript
if (emisionResult.success) {
  generarPDFIncendio({
    nroPoliza: emisionResult.nroPoliza,
    cliente: formData.nombreCompleto,
    direccion: formData.direccion,
    prima: quoteData.primaTotal,
  });
}
```

---

## ✅ CHECKLIST DE CONEXIÓN

Cuando recibas las APIs, sigue este orden:

### Para OptiSeguro:

- [ ] 1. Obtener documentación completa
- [ ] 2. Actualizar `OPTISEGURO_ENDPOINTS` en `optiseguro.service.ts`
- [ ] 3. Adaptar interfaces según campos reales
- [ ] 4. Descomentar código de llamadas API
- [ ] 5. Comentar/eliminar simulaciones
- [ ] 6. Probar cotización de Incendio
- [ ] 7. Probar emisión de Incendio
- [ ] 8. Probar cotización de Contenido
- [ ] 9. Probar emisión de Contenido
- [ ] 10. Verificar creación en BD

### Para Pagos:

- [ ] 1. Obtener documentación de pagos
- [ ] 2. Actualizar `PAYMENT_ENDPOINTS` en `payment.service.ts`
- [ ] 3. Descomentar código de `tokenizarTarjeta()`
- [ ] 4. Descomentar código de `procesarPago()`
- [ ] 5. Integrar con `CreditCardInput`
- [ ] 6. Probar tokenización
- [ ] 7. Probar pago completo
- [ ] 8. Manejo de errores de pago

### Para PDFs:

- [ ] 1. Verificar si IS retorna PDFs
- [ ] 2. Si SÍ: implementar descarga
- [ ] 3. Si NO: implementar generación con jsPDF
- [ ] 4. Probar descarga de PDFs

---

## 🚀 EJEMPLO COMPLETO DE USO

### Cuando conectes las APIs, el flujo será:

```typescript
// 1. Usuario cotiza Incendio
const quoteResult = await cotizarIncendio({...});
// → Retorna: { idCotizacion: 'INC-12345', primaTotal: 450 }

// 2. Usuario completa datos y paga
const cardData = await CreditCardInput.getData();
const paymentResult = await procesarPagoCompleto({
  cardData,
  amount: 450,
  policyNumber: 'temp',
});
// → Retorna: { transactionId: 'txn-xyz', token: 'tok-abc' }

// 3. Emitir póliza
const emisionResult = await emitirIncendio({
  vIdPv: 'INC-12345',
  paymentToken: 'tok-abc',
  ...datosCliente
});
// → Retorna: { nroPoliza: 'POL-INC-2025-001', pdfUrl: '...' }

// 4. Descargar PDF
window.open(emisionResult.pdfUrl);

// 5. Cliente y póliza guardados en BD automáticamente
```

---

## 📊 ESTADO ACTUAL

```
✅ Estructura completa creada
✅ Servicios preparados con placeholders
✅ Endpoints API listos
✅ Integración con BD lista
✅ Sistema de pagos preparado
✅ Componente de tarjeta existente
⏳ ESPERANDO: APIs reales de INTERNACIONAL
⏳ ESPERANDO: Documentación de OptiSeguro
⏳ ESPERANDO: Documentación de pagos
```

---

## 📝 NOTAS IMPORTANTES

1. **Todo el código tiene placeholders claramente marcados con:**
   ```typescript
   // TODO: Descomentar cuando se tenga el endpoint real
   // ⚠️ PLACEHOLDER - Conectar cuando se obtengan las APIs reales
   ```

2. **Las simulaciones están activas para que puedas probar el flujo:**
   - Cotizaciones retornan IDs simulados
   - Emisiones retornan números de póliza simulados
   - Pagos aprueban el 90% de las veces

3. **Cuando conectes las APIs:**
   - Descomentar bloques de código real
   - Comentar/eliminar simulaciones
   - Adaptar interfaces si es necesario
   - Probar con ambiente de desarrollo primero

4. **El componente `CreditCardInput` ya existe y funciona:**
   - Solo falta conectarlo a la pasarela real de IS
   - Actualmente retorna tokens simulados

---

## 🎊 RESUMEN

**ESTÁ TODO LISTO PARA CUANDO TENGAS LAS APIs.**

Solo necesitas:
1. Documentación de OptiSeguro
2. Documentación de pagos
3. Actualizar endpoints
4. Descomentar código
5. Adaptar interfaces
6. ¡Probar!

**Tiempo estimado de conexión:** 2-3 horas una vez tengas las APIs.

**Estado:** ✅ ESTRUCTURA 100% PREPARADA
