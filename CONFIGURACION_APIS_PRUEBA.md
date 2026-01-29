# CONFIGURACIÓN APIs EN AMBIENTE DE PRUEBA

**Objetivo:** Emitir pólizas de prueba en ambas aseguradoras

---

## ✅ INTERNACIONAL DE SEGUROS (IS) - DESARROLLO

### Configuración Actual
**Archivo:** `src/lib/is/config.ts`

```typescript
development: {
  baseUrl: 'https://www.iseguros.com/APIRestIsTester',
  bearerToken: 'eyJhbGci...HomXGjaD5od8Ob34IUqdjGhy6GpR9iEO9AmUcFPI1PI',
}
```

### Según Documentación Oficial
**Archivo:** `public/API INTERNACIONAL/PASOS PARA CONSUMIR ENDPOINT.txt`

**Base URL Desarrollo:** `https://www.iseguros.com/APIRestIsTester` ✅ CORRECTO

**Flujo documentado:**
1. ✅ Consumir `/api/tokens` (token principal Bearer)
2. ✅ Consumir `/api/tokens/diario` (opcional, renovación)
3. ✅ Consumir `/api/cotizaemisorauto/getmarcas`
4. ✅ Consumir `/api/cotizaemisorauto/getmodelos`
5. ✅ Consumir `/api/cotizaemisorauto/gettipoplanes`
6. ✅ Consumir `/api/cotizaemisorauto/getgrupotarifa/{vCodTipoPlan}`
7. ✅ Consumir `/api/cotizaemisorauto/getplanes`
8. ✅ Consumir `/api/catalogos/tipodocumentos`
9. ✅ Consumir `/api/cotizaemisorauto/getgenerarcotizacion` ← COTIZACIÓN
10. ✅ Consumir `/api/cotizaemisorauto/getcoberturascotizacion` ← COBERTURAS

**Endpoints implementados:** TODOS según documentación ✅

---

## ✅ FEDPA SEGUROS - DESARROLLO

### Configuración Actual
**Archivo:** `src/lib/fedpa/config.ts`

```typescript
DEV: {
  usuario: 'SLIDERES',
  clave: 'lider836',
  ambiente: 'DEV',
  corredor: '836',
  emisorPlanUrl: 'https://wscanales.segfedpa.com/EmisorPlan',
  emisorExternoUrl: 'https://wscanales.segfedpa.com/EmisorFedpa.Api',
}
```

### Según Documentación Oficial
**Archivo:** `public/API FEDPA/Documentacion de API de emision por plan.txt`

**Base URL:** `https://wscanales.segfedpa.com/EmisorPlan` ✅ CORRECTO

**Credenciales:** Proporcionadas por Mercadeo FEDPA ✅ CORRECTO

**Flujo documentado (Emisor Plan 2024):**
1. ✅ POST `/api/generartoken` (autenticación)
   - Body: `{ usuario, clave, Amb: "DEV" }`
   - Response: `{ success, token }`

2. ✅ GET `/api/planes` (obtener planes disponibles)
   - Headers: `Authorization: Bearer {token}`
   - Response: Array de planes con coberturas, límites, primas

3. ✅ GET `/api/planes/beneficios?plan={id}` (beneficios del plan)
   - Headers: `Authorization: Bearer {token}`
   - Response: Array de beneficios

4. ✅ POST `/api/subirdocumentos` (cargar documentos)
   - Form-data: archivos con nombres exactos
   - Response: `{ success, idDoc }`

5. ✅ POST `/api/emitirpoliza` (emitir póliza de prueba)
   - Headers: `Authorization: Bearer {token}`
   - Body: Plan, idDoc, PrimaTotal, datos cliente, datos vehículo
   - Response: `{ success, amb: "DEV", cotizacion, poliza, desde, hasta }`

**Endpoints implementados:** TODOS según documentación ✅

---

## 📋 FLUJO COMPLETO DE PRUEBA

### INTERNACIONAL DE SEGUROS (IS)

#### 1. Obtener Catálogos
```
GET /api/cotizaemisorauto/getmarcas
GET /api/cotizaemisorauto/getmodelos?vcodmarca={marca}&pagenumber=1&rowsperpage=100
GET /api/cotizaemisorauto/gettipoplanes
GET /api/cotizaemisorauto/getgrupotarifa/{vCodTipoPlan}
GET /api/cotizaemisorauto/getplanes?vCodTipoPlan={tipo}
```

#### 2. Generar Cotización
```
GET /api/cotizaemisorauto/getgenerarcotizacion/{vcodtipodoc}/{vnrodoc}/{vnombre}/{vapellido}/{vtelefono}/{vcorreo}/{vcodmarca}/{vcodmodelo}/{vsumaaseg}/{vanioauto}/{vcodplancobertura}/{vcodgrupotarifa}
```

**Response esperado:** `{ "Table": [{ "IDCOT": "1234567" }] }`

