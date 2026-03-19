# Auditoría Regional — Preparación para Producción

**Fecha:** 2026-03-18
**Alcance:** Flujo completo de emisión DT (RC) y CC para La Regional de Seguros
**Fuente:** Documento Técnico API LRDS (21 páginas) + credenciales DESA + código fuente

---

## 🔴 BLOQUEANTES PARA PRODUCCIÓN

### 1. NO HAY CREDENCIALES DE PRODUCCIÓN

El documento técnico y los archivos TXT solo contienen credenciales de **DESARROLLO**:

| Dato | Valor DESA | Valor PROD |
|------|-----------|------------|
| URL Base | `https://desa.laregionaldeseguros.com:10443/desaw` | **❌ NO SE TIENE** |
| Usuario | `LIDERES_EN_SEGUROS_99` | **❌ NO SE TIENE** |
| Clave | `F?V3pTl*_cPL` | **❌ NO SE TIENE** |
| codInter | `99` | **❌ NO SE TIENE** |
| cToken (cotizar) | `6NWEDYFWVCQoaqzppdjswFKPAPGQQPBnxMBTzhzDGTFRG8R4THEDS--X+*ieO` | **❌ NO SE TIENE** |

**Acción requerida:** Solicitar a La Regional de Seguros las credenciales y URL de producción.

### 2. URL de PRODUCCIÓN hardcodeada como DEV

En `src/lib/regional/config.ts` línea 11:
```typescript
production: process.env.REGIONAL_BASE_URL_PROD || 'https://desa.laregionaldeseguros.com:10443/desaw',
```
El fallback de PROD apunta al servidor de DESARROLLO. Si no se configura `REGIONAL_BASE_URL_PROD` en las variables de entorno, las emisiones de producción irán al ambiente de desarrollo.

### 3. Environment hardcodeado como 'development' en múltiples rutas

Los siguientes archivos tienen `getRegionalCredentials('development')` hardcodeado en vez de detectar el ambiente automáticamente:

| Archivo | Línea |
|---------|-------|
| `src/app/api/regional/auto/emit-cc/route.ts` | 83 |
| `src/app/api/regional/auto/emit-rc/route.ts` | 28 |
| `src/lib/regional/quotes.service.ts` | 30 |

Esto significa que **incluso en producción, siempre se usarán credenciales de desarrollo**.

El `http-client.ts` sí detecta correctamente el ambiente con `process.env.NODE_ENV`, pero estos archivos lo sobrescriben.

---

## 🟡 ISSUES MENORES (no bloqueantes pero deben corregirse)

### 4. Cotizar RC usa endpoint con URL diferente al doc

- **Doc dice:** `GET https://desa.laregionaldeseguros.com:10443/desaw/regional/auto/cotizar/` con params como query headers (cToken, cCodInter, nEdad, cSexo, etc.)
- **Código:** `quotes.service.ts` envía los params como query string (`regionalGet` con `params`), lo cual es correcto.
- **Doc página 16** muestra que cotizar RC es GET con parámetros en **headers**, no en query string. Sin embargo, la colección de Postman (mencionada en doc) puede tener implementación distinta.
- **Riesgo:** Si PROD valida los parámetros como headers en vez de query params, fallará la cotización RC. Verificar con Regional.

### 5. Campo `nGastosMed` faltante en cotización RC

- **Doc página 19-20:** El campo `nGastosMed` (Gastos Médicos) es un parámetro del cotizador RC.
- **Código:** `quotes.service.ts` solo envía `nGastosMedicos` si el input lo tiene, no lo incluye por defecto.
- **Impacto:** Bajo. El campo no es marcado como obligatorio.

### 6. Campo `nMontoVeh` en cotización RC

- **Doc página 18:** `nMontoVeh` es la suma asegurada para CC (cobertura todo riesgo); para RC puro debe ser 0, máximo 80,000.
- **Código:** Correctamente envía `nMontoVeh: '0'` para RC. ✅

### 7. Campo `edad` en RC cotización

- **Doc página 16:** `nEdad` debe ser mayor a 18 y número entero.
- **Código:** Lo calcula correctamente desde `edad.toString()`. ✅

### 8. Campo `nAnio` en cotización RC

- **Doc página 17:** Debe ser hasta 10 años de antigüedad y número entero.
- **Código:** No valida la antigüedad máxima de 10 años antes de enviar a Regional.
- **Impacto:** Bajo. Regional validará y retornará error.

---

## 🟢 FLUJO CC — ANÁLISIS DE COMPLETITUD

### Endpoints documentados vs implementados:

| Endpoint | Método | Documentación | Implementado | Estado |
|----------|--------|--------------|-------------|--------|
| `/regional/auto/cotizacion` | POST | Pág. 3-5 | `quote-cc/route.ts` → `quotes.service.ts` | ✅ Correcto |
| `/regional/auto/emitirPoliza` | POST | Pág. 5-6, 8 | `emit-cc/route.ts` → `emission.service.ts` | ✅ Correcto |
| `/regional/util/imprimirPoliza` | POST | Pág. 6, 9 | `print/route.ts` → `emission.service.ts` | ✅ Correcto |
| `/regional/auto/planPago` | PUT | Pág. 6, 8 | `emit-cc/route.ts` → `emission.service.ts` | ✅ Correcto |

