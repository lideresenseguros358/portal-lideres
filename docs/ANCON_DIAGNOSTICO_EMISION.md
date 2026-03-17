# DIAGNÓSTICO COMPLETO: Emisión ANCON (CC + DT)

**Fecha:** 17 de marzo de 2026  
**Estado:** BLOQUEADO — requiere acción de ANCON

---

## 1. Resumen Ejecutivo

Se realizó una auditoría completa del flujo de cotización y emisión de ANCON. La **cotización funciona correctamente** para ambos flujos (CC y DT). La **emisión está bloqueada** por dos razones:

1. **Inspección requerida**: El sistema de ANCON exige que la cotización tenga una inspección vehicular enlazada antes de permitir la emisión.
2. **Permisos de emisión**: Según las credenciales recibidas, ANCON indicó que "para emisiones, estamos revisando permisos con el equipo técnico".

---

## 2. Lo Que Funciona ✅

| Componente | Estado | Detalle |
|---|---|---|
| **GenerarToken** | ✅ OK | Token se genera correctamente con usuario `01009` |
| **ValidarToken** | ✅ OK | Token se valida y tiene 28+ minutos de vida |
| **ListaMarcaModelos** | ✅ OK | Catálogo de marcas y modelos disponible |
| **Listaproductos** | ✅ OK | Productos configurados para corredor (ver sección 5) |
| **Estandar (Cotización)** | ✅ OK | Devuelve coberturas, primas y `NoCotizacion` |
| **EstandarLimites** | ✅ OK | Cotización con límites personalizados |
| **ImpresionCotizacion** | ✅ OK | Genera enlace a PDF de cotización |
| **GenerarNodocumento** | ✅ OK | Genera números de póliza (ej: `0226-03618-09`) |
| **SubirDocumentos** | ✅ OK | Retorna lista de documentos requeridos |
| **Catálogos de compliance** | ✅ OK | PEP, Ocupación, Profesión, País, Actividad |
| **PagueloFacil (pago)** | ✅ OK | Cobro de tarjeta funciona antes de emisión |

---

## 3. Lo Que Falla ❌

### 3.1 Error de Emisión

**Método:** `EmitirDatos` (SOAP)  
**Endpoint:** `https://app.asegurancon.com/ws_emisiones/server_otros.php`

**Error exacto recibido:**
```
"El número de cotización se encuentra pendiente de inspección."
```

**Contexto:** Después de:
1. ✅ Generar token exitosamente
2. ✅ Generar cotización `009-1396297`
3. ✅ Generar número de póliza `0226-03618-09`
4. ❌ Llamar a `EmitirDatos` → Error de inspección

### 3.2 Detalle Técnico del Error

El método `EmitirDatos` del WSDL requiere que la cotización tenga una inspección vehicular enlazada previamente mediante el método `EnlazarInspeccion`.

**Pregunta para ANCON:** ¿Es posible que para emisiones vía API de corredores se pueda omitir el requisito de inspección, o necesitamos primero generar una inspección a través de su app y luego enlazarla vía `EnlazarInspeccion`?

---

## 4. Bugs Corregidos en Nuestro Sistema

Se identificaron y corrigieron 3 bugs en nuestro código:

| Bug | Descripción | Corrección |
|---|---|---|
| **Nombre de método SOAP incorrecto** | Usábamos `EmisionServer` como nombre de operación SOAP | Corregido a `EmitirDatos` (nombre real del WSDL) |
| **cod_agente incorrecto** | Enviábamos `00099` | Corregido a `01009` (debe coincidir con `IdCorredor` del token) |
| **Producto DT incorrecto** | Emisión DT usaba `00312` (AUTO COMPLETA) | Corregido a `07159` (WEB - AUTORC) |

---

## 5. Productos Disponibles para Nuestro Corredor

### Particulares (subramo 001):
| Código | Nombre |
|---|---|
| `00312` | AUTO COMPLETA (CC) |
| `10394` | AUTO COMPLETA - EXTRA PLUS 2024 |
| `10395` | AUTO COMPLETA - TU CHOFER PRIVADO 2024 |
| `10602` | EXTRA PLUS 2024 - CLIENTE SIN SINIESTROS |
| `00318` | USADITO |
| `07159` | **WEB - AUTORC** (DT / Daños a Terceros) |

