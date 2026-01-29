# INTERNACIONAL DE SEGUROS - Catálogos de Referencia

## Endpoints de Catálogos (GET)

Base URL: 
- **Desarrollo:** https://www.iseguros.com/APIRestIsTester
- **Producción:** https://www.iseguros.com/APIRestIs

**Autenticación:** Bearer Token en todos los endpoints

---

## 1. MARCAS DE VEHÍCULOS

**Endpoint:** GET `/api/cotizaemisorauto/getmarcas`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "Table": [
    {
      "COD_MARCA": 156.0,
      "TXT_DESC": "TOYOTA"
    },
    {
      "COD_MARCA": 258.0,
      "TXT_DESC": "HONDA"
    },
    {
      "COD_MARCA": 761.0,
      "TXT_DESC": "ADVANCE"
    },
    {
      "COD_MARCA": 545.0,
      "TXT_DESC": "AGRALE"
    },
    {
      "COD_MARCA": 1.0,
      "TXT_DESC": "AGUATECH"
    }
  ]
}
```

**Nota:** COD_MARCA viene con decimales - **usar sin decimales** en cotización

---

## 2. MODELOS DE VEHÍCULOS

**Endpoint:** GET `/api/cotizaemisorauto/getmodelos?pagenumber=1&rowsperpage=10`

**Query Params:**
- `pagenumber`: Número de página (default: 1)
- `rowsperpage`: Registros por página (default: 10, max: 10000)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "Table": [
    {
      "COD_MARCA": 1.0,
      "COD_MODELO": 1303.05,
      "TXT_DESC": "AGUATECH",
      "TIPO_VEHICULO_DESC": "CAMION"
    },
    {
      "COD_MARCA": 1.0,
      "COD_MODELO": 1303.05,
      "TXT_DESC": "ATT 3000",
      "TIPO_VEHICULO_DESC": "BUS"
    },
    {
      "COD_MARCA": 2.0,
      "COD_MODELO": 10.0,
      "TXT_DESC": "T40S",
      "TIPO_VEHICULO_DESC": "SEDAN"
    },
    {
      "COD_MARCA": 2.0,
      "COD_MODELO": 10.0,
      "TXT_DESC": "I14S",
      "TIPO_VEHICULO_DESC": "SEDAN"
    }
  ]
}
```

**Nota:** COD_MODELO viene con decimales - **usar sin decimales** en cotización

---

## 3. TIPOS DE PLANES

**Endpoint:** GET `/api/cotizaemisorauto/gettipoplanes`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "Table": [
    {
      "DATO": 3,
      "TEXTO": "dAT Particular",
      "ID_ORDEN": 2
    },
    {
      "DATO": 16,
      "TEXTO": "dAT Comercial",
      "ID_ORDEN": 4
    },
    {
      "DATO": 14,
      "TEXTO": "Cobertura Completa Comercial",
      "ID_ORDEN": 5
    },
    {
      "DATO": 6,
      "TEXTO": "Perdida Total",
      "ID_ORDEN": 0
    }
  ]
}
```

**Tipos Comunes:**
- 3: DAT Particular
- 16: DAT Comercial
- 14: Cobertura Completa Comercial
- 6: Pérdida Total

---

## 4. GRUPO TARIFA

**Endpoint:** GET `/api/cotizaemisorauto/getgrupotarifa/{vCodTipoPlan}`

**Path Params:**
- `vCodTipoPlan`: Código del tipo de plan (ej: 3, 14, 16)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "Table": [
    {
      "DATO": 1
    }
  ]
}
```

**Nota:** DATO viene sin decimales

---

## 5. PLANES DE COBERTURA

**Endpoint:** GET `/api/cotizaemisorauto/getplanes?vCodTipoPlan={codigo}`

