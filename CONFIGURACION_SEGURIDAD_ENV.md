# Configuración de Seguridad - Variables de Entorno

## ✅ Refactorización Completada

**Commit:** `d3d58ae` - Todas las credenciales eliminadas del código fuente

---

## 📋 Variables de Entorno Requeridas

Estas variables **DEBEN** estar configuradas tanto en `.env.local` (desarrollo) como en Vercel (producción):

### FEDPA
```env
USUARIO_FEDPA="SLIDERES"
CLAVE_FEDPA="lider836"
```

### Internacional de Seguros (IS)
```env
KEY_DESARROLLO_IS="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
KEY_PRODUCCION_IS="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔧 Configuración en Vercel

### Paso 1: Acceder a Variables de Entorno
1. Ir al proyecto en Vercel
2. Settings → Environment Variables

### Paso 2: Agregar Variables
Agregar las siguientes variables con sus valores:

| Variable | Valor | Environments |
|----------|-------|--------------|
| `USUARIO_FEDPA` | `SLIDERES` | Production, Preview, Development |
| `CLAVE_FEDPA` | `lider836` | Production, Preview, Development |
| `KEY_DESARROLLO_IS` | Token JWT desarrollo | Development, Preview |
| `KEY_PRODUCCION_IS` | Token JWT producción | Production |

### Paso 3: Re-deploy
Después de agregar las variables:
1. Ir a Deployments
2. Re-deploy el último deployment
3. Verificar que no haya errores en los logs

---

## 🏗️ Arquitectura Implementada

### Internacional de Seguros (IS)

#### Sistema de Token Diario
```
TOKEN PRINCIPAL (ENV) 
    ↓
GET /api/tokens (IS)
    ↓
TOKEN DIARIO (cache 23h)
    ↓
Requests a IS API
```

**Flujo:**
1. Al iniciar, se obtiene token diario usando token principal
2. Token diario se cachea en memoria por 23 horas
3. Todos los requests usan token diario
4. Si expira o hay bloqueo WAF, se regenera automáticamente

**Archivos:**
- `src/lib/is/token-manager.ts` - Gestión de token diario
- `src/lib/is/config.ts` - Funciones para obtener ENV vars
- `src/lib/is/http-client.ts` - Cliente HTTP que usa token diario
- `src/app/api/is/refresh-token/route.ts` - Endpoint manual de refresh

#### Endpoints IS (Todos GET)
```
BASE DEV:  https://www.iseguros.com/APIRestIsTester/api
BASE PROD: https://www.iseguros.com/APIRestIs/api

GET /tokens                                    → Token diario
GET /cotizaemisorauto/getmarcas                → Catálogo marcas
GET /cotizaemisorauto/getmodelos               → Catálogo modelos
GET /cotizaemisorauto/getgenerarcotizacion/... → Generar cotización
GET /cotizaemisorauto/getcoberturascotizacion  → Obtener coberturas
```

**⚠️ IMPORTANTE:** Todos los parámetros van en path, no en body JSON.

### FEDPA

**Archivos:**
- `src/lib/fedpa/config.ts` - Credenciales desde ENV vars
- `src/lib/services/fedpa-api.ts` - Validación de ENV al inicio

**URLs:**
```
Emisor Plan (2024):    https://wscanales.segfedpa.com/EmisorPlan
Emisor Externo (2021): https://wscanales.segfedpa.com/EmisorFedpa.Api
```

---

## 🔒 Reglas de Seguridad Implementadas

### ✅ Nunca en el Código
- ❌ NO hardcodear tokens ni contraseñas
- ❌ NO imprimir tokens completos en logs
- ❌ NO exponer credenciales en responses al frontend

### ✅ Siempre Server-Side
- ✅ Todas las llamadas a IS/FEDPA desde API routes
- ✅ Variables de entorno leídas con `process.env`
- ✅ Token principal solo para obtener token diario
- ✅ Frontend nunca ve tokens directamente

### ✅ Logs Seguros
```typescript
// ❌ MAL
console.log('Token:', token);

