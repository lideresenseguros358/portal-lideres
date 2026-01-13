# INTEGRACIÓN COMPLETA FEDPA - SISTEMA DE COTIZACIÓN Y EMISIÓN

## 📋 RESUMEN EJECUTIVO

Se ha completado la integración completa del sistema de cotización y emisión de pólizas con FEDPA, incluyendo:

- ✅ **Servicios de API completos** para todos los endpoints de FEDPA
- ✅ **Datos en tiempo real** para daños a terceros
- ✅ **Flujo completo de emisión** con carga de archivos
- ✅ **Dual API** (EmisorPlan 2024 + Emisor Externo 2021)
- ✅ **Sistema de cache** para optimizar llamadas
- ✅ **Manejo robusto de errores** y fallbacks

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Servicios Core (`src/lib/fedpa/`)

```
fedpa/
├── auth.service.ts          → Autenticación con token JWT
├── catalogs.service.ts      → Límites, usos, planes
├── cotizacion.service.ts    → Cotización de pólizas
├── documentos.service.ts    → Carga de archivos multipart
├── emision.service.ts       → Emisión completa de pólizas
├── planes.service.ts        → Gestión de planes
├── http-client.ts           → Cliente HTTP con retry
├── config.ts                → Configuración dual API
├── types.ts                 → Tipos TypeScript
└── utils.ts                 → Utilidades y validaciones
```

### Servicios Adicionales (`src/lib/services/`)

```
services/
├── fedpa-api.ts             → Servicio completo de API (NUEVO)
├── fedpa-third-party.ts     → Daños a terceros en tiempo real (NUEVO)
└── fedpa-sync.ts            → Sincronización de datos
```

### Servicios Complementarios (`src/lib/fedpa/`)

```
fedpa/ (complementarios)
├── catalogos-complementarios.ts  → Ocupaciones, colores, usos, acreedores (NUEVO)
├── error-handler.ts              → Manejo de códigos de error (NUEVO)
├── payment-integration.ts        → Integración de pagos (NUEVO)
└── expediente.service.ts         → Consulta de expedientes (NUEVO)
```

### Endpoints API (`src/app/api/fedpa/`)

```
api/fedpa/
├── auth/                    → POST - Autenticación
├── cotizacion/              → POST - Cotizar póliza
├── documentos/              → POST - Subir archivos
├── emision/                 → POST - Emitir póliza
├── limites/                 → GET - Límites y usos
├── planes/                  → GET - Planes y beneficios
├── poliza/                  → GET - Consultar póliza
├── sync/                    → POST - Sincronizar datos
└── third-party/             → GET - Daños a terceros (NUEVO)
```

---

## 🔄 FLUJO COMPLETO DE COTIZACIÓN Y EMISIÓN

### 1. COTIZACIÓN

```
Usuario → Cotizador
    ↓
Cotizador → /api/fedpa/cotizacion (POST)
    ↓
API FEDPA → Retorna cotización con prima
    ↓
Sistema → Muestra resultado al usuario
```

**Endpoint:** `POST /api/fedpa/cotizacion`

**Request:**
```json
{
  "Ano": "2024",
  "Uso": "10",
  "CantidadPasajeros": "5",
  "SumaAsegurada": "25000",
  "CodLimiteLesiones": "1",
  "CodLimitePropiedad": "1",
  "CodLimiteGastosMedico": "1",
  "EndosoIncluido": "N",
  "CodPlan": "411",
  "CodMarca": "204",
  "CodModelo": "1234",
  "Nombre": "Juan",
  "Apellido": "Pérez",
  "Cedula": "8-123-4567",
  "Telefono": "6000-0000",
  "Email": "juan@ejemplo.com"
}
```

**Response:**
```json
{
  "success": true,
  "cotizacion": {
    "idCotizacion": "COT-123456",
    "PrimaTotal": 850.50,
    "PrimaNeta": 750.00,
    "Recargo": 50.00,
    "Derecho": 25.00,
    "Impuesto": 25.50
  }
}
```

### 2. CARGA DE DOCUMENTOS

```
Usuario → Selecciona archivos
    ↓
Sistema → Valida formato y tamaño
    ↓
Sistema → Comprime imágenes si es necesario
    ↓
Sistema → /api/fedpa/documentos (POST multipart)
    ↓
API FEDPA → Confirma recepción
```

**Endpoint:** `POST /api/fedpa/documentos`

**Request:** `multipart/form-data`
- `file` (múltiples): Archivos con nombres específicos
  - `documento_identidad` (cédula/pasaporte)
  - `licencia_conducir` (licencia)
  - `registro_vehicular` (registro)

**Formatos Aceptados:**
- PDF (.pdf)
- Imágenes (.jpg, .jpeg, .png, .gif, .bmp, .webp, .tiff, .svg)

**Tamaño Máximo:** 10MB por archivo

**Validaciones:**
- ✅ Tipo MIME permitido
- ✅ Tamaño dentro del límite
- ✅ Compresión automática de imágenes grandes
- ✅ Nombres de archivo específicos para inspección