**Query Params:**
- `vCodTipoPlan`: Código del tipo de plan

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "Table": [
    {
      "TEXTO": "SOAT 6/10 - 5 - 500/2,500",
      "DATO": 386
    },
    {
      "TEXTO": "DAT 10/20 - 10 - 2/10",
      "DATO": 387
    },
    {
      "TEXTO": "DAT 25/50 - 25 - 5/25",
      "DATO": 388
    },
    {
      "TEXTO": "DAT 50/100 - 50 - 5/25",
      "DATO": 389
    },
    {
      "TEXTO": "DAT 100/300 - 100 - 10/50",
      "DATO": 316
    }
  ]
}
```

---

## 6. TIPOS DE DOCUMENTOS

**Endpoint:** GET `/api/catalogos/tipodocumentos`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "codigoTipoDocumento": 1,
    "sigla": "CC",
    "nombreTipoDocumento": "CEDULA DE CIUDADANIA"
  },
  {
    "codigoTipoDocumento": 2,
    "sigla": "RUC",
    "nombreTipoDocumento": "RUC"
  },
  {
    "codigoTipoDocumento": 3,
    "sigla": "PAS",
    "nombreTipoDocumento": "PASAPORTE"
  }
]
```

**Códigos:**
- 1: Cédula
- 2: RUC
- 3: Pasaporte

---

## 7. GENERAR COTIZACIÓN

**Endpoint:** GET `/api/cotizaemisorauto/getgenerarcotizacion/{vcodtipodoc}/{vnrodoc}/{vnombre}/{vapellido}/{vtelefono}/{vcorreo}/{vcodmarca}/{vcodmodelo}/{vsumaaseg}/{vanioauto}/{vcodplancobertura}/{vcodgrupotarifa}`

**Path Parameters (en orden):**
1. `vcodtipodoc`: Tipo documento (1=CC, 2=RUC, 3=PAS)
2. `vnrodoc`: Número de documento
3. `vnombre`: Nombre
4. `vapellido`: Apellido
5. `vtelefono`: Teléfono
6. `vcorreo`: Correo
7. `vcodmarca`: Código marca (**SIN decimales**)
8. `vcodmodelo`: Código modelo (**SIN decimales**)
9. `vsumaaseg`: Suma asegurada (0 si no aplica)
10. `vanioauto`: Año del vehículo
11. `vcodplancobertura`: Código plan cobertura
12. `vcodgrupotarifa`: Código grupo tarifa (**SIN decimales**)

**Headers:**
```
Authorization: Bearer {token}
```

**Example:**
```
GET /api/cotizaemisorauto/getgenerarcotizacion/1/8-000-000/prueba/prueba/60806060/prueba@prueba.com/2/15/4500/2023/306/2
```

**Response Success:**
```json
{
  "Table": [
    {
      "RESOP": 1,
      "MSG": "La cotización fue generada.",
      "MSG_FIELDS": null,
      "IDCOT": 1039151,
      "NROCOT": 11668,
      "PTOTAL": 480.18
    }
  ]
}
```

**Response Error (Suma Asegurada No Permitida):**
```json
{
  "Table": [
    {
      "RESOP": -1,
      "MSG": "<!>Suma asegurada no permitida en este plan, el rango es de $0.00 a $0.00 dólares.</li>",
      "MSG_FIELDS": "|TxtSumaAsegurada",
      "IDCOT": 0,
      "NROCOT": 0,
      "PTOTAL": null
    }
  ]
}
```

**Response Error (Rango Específico):**
```json
{
  "Table": [
    {
      "RESOP": -1,
      "MSG": "<!>Suma asegurada no permitida en este plan, el rango es de $4500.00 a $75000.00 dólares.</li>",
      "MSG_FIELDS": "|TxtSumaAsegurada",
      "IDCOT": 0,
      "NROCOT": 0,
      "PTOTAL": null
    }
  ]
}
```

**Campos Respuesta:**
- `RESOP`: 1=éxito, -1=error
- `MSG`: Mensaje descriptivo
- `IDCOT`: ID de cotización (usar en getcoberturascotizacion)
- `NROCOT`: Número de cotización
- `PTOTAL`: Prima total

---

## 8. OBTENER COBERTURAS DE COTIZACIÓN

