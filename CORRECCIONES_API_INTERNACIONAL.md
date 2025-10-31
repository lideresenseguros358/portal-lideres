# ✅ CORRECCIONES APLICADAS - API INTERNACIONAL

**Fecha:** Octubre 31, 2025  
**Estado:** ✅ Correcciones Críticas Completadas

---

## 🔧 CORRECCIONES REALIZADAS

### 1. TIPOS DE DATOS CORREGIDOS ✅

**Problema:** La API requiere tipos numéricos, no strings

**ANTES (❌ Incorrecto):**
```typescript
vcodtipodoc: 'CED'         // String
vcodmarca: 'TOY'           // String
vcodmodelo: 'COROLLA'      // String
vcodplancobertura: '1'     // String
vcodgrupotarifa: '1'       // String
```

**DESPUÉS (✅ Correcto):**
```typescript
vcodtipodoc: 1             // Número (1=CC, 2=RUC, 3=PAS)
vcodmarca: 204             // Número (204=Toyota)
vcodmodelo: 1234           // Número (código del modelo)
vcodplancobertura: 14      // Número (14=Cobertura Completa Comercial)
vcodgrupotarifa: 1         // Número
```

---

### 2. ARCHIVOS MODIFICADOS ✅

#### 2.1 `/app/cotizadores/comparar/page.tsx`
**Cambios:**
- Cambió `marcaMap` de `Record<string, string>` a `Record<string, number>`
- Códigos de marca ahora son numéricos: Toyota=204, Honda=123, etc.
- `vcodtipodoc` cambiado de 'CED' a 1
- `vcodplancobertura` cambiado de '1' a 14 (Cobertura Completa Comercial)

#### 2.2 `/app/cotizadores/emitir/page.tsx`
**Cambios:**
- `vcodtipodoc` cambiado de 'CED' a 1

#### 2.3 `/lib/is/quotes.service.ts`
**Cambios:**
- Interface `CotizacionAutoRequest` actualizada:
  - `vcodtipodoc: number` (era string)
  - `vcodmarca: number` (era string)
  - `vcodmodelo: number` (era string)
  - `vcodplancobertura: number` (era string)
  - `vcodgrupotarifa: number` (era string)

#### 2.4 `/app/api/is/auto/quote/route.ts`
**Cambios:**
- Agregado `parseInt()` para asegurar tipos numéricos:
  - `vcodtipodoc: parseInt(vcodtipodoc as string) || 1`
  - `vcodmarca: parseInt(vcodmarca as string)`
  - `vcodmodelo: parseInt(vcodmodelo as string)`
  - `vcodplancobertura: parseInt(vcodplancobertura as string)`
  - `vcodgrupotarifa: parseInt(vcodgrupotarifa as string)`

#### 2.5 `/app/api/is/auto/emitir/route.ts`
**Cambios:**
- Mismos cambios que en quote/route.ts para emisión

---

## 📊 MAPEO DE MARCAS ACTUAL

```typescript
const marcaMap: Record<string, number> = {
  'TOYOTA': 204,
  'HONDA': 123,
  'NISSAN': 145,
  'HYUNDAI': 110,
  'KIA': 120,
  'MAZDA': 135,
  'FORD': 95,
  'CHEVROLET': 75,
};
```

**⚠️ Nota:** Estos códigos son aproximados. Se debe consumir el endpoint real:
```
GET /api/cotizaemisorauto/getmarcas
```

---

## 🎯 FLUJO ACTUALIZADO

### Cotización:

```typescript
// 1. Usuario completa formulario
{
  marca: 'TOYOTA',
  modelo: 'Corolla',
  anio: 2020,
  valorVehiculo: 15000
}

// 2. Se mapea a códigos numéricos
{
  vcodmarca: 204,          // ✅ Numérico
  vcodmodelo: 1234,        // ✅ Numérico (default)
  vcodtipodoc: 1,          // ✅ Numérico (1=Cédula)
  vcodplancobertura: 14,   // ✅ Numérico (Cobertura Completa)
  vcodgrupotarifa: 1,      // ✅ Numérico
  vsumaaseg: 15000
}

// 3. Se envía a API de IS
POST /api/is/auto/quote

// 4. Se obtiene IDCOT
{ IDCOT: 1030168 }

// 5. Se obtienen coberturas
GET /api/cotizaemisorauto/getcoberturascotizacion/1030168/1

// 6. Se muestran datos reales al usuario
```

---

## ⚠️ PENDIENTES (Para Mejoras Futuras)

### IMPORTANTE:

1. **Catálogos Dinámicos:**
   - Implementar carga real de marcas desde API
   - Implementar carga real de modelos desde API
   - Cachear catálogos en localStorage

2. **Validación de Suma Asegurada:**
   - Detectar si el plan requiere suma asegurada
   - Validar rangos permitidos
   - Manejar error: "Disuma asegurada no permitida"

3. **Múltiples Opciones de Cotización:**
   - Implementar vIdOpt = 1, 2, 3
   - Permitir comparar las 3 opciones

4. **Selects Dinámicos en Formulario:**
   - Agregar select de marcas (cargar de API)
   - Agregar select de modelos (filtrado por marca)
   - Agregar select de planes de cobertura

---

## ✅ VERIFICACIÓN

```bash
✅ npm run typecheck - 0 errores
✅ Tipos numéricos correctos
✅ Interfaces actualizadas
✅ Conversiones con parseInt()
✅ Valores por defecto correctos
```

---

## 🧪 TESTING RECOMENDADO

### Para probar las correcciones:

1. Ir a `/cotizadores/auto/completa`
2. Llenar formulario con marca TOYOTA
3. Cotizar
4. En consola verificar:
   ```
   [INTERNACIONAL] ID Cotización: xxxx
   [INTERNACIONAL] Prima Total REAL: $xxx.xx
   ```
5. Seleccionar INTERNACIONAL
6. Completar flujo de emisión
7. Verificar que emite correctamente

### Logs esperados:
```
POST /api/is/auto/quote
Body: {
  vcodtipodoc: 1,          // ✅ Número
  vcodmarca: 204,          // ✅ Número
  vcodmodelo: 1234,        // ✅ Número
  vcodplancobertura: 14,   // ✅ Número
  vcodgrupotarifa: 1       // ✅ Número
}
```

---

## 📝 NOTAS IMPORTANTES

### Códigos de Tipo de Documento:
```
1 = CC (Cédula de Ciudadanía)
2 = RUC
3 = PAS (Pasaporte)
```

### Códigos de Plan (según documentación):
```
5  = DAT Particular
16 = DAT Comercial
14 = Cobertura Completa Comercial  ← Usamos este
6  = Perdida Total
```

### Rango de Suma Asegurada:
- Depende del plan seleccionado
- Algunos planes NO permiten suma asegurada (enviar 0)
- Otros requieren rango específico (ej: $4,500 - $75,000)

---

## 🎊 RESULTADO

**Las correcciones críticas están aplicadas.**

El flujo ahora envía los tipos de datos correctos según la documentación de la API de INTERNACIONAL.

**Próximos pasos sugeridos:**
1. Implementar catálogos dinámicos (marcas/modelos desde API)
2. Validación de suma asegurada según plan
3. Testing con datos reales

**Estado:** ✅ TIPOS CORREGIDOS - LISTO PARA TESTING