### Comerciales (subramo 002):
| Código | Nombre |
|---|---|
| `07132` | RC WEB LIVIANO 2 TONELADAS (ACTIVO) |
| `07133` | RC WEB MEDIANO 4 TONELADAS (ACTIVO) |
| `07134` | RC WEB PESADO 6 TONELADAS (ACTIVO) |
| `07135` | RC WEB +6 TONELADAS (VOLQUETES Y MULA) ACTIVO |
| `07702` | WEB LIVIANO COB. COMPLETA HASTA 2 TONELADAS |
| `07703` | WEB MEDIANO COB. COMPLETA 4 TONELADAS |
| `07708` | WEB PESADO COB. COMPLETA 6 TONELADAS |

---

## 6. Documentos Requeridos para Emisión (vía API)

### Persona Natural:
| # | Documento | ¿Obligatorio? |
|---|---|---|
| 1 | Solicitud de seguros | **SÍ** |
| 2 | Conoce a tu cliente | No |
| 3 | Copia de la cédula de identidad del contratante | **SÍ** |
| 4 | Copia de la cédula de identidad del asegurado | **SÍ** |
| 5 | Copia de la licencia de conducir del asegurado | **SÍ** |
| 6 | Copia de la licencia del conductor habitual | No |
| 7 | Registro vehicular | No |

### Persona Jurídica:
| # | Documento | ¿Obligatorio? |
|---|---|---|
| 1 | Solicitud de seguros | **SÍ** |
| 2 | Conoce a tu cliente | No |
| 3 | Cédula del representante legal | **SÍ** |
| 4 | Copia de la licencia del conductor habitual | No |
| 5 | Registro vehicular | No |
| 6 | Registro público | **SÍ** |
| 7 | Aviso de operación | **SÍ** |
| 8 | Declaración Jurada de Beneficiarios Finales | **SÍ** |
| 9 | Copia de la cédula de identidad del asegurado | **SÍ** |
| 10 | Copia de la licencia de conducir del asegurado | **SÍ** |

**Nota:** El método `SubirDocumentos` solo lista los documentos requeridos. La subida real de archivos se hace mediante el endpoint REST `POST /api/Polizas/post_add_documentos_polizas_emision`.

---

## 7. Flujo Completo Esperado (una vez habilitados los permisos)

```
1. GenerarToken → obtener token de sesión
2. Estandar / EstandarLimites → cotizar (obtener NoCotizacion)
3. [Usuario selecciona opción y completa datos]
4. PagueloFacil → cobrar tarjeta
5. GenerarNodocumento → obtener número de póliza
6. ListadoInspeccion → verificar inspecciones disponibles
7. EnlazarInspeccion → enlazar inspección a la cotización
8. EmitirDatos → emitir la póliza
9. SubirDocumentos + REST upload → subir documentos requeridos
10. ImpresionPoliza → obtener carátula PDF
```

---

## 8. Integración PagueloFacil

El sistema de pago está **funcional**. El flujo es:
1. Usuario ingresa datos de tarjeta en el frontend
2. Se cobra la prima (primera cuota o total) vía `POST /api/paguelofacil/charge`
3. Si el pago es aprobado → se procede con la emisión
4. Si hay cuotas futuras → se programan en `adm_cot_recurrences` para cobro automático

---

## 9. Preguntas Pendientes para ANCON

1. **¿Ya están habilitados los permisos de emisión para nuestro corredor (01009)?**
   - Las credenciales indicaban que estaban "revisando permisos con el equipo técnico".

2. **¿Es obligatorio enlazar una inspección vía `EnlazarInspeccion` antes de emitir?**
   - Si sí: ¿cómo generamos inspecciones? ¿Necesitamos usar la app de ANCON?
   - Si no: ¿es posible configurar nuestro perfil para que no sea obligatorio?

3. **¿El endpoint REST `post_add_documentos_polizas_emision` es el correcto para subir documentos del expediente?**
   - ¿Acepta multipart/form-data con los archivos?
   - ¿Qué campos necesita (token, poliza, tipo_documento, archivo)?

4. **¿El método `ImpresionPoliza` genera un enlace directo al PDF de la carátula?**
   - En la documentación devuelve `enlace_poliza` — ¿es un URL público o temporal?

---

## 10. Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/lib/ancon/config.ts` | Método SOAP corregido a `EmitirDatos`, `codAgente` a `01009`, producto DT a `07159` |
| `src/app/cotizadores/emitir-danos-terceros/page.tsx` | Producto DT corregido de `00312` a `07159` |