### 3. EMISIÓN DE PÓLIZA

```
Usuario → Confirma emisión
    ↓
Sistema → /api/fedpa/emision (POST)
    ↓
API FEDPA → Genera póliza
    ↓
API FEDPA → Retorna número de póliza y PDF
    ↓
Sistema → Guarda en BD
    ↓
Sistema → Muestra póliza al usuario
```

**Endpoint:** `POST /api/fedpa/emision`

**Request:**
```json
{
  "Plan": 411,
  "idDoc": "8-123-4567",
  "PrimerNombre": "Juan",
  "SegundoNombre": "",
  "PrimerApellido": "Pérez",
  "SegundoApellido": "",
  "FechaNacimiento": "01/01/1990",
  "Sexo": "M",
  "Telefono": "6000-0000",
  "Email": "juan@ejemplo.com",
  "Direccion": "Ciudad de Panamá",
  "Marca": "TOYOTA",
  "Modelo": "COROLLA",
  "Ano": "2024",
  "Placa": "ABC-1234",
  "Chasis": "1HGBH41JXMN109186",
  "Motor": "ABC123456",
  "Color": "BLANCO",
  "FechaInicio": "01/01/2025",
  "FechaFin": "01/01/2026"
}
```

**Response:**
```json
{
  "success": true,
  "poliza": "POL-2024-123456",
  "cotizacion": "COT-123456",
  "desde": "2024-01-15",
  "hasta": "2025-01-15",
  "urlPoliza": "https://fedpa.com/polizas/POL-123456.pdf"
}
```

---

## 🎯 DAÑOS A TERCEROS - DATOS EN TIEMPO REAL

### Implementación

**Antes:**
- Datos estáticos en `auto-quotes.ts`
- Coberturas fijas en código
- Actualización manual

**Después:**
- Datos dinámicos desde API FEDPA
- Actualización automática cada hora
- Fallback a datos estáticos

### Endpoint

**GET** `/api/fedpa/third-party`

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "planId": 410,
      "planName": "D.T. PARTICULAR",
      "planType": "basic",
      "coverages": {
        "bodilyInjury": "5,000 / 10,000",
        "propertyDamage": "5,000",
        "medicalExpenses": "no",
        "accidentalDeathDriver": "no",
        "accidentalDeathPassengers": "no",
        "funeralExpenses": "1,500",
        "accidentAssistance": "sí",
        "ambulance": "sí",
        "roadAssistance": "no",
        "towing": "Por accidente",
        "legalAssistance": "sí"
      },
      "annualPremium": 115.00,
      "installments": {
        "available": true,
        "description": "Hasta 2 cuotas",
        "amount": 70.00,
        "payments": 2
      },
      "benefits": [
        "ASISTENCIA MÉDICA TELEFÓNICA 24 HORAS",
        "ASISTENCIA VIAL (1 EVENTO AL AÑO HASTA B/.100.00)",
        "GASTOS FUNERARIOS (B/.1,500)"
      ]
    }
  ],
  "count": 2,
  "source": "FEDPA API",
  "timestamp": "2026-01-13T18:00:00.000Z"
}
```

### Cache

- **Duración:** 1 hora
- **Ubicación:** Memoria del servidor
- **Invalidación:** Automática después de 1 hora
- **Beneficio:** Reduce llamadas a API FEDPA

### Componente Actualizado

`ThirdPartyComparison.tsx`:
- ✅ Carga automática al montar
- ✅ Indicador visual de carga
- ✅ Actualiza solo datos de FEDPA
- ✅ Mantiene otras aseguradoras intactas
- ✅ Notificaciones de éxito/error
- ✅ Fallback a datos estáticos

---

## 🔐 CONFIGURACIÓN Y CREDENCIALES

### Variables de Entorno

Crear archivo `.env.local`:

```env
# FEDPA API Credentials
NEXT_PUBLIC_FEDPA_USER=lider836
NEXT_PUBLIC_FEDPA_CLAVE=lider836

# FEDPA API URLs (opcional, usa defaults si no se especifica)
FEDPA_EMISOR_PLAN_URL=https://wscanales.segfedpa.com/EmisorPlan
FEDPA_EMISOR_EXTERNO_URL=https://wscanales.segfedpa.com/EmisorFedpa.Api
```

### Configuración Dual API

El sistema usa dos APIs de FEDPA:

1. **EmisorPlan (2024)** - Principal
   - Autenticación con token JWT
   - Endpoints modernos
   - Mejor manejo de errores

2. **Emisor Externo (2021)** - Fallback
   - Autenticación básica
   - Endpoints legacy
   - Usado si EmisorPlan falla

---

## 📊 ENDPOINTS DE FEDPA INTEGRADOS

### Base URLs

- **EmisorPlan:** `https://wscanales.segfedpa.com/EmisorPlan`
- **Emisor Externo:** `https://wscanales.segfedpa.com/EmisorFedpa.Api`

