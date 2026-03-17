# DIAGNÓSTICO COMPLETO: Emisión ANCON vía SOAP API

**Fecha:** 18–20 de marzo de 2026  
**Estado:** ❌ BLOQUEADO — requiere acción de ANCON (2 errores del servidor confirmados)  
**Corredor:** LIDERES EN SEGUROS, S.A — Usuario: `01009`  
**Endpoint:** `https://app.asegurancon.com/ws_emisiones/server_otros.php`  
**Documentación revisada:** 29 páginas de `ws_emisiones.pdf` + 3 páginas de `1_Informacion Apis.pdf`

---

## 1. Resumen Ejecutivo

Se realizó una auditoría exhaustiva del flujo de emisión ANCON los días 17–20 de marzo de 2026.  
Se ejecutaron **más de 150 pruebas directas SOAP** contra el endpoint de producción, variando todos los parámetros, envelopes, namespaces, encoding styles y valores de catálogo posibles. Se revisaron las **29 páginas completas** de la documentación API (`ws_emisiones`) y las 3 páginas de información general (`1_Informacion Apis`).

### Errores confirmados del lado del servidor

| # | Error | Método SOAP | Producto | Severidad |
|---|---|---|---|---|
| **1** | `GuardarCliente` exige campo `pais_residencia` pero el **WSDL no lo declara** (52 params en WSDL, docs pág 25-26 mencionan `es_fumador` que tampoco está en WSDL). Al agregar parámetros no-WSDL → "Token Inactivo" | `GuardarCliente` | TODOS | **CRÍTICO** |
| **2** | `EmitirDatos` devuelve **FK constraint error** (`fk_ref_2934_1753`) — consecuencia de #1 | `EmitirDatos` | DT/RC | **CRÍTICO** |
| **3** | `EmitirDatos` devuelve "pendiente de inspección" — no hay inspecciones para enlazar (ListadoInspeccion retorna `null`) | `EmitirDatos` | CC | **BLOQUEANTE** |

### Análisis por producto

- **DT (07159):** Error #1 → Error #2. Sin `GuardarCliente` funcional, no se crea el registro de cliente que `EmitirDatos` necesita como FK.
- **CC (00312):** Error #3. Incluso si #1 se resolviera, CC requiere inspección enlazada antes de emitir. `ListadoInspeccion` retorna `null` (sin inspecciones). Según ANCON: inspecciones se crean en su app, no vía API.

### Valores correctos confirmados (de catálogos y docs)

- `cod_grupo`: **'00001'**, `nombre_grupo`: **'SIN GRUPO'**
- `nacionalidad` y `pais_residencia` en `EmitirDatos`: valores de **ListaPais** (ej: `'PANAMÁ'`)
- `presidencia` en `GuardarCliente`: valor de **ListaPais** (pág 25 docs)
- `pep`: `'002|campo_pep'` (NO), `ocupacion`: `'001'`, `profesion`: `'1'`, `actividad_economica`: `'001'`

---

## 2. Error #1: `GuardarCliente` — WSDL incompleto (falta `pais_residencia`)

### Descripción

El método `GuardarCliente` del WSDL define 52 parámetros. Sin embargo, el servidor internamente **requiere un campo adicional `pais_residencia`** que **NO está declarado en el WSDL** (`GuardarClienteRequest`).

- Al enviar solo los 52 parámetros del WSDL → Error: **"El campo PAÍS DE RESIDENCIA es obligatorio."**
- Al agregar `pais_residencia` como parámetro adicional → Error: **"Token Inactivo."** (NuSOAP rechaza parámetros no declarados en el WSDL)

### Evidencia — Sin `pais_residencia` (solo parámetros WSDL)

```
Método: GuardarCliente
Params WSDL: { tipo_persona: "N", cod_producto: "41", ..., prov_residencia: "008",
               ..., token: "...", no_cotizacion: "009-1397026", figura: "1" }
Response: [{"cod_cliente": 1, "Mensaje": "El campo PAÍS DE RESIDENCIA es obligatorio."}]
```

### Evidencia — Con `pais_residencia` agregado

```
Método: GuardarCliente
Params: { ...52 params WSDL..., pais_residencia: "PANAMA" }
Response: "Token Inactivo."
→ NuSOAP rechaza llamada porque pais_residencia no está en GuardarClienteRequest del WSDL
```

