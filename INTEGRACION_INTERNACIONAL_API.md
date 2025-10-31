# 🔌 INTEGRACIÓN API INTERNACIONAL - Auto Cobertura Completa

**Fecha:** Octubre 31, 2025  
**Estado:** ✅ APIs Integradas en Flujo de Cotización

---

## 🎯 OBJETIVO

Integrar las APIs **REALES** de INTERNACIONAL de Seguros en el flujo de Auto Cobertura Completa, mientras los demás cotizadores siguen usando datos MOCK.

---

## ✅ LO QUE SE IMPLEMENTÓ

### 1. COTIZACIÓN CON API REAL

**Archivo modificado:** `/app/cotizadores/comparar/page.tsx`

**Cambios:**
- Cuando es Auto Cobertura Completa, llama a las APIs reales de INTERNACIONAL
- Las otras 4 aseguradoras siguen siendo MOCK
- Si la API falla, usa MOCK como fallback

**Flujo de Cotización INTERNACIONAL:**
```
1. Usuario completa formulario → sessionStorage
2. Página /comparar carga datos
3. Llama `/api/is/auto/quote` → Genera ID cotización
4. Llama `/api/is/auto/coberturas?vIdPv=xxx` → Obtiene coberturas y precio REAL
5. Muestra INTERNACIONAL con datos reales + otras 4 aseguradoras con MOCK
```

**APIs Usadas:**
- `POST /api/is/auto/quote` - Generar cotización
  - Retorna: `{ success, idCotizacion }`
- `GET /api/is/auto/coberturas?vIdPv=xxx` - Obtener coberturas y precio
  - Retorna: `{ success, data: { coberturas[], primaTotal, total } }`

---

## 📋 MAPEO DE DATOS

### Del Formulario a API IS:

| Campo Formulario | Campo API IS | Mapeo Actual |
|------------------|--------------|--------------|
| nombreCompleto | vnombre + vapellido | Split por espacio |
| cedula | vnrodoc | Directo (o default) |
| email | vcorreo | Directo (o default) |
| telefono | vtelefono | Directo (o default) |
| marca | vcodmarca | Mapeo manual (TOY, HON, NIS...) |
| modelo | vcodmodelo | Default 'COROLLA' |
| anio | vanioauto | Directo |
| valorVehiculo | vsumaaseg | Directo |

### Códigos Fijos:
- `vcodtipodoc`: 'CED' (Cédula)
- `vcodplancobertura`: '1' (Cobertura completa)
- `vcodgrupotarifa`: '1' (Standard)
- `environment`: 'development' (Testing)

**⚠️ MEJORA PENDIENTE:**
- Implementar catálogos completos de marcas/modelos desde IS
- Permitir al usuario seleccionar marca/modelo de listas reales
- Guardar códigos IS en sessionStorage para emisión

---

## 🔄 FLUJO COMPLETO ACTUAL

### COTIZACIÓN:

```
FormAutoCoberturaCompleta
  ↓ (guarda en sessionStorage)
/comparar
  ↓
  ├─ Genera 4 cotizaciones MOCK (FEDPA, MAPFRE, ASSA, ANCÓN)
  └─ Llama API REAL INTERNACIONAL
       ↓
     POST /api/is/auto/quote
       ↓ (retorna idCotizacion)
     GET /api/is/auto/coberturas?vIdPv={id}
       ↓ (retorna coberturas[] + primaTotal)
     Muestra 5 cotizaciones (1 REAL + 4 MOCK)
```

### SELECCIÓN:

```
Usuario selecciona INTERNACIONAL
  ↓
QuoteComparison guarda en sessionStorage:
  {
    ...selectedPlan,
    _isReal: true,
    _idCotizacion: "xxx",
    _vcodmarca: "TOY",
    _vcodmodelo: "COROLLA",
    _vcodplancobertura: "1",
    _vcodgrupotarifa: "1",
  }
  ↓
Redirige a /emitir?step=payment
```

---

## 🚧 EMISIÓN (PENDIENTE DE INTEGRACIÓN)

**Estado Actual:** Flujo genérico sin conectar a API real

**Lo que falta:**
1. Detectar si es INTERNACIONAL con `_isReal === true`
2. En el paso final de confirmación, llamar a `/api/is/auto/emitir`
3. Pasar todos los datos necesarios:
   - `vIdPv` (ID de cotización)
   - Todos los campos del cliente
   - Todos los campos del vehículo (placa, VIN, motor de EmissionDataForm)
   - `paymentToken` del CreditCardInput
4. Al emitir exitosamente:
   - Crear cliente en BD (si no existe)
   - Crear póliza en BD
   - Mostrar número de póliza
   - Descargar PDF (si disponible)