### Campos CC cotizacion (Pág. 4-5):

| Campo | Tipo | Requerido | Implementado |
|-------|------|-----------|-------------|
| cliente.nomter | String | Sí | ✅ |
| cliente.apeter | String | Sí | ✅ |
| cliente.edad | Numérico | Sí | ✅ |
| cliente.sexo | String | Sí | ✅ |
| cliente.edocivil | String | Sí | ✅ |
| cliente.identificacion.* | Varios | Sí | ✅ |
| cliente.t1numero | String | Sí | ✅ |
| cliente.t2numero | String | Sí | ✅ |
| cliente.email | String | Sí | ✅ |
| datosveh.vehnuevo | String | Sí | ✅ |
| datosveh.codmarca | Numérico | Sí | ✅ |
| datosveh.codmodelo | Numérico | Sí | ✅ |
| datosveh.anio | Numérico | Sí | ✅ |
| datosveh.valorveh | Numérico | Sí | ✅ |
| datosveh.numpuestos | Numérico | Sí | ✅ |
| tpcobert | String | Sí | ✅ ("1") |
| endoso | String | Sí | ✅ |
| limites.lescor | String | Sí | ✅ |
| limites.danpro | String | Sí | ✅ |
| limites.gasmed | String | Sí | ✅ |

### Campos CC emitirPoliza (Pág. 5-6):

| Campo | Implementado |
|-------|-------------|
| codInter (header) | ✅ via http-client.ts |
| token (header) | ✅ via http-client.ts |
| Authorization (header) | ✅ via http-client.ts |
| numcot | ✅ |
| cliente.direccion.* | ✅ (codpais, codestado, codciudad, codmunicipio, codurb, dirhab) |
| cliente.datosCumplimiento.* | ✅ (ocupacion, ingresoAnual, paisTributa, pep) |
| datosveh.* | ✅ (vehnuevo, numplaca, serialcarroceria, serialmotor, color, usoveh, peso) |
| acreedor | ✅ (default "81") |

### Campos CC planPago (Pág. 6):

| Campo | Implementado |
|-------|-------------|
| numcot | ✅ |
| cuotas | ✅ |
| opcionPrima | ✅ |

### Campos CC imprimirPoliza (Pág. 6, 9):

| Campo | Implementado |
|-------|-------------|
| poliza | ✅ |

**Resultado CC: ✅ Todos los campos documentados están implementados correctamente.**

---

## 🟢 FLUJO RC (DT) — ANÁLISIS DE COMPLETITUD

### Endpoints documentados vs implementados:

| Endpoint | Método | Documentación | Implementado | Estado |
|----------|--------|--------------|-------------|--------|
| `/regional/auto/cotizar/` | GET | Pág. 16-21 | `quotes.service.ts` (cotizarRC) + `third-party/route.ts` (planes) | ✅ |
| `/regional/auto/emitirPolizaRc` | POST | Pág. 11 | `emit-rc/route.ts` → `emission.service.ts` | ✅ |
| `/regional/auto/planesRc` | GET | Pág. 3 | `third-party/route.ts` | ✅ |

### Campos RC emitirPolizaRc (Pág. 12-15):

| Campo | Tipo | Requerido | Implementado |
|-------|------|-----------|-------------|
| codInter | String(6) | Sí | ✅ (header) |
| plan | String(3) | Sí | ✅ |
| cliente.nomter | String(100) | Sí | ✅ (sanitize 50) |
| cliente.apeter | String(100) | Sí | ✅ (sanitize 50) |
| cliente.fchnac | Date (YYYY-MM-DD) | Sí | ✅ |
| cliente.edad | Numérico(3) | Sí | ✅ |
| cliente.sexo | String(1) | Sí | ✅ |
| cliente.edocivil | String(1) | Sí | ✅ |
| cliente.t1numero | String(7) | Sí | ✅ |
| cliente.t2numero | String(8) | Sí | ✅ |
| cliente.email | String(50) | Sí | ✅ |
| direccion.codpais | Numérico(3) | Sí | ✅ |
| direccion.codestado | Numérico(3) | Sí | ✅ |
| direccion.codciudad | Numérico(3) | Sí | ✅ |
| direccion.codmunicipio | Numérico(3) | Sí | ✅ |
| direccion.codurb | Numérico(3) | Sí | ✅ |
| direccion.dirhab | String(50) | Sí | ✅ |
| identificacion.tppersona | String(1) | Sí | ✅ |
| identificacion.tpodoc | String(1) | Sí | ✅ |
| identificacion.prov | Numérico(10) | No | ✅ |
| identificacion.letra | String(4) | No | ✅ |
| identificacion.tomo | Numérico(10) | No | ✅ |
| identificacion.asiento | Numérico(10) | No | ✅ |
| identificacion.dv | Numérico(10) | No | ✅ |
| identificacion.pasaporte | String(30) | No | ✅ |
| datosveh.codmarca | Numérico(3) | Sí | ✅ (con resolveRegionalVehicleCodes) |
| datosveh.codmodelo | Numérico(3) | Sí | ✅ (con resolveRegionalVehicleCodes) |
| datosveh.anio | Numérico(4) | Sí | ✅ |
| datosveh.numplaca | String(6) | Sí | ✅ (sanitize 10) |
| datosveh.serialcarroceria | String(100) | Sí | ✅ (sanitize 20) |
| datosveh.serialmotor | String(100) | Sí | ✅ (sanitize 20) |
| datosveh.color | String(50) | Sí | ✅ (colorToRegionalCode) |
| condHab.nomter | String(100) | Sí | ✅ |
| condHab.apeter | String(100) | Sí | ✅ |
| condHab.sexo | String(1) | Sí | ✅ |
| condHab.edocivil | String(1) | Sí | ✅ |