### Pruebas exhaustivas realizadas (50+ variaciones)

Se probaron TODAS las siguientes estrategias para pasar `pais_residencia` sin éxito:

**Grupo A: Valores en campos existentes del WSDL**
| Campo probado | Valores probados | Resultado |
|---|---|---|
| `prov_residencia` | `'008'`, `'PANAMA'`, `'PANAMÁ'`, `'008\|PANAMA'` | "PAÍS DE RESIDENCIA obligatorio" |
| `presidencia` | `'PANAMA'`, `'008'`, `'PANAMÁ'` | "PAÍS DE RESIDENCIA obligatorio" |
| `nacionalidad` | `'PANAMA'`, `'008'`, `'PANAMEÑO'` | "PAÍS DE RESIDENCIA obligatorio" |
| `pais_nacimiento` | `'PANAMA'`, `'PANAMÁ'`, `'008'` | "PAÍS DE RESIDENCIA obligatorio" |

**Grupo B: Formatos pipe-delimited (como PEP/Negativas usan)**
| Campo | Valor | Resultado |
|---|---|---|
| `cli_pep1` | `'002\|campo_pep'` | Sin cambio |
| `cli_lista` | `'002\|campo_lista_neg'` | Sin cambio |
| `cli_fundacion` | `'002\|campo_fundongzon'` | Sin cambio |
| Todos juntos | Correctos de catálogos | "PAÍS DE RESIDENCIA obligatorio" |

**Grupo C: Inyección de `pais_residencia` como parámetro extra**
| Envelope / Namespace | SOAPAction | Resultado |
|---|---|---|
| `urn:server_otros` simple | `urn:server_otros#GC` | "Token Inactivo" |
| `urn:emision` RPC/encoded | `urn:emision#GC` | "Token Inactivo" |
| `urn:emision` RPC/encoded | `urn:server_otros#GC` | "Token Inactivo" |
| Bare (sin namespace) | `urn:server_otros#GC` | "Token Inactivo" |
| Document/literal | `urn:emision#GC` | "Token Inactivo" |
| Posición entre `prov_residencia` y `cli_forpago` | Ambos | "Token Inactivo" |

**Grupo D: Otros parámetros**
| Variación | Resultado |
|---|---|
| `cod_producto='07159'` (real) en vez de `'41'` | "PRODUCTO obligatorio" |
| `figura='contratante'` / `'asegurado'` | "especifique la figura" |
| `figura='1'` | ✅ Acepta (pero falla por pais_residencia) |
| Todos campos de catálogo correctos | "PAÍS DE RESIDENCIA obligatorio" |

### Parámetros que SÍ funcionan (descubiertos por prueba)

| Parámetro | Valor correcto | Notas |
|---|---|---|
| `figura` | `'1'` | Valores `'contratante'`, `'N'`, `'NATURAL'` son rechazados |
| `cod_producto` | `'41'` (del ejemplo en docs) | Nuestros códigos `'07159'`, `'00312'` dan "PRODUCTO obligatorio" |
| `prov_residencia` | `'008'` | Código de ListaProvincia para PANAMÁ |
| `tipo_persona` | `'N'` | Natural |
| `cli_pep1` | `'002\|campo_pep'` | NO (formato pipe de ListaPep) |
| `cli_lista` | `'002\|campo_lista_neg'` | NO (formato pipe de ListaNegativas) |
| `cli_fundacion` | `'002\|campo_fundongzon'` | NO (formato pipe de ListaOngFrancas) |
| `asegurado_igual` | `'001'` | SI (de ListaAseguradoContratante) |
| `asegurado_benef` | `'005'` | NO (de BeneficiarioContratante) |
| `asegurado_tercero` | `'006'` | NO (de TerceroContratante) |
| `ofondo` | `'001'` | Asalariado (de ListaOrigenFondo con tipo_persona='N') |
| `monto_ingreso` | `'001'` | Menor a 10,000 (de ListaMontoIngreso con tipo_persona='N') |

### Verificación del WSDL

Se verificó el WSDL actual en `server_otros.php?wsdl` el 19/03/2026. El mensaje `GuardarClienteRequest` contiene exactamente 52 parámetros (en orden):

