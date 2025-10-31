# 🔍 ANÁLISIS: EMISIÓN COBERTURA COMPLETA vs DAÑOS A TERCEROS

**Fecha:** Octubre 31, 2025  
**Estado:** 🚧 ANÁLISIS Y PLAN DE INTEGRACIÓN

---

## 📊 ESTADO ACTUAL

### ✅ COBERTURA COMPLETA - CONECTADO A API
**Ruta:** `/cotizadores/auto/completa` → `/comparar` → `/emitir`

**Flujo:**
```
1. FormAutoCoberturaCompleta 
   ↓ Usa catálogos dinámicos (marcas/modelos de API)
2. POST /api/is/auto/quote (genera cotización)
   ↓ Retorna IDCOT
3. GET /api/is/auto/coberturas (obtiene coberturas reales)
   ↓
4. Usuario completa emisión
   ↓
5. POST /api/is/auto/emitir (emite póliza REAL)
   ↓ Crea cliente + póliza en BD
6. Confirmación con nro_poliza
```

**Estado:** ✅ FUNCIONAL Y CONECTADO A API

---

### ❌ DAÑOS A TERCEROS - NO CONECTADO
**Ruta:** `/cotizadores/third-party` → `/third-party/issue`

**Flujo ACTUAL:**
```
1. ThirdPartyComparison (tarifas hardcodeadas)
   ↓
2. ThirdPartyIssuanceForm (formulario completo)
   ↓
3. handleSubmit() 
   ↓ // TODO: Implementar endpoint
   ↓ Solo simula éxito con console.log
4. Mensaje "Solicitud enviada" (FAKE)
```

**Estado:** ❌ NO FUNCIONAL - Solo simulación

---

## 📋 PLANES DISPONIBLES EN API (Según tu documentación)

### Planes de IS:
```
DATO: 5,  TEXTO: "DAT Particular"           ← Daños a Terceros
DATO: 16, TEXTO: "DAT Comercial"            ← Daños a Terceros Comercial
DATO: 14, TEXTO: "Cobertura Completa Comercial"  ← Cobertura Completa
DATO: 6,  TEXTO: "Perdida Total"            ← Solo Pérdida Total
```

### Grupos de Tarifa:
```
Plan 5 (DAT Particular):
  - Grupo 1, 2, 3, etc.

Plan 14 (Cobertura Completa):
  - Grupo 1, 2, 3, etc.
```

---

## 🔍 PROBLEMA IDENTIFICADO

### Daños a Terceros USA TARIFAS FIJAS:

En `/lib/constants/auto-quotes.ts`:
```typescript
export const AUTO_THIRD_PARTY_INSURERS: AutoInsurer[] = [
  {
    id: 'internacional',
    name: 'Internacional de Seguros',
    basicPlan: {
      annualPremium: 120,  // ← HARDCODED
      installmentOptions: [1, 2],
    },
    premiumPlan: {
      annualPremium: 250,  // ← HARDCODED
      installmentOptions: [1, 2],
    }
  },
  // ... más aseguradoras hardcoded
];
```

### Cobertura Completa USA API REAL:
```typescript
// Genera cotización y obtiene precio REAL
const primaTotal = coberturasResult.data?.total; // ← DESDE API
```

---

## 🎯 DECISIÓN ARQUITECTÓNICA REQUERIDA

### OPCIÓN A: Unificar TODO en API de INTERNACIONAL ⭐ RECOMENDADO

**Ventajas:**
- ✅ Datos 100% reales
- ✅ Precios actualizados automáticamente
- ✅ Emisión real para ambos tipos
- ✅ Un solo flujo consistente

**Cambios necesarios:**
1. Modificar ThirdPartyComparison para usar API
2. Generar cotización con Plan 5 (DAT Particular)
3. Obtener coberturas reales
4. Emitir con la misma API que cobertura completa

**Trabajo:** MEDIO (2-3 horas)

---

### OPCIÓN B: Mantener Third-Party Separado (Híbrido)

**Cuándo usar:**
- Si las otras 4 aseguradoras (FEDPA, MAPFRE, ASSA, ANCÓN) NO tienen API
- Si quieres cotizaciones rápidas sin llamar API

**Ventajas:**
- ✅ Respuesta instantánea
- ✅ No depende de API externa

**Desventajas:**
- ❌ Precios pueden quedar desactualizados
- ❌ No hay emisión real (solo crear caso)
- ❌ Dos flujos diferentes

**Trabajo:** BAJO (1 hora) - Solo crear caso en BD

---

## 📋 PLAN DE INTEGRACIÓN RECOMENDADO