**Endpoint:** GET `/api/cotizaemisorauto/getcoberturascotizacion?vIdPv={idcot}&vIdOpt={opcion}`

**Query Params:**
- `vIdPv`: ID de cotización (IDCOT del paso anterior)
- `vIdOpt`: Opción de deducible (1, 2, o 3)

**Headers:**
```
Authorization: Bearer {token}
```

**Example:**
```
GET /api/cotizaemisorauto/getcoberturascotizacion/1030168/1
```

**Response:**
```json
{
  "Table": [
    {
      "COD_AMPARO": 1.0,
      "COBERTURA": "LESIONES CORPORALES",
      "LIMITES": "5,000.00 / 10,000.00",
      "PRIMA": "30.07",
      "DEDUCIBLE1": "",
      "PRIMA2": "30.07",
      "DEDUCIBLE2": "",
      "PRIMA3": "30.07",
      "SN_DESCUENTO": "",
      "MuestraSUMA": 0
    },
    {
      "COD_AMPARO": 2.0,
      "COBERTURA": "DAÑOS A LA PROPIEDAD AJENA",
      "LIMITES": "5,000.00",
      "PRIMA": "100.20",
      "DEDUCIBLE1": "",
      "PRIMA2": "100.20",
      "DEDUCIBLE2": "",
      "PRIMA3": "100.20",
      "SN_DESCUENTO": "",
      "MuestraSUMA": 0
    }
  ]
}
```

**Campos:**
- `COD_AMPARO`: Código de cobertura (**SIN decimales**)
- `COBERTURA`: Nombre de la cobertura
- `LIMITES`: Límites de cobertura
- `PRIMA`: Prima de la cobertura
- `DEDUCIBLE1/2/3`: Deducibles según opción
- `MuestraSUMA`: 0 o 1

---

## NOTAS IMPORTANTES

### 1. Códigos SIN Decimales
Los siguientes códigos vienen con decimales en la API pero **DEBEN enviarse SIN decimales** en cotización:
- `COD_MARCA`: 156.0 → 156
- `COD_MODELO`: 2469.0 → 2469
- `COD_AMPARO`: 1.0 → 1
- `vcodgrupotarifa`: 1 (ya viene sin decimales)

### 2. Suma Asegurada (vsumaaseg)
- **Si plan NO requiere:** enviar `0`
- **Si plan requiere rango:** usar valor dentro del rango especificado
- El error `RESOP: -1` indica rango requerido en `MSG`

### 3. Opciones de Deducible (vIdOpt)
- `1`: Deducible opción 1 (bajo)
- `2`: Deducible opción 2 (medio)
- `3`: Deducible opción 3 (alto)

### 4. Paginación en Modelos
Para obtener TODOS los modelos:
```
GET /api/cotizaemisorauto/getmodelos?pagenumber=1&rowsperpage=10000
```

---

## Flujo Completo de Cotización

```
1. GET Marcas → Seleccionar COD_MARCA
2. GET Modelos → Seleccionar COD_MODELO (filtrar por marca)
3. GET Tipo Planes → Seleccionar vCodTipoPlan
4. GET Grupo Tarifa → Obtener vcodgrupotarifa
5. GET Planes → Seleccionar vcodplancobertura
6. GET Tipo Docs → Conocer vcodtipodoc (1=CC, 2=RUC, 3=PAS)
7. GET Generar Cotización → Obtener IDCOT y PTOTAL
8. GET Coberturas → Obtener detalle con COD_AMPARO
```

---

## Estructura de Respuesta Estándar

**Catálogos:**
```json
{
  "Table": [ {...} ]
}
```

**Cotización:**
```json
{
  "Table": [
    {
      "RESOP": 1 | -1,
      "MSG": "string",
      "IDCOT": number,
      "PTOTAL": number
    }
  ]
}
```

---

## Cache Strategy

- **TTL:** 24 horas
- **Storage:** localStorage + memoria
- **Actualización:** Automática al expirar
- **Endpoint:** `/api/is/catalogos?env=development`