// ✅ BIEN
console.log('Token preview:', token.substring(0, 20) + '...');
```

---

## 🧪 Testing

### Verificar ENV Vars Locales
```bash
# En .env.local, verificar que existan:
cat .env.local | grep "USUARIO_FEDPA\|CLAVE_FEDPA\|KEY_.*_IS"
```

### Test Token Diario IS
```bash
# Desarrollo
curl http://localhost:3000/api/is/refresh-token?env=development

# Producción (en Vercel)
curl https://tu-dominio.vercel.app/api/is/refresh-token?env=production
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Token renovado exitosamente",
  "environment": "development",
  "tokenPreview": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

### Test Cotización IS
```typescript
// Desde componente React
const response = await fetch('/api/is/auto/quote', {
  method: 'POST',
  body: JSON.stringify({
    vnrodoc: '8-123-4567',
    vnombre: 'Juan',
    vapellido: 'Pérez',
    // ... resto de campos
    environment: 'production' // o 'development'
  })
});
```

---

## 🚨 Troubleshooting

### Error: "Variable de entorno no configurada"
**Causa:** Falta alguna variable en Vercel o .env.local

**Solución:**
1. Verificar `.env.local` localmente
2. Verificar Vercel → Settings → Environment Variables
3. Re-deploy después de agregar variables

### Error: "Token diario no encontrado"
**Causa:** Falla al obtener token diario de IS

**Solución:**
1. Verificar que `KEY_DESARROLLO_IS` o `KEY_PRODUCCION_IS` sea correcta
2. Llamar manualmente `/api/is/refresh-token?env=production`
3. Revisar logs de Vercel para ver error específico de IS

### Error: "Bloqueo WAF detectado"
**Causa:** IS devolvió HTML en lugar de JSON

**Solución:**
- El sistema automáticamente reintenta 1 vez
- Regenera el token diario
- Si persiste, contactar a IS sobre el bloqueo

### Error: HTTP 403/404 en IS
**Causa:** Token principal expirado o incorrecto

**Solución:**
1. Solicitar nuevo token principal a IS
2. Actualizar variable `KEY_PRODUCCION_IS` en Vercel
3. Re-deploy

---

## 📊 Monitoreo

### Logs a Revisar
```typescript
// Token manager
[IS Token Manager] Obteniendo token diario...
[IS Token Manager] Token cacheado válido hasta: ...

// HTTP Client
[IS HTTP Client] GET /api/cotizaemisorauto/...
[IS] Status: 200, Content-Type: application/json

// API Routes
[IS Quotes] Generando cotización...
[IS Quotes] Cotización generada: {IDCOT}
```

### Métricas Importantes
- ✅ Token diario renovado cada 23h
- ✅ Requests con status 200
- ✅ Content-Type: application/json (no text/html)
- ❌ Evitar múltiples renovaciones en corto tiempo

---

## 🎯 Próximos Pasos

### Implementación Completa IS
1. ✅ Sistema de token diario
2. ✅ Catálogos (marcas, modelos, planes)
3. ✅ Cotización auto con GET
4. ⏳ Emisión auto (pendiente documentación completa)
5. ⏳ Integración de pagos (pendiente API de IS)

### Implementación FEDPA
1. ✅ Credenciales desde ENV
2. ✅ Cotización básica
3. ⏳ Emisión (documentada, falta integrar)
4. ⏳ Subida de documentos para emisión

---

## 📞 Contactos

**Internacional de Seguros (IS):**
- API Docs: (solicitar a IS)
- Soporte técnico: (contacto IS)

**FEDPA:**
- Mercadeo FEDPA para credenciales
- Documentación: Ver `FEDPA_INTEGRATION_COMPLETE.md`

---

## ✅ Checklist de Deployment

Antes de cada deployment a producción:

- [ ] Variables en Vercel configuradas
- [ ] `.env.local` sincronizado con Vercel
- [ ] Token principal IS vigente
- [ ] Test local exitoso (`npm run dev`)
- [ ] TypeCheck sin errores (`npm run typecheck`)
- [ ] Build exitoso (`npm run build`)
- [ ] Test en preview deployment
- [ ] Verificar logs en Vercel después de deployment

---

**Última actualización:** Commit `d3d58ae`  
**Estado:** ✅ Producción Ready (credenciales configurar en Vercel)