### FASE 1: Integrar Third-Party de INTERNACIONAL con API ✅

**Para INTERNACIONAL únicamente:**

1. **Modificar ThirdPartyComparison:**
```typescript
// Cuando el usuario selecciona INTERNACIONAL:
if (insurerId === 'internacional') {
  // Generar cotización REAL con Plan 5 (DAT Particular)
  const cotizacion = await fetch('/api/is/auto/quote', {
    vcodplancobertura: planType === 'basic' ? 5 : 16,  // 5=DAT Particular, 16=DAT Comercial
    vcodgrupotarifa: 1,
    vsumaaseg: 0,  // DAT no requiere suma asegurada
    // ... otros datos
  });
}
```

2. **Obtener coberturas reales:**
```typescript
const coberturas = await fetch(`/api/is/auto/coberturas?vIdPv=${IDCOT}`);
```

3. **Emisión:**
```typescript
const poliza = await fetch('/api/is/auto/emitir', {
  vIdPv: IDCOT,
  // ... datos completos
});
```

---

### FASE 2: Otras Aseguradoras (FEDPA, MAPFRE, etc.)

**Opciones:**

**A. Si tienen API:** Integrar similar a INTERNACIONAL  
**B. Si NO tienen API:** Crear caso en BD para seguimiento manual

```typescript
if (insurerId !== 'internacional') {
  // Crear caso pendiente para seguimiento manual
  await fetch('/api/cases/create', {
    insurer_id: insurerId,
    tipo: 'third-party',
    status: 'PENDIENTE_EMISION',
    // ...
  });
}
```

---

## 🔑 MAPEO DE PLANES Y TARIFAS

### Cómo identificar el plan correcto:

Según tu documentación, los planes tienen MONTOS característicos:

```typescript
// Identificación por monto aproximado
function identificarPlan(primaAnual: number): string {
  if (primaAnual < 150) return "DAT Particular (Plan 5)";
  if (primaAnual < 300) return "DAT Comercial (Plan 16)";
  if (primaAnual < 600) return "Pérdida Total (Plan 6)";
  return "Cobertura Completa (Plan 14)";
}
```

**O mejor: Mapeo directo por código de plan**
```typescript
const PLAN_MAPPING = {
  5: { nombre: "DAT Particular", tipo: "third-party", basic: true },
  16: { nombre: "DAT Comercial", tipo: "third-party", premium: true },
  14: { nombre: "Cobertura Completa", tipo: "full-coverage" },
  6: { nombre: "Pérdida Total", tipo: "total-loss" }
};
```

---

## ✅ RECOMENDACIÓN FINAL

### IMPLEMENTAR OPCIÓN A - Unificación Progresiva:

1. **INTERNACIONAL:** Usar API real para ambos flujos ⭐
   - Third-Party → Plan 5 o 16
   - Cobertura Completa → Plan 14

2. **OTRAS ASEGURADORAS:** Mantener flujo actual
   - Tarifas fijas
   - Crear caso para seguimiento manual

3. **BENEFICIOS:**
   - INTERNACIONAL siempre con datos reales
   - Emisión automática para INTERNACIONAL
   - Flexibilidad para las demás

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Confirmar que quieres unificar INTERNACIONAL en API
2. ⏳ Modificar ThirdPartyComparison para detectar INTERNACIONAL
3. ⏳ Agregar lógica de cotización con Plan 5/16
4. ⏳ Reutilizar emisión existente
5. ⏳ Probar flujo completo
6. ⏳ Mantener otras aseguradoras como están

---

## 📊 COMPARACIÓN FINAL

| Aspecto | Cobertura Completa | Third-Party ACTUAL | Third-Party CON API |
|---------|-------------------|-------------------|-------------------|
| Marcas/Modelos | ✅ API Real | ❌ Hardcoded | ✅ API Real |
| Cotización | ✅ API Real | ❌ Hardcoded | ✅ API Real |
| Coberturas | ✅ API Real | ❌ Hardcoded | ✅ API Real |
| Emisión | ✅ API Real | ❌ Simulada | ✅ API Real |
| Precio | ✅ Actualizado | ❌ Fijo | ✅ Actualizado |

---

## ❓ DECISIÓN REQUERIDA

**¿Quieres que implemente la integración de Third-Party con la API de INTERNACIONAL?**

Esto haría que TODOS los seguros de INTERNACIONAL (completa + terceros) usen las APIs reales.

**Tiempo estimado:** 2-3 horas  
**Complejidad:** Media  
**Beneficio:** Alto  

¿Procedo con la implementación?