### Catálogos (Emisor Externo)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/Polizas/consultar_limites_externos` | GET | Límites de cobertura |
| `/api/Polizas/consultar_planes_cc_externos` | GET | Planes disponibles |
| `/api/Polizas/consultar_beneficios_planes_externos` | GET | Beneficios por plan |
| `/api/Polizas/consultar_uso_externos` | GET | Tipos de uso |

### Cotización y Emisión (Emisor Externo)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/Polizas/get_cotizacion` | POST | Cotizar póliza |
| `/api/Polizas/get_nropoliza` | GET | Generar número |
| `/api/Polizas/crear_poliza_auto_cc_externos` | POST | Emitir póliza |

### Autenticación y Emisión (EmisorPlan)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/generartoken` | POST | Generar token JWT |
| `/api/planes` | GET | Obtener planes |
| `/api/planes/beneficios` | GET | Beneficios de plan |
| `/api/subirdocumentos` | POST | Subir archivos |
| `/api/emitirpoliza` | POST | Emitir póliza |

---

## ✅ VERIFICACIÓN DEL SISTEMA

### 1. Verificar Servicios de API

```bash
# Desde la raíz del proyecto
npm run dev

# En otra terminal, probar endpoints
curl http://localhost:3000/api/fedpa/third-party
```

**Resultado Esperado:**
```json
{
  "success": true,
  "plans": [...],
  "count": 2,
  "source": "FEDPA API"
}
```

### 2. Verificar Cotizador

1. Ir a `/cotizadores/third-party`
2. Verificar que se muestre el indicador "Actualizando planes de FEDPA..."
3. Verificar que aparezca notificación de éxito
4. Verificar que los planes de FEDPA muestren datos actualizados

### 3. Verificar Flujo de Emisión

1. Seleccionar plan de FEDPA
2. Completar datos del cliente
3. Subir documentos requeridos:
   - Cédula/Pasaporte
   - Licencia de conducir
   - Registro vehicular
4. Confirmar emisión
5. Verificar que se genere número de póliza
6. Verificar que se pueda descargar PDF

### 4. Verificar Manejo de Errores

**Prueba 1: API no disponible**
- Desconectar internet temporalmente
- Verificar que use datos estáticos
- Verificar notificación de error

**Prueba 2: Archivo inválido**
- Intentar subir archivo > 10MB
- Verificar mensaje de error
- Verificar que no se suba

**Prueba 3: Datos incompletos**
- Intentar cotizar sin llenar todos los campos
- Verificar validación de formulario
- Verificar mensajes de error claros

---

## 🐛 TROUBLESHOOTING

### Problema: "No se pudieron actualizar planes de FEDPA"

**Causas Posibles:**
1. API de FEDPA no disponible
2. Credenciales incorrectas
3. Timeout de red

**Solución:**
- Verificar variables de entorno
- Verificar conectividad a `wscanales.segfedpa.com`
- Revisar logs del servidor
- Sistema usa datos estáticos como fallback

### Problema: "Error al subir documentos"

**Causas Posibles:**
1. Archivo muy grande (> 10MB)
2. Formato no permitido
3. Nombre de archivo incorrecto

**Solución:**
- Comprimir imágenes antes de subir
- Usar formatos permitidos (PDF, JPG, PNG)
- Verificar que nombres sean exactos

### Problema: "Error al emitir póliza"

**Causas Posibles:**
1. Documentos no subidos
2. Datos incompletos
3. Token expirado

**Solución:**
- Verificar que todos los documentos estén subidos
- Completar todos los campos requeridos
- Reintentar (sistema refresca token automáticamente)

---

## 📈 MEJORAS FUTURAS SUGERIDAS

### Corto Plazo
- [ ] Agregar más aseguradoras con API en tiempo real
- [ ] Implementar cotización comparativa automática
- [ ] Agregar historial de cotizaciones

### Mediano Plazo
- [ ] Dashboard de estadísticas de emisión
- [ ] Notificaciones de renovación automáticas
- [ ] Integración con sistema de pagos

### Largo Plazo
- [ ] App móvil para cotización rápida
- [ ] IA para recomendación de planes
- [ ] Integración con más ramos (vida, salud, etc.)

---

## 📞 SOPORTE

**Documentación FEDPA:**
- Manual de Cotización: `/public/API FEDPA/Manual para cotizar y emitir polizas Emisor Externo-2021.pdf`
- API de Emisión: `/public/API FEDPA/Documentacion de API de emision por plan.pdf`

**Contacto FEDPA:**
- Usuario: lider836
- Corredor: 836 - LÍDERES EN SEGUROS, S.A.

---

## 🎉 CONCLUSIÓN

El sistema de integración con FEDPA está **100% funcional** con:

✅ **Cotización en tiempo real**
✅ **Emisión completa con archivos**
✅ **Datos actualizados automáticamente**
✅ **Manejo robusto de errores**
✅ **Fallbacks inteligentes**
✅ **Cache optimizado**
✅ **Documentación completa**

El sistema está listo para **producción** y puede manejar el flujo completo desde la cotización hasta la descarga de la póliza emitida.

---

**Última Actualización:** 13 de enero de 2026
**Versión:** 1.0.0
**Estado:** ✅ Producción Ready
