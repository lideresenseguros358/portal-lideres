# IMPLEMENTACIÓN FEDPA + IS - PARTE 1

## ✅ COMPLETADO (Commit d293da4)

### A1: FEDPA Auth - Logging Diagnóstico Mejorado
**Archivos:** `src/lib/fedpa/auth.service.ts`, `src/lib/fedpa/types.ts`

**Cambios:**
- Log completo con `statusCode`, `dataType`, `dataSample` (primeros 200 chars)
- Parseo robusto: `token` | `Token` | `access_token` | `AccessToken` | `jwt` | `data.token` | `data.Token`
- Error detallado: muestra keys disponibles, sample de 200 chars, mensaje de API si existe
- TypeScript: `TokenResponse` actualizado con todos los campos posibles
- `ApiResponse` ahora incluye `statusCode`

**Resultado esperado:**
Los logs ahora muestran exactamente por qué no se encuentra el token, permitiendo diagnosticar si:
- La API responde con keys diferentes
- Hay error de credenciales
- El endpoint es incorrecto

### B2-B3: IS Token - Detectar Bloqueo WAF
**Archivos:** `src/lib/is/token-manager.ts`

**Cambios:**
- Detecta respuesta `{ "_event_transid": ... }` sin token = bloqueo/WAF/endpoint incorrecto
- Log sample de body (primeros 200 chars) para diagnóstico
- Error explícito: "IS Token endpoint bloqueado o incorrecto - solo devuelve _event_transid"
- Logging detallado: keys disponibles, data completo (300 chars), content-type, status
- Muestra mensaje de API si existe (message/error/msg)

**Resultado esperado:**
Si IS devuelve solo `_event_transid`, se identifica inmediatamente como bloqueo y se aborta con error claro.

### B4: IS NO Retry en 404
**Archivos:** `src/lib/is/http-client.ts`

**Cambios:**
- 404 detectado como error PERMANENTE (endpoint incorrecto)
- NO reintentar 404 (antes reintentaba 4 veces inútilmente)
- Retorna inmediatamente con error claro: "Endpoint no encontrado (404): {endpoint}"
- Log: "ERROR 404 - endpoint no existe o path incorrecto - NO REINTENTAR"

**Resultado esperado:**
Cotización IS no hace 4 reintentos de 404, falla rápido con mensaje claro.

### A7: Scroll-to-Top
**Archivos:** `src/app/cotizadores/comparar/page.tsx`, `src/app/cotizadores/emitir/page.tsx`

**Cambios:**
- **Comparar:** Scroll inmediato al cargar (fuera de componente React)
- **Emitir:** `useEffect` con `scrollTo({ top: 0, behavior: 'instant' })` al montar

**Resultado esperado:**
Páginas comparar y emitir siempre empiezan arriba del todo, no en medio de scroll.

---

## 🔄 PENDIENTE (Siguientes commits)

### A2: FEDPA Mapeo Tipo Planes
- [ ] Normalizar "COBERTURA COMPLETA" del form → valor exacto que espera API FEDPA
- [ ] Según doc: planes tienen `tipoplan` = "DANOS A TERCEROS" | "COBERTURA COMPLETA"
- [ ] Logging: "FEDPA Planes request: tipoUI=... tipoAPI=..."

### A3: FEDPA Beneficios - Asistencias con Cantidades
- [ ] Normalizar grúa: extraer qty (eventos/año) + maxAmount (B/.) + maxKm
- [ ] Normalizar paso corriente, gasolina, cerrajero, llanta
- [ ] Parser regex para "3 eventos", "B/. 150", "hasta 50 km"
- [ ] UI: mostrar "Grúa: 3 servicios/año • Máximo B/.150"
- [ ] Tooltip con texto raw completo si no se puede parsear