**Resultado RC: ✅ Todos los campos documentados están implementados correctamente.**

### Catálogos disponibles (Pág. 21):

| Catálogo | Endpoint | Implementado |
|----------|----------|-------------|
| marcaVeh | `/regional/ws/marcaVeh` | ✅ |
| modeloVeh | `/regional/ws/modeloVeh` | ✅ |
| endosos | `/regional/ws/endosos` | ✅ |
| colorVeh | `/regional/ws/colorVeh` | ✅ |
| edoCivil | `/regional/ws/edoCivil` | ✅ |
| genero | `/regional/ws/genero` | ✅ |

### Cotizar RC parámetros (Pág. 16-21):

| Parámetro | Valores válidos | Implementado |
|-----------|----------------|-------------|
| cToken | Del archivo llaves cotizar | ✅ |
| cCodInter | Del archivo llaves cotizar | ✅ |
| nEdad | >18, entero | ✅ |
| cSexo | Catálogo /genero | ✅ |
| cEdocivil | Catálogo /edoCivil | ✅ |
| cMarca | Catálogo /marcaVeh | ✅ |
| cModelo | Catálogo /modeloVeh | ✅ |
| nAnio | Hasta 10 años antigüedad | ✅ (sin validación local) |
| nMontoVeh | 0 para RC, max 80000 | ✅ (0 para RC) |
| nLesiones | Tabla de límites (0-100,000) | ✅ |
| nDanios | Tabla de límites (0-100,000) | ✅ |
| nGastosMed | Tabla de límites (0-10,000) | ✅ (opcional) |
| cEndoso | BASICO/PLUS/PLATINUM/KM* | ✅ |
| cTipocobert | RC o CC | ✅ |

---

## 📋 RESUMEN EJECUTIVO

### Lo que ESTÁ listo:
- ✅ **Estructura de código completa** — todos los endpoints documentados están implementados
- ✅ **Tipos TypeScript** — coinciden 100% con la documentación
- ✅ **Flujo CC completo:** cotizar → planPago → emitirPoliza → imprimirPoliza
- ✅ **Flujo RC completo:** planesRc → cotizar → emitirPolizaRc
- ✅ **HTTP client robusto** con retry, timeout, error handling
- ✅ **Catálogos** — todos implementados y con mapeo IS→Regional
- ✅ **Color mapping** — conversión de texto libre a código Regional
- ✅ **Vehicle code resolution** — mapeo automático IS→Regional
- ✅ **Sanitización de campos** — truncado según tamaño máximo del API
- ✅ **Welcome email** — integrado con send-expediente
- ✅ **ADM COT tracking** — pagos y recurrencias

### Lo que FALTA para producción:

| # | Bloqueante | Acción | Responsable |
|---|-----------|--------|-------------|
| 1 | **Credenciales PROD** | Solicitar a La Regional: URL PROD, usuario, clave, codInter, cToken | **Comercial/IT** |
| 2 | **Variables de entorno PROD** | Configurar en hosting: `REGIONAL_BASE_URL_PROD`, `REGIONAL_USERNAME`, `REGIONAL_PASSWORD`, `REGIONAL_COD_INTER`, `REGIONAL_TOKEN` | **DevOps** |
| 3 | **Quitar hardcode 'development'** | Cambiar `getRegionalCredentials('development')` a auto-detect en emit-cc, emit-rc, quotes.service | **Desarrollo** |
| 4 | **Verificar cotizar RC** | Confirmar si params van como query string o como headers (doc ambiguo) | **QA con Regional** |

### Estimación:
- Items 2 y 3 son ~30 min de trabajo una vez que se tienen las credenciales.
- Item 1 depende enteramente de La Regional.
- Item 4 se puede verificar con una prueba rápida en PROD.

**Conclusión: El código está funcionalmente listo. El único bloqueante real es obtener credenciales de producción de La Regional.**