```
tipo_persona, cod_producto, pasaporte, primer_nombre, segundo_nombre,
primer_apellido, segundo_apellido, casada, fecha_nac, sexo, presidencia,
nacionalidad, direccion_laboral, calle, casa, barriada, corregimiento,
direccion_cobros, telefono1, telefono2, celular, celular2, email, apartado,
ced_prov, ced_inicial, tomo, folio, asiento, ocupacion, pais_nacimiento,
ofondo, monto_ingreso, prov_residencia, cli_forpago, cli_frepago, cli_lista,
cli_fundacion, cli_pep1, asegurado_igual, asegurado_benef, asegurado_tercero,
cli_coa, dv, rlegal, ncomercial, aoperacion, cod_actividad, cod_clianiocon,
razon_social, token, no_cotizacion, figura
```

**`pais_residencia` NO aparece.** Sin embargo el servidor lo exige. Nota: `EmitirDatosRequest` SÍ incluye `pais_residencia` como parámetro — solo falta en `GuardarClienteRequest`.

### Solicitud

**Agregar `pais_residencia` al WSDL de `GuardarClienteRequest`** (probablemente después de `prov_residencia`, posición 34), y regenerar el WSDL.

---

## 3. Error #2: `EmitirDatos` — FK constraint error (CONSECUENCIA del Error #1)

### Descripción

`EmitirDatos` devuelve un error de constraint FK de Informix para **TODOS los productos RC** (DT `07159`, comercial `07132`, `07133`), independientemente de los valores enviados.

### Evidencia

```
Método: EmitirDatos
Productos probados: 07159 (WEB-AUTORC/DT), 07132 (RC Comercial Liviano), 07133 (RC Mediano)
Response (SIEMPRE): "Por favor volver a procesar. Check on the line:1674
[Informix][Informix ODBC Driver][Informix]Missing key in referenced table
for referential constraint (informix.fk_ref_2934_1753)."
```

### Variaciones probadas (30+ combinaciones, TODAS dan FK error)

| Variación | Resultado |
|---|---|
| `cod_grupo` vacío, `'0'`, `'00001'` | FK error |
| Compliance vacío vs lleno (todos catálogos) | FK error |
| `cod_ramo='001'` vs `'002'` en GenerarNodocumento | FK error |
| `cod_agente='01009'` (correcto) | FK error |
| `cantidad_de_pago='1'` (contado) vs `'10'` | FK error |
| `opcion='A'` vs `'B'` | FK error |
| `ramo_agt='AUTOMOVIL'` vs `'RC AUTOMOVIL'` | FK error |
| Con/sin `placa`, `observacion`, `agencia` | FK error |
| `pais_residencia='PANAMÁ'` (nombre) vs código | FK error |
| Envelope `urn:emision` RPC/encoded | FK error |
| Producto 07132 (RC Comercial Liviano) | FK error |
| Con `GuardarCliente` + `ClienteIgualContratante` previos | FK error |

### Comparación con producto CC (00312)

```
Producto CC: 00312 (AUTO COMPLETA)
Response: {"Respuesta": "El número de cotización se encuentra pendiente de inspección."}
→ ERROR DIFERENTE — CC necesita inspección (esperado), NO llega al FK check
```

CC da un error diferente porque la validación de inspección ocurre ANTES de la inserción que causa el FK error. Esto no significa que CC no tendría el mismo FK error si la inspección estuviera resuelta.

### Causa raíz CONFIRMADA

El constraint `fk_ref_2934_1753` referencia la tabla de clientes. **`ConsultarCliente` confirma que NO hay cliente registrado para ninguna cotización** — siempre devuelve "No cotización errado" (todos los formatos probados).

La cadena causal es:
1. `GuardarCliente` falla → "PAÍS DE RESIDENCIA obligatorio" (WSDL incompleto)
2. No se crea registro de cliente en la DB
3. `EmitirDatos` intenta INSERT con FK al cliente → FK violation

**Resolver el Error #1 (agregar `pais_residencia` al WSDL) debería resolver automáticamente el Error #2.**

### Solicitud