#### 3. Obtener Coberturas
```
GET /api/cotizaemisorauto/getcoberturascotizacion?vIdPv={IDCOT}&vIdOpt={1|2|3}
```

**Response esperado:** 
```json
{
  "Table": [
    {
      "COD_AMPARO": "1",
      "COBERTURA": "LESIONES CORPORALES",
      "LIMITES": "10,000.00/20,000.00",
      "PRIMA1": 100,
      "PRIMA2": 150,
      "PRIMA3": 200,
      "DEDUCIBLE1": "500 USD",
      "DEDUCIBLE2": "250 USD",
      "DEDUCIBLE3": "100 USD"
    }
  ]
}
```

#### 4. Emitir Póliza de Prueba
```
POST /api/cotizaemisorauto/getemision
```

---

### FEDPA SEGUROS

#### 1. Generar Token
```
POST /api/generartoken
Body: { "usuario": "SLIDERES", "clave": "lider836", "Amb": "DEV" }
```

**Response esperado:** `{ "success": true, "token": "eyJhbGci..." }`

#### 2. Obtener Planes
```
GET /api/planes
Headers: Authorization: Bearer {token}
```

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "plan": 3,
      "tipoplan": "DANOS A TERCEROS",
      "descripcion": "RESPONSABILIDAD CIVIL BASICO",
      "prima": 108,
      "impuesto1": 5.4,
      "impuesto2": 1.08,
      "primaconimpuesto": 115,
      "sincronizado": true,
      "coberturas": [
        {
          "cobertura": "A",
          "descripcion": "LESIONES CORPORALES",
          "limite": "5,000.00/10,000.00",
          "prima": 30
        }
      ],
      "usos": [
        { "uso": "10", "descripcion": "AUTO PARTICULAR" }
      ]
    }
  ]
}
```

#### 3. Obtener Beneficios (opcional)
```
GET /api/planes/beneficios?plan={id}
Headers: Authorization: Bearer {token}
```

#### 4. Subir Documentos
```
POST /api/subirdocumentos
Form-data:
  - file: documento_identidad.pdf
  - file: licencia_conducir.pdf
  - file: registro_vehicular.pdf
```

**Response esperado:** `{ "success": true, "idDoc": "Doc-xxxxx" }`

#### 5. Emitir Póliza de Prueba
```
POST /api/emitirpoliza
Body: {
  "Plan": 3,
  "idDoc": "Doc-xxxxx",
  "PrimaTotal": 115,
  "PrimerNombre": "PRUEBA",
  "PrimerApellido": "DESARROLLO",
  "Identificacion": "8-999-9999",
  "FechaNacimiento": "01/01/1990",
  "Sexo": "M",
  "Uso": "10",
  "Marca": "TOY",
  "Modelo": "COROLLA",
  "Ano": "2020",
  "Motor": "TEST123",
  "Placa": "TEST-01",
  "Vin": "TEST1234567890123",
  "Color": "NEGRO",
  "Pasajero": 5,
  "Puerta": 4
}
```

**Response esperado (DESARROLLO):**
```json
{
  "success": true,
  "amb": "DEV",
  "cotizacion": "216",
  "poliza": "04-07-72-0",
  "desde": "26/02/2024",
  "hasta": "26/02/2025"
}
```

---

## 🔍 VERIFICACIÓN ACTUAL

### IS - Configuración
- ✅ Base URL: `APIRestIsTester` (desarrollo)
- ✅ Bearer Token: Llave de desarrollo configurada
- ✅ Endpoints: Todos implementados según doc

### FEDPA - Configuración  
- ✅ Base URL: `EmisorPlan` (desarrollo)
- ✅ Usuario: `SLIDERES` (correcto)
- ✅ Clave: `lider836` (correcto)
- ✅ Ambiente: `DEV` (correcto)
- ✅ Endpoints: Todos implementados según doc

---

## 📝 NOTAS IMPORTANTES

### Internacional de Seguros
1. **Códigos sin decimales:** COD_MARCA, COD_MODELO, COD_AMPARO se envían SIN decimales
2. **Suma asegurada:** Enviar 0 si el plan no lo requiere, o dentro del rango si lo requiere
3. **vIdOpt:** 1 (deducible bajo), 2 (medio), 3 (alto)
4. **Token diario:** Se renueva automáticamente antes de expirar

### FEDPA
1. **Nombres de archivos:** EXACTOS - `documento_identidad`, `licencia_conducir`, `registro_vehicular`
2. **Prima con impuestos:** Las primas de coberturas YA incluyen impuestos
3. **Sincronizado:** true = prima total coincide con suma de coberturas
4. **Ambiente DEV:** Las pólizas emitidas son de PRUEBA
5. **Token TTL:** 50 minutos, renovar antes de expirar

---

## ✅ ESTADO ACTUAL

**AMBAS APIs configuradas en DESARROLLO según documentación oficial**

**Próximo paso:** Probar flujo completo de cotización y verificar respuestas objetivas de las APIs
