# ESTADO IMPLEMENTACIÓN COMPLETA FEDPA + IS

## ✅ COMPLETADO (Pusheado)

### IS P1 - PRIORIDAD 1
- [x] Base URLs correctas: APIRestIsTester (DEV), APIRestIs (PROD)
- [x] Env vars: IS_BASE_URL_DEV, IS_BASE_URL_PROD, KEY_DESARROLLO_IS, KEY_PRODUCCION_IS
- [x] Token manager: detectar `_event_transid` = BLOQUEO → abortar flujo
- [x] joinUrl helper: prevenir `/api/api` duplicado
- [x] NO retry 404: error permanente, retornar inmediatamente
- [x] Logging diagnóstico completo

### FEDPA P2 - Token + Beneficios + Deducibles
- [x] Token robusto: "Ya existe token registrado" = válido, usar cache
- [x] Beneficios normalizer: grúa, cerrajero, gasolina, paso corriente con qty/maxAmount
- [x] formatAsistencia helper: "Grúa: 2 servicios/año • Máximo B/.150"
- [x] normalizeDeductibles: NUNCA $0, retorna null si no hay valor
- [x] 3 fuentes deducibles: beneficios → coberturas → mapeo usuario

---

## 🔄 EN PROGRESO (Implementando AHORA sin parar)

### FEDPA P2 - Completar Normalización
- [ ] calcularDescuentoBuenConductor: ya existe función, falta integrar
- [ ] Premium vs Básico: 2 requests separados (Porcelana vs Full Extras)
- [ ] Mapeo tipo planes: "COBERTURA COMPLETA" → valor API correcto

### UI/UX - Comparativa + Cuotas
- [ ] Cuotas default: mostrar "Al contado (1 cuota)" primero
- [ ] Cambio cuotas: switch a "Tarjeta (2-10 cuotas)" con monto anual
- [ ] Precio breakdown: Prima base - Descuento + Impuesto = Total
- [ ] Badge "Recomendada": fix glow sin recorte cuadrado
- [ ] Eliminar outlines verdes: usar sombra + check
- [ ] Tooltips unificados: mismo componente en todas partes
- [ ] Modal "Mejora Cobertura": branding + Premium LEFT + flotante
- [ ] Deducibles en UI: comprensivo/colisión (NO $0)
- [ ] Beneficios en UI: lista con cantidades y montos

### UI/UX - Wizard Emisión
- [ ] Dividir pasos: Cliente (solo cliente) + Vehículo (solo vehículo)
- [ ] VIN/Chasis: unificar en 1 input
- [ ] Inspección: hotspots + orden guiado + autogenerar informe
- [ ] Progreso: barra runner → bandera + breadcrumb
- [ ] Input valor vehículo: fix responsive mobile

### Integración
- [ ] Integrar normalizadores en /cotizadores/comparar
- [ ] Mostrar asistencias formateadas en cards
- [ ] Mostrar deducibles reales (no $0)
- [ ] Mostrar descuento calculado en desglose
- [ ] Botón "Editar Información": fix 404

---

## 📋 QA FINAL (Antes de entregar)

### Criterios Aceptación IS
- [ ] `/api/is/auto/quote` retorna 200 (no 500)
- [ ] NO aparece `_event_transid` como token
- [ ] Nunca construir `/api/api`
- [ ] 404 = error claro, no reintentar

### Criterios Aceptación FEDPA
- [ ] `/api/fedpa/planes` retorna 200 (no 400)
- [ ] `/api/fedpa/planes/beneficios` retorna 200 (no 400)
- [ ] Logs NO dicen "Token no encontrado"
- [ ] Premium ≠ Básico: endosos diferentes
- [ ] Beneficios visibles con cantidades y montos
- [ ] Deducibles correctos (no $0)
- [ ] Descuento calculado visible

### Criterios Aceptación UI
- [ ] Comparativa: Premium primero (recomendada)
- [ ] Cuotas: abre arriba, default contado
- [ ] Wizard: dividido por pasos claros
- [ ] Badge sin recorte cuadrado
- [ ] Sin outlines verdes
- [ ] Scroll-to-top funciona

---

## 🎯 SIGUIENTE ACCIÓN

Continuar implementación sistemática de puntos pendientes:
1. Integrar normalizadores en página comparar
2. UI cuotas + desglose
3. Wizard división pasos
4. Testing QA completo

**NO PARAR hasta completar TODO.**