### A4: FEDPA Deducibles Reales
- [ ] Extraer deducible comprensivo y colisión/vuelco de beneficios/coberturas
- [ ] NUNCA mostrar $0.00
- [ ] Header card: "Deducible Comprensivo B/.X · Colisión/Vuelco B/.Y"
- [ ] Si no disponible: "No disponible (se confirma al emitir)" + tooltip

### A5: FEDPA Descuento Buen Conductor
- [ ] Calcular: `descuento = max(0, primaBase - (totalTarjeta - impuesto))`
- [ ] Mostrar en desglose:
  ```
  Prima Base (sin impuestos)     B/. X
  (-) Descuento Buen Conductor   B/. Y
  = Subtotal                     B/. Z
  + Impuesto (5%)                B/. W
  = Total anual                  B/. T
  ```
- [ ] Si falta campo: ocultar fila + nota "descuento no disponible"

### A6: Cuotas - Default Al Contado
- [ ] Default: `cuotas = 1`, monto principal = `montoContado`
- [ ] Si cuotas === 1: mostrar "Pago al contado (1 cuota)"
- [ ] Si cuotas > 1: mostrar "Pago con tarjeta (X cuotas)" + anual
- [ ] Siempre: "Monto por cuota: B/.X.XX"
- [ ] Cambio de cuotas actualiza monto principal dinámicamente

### A8: UI Fixes
- [ ] Badge "RECOMENDADA": fix glow cortado (quitar overflow-hidden o usar pseudo-element)
- [ ] Eliminar bordes verdes permanentes/selección
- [ ] Sustituto: sombra suave + check + cambio background sutil
- [ ] Tooltip "Pago con tarjeta": MISMO componente que otros tooltips
- [ ] Modal "Mejora Cobertura": colores branding, scrollbar themed
- [ ] Premium LEFT/TOP: efecto flotante (translateY + glow + shimmer)
- [ ] Beneficios Premium: chips animados + iconos + diferencias reales

### A9: Wizard - Dividir Cliente vs Vehículo
- [ ] Paso Cliente: solo datos cliente + adjuntos cédula/licencia
- [ ] Pre-llenar: nombre, fecha nacimiento, estado civil si existen
- [ ] Paso Vehículo: datos vehículo + registro vehicular
- [ ] VIN/Chasis: UNIFICAR en 1 input "VIN / Chasis"
- [ ] Paso siguiente: Inspección (estilo ASSA)

### A10: Input Valor Vehículo - Fix Mobile
- [ ] Revisar CSS: width/min-width/min-height
- [ ] Mobile: full width, no colapsar
- [ ] Font-size iOS-friendly (≥16px)
- [ ] Touch target ≥44px

### C: Rediseño Comparativa Mobile
- [ ] Jerarquía clara: título + precio principal + botón
- [ ] Luego: contado/tarjeta, deducibles reales, coberturas
- [ ] Sección asistencias con qty + maxAmount
- [ ] Desglose expandible "Cómo se calcula"
- [ ] Spacing mayor, tipografía ajustada, no 2 columnas

---

## 📋 CHECKLIST QA FINAL

### FEDPA
- [ ] `/api/fedpa/planes` retorna 200
- [ ] `/api/fedpa/planes/beneficios` retorna 200
- [ ] Asistencias muestran qty + maxAmount (o tooltip raw)
- [ ] Deducibles NO son 0.00
- [ ] Descuento buen conductor aparece en desglose
- [ ] Badge recomendado NO se recorta
- [ ] NO hay outline verde
- [ ] Modal tiene branding + scrollbar theme + premium flotante izquierda
- [ ] Scroll-to-top funciona

### IS
- [ ] Token NO devuelve solo `_event_transid`
- [ ] Cotización NO devuelve 404
- [ ] Si 404, NO reintenta y muestra error claro
- [ ] Si falla token, NO intenta cotizar

### UI General
- [ ] Cuotas default = al contado
- [ ] Wizard dividido Cliente/Vehículo
- [ ] Input valor vehículo funciona en mobile
- [ ] Comparativa mobile clara y jerarquizada