**API a usar:**
```typescript
POST /api/is/auto/emitir
{
  vIdPv: string,           // ID cotización
  vcodtipodoc: string,
  vnrodoc: string,
  vnombre: string,
  vapellido: string,
  vtelefono: string,
  vcorreo: string,
  vcodmarca: string,
  vcodmodelo: string,
  vanioauto: number,
  vsumaaseg: number,
  vcodplancobertura: string,
  vcodgrupotarifa: string,
  paymentToken: string,    // Del CreditCardInput
  environment: string,
  
  // Adicionales
  tipo_cobertura: string,
  vmarca_label: string,
  vmodelo_label: string,
}

Retorna:
{
  success: true,
  nroPoliza: string,
  pdfUrl: string,
  clientId: string,
  policyId: string,
}
```

---

## 📁 ARCHIVOS INVOLUCRADOS

### Modificados:
- ✅ `/app/cotizadores/comparar/page.tsx` - Integración API cotización

### APIs Existentes (YA IMPLEMENTADAS):
- ✅ `/app/api/is/auto/quote/route.ts` - Generar cotización
- ✅ `/app/api/is/auto/coberturas/route.ts` - Obtener coberturas
- ✅ `/app/api/is/auto/emitir/route.ts` - Emitir póliza
- ✅ `/app/api/is/catalogs/route.ts` - Catálogos (marcas, modelos, etc.)

### Servicios:
- ✅ `/lib/is/quotes.service.ts` - Lógica de cotización y emisión
- ✅ `/lib/is/catalogs.service.ts` - Lógica de catálogos
- ✅ `/lib/is/http-client.ts` - Cliente HTTP con retry
- ✅ `/lib/is/config.ts` - Configuración y endpoints

### Pendientes de Modificar:
- ⏳ `/app/cotizadores/emitir/page.tsx` - Integrar emisión con API real
- ⏳ `/components/cotizadores/FinalQuoteSummary.tsx` - Llamar a API emisión

---

## 🧪 TESTING

### Para Probar Cotización INTERNACIONAL:

1. Ir a `/cotizadores/auto/completa`
2. Llenar formulario:
   - Nombre: "Juan Pérez"
   - Marca: "TOYOTA"
   - Modelo: Cualquiera
   - Año: 2020
   - Valor: $15,000
3. Cotizar
4. En `/comparar`:
   - Ver 5 aseguradoras
   - INTERNACIONAL debe tener precio REAL (diferente a MOCK)
   - Abrir consola y ver logs `[INTERNACIONAL]`
5. Verificar:
   - ID Cotización generado
   - Coberturas obtenidas
   - Prima total real

### Logs Esperados en Consola:
```
[IS Quotes] Generando cotización auto... 
[INTERNACIONAL] ID Cotización: xxx
[IS Quotes] Obteniendo coberturas...
[INTERNACIONAL] Prima Total REAL: 1234.56
[INTERNACIONAL] Coberturas: 8
```

---

## ⚠️ LIMITACIONES ACTUALES

1. **Mapeo Manual de Marcas/Modelos:**
   - Solo 8 marcas mapeadas (Toyota, Honda, Nissan, etc.)
   - Modelo siempre es 'COROLLA'
   - **Solución futura:** Cargar catálogos de IS y permitir selección

2. **Códigos Fijos:**
   - Plan de cobertura siempre es '1'
   - Grupo tarifa siempre es '1'
   - **Solución futura:** Permitir seleccionar diferentes planes

3. **Fallback a MOCK:**
   - Si la API falla, usa datos MOCK
   - Usuario no nota la diferencia
   - **Solución:** Mostrar indicador visual "Cotización Real" vs "Estimado"

4. **Datos de Cliente Opcionales:**
   - Si faltan en formulario, usa defaults
   - Esto funciona para cotización pero NO para emisión
   - **Solución:** Validar campos obligatorios en EmissionDataForm

---

## 🚀 PRÓXIMOS PASOS

### Inmediato:
1. ✅ Integrar API cotización - **COMPLETADO**
2. ⏳ Integrar API emisión en flujo de confirmación
3. ⏳ Pasar `_idCotizacion` y códigos IS al flujo de emisión
4. ⏳ Modificar `handleConfirmEmission` para detectar INTERNACIONAL

### Corto Plazo:
5. Implementar catálogos reales de marcas/modelos
6. Agregar selección de planes en formulario
7. Indicador visual "Cotización Real" en card de INTERNACIONAL
8. Manejo de errores mejorado con toast messages

### Largo Plazo:
9. Integrar todas las aseguradoras con sus APIs
10. Sistema de caché para cotizaciones
11. Comparación de coberturas lado a lado
12. Historial de cotizaciones del usuario

---

## ✅ VERIFICACIÓN

```bash
✅ npm run typecheck - 0 errores
✅ APIs existentes funcionando
✅ Flujo de cotización integrado
✅ Fallback a MOCK si API falla
✅ Logs para debugging
⏳ Emisión pendiente de integrar
```

---

## 📝 NOTAS

- Las APIs de IS ya estaban implementadas por ti
- Solo faltaba conectarlas al flujo del cotizador
- La integración es progresiva: INTERNACIONAL primero, luego las demás
- Los datos MOCK siguen disponibles como fallback
- El flujo es completamente funcional con o sin la API

**Estado:** ✅ COTIZACIÓN INTEGRADA - EMISIÓN PENDIENTE