1. **Corregir el WSDL de `GuardarCliente`** (Error #1) — esto debería resolver ambos errores
2. Confirmar que `ListadoGrupos` devuelve resultados para nuestro agente (actualmente devuelve `null`)
3. Verificar que `ClienteIgualContratante` con `respuesta='001'` funciona correctamente después de `GuardarCliente`

---

## 4. Lo Que Funciona ✅ (confirmado 19/03/2026)

| Método | Estado | Notas |
|---|---|---|
| `GenerarToken` | ✅ | Token válido, IdCorredor=01009 |
| `ValidarToken` | ✅ | TOKEN ACTIVO, 60 min |
| `Estandar` | ✅ | Cotizaciones DT, CC y RC comercial con token único |
| `EstandarLimites` | ✅ | Cotización con límites personalizados |
| `GenerarNodocumento` | ✅ | Genera números de póliza (ramo 001 y 002) |
| `Listaproductos` | ✅ | 20 productos incluyendo SOBAT |
| `ListaPep` | ✅ | `001\|campo_pep`=SI, `002\|campo_pep`=NO |
| `ListaOcupacion` | ✅ | `001`=CONTADOR, etc. |
| `ListaProfesion` | ✅ | `1`=CONTADOR, etc. |
| `ListaActividad` | ✅ | `001`=NO DEFINIDA, etc. |
| `ListaPais` | ✅ | Solo campo `nombre` (sin código). Ej: `PANAMÁ` |
| `ListaProvincia` | ✅ | `cod_provres`:`008`=PANAMÁ |
| `ListaOrigenFondo` | ✅ | Requiere `tipo_persona`. `001`=Asalariado (N) |
| `ListaMontoIngreso` | ✅ | Requiere `tipo_persona`. `001`=Menor a 10,000 (N) |
| `ListaNegativas` | ✅ | `001\|campo_lista_neg`=SI, `002\|campo_lista_neg`=NO |
| `ListaOngFrancas` | ✅ | `001\|campo_fundongzon`=SI, `002\|campo_fundongzon`=NO |
| `ListaAseguradoContratante` | ✅ | `001`=SI, `004`=NO, `007`=FIANZA |
| `TerceroContratante` | ✅ | `003`=SI, `006`=NO, `009`=FIANZA |
| `BeneficiarioContratante` | ✅ | `002`=SI, `005`=NO, `008`=FIANZA |
| `TipoCliente` | ✅ | N=NATURAL, J=JURIDICO |
| `TipoIdentificacion` | ✅ | `002`=Cedula, `001`=Pasaporte |
| `ListaAnioConstitucion` | ✅ | `001`=0-5, `002`=6-7, `003`=8-99 años |
| `ListaFormaPago` | ✅ | Funcional |
| `ListaFrecuenciaPago` | ✅ | Funcional |
| `GenerarAcreedores` | ✅ | Lista de acreedores disponibles |
| `ImpresionCotizacion` | ✅ | PDF base64 de cotización |
| `ListadoGrupos` | ⚠️ | Devuelve `null` — sin grupos para nuestro agente |
| `ListadoInspeccion` | ⚠️ | Devuelve `null` — sin inspecciones disponibles |
| `ListadoExpedientes` | ⚠️ | Devuelve `null` — sin expedientes |
| `GuardarCliente` | ❌ | "PAÍS DE RESIDENCIA obligatorio" — WSDL incompleto |
| `ClienteIgualContratante` | ⚠️ | `{Mensaje:false}` con `respuesta='001'` — no registra cliente sin GC previo |
| `ConsultarCliente` | ⚠️ | "No cotización errado" — cliente nunca registrado |
| `EmitirDatos` (DT/RC) | ❌ | FK constraint error (consecuencia de GC fallido) |
| `EmitirDatos` (CC) | ⚠️ | "pendiente de inspección" (esperado, no llega al FK check) |

### Nota sobre `Estandar` y tokens

El error "Token Inactivo" en `Estandar` reportado el 17/03 fue causado por generar **múltiples tokens** — cada `GenerarToken` invalida el token anterior. Con un solo token por sesión, `Estandar` funciona correctamente.

### Nota sobre catálogos que requieren `tipo_persona`

`ListaOrigenFondo` y `ListaMontoIngreso` requieren el parámetro `tipo_persona` además del `token`. Sin este parámetro devuelven `null`.

---

## 5. Solicitudes a ANCON (resumen)

### 5.1 URGENTE: Agregar `pais_residencia` al WSDL de `GuardarCliente`

El WSDL de `GuardarClienteRequest` no incluye el campo `pais_residencia` que el servidor exige internamente. **Esto bloquea TODO el flujo de emisión** — sin cliente registrado, `EmitirDatos` falla con FK constraint.

**Acción requerida:** Agregar `<part name="pais_residencia" type="xsd:string" />` al message `GuardarClienteRequest` en el WSDL (después de `prov_residencia`) y regenerar.

### 5.2 Verificar `ListadoGrupos`

`ListadoGrupos` devuelve `null` para agente `01009`. ¿Es correcto? Si `cod_grupo` es requerido para emisión, necesitamos grupos asignados.

### 5.3 Confirmar flujo esperado de emisión

Una vez corregido el WSDL, confirmar el flujo correcto:
```
GenerarToken → Estandar → GuardarCliente(figura='1') → ClienteIgualContratante(respuesta='001')
→ GenerarNodocumento → EmitirDatos → SubirDocumentos → ImpresionPoliza
```

Para CC agregar: `ListadoInspeccion → EnlazarInspeccion` antes de `EmitirDatos`.

---

## 6. Datos Técnicos de Referencia

**Endpoint SOAP:** `https://app.asegurancon.com/ws_emisiones/server_otros.php`  
**WSDL:** `https://app.asegurancon.com/ws_emisiones/server_otros.php?wsdl`  
**WSDL targetNamespace:** `urn:emision`  
**Namespace usado:** `urn:server_otros` (funciona para todos los métodos)  
**SOAPAction correcto (WSDL):** `urn:emision#[MethodName]`  
**Binding:** RPC/encoded  
**Usuario:** `01009`  
**IdCorredor:** `01009`  
**Corredor:** LIDERES EN SEGUROS, S.A  
**Producto DT:** `07159` (WEB - AUTORC, ramo 002/001)  
**Producto CC:** `00312` (AUTO COMPLETA, ramo 001/001)  
**Productos RC Comercial:** `07132` (Liviano), `07133` (Mediano), `07134` (Pesado), `07135` (+6ton)  
**GuardarCliente cod_producto:** `'41'` (código interno, no el código del producto real)  
**GuardarCliente figura:** `'1'` (contratante/asegurado)  
**Cotizaciones de prueba:** `009-1396991` a `009-1397300+`  
**Pólizas generadas:** `0226-03688-09` a `0226-03733-09`  
**Fecha de pruebas:** 17-19 de marzo de 2026

### Catálogos de referencia para GuardarCliente

| Campo GC | Catálogo | Valor para Panamá/Natural |
|---|---|---|
| `prov_residencia` | `ListaProvincia` | `'008'` (PANAMÁ) |
| `pais_nacimiento` | `ListaPais` | `'PANAMÁ'` (solo nombre) |
| `ofondo` | `ListaOrigenFondo(N)` | `'001'` (Asalariado) |
| `monto_ingreso` | `ListaMontoIngreso(N)` | `'001'` (Menor a 10,000) |
| `cli_pep1` | `ListaPep` | `'002\|campo_pep'` (NO) |
| `cli_lista` | `ListaNegativas` | `'002\|campo_lista_neg'` (NO) |
| `cli_fundacion` | `ListaOngFrancas` | `'002\|campo_fundongzon'` (NO) |
| `ocupacion` | `ListaOcupacion` | `'001'` (CONTADOR) |
| `asegurado_igual` | `ListaAseguradoContratante` | `'001'` (SI) |
| `asegurado_benef` | `BeneficiarioContratante` | `'005'` (NO) |
| `asegurado_tercero` | `TerceroContratante` | `'006'` (NO) |
| `cod_actividad` | `ListaActividad` | `'001'` (NO DEFINIDA) |
| `cod_clianiocon` | `ListaAnioConstitucion` | `'001'` (0-5 años) |
| `cli_forpago` | `ListaFormaPago` | Código de catálogo |
| `cli_frepago` | `ListaFrecuenciaPago` | Código de catálogo |
