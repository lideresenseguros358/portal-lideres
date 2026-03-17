# Emisor Externo CC — Resumen para FEDPA

**Fecha:** 17 de marzo de 2026  
**Corredor:** LÍDERES EN SEGUROS, S.A. (código 836)  
**Usuario API:** SLIDERES

---

## Problema Reportado

Desde febrero 2026 no podíamos emitir pólizas de Cobertura Completa vía Emisor Externo. El endpoint `crear_poliza_auto_cc_externos` fallaba con:

```
ORA-01400: no se puede realizar una inserción NULL en ("SEGUROS"."POLIZAS_DE_AUTOMOVILES"."POLIZA")
```

---

## Causa

Nuestros intentos usaban el endpoint de **pruebas** (`get_nropoliza`) para obtener el número de póliza. Este endpoint:

- No vincula la póliza con la cotización (retorna `IDCOTIZACION: null`)
- Aparentemente no está preparado para el flujo completo de emisión

Al cambiar al endpoint de **producción** (`get_nropoliza_emitir`) con el campo `codCotizacion`, todo funciona correctamente.

---

## Prueba Exitosa (PROD)

```
PASO 1: get_cotizacion         → IdCotizacion: 459743  ✅
PASO 2: get_nropoliza_emitir   → POLIZA: 2138033       ✅
PASO 3: crear_poliza_auto_cc   → HTTP 200               ✅
PASO 4: Descarga carátula PDF  → 279 KB                 ✅
```

**Respuesta de emisión:**
```json
[{"Mensaje":"","Idpoliza":"7535855","NroPoliza":"04-04-2138033-0","CodCorredor":"836"}]
```

**Body usado en `get_nropoliza_emitir`:**
```json
{
  "Usuario": "SLIDERES",
  "Clave": "lider836",
  "codCotizacion": "459743"
}
```

---

## Observación

El campo `codCotizacion` no aparecía en el manual original "Emisor Externo-2021" que se nos proporcionó. Gracias por la aclaración — ya lo incorporamos.

También notamos que el endpoint de pruebas (`get_nropoliza`) ignora el campo `codCotizacion` incluso cuando se envía. Quizás sea útil que revisen ese comportamiento para que los corredores puedan hacer pruebas antes de pasar a producción.

---

## Estado Actual

✅ Emisión CC funcionando correctamente con `get_nropoliza_emitir` + `codCotizacion`  
✅ Descarga de carátula PDF funcionando vía Broker Integration  
✅ No se requiere acción adicional de parte de FEDPA
