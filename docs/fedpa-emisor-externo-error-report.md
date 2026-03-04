# Reporte de Error — Emisor Externo: crear_poliza_auto_cc_externos

**Fecha:** 4 de marzo de 2026  
**Corredor:** LÍDERES EN SEGUROS, S.A. (código 836)  
**Usuario:** SLIDERES  
**API:** EmisorFedpa.Api (Emisor Externo 2021)  
**Endpoint con error:** `POST /api/Polizas/crear_poliza_auto_cc_externos`

---

## Resumen del Problema

Al intentar emitir una póliza de Cobertura Completa (CC) usando el flujo completo del manual del Emisor Externo, el endpoint `crear_poliza_auto_cc_externos` retorna un error Oracle:

```
ORA-01400: no se puede realizar una inserción NULL en ("SEGUROS"."POLIZAS_DE_AUTOMOVILES"."POLIZA")
ORA-06512: en "CONCENTRADOR.PKG_ONDEMAND", línea 1446
ORA-06512: en "CONCENTRADOR.ODEMITEPOLIZA", línea 99
```

El campo `NroPoliza` **SÍ se envía** en el JSON del campo `data` con un valor válido obtenido previamente de `get_nropoliza`. El stored procedure `ODEMITEPOLIZA` no está leyendo el valor `NroPoliza` del JSON, o falla antes de asignarlo.

---

## Pasos Ejecutados (Flujo Completo del Manual)

### PASO 1: get_cotizacion ✅
```
POST https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/get_cotizacion
Content-Type: application/json

{
  "Ano": 2026,
  "Uso": "10",
  "CantidadPasajeros": 5,
  "SumaAsegurada": "15000",
  "CodLimiteLesiones": "1",
  "CodLimitePropiedad": "7",
  "CodLimiteGastosMedico": "16",
  "EndosoIncluido": "S",
  "CodPlan": "411",
  "CodMarca": "TOY",
  "CodModelo": "COROLLA",
  "Nombre": "PRUEBA",
  "Apellido": "EXTERNO",
  "Cedula": "8-888-9999",
  "Telefono": "67891234",
  "Email": "test@lideresenseguros.com",
  "Usuario": "SLIDERES",
  "Clave": "lider836"
}
```

**Respuesta:** HTTP 200 — Array de 30 coberturas  
- `COTIZACION` (IdCotizacion): **454256**
- `SUBRAMO`: **04**
- `RAMO`: **04**
- Prima total: **$1,132.34**

### PASO 2: get_nropoliza ✅
```
POST https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/get_nropoliza
Content-Type: application/json

{ "Usuario": "SLIDERES", "Clave": "lider836" }
```

**Respuesta:** HTTP 200
```json
[{"NUMPOL":"8938539","IDCOTIZACION":null}]
```

- NroPoliza obtenido: **8938539**

### PASO 3: crear_poliza_auto_cc_externos ❌
```
POST https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/crear_poliza_auto_cc_externos
Content-Type: multipart/form-data

Campo "data" (tipo texto):
{
  "FechaHora": "2026-03-04 02:10:51 PM",
  "Monto": "1132.34",
  "Aprobada": "S",
  "NroTransaccion": "P-1772651451090",
  "FechaAprobada": "2026-03-04 02:10:51 PM",
  "Ramo": "04",
  "SubRamo": "04",
  "IdCotizacion": "454256",
  "NroPoliza": "8938539",
  "FechaDesde": "2026-03-04",
  "FechaHasta": "2027-03-04",
  "Opcion": "A",
  "Usuario": "SLIDERES",
  "Clave": "lider836",
  "Entidad": [{
    "Juridico": "N",
    "NombreEmpresa": "",
    "PrimerNombre": "MARIA",
    "SegundoNombre": "",
    "PrimerApellido": "PRUEBA",
    "SegundoApellido": "TEST",
    "DocumentoIdentificacion": "CED",
    "Cedula": "8-888-9999",
    "Ruc": "",
    "FechaNacimiento": "1985-08-22",
    "Sexo": "F",
    "CodPais": "999",
    "CodProvincia": "999",
    "CodCorregimiento": "999",
    "Email": "test@lideresenseguros.com",
    "TelefonoOficina": "12412412",
    "Celular": "69457821",
    "Direccion": "PANAMA",
    "IdVinculo": "1"
  }],
  "Auto": {
    "CodMarca": "TOY",
    "CodModelo": "COROLLA",
    "Ano": "2026",
    "Placa": "CD5678",
    "Chasis": "JTDBR32E160654321",
    "Motor": "TEST987654321",
    "Color": "GRIS"
  }
}

Archivos adjuntos:
- File1: documento_identidad.jpg (JPEG válido, 631 bytes)
- File2: licencia_conducir.jpg (JPEG válido, 631 bytes)
- File3: registro_vehicular.jpg (JPEG válido, 631 bytes)
```

**Respuesta:** HTTP 500
```json
{
  "error": "ORA-01400: no se puede realizar una inserción NULL en (\"SEGUROS\".\"POLIZAS_DE_AUTOMOVILES\".\"POLIZA\")\nORA-06512: en \"CONCENTRADOR.PKG_ONDEMAND\", línea 1446\nORA-06512: en \"CONCENTRADOR.ODEMITEPOLIZA\", línea 99"
}
```

---

## Observaciones

1. El campo `NroPoliza` se envía con el valor `"8938539"` (obtenido de `get_nropoliza`), pero el stored procedure `ODEMITEPOLIZA` intenta insertar NULL en la columna `POLIZA`.

2. El formato del JSON sigue **exactamente** el ejemplo de la página 9 del manual "Manual para cotizar y emitir pólizas Emisor Externo-2021".

3. Los formatos de fecha usados:
   - `FechaHora` / `FechaAprobada`: `"yyyy-MM-dd HH:mm:ss tt"` (ej: `"2026-03-04 02:10:51 PM"`)
   - `FechaDesde` / `FechaHasta` / `FechaNacimiento`: `"yyyy-MM-dd"` (ej: `"2026-03-04"`)

4. Anteriormente (febrero 2026) se reportó un error de disco `E:\Documentos Emisor\` no disponible en el servidor. Es posible que este error esté relacionado — si el procesamiento de archivos falla antes de que el stored procedure lea `NroPoliza`.

---

## Preguntas para FEDPA

1. ¿El disco `E:\Documentos Emisor\` ya está disponible en el servidor?
2. ¿El stored procedure `ODEMITEPOLIZA` requiere que los archivos se procesen exitosamente ANTES de leer el campo `NroPoliza`?
3. ¿Hay algún requisito de tamaño mínimo para los archivos adjuntos (File1, File2, File3)?
4. ¿El campo `NroPoliza` debe ser string o integer en el JSON?
5. ¿Hay algún campo adicional requerido que no aparece en el manual?
6. ¿Pueden verificar en los logs del servidor qué valor llega para `NroPoliza` cuando se recibe nuestra solicitud?

---

## Datos de Contacto

**Corredor:** LÍDERES EN SEGUROS, S.A.  
**Código:** 836  
**Desarrollador:** Portal Líderes  
**API Usuario:** SLIDERES (Id 466 - EMISOR DE POLIZAS EMIEXT)
